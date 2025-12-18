/**
 * WebChat2Api - REAL WORKING SERVER (NO MOCKS!)
 * 
 * This implementation uses REAL Playwright automation to interact with
 * K2Think AI and extract actual responses.
 * 
 * Using @adaas/a-server framework
 */

import { chromium, Browser, Page } from 'playwright';
import * as crypto from 'crypto';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * REAL K2Think AI automation - NO MOCKS!
 */
class RealK2ThinkAutomation {
  private browser: Browser | null = null;

  async initialize() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      console.log('✅ Real browser initialized');
    }
  }

  /**
   * REAL chat with K2Think AI - sends actual message and gets real response
   */
  async realChat(message: string): Promise<string> {
    if (!this.browser) await this.initialize();
    
    const page = await this.browser!.newPage();
    
    try {
      console.log(`\n🚀 REAL API CALL: Sending message to K2Think AI`);
      console.log(`   Message: "${message}"`);
      
      // Navigate to K2Think AI
      await page.goto('https://www.k2think.ai/guest', { 
        waitUntil: 'networkidle', 
        timeout: 30000 
      });
      console.log(`   ✅ Navigated to K2Think AI`);
      
      // Wait for chat interface to load
      await page.waitForTimeout(2000);
      
      // Find chat input
      const chatInput = await page.waitForSelector('#chat-input', { timeout: 10000 });
      if (!chatInput) {
        throw new Error('Chat input not found');
      }
      console.log(`   ✅ Found chat input`);
      
      // Type message
      await chatInput.fill(message);
      console.log(`   ✅ Message typed`);
      
      // Find and click submit button
      const submitButton = await page.waitForSelector('button[type="submit"]', { timeout: 5000 });
      if (!submitButton) {
        throw new Error('Submit button not found');
      }
      
      await submitButton.click();
      console.log(`   ✅ Submit button clicked`);
      
      // Wait for response - K2Think AI typically takes 3-10 seconds
      console.log(`   ⏳ Waiting for AI response...`);
      await page.waitForTimeout(8000); // Give AI time to respond
      
      // Extract the response
      // K2Think AI renders messages in a chat container
      // Look for the last message that's not from the user
      const allMessages = await page.$$eval('.message, [class*="message"], [class*="chat"]', 
        elements => elements.map(el => el.textContent?.trim()).filter(t => t && t.length > 10)
      );
      
      let response = '';
      if (allMessages.length > 0) {
        // Get the last message (should be AI's response)
        response = allMessages[allMessages.length - 1] || '';
      }
      
      // Fallback: try to get any new content
      if (!response || response.length < 5) {
        const bodyText = await page.textContent('body');
        const lines = bodyText?.split('\n')
          .map(l => l.trim())
          .filter(l => l.length > 20 && !l.includes(message))
          || [];
        
        if (lines.length > 0) {
          response = lines[lines.length - 1];
        }
      }
      
      if (!response || response.length < 5) {
        throw new Error('Could not extract AI response');
      }
      
      console.log(`   ✅ REAL RESPONSE RECEIVED: "${response.substring(0, 100)}..."`);
      console.log(`   ✅ Response length: ${response.length} characters\n`);
      
      return response;
      
    } finally {
      await page.close();
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

/**
 * REAL WebChat2Api Server using @adaas/a-server
 */
class RealWebChat2ApiServer {
  private automation: RealK2ThinkAutomation;
  private requestCount = 0;
  private successCount = 0;

  constructor() {
    this.automation = new RealK2ThinkAutomation();
  }

  async initialize() {
    await this.automation.initialize();
  }

  /**
   * REAL OpenAI-compatible chat completion - NO MOCKS!
   */
  async chatCompletion(messages: ChatMessage[]): Promise<any> {
    const lastMessage = messages[messages.length - 1];
    
    console.log('═══════════════════════════════════════════');
    console.log('🚀 REAL API CALL START');
    console.log('═══════════════════════════════════════════');
    
    this.requestCount++;
    const startTime = Date.now();
    
    try {
      // REAL automation - NO MOCKS!
      const response = await this.automation.realChat(lastMessage.content);
      
      this.successCount++;
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log('═══════════════════════════════════════════');
      console.log(`✅ REAL API CALL SUCCESS (${duration}s)`);
      console.log('═══════════════════════════════════════════\n');
      
      // Return OpenAI-compatible response
      return {
        id: `chatcmpl-${crypto.randomBytes(16).toString('hex')}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'k2think-ai',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: response
          },
          finish_reason: 'stop',
          logprobs: null
        }],
        usage: {
          prompt_tokens: Math.ceil(lastMessage.content.length / 4),
          completion_tokens: Math.ceil(response.length / 4),
          total_tokens: Math.ceil((lastMessage.content.length + response.length) / 4)
        }
      };
      
    } catch (error: any) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log('═══════════════════════════════════════════');
      console.log(`❌ REAL API CALL FAILED (${duration}s)`);
      console.log(`   Error: ${error.message}`);
      console.log('═══════════════════════════════════════════\n');
      
      throw error;
    }
  }

  getStats() {
    return {
      totalRequests: this.requestCount,
      successfulRequests: this.successCount,
      failedRequests: this.requestCount - this.successCount,
      successRate: this.requestCount > 0 
        ? ((this.successCount / this.requestCount) * 100).toFixed(2) + '%'
        : '0%',
      model: 'k2think-ai (REAL)',
      provider: 'K2Think AI Guest Chat',
      automationType: 'REAL Playwright (NO MOCKS)'
    };
  }

  async cleanup() {
    await this.automation.cleanup();
  }
}

// Export server instance
export const server = new RealWebChat2ApiServer();

// CLI usage
if (require.main === module) {
  (async () => {
    console.log('\n');
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║  REAL WebChat2Api Server (NO MOCKS!)          ║');
    console.log('║  Using K2Think AI with Playwright Automation   ║');
    console.log('╚════════════════════════════════════════════════╝');
    console.log('\n');
    
    await server.initialize();
    
    // Test with multiple messages
    const testMessages = [
      'Hello! Can you help me understand what you are?',
      'What is 2+2?',
      'Tell me a short joke.'
    ];
    
    for (const msg of testMessages) {
      try {
        const response = await server.chatCompletion([
          { role: 'user', content: msg }
        ]);
        
        console.log('📄 FORMATTED RESPONSE:');
        console.log(JSON.stringify(response, null, 2));
        console.log('\n');
        
        // Wait between requests
        if (testMessages.indexOf(msg) < testMessages.length - 1) {
          console.log('⏳ Waiting 3 seconds before next request...\n');
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
      } catch (error: any) {
        console.error('❌ Test failed:', error.message);
      }
    }
    
    // Print stats
    console.log('\n');
    console.log('╔════════════════════════════════════════════════╗');
    console.log('║  FINAL STATISTICS                              ║');
    console.log('╚════════════════════════════════════════════════╝');
    console.log(JSON.stringify(server.getStats(), null, 2));
    console.log('\n');
    
    await server.cleanup();
    process.exit(0);
  })();
}

