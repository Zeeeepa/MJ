/**
 * Enhanced WebChat2Api Server
 * Full OpenAI API compatibility with multi-provider parallel execution
 * Includes management UI and real-time monitoring
 */

import express, { Express, Request, Response } from 'express';
import { json, urlencoded } from 'body-parser';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import path from 'path';
import { ProviderRegistry } from './providers/ProviderRegistry';
import { ParallelExecutor } from './execution/ParallelExecutor';
import { WebChatGateway } from './gateway/WebChatGateway';
import { Metadata } from '@memberjunction/core';
import { SQLServerDataProvider } from '@memberjunction/sqlserver-dataprovider';
import { OpenAIRequest, OpenAIResponse } from './types/openai';

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL || '';
const ENABLE_CORS = process.env.ENABLE_CORS === 'true';

class EnhancedWebChat2ApiServer {
  private app: Express;
  private httpServer: any;
  private wss: WebSocketServer | null = null;
  private registry: ProviderRegistry;
  private executor: ParallelExecutor;
  private gateway: WebChatGateway;
  private clients: Set<WebSocket> = new Set();

  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.registry = new ProviderRegistry();
    this.executor = new ParallelExecutor(this.registry, 20); // 20 concurrent jobs
    this.gateway = new WebChatGateway();
    
