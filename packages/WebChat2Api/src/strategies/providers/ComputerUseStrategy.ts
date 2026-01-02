/**
 * Computer Use Strategy
 * 
 * Integrates @centralinc/browseragent for Claude Computer Use API.
 * Allows Claude to control the browser through natural language instructions.
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

// Import browseragent types
type BrowserAgentType = {
  new (config: {
    apiKey: string;
    model?: string;
    maxSteps?: number;
    enableVision?: boolean;
  }): {
    execute(instruction: string, page: unknown): Promise<{
      success: boolean;
      result: string;
      steps: Array<{
        action: string;
        screenshot?: Buffer;
        reasoning: string;
      }>;
      error?: string;
    }>;
    identifyElements(instruction: string, page: unknown): Promise<{
      elements: Array<{
        type: string;
        description: string;
        selector: string;
        bounds?: { x: number; y: number; width: number; height: number };
        confidence: number;
      }>;
    }>;
  };
};

export class ComputerUseStrategy extends BaseStrategy {
  readonly name: StrategyType = 'computer-use';
  
  private agent: InstanceType<BrowserAgentType> | null = null;
  private BrowserAgent: BrowserAgentType | null = null;

  protected async onInitialize(): Promise<void> {
    // Dynamically import browseragent
    try {
      const browserAgentModule = await import('@centralinc/browseragent');
      this.BrowserAgent = browserAgentModule.BrowserAgent || browserAgentModule.default;
      
      if (!this.BrowserAgent) {
        throw new Error('BrowserAgent class not found in module');
      }

      // Get Anthropic API key
      const apiKey = this.config.apiKeys?.anthropic || process.env.ANTHROPIC_API_KEY;
      
      if (!apiKey) {
        throw new Error('Anthropic API key not configured for Computer Use strategy');
      }

      // Initialize agent
      this.agent = new this.BrowserAgent({
        apiKey,
        model: 'claude-3-5-sonnet-20241022',
        maxSteps: 10,
        enableVision: true
      });

      this.debug('Computer Use agent initialized with Claude 3.5 Sonnet');

    } catch (error) {
      this.debug('Failed to initialize Computer Use strategy:', error);
      throw new Error(
        `Computer Use strategy initialization failed: ${
          error instanceof Error ? error.message : String(error)
        }. Make sure @centralinc/browseragent is installed.`
      );
    }
  }

  async identifyElements(context: IdentificationContext): Promise<WebElement[]> {
    if (!this.agent) {
      throw new Error('Computer Use agent not initialized');
    }

    this.debug('Identifying elements via Computer Use API...', context.intent);

    try {
      // Build instruction for Claude
      const instruction = this.buildIdentificationInstruction(context);

      // Call agent to identify elements
      const result = await this.agent.identifyElements(instruction, this.page);

      // Convert to WebElement format
      const elements: WebElement[] = result.elements.map((elem, index) => {
        const type = this.mapElementType(elem.type);
        
        return {
          id: `computer-use-${Date.now()}-${index}`,
          type,
          text: elem.description,
          visualDescription: elem.description,
          selectors: this.createSelectorsFromComputerUse(elem),
          bounds: elem.bounds,
          state: 'idle' as ElementState,
          confidence: elem.confidence,
          identifiedBy: this.name
        };
      });

      this.debug(`Identified ${elements.length} elements via Computer Use`);
      return elements;

    } catch (error) {
      this.debug('Computer Use identification failed:', error);
      throw error;
    }
  }

  protected async executeActionInternal(
    element: WebElement,
    action: ElementAction
  ): Promise<ActionResult> {
    if (!this.agent) {
      throw new Error('Computer Use agent not initialized');
    }

    const startTime = Date.now();
    const stateBefore = element.state;

    try {
      // Build instruction for the action
      const instruction = this.buildActionInstruction(element, action);

      this.debug('Executing action via Computer Use:', instruction);

      // Execute via agent
      const result = await this.agent.execute(instruction, this.page);

      if (!result.success) {
        return this.createErrorResult(
          stateBefore,
          'error',
          startTime,
          result.error || 'Computer Use execution failed'
        );
      }

      // Extract any data from the result
      const extractedData: Record<string, unknown> = {
        steps: result.steps.length,
        reasoning: result.steps[result.steps.length - 1]?.reasoning
      };

      return this.createSuccessResult(stateBefore, 'idle', startTime, extractedData);

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
    let score = 0.6; // Base score - Computer Use is powerful

    // Prefer for complex natural language instructions
    if (context.intent.split(' ').length > 5) {
      score += 0.2;
    }

    // Good when we have screenshot for vision
    if (context.screenshot) {
      score += 0.1;
    }

    // Hints boost
    if (context.hints?.some(h => 
      h.includes('computer use') || h.includes('claude') || h.includes('natural')
    )) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  protected async onCleanup(): Promise<void> {
    this.agent = null;
    this.BrowserAgent = null;
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Build instruction for element identification
   */
  private buildIdentificationInstruction(context: IdentificationContext): string {
    let instruction = `Identify interactive elements on this page for the following task: ${context.intent}`;

    if (context.hints && context.hints.length > 0) {
      instruction += `\n\nAdditional context: ${context.hints.join(', ')}`;
    }

    instruction += `\n\nFor each element, provide its type, description, selector, and position if possible.`;

    return instruction;
  }

  /**
   * Build instruction for action execution
   */
  private buildActionInstruction(element: WebElement, action: ElementAction): string {
    let instruction = '';

    switch (action.type) {
      case 'click':
        instruction = `Click on the ${element.type}`;
        if (element.text) {
          instruction += ` with text "${element.text}"`;
        } else if (element.visualDescription) {
          instruction += ` that ${element.visualDescription}`;
        }
        break;

      case 'type':
        instruction = `Type "${action.params?.text || ''}" into the ${element.type}`;
        if (element.text) {
          instruction += ` labeled "${element.text}"`;
        }
        if (action.params?.pressEnter) {
          instruction += ' and press Enter';
        }
        break;

      case 'select':
        instruction = `Select "${action.params?.option || ''}" from the ${element.type}`;
        if (element.text) {
          instruction += ` labeled "${element.text}"`;
        }
        break;

      case 'hover':
        instruction = `Hover over the ${element.type}`;
        if (element.text) {
          instruction += ` with text "${element.text}"`;
        }
        break;

      case 'scroll':
        const amount = action.params?.scrollAmount || 100;
        instruction = `Scroll ${amount > 0 ? 'down' : 'up'} by ${Math.abs(amount)} pixels`;
        break;

      case 'wait':
        instruction = `Wait for ${action.params?.waitMs || 1000}ms`;
        break;

      case 'extract':
        instruction = `Extract text from the ${element.type}`;
        if (element.text) {
          instruction += ` with text "${element.text}"`;
        }
        break;

      default:
        instruction = `Perform ${action.type} action on ${element.type}`;
    }

    // Add expected outcome if specified
    if (action.expectedOutcome?.stateChange) {
      instruction += `. Expected result: ${action.expectedOutcome.stateChange}`;
    }

    return instruction;
  }

  /**
   * Map Computer Use element types to our types
   */
  private mapElementType(type: string): ElementType {
    const typeMap: Record<string, ElementType> = {
      'button': 'button',
      'input': 'input',
      'textarea': 'textarea',
      'link': 'link',
      'select': 'dropdown',
      'checkbox': 'checkbox',
      'radio': 'radio',
      'slider': 'slider',
      'menu': 'menu',
      'dialog': 'modal',
      'div': 'container'
    };

    return typeMap[type.toLowerCase()] || 'container';
  }

  /**
   * Create selectors from Computer Use element data
   */
  private createSelectorsFromComputerUse(elem: {
    selector: string;
    description: string;
    bounds?: { x: number; y: number; width: number; height: number };
  }): ElementSelector[] {
    const selectors: ElementSelector[] = [];

    // Add provided selector
    if (elem.selector) {
      const type = elem.selector.startsWith('//') ? 'xpath' : 'css';
      selectors.push({
        type,
        value: elem.selector,
        priority: 1,
        validated: false
      });
    }

    // Add text-based selector from description
    if (elem.description) {
      selectors.push({
        type: 'text',
        value: elem.description,
        priority: 2,
        validated: false
      });
    }

    // Add coordinate-based fallback
    if (elem.bounds) {
      selectors.push({
        type: 'coordinates',
        value: JSON.stringify(elem.bounds),
        priority: 3,
        validated: false
      });
    }

    return selectors;
  }
}
