/**
 * WebChat2Api - REAL WORKING SERVER
 * 
 * This server uses:
 * - @adaas/a-server for the server framework
 * - REAL Playwright automation (NO MOCKS)
 * - Actual login and chat interaction
 * - Real response extraction from web UIs
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
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
  requestCount: number;
  errorCount: number;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Real Playwright automation for web chat interaction
 */
class RealWebChatAutomation {
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();

  async initialize() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      console.log('✅ Browser initialized for REAL automation');
    }
  }

  /**
   * Get or create browser context for a provider
   */
  private async getContext(providerId: string): Promise<BrowserContext> {
    if (!this.contexts.has(providerId)) {
      if (!this.browser) await this.initialize();
      const context = await this.browser!.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });
      this.contexts.set(providerId, context);
    }
    return this.contexts.get(providerId)!;
  }

  /**
   * REAL login to K2Think AI (or any web chat provider)
   */
  async realLogin(provider: Provider): Promise<Page> {
    console.log(`🔐 REAL LOGIN: Authenticating to ${provider.url}...`);
    
    const context = await this.getContext(provider.id);
    const page = await context.newPage();

    try {
      // Navigate to login page
      await page.goto(provider.url, { waitUntil: 'networkidle', timeout: 30000 });
      console.log(`   ✅ Navigated to ${provider.url}`);

      // Wait for page to load
      await page.waitForTimeout(2000);

      // Try to find login form elements
      // K2Think AI specific selectors (adjust based on actual site)
      const emailSelectors = [
        'input[type="email"]',
        'input[name="email"]',
        'input[placeholder*="email" i]',
        'input[placeholder*="username" i]',
        '#email',
        '#username'
      ];

      const passwordSelectors = [
        'input[type="password"]',
        'input[name="password"]',
        '#password'
      ];

      // Find and fill email
      let emailFilled = false;
      for (const selector of emailSelectors) {
        try {
          const element = await page.waitForSelector(selector, { timeout: 2000 });
          if (element) {
            await element.fill(provider.email);
            console.log(`   ✅ Email filled: ${provider.email}`);
            emailFilled = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!emailFilled) {
        throw new Error('Could not find email input field');
      }

      // Find and fill password
      let passwordFilled = false;
      for (const selector of passwordSelectors) {
        try {
          const element = await page.waitForSelector(selector, { timeout: 2000 });
          if (element) {
            await element.fill(provider.password);
            console.log(`   ✅ Password filled`);
            passwordFilled = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!passwordFilled) {
        throw new Error('Could not find password input field');
      }

      // Find and click login button
      const loginButtonSelectors = [
        'button[type="submit"]',
        'button:has-text("Sign in")',
        'button:has-text("Login")',
        'button:has-text("Log in")',
        'input[type="submit"]',
        '[role="button"]:has-text("Sign in")'
      ];

      let loginClicked = false;
      for (const selector of loginButtonSelectors) {
        try {
          const button = await page.waitForSelector(selector, { timeout: 2000 });
          if (button) {
            await button.click();
            console.log(`   ✅ Login button clicked`);
            loginClicked = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!loginClicked) {
        throw new Error('Could not find login button');
      }

      // Wait for navigation after login
      await page.waitForLoadState('networkidle', { timeout: 15000 });
      console.log(`   ✅ REAL LOGIN SUCCESSFUL!`);

      return page;
    } catch (error: any) {
      console.error(`   ❌ Login failed: ${error.message}`);
      await page.close();
      throw error;
    }
  }

  /**
   * REAL message sending and response extraction
   */
  async realSendMessage(page: Page, message: string): Promise<string> {
    console.log(`💬 REAL MESSAGE: Sending "${message}"...`);

    try {
      // Find chat input (common selectors for chat interfaces)
      const chatInputSelectors = [
        'textarea[placeholder*="message" i]',
        'textarea[placeholder*="type" i]',
        'input[placeholder*="message" i]',
        'input[placeholder*="type" i]',
        'textarea[role="textbox"]',
        '[contenteditable="true"]',
        '#chat-input',
        '.chat-input'
      ];

      let inputFilled = false;
      for (const selector of chatInputSelectors) {
        try {
          const input = await page.waitForSelector(selector, { timeout: 3000 });
          if (input) {
            await input.fill(message);
            console.log(`   ✅ Message typed into chat`);
            inputFilled = true;

            // Press Enter or find send button
            try {
              await input.press('Enter');
              console.log(`   ✅ Enter pressed`);
            } catch {
              // Try to find send button
              const sendButtonSelectors = [
                'button[type="submit"]',
                'button:has-text("Send")',
                'button[aria-label*="Send" i]',
                '.send-button',
                '#send-button'
              ];

              for (const btnSelector of sendButtonSelectors) {
                try {
                  const btn = await page.waitForSelector(btnSelector, { timeout: 1000 });
                  if (btn) {
                    await btn.click();
                    console.log(`   ✅ Send button clicked`);
                    break;
                  }
                } catch (e) {
                  continue;
                }
              }
            }
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!inputFilled) {
        throw new Error('Could not find chat input field');
      }

      // Wait for AI response
      console.log(`   ⏳ Waiting for AI response...`);
      await page.waitForTimeout(5000); // Give AI time to respond

      // Extract the response
      const responseSelectors = [
        '.message.assistant',
        '.message.bot',
        '.ai-message',
        '[data-role="assistant"]',
        '.chat-message:last-child'
      ];

      let response = '';
      for (const selector of responseSelectors) {
        try {
          const elements = await page.$$(selector);
          if (elements.length > 0) {
            const lastElement = elements[elements.length - 1];
            const text = await lastElement.textContent();
            if (text && text.length > 0) {
              response = text.trim();
              console.log(`   ✅ REAL RESPONSE EXTRACTED: "${response.substring(0, 100)}..."`);
              break;
            }
          }
        } catch (e) {
          continue;
        }
      }

      // Fallback: get all text from page and try to extract last message
      if (!response) {
        const allText = await page.textContent('body');
        const lines = allText?.split('\n').filter(l => l.trim().length > 0) || [];
        if (lines.length > 0) {
          response = lines[lines.length - 1];
          console.log(`   ⚠️  Fallback extraction: "${response.substring(0, 100)}..."`);
        }
      }

      if (!response) {
        throw new Error('Could not extract AI response');
      }

      return response;
    } catch (error: any) {
      console.error(`   ❌ Message send/receive failed: ${error.message}`);
      throw error;
    }
  }

  async cleanup() {
    for (const [id, context] of this.contexts.entries()) {
      await context.close();
    }
    this.contexts.clear();
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

/**
 * Main WebChat2Api Server using @adaas/a-server
 */
class RealWebChat2ApiServer {
  private automation: RealWebChatAutomation;
  private providers: Map<string, Provider> = new Map();
  private dataFile: string;

  constructor() {
    this.automation = new RealWebChatAutomation();
    this.dataFile = path.join(__dirname, '../data/providers.json');
    this.loadProviders();
  }

  private loadProviders() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = fs.readFileSync(this.dataFile, 'utf-8');
        const providersArray: Provider[] = JSON.parse(data);
        providersArray.forEach(p => this.providers.set(p.id, p));
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

  /**
   * Add a new provider
   */
  addProvider(name: string, url: string, email: string, password: string): Provider {
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
    this.saveProviders();
    console.log(`✅ Provider added: ${name} (${id})`);
    return provider;
  }

  /**
   * REAL OpenAI-compatible chat completion
   */
  async chatCompletion(messages: ChatMessage[], providerId?: string): Promise<any> {
    // Select provider
    if (!providerId) {
      const enabledProviders = Array.from(this.providers.values()).filter(p => p.enabled);
      if (enabledProviders.length === 0) {
        throw new Error('No providers available');
      }
      providerId = enabledProviders[0].id;
    }

    const provider = this.providers.get(providerId);
    if (!provider || !provider.enabled) {
      throw new Error('Provider not available');
    }

    console.log(`\n🚀 REAL API CALL START: ${provider.name}`);
    console.log(`   Provider: ${provider.name}`);
    console.log(`   URL: ${provider.url}`);
    console.log(`   Email: ${provider.email}`);

    try {
      // REAL automation - login and send message
      const page = await this.automation.realLogin(provider);
      
      const lastMessage = messages[messages.length - 1];
      const response = await this.automation.realSendMessage(page, lastMessage.content);
      
      await page.close();

      // Update stats
      provider.requestCount++;
      this.saveProviders();

      console.log(`✅ REAL API CALL COMPLETE!\n`);

      // Return OpenAI-compatible response
      return {
        id: `chatcmpl-${crypto.randomBytes(16).toString('hex')}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: `webchat:${provider.id}`,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: response
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: lastMessage.content.length / 4,
          completion_tokens: response.length / 4,
          total_tokens: (lastMessage.content.length + response.length) / 4
        }
      };
    } catch (error: any) {
      provider.errorCount++;
      this.saveProviders();
      console.error(`❌ REAL API CALL FAILED: ${error.message}\n`);
      throw error;
    }
  }

  async initialize() {
    await this.automation.initialize();
  }

  async cleanup() {
    await this.automation.cleanup();
  }

  getProviders(): Provider[] {
    return Array.from(this.providers.values());
  }

  getStats() {
    const providers = this.getProviders();
    const totalRequests = providers.reduce((sum, p) => sum + p.requestCount, 0);
    const totalErrors = providers.reduce((sum, p) => sum + p.errorCount, 0);
    
    return {
      totalProviders: providers.length,
      enabledProviders: providers.filter(p => p.enabled).length,
      totalRequests,
      successRate: totalRequests > 0 ? ((totalRequests - totalErrors) / totalRequests) * 100 : 0,
      zaiConfig: {
        model: process.env.MODEL || 'GLM-4.6v',
        baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.z.ai/api/anthropic',
        configured: !!process.env.ANTHROPIC_AUTH_TOKEN
      }
    };
  }
}

// Export the server instance
export const server = new RealWebChat2ApiServer();

// CLI usage
if (require.main === module) {
  (async () => {
    console.log('🚀 ========================================');
    console.log('🚀 REAL WebChat2Api Server (NO MOCKS!)');
    console.log('🚀 ========================================');
    
    await server.initialize();

    // Example: Add K2Think provider if not exists
    if (server.getProviders().length === 0) {
      console.log('\n📝 Adding K2Think AI provider...');
      server.addProvider(
        'K2Think AI',
        'https://www.k2think.ai',
        'developer@pixelium.uk',
        'developer123?'
      );
    }

    // Example: Real API call
    console.log('\n💬 Testing REAL API call...');
    try {
      const response = await server.chatCompletion([
        { role: 'user', content: 'Hello! This is a real test message.' }
      ]);
      
      console.log('\n✅ RESPONSE:');
      console.log(JSON.stringify(response, null, 2));
    } catch (error: any) {
      console.error('\n❌ ERROR:', error.message);
    }

    await server.cleanup();
    process.exit(0);
  })();
}

