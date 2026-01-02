/**
 * Strategy Orchestrator
 * 
 * Manages multiple interaction strategies and intelligently selects
 * the best strategy for each situation. Handles fallback chains and
 * strategy scoring.
 */

import { Page } from 'playwright';
import {
  InteractionStrategy,
  StrategyType,
  StrategyConfig,
  WebElement,
  ElementAction,
  ActionResult,
  IdentificationContext,
  ValidationResult
} from './types';

export class StrategyOrchestrator {
  private strategies: Map<StrategyType, InteractionStrategy> = new Map();
  private page!: Page;
  private config: StrategyConfig = {};
  private initialized = false;

  /**
   * Register a strategy
   */
  registerStrategy(strategy: InteractionStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * Initialize all registered strategies
   */
  async initialize(page: Page, config: StrategyConfig): Promise<void> {
    this.page = page;
    this.config = config;

    // Initialize all strategies
    const initPromises = Array.from(this.strategies.values()).map(strategy =>
      strategy.initialize(page, config).catch(error => {
        console.error(`Failed to initialize strategy ${strategy.name}:`, error);
        return null;
      })
    );

    await Promise.all(initPromises);
    this.initialized = true;

    console.log(`Initialized ${this.strategies.size} strategies:`, 
      Array.from(this.strategies.keys())
    );
  }

  /**
   * Identify elements using the best available strategy
   */
  async identifyElements(context: IdentificationContext): Promise<WebElement[]> {
    this.ensureInitialized();

    // Score all strategies for this context
    const scores = this.scoreStrategies(context);
    
    // Sort by score descending
    const sortedStrategies = scores.sort((a, b) => b.score - a.score);

    console.log('Strategy scores:', sortedStrategies.map(s => 
      `${s.strategy.name}: ${s.score}`
    ).join(', '));

    // Try strategies in order until one succeeds
    const errors: Array<{ strategy: StrategyType; error: string }> = [];

    for (const { strategy, score } of sortedStrategies) {
      // Skip strategies with very low scores
      if (score < 0.1) {
        continue;
      }

      try {
        console.log(`Attempting identification with ${strategy.name} (score: ${score})...`);
        
        const elements = await strategy.identifyElements(context);
        
        if (elements.length > 0) {
          console.log(`✓ ${strategy.name} identified ${elements.length} elements`);
          return elements;
        }
        
        console.log(`✗ ${strategy.name} found no elements`);
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`✗ ${strategy.name} failed:`, errorMsg);
        errors.push({ strategy: strategy.name, error: errorMsg });
      }
    }

    // All strategies failed
    throw new Error(
      `All strategies failed to identify elements. Errors: ${
        errors.map(e => `${e.strategy}: ${e.error}`).join('; ')
      }`
    );
  }

  /**
   * Execute action using the best strategy for the element
   */
  async executeAction(
    element: WebElement, 
    action: ElementAction,
    fallbackStrategies?: StrategyType[]
  ): Promise<ActionResult> {
    this.ensureInitialized();

    // First, try the strategy that identified the element
    const primaryStrategy = this.strategies.get(element.identifiedBy);
    
    if (primaryStrategy) {
      console.log(`Executing action with primary strategy: ${element.identifiedBy}`);
      
      try {
        const result = await primaryStrategy.executeAction(element, action);
        
        if (result.success) {
          return result;
        }
        
        console.log(`Primary strategy failed: ${result.error}`);
      } catch (error) {
        console.error(`Primary strategy threw error:`, error);
      }
    }

    // Try fallback strategies if provided
    if (fallbackStrategies && fallbackStrategies.length > 0) {
      for (const strategyType of fallbackStrategies) {
        const strategy = this.strategies.get(strategyType);
        
        if (!strategy) {
          continue;
        }

        console.log(`Trying fallback strategy: ${strategyType}`);
        
        try {
          const result = await strategy.executeAction(element, action);
          
          if (result.success) {
            console.log(`✓ Fallback strategy ${strategyType} succeeded`);
            return result;
          }
          
          console.log(`✗ Fallback strategy ${strategyType} failed: ${result.error}`);
        } catch (error) {
          console.error(`Fallback strategy ${strategyType} threw error:`, error);
        }
      }
    }

    // All strategies failed
    return {
      success: false,
      error: 'All strategies (including fallbacks) failed to execute action',
      stateBefore: element.state,
      stateAfter: element.state,
      executionTime: 0
    };
  }

