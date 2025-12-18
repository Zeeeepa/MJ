/**
 * Production WebChat2Api Server with Dashboard
 * 
 * Features:
 * - Dashboard UI for provider management
 * - Auto-generated OpenAI endpoints per provider
 * - AI-driven browser automation
 * - Z.AI (GLM-4.6v) integration
 * - Load balancing across providers
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { createAIGateway, WebChatGatewayAI, WebChatConfig } from './gateway/WebChatGateway-AI';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

interface Provider {
  id: string;
  name: string;
  url: string;
  email: string;
  password: string;
  enabled: boolean;
  createdAt: string;
  lastUsed?: string;
  requestCount: number;
  errorCount: number;
}

interface ProviderStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
}

class WebChat2ApiServer {
  private app: express.Application;
  private providers: Map<string, Provider> = new Map();
  private gateways: Map<string, WebChatGatewayAI> = new Map();
  private stats: Map<string, ProviderStats> = new Map();
  private dataFile: string;

  // Z.AI Configuration
  private zaiConfig = {
    authToken: process.env.ANTHROPIC_AUTH_TOKEN || '',
    baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.z.ai/api/anthropic',
    model: process.env.MODEL || 'glm-4.6v'
  };

  constructor() {
    this.app = express();
    this.dataFile = path.join(__dirname, '../data/providers.json');
    this.setupMiddleware();
    this.loadProviders();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../public')));

    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
      });
      next();
    });
  }

  private loadProviders() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = fs.readFileSync(this.dataFile, 'utf-8');
        const providersArray: Provider[] = JSON.parse(data);
        providersArray.forEach(p => {
          this.providers.set(p.id, p);
          this.stats.set(p.id, {
            totalRequests: p.requestCount || 0,
            successfulRequests: 0,
            failedRequests: p.errorCount || 0,
            avgResponseTime: 0
          });
        });
        console.log(`✅ Loaded ${this.providers.size} providers`);
      }
    } catch (error) {
      console.error('Failed to load providers:', error);
    }
  }

  private saveProviders() {
    try {
      const dir = path.dirname(this.dataFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const providersArray = Array.from(this.providers.values());
      fs.writeFileSync(this.dataFile, JSON.stringify(providersArray, null, 2));
    } catch (error) {
      console.error('Failed to save providers:', error);
    }
  }

  private setupRoutes() {
    // Dashboard UI
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/dashboard.html'));
    });

    // Provider Management API
    this.app.get('/api/providers', (req, res) => {
      const providers = Array.from(this.providers.values()).map(p => ({
        ...p,
        password: '***REDACTED***', // Don't expose passwords
        stats: this.stats.get(p.id)
      }));
      res.json(providers);
    });

    this.app.post('/api/providers', async (req, res) => {
      try {
        const { name, url, email, password } = req.body;

        if (!name || !url || !email || !password) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        const id = crypto.randomBytes(16).toString('hex');
        const provider: Provider = {
          id,
          name,
          url,
          email,
          password,
          enabled: true,
          createdAt: new Date().toISOString(),
          requestCount: 0,
          errorCount: 0
        };

        this.providers.set(id, provider);
        this.stats.set(id, {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          avgResponseTime: 0
        });
        this.saveProviders();

        // Create gateway
        await this.createGateway(id);

        res.json({ 
          success: true, 
          provider: { ...provider, password: '***REDACTED***' }
        });
      } catch (error: any) {
        console.error('Failed to add provider:', error);
        res.status(500).json({ error: error?.message || 'Unknown error' });
      }
    });

    this.app.delete('/api/providers/:id', async (req, res) => {
      const { id } = req.params;
      
      if (!this.providers.has(id)) {
        return res.status(404).json({ error: 'Provider not found' });
      }

      // Cleanup gateway
      const gateway = this.gateways.get(id);
      if (gateway) {
        await gateway.cleanup();
        this.gateways.delete(id);
      }

      this.providers.delete(id);
      this.stats.delete(id);
      this.saveProviders();

      res.json({ success: true });
    });

    this.app.patch('/api/providers/:id/toggle', (req, res) => {
      const { id } = req.params;
      const provider = this.providers.get(id);

      if (!provider) {
        return res.status(404).json({ error: 'Provider not found' });
      }

      provider.enabled = !provider.enabled;
      this.saveProviders();

      res.json({ success: true, enabled: provider.enabled });
    });

    // Health Check
    this.app.get('/api/providers/:id/health', async (req, res) => {
      const { id } = req.params;
      const gateway = this.gateways.get(id);

      if (!gateway) {
        return res.status(404).json({ error: 'Provider not found' });
      }

      try {
        const isHealthy = await gateway.healthCheck();
        res.json({ healthy: isHealthy });
      } catch (error: any) {
        res.json({ healthy: false, error: error?.message || 'Unknown error' });
      }
    });

    // OpenAI-Compatible Chat Completions Endpoint
    this.app.post('/v1/chat/completions', async (req, res) => {
      try {
        const { messages, model, stream } = req.body;

        // Extract provider from model name (e.g., "webchat:provider-id")
        let providerId: string | null = null;
        
        if (model && model.startsWith('webchat:')) {
          providerId = model.split(':')[1];
        }

        // If no provider specified, use load balancing
        if (!providerId) {
          providerId = this.selectProvider();
        }

        if (!providerId) {
          return res.status(503).json({
            error: {
              message: 'No providers available',
              type: 'service_unavailable'
            }
          });
        }

        const gateway = await this.getOrCreateGateway(providerId);
        const provider = this.providers.get(providerId);

        if (!provider || !provider.enabled) {
          return res.status(503).json({
            error: {
              message: 'Provider not available',
              type: 'service_unavailable'
            }
          });
        }

        const startTime = Date.now();

        try {
          if (stream) {
            // Streaming response
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            for await (const chunk of gateway.chatStream(messages)) {
              res.write(chunk);
            }

            res.end();
          } else {
            // Non-streaming response
            const response = await gateway.chat(messages);
            res.json(response);
          }

          // Update stats
          const duration = Date.now() - startTime;
          this.updateStats(providerId, true, duration);
          provider.lastUsed = new Date().toISOString();
          provider.requestCount++;
          this.saveProviders();

        } catch (error) {
          this.updateStats(providerId, false, Date.now() - startTime);
          provider.errorCount++;
          this.saveProviders();
          throw error;
        }

      } catch (error: any) {
        console.error('Chat completion error:', error);
        res.status(500).json({
          error: {
            message: error?.message || 'Unknown error',
            type: 'internal_error'
          }
        });
      }
    });

    // List models (shows available providers)
    this.app.get('/v1/models', (req, res) => {
      const models = Array.from(this.providers.values())
        .filter(p => p.enabled)
        .map(p => ({
          id: `webchat:${p.id}`,
          object: 'model',
          created: Math.floor(new Date(p.createdAt).getTime() / 1000),
          owned_by: 'webchat2api',
          permission: [],
          root: p.name,
          parent: null
        }));

      res.json({
        object: 'list',
        data: models
      });
    });

    // System stats
    this.app.get('/api/stats', (req, res) => {
      const totalProviders = this.providers.size;
      const enabledProviders = Array.from(this.providers.values()).filter(p => p.enabled).length;
      
      let totalRequests = 0;
      let totalSuccessful = 0;
      let totalFailed = 0;
      
      this.stats.forEach(stat => {
        totalRequests += stat.totalRequests;
        totalSuccessful += stat.successfulRequests;
        totalFailed += stat.failedRequests;
      });

      res.json({
        totalProviders,
        enabledProviders,
        totalRequests,
        successRate: totalRequests > 0 ? (totalSuccessful / totalRequests) * 100 : 0,
        zaiConfig: {
          model: this.zaiConfig.model,
          baseUrl: this.zaiConfig.baseUrl,
          configured: !!this.zaiConfig.authToken
        }
      });
    });
  }

  /**
   * Get or create gateway for provider
   */
  private async getOrCreateGateway(providerId: string): Promise<WebChatGatewayAI> {
    if (this.gateways.has(providerId)) {
      return this.gateways.get(providerId)!;
    }

    return await this.createGateway(providerId);
  }

  /**
   * Create gateway for provider
   */
  private async createGateway(providerId: string): Promise<WebChatGatewayAI> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error('Provider not found');
    }

    // Create gateway with Z.AI configuration
    const config: WebChatConfig = {
      url: provider.url,
      email: provider.email,
      password: provider.password,
      anthropicApiKey: this.zaiConfig.authToken,
      useMarkdownExtraction: true
    };

    const gateway = createAIGateway(config);
    
    // Z.AI configuration is handled via environment variables
    // ANTHROPIC_BASE_URL and ANTHROPIC_AUTH_TOKEN

    this.gateways.set(providerId, gateway);
    console.log(`✅ Created gateway for ${provider.name} (using ${this.zaiConfig.model})`);

    return gateway;
  }

  /**
   * Select best provider using load balancing
   */
  private selectProvider(): string | null {
    const enabledProviders = Array.from(this.providers.entries())
      .filter(([_, p]) => p.enabled);

    if (enabledProviders.length === 0) {
      return null;
    }

    // Simple round-robin for now
    // TODO: Implement smarter selection based on stats
    const sorted = enabledProviders.sort((a, b) => {
      const aStats = this.stats.get(a[0])!;
      const bStats = this.stats.get(b[0])!;
      return aStats.totalRequests - bStats.totalRequests;
    });

    return sorted[0][0];
  }

  /**
   * Update provider statistics
   */
  private updateStats(providerId: string, success: boolean, duration: number) {
    const stats = this.stats.get(providerId);
    if (!stats) return;

    stats.totalRequests++;
    if (success) {
      stats.successfulRequests++;
    } else {
      stats.failedRequests++;
    }

    // Update rolling average
    const alpha = 0.2; // Smoothing factor
    stats.avgResponseTime = stats.avgResponseTime * (1 - alpha) + duration * alpha;
  }

  /**
   * Start server
   */
  start(port: number = 3000) {
    this.app.listen(port, () => {
      console.log('🚀 ========================================');
      console.log('🚀 WebChat2Api Production Server');
      console.log('🚀 ========================================');
      console.log(`🌐 Dashboard: http://localhost:${port}`);
      console.log(`📡 API: http://localhost:${port}/v1/chat/completions`);
      console.log(`📊 Stats: http://localhost:${port}/api/stats`);
      console.log('');
      console.log('🤖 Z.AI Configuration:');
      console.log(`   Model: ${this.zaiConfig.model}`);
      console.log(`   Base URL: ${this.zaiConfig.baseUrl}`);
      console.log(`   Auth: ${this.zaiConfig.authToken ? '✅ Configured' : '❌ Missing'}`);
      console.log('');
      console.log(`📦 Providers: ${this.providers.size} loaded`);
      console.log('🚀 ========================================');
    });
  }
}

// Start server
const server = new WebChat2ApiServer();
const port = parseInt(process.env.PORT || '3000', 10);
server.start(port);

export { WebChat2ApiServer };
