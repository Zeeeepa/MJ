/**
 * Natural Language Strategy
 * 
 * Integrates @olib-ai/owl-browser-sdk for natural language browser control.
 * Allows semantic element identification like "the login button" or "search field".
 */

import { BaseStrategy } from '../base/BaseStrategy';
import {
  StrategyType,
  WebElement,
  ElementAction,
  ActionResult,
  IdentificationContext,
  ElementSelector,
  ElementType,
  ElementState
} from '../types';

// OWL types (will be imported dynamically)
type OwlAgentType = {
  new (config: { apiKey: string; model?: string }): {
    find(query: string, page: unknown): Promise<{
      found: boolean;
      element?: {
        tagName: string;
        textContent?: string;
        selector: string;
        position: { x: number; y: number; width: number; height: number };
      };
      confidence: number;
    }>;
    click(query: string, page: unknown): Promise<{ success: boolean; error?: string }>;
    type(query: string, text: string, page: unknown): Promise<{ success: boolean; error?: string }>;
    extract(query: string, page: unknown): Promise<{ success: boolean; data?: string; error?: string }>;
  };
};

export class NaturalLanguageStrategy extends BaseStrategy {
  readonly name: StrategyType = 'natural-language';
  
  private owlAgent: InstanceType<OwlAgentType> | null = null;
  private OwlAgent: OwlAgentType | null = null;