  /**
   * Validate element using multiple strategies
   */
  async validateElement(element: WebElement): Promise<ValidationResult> {
    this.ensureInitialized();

    // Try the strategy that identified the element first
    const primaryStrategy = this.strategies.get(element.identifiedBy);
    
    if (primaryStrategy) {
      const result = await primaryStrategy.validateElement(element);
      if (result.valid) {
        return result;
      }
    }

    // Try other strategies as fallback
    for (const strategy of this.strategies.values()) {
      if (strategy.name === element.identifiedBy) {
        continue; // Already tried
      }

      try {
        const result = await strategy.validateElement(element);
        if (result.valid) {
          return result;
        }
      } catch {
        // Continue to next strategy
      }
    }

    // All validations failed
    return {
      valid: false,
      reason: 'No strategy could validate element',
      state: 'error',
      confidence: 0
    };
  }

  /**
   * Get specific strategy by type
   */
  getStrategy(type: StrategyType): InteractionStrategy | undefined {
    return this.strategies.get(type);
  }

  /**
   * List all registered strategies
   */
  listStrategies(): StrategyType[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Clean up all strategies
   */
  async cleanup(): Promise<void> {
    const cleanupPromises = Array.from(this.strategies.values()).map(strategy =>
      strategy.cleanup().catch(error => {
        console.error(`Failed to cleanup strategy ${strategy.name}:`, error);
      })
    );

    await Promise.all(cleanupPromises);
    this.initialized = false;
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Score all strategies for given context
   */
  private scoreStrategies(context: IdentificationContext): Array<{
    strategy: InteractionStrategy;
    score: number;
  }> {
    const scores: Array<{ strategy: InteractionStrategy; score: number }> = [];

    for (const strategy of this.strategies.values()) {
      let score = strategy.getCapabilityScore(context);

      // Penalize strategies that have failed before for this context
      if (context.previousAttempts?.includes(strategy.name)) {
        score *= 0.5;
      }

      scores.push({ strategy, score });
    }

    return scores;
  }

  /**
   * Ensure orchestrator is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('StrategyOrchestrator is not initialized');
    }
  }
}

/**
 * Strategy Priority Calculator
 * 
 * Helps determine which strategy should be used based on context
 */
export class StrategyPriorityCalculator {
  /**
   * Calculate base scores for different contexts
   */
  static calculateBaseScores(context: IdentificationContext): Record<StrategyType, number> {
    const scores: Partial<Record<StrategyType, number>> = {
      'vision-model': 0.5,
      'computer-use': 0.5,
      'natural-language': 0.5,
      'dom-analysis': 0.5,
      'coordinate-based': 0.3,
      'hybrid': 0.6,
      'fallback': 0.2
    };

    // Increase vision model score if we have a screenshot
    if (context.screenshot) {
      scores['vision-model'] = 0.8;
      scores['computer-use'] = 0.7;
    }

    // Increase DOM analysis score if we have HTML
    if (context.htmlSnapshot) {
      scores['dom-analysis'] = 0.7;
    }

    // Increase natural language score if we have strong intent
    if (context.intent && context.intent.length > 10) {
      scores['natural-language'] = 0.7;
    }

    // Hints boost specific strategies
    if (context.hints) {
      for (const hint of context.hints) {
        if (hint.includes('visual') || hint.includes('screenshot')) {
          scores['vision-model'] = (scores['vision-model'] || 0) + 0.2;
        }
        if (hint.includes('dom') || hint.includes('html')) {
          scores['dom-analysis'] = (scores['dom-analysis'] || 0) + 0.2;
        }
        if (hint.includes('natural') || hint.includes('language')) {
          scores['natural-language'] = (scores['natural-language'] || 0) + 0.2;
        }
      }
    }

    // Cap all scores at 1.0
    for (const key of Object.keys(scores)) {
      scores[key as StrategyType] = Math.min(scores[key as StrategyType] || 0, 1.0);
    }

    return scores as Record<StrategyType, number>;
  }

  /**
   * Adjust scores based on previous attempts
   */
  static adjustForPreviousAttempts(
    scores: Record<StrategyType, number>,
    previousAttempts: StrategyType[]
  ): Record<StrategyType, number> {
    const adjusted = { ...scores };

    for (const attempt of previousAttempts) {
      // Significantly reduce score for previously failed strategies
      adjusted[attempt] = (adjusted[attempt] || 0) * 0.3;
    }

    return adjusted;
  }

  /**
   * Get recommended strategy order
   */
  static getRecommendedOrder(context: IdentificationContext): StrategyType[] {
    const baseScores = this.calculateBaseScores(context);
    const adjustedScores = context.previousAttempts
      ? this.adjustForPreviousAttempts(baseScores, context.previousAttempts)
      : baseScores;

    return (Object.entries(adjustedScores) as Array<[StrategyType, number]>)
      .sort((a, b) => b[1] - a[1])
      .map(([strategy]) => strategy);
  }
}
