import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';

export class BrowserController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  
  constructor(
    private options: {
      headless?: boolean;
      userAgent?: string;
      viewport?: { width: number; height: number };
    } = {}
  ) {}
  
  /**
   * Get undetectable Chrome launch arguments
   * Based on reference: https://github.com/Zeeeepa/example/tree/ec69bdbb7eda5b9be1e778b54c13b116006c84c3/Chromium
   */
  private getStealthLaunchArgs(): string[] {
    return [
      // Privacy & Incognito
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-cookie-encryption',
      '--no-pings',
      
      // Language & Region
      '--accept-lang=en-US',
      '--lang=en-US',
      '--disable-translate',
      
      // Disable interference features
      '--disable-infobars',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-session-crashed-bubble',
      '--mute-audio',
      
      // Performance & Resource optimization
      '--aggressive-cache-discard',
      '--disable-dev-shm-usage',
      '--disable-logging',
      '--disable-checker-imaging',
      '--disable-renderer-backgrounding',
      
      // Network & Connection
      '--disable-background-networking',
      '--disable-domain-reliability',
      '--disable-sync',
      '--enable-async-dns',
      '--enable-tcp-fast-open',
      '--enable-simple-cache-backend',
      '--webrtc-ip-handling-policy=disable_non_proxied_udp',
      
      // CRITICAL: Automation detection bypass
      '--disable-blink-features=AutomationControlled',
      '--test-type',
      '--metrics-recording-only',
      '--disable-breakpad',
      '--disable-crash-reporter',
      
      // GPU & Graphics
      '--ignore-gpu-blocklist',
      '--force-color-profile=srgb',
      
      // Security (ONLY for automation - never use for regular browsing)
      '--disable-web-security',
      '--ignore-certificate-errors',
      '--allow-running-insecure-content',
      '--disable-client-side-phishing-detection',
      '--password-store=basic',
      
      // Additional stealth
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials',
      '--disable-setuid-sandbox',
      '--no-sandbox', // CRITICAL for Docker/containerized environments
    ];
  }
  
  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: this.options.headless ?? true,
      args: this.getStealthLaunchArgs(),
    });
    
    this.context = await this.browser.newContext({
      userAgent: this.options.userAgent || this.getRandomUserAgent(),
      viewport: this.options.viewport || this.getRandomViewport(),
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: [],
      colorScheme: 'light',
    });
    
    this.page = await this.context.newPage();
    
    // Apply additional stealth patches after page creation
    await this.applyStealthPatches();
  }
  
  /**
   * Apply JavaScript-based stealth patches to hide automation
   */
  private async applyStealthPatches(): Promise<void> {
    if (!this.page) return;
    
    await this.page.addInitScript(() => {
      // Override navigator.webdriver
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Override automation-controlled flag
      Object.defineProperty(navigator, 'automationControlled', {
        get: () => undefined,
      });
      
      // Override plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          {
            0: { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format', enabledPlugin: Plugin },
            description: 'Portable Document Format',
            filename: 'internal-pdf-viewer',
            length: 1,
            name: 'Chrome PDF Plugin'
          },
          {
            0: { type: 'application/pdf', suffixes: 'pdf', description: '', enabledPlugin: Plugin },
            description: '',
            filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
            length: 1,
            name: 'Chrome PDF Viewer'
          },
          {
            0: { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable', enabledPlugin: Plugin },
            1: { type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client Executable', enabledPlugin: Plugin },
            description: '',
            filename: 'internal-nacl-plugin',
            length: 2,
            name: 'Native Client'
          }
        ],
      });
      
      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      
      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: 'denied' } as PermissionStatus) :
          originalQuery(parameters)
      );
      
      // Override chrome runtime
      (window as any).chrome = {
        runtime: {},
      };
      
      // Canvas fingerprint randomization
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function(type?: string) {
        if (type === 'image/png' || !type) {
          const context = this.getContext('2d');
          if (context) {
            const imageData = context.getImageData(0, 0, this.width, this.height);
            for (let i = 0; i < imageData.data.length; i += 4) {
              imageData.data[i] = imageData.data[i] + Math.floor(Math.random() * 2);
            }
            context.putImageData(imageData, 0, 0);
          }
        }
        return originalToDataURL.apply(this, [type] as any);
      };
      
      // WebGL vendor/renderer spoofing
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter: number) {
        if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
          return 'Intel Inc.';
        }
        if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
          return 'Intel Iris OpenGL Engine';
        }
        return getParameter.apply(this, [parameter] as any);
      };
    });
  }
  
  /**
   * Get random User-Agent string
   */
  private getRandomUserAgent(): string {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }
  
  /**
   * Get random viewport size
   */
  private getRandomViewport(): { width: number; height: number } {
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1536, height: 864 },
      { width: 1440, height: 900 },
    ];
    return viewports[Math.floor(Math.random() * viewports.length)];
  }
  
  async navigateTo(url: string): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');
    await this.page.goto(url, { waitUntil: 'networkidle' });
  }
  
  async screenshot(): Promise<Buffer> {
    if (!this.page) throw new Error('Browser not initialized');
    return await this.page.screenshot({ fullPage: false });
  }
  
  async screenshotToFile(filePath: string): Promise<string> {
    if (!this.page) throw new Error('Browser not initialized');
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    await this.page.screenshot({ 
      path: filePath,
      fullPage: false 
    });
    
    return filePath;
  }
  
  async type(selector: string, text: string): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');
    await this.page.fill(selector, text);
  }
  
  async click(selector: string): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');
    await this.page.click(selector);
  }
  
  async clickCoordinates(x: number, y: number): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');
    await this.page.mouse.click(x, y);
  }
  
  async drag(startX: number, startY: number, endX: number, endY: number): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');
    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    await this.page.mouse.move(endX, endY, { steps: 10 });
    await this.page.mouse.up();
  }
  
  async waitForSelector(selector: string, timeout: number = 30000): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');
    await this.page.waitForSelector(selector, { timeout });
  }
  
  async waitForButtonEnabled(selector: string, timeout: number = 30000): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');
    
    await this.page.waitForFunction(
      (sel) => {
        const button = document.querySelector(sel);
        return button && !(button as HTMLButtonElement).disabled;
      },
      selector,
      { timeout }
    );
  }
  
  async extractText(selector: string): Promise<string> {
    if (!this.page) throw new Error('Browser not initialized');
    const element = await this.page.$(selector);
    if (!element) throw new Error(`Element not found: ${selector}`);
    return await element.textContent() || '';
  }
  
  async getCurrentUrl(): Promise<string> {
    if (!this.page) throw new Error('Browser not initialized');
    return this.page.url();
  }
  
  async getCookies(): Promise<any[]> {
    if (!this.context) throw new Error('Browser not initialized');
    return await this.context.cookies();
  }
  
  async setCookies(cookies: any[]): Promise<void> {
    if (!this.context) throw new Error('Browser not initialized');
    await this.context.addCookies(cookies);
  }
  
  async saveCookies(filePath: string): Promise<void> {
    const cookies = await this.getCookies();
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(cookies, null, 2));
  }
  
  async loadCookies(filePath: string): Promise<void> {
    try {
      const cookiesJson = await fs.readFile(filePath, 'utf-8');
      const cookies = JSON.parse(cookiesJson);
      await this.setCookies(cookies);
    } catch (error) {
      console.warn(`Could not load cookies from ${filePath}:`, error);
    }
  }
  
  async evaluate<T>(fn: (...args: any[]) => T, ...args: any[]): Promise<T> {
    if (!this.page) throw new Error('Browser not initialized');
    return await this.page.evaluate(fn, ...args);
  }
  
  async close(): Promise<void> {
    if (this.page) await this.page.close();
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
  }
  
  getPage(): Page {
    if (!this.page) throw new Error('Browser not initialized');
    return this.page;
  }
}
