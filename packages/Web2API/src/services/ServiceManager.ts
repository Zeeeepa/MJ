/**
 * Service Manager - Core orchestrator for Web2API services
 * Handles service registration, flow discovery, and chat execution
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import {
  WebService,
  ServiceRegistrationRequest,
  InteractionFlow,
  BrowserSession,
  ModelAlias,
  OpenAIChatRequest,
  FlowDiscoveryResult
} from '../types';

export class ServiceManager {
  private services: Map<string, WebService> = new Map();
  private flows: Map<string, InteractionFlow[]> = new Map();
  private sessions: Map<string, BrowserSession> = new Map();
  private modelAliases: Map<string, ModelAlias> = new Map();
  private browser?: Browser;
  private contexts: Map<string, BrowserContext> = new Map();

  async initialize(): Promise<void> {
    console.log('🔧 Initializing ServiceManager...');
    
    // Launch browser
    this.browser = await chromium.launch({
      headless: process.env.HEADLESS !== 'false',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
      ]
    });
    
    console.log('✅ Browser launched');
    
    // Load services from environment if configured
    await this.loadServicesFromEnv();
  }

  async loadServicesFromEnv(): Promise<void> {
    const serviceConfigs = [
      {
        name: 'K2Think',
        url: process.env.K2THINK_URL || 'https://www.k2think.ai/',
        email: process.env.K2THINK_EMAIL,
        password: process.env.K2THINK_PASSWORD,
        alias: 'k2think'
      },
      {
        name: 'DeepSeek',
        url: process.env.DEEPSEEK_URL || 'https://chat.deepseek.com/',
        email: process.env.DEEPSEEK_EMAIL,
        password: process.env.DEEPSEEK_PASSWORD,
        alias: 'deepseek'
      },
      {
        name: 'Grok',
        url: process.env.GROK_URL || 'https://grok.com/',
        email: process.env.GROK_EMAIL,
        password: process.env.GROK_PASSWORD,
        alias: 'grok'
      },
      {
        name: 'Qwen',
        url: process.env.QWEN_URL || 'https://chat.qwen.ai/',
        email: process.env.QWEN_EMAIL,
        password: process.env.QWEN_PASSWORD,
        alias: 'qwen'
      },
      {
        name: 'Z.AI',
        url: process.env.ZAI_URL || 'https://chat.z.ai/',
        email: process.env.ZAI_EMAIL,
        password: process.env.ZAI_PASSWORD,
        alias: 'zai'
      },
      {
        name: 'Mistral',
        url: process.env.MISTRAL_URL || 'https://chat.mistral.ai',
        email: process.env.MISTRAL_EMAIL,
        password: process.env.MISTRAL_PASSWORD,
        alias: 'mistral'
      }
    ];

    for (const config of serviceConfigs) {
      if (config.email && config.password) {
        try {
          console.log(`📝 Auto-registering ${config.name}...`);
          await this.registerService({
            name: config.name,
            url: config.url,
            credentials: {
              email: config.email,
              password: config.password
            },
            defaultModel: config.alias,
            modelAliases: [config.alias]
          });
        } catch (error: any) {
          console.error(`❌ Failed to auto-register ${config.name}:`, error.message);
        }
      }
    }
  }

  async registerService(request: ServiceRegistrationRequest): Promise<WebService> {
    const serviceId = `service-${uuidv4()}`;
    
    const service: WebService = {
      id: serviceId,
      serviceId,
      name: request.name,
      url: request.url,
      status: 'active',
      credentials: request.credentials,
      defaultModel: request.defaultModel || serviceId,
      modelAliases: request.modelAliases || [],
      features: [],
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.services.set(serviceId, service);
    
    // Register model aliases
    if (request.modelAliases) {
      for (const alias of request.modelAliases) {
        const modelAlias: ModelAlias = {
          id: `alias-${uuidv4()}`,
          alias,
          serviceId,
          targetModel: request.defaultModel,
          enabled: true,
          createdAt: new Date()
        };
        this.modelAliases.set(alias, modelAlias);
      }
    }

    // Start flow discovery in background
    this.discoverFlows(serviceId).catch(err => {
      console.error(`Failed to discover flows for ${service.name}:`, err);
    });

    return service;
  }

  async discoverFlows(serviceId: string): Promise<FlowDiscoveryResult> {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found`);
    }

    console.log(`🔍 Discovering flows for ${service.name}...`);
    const startTime = Date.now();
    const flows: InteractionFlow[] = [];
    const errors: string[] = [];

    try {
      if (!this.browser) {
        throw new Error('Browser not initialized');
      }

      const context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      const page = await context.newPage();

      try {
        // Navigate to service
        await page.goto(service.url, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2000);

        // Discover login flow
        const loginFlow = await this.discoverLoginFlow(page, service);
        if (loginFlow) {
          flows.push(loginFlow);
          console.log(`  ✅ Discovered login flow`);
        }

        // Discover chat flow
        const chatFlow = await this.discoverChatFlow(page, service);
        if (chatFlow) {
          flows.push(chatFlow);
          console.log(`  ✅ Discovered chat flow`);
        }

      } finally {
        await context.close();
      }

    } catch (error: any) {
      errors.push(error.message);
      console.error(`  ❌ Error discovering flows:`, error.message);
    }

    const duration = Date.now() - startTime;
    this.flows.set(serviceId, flows);

    console.log(`✅ Flow discovery complete for ${service.name} (${duration}ms, ${flows.length} flows)`);

    return { flows, errors, duration };
  }

  private async discoverLoginFlow(page: Page, service: WebService): Promise<InteractionFlow | null> {
    try {
      // Look for common login patterns
      const selectors = {
        email: [
          'input[type="email"]',
          'input[name*="email" i]',
          'input[name*="username" i]',
          'input[placeholder*="email" i]',
          'input[id*="email" i]'
        ],
        password: [
          'input[type="password"]',
          'input[name*="password" i]',
          'input[placeholder*="password" i]'
        ],
        submit: [
          'button[type="submit"]',
          'button:has-text("Sign in")',
          'button:has-text("Log in")',
          'button:has-text("Continue")',
          'input[type="submit"]'
        ]
      };

      // Find email input
      let emailSelector = '';
      for (const sel of selectors.email) {
        if (await page.$(sel)) {
          emailSelector = sel;
          break;
        }
      }

      // Find password input
      let passwordSelector = '';
      for (const sel of selectors.password) {
        if (await page.$(sel)) {
          passwordSelector = sel;
          break;
        }
      }

      // Find submit button
      let submitSelector = '';
      for (const sel of selectors.submit) {
        if (await page.$(sel)) {
          submitSelector = sel;
          break;
        }
      }

      if (!emailSelector || !passwordSelector || !submitSelector) {
        return null;
      }

      const flow: InteractionFlow = {
        id: `flow-${uuidv4()}`,
        flowId: `${service.serviceId}-login`,
        serviceId: service.serviceId,
        name: 'Login Flow',
        description: 'Authenticate user with email and password',
        flowType: 'login',
        steps: [
          {
            stepNumber: 1,
            name: 'Enter email',
            action: {
              type: 'type',
              selector: emailSelector,
              value: '{{email}}',
              timeout: 5000
            }
          },
          {
            stepNumber: 2,
            name: 'Enter password',
            action: {
              type: 'type',
              selector: passwordSelector,
              value: '{{password}}',
              timeout: 5000
            }
          },
          {
            stepNumber: 3,
            name: 'Click submit',
            action: {
              type: 'click',
              selector: submitSelector,
              timeout: 5000
            }
          },
          {
            stepNumber: 4,
            name: 'Wait for navigation',
            action: {
              type: 'wait',
              timeout: 10000
            }
          }
        ],
        validationStatus: 'unknown',
        executionCount: 0,
        enabled: true,
        priority: 1
      };

      return flow;
    } catch (error) {
      return null;
    }
  }

  private async discoverChatFlow(page: Page, service: WebService): Promise<InteractionFlow | null> {
    try {
      // Look for common chat patterns
      const selectors = {
        input: [
          'textarea[placeholder*="message" i]',
          'textarea[placeholder*="ask" i]',
          'textarea[placeholder*="type" i]',
          'input[placeholder*="message" i]',
          'div[contenteditable="true"]',
          'textarea',
          'input[type="text"]'
        ],
        submit: [
          'button[type="submit"]',
          'button[aria-label*="send" i]',
          'button:has-text("Send")',
          'button svg', // Icon buttons
          'button[title*="send" i]'
        ],
        response: [
          '[role="article"]',
          '[data-message]',
          '.message',
          '.response',
          '[class*="message"]'
        ]
      };

      // Find chat input
      let inputSelector = '';
      for (const sel of selectors.input) {
        const elements = await page.$$(sel);
        if (elements.length > 0) {
          // Check if element is visible
          const isVisible = await elements[0].isVisible().catch(() => false);
          if (isVisible) {
            inputSelector = sel;
            break;
          }
        }
      }

      // Find submit button
      let submitSelector = '';
      for (const sel of selectors.submit) {
        const elements = await page.$$(sel);
        if (elements.length > 0) {
          const isVisible = await elements[0].isVisible().catch(() => false);
          if (isVisible) {
            submitSelector = sel;
            break;
          }
        }
      }

      if (!inputSelector) {
        return null;
      }

      const flow: InteractionFlow = {
        id: `flow-${uuidv4()}`,
        flowId: `${service.serviceId}-chat`,
        serviceId: service.serviceId,
        name: 'Chat Flow',
        description: 'Send a message and receive response',
        flowType: 'chat',
        steps: [
          {
            stepNumber: 1,
            name: 'Enter message',
            action: {
              type: 'type',
              selector: inputSelector,
              value: '{{message}}',
              timeout: 5000
            }
          },
          ...(submitSelector ? [{
            stepNumber: 2,
            name: 'Submit message',
            action: {
              type: 'click' as const,
              selector: submitSelector,
              timeout: 5000
            }
          }] : []),
          {
            stepNumber: submitSelector ? 3 : 2,
            name: 'Wait for response',
            action: {
              type: 'wait' as const,
              timeout: 30000
            }
          }
        ],
        validationStatus: 'unknown',
        executionCount: 0,
        enabled: true,
        priority: 1
      };

      return flow;
    } catch (error) {
      return null;
    }
  }

  async executeChat(serviceId: string, request: OpenAIChatRequest): Promise<any> {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found`);
    }

    const flows = this.flows.get(serviceId) || [];
    const loginFlow = flows.find(f => f.flowType === 'login');
    const chatFlow = flows.find(f => f.flowType === 'chat');

    if (!chatFlow) {
      throw new Error(`Chat flow not found for ${service.name}. Please run flow discovery first.`);
    }

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    // Create or reuse browser context
    let context = this.contexts.get(serviceId);
    if (!context) {
      context = await this.browser.newContext({
        viewport: { width: 1920, height: 1080 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      this.contexts.set(serviceId, context);
    }

    const page = await context.newPage();

    try {
      // Navigate to service
      await page.goto(service.url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Check if login is needed
      const needsLogin = loginFlow && await this.needsAuthentication(page);
      if (needsLogin && loginFlow) {
        console.log(`  🔐 Logging in to ${service.name}...`);
        await this.executeFlow(page, loginFlow, service.credentials);
        await page.waitForTimeout(2000);
      }

      // Extract message from request
      const message = request.messages[request.messages.length - 1].content;

      // Execute chat flow
      console.log(`  💬 Sending message...`);
      const response = await this.executeFlow(page, chatFlow, { message });

      // Extract response text
      const responseText = await this.extractResponse(page);

      return {
        id: `chatcmpl-${uuidv4()}`,
        content: responseText,
        promptTokens: Math.ceil(message.length / 4),
        completionTokens: Math.ceil(responseText.length / 4),
        totalTokens: Math.ceil((message.length + responseText.length) / 4)
      };

    } finally {
      await page.close();
    }
  }

  private async needsAuthentication(page: Page): Promise<boolean> {
    // Check for common authentication indicators
    const authIndicators = [
      'input[type="email"]',
      'input[type="password"]',
      'button:has-text("Sign in")',
      'button:has-text("Log in")'
    ];

    for (const selector of authIndicators) {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await element.isVisible().catch(() => false);
        if (isVisible) {
          return true;
        }
      }
    }

    return false;
  }

  private async executeFlow(page: Page, flow: InteractionFlow, variables: Record<string, any>): Promise<void> {
    for (const step of flow.steps) {
      console.log(`    ${step.stepNumber}. ${step.name}`);
      
      try {
        switch (step.action.type) {
          case 'type':
            if (step.action.selector && step.action.value) {
              const value = this.replaceVariables(step.action.value, variables);
              await page.fill(step.action.selector, value);
              await page.waitForTimeout(500);
            }
            break;

          case 'click':
            if (step.action.selector) {
              await page.click(step.action.selector);
              await page.waitForTimeout(1000);
            }
            break;

          case 'wait':
            await page.waitForTimeout(step.action.timeout || 2000);
            break;

          case 'navigate':
            if (step.action.value) {
              await page.goto(step.action.value, { waitUntil: 'networkidle' });
            }
            break;
        }
      } catch (error: any) {
        console.error(`      ❌ Step failed:`, error.message);
        throw error;
      }
    }
  }

  private replaceVariables(template: string, variables: Record<string, any>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
    return result;
  }

  private async extractResponse(page: Page): Promise<string> {
    // Wait for response to appear
    await page.waitForTimeout(5000);

    // Try multiple selectors to find the response
    const selectors = [
      '[role="article"]:last-of-type',
      '[data-message]:last-of-type',
      '.message:last-of-type',
      '.response:last-of-type',
      '[class*="message"]:last-of-type',
      '[class*="assistant"]:last-of-type'
    ];

    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const text = await element.textContent();
          if (text && text.trim().length > 0) {
            return text.trim();
          }
        }
      } catch (error) {
        continue;
      }
    }

    // Fallback: get all text from body
    const bodyText = await page.evaluate(() => document.body.innerText);
    return bodyText.split('\n').slice(-10).join('\n'); // Last 10 lines
  }

  // Public methods for API
  getServicesCount(): number {
    return this.services.size;
  }

  async listServices(): Promise<WebService[]> {
    return Array.from(this.services.values());
  }

  async getService(serviceId: string): Promise<WebService> {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found`);
    }
    return service;
  }

  async getServiceFlows(serviceId: string): Promise<InteractionFlow[]> {
    return this.flows.get(serviceId) || [];
  }

  async getModelAliases(): Promise<ModelAlias[]> {
    return Array.from(this.modelAliases.values());
  }

  async findServiceByModel(model: string): Promise<WebService | undefined> {
    // Check if it's a direct model alias
    const alias = this.modelAliases.get(model);
    if (alias) {
      return this.services.get(alias.serviceId);
    }

    // Check if it matches a default model
    for (const service of this.services.values()) {
      if (service.defaultModel === model) {
        return service;
      }
    }

    return undefined;
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up ServiceManager...');
    
    // Close all contexts
    for (const context of this.contexts.values()) {
      await context.close().catch(() => {});
    }
    this.contexts.clear();

    // Close browser
    if (this.browser) {
      await this.browser.close().catch(() => {});
    }

    console.log('✅ Cleanup complete');
  }
}
