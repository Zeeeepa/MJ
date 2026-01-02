/**
 * Base Strategy Implementation
 * 
 * Abstract base class that all interaction strategies extend.
 * Provides common functionality for element identification, action execution,
 * and validation with built-in retry logic and error handling.
 */

import { Page } from 'playwright';
import {
  InteractionStrategy,
  StrategyType,
  StrategyConfig,
  WebElement,
  ElementAction,
  ActionResult,
  ValidationResult,
  IdentificationContext,
  ElementState,
  ActionParams,
  ExpectedOutcome
} from '../types';

export abstract class BaseStrategy implements InteractionStrategy {
  abstract readonly name: StrategyType;
  
  protected page!: Page;
  protected config: StrategyConfig = {};
  protected initialized = false;

  /**
   * Initialize strategy with page and configuration
   */
  async initialize(page: Page, config: StrategyConfig): Promise<void> {
    this.page = page;
    this.config = {
      timeout: 30000,
      stealthMode: false,
      visualDebug: false,
      ...config
    };
    
    await this.onInitialize();
    this.initialized = true;
  }

  /**
   * Strategy-specific initialization logic
   * Override in subclasses
   */
  protected abstract onInitialize(): Promise<void>;

  /**
   * Identify elements on the page
   * Must be implemented by each strategy
   */
  abstract identifyElements(context: IdentificationContext): Promise<WebElement[]>;

  /**
   * Execute an action on an element with retry logic
   */
  async executeAction(element: WebElement, action: ElementAction): Promise<ActionResult> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    const stateBefore = element.state;

    try {
      // Validate element is interactable
      const validation = await this.validateElement(element);
      if (!validation.valid) {
        return this.createErrorResult(
          stateBefore,
          element.state,
          startTime,
          `Element validation failed: ${validation.reason}`
        );
      }

      // Execute the action using strategy-specific implementation
      const result = await this.executeActionInternal(element, action);
      
      // Wait for expected outcome if specified
      if (action.expectedOutcome && result.success) {
        await this.waitForOutcome(action.expectedOutcome);
      }

      return result;

    } catch (error) {
      return this.createErrorResult(
        stateBefore,
        element.state,
        startTime,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Strategy-specific action execution
   * Override in subclasses to implement strategy logic
   */
  protected abstract executeActionInternal(
    element: WebElement,
    action: ElementAction
  ): Promise<ActionResult>;

  /**
   * Validate an element's state and interactability
   */
  async validateElement(element: WebElement): Promise<ValidationResult> {
    this.ensureInitialized();

    try {
      // Try each selector in priority order
      for (const selector of element.selectors.sort((a, b) => a.priority - b.priority)) {
        const locator = this.getLocator(selector.type, selector.value);
        
        if (locator) {
          const isVisible = await locator.isVisible().catch(() => false);
          const isEnabled = await locator.isEnabled().catch(() => false);
          
          if (isVisible && isEnabled) {
            return {
              valid: true,
              state: 'idle',
              confidence: element.confidence
            };
          }
        }
      }

      return {
        valid: false,
        reason: 'Element not found or not interactable',
        state: 'hidden',
        confidence: 0
      };

    } catch (error) {
      return {
        valid: false,
        reason: error instanceof Error ? error.message : String(error),
        state: 'error',
        confidence: 0
      };
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.onCleanup();
    this.initialized = false;
  }

  /**
   * Strategy-specific cleanup logic
   * Override in subclasses if needed
   */
  protected async onCleanup(): Promise<void> {
    // Default: no-op
  }

  /**
   * Get capability score for given context
   * Higher score = better suited for the context
   * Override in subclasses to provide specific scoring logic
   */
  abstract getCapabilityScore(context: IdentificationContext): number;

  // ============================================================================
  // PROTECTED HELPER METHODS
  // ============================================================================

  /**
   * Get Playwright locator from selector
   */
  protected getLocator(type: string, value: string) {
    switch (type) {
      case 'css':
        return this.page.locator(value);
      case 'xpath':
        return this.page.locator(`xpath=${value}`);
      case 'text':
        return this.page.getByText(value);
      case 'aria-label':
        return this.page.getByLabel(value);
      case 'data-testid':
        return this.page.getByTestId(value);
      default:
        return null;
    }
  }

  /**
   * Wait for expected outcome
   */
  protected async waitForOutcome(outcome: ExpectedOutcome): Promise<void> {
    const timeout = this.config.timeout || 30000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      let outcomeAchieved = true;

      // Check for new elements
      if (outcome.newElements && outcome.newElements.length > 0) {
        for (const elementDesc of outcome.newElements) {
          const exists = await this.page.getByText(elementDesc).isVisible().catch(() => false);
          if (!exists) {
            outcomeAchieved = false;
            break;
          }
        }
      }

      // Check for navigation
      if (outcome.navigation) {
        await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
          outcomeAchieved = false;
        });
      }

      if (outcomeAchieved) {
        return;
      }

      await this.sleep(100);
    }

    throw new Error('Timeout waiting for expected outcome');
  }

  /**
   * Take screenshot for debugging
   */
  protected async takeScreenshot(): Promise<Buffer | undefined> {
    if (!this.config.visualDebug) {
      return undefined;
    }

    try {
      return await this.page.screenshot({ fullPage: false });
    } catch {
      return undefined;
    }
  }

  /**
   * Create error result object
   */
  protected createErrorResult(
    stateBefore: ElementState,
    stateAfter: ElementState,
    startTime: number,
    errorMessage: string
  ): ActionResult {
    return {
      success: false,
      error: errorMessage,
      stateBefore,
      stateAfter,
      executionTime: Date.now() - startTime,
      screenshot: undefined
    };
  }

  /**
   * Create success result object
   */
  protected createSuccessResult(
    stateBefore: ElementState,
    stateAfter: ElementState,
    startTime: number,
    extractedData?: Record<string, unknown>
  ): ActionResult {
    return {
      success: true,
      stateBefore,
      stateAfter,
      executionTime: Date.now() - startTime,
      extractedData
    };
  }

  /**
   * Sleep utility
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Ensure strategy is initialized
   */
  protected ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(`Strategy ${this.name} is not initialized`);
    }
  }

  /**
   * Log debug message
   */
  protected debug(message: string, ...args: unknown[]): void {
    if (this.config.visualDebug) {
      console.log(`[${this.name}] ${message}`, ...args);
    }
  }

  /**
   * Extract action type-specific parameters safely
   */
  protected getActionParam<T>(params: ActionParams | undefined, key: keyof ActionParams, defaultValue: T): T {
    if (!params || params[key] === undefined) {
      return defaultValue;
    }
    return params[key] as T;
  }
}
