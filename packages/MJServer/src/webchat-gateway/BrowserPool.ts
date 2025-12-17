/**
 * Browser Pool Manager
 * 
 * Manages a pool of headless browser instances for web automation
 */

import { chromium, Browser, BrowserContext as PlaywrightBrowserContext, Page } from 'playwright';
import { BrowserContext, ServiceConfig } from './types.js';
import { LogError } from '@memberjunction/core';

export class BrowserPool {
  private browsers: Map<string, BrowserContext> = new Map();
  private availableBrowsers: string[] = [];
  private poolSize: number;
  private browserLaunchOptions: any;
  
  constructor(poolSize: number = 5, options: any = {}) {
    this.poolSize = poolSize;
    this.browserLaunchOptions = {
      headless: options.headless !== false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ],
      ...options
    };
  }
  
  /**
   * Initialize browser pool
   */
  async initialize(): Promise<void> {
    console.log(`Initializing browser pool with ${this.poolSize} instances...`);
    
    for (let i = 0; i < this.poolSize; i++) {
      try {
        const browserId = `browser-${i}-${Date.now()}`;
        const browser = await chromium.launch(this.browserLaunchOptions);
        const context = await browser.newContext({
          viewport: { width: 1920, height: 1080 },
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();
        
        const browserContext: BrowserContext = {
          browserId,
          page,
          context,
          createdAt: new Date(),
          lastUsedAt: new Date(),
          isActive: false
        };
        
        this.browsers.set(browserId, browserContext);
        this.availableBrowsers.push(browserId);
        
        console.log(`Browser ${browserId} initialized`);
      } catch (error) {
        LogError(`Failed to initialize browser ${i}:`, error);
      }
    }
    
    console.log(`Browser pool initialized with ${this.browsers.size} instances`);
  }
  
  /**
   * Acquire a browser from the pool
   */
  async acquire(): Promise<BrowserContext> {
    // Wait for available browser with timeout
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (this.availableBrowsers.length > 0) {
        const browserId = this.availableBrowsers.shift()!;
        const browser = this.browsers.get(browserId);
        
        if (browser) {
          browser.isActive = true;
          browser.lastUsedAt = new Date();
          return browser;
        }
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error('Browser pool exhausted - no available browsers');
  }
  
  /**
   * Release browser back to pool
   */
  async release(browser: BrowserContext): Promise<void> {
    browser.isActive = false;
    browser.lastUsedAt = new Date();
    
    // Clear cookies and storage
    try {
      await browser.context.clearCookies();
      await browser.page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
    } catch (error) {
      LogError('Error clearing browser state:', error);
    }
    
    // Return to pool
    if (!this.availableBrowsers.includes(browser.browserId)) {
      this.availableBrowsers.push(browser.browserId);
    }
  }
  
  /**
   * Get browser for specific session (reuse if possible)
   */
  async getOrCreateSession(sessionId: string): Promise<BrowserContext> {
    // Check if we have a browser already assigned to this session
    for (const [browserId, browser] of this.browsers.entries()) {
      if (browserId.includes(sessionId) && !browser.isActive) {
        browser.isActive = true;
        browser.lastUsedAt = new Date();
        return browser;
      }
    }
    
    // Acquire new browser
    return this.acquire();
  }
  
  /**
   * Get pool statistics
   */
  getStats() {
    const active = Array.from(this.browsers.values()).filter(b => b.isActive).length;
    const available = this.availableBrowsers.length;
    
    return {
      total: this.browsers.size,
      active,
      available,
      utilization: active / this.browsers.size
    };
  }
  
  /**
   * Cleanup and close all browsers
   */
  async cleanup(): Promise<void> {
    console.log('Cleaning up browser pool...');
    
    for (const [browserId, browser] of this.browsers.entries()) {
      try {
        await browser.context.close();
        console.log(`Browser ${browserId} closed`);
      } catch (error) {
        LogError(`Error closing browser ${browserId}:`, error);
      }
    }
    
    this.browsers.clear();
    this.availableBrowsers = [];
    console.log('Browser pool cleaned up');
  }
  
  /**
   * Health check - restart unhealthy browsers
   */
  async healthCheck(): Promise<void> {
    for (const [browserId, browser] of this.browsers.entries()) {
      if (!browser.isActive) {
        try {
          // Test if page is responsive
          await browser.page.evaluate(() => true);
        } catch (error) {
          // Browser is unhealthy, restart it
          console.log(`Browser ${browserId} unhealthy, restarting...`);
          
          try {
            await browser.context.close();
          } catch (e) {
            // Ignore close errors
          }
          
          // Create new browser
          const newBrowser = await chromium.launch(this.browserLaunchOptions);
          const context = await newBrowser.newContext({
            viewport: { width: 1920, height: 1080 }
          });
          const page = await context.newPage();
          
          browser.page = page;
          browser.context = context;
          browser.createdAt = new Date();
          
          console.log(`Browser ${browserId} restarted`);
        }
      }
    }
  }
}

