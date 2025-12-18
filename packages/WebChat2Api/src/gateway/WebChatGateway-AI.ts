/**
 * AI-Native WebChat Gateway using @centralinc/browseragent
 * 
 * REVOLUTIONARY APPROACH:
 * - Uses Anthropic Computer Use API for autonomous browser control
 * - AI handles login, navigation, and interaction without manual scripting
 * - Self-healing - adapts to UI changes automatically
 * - Natural language task specification
 * 
 * OLD WAY (50+ lines):
 *   await page.goto(url);
 *   await page.fill('[name="email"]', email);
 *   await page.click('button[type="submit"]');
 *   // ... 47 more lines
 * 
 * NEW WAY (1 line):
 *   await agent.task('Login and send message');
 */

import { ComputerUseAgent } from '@centralinc/browseragent';
import { crawl } from '@just-every/crawl';
import Anthropic from '@anthropic-ai/sdk';
import { Page } from 'playwright';
import * as crypto from 'crypto';

export interface WebChatConfig {
  url: string;
  email: string;
  password: string;
  anthropicApiKey?: string;
  sessionTimeout?: number;
  useMarkdownExtraction?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface OpenAIResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: 'stop' | 'length';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * AI-Native WebChat Gateway
 * 
 * Uses Anthropic's Computer Use to autonomously interact with web chat UIs
 */
export class WebChatGatewayAI {
  private agent: ComputerUseAgent;
  private config: WebChatConfig;
  private sessionCache: Map<string, any> = new Map();

  constructor(config: WebChatConfig) {
    this.config = {
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      useMarkdownExtraction: true,
      ...config
    };

    // Initialize Anthropic Computer Use agent
    this.agent = new ComputerUseAgent({
      apiKey: config.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
      model: 'claude-3-5-sonnet-20241022', // Computer Use model
      options: {
        maxTokens: 4096,
        temperature: 0.7
      }
    });
  }

  /**
   * Convert web chat interaction to OpenAI API format
   * 
   * This is where the magic happens - AI autonomously:
   * 1. Navigates to the web chat
   * 2. Logs in with credentials
   * 3. Finds and sends the message
   * 4. Waits for and extracts the response
   * 5. Formats it as OpenAI-compatible JSON
   */
  async chat(messages: ChatMessage[]): Promise<OpenAIResponse> {
    const startTime = Date.now();
    const lastMessage = messages[messages.length - 1];
    
    if (lastMessage.role !== 'user') {
      throw new Error('Last message must be from user');
    }

    try {
      // AI-driven task execution using Computer Use
      const task = this.buildAITask(lastMessage.content);
      
      console.log('🤖 AI Agent executing task:', task);
      
      // Let AI handle the entire flow autonomously
      const result = await this.agent.execute(task, {
        schema: {
          type: 'object',
          properties: {
            response: { type: 'string', description: 'The AI chat response' },
            pageUrl: { type: 'string', description: 'Current page URL' },
            screenshot: { type: 'string', description: 'Base64 screenshot' }
          },
          required: ['response']
        }
      });

      console.log('✅ AI Agent completed task');

      // Extract response
      let responseText = result.response;

      // Optional: Use crawl for clean Markdown extraction
      if (this.config.useMarkdownExtraction && result.pageUrl) {
        try {
          const markdown = await crawl(result.pageUrl);
          // Try to extract just the AI response from the full page
          responseText = this.extractResponse(markdown, responseText);
        } catch (error) {
          console.warn('⚠️ Markdown extraction failed, using AI-extracted text:', error);
        }
      }

      // Format as OpenAI response
      return this.formatOpenAIResponse(responseText, startTime);

    } catch (error) {
      console.error('❌ AI Agent error:', error);
      throw new Error(`WebChat interaction failed: ${error.message}`);
    }
  }

  /**
   * Build AI task instruction in natural language
   * 
   * This is the power of Computer Use - we describe WHAT to do, not HOW
   */
  private buildAITask(userMessage: string): string {
    return `
You are controlling a web browser to interact with a chat interface.

**Your Task:**
1. Navigate to ${this.config.url}
2. If you see a login page:
   - Find the email/username field and enter: ${this.config.email}
   - Find the password field and enter: ${this.config.password}
   - Click the login/sign in button
   - Wait for successful login (look for chat interface or user profile)

3. Find the chat input field (might be labeled "Message", "Type here", "Chat", etc.)
4. Type the following message: "${userMessage}"
5. Click the send button (might be labeled "Send", "Submit", or a paper plane icon)
6. Wait for the AI response to appear (usually a few seconds)
7. Extract the AI's response text
8. Return the response as JSON with the "response" field

**Important:**
- Be patient - wait for elements to load
- If login fails, describe what you see
- Extract only the AI's response, not the entire chat history
- If you encounter errors, describe them clearly
    `.trim();
  }

