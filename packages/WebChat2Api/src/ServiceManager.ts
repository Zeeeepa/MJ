import { BrowserAutomation } from './BrowserAutomation';
import { ServiceConfig, SessionState } from './types';

export class ServiceManager {
  private services: Map<string, BrowserAutomation> = new Map();
  private sessions: Map<string, SessionState> = new Map();
  private configs: Map<string, ServiceConfig> = new Map();

  async registerService(config: ServiceConfig): Promise<string> {
    const serviceId = this.generateServiceId(config.url);
    this.configs.set(serviceId, config);
    
    console.log(`[SERVICE] Registered: ${config.name} (${serviceId})`);
    return serviceId;
  }

  async initializeService(serviceId: string): Promise<boolean> {
    const config = this.configs.get(serviceId);
    if (!config) throw new Error(`Service not found: ${serviceId}`);

    console.log(`[SERVICE] Initializing ${config.name}...`);

    const browser = new BrowserAutomation();
    await browser.initialize();

    // Login
    const success = await browser.login(config.url, config.email, config.password);
    
    if (success) {
      this.services.set(serviceId, browser);
      this.sessions.set(serviceId, {
        serviceId,
        isAuthenticated: true,
        lastActivity: new Date()
      });
      console.log(`[SERVICE] ${config.name} initialized successfully`);
      return true;
    }

    await browser.close();
    console.log(`[SERVICE] ${config.name} initialization failed`);
    return false;
  }

  async sendMessage(serviceId: string, message: string): Promise<string> {
    const browser = this.services.get(serviceId);
    if (!browser) {
      // Try to initialize
      const initialized = await this.initializeService(serviceId);
      if (!initialized) throw new Error('Service not available');
      return this.sendMessage(serviceId, message);
    }

    const response = await browser.sendMessage(message);
    
    // Update session
    const session = this.sessions.get(serviceId);
    if (session) {
      session.lastActivity = new Date();
    }

    return response;
  }

  async closeService(serviceId: string): Promise<void> {
    const browser = this.services.get(serviceId);
    if (browser) {
      await browser.close();
      this.services.delete(serviceId);
      this.sessions.delete(serviceId);
      console.log(`[SERVICE] Closed: ${serviceId}`);
    }
  }

  async closeAll(): Promise<void> {
    for (const serviceId of this.services.keys()) {
      await this.closeService(serviceId);
    }
  }

  getServiceIds(): string[] {
    return Array.from(this.configs.keys());
  }

  private generateServiceId(url: string): string {
    const hostname = new URL(url).hostname.replace(/\./g, '-');
    return `service-${hostname}`;
  }
}