  protected async onInitialize(): Promise<void> {
    try {
      // Dynamically import OWL SDK
      const owlModule = await import('@olib-ai/owl-browser-sdk');
      this.OwlAgent = owlModule.OwlAgent || owlModule.default;

      if (!this.OwlAgent) {
        throw new Error('OwlAgent class not found in module');
      }

      // Get API key (OWL uses OpenAI)
      const apiKey = this.config.apiKeys?.openai || process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        throw new Error('OpenAI API key not configured for Natural Language strategy');
      }

      // Initialize OWL agent
      this.owlAgent = new this.OwlAgent({
        apiKey,
        model: 'gpt-4o' // OWL works best with GPT-4o
      });

      this.debug('OWL Natural Language agent initialized');

    } catch (error) {
      this.debug('Failed to initialize Natural Language strategy:', error);
      throw new Error(
        `Natural Language strategy initialization failed: ${
          error instanceof Error ? error.message : String(error)
        }. Make sure @olib-ai/owl-browser-sdk is installed.`
      );
    }
  }

  async identifyElements(context: IdentificationContext): Promise<WebElement[]> {
    if (!this.owlAgent) {
      throw new Error('OWL agent not initialized');
    }

    this.debug('Identifying elements via Natural Language...', context.intent);

    try {
      // Build natural language queries for element identification
      const queries = this.buildNaturalLanguageQueries(context);
      const elements: WebElement[] = [];

      // Try each query
      for (const query of queries) {
        try {
          const result = await this.owlAgent.find(query, this.page);
          
          if (result.found && result.element) {
            const element = this.convertOwlElementToWebElement(result.element, query, result.confidence);
            elements.push(element);
            
            this.debug(`Found element for query: "${query}"`);
          }
        } catch (queryError) {
          this.debug(`Query failed: "${query}"`, queryError);
          // Continue with next query
        }
      }

      if (elements.length === 0) {
        this.debug('No elements found with natural language queries');
      }

      return elements;

    } catch (error) {
      this.debug('Natural Language identification failed:', error);
      throw error;
    }
  }

  protected async executeActionInternal(
    element: WebElement,
    action: ElementAction
  ): Promise<ActionResult> {
    if (!this.owlAgent) {
      throw new Error('OWL agent not initialized');
    }

    const startTime = Date.now();
    const stateBefore = element.state;

    try {
      // Build natural language query for this element
      const query = this.buildElementQuery(element);
      
      this.debug(`Executing ${action.type} via Natural Language: "${query}"`);

      let success = false;
      let extractedData: Record<string, unknown> | undefined;

      // Execute action based on type
      switch (action.type) {
        case 'click': {
          const result = await this.owlAgent.click(query, this.page);
          success = result.success;
          if (!success && result.error) {
            throw new Error(result.error);
          }
          break;
        }

        case 'type': {
          const text = action.params?.text || '';
          const result = await this.owlAgent.type(query, text, this.page);
          success = result.success;
          if (!success && result.error) {
            throw new Error(result.error);
          }
          
          // Press Enter if requested
          if (success && action.params?.pressEnter) {
            await this.page.keyboard.press('Enter');
          }
          break;
        }

        case 'extract': {
          const result = await this.owlAgent.extract(query, this.page);
          success = result.success;
          if (result.data) {
            extractedData = { extractedText: result.data };
          }
          if (!success && result.error) {
            throw new Error(result.error);
          }
          break;
        }

        case 'hover': {
          // OWL doesn't have native hover, fallback to selector-based
          const locator = await this.findElementLocator(element);
          if (locator) {
            await locator.hover();
            success = true;
          } else {
            throw new Error('Could not find element for hover action');
          }
          break;
        }

        default:
          throw new Error(`Action type ${action.type} not supported by Natural Language strategy`);
      }

      if (success) {
        return this.createSuccessResult(stateBefore, 'idle', startTime, extractedData);
      } else {
        return this.createErrorResult(stateBefore, 'error', startTime, 'Action execution failed');
      }

    } catch (error) {
      return this.createErrorResult(
        stateBefore,
        'error',
        startTime,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  getCapabilityScore(context: IdentificationContext): number {
    let score = 0.6; // Base score

    // Strongly prefer for natural language intents
    const naturalKeywords = ['find', 'click on', 'type into', 'search for', 'the button', 'the input'];
    if (naturalKeywords.some(keyword => context.intent.toLowerCase().includes(keyword))) {
      score += 0.3;
    }

    // Good for semantic queries
    if (context.intent.split(' ').length >= 3) {
      score += 0.1;
    }

    // Hints boost
    if (context.hints?.some(h => h.includes('natural') || h.includes('semantic'))) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  protected async onCleanup(): Promise<void> {
    this.owlAgent = null;
    this.OwlAgent = null;
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Build natural language queries from context
   */
  private buildNaturalLanguageQueries(context: IdentificationContext): string[] {
    const queries: string[] = [];

    // Main intent query
    queries.push(context.intent);

    // Generate semantic variations based on common UI patterns
    const intent = context.intent.toLowerCase();
    
    if (intent.includes('login') || intent.includes('sign in')) {
      queries.push('the login button');
      queries.push('the sign in button');
      queries.push('email input field');
      queries.push('password input field');
    }
    
    if (intent.includes('search')) {
      queries.push('the search box');
      queries.push('the search input');
      queries.push('search field');
    }
    
    if (intent.includes('submit') || intent.includes('send')) {
      queries.push('the submit button');
      queries.push('the send button');
    }

    if (intent.includes('message') || intent.includes('chat')) {
      queries.push('message input');
      queries.push('chat input box');
      queries.push('text input field');
    }

    // Add hint-based queries
    if (context.hints) {
      queries.push(...context.hints);
    }

    // Remove duplicates
    return [...new Set(queries)];
  }

  /**
   * Build natural language query for specific element
   */
  private buildElementQuery(element: WebElement): string {
    // Prefer text content
    if (element.text) {
      return `the ${element.type} with text "${element.text}"`;
    }

    // Use visual description
    if (element.visualDescription) {
      return element.visualDescription;
    }

    // Fallback to generic query
    return `the ${element.type}`;
  }

  /**
   * Convert OWL element to WebElement format
   */
  private convertOwlElementToWebElement(
    owlElement: {
      tagName: string;
      textContent?: string;
      selector: string;
      position: { x: number; y: number; width: number; height: number };
    },
    query: string,
    confidence: number
  ): WebElement {
    const type = this.mapTagNameToElementType(owlElement.tagName);

    return {
      id: `owl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      text: owlElement.textContent,
      visualDescription: query,
      selectors: [
        {
          type: 'owl-natural-language',
          value: query,
          priority: 1,
          validated: true
        },
        {
          type: 'css',
          value: owlElement.selector,
          priority: 2,
          validated: false
        }
      ],
      bounds: {
        x: owlElement.position.x,
        y: owlElement.position.y,
        width: owlElement.position.width,
        height: owlElement.position.height
      },
      state: 'idle',
      confidence,
      identifiedBy: this.name
    };
  }

  /**
   * Map HTML tag name to ElementType
   */
  private mapTagNameToElementType(tagName: string): ElementType {
    const tag = tagName.toLowerCase();
    
    const typeMap: Record<string, ElementType> = {
      'button': 'button',
      'input': 'input',
      'textarea': 'textarea',
      'a': 'link',
      'select': 'dropdown'
    };

    return typeMap[tag] || 'container';
  }

  /**
   * Find Playwright locator for element using selectors
   */
  private async findElementLocator(element: WebElement) {
    for (const selector of element.selectors.sort((a, b) => a.priority - b.priority)) {
      if (selector.type === 'owl-natural-language' || selector.type === 'coordinates') {
        continue; // Skip non-standard selectors
      }

      const locator = this.getLocator(selector.type, selector.value);
      if (!locator) {
        continue;
      }

      try {
        const isVisible = await locator.isVisible();
        if (isVisible) {
          return locator;
        }
      } catch {
        // Continue to next selector
      }
    }

    return null;
  }
}
