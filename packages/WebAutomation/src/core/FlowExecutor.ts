import { BrowserController } from './BrowserController';
import { VisionAnalyzer } from './VisionAnalyzer';
import { Flow, FlowStep } from '../types';

export class FlowExecutor {
  constructor(
    private browser: BrowserController,
    private vision: VisionAnalyzer
  ) {}
  
  /**
   * Execute a flow with given parameters
   */
  async executeFlow(flow: Flow, params: { [key: string]: any }): Promise<string> {
    console.log(`Executing flow: ${flow.name} with params:`, params);
    
    try {
      let result = '';
      
      for (const step of flow.steps) {
        await this.executeStep(step, params);
        
        // If this is an extract step, capture the result
        if (step.type === 'extract' && step.selector) {
          result = await this.browser.extractText(step.selector);
        }
      }
      
      // If no explicit extract step, try to get the last message
      if (!result && flow.type === 'message') {
        result = await this.extractLastMessage();
      }
      
      return result;
    } catch (error) {
      console.error(`Flow execution failed:`, error);
      throw error;
    }
  }
  
  /**
   * Execute a single flow step
   */
  private async executeStep(step: FlowStep, params: { [key: string]: any }): Promise<void> {
    console.log(`Executing step: ${step.type}`, step.description || '');
    
    switch (step.type) {
      case 'click':
        if (step.selector) {
          await this.browser.click(step.selector);
        } else if (step.coordinates) {
          await this.browser.clickCoordinates(step.coordinates.x, step.coordinates.y);
        }
        break;
        
      case 'type':
        if (step.selector && step.value !== undefined) {
          // Replace parameter placeholders
          const value = this.replaceParams(step.value, params);
          await this.browser.type(step.selector, value);
        }
        break;
        
      case 'wait':
        if (step.selector) {
          await this.browser.waitForSelector(step.selector, step.timeout);
        } else if (step.timeout) {
          await this.sleep(step.timeout);
        }
        break;
        
      case 'extract':
        // Extraction is handled in executeFlow
        break;
        
      case 'screenshot':
        await this.browser.screenshot();
        break;
    }
    
    // Small delay between steps for stability
    await this.sleep(500);
  }
  
  /**
   * Extract the last message from the chat interface
   */
  private async extractLastMessage(): Promise<string> {
    // Common selectors for chat messages (try multiple)
    const selectors = [
      '.message:last-child .content',
      '.chat-message:last-child',
      '[data-message]:last-child',
      '.response:last-child',
      '.ai-message:last-child',
    ];
    
    for (const selector of selectors) {
      try {
        const text = await this.browser.extractText(selector);
        if (text && text.trim()) {
          return text.trim();
        }
      } catch (e) {
        // Try next selector
        continue;
      }
    }
    
    // Fallback: Use vision AI to extract text
    return await this.extractMessageWithVision();
  }
  
  /**
   * Use vision AI to extract the response message
   */
  private async extractMessageWithVision(): Promise<string> {
    const screenshot = await this.browser.screenshot();
    const base64 = screenshot.toString('base64');
    
    // Call vision AI with extraction prompt
    const prompt = `Extract the last AI assistant response from this chat interface screenshot. Return only the message text, nothing else.`;
    
    try {
      const response = await this.vision['callVisionAPI'](base64, prompt);
      return response.trim();
    } catch (error) {
      console.error('Vision extraction failed:', error);
      throw new Error('Could not extract response message');
    }
  }
  
  /**
   * Replace parameter placeholders in string
   */
  private replaceParams(template: string, params: { [key: string]: any }): string {
    let result = template;
    for (const [key, value] of Object.entries(params)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }
    return result;
  }
  
  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Wait for AI response to complete
   * Checks if send button is re-enabled (indicates response complete)
   */
  async waitForResponseCompletion(sendButtonSelector: string, timeout: number = 60000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        // Take screenshot and analyze
        const screenshot = await this.browser.screenshot();
        const base64 = screenshot.toString('base64');
        
        const isComplete = await this.vision.detectResponseCompletion(base64);
        
        if (isComplete) {
          console.log('Response completion detected via vision AI');
          return;
        }
        
        // Wait before next check
        await this.sleep(2000);
      } catch (error) {
        console.warn('Response completion check failed:', error);
      }
    }
    
    throw new Error('Timeout waiting for response completion');
  }
}