  /**
   * Extract just the AI response from full page Markdown
   */
  private extractResponse(fullMarkdown: string, aiExtractedText: string): string {
    // If AI already extracted good text, prefer that
    if (aiExtractedText && aiExtractedText.length > 10 && !aiExtractedText.includes('Error')) {
      return aiExtractedText;
    }

    // Otherwise, try to extract from Markdown
    // This is a simple heuristic - can be improved based on specific chat UI
    const lines = fullMarkdown.split('\n');
    const responseLines: string[] = [];
    let inResponse = false;

    for (const line of lines) {
      // Look for common chat response indicators
      if (line.match(/^(AI:|Assistant:|Bot:|Response:)/i)) {
        inResponse = true;
        continue;
      }
      
      if (inResponse && line.trim()) {
        responseLines.push(line);
      }
      
      // Stop at next user message
      if (inResponse && line.match(/^(User:|You:)/i)) {
        break;
      }
    }

    return responseLines.length > 0 
      ? responseLines.join('\n') 
      : aiExtractedText || 'Response extraction failed';
  }

  /**
   * Format response as OpenAI-compatible JSON
   */
  private formatOpenAIResponse(content: string, startTime: number): OpenAIResponse {
    const completionTime = Date.now();
    const duration = completionTime - startTime;

    // Estimate tokens (rough approximation)
    const promptTokens = Math.ceil(this.config.url.length / 4) + 100;
    const completionTokens = Math.ceil(content.length / 4);

    return {
      id: `chatcmpl-${crypto.randomBytes(16).toString('hex')}`,
      object: 'chat.completion',
      created: Math.floor(startTime / 1000),
      model: `webchat:${this.extractDomain(this.config.url)}`,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: content
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens
      }
    };
  }

  /**
   * Extract domain from URL for model name
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }

  /**
   * Streaming support (for future implementation)
   */
  async *chatStream(messages: ChatMessage[]): AsyncGenerator<string> {
    // For now, just yield the complete response
    // TODO: Implement true streaming with Computer Use
    const response = await this.chat(messages);
    yield `data: ${JSON.stringify({
      id: response.id,
      object: 'chat.completion.chunk',
      created: response.created,
      model: response.model,
      choices: [{
        index: 0,
        delta: { content: response.choices[0].message.content },
        finish_reason: null
      }]
    })}\n\n`;

    yield `data: ${JSON.stringify({
      id: response.id,
      object: 'chat.completion.chunk',
      created: response.created,
      model: response.model,
      choices: [{
        index: 0,
        delta: {},
        finish_reason: 'stop'
      }]
    })}\n\n`;

    yield 'data: [DONE]\n\n';
  }

  /**
   * Health check - verify the web chat is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      const task = `
Navigate to ${this.config.url} and verify it loads successfully.
Return "success" if the page loads, "error" otherwise.
      `.trim();

      const result = await this.agent.execute(task, {
        schema: {
          type: 'object',
          properties: {
            status: { type: 'string' }
          }
        },
        options: {
          maxTokens: 1024
        }
      });

      return result.status === 'success';
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  /**
   * Close browser and cleanup
   */
  async cleanup(): Promise<void> {
    await this.agent.cleanupManagedPages();
    this.sessionCache.clear();
  }
}

/**
 * Factory function to create gateway instance
 */
export function createAIGateway(config: WebChatConfig): WebChatGatewayAI {
  return new WebChatGatewayAI(config);
}

/**
 * Example usage:
 * 
 * const gateway = createAIGateway({
 *   url: 'https://pixelium.uk',
 *   email: 'developer@pixelium.uk',
 *   password: 'developer123?',
 *   anthropicApiKey: process.env.ANTHROPIC_API_KEY
 * });
 * 
 * const response = await gateway.chat([
 *   { role: 'user', content: 'What is my account status?' }
 * ]);
 * 
 * console.log(response.choices[0].message.content);
 */

