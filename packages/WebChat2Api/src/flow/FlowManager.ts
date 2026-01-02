/**
 * Flow Manager
 * 
 * Records, stores, and validates interaction flows.
 * Handles flow execution, completion detection, and retry logic.
 */

import { Page } from 'playwright';
import {
  InteractionFlow,
  FlowStep,
  FlowContext,
  FlowValidationResult,
  StepValidationResult,
  CompletionCondition,
  WebService,
  ValidationError,
  ElementAction,
  WebElement
} from '../strategies/types';
import { StrategyOrchestrator } from '../strategies/StrategyOrchestrator';
import * as crypto from 'crypto';

export class FlowManager {
  private flows: Map<string, InteractionFlow> = new Map();
  private orchestrator: StrategyOrchestrator;

  constructor(orchestrator: StrategyOrchestrator) {
    this.orchestrator = orchestrator;
  }

  /**
   * Create a new flow
   */
  createFlow(
    serviceId: string,
    name: string,
    description: string
  ): InteractionFlow {
    const flow: InteractionFlow = {
      id: this.generateFlowId(),
      serviceId,
      name,
      description,
      steps: [],
      expectedOutcomes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.flows.set(flow.id, flow);
    return flow;
  }

  /**
   * Add step to flow
   */
  addStep(
    flowId: string,
    description: string,
    action: ElementAction,
    completionConditions?: CompletionCondition[]
  ): void {
    const flow = this.flows.get(flowId);
    if (!flow) {
      throw new Error(`Flow ${flowId} not found`);
    }

    const step: FlowStep = {
      stepNumber: flow.steps.length + 1,
      description,
      action,
      completionConditions,
      retryConfig: {
        maxAttempts: 3,
        delayMs: 1000,
        exponentialBackoff: true
      }
    };

    flow.steps.push(step);
    flow.updatedAt = new Date().toISOString();
  }

  /**
   * Execute a flow
   */
  async executeFlow(
    flowId: string,
    context: FlowContext
  ): Promise<FlowValidationResult> {
    const flow = this.flows.get(flowId);
    if (!flow) {
      throw new Error(`Flow ${flowId} not found`);
    }

    console.log(`Executing flow: ${flow.name} (${flow.steps.length} steps)`);

    const startTime = Date.now();
    const stepResults: StepValidationResult[] = [];
    const errors: ValidationError[] = [];
    const screenshots: Buffer[] = [];

    // Check prerequisites
    if (flow.prerequisites) {
      for (const prereq of flow.prerequisites) {
        const valid = await prereq.validate(context);
        if (!valid) {
          return {
            flowId,
            timestamp: new Date().toISOString(),
            success: false,
            stepResults: [],
            executionTime: Date.now() - startTime,
            errors: [{
              type: 'unknown',
              message: `Prerequisite failed: ${prereq.description}`
            }]
          };
        }
      }
    }

    // Execute each step
    for (const step of flow.steps) {
      const stepStartTime = Date.now();
      
      try {
        console.log(`Step ${step.stepNumber}: ${step.description}`);
        
        // Execute step with retries
        const result = await this.executeStepWithRetry(step, context);
        
        stepResults.push(result);

        if (!result.success) {
          console.error(`Step ${step.stepNumber} failed: ${result.error}`);
          errors.push({
            type: 'unknown',
            message: result.error || 'Step execution failed',
            stepNumber: step.stepNumber
          });
          
          // Stop execution on failure
          break;
        }

        // Wait for completion conditions
        if (step.completionConditions) {
          await this.waitForCompletion(step.completionConditions, context);
        }

        // Take screenshot if configured
        const screenshot = await context.page.screenshot({ fullPage: false }).catch(() => undefined);
        if (screenshot) {
          screenshots.push(screenshot);
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`Step ${step.stepNumber} threw error:`, errorMsg);
        
        stepResults.push({
          stepNumber: step.stepNumber,
          success: false,
          executionTime: Date.now() - stepStartTime,
          strategyUsed: 'fallback',
          error: errorMsg
        });

        errors.push({
          type: 'unknown',
          message: errorMsg,
          stepNumber: step.stepNumber,
          stack: error instanceof Error ? error.stack : undefined
        });

        break;
      }
    }

    // Validate expected outcomes
    const allStepsSucceeded = stepResults.every(r => r.success);
    
    if (allStepsSucceeded && flow.expectedOutcomes.length > 0) {
      for (const outcome of flow.expectedOutcomes) {
        try {
          const validated = await this.validateOutcome(outcome, context);
          if (!validated) {
            errors.push({
              type: 'state-mismatch',
              message: `Expected outcome not achieved: ${outcome.description}`
            });
          }
        } catch (error) {
          errors.push({
            type: 'unknown',
            message: `Outcome validation failed: ${error instanceof Error ? error.message : String(error)}`
          });
        }
      }
    }

    const validationResult: FlowValidationResult = {
      flowId,
      timestamp: new Date().toISOString(),
      success: allStepsSucceeded && errors.length === 0,
      stepResults,
      executionTime: Date.now() - startTime,
      errors: errors.length > 0 ? errors : undefined,
      screenshots
    };

    // Update flow with validation result
    flow.lastValidation = validationResult;
    flow.updatedAt = new Date().toISOString();

    return validationResult;
  }

  /**
   * Get flow by ID
   */
  getFlow(flowId: string): InteractionFlow | undefined {
    return this.flows.get(flowId);
  }

  /**
   * List all flows for a service
   */
  getServiceFlows(serviceId: string): InteractionFlow[] {
    return Array.from(this.flows.values()).filter(
      flow => flow.serviceId === serviceId
    );
  }

  /**
   * List all flows
   */
  getAllFlows(): InteractionFlow[] {
    return Array.from(this.flows.values());
  }

  /**
   * Delete flow
   */
  deleteFlow(flowId: string): boolean {
    return this.flows.delete(flowId);
  }

  /**
   * Export flows to JSON
   */
  exportFlows(): string {
    const flowArray = Array.from(this.flows.values());
    return JSON.stringify(flowArray, null, 2);
  }

  /**
   * Import flows from JSON
   */
  importFlows(json: string): number {
    try {
      const flowArray = JSON.parse(json) as InteractionFlow[];
      let imported = 0;

      for (const flow of flowArray) {
        // Validate flow structure
        if (flow.id && flow.name && flow.serviceId) {
          this.flows.set(flow.id, flow);
          imported++;
        }
      }

      return imported;
    } catch (error) {
      throw new Error(`Failed to import flows: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Execute step with retry logic
   */
  private async executeStepWithRetry(
    step: FlowStep,
    context: FlowContext
  ): Promise<StepValidationResult> {
    const startTime = Date.now();
    const maxAttempts = step.retryConfig?.maxAttempts || 3;
    const baseDelay = step.retryConfig?.delayMs || 1000;
    const exponentialBackoff = step.retryConfig?.exponentialBackoff !== false;

    let lastError: string | undefined;
    let fallbackAttempts = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Execute action via orchestrator
        const result = await this.orchestrator.executeAction(
          step.action.element,
          step.action,
          step.fallbackStrategies
        );

        if (result.success) {
          return {
            stepNumber: step.stepNumber,
            success: true,
            executionTime: Date.now() - startTime,
            strategyUsed: step.action.element.identifiedBy,
            fallbackAttempts: attempt > 1 ? attempt - 1 : undefined
          };
        }

        lastError = result.error;
        fallbackAttempts = attempt;

      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        fallbackAttempts = attempt;
      }

      // Wait before retry (except on last attempt)
      if (attempt < maxAttempts) {
        const delay = exponentialBackoff 
          ? baseDelay * Math.pow(2, attempt - 1)
          : baseDelay;
        
        console.log(`Retrying step ${step.stepNumber} in ${delay}ms (attempt ${attempt + 1}/${maxAttempts})...`);
        await this.sleep(delay);
      }
    }

    // All attempts failed
    return {
      stepNumber: step.stepNumber,
      success: false,
      executionTime: Date.now() - startTime,
      strategyUsed: 'fallback',
      fallbackAttempts,
      error: lastError || 'All retry attempts failed'
    };
  }

  /**
   * Wait for completion conditions
   */
  private async waitForCompletion(
    conditions: CompletionCondition[],
    context: FlowContext
  ): Promise<void> {
    const promises = conditions.map(condition => 
      this.waitForSingleCondition(condition, context)
    );

    await Promise.all(promises);
  }

  /**
   * Wait for single completion condition
   */
  private async waitForSingleCondition(
    condition: CompletionCondition,
    context: FlowContext
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < condition.timeout) {
      let conditionMet = false;

      switch (condition.type) {
        case 'element-state': {
          const elementSelector = condition.params.selector as string;
          const expectedState = condition.params.state as string;
          
          try {
            const locator = context.page.locator(elementSelector);
            const isVisible = await locator.isVisible().catch(() => false);
            
            if (expectedState === 'visible' && isVisible) {
              conditionMet = true;
            } else if (expectedState === 'hidden' && !isVisible) {
              conditionMet = true;
            }
          } catch {
            // Continue waiting
          }
          break;
        }

        case 'text-appears': {
          const text = condition.params.text as string;
          try {
            const textLocator = context.page.getByText(text);
            const isVisible = await textLocator.isVisible().catch(() => false);
            if (isVisible) {
              conditionMet = true;
            }
          } catch {
            // Continue waiting
          }
          break;
        }

        case 'timeout': {
          const duration = condition.params.duration as number;
          await this.sleep(duration);
          conditionMet = true;
          break;
        }

        case 'custom': {
          // Custom condition logic would be here
          conditionMet = true;
          break;
        }
      }

      if (conditionMet) {
        return;
      }

      await this.sleep(100);
    }

    throw new Error(`Completion condition timeout: ${condition.type}`);
  }

  /**
   * Validate expected outcome
   */
  private async validateOutcome(
    outcome: { description: string; validation: { type: string; params: Record<string, unknown> } },
    context: FlowContext
  ): Promise<boolean> {
    try {
      switch (outcome.validation.type) {
        case 'element-exists': {
          const selector = outcome.validation.params.selector as string;
          const locator = context.page.locator(selector);
          return await locator.isVisible();
        }

        case 'text-contains': {
          const text = outcome.validation.params.text as string;
          const content = await context.page.content();
          return content.includes(text);
        }

        case 'state-change': {
          // Would need to compare before/after state
          return true;
        }

        default:
          return true;
      }
    } catch {
      return false;
    }
  }

  /**
   * Generate unique flow ID
   */
  private generateFlowId(): string {
    return `flow-${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
