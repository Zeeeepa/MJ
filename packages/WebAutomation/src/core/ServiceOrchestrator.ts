import { BrowserController } from './BrowserController';
import { VisionAnalyzer } from './VisionAnalyzer';
import { FlowExecutor } from './FlowExecutor';
import { StorageManager } from './StorageManager';
import { Account, Service, Flow, ProgressEvent } from '../types';

export class ServiceOrchestrator {
  private browser!: BrowserController;
  private vision!: VisionAnalyzer;
  private executor!: FlowExecutor;
  private storage: StorageManager;
  private eventCallback?: (event: ProgressEvent) => void;
  
  constructor(
    private account: Account,
    storage: StorageManager,
    eventCallback?: (event: ProgressEvent) => void
  ) {
    this.storage = storage;
    this.eventCallback = eventCallback;
  }
  
  /**
   * Initialize and discover service flows
   */
  async initialize(): Promise<Service> {
    this.emitEvent({ event: 'service_init_started', data: { url: this.account.url } });
    
    try {
      // Initialize components
      this.browser = new BrowserController({ headless: true });
      this.vision = new VisionAnalyzer();
      await this.browser.initialize();
      this.executor = new FlowExecutor(this.browser, this.vision);
      
      // Navigate to service
      this.emitEvent({ event: 'navigation_started', data: { url: this.account.url } });
      await this.browser.navigateTo(this.account.url);
      
      // Take screenshot
      const screenshot = await this.browser.screenshot();
      const base64 = screenshot.toString('base64');
      
      // Analyze login page
      this.emitEvent({ event: 'vision_analysis_started', data: { type: 'login_page' } });
      const loginAnalysis = await this.vision.analyzeLoginPage(base64);
      this.emitEvent({ event: 'vision_analysis_complete', data: loginAnalysis });
      
      // Perform login
      await this.performLogin(loginAnalysis);
      
      // Wait for login to complete
      await this.sleep(3000);
      
      // Verify login success
      const postLoginScreenshot = await this.browser.screenshot();
      const postLoginBase64 = postLoginScreenshot.toString('base64');
      const loginSuccess = await this.vision.verifyLoginSuccess(postLoginBase64);
      
      if (!loginSuccess) {
        throw new Error('Login verification failed');
      }
      
      this.emitEvent({ event: 'login_complete', data: { success: true } });
      
      // Save cookies
      const cookies = await this.browser.getCookies();
      const serviceId = this.getServiceId();
      await this.storage.saveCookies(serviceId, cookies);
      
      // Discover flows
      this.emitEvent({ event: 'flow_discovery_started', data: {} });
      const flows = await this.discoverFlows();
      this.emitEvent({ event: 'flow_discovery_complete', data: { count: flows.length } });
      
      // Create service object
      const service: Service = {
        id: serviceId,
        name: this.account.name,
        url: this.account.url,
        status: 'ready',
        flows,
        lastSync: new Date(),
      };
      
      // Save service
      await this.storage.saveService(service);
      
      this.emitEvent({ event: 'service_init_complete', data: { serviceId } });
      
      return service;
    } catch (error: any) {
      this.emitEvent({ event: 'error', data: { error: error.message } });
      throw error;
    }
  }
  
  /**
   * Perform login using vision-detected elements
   */
  private async performLogin(loginAnalysis: any): Promise<void> {
    this.emitEvent({ event: 'login_started', data: {} });
    
    const { loginForm } = loginAnalysis;
    
    if (!loginForm) {
      throw new Error('Login form not detected');
    }
    
    // Fill email/username
    if (loginForm.emailField) {
      await this.browser.clickCoordinates(loginForm.emailField.x, loginForm.emailField.y);
      await this.browser.type(loginForm.emailField.selector || 'input[type="email"]', this.account.email);
    }
    
    // Fill password
    if (loginForm.passwordField) {
      await this.browser.clickCoordinates(loginForm.passwordField.x, loginForm.passwordField.y);
      await this.browser.type(loginForm.passwordField.selector || 'input[type="password"]', this.account.password);
    }
    
    // Click submit button
    if (loginForm.submitButton) {
      await this.browser.clickCoordinates(loginForm.submitButton.x, loginForm.submitButton.y);
    }
  }
  
  /**
   * Discover available flows in the service
   */
  private async discoverFlows(): Promise<Flow[]> {
    const screenshot = await this.browser.screenshot();
    const base64 = screenshot.toString('base64');
    
    const discoveredFlows = await this.vision.discoverFlows(base64);
    const flows: Flow[] = [];
    const serviceId = this.getServiceId();
    
    for (const discovered of discoveredFlows) {
      const flow: Flow = {
        serviceId,
        name: discovered.name,
        description: discovered.description,
        type: discovered.type as any,
        steps: discovered.actions.map(action => ({
          type: action.type as any,
          description: action.description,
          selector: action.selector,
          coordinates: action.coordinates,
          value: action.value,
        })),
      };
      
      flows.push(flow);
      await this.storage.saveFlow(flow);
      this.emitEvent({ event: 'flow_discovered', data: { name: flow.name } });
    }
    
    return flows;
  }
  
  /**
   * Execute a chat message using discovered flow
   */
  async sendMessage(message: string): Promise<string> {
    try {
      // Load the "send_message" flow
      const serviceId = this.getServiceId();
      const flow = await this.storage.loadFlow(serviceId, 'send_message');
      
      if (!flow) {
        throw new Error('send_message flow not found');
      }
      
      // Load and set cookies
      const cookies = await this.storage.loadCookies(serviceId);
      if (cookies) {
        await this.browser.setCookies(cookies);
      }
      
      // Navigate to service (if not already there)
      await this.browser.navigateTo(this.account.url);
      
      // Execute flow with message parameter
      const response = await this.executor.executeFlow(flow, { message });
      
      return response;
    } catch (error: any) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }
  
  /**
   * Get browser instance
   */
  getBrowser(): BrowserController {
    return this.browser;
  }
  
  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }
  
  /**
   * Generate service ID from account name
   */
  private getServiceId(): string {
    return this.account.name.toLowerCase().replace(/\s+/g, '-');
  }
  
  /**
   * Emit progress event
   */
  private emitEvent(event: Partial<ProgressEvent>): void {
    if (this.eventCallback) {
      const fullEvent: ProgressEvent = {
        event: event.event || 'unknown',
        timestamp: new Date(),
        data: event.data || {},
      };
      this.eventCallback(fullEvent);
    }
  }
  
  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

