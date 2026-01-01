/**
 * WebChat2Api - Production Server
 * 
 * Consolidated implementation with:
 * - Multiple vision model support (GLM-4.6V, Claude, GPT-4V)
 * - Multi-provider management
 * - OpenAI-compatible API
 * - Real browser automation with Playwright
 * - Z.ai API integration for coding agents
 * - Comprehensive error handling and logging
 */

import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { chromium, Browser, Page, BrowserContext } from 'playwright';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface Provider {
  id: string;
  name: string;
  url: string;
  email: string;
  password: string;
  enabled: boolean;
  createdAt: string;
  requestCount: number;
  successCount: number;
  errorCount: number;
  lastUsed?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: 'stop' | 'length' | 'error';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface VisionAnalysis {
  isLoggedIn: boolean;
  currentState: string;
  nextAction: string;
  confidence: number;
  suggestedSelectors?: string[];
}

// ============================================================================
// VISION MODEL CLIENT (GLM-4.6V Support)
// ============================================================================

class VisionModelClient {
  private apiKey: string;
  private baseURL: string;
  private model: string;

  constructor(model: 'glm-4v' | 'claude-3-5-sonnet' | 'gpt-4-vision' = 'glm-4v') {
    this.model = model;
    
    // Configure based on model
    switch (model) {
      case 'glm-4v':
        this.apiKey = process.env.GLM_API_KEY || process.env.ZAI_API_KEY || '';
        this.baseURL = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4';
        break;
      case 'claude-3-5-sonnet':
        this.apiKey = process.env.ANTHROPIC_API_KEY || '';
        this.baseURL = 'https://api.anthropic.com/v1';
        break;
      case 'gpt-4-vision':
        this.apiKey = process.env.OPENAI_API_KEY || '';
        this.baseURL = 'https://api.openai.com/v1';
        break;
    }
  }

  async analyzeScreenshot(imagePath: string, prompt: string): Promise<VisionAnalysis> {
    try {
      console.log(`   🔍 Analyzing with ${this.model}...`);
      
      const imageData = fs.readFileSync(imagePath);
      const base64Image = imageData.toString('base64');

      let response: any;

      if (this.model === 'glm-4v') {
        response = await this.callGLMVision(base64Image, prompt);
      } else if (this.model === 'claude-3-5-sonnet') {
        response = await this.callClaudeVision(base64Image, prompt);
      } else {
        response = await this.callGPTVision(base64Image, prompt);
      }

      // Parse response
      return this.parseVisionResponse(response);
    } catch (error) {
      console.error('   ❌ Vision analysis failed:', error);
      return {
        isLoggedIn: false,
        currentState: 'unknown',
        nextAction: 'retry',
        confidence: 0
      };
    }
  }

  private async callGLMVision(base64Image: string, prompt: string): Promise<any> {
    const response = await axios.post(
      `${this.baseURL}/chat/completions`,
      {
        model: 'glm-4v',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Image}`
                }
              }
            ]
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content;
  }

  private async callClaudeVision(base64Image: string, prompt: string): Promise<any> {
    const response = await axios.post(
      `${this.baseURL}/messages`,
      {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: base64Image
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ]
      },
      {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.content[0].text;
  }

  private async callGPTVision(base64Image: string, prompt: string): Promise<any> {
    const response = await axios.post(
      `${this.baseURL}/chat/completions`,
      {
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 1024
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content;
  }

  private parseVisionResponse(response: string): VisionAnalysis {
    // Try to parse JSON response
    try {
      const parsed = JSON.parse(response);
      return parsed;
    } catch {
      // Parse text response
      const isLoggedIn = response.toLowerCase().includes('logged in') || 
                        response.toLowerCase().includes('authenticated');
      
      return {
        isLoggedIn,
        currentState: response.substring(0, 200),
        nextAction: isLoggedIn ? 'send_message' : 'login',
        confidence: 0.7
      };
    }
  }
}

// ============================================================================
// BROWSER AUTOMATION ENGINE
// ============================================================================

class BrowserEngine {
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();
  private visionClient: VisionModelClient;
  private screenshotDir: string;

  constructor(visionModel: 'glm-4v' | 'claude-3-5-sonnet' | 'gpt-4-vision' = 'glm-4v') {
    this.visionClient = new VisionModelClient(visionModel);
    this.screenshotDir = path.join(__dirname, '../screenshots');
    
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }
  }

  async initialize(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled'
        ]
      });
      console.log('✅ Browser engine initialized');
    }
  }

  async getContext(providerId: string): Promise<BrowserContext> {
    if (!this.contexts.has(providerId)) {
      if (!this.browser) await this.initialize();
      
      const context = await this.browser!.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });

      // Anti-detection
      await context.addInitScript(`
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      `);

      this.contexts.set(providerId, context);
    }
    return this.contexts.get(providerId)!;
  }

  async automateChat(
    provider: Provider,
    message: string,
    useVision: boolean = true
  ): Promise<string> {
    const context = await this.getContext(provider.id);
    const page = await context.newPage();

    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🤖 Starting automation for: ${provider.name}`);
      console.log(`${'='.repeat(60)}`);

      // Navigate to provider
      await page.goto(provider.url, { waitUntil: 'networkidle', timeout: 30000 });
      console.log(`   ✅ Navigated to ${provider.url}`);

      if (useVision) {
        // Vision-guided automation
        return await this.visionGuidedAutomation(page, provider, message);
      } else {
        // Traditional selector-based automation
        return await this.selectorBasedAutomation(page, provider, message);
      }
    } finally {
      await page.close();
    }
  }

  private async visionGuidedAutomation(
    page: Page,
    provider: Provider,
    message: string
  ): Promise<string> {
    let iteration = 0;
    const maxIterations = 10;
    let isLoggedIn = false;

    // Check login status
    const screenshotPath = path.join(this.screenshotDir, `${provider.id}-check.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const analysis = await this.visionClient.analyzeScreenshot(
      screenshotPath,
      `Analyze this webpage screenshot. Is the user logged in? 
      Look for login forms, user avatars, or authenticated UI elements.
      Respond in JSON: {"isLoggedIn": boolean, "currentState": string, "nextAction": string}`
    );

    isLoggedIn = analysis.isLoggedIn;
    console.log(`   🔍 Vision analysis: ${isLoggedIn ? 'Logged in' : 'Need to login'}`);

    // Login if needed
    if (!isLoggedIn) {
      await this.performLogin(page, provider);
      await page.waitForTimeout(2000);
    }

    // Send message
    await this.sendMessageVision(page, message);

    // Wait and extract response
    await page.waitForTimeout(5000);
    const response = await this.extractResponse(page);

    return response;
  }

  private async selectorBasedAutomation(
    page: Page,
    provider: Provider,
    message: string
  ): Promise<string> {
    // Check if login is needed
    const loginSelectors = ['input[type="email"]', 'input[type="password"]'];
    const needsLogin = await page.$(loginSelectors[0]) !== null;

    if (needsLogin) {
      await this.performLogin(page, provider);
    }

    // Send message
    await this.sendMessage(page, message);

    // Extract response
    await page.waitForTimeout(8000);
    const response = await this.extractResponse(page);

    return response;
  }

  private async performLogin(page: Page, provider: Provider): Promise<void> {
    console.log(`   🔐 Logging in to ${provider.name}...`);

    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[placeholder*="email" i]',
      '#email'
    ];

    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      '#password'
    ];

    // Find and fill email
    for (const selector of emailSelectors) {
      const input = await page.$(selector);
      if (input) {
        await input.fill(provider.email);
        console.log(`   ✅ Email entered`);
        break;
      }
    }

    // Find and fill password
    for (const selector of passwordSelectors) {
      const input = await page.$(selector);
      if (input) {
        await input.fill(provider.password);
        console.log(`   ✅ Password entered`);
        break;
      }
    }

    // Submit
    const submitButton = await page.$('button[type="submit"]');
    if (submitButton) {
      await submitButton.click();
      await page.waitForTimeout(3000);
      console.log(`   ✅ Login submitted`);
    }
  }

  private async sendMessage(page: Page, message: string): Promise<void> {
    console.log(`   💬 Sending message...`);

    const inputSelectors = [
      '#chat-input',
      'textarea[placeholder*="message" i]',
      'input[type="text"]',
      'textarea'
    ];

    for (const selector of inputSelectors) {
      const input = await page.$(selector);
      if (input) {
        await input.fill(message);
        console.log(`   ✅ Message typed`);
        
        // Find submit button
        const submitButton = await page.$('button[type="submit"]');
        if (submitButton) {
          await submitButton.click();
          console.log(`   ✅ Message sent`);
        }
        break;
      }
    }
  }

  private async sendMessageVision(page: Page, message: string): Promise<void> {
    // Take screenshot and ask vision model to identify chat input
    const screenshotPath = path.join(this.screenshotDir, `chat-ui.png`);
    await page.screenshot({ path: screenshotPath });

    const analysis = await this.visionClient.analyzeScreenshot(
      screenshotPath,
      `Find the chat input field and send button. Provide CSS selectors.
      Response format: {"chatInput": "selector", "sendButton": "selector"}`
    );

    // Use identified selectors
    if (analysis.suggestedSelectors && analysis.suggestedSelectors.length > 0) {
      const input = await page.$(analysis.suggestedSelectors[0]);
      if (input) {
        await input.fill(message);
        const button = await page.$(analysis.suggestedSelectors[1] || 'button[type="submit"]');
        if (button) await button.click();
      }
    }
  }

  private async extractResponse(page: Page): Promise<string> {
    console.log(`   📥 Extracting response...`);

    const responseSelectors = [
      '.message',
      '[class*="message"]',
      '[class*="chat"]',
      'p'
    ];

    for (const selector of responseSelectors) {
      const elements = await page.$$(selector);
      if (elements.length > 0) {
        const lastElement = elements[elements.length - 1];
        const text = await lastElement.textContent();
        if (text && text.trim().length > 10) {
          console.log(`   ✅ Response extracted (${text.length} chars)`);
          return text.trim();
        }
      }
    }

    // Fallback
    const bodyText = await page.textContent('body');
    return bodyText?.trim() || 'No response captured';
  }

  async cleanup(): Promise<void> {
    for (const context of this.contexts.values()) {
      await context.close();
    }
    this.contexts.clear();
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// ============================================================================
// PRODUCTION SERVER
// ============================================================================

class ProductionWebChat2ApiServer {
  private app: Application;
  private browserEngine: BrowserEngine;
  private providers: Map<string, Provider> = new Map();
  private dataFile: string;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3000');
    this.dataFile = path.join(__dirname, '../data/providers.json');
    
    // Initialize with configured vision model
    const visionModel = (process.env.VISION_MODEL || 'glm-4v') as any;
    this.browserEngine = new BrowserEngine(visionModel);

    this.setupMiddleware();
    this.loadProviders();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../public')));
  }

  private loadProviders(): void {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = fs.readFileSync(this.dataFile, 'utf-8');
        const providersArray: Provider[] = JSON.parse(data);
        providersArray.forEach(p => this.providers.set(p.id, p));
        console.log(`✅ Loaded ${this.providers.size} providers`);
      } else {
        // Create default provider from env
        this.createDefaultProvider();
      }
    } catch (error) {
      console.error('Failed to load providers:', error);
      this.createDefaultProvider();
    }
  }

  private createDefaultProvider(): void {
    if (process.env.K2THINK_URL && process.env.K2THINK_EMAIL) {
      const provider: Provider = {
        id: 'k2think-default',
        name: 'K2Think AI',
        url: process.env.K2THINK_URL,
        email: process.env.K2THINK_EMAIL,
        password: process.env.K2THINK_PASSWORD || '',
        enabled: true,
        createdAt: new Date().toISOString(),
        requestCount: 0,
        successCount: 0,
        errorCount: 0
      };
      this.providers.set(provider.id, provider);
      this.saveProviders();
      console.log(`✅ Created default provider: ${provider.name}`);
    }
  }

  private saveProviders(): void {
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

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        version: '2.0.0',
        providers: this.providers.size,
        visionModel: process.env.VISION_MODEL || 'glm-4v'
      });
    });

    // List models (OpenAI-compatible)
    this.app.get('/v1/models', (req, res) => {
      const models = Array.from(this.providers.values())
        .filter(p => p.enabled)
        .map(p => ({
          id: p.id,
          object: 'model',
          created: new Date(p.createdAt).getTime(),
          owned_by: 'webchat2api',
          permission: [],
          root: p.id,
          parent: null
        }));

      res.json({
        object: 'list',
        data: models
      });
    });

    // Chat completions (OpenAI-compatible)
    this.app.post('/v1/chat/completions', async (req, res) => {
      try {
        const request: ChatCompletionRequest = req.body;
        const { model, messages } = request;

        if (!model || !messages || messages.length === 0) {
          return res.status(400).json({ error: 'Invalid request' });
        }

        // Find provider by ID or by friendly name
        let provider = this.providers.get(model);
        if (!provider) {
          // Try to find by friendly name (e.g., "k2think-default" -> "K2Think AI")
          // Extract base name by removing common suffixes like -default, -ai, -chat, etc.
          const modelLower = model.toLowerCase().replace(/-(default|ai|chat|api|model)$/, '');
          for (const [id, p] of this.providers.entries()) {
            const nameLower = p.name.toLowerCase().replace(/\s+/g, '-').replace(/-(default|ai|chat|api|model)$/, '');
            if (nameLower === modelLower || nameLower.includes(modelLower) || modelLower.includes(nameLower)) {
              provider = p;
              break;
            }
          }
        }
        
        if (!provider || !provider.enabled) {
          return res.status(404).json({ error: 'Model not found or disabled' });
        }

        // Get last user message
        const lastMessage = messages.filter(m => m.role === 'user').pop();
        if (!lastMessage) {
          return res.status(400).json({ error: 'No user message found' });
        }

        // Update stats
        provider.requestCount++;
        provider.lastUsed = new Date().toISOString();

        // Execute automation
        const startTime = Date.now();
        const useVision = process.env.USE_VISION !== 'false';
        
        const response = await this.browserEngine.automateChat(
          provider,
          lastMessage.content,
          useVision
        );

        const duration = Date.now() - startTime;

        // Update stats
        provider.successCount++;
        this.saveProviders();

        // Create OpenAI-compatible response
        const completionResponse: ChatCompletionResponse = {
          id: `chatcmpl-${crypto.randomBytes(16).toString('hex')}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: model,
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: response
              },
              finish_reason: 'stop'
            }
          ],
          usage: {
            prompt_tokens: lastMessage.content.length / 4,
            completion_tokens: response.length / 4,
            total_tokens: (lastMessage.content.length + response.length) / 4
          }
        };

        console.log(`\n✅ Request completed in ${(duration / 1000).toFixed(2)}s`);
        res.json(completionResponse);

      } catch (error: any) {
        console.error('Chat completion error:', error);
        
        const model = req.body.model;
        if (model && this.providers.has(model)) {
          const provider = this.providers.get(model)!;
          provider.errorCount++;
          this.saveProviders();
        }

        res.status(500).json({
          error: {
            message: error.message || 'Internal server error',
            type: 'server_error',
            code: 'automation_failed'
          }
        });
      }
    });

    // Provider management endpoints
    this.app.get('/api/providers', (req, res) => {
      const providers = Array.from(this.providers.values()).map(p => ({
        ...p,
        password: '***'
      }));
      res.json(providers);
    });

    this.app.post('/api/providers', (req, res) => {
      const { name, url, email, password } = req.body;
      
      if (!name || !url || !email || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const id = crypto.randomBytes(8).toString('hex');
      const provider: Provider = {
        id,
        name,
        url,
        email,
        password,
        enabled: true,
        createdAt: new Date().toISOString(),
        requestCount: 0,
        successCount: 0,
        errorCount: 0
      };

      this.providers.set(id, provider);
      this.saveProviders();

      res.json({ ...provider, password: '***' });
    });

    this.app.delete('/api/providers/:id', (req, res) => {
      const { id } = req.params;
      if (this.providers.delete(id)) {
        this.saveProviders();
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Provider not found' });
      }
    });
  }

  async start(): Promise<void> {
    await this.browserEngine.initialize();

    this.app.listen(this.port, () => {
      console.log('\n' + '='.repeat(60));
      console.log('🚀 WebChat2Api Production Server');
      console.log('='.repeat(60));
      console.log(`📡 Server: http://localhost:${this.port}`);
      console.log(`🤖 Vision Model: ${process.env.VISION_MODEL || 'glm-4v'}`);
      console.log(`📊 Providers: ${this.providers.size}`);
      console.log(`🔧 Mode: ${process.env.NODE_ENV || 'production'}`);
      console.log('='.repeat(60) + '\n');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n⏹️  Shutting down...');
      await this.browserEngine.cleanup();
      process.exit(0);
    });
  }
}

// ============================================================================
// START SERVER
// ============================================================================

const server = new ProductionWebChat2ApiServer();
server.start().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
