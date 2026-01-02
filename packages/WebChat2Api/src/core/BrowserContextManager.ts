/**
 * BrowserContextManager
 * 
 * Manages a single Playwright browser instance with multiple isolated contexts
 * for different services. Provides session persistence, network monitoring,
 * and automated cleanup functionality.
 */

import { Browser, BrowserContext, chromium, Page, Request, Response } from 'playwright';
import { SessionManager, SessionCookie, BrowserContextData } from './SessionManager';

/**
 * Configuration for browser context creation
 */
export interface BrowserContextConfig {
  userAgent?: string;
  viewport?: {
    width: number;
    height: number;
  };
  locale?: string;
  timezone?: string;
  geolocation?: {
    latitude: number;
    longitude: number;
  };
  permissions?: string[];
  extraHTTPHeaders?: Record<string, string>;
  stealth?: boolean;
  recordVideo?: boolean;
  recordHar?: boolean;
}

/**
 * Network request pattern for API endpoint detection
 */
export interface NetworkPattern {
  url: string;
  method: string;
  headers: Record<string, string>;
  isStreaming: boolean;
  responseType: 'json' | 'text' | 'stream' | 'unknown';
  timestamp: Date;
  serviceName: string;
}

/**
 * Context execution action interface
 */
export interface ContextAction {
  type: 'navigate' | 'click' | 'type' | 'wait' | 'evaluate' | 'custom';
  selector?: string;
  value?: string;
  url?: string;
  script?: string;
  timeout?: number;
  waitFor?: 'load' | 'networkidle' | 'domcontentloaded';
  customHandler?: (page: Page) => Promise<unknown>;
}

/**
 * Execution result interface
 */
export interface ExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  networkPatterns?: NetworkPattern[];
  screenshots?: string[];
  duration: number;
}

/**
 * Context information interface
 */
export interface ContextInfo {
  serviceName: string;
  isActive: boolean;
  createdAt: Date;
  lastActivity: Date;
  pageCount: number;
  networkPatternCount: number;
  sessionExists: boolean;
}

/**
 * Browser context manager configuration
 */
export interface BrowserContextManagerConfig {
  sessionManager?: SessionManager;
  maxIdleTime?: number; // minutes
  cleanupInterval?: number; // minutes
  maxConcurrentContexts?: number;
  defaultViewport?: { width: number; height: number };
  enableNetworkMonitoring?: boolean;
  enableStealth?: boolean;
  browserArgs?: string[];
  headless?: boolean;
}

/**
 * Manages browser contexts for multiple services with session persistence
 * and network monitoring capabilities
 */
export class BrowserContextManager {
  private browser: Browser | null = null;
  private contexts = new Map<string, BrowserContext>();
  private contextInfo = new Map<string, ContextInfo>();
  private networkPatterns = new Map<string, NetworkPattern[]>();
  private sessionManager: SessionManager;
  private config: Required<BrowserContextManagerConfig>;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(config: BrowserContextManagerConfig = {}) {
    this.sessionManager = config.sessionManager || new SessionManager();
    
    this.config = {
      sessionManager: this.sessionManager,
      maxIdleTime: config.maxIdleTime || 30,
      cleanupInterval: config.cleanupInterval || 5,
      maxConcurrentContexts: config.maxConcurrentContexts || 10,
      defaultViewport: config.defaultViewport || { width: 1920, height: 1080 },
      enableNetworkMonitoring: config.enableNetworkMonitoring ?? true,
      enableStealth: config.enableStealth ?? true,
      browserArgs: config.browserArgs || [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor'
      ],
      headless: config.headless ?? true
    };

    this.startCleanupTimer();
  }

