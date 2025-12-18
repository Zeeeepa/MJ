import { chromium, Browser, Page, BrowserContext } from 'playwright';

export class BrowserAutomation {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    this.page = await this.context.newPage();

    // Hide automation
    await this.page.addInitScript(`
      Object.defineProperty(Object.getPrototypeOf(navigator), 'webdriver', { 
        get: () => undefined 
      });
    `);
  }

  async login(url: string, email: string, password: string): Promise<boolean> {
    if (!this.page) throw new Error('Browser not initialized');

    try {
      console.log(`[LOGIN] Navigating to ${url}`);
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      
      // Wait for page to load
      await this.page.waitForTimeout(2000);

      // Try common login selectors
      const emailSelectors = [
        'input[type="email"]',
        'input[name="email"]',
        'input[placeholder*="email" i]',
        'input[placeholder*="邮箱" i]',
        '#email'
      ];

      const passwordSelectors = [
        'input[type="password"]',
        'input[name="password"]',
        '#password'
      ];

      let emailInput = null;
      for (const selector of emailSelectors) {
        emailInput = await this.page.$(selector);
        if (emailInput) {
          console.log(`[LOGIN] Found email input: ${selector}`);
          break;
        }
      }

      let passwordInput = null;
      for (const selector of passwordSelectors) {
        passwordInput = await this.page.$(selector);
        if (passwordInput) {
          console.log(`[LOGIN] Found password input: ${selector}`);
          break;
        }
      }

      if (!emailInput || !passwordInput) {
        console.log('[LOGIN] Could not find login form, taking screenshot...');
        await this.page.screenshot({ path: 'login-page.png', fullPage: true });
        throw new Error('Login form not found');
      }

      // Fill credentials
      await emailInput.fill(email);
      await passwordInput.fill(password);
      
      console.log('[LOGIN] Credentials entered');

      // Find and click submit button
      const submitSelectors = [
        'button[type="submit"]',
        'button:has-text("登录")',
        'button:has-text("Login")',
        'button:has-text("Sign in")',
        'input[type="submit"]'
      ];

      let submitButton = null;
      for (const selector of submitSelectors) {
        submitButton = await this.page.$(selector);
        if (submitButton) {
          console.log(`[LOGIN] Found submit button: ${selector}`);
          break;
        }
      }

      if (submitButton) {
        await Promise.all([
          this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
          submitButton.click()
        ]);
      } else {
        // Try pressing Enter
        await passwordInput.press('Enter');
        await this.page.waitForTimeout(3000);
      }

      console.log('[LOGIN] Login submitted, checking result...');
      
      // Check if login succeeded
      const currentUrl = this.page.url();
      const isLoggedIn = !currentUrl.includes('login') && !currentUrl.includes('signin');
      
      if (isLoggedIn) {
        console.log('[LOGIN] Login successful!');
        await this.page.screenshot({ path: 'after-login.png', fullPage: true });
      }

      return isLoggedIn;
    } catch (error) {
      console.error('[LOGIN] Error:', error);
      if (this.page) {
        await this.page.screenshot({ path: 'login-error.png', fullPage: true });
      }
      return false;
    }
  }

  async sendMessage(message: string): Promise<string> {
    if (!this.page) throw new Error('Browser not initialized');

    try {
      console.log(`[CHAT] Sending message: ${message.substring(0, 50)}...`);

      // Find chat input
      const inputSelectors = [
        'textarea[placeholder*="message" i]',
        'textarea[placeholder*="消息" i]',
        'input[type="text"]',
        'textarea',
        '[contenteditable="true"]'
      ];

      let chatInput = null;
      for (const selector of inputSelectors) {
        chatInput = await this.page.$(selector);
        if (chatInput) {
          console.log(`[CHAT] Found input: ${selector}`);
          break;
        }
      }

      if (!chatInput) {
        throw new Error('Chat input not found');
      }

      // Type message
      await chatInput.fill(message);
      await this.page.waitForTimeout(500);

      // Find and click send button
      const sendSelectors = [
        'button:has-text("Send")',
        'button:has-text("发送")',
        'button[type="submit"]',
        'button[aria-label*="send" i]'
      ];

      let sendButton = null;
      for (const selector of sendSelectors) {
        sendButton = await this.page.$(selector);
        if (sendButton) {
          console.log(`[CHAT] Found send button: ${selector}`);
          break;
        }
      }

      if (sendButton) {
        await sendButton.click();
      } else {
        // Try Enter key
        await chatInput.press('Enter');
      }

      console.log('[CHAT] Message sent, waiting for response...');

      // Wait for response (look for new message)
      await this.page.waitForTimeout(2000);
      
      // Try to detect response
      const responseSelectors = [
        '.message-content',
        '.assistant-message',
        '[role="article"]',
        '.chat-message',
        'p'
      ];

      let response = '';
      for (const selector of responseSelectors) {
        const elements = await this.page.$$(selector);
        if (elements.length > 0) {
          // Get last element (most recent message)
          const lastElement = elements[elements.length - 1];
          const text = await lastElement.textContent();
          if (text && text.trim() && text !== message) {
            response = text.trim();
            console.log(`[CHAT] Found response using ${selector}`);
            break;
          }
        }
      }

      if (!response) {
        // Fallback: get all text and find new content
        const pageText = await this.page.textContent('body');
        response = pageText || 'No response detected';
      }

      console.log(`[CHAT] Response received: ${response.substring(0, 100)}...`);
      return response;

    } catch (error) {
      console.error('[CHAT] Error:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.page) await this.page.close();
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
  }

  getPage(): Page | null {
    return this.page;
  }
}