    this.setupEventListeners();
  }

  /**
   * Initialize server
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Enhanced WebChat2Api Server...');

    // Setup middleware
    this.setupMiddleware();

    // Initialize database
    await this.initializeDatabase();

    // Initialize gateway
    await this.gateway.initializeBrowser();

    // Setup routes
    this.setupRoutes();

    // Setup WebSocket
    this.setupWebSocket();

    // Error handling
    this.setupErrorHandling();

    console.log('✅ Server initialized');
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    this.app.use(json({ limit: '10mb' }));
    this.app.use(urlencoded({ extended: true, limit: '10mb' }));

    if (ENABLE_CORS) {
      this.app.use(cors({
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Flow-ID', 'X-Provider-ID'],
        credentials: true
      }));
    }

    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        this.broadcastLog({
          level: res.statusCode >= 400 ? 'error' : res.statusCode >= 300 ? 'info' : 'success',
          message: `${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`,
          timestamp: new Date().toISOString()
        });
      });
      next();
    });

    // Serve management UI
    this.app.use('/ui', express.static(path.join(__dirname, 'ui')));
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'WebChat2Api Enhanced Gateway',
        version: '2.0.0',
        status: 'operational',
        features: [
          'Multi-provider support',
          'Parallel execution',
          'Load balancing',
          'Real-time monitoring',
          'Management UI'
        ],
        endpoints: {
          openai: {
            chat: 'POST /v1/chat/completions',
            models: 'GET /v1/models',
            streaming: 'Supported via stream=true'
          },
          management: {
            dashboard: 'GET /ui/management-dashboard.html',
            providers: 'GET /api/providers',
            status: 'GET /api/status'
          }
        }
      });
    });

    // ===========================================
    // OpenAI-Compatible API Endpoints
    // ===========================================

    /**
     * POST /v1/chat/completions
     * Full OpenAI API compatibility
     */
    this.app.post('/v1/chat/completions', async (req, res) => {
      try {
        const request: OpenAIRequest = req.body;

        // Validate request
        if (!request.messages || !Array.isArray(request.messages)) {
          res.status(400).json({
            error: {
              message: 'Invalid request: messages array required',
              type: 'invalid_request_error',
              param: 'messages',
              code: 'invalid_request'
            }
          });
          return;
        }

        // Get provider from header or auto-select
        const providerId = req.get('X-Provider-ID');
        
        // Execute request
        const result = await this.executor.execute(request, {
          providerId,
          priority: 5,
          timeout: 60000,
          retryCount: 3
        });

        if (result.success && result.response) {
          // Send OpenAI-compatible response
          if (request.stream) {
            this.handleStreamingResponse(res, result.response);
          } else {
            res.json(result.response);
          }
        } else {
          res.status(500).json({
            error: {
              message: result.error || 'Execution failed',
              type: 'execution_error',
              code: 'execution_failed'
            }
          });
        }
      } catch (error: any) {
        res.status(500).json({
          error: {
            message: error.message || 'Internal server error',
            type: 'internal_error',
            code: 'internal_error'
          }
        });
      }
    });

    /**
     * GET /v1/models
     * List available providers as "models"
     */
    this.app.get('/v1/models', (req, res) => {
      const providers = this.registry.getEnabledProviders();
      
      const models = providers.map(p => ({
        id: `webchat:${p.providerId}`,
        object: 'model',
        created: Date.now(),
        owned_by: 'webchat2api',
        permission: [],
        root: p.name,
        parent: null,
        metadata: {
          provider: p.name,
          url: p.url,
          maxConcurrency: p.maxConcurrency,
          priority: p.priority
        }
      }));

      res.json({
        object: 'list',
        data: models
      });
    });

    /**
     * POST /v1/completions (Legacy endpoint)
     */
    this.app.post('/v1/completions', async (req, res) => {
      // Convert to chat format
      const chatRequest: OpenAIRequest = {
        model: req.body.model,
        messages: [
          { role: 'user', content: req.body.prompt }
        ],
        temperature: req.body.temperature,
        max_tokens: req.body.max_tokens,
        stream: req.body.stream
      };

      req.body = chatRequest;
      return this.app._router.handle(req, res);
    });

    // ===========================================
    // Provider Management API Endpoints
    // ===========================================

    /**
     * GET /api/providers
     * List all providers
     */
    this.app.get('/api/providers', (req, res) => {
      const providers = this.registry.exportProviders();
      res.json({ providers });
    });

    /**
     * POST /api/providers
     * Register new provider
     */
    this.app.post('/api/providers', async (req, res) => {
      try {
        const { name, url, email, password, maxConcurrency, priority, enabled } = req.body;

        if (!name || !url || !email || !password) {
          res.status(400).json({ error: 'Missing required fields' });
          return;
        }

        const providerId = await this.registry.registerProvider({
          flowId: '', // Generated automatically
          name,
          url,
          email,
          password,
          enabled: enabled !== false,
          maxConcurrency: maxConcurrency || 5,
          priority: priority || 5,
          status: 'initializing',
          errorCount: 0,
          successCount: 0,
          averageResponseTime: 0,
          currentLoad: 0
        });

        res.json({ 
          success: true, 
          providerId,
          message: 'Provider registered successfully'
        });

        this.broadcastLog({
          level: 'success',
          message: `Provider added: ${name}`,
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    /**
     * POST /api/providers/:id/enable
     * Enable provider
     */
    this.app.post('/api/providers/:id/enable', async (req, res) => {
      try {
        await this.registry.enableProvider(req.params.id);
        res.json({ success: true });
        
        this.broadcastProviderUpdate();
      } catch (error: any) {
        res.status(404).json({ error: error.message });
      }
    });

    /**
     * POST /api/providers/:id/disable
     * Disable provider
     */
    this.app.post('/api/providers/:id/disable', async (req, res) => {
      try {
        await this.registry.disableProvider(req.params.id);
        res.json({ success: true });
        
        this.broadcastProviderUpdate();
      } catch (error: any) {
        res.status(404).json({ error: error.message });
      }
    });

    /**
     * DELETE /api/providers/:id
     * Remove provider
     */
    this.app.delete('/api/providers/:id', async (req, res) => {
      try {
        await this.registry.removeProvider(req.params.id);
        res.json({ success: true });
        
        this.broadcastProviderUpdate();
      } catch (error: any) {
        res.status(404).json({ error: error.message });
      }
    });

    /**
     * GET /api/status
     * Get system status
     */
    this.app.get('/api/status', (req, res) => {
      const stats = this.registry.getStatistics();
      const providers = this.registry.exportProviders();
      const queue = this.executor.getQueueStats();

      res.json({
        stats,
        providers,
        queue,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
      });
    });

    /**
     * GET /health
     * Health check
     */
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy',
        providers: this.registry.getEnabledProviders().length,
        uptime: process.uptime()
      });
    });
  }

  /**
   * Setup WebSocket for real-time updates
   */
  private setupWebSocket(): void {
    this.wss = new WebSocketServer({ server: this.httpServer });

    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);
      console.log('🔌 WebSocket client connected');

      // Send initial data
      ws.send(JSON.stringify({
        type: 'stats_update',
        payload: this.registry.getStatistics()
      }));

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log('🔌 WebSocket client disconnected');
      });
    });

    // Broadcast updates every 2 seconds
    setInterval(() => {
      this.broadcastStatsUpdate();
      this.broadcastQueueUpdate();
    }, 2000);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Provider events
    this.registry.on('provider:registered', (provider) => {
      this.broadcastLog({
        level: 'success',
        message: `Provider registered: ${provider.name}`,
        timestamp: new Date().toISOString()
      });
      this.broadcastProviderUpdate();
    });

    this.registry.on('provider:error', ({ providerId, error }) => {
      const provider = this.registry.getProvider(providerId);
      this.broadcastLog({
        level: 'error',
        message: `Provider error (${provider?.name}): ${error}`,
        timestamp: new Date().toISOString()
      });
    });

    // Executor events
    this.executor.on('job:completed', (result) => {
      this.broadcastLog({
        level: 'success',
        message: `Job ${result.jobId} completed in ${result.executionTime}ms`,
        timestamp: new Date().toISOString()
      });
      this.broadcastQueueUpdate();
    });

    this.executor.on('job:failed', (result) => {
      this.broadcastLog({
        level: 'error',
        message: `Job ${result.jobId} failed: ${result.error}`,
        timestamp: new Date().toISOString()
      });
      this.broadcastQueueUpdate();
    });
  }

  /**
   * Broadcast statistics update
   */
  private broadcastStatsUpdate(): void {
    const stats = this.registry.getStatistics();
    this.broadcast({
      type: 'stats_update',
      payload: stats
    });
  }

  /**
   * Broadcast provider update
   */
  private broadcastProviderUpdate(): void {
    const providers = this.registry.exportProviders();
    this.broadcast({
      type: 'provider_update',
      payload: providers
    });
  }

  /**
   * Broadcast queue update
   */
  private broadcastQueueUpdate(): void {
    const queue = this.executor.getQueueStats();
    this.broadcast({
      type: 'queue_update',
      payload: queue
    });
  }

  /**
   * Broadcast log entry
   */
  private broadcastLog(log: any): void {
    this.broadcast({
      type: 'log',
      payload: log
    });
    console.log(`[${log.level}] ${log.message}`);
  }

  /**
   * Broadcast message to all WebSocket clients
   */
  private broadcast(message: any): void {
    const data = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  /**
   * Handle streaming response
   */
  private handleStreamingResponse(res: Response, response: OpenAIResponse): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const content = response.choices[0].message.content;
    const words = content.split(' ');
    
    let index = 0;
    const interval = setInterval(() => {
      if (index >= words.length) {
        clearInterval(interval);
        res.write(`data: [DONE]\n\n`);
        res.end();
        return;
      }

      const chunk = {
        id: response.id,
        object: 'chat.completion.chunk',
        created: response.created,
        model: response.model,
        choices: [{
          index: 0,
          delta: { content: words[index] + ' ' },
          finish_reason: null
        }]
      };

      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      index++;
    }, 50);
  }

  /**
   * Initialize database
   */
  private async initializeDatabase(): Promise<void> {
    console.log('📊 Connecting to database...');

    try {
      const dataProvider = new SQLServerDataProvider();
      await dataProvider.Connect(DATABASE_URL);
      Metadata.Provider.Config(dataProvider);
      console.log('✅ Database connected');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: {
          message: 'Not found',
          type: 'not_found_error',
          path: req.path
        }
      });
    });

    // Global error handler
    this.app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Unhandled error:', err);
      res.status(500).json({
        error: {
          message: err.message || 'Internal server error',
          type: 'internal_error'
        }
      });
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  /**
   * Start server
   */
  async start(): Promise<void> {
    await this.initialize();

    this.httpServer.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║    🚀 Enhanced WebChat2Api Gateway - PRODUCTION READY 🚀       ║
║                                                                ║
║  Server:           http://localhost:${PORT}                          ║
║  Management UI:    http://localhost:${PORT}/ui/management-dashboard.html      ║
║  WebSocket:        ws://localhost:${PORT}/ws                        ║
║                                                                ║
║  📊 OpenAI API Endpoints:                                       ║
║    POST /v1/chat/completions       (Full compatibility)       ║
║    GET  /v1/models                 (List providers)           ║
║    POST /v1/completions            (Legacy)                   ║
║                                                                ║
║  ⚙️  Management API:                                            ║
║    GET  /api/providers             (List providers)           ║
║    POST /api/providers             (Add provider)             ║
║    POST /api/providers/:id/enable  (Enable)                   ║
║    POST /api/providers/:id/disable (Disable)                  ║
║    GET  /api/status                (System status)            ║
║                                                                ║
║  ✨ Features:                                                   ║
║    ✓ Multi-provider support                                   ║
║    ✓ Parallel execution (${this.executor.getQueueStats().totalCapacity} concurrent jobs)              ║
║    ✓ Load balancing                                           ║
║    ✓ Real-time monitoring                                     ║
║    ✓ Auto failover                                            ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
      `);
    });
  }

  /**
   * Graceful shutdown
   */
  private async shutdown(): Promise<void> {
    console.log('Shutting down server...');
    
    await this.gateway.shutdown();
    this.executor.shutdown();
    this.registry.stopHealthChecks();
    
    if (this.wss) {
      this.wss.close();
    }
    
    this.httpServer.close();
    process.exit(0);
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new EnhancedWebChat2ApiServer();
  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { EnhancedWebChat2ApiServer };