  /**
   * Initialize the browser instance
   */
  public async initialize(): Promise<void> {
    if (this.browser) {
      return;
    }

    await this.sessionManager.initialize();

    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: this.config.browserArgs
    });

    // Handle browser close event
    this.browser.on('disconnected', () => {
      this.handleBrowserDisconnect();
    });
  }

  /**
   * Get or create a browser context for a specific service
   */
  public async getOrCreateContext(serviceName: string, config?: BrowserContextConfig): Promise<BrowserContext> {
    await this.ensureInitialized();

    if (this.contexts.has(serviceName)) {
      await this.updateLastActivity(serviceName);
      return this.contexts.get(serviceName)!;
    }

    if (this.contexts.size >= this.config.maxConcurrentContexts) {
      await this.cleanupIdleContexts();
      
      if (this.contexts.size >= this.config.maxConcurrentContexts) {
        throw new Error(`Maximum concurrent contexts (${this.config.maxConcurrentContexts}) reached`);
      }
    }

    return await this.createNewContext(serviceName, config);
  }

  /**
   * Load session data into a context
   */
  public async loadSession(serviceName: string, session?: { cookies: SessionCookie[]; contextData: BrowserContextData }): Promise<void> {
    const context = await this.getOrCreateContext(serviceName);

    let sessionData = session;
    if (!sessionData) {
      const cookies = await this.sessionManager.getSessionCookies(serviceName);
      const contextData = await this.sessionManager.getContextData(serviceName);
      if (cookies.length > 0 || contextData) {
        sessionData = { cookies, contextData: contextData || {} };
      }
    }

    if (sessionData && sessionData.cookies.length > 0) {
      // Convert session cookies to Playwright format
      const playwrightCookies = sessionData.cookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path || '/',
        expires: cookie.expires ? Math.floor(cookie.expires.getTime() / 1000) : undefined,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite as 'Strict' | 'Lax' | 'None' | undefined
      }));

      await context.addCookies(playwrightCookies);
    }
  }

  /**
   * Execute an action within a specific service context
   */
  public async executeInContext(serviceName: string, action: ContextAction): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      const context = await this.getOrCreateContext(serviceName);
      const page = await this.getOrCreatePage(context);

      const networkPatterns: NetworkPattern[] = [];
      
      if (this.config.enableNetworkMonitoring) {
        this.setupNetworkMonitoring(page, serviceName, networkPatterns);
      }

      const result = await this.executeAction(page, action);
      
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        data: result,
        networkPatterns,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration
      };
    }
  }

  /**
   * Capture network patterns for API endpoint detection
   */
  public async captureNetworkPatterns(serviceName: string): Promise<NetworkPattern[]> {
    return this.networkPatterns.get(serviceName) || [];
  }

  /**
   * Save current session state for a service
   */
  public async saveSession(serviceName: string): Promise<void> {
    const context = this.contexts.get(serviceName);
    if (!context) {
      return;
    }

    try {
      // Get cookies from all pages in the context
      const cookies = await context.cookies();
      
      // Convert Playwright cookies to session format
      const sessionCookies: SessionCookie[] = cookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        expires: cookie.expires ? new Date(cookie.expires * 1000) : undefined,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite as 'Strict' | 'Lax' | 'None' | undefined
      }));

      // Get context data - use safer approach since _options is private
      const contextData: BrowserContextData = {
        // Store basic defaults that we know about
        viewport: this.config.defaultViewport,
        locale: 'en-US',
        timezone: 'America/New_York'
      };

      await this.sessionManager.saveSession(serviceName, sessionCookies, contextData);
      await this.updateLastActivity(serviceName);
    } catch (error) {
      throw new Error(`Failed to save session for service '${serviceName}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Close a specific context
   */
  public async closeContext(serviceName: string): Promise<void> {
    const context = this.contexts.get(serviceName);
    if (!context) {
      return;
    }

    try {
      // Save session before closing
      await this.saveSession(serviceName);
      
      await context.close();
      this.contexts.delete(serviceName);
      this.contextInfo.delete(serviceName);
      this.networkPatterns.delete(serviceName);
    } catch (error) {
      console.error(`Failed to close context for service '${serviceName}':`, error);
    }
  }

  /**
   * Close all contexts and clean up resources
   */
  public async closeAllContexts(): Promise<void> {
    this.isShuttingDown = true;
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    const closePromises = Array.from(this.contexts.keys()).map(serviceName =>
      this.closeContext(serviceName).catch(error => 
        console.error(`Error closing context '${serviceName}':`, error)
      )
    );

    await Promise.all(closePromises);

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    await this.sessionManager.close();
  }

  /**
   * Get information about all active contexts
   */
  public getActiveContexts(): ContextInfo[] {
    return Array.from(this.contextInfo.values());
  }

  /**
   * Get information about a specific context
   */
  public getContextInfo(serviceName: string): ContextInfo | null {
    return this.contextInfo.get(serviceName) || null;
  }

  /**
   * Check if a context exists for a service
   */
  public hasContext(serviceName: string): boolean {
    return this.contexts.has(serviceName);
  }

  /**
   * Clean up idle contexts
   */
  public async cleanupIdleContexts(): Promise<number> {
    if (this.isShuttingDown) {
      return 0;
    }

    const cutoffTime = new Date(Date.now() - (this.config.maxIdleTime * 60 * 1000));
    const servicesToClose: string[] = [];

    for (const [serviceName, info] of this.contextInfo.entries()) {
      if (info.lastActivity < cutoffTime) {
        servicesToClose.push(serviceName);
      }
    }

    for (const serviceName of servicesToClose) {
      await this.closeContext(serviceName);
    }

    return servicesToClose.length;
  }

  /**
   * Get browser instance statistics
   */
  public getBrowserStats(): {
    isInitialized: boolean;
    activeContexts: number;
    totalNetworkPatterns: number;
    uptime: number;
  } {
    const totalNetworkPatterns = Array.from(this.networkPatterns.values())
      .reduce((sum, patterns) => sum + patterns.length, 0);

    return {
      isInitialized: this.browser !== null,
      activeContexts: this.contexts.size,
      totalNetworkPatterns,
      uptime: process.uptime()
    };
  }

  /**
   * Create a new browser context with configuration
   */
  private async createNewContext(serviceName: string, config?: BrowserContextConfig): Promise<BrowserContext> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const contextConfig = {
      userAgent: config?.userAgent,
      viewport: config?.viewport || this.config.defaultViewport,
      locale: config?.locale || 'en-US',
      timezoneId: config?.timezone || 'America/New_York',
      geolocation: config?.geolocation,
      permissions: config?.permissions || [],
      extraHTTPHeaders: config?.extraHTTPHeaders || {},
      recordVideo: config?.recordVideo ? { dir: `./recordings/${serviceName}` } : undefined,
      recordHar: config?.recordHar ? { path: `./recordings/${serviceName}.har` } : undefined
    };

    const context = await this.browser.newContext(contextConfig);

    // Apply stealth mode if enabled
    if (this.config.enableStealth || config?.stealth) {
      await this.applyStealthMode(context);
    }

    // Store context and info
    this.contexts.set(serviceName, context);
    this.contextInfo.set(serviceName, {
      serviceName,
      isActive: true,
      createdAt: new Date(),
      lastActivity: new Date(),
      pageCount: 0,
      networkPatternCount: 0,
      sessionExists: await this.sessionManager.sessionExists(serviceName)
    });

    this.networkPatterns.set(serviceName, []);

    // Set up context event handlers
    this.setupContextEventHandlers(context, serviceName);

    return context;
  }

  /**
   * Apply stealth mode to a context
   */
  private async applyStealthMode(context: BrowserContext): Promise<void> {
    // Add stealth scripts to all pages
    await context.addInitScript(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Mock plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Mock languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Override permissions API
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' 
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters)
      );
    });
  }

  /**
   * Set up context event handlers
   */
  private setupContextEventHandlers(context: BrowserContext, serviceName: string): void {
    context.on('page', (page) => {
      const info = this.contextInfo.get(serviceName);
      if (info) {
        info.pageCount++;
        this.contextInfo.set(serviceName, info);
      }

      // Set up page-level handlers
      page.on('close', () => {
        const info = this.contextInfo.get(serviceName);
        if (info) {
          info.pageCount = Math.max(0, info.pageCount - 1);
          this.contextInfo.set(serviceName, info);
        }
      });
    });
  }

  /**
   * Get or create a page in a context
   */
  private async getOrCreatePage(context: BrowserContext): Promise<Page> {
    const pages = context.pages();
    if (pages.length > 0) {
      return pages[0];
    }

    return await context.newPage();
  }

  /**
   * Set up network monitoring for a page
   */
  private setupNetworkMonitoring(page: Page, serviceName: string, capturedPatterns: NetworkPattern[]): void {
    const patterns = this.networkPatterns.get(serviceName) || [];

    page.on('request', (request: Request) => {
      const pattern = this.analyzeRequest(request, serviceName);
      patterns.push(pattern);
      capturedPatterns.push(pattern);
    });

    page.on('response', (response: Response) => {
      this.analyzeResponse(response, serviceName, patterns);
    });

    this.networkPatterns.set(serviceName, patterns);
  }

  /**
   * Analyze a network request to detect API patterns
   */
  private analyzeRequest(request: Request, serviceName: string): NetworkPattern {
    const url = request.url();
    const method = request.method();
    const headers = request.headers();

    // Detect streaming indicators
    const isStreaming = this.isStreamingRequest(headers, url);

    return {
      url,
      method,
      headers,
      isStreaming,
      responseType: 'unknown',
      timestamp: new Date(),
      serviceName
    };
  }

  /**
   * Analyze a network response to determine type
   */
  private analyzeResponse(response: Response, serviceName: string, patterns: NetworkPattern[]): void {
    const request = response.request();
    const pattern = patterns.find(p => 
      p.url === request.url() && 
      p.method === request.method() && 
      Math.abs(p.timestamp.getTime() - Date.now()) < 5000
    );

    if (pattern) {
      pattern.responseType = this.determineResponseType(response);
      
      const info = this.contextInfo.get(serviceName);
      if (info) {
        info.networkPatternCount = patterns.length;
        this.contextInfo.set(serviceName, info);
      }
    }
  }

  /**
   * Determine if a request is for streaming content
   */
  private isStreamingRequest(headers: Record<string, string>, url: string): boolean {
    const contentType = headers['content-type'] || '';
    const accept = headers['accept'] || '';
    
    return (
      accept.includes('text/event-stream') ||
      contentType.includes('text/event-stream') ||
      url.includes('stream') ||
      headers['cache-control'] === 'no-cache'
    );
  }

  /**
   * Determine the response type
   */
  private determineResponseType(response: Response): 'json' | 'text' | 'stream' | 'unknown' {
    const contentType = response.headers()['content-type'] || '';
    
    if (contentType.includes('application/json')) {
      return 'json';
    }
    
    if (contentType.includes('text/event-stream')) {
      return 'stream';
    }
    
    if (contentType.includes('text/')) {
      return 'text';
    }
    
    return 'unknown';
  }

  /**
   * Execute a specific action on a page
   */
  private async executeAction(page: Page, action: ContextAction): Promise<unknown> {
    switch (action.type) {
      case 'navigate':
        if (!action.url) {
          throw new Error('URL is required for navigate action');
        }
        return await page.goto(action.url, {
          waitUntil: action.waitFor || 'load',
          timeout: action.timeout || 30000
        });

      case 'click':
        if (!action.selector) {
          throw new Error('Selector is required for click action');
        }
        return await page.click(action.selector, { timeout: action.timeout || 5000 });

      case 'type':
        if (!action.selector || !action.value) {
          throw new Error('Selector and value are required for type action');
        }
        return await page.fill(action.selector, action.value, { timeout: action.timeout || 5000 });

      case 'wait':
        if (action.selector) {
          return await page.waitForSelector(action.selector, { timeout: action.timeout || 5000 });
        } else if (action.timeout) {
          return await page.waitForTimeout(action.timeout);
        }
        throw new Error('Either selector or timeout is required for wait action');

      case 'evaluate':
        if (!action.script) {
          throw new Error('Script is required for evaluate action');
        }
        return await page.evaluate(action.script);

      case 'custom':
        if (!action.customHandler) {
          throw new Error('Custom handler is required for custom action');
        }
        return await action.customHandler(page);

      default:
        throw new Error(`Unknown action type: ${(action as ContextAction).type}`);
    }
  }

  /**
   * Update last activity timestamp for a context
   */
  private async updateLastActivity(serviceName: string): Promise<void> {
    const info = this.contextInfo.get(serviceName);
    if (info) {
      info.lastActivity = new Date();
      this.contextInfo.set(serviceName, info);
    }
    
    await this.sessionManager.updateLastActivity(serviceName).catch(() => {
      // Ignore errors - activity updates are best-effort
    });
  }

  /**
   * Start the cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(async () => {
      try {
        await this.cleanupIdleContexts();
      } catch (error) {
        console.error('Error during cleanup:', error);
      }
    }, this.config.cleanupInterval * 60 * 1000);
  }

  /**
   * Handle browser disconnect event
   */
  private handleBrowserDisconnect(): void {
    console.warn('Browser disconnected unexpectedly');
    this.browser = null;
    this.contexts.clear();
    this.contextInfo.clear();
    this.networkPatterns.clear();
  }

  /**
   * Ensure the browser is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.browser) {
      await this.initialize();
    }
  }
}