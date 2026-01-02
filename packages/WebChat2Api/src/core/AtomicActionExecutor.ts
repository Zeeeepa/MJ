/**
 * AtomicActionExecutor - Vision-Verified Browser Action Execution
 * 
 * Executes atomic browser actions with vision model verification after each step.
 * Provides retry logic, screenshot comparison, and comprehensive error handling.
 */

import { Page, ElementHandle } from 'playwright';
import { AnthropicLLM } from '@memberjunction/ai-anthropic';
import { ChatParams, ChatMessage } from '@memberjunction/ai';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Supported atomic action types
 */
export type AtomicActionType = 'click' | 'type' | 'select' | 'scroll' | 'wait';

/**
 * Scroll direction options
 */
export type ScrollDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Wait condition types
 */
export type WaitCondition = 'element' | 'timeout' | 'navigation' | 'selector';

/**
 * Base interface for all atomic actions
 */
export interface BaseAtomicAction {
    type: AtomicActionType;
    description: string;
    id?: string;
    retries?: number;
}

/**
 * Click action definition
 */
export interface ClickAction extends BaseAtomicAction {
    type: 'click';
    element: string | ElementHandle;
    options?: {
        button?: 'left' | 'right' | 'middle';
        clickCount?: number;
        delay?: number;
    };
}

/**
 * Type action definition
 */
export interface TypeAction extends BaseAtomicAction {
    type: 'type';
    element: string | ElementHandle;
    text: string;
    options?: {
        delay?: number;
        clear?: boolean;
    };
}

/**
 * Select action definition
 */
export interface SelectAction extends BaseAtomicAction {
    type: 'select';
    element: string | ElementHandle;
    value: string | string[];
    options?: {
        index?: boolean;
        label?: boolean;
    };
}

/**
 * Scroll action definition
 */
export interface ScrollAction extends BaseAtomicAction {
    type: 'scroll';
    direction: ScrollDirection;
    amount?: number;
    element?: string | ElementHandle;
}

/**
 * Wait action definition
 */
export interface WaitAction extends BaseAtomicAction {
    type: 'wait';
    condition: WaitCondition;
    target?: string;
    timeout?: number;
}

/**
 * Union type for all atomic actions
 */
export type AtomicAction = ClickAction | TypeAction | SelectAction | ScrollAction | WaitAction;

/**
 * Action execution result
 */
export interface ActionExecutionResult {
    success: boolean;
    actionId: string;
    description: string;
    beforeScreenshot: string;
    afterScreenshot: string;
    verificationResult: VerificationResult;
    attempts: number;
    duration: number;
    error?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Vision verification result
 */
export interface VerificationResult {
    success: boolean;
    confidence: number;
    explanation: string;
    beforeDescription: string;
    afterDescription: string;
    changesDetected: string[];
    timestamp: Date;
}

/**
 * Action chain definition
 */
export interface ActionChain {
    id: string;
    name: string;
    description: string;
    actions: AtomicAction[];
    continueOnFailure?: boolean;
    timeout?: number;
}

/**
 * Chain execution result
 */
export interface ChainExecutionResult {
    success: boolean;
    chainId: string;
    totalActions: number;
    successfulActions: number;
    failedActions: number;
    results: ActionExecutionResult[];
    duration: number;
    abortedAt?: number;
    error?: string;
}

/**
 * Configuration options for the executor
 */
export interface ExecutorConfig {
    screenshotDir: string;
    visionModel: string;
    anthropicApiKey: string;
    maxRetries: number;
    retryDelay: number;
    verificationTimeout: number;
    enableDetailedLogging: boolean;
}

/**
 * Default executor configuration
 */
const DEFAULT_CONFIG: ExecutorConfig = {
    screenshotDir: './screenshots',
    visionModel: 'claude-3-5-sonnet-20241022',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    maxRetries: 3,
    retryDelay: 1000,
    verificationTimeout: 30000,
    enableDetailedLogging: false
};

/**
 * AtomicActionExecutor - Executes browser actions with vision verification
 */
export class AtomicActionExecutor {
    private config: ExecutorConfig;
    private visionLLM: AnthropicLLM;
    private initialized = false;

    constructor(config?: Partial<ExecutorConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        
        if (!this.config.anthropicApiKey) {
            throw new Error('Anthropic API key is required for vision verification');
        }

        this.visionLLM = new AnthropicLLM(this.config.anthropicApiKey);
        this.ensureScreenshotDirectory();
    }

    /**
     * Initialize the executor
     */
    public async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            // Test vision model connectivity
            await this.testVisionModel();
            this.initialized = true;
            this.log('AtomicActionExecutor initialized successfully');
        } catch (error) {
            throw new Error(`Failed to initialize AtomicActionExecutor: ${this.getErrorMessage(error)}`);
        }
    }

    /**
     * Execute a single atomic action with vision verification
     */
    public async executeAction(action: AtomicAction, page: Page): Promise<ActionExecutionResult> {
        this.ensureInitialized();
        
        const actionId = action.id || uuidv4();
        const startTime = Date.now();
        let attempts = 0;
        const maxRetries = action.retries || this.config.maxRetries;

        this.log(`Executing action: ${action.type} - ${action.description}`, 'info');

        while (attempts <= maxRetries) {
            attempts++;
            
            try {
                // Take before screenshot
                const beforeScreenshot = await this.takeScreenshot(page, `${actionId}_before_attempt${attempts}`);
                
                // Execute the action
                await this.performAction(action, page);
                
                // Small delay to allow UI changes to settle
                await this.delay(500);
                
                // Take after screenshot
                const afterScreenshot = await this.takeScreenshot(page, `${actionId}_after_attempt${attempts}`);
                
                // Verify action success with vision model
                const verificationResult = await this.verifyActionSuccess(
                    beforeScreenshot,
                    afterScreenshot,
                    action.description
                );

                const duration = Date.now() - startTime;

                const result: ActionExecutionResult = {
                    success: verificationResult.success,
                    actionId,
                    description: action.description,
                    beforeScreenshot,
                    afterScreenshot,
                    verificationResult,
                    attempts,
                    duration,
                    metadata: {
                        actionType: action.type,
                        timestamp: new Date().toISOString()
                    }
                };

                if (verificationResult.success) {
                    this.log(`Action completed successfully after ${attempts} attempt(s)`, 'info');
                    return result;
                }

                if (attempts <= maxRetries) {
                    this.log(`Action verification failed, retrying (attempt ${attempts + 1}/${maxRetries + 1}): ${verificationResult.explanation}`, 'warn');
                    await this.delay(this.config.retryDelay);
                } else {
                    result.error = `Action failed after ${maxRetries + 1} attempts: ${verificationResult.explanation}`;
                    this.log(result.error, 'error');
                    return result;
                }

            } catch (error) {
                const errorMessage = this.getErrorMessage(error);
                
                if (attempts <= maxRetries) {
                    this.log(`Action execution failed, retrying (attempt ${attempts + 1}/${maxRetries + 1}): ${errorMessage}`, 'warn');
                    await this.delay(this.config.retryDelay);
                } else {
                    const duration = Date.now() - startTime;
                    this.log(`Action failed after ${maxRetries + 1} attempts: ${errorMessage}`, 'error');
                    
                    return {
                        success: false,
                        actionId,
                        description: action.description,
                        beforeScreenshot: '',
                        afterScreenshot: '',
                        verificationResult: {
                            success: false,
                            confidence: 0,
                            explanation: errorMessage,
                            beforeDescription: 'Error occurred before verification',
                            afterDescription: 'Error occurred before verification',
                            changesDetected: [],
                            timestamp: new Date()
                        },
                        attempts,
                        duration,
                        error: errorMessage
                    };
                }
            }
        }

        throw new Error('Unexpected end of retry loop');
    }

    /**
     * Verify action success using vision model
     */
    public async verifyActionSuccess(
        beforeScreenshot: string,
        afterScreenshot: string,
        expectedOutcome: string
    ): Promise<VerificationResult> {
        this.ensureInitialized();

        try {
            // Read screenshots as base64
            const beforeBase64 = this.encodeImageAsBase64(beforeScreenshot);
            const afterBase64 = this.encodeImageAsBase64(afterScreenshot);

            // Create vision verification prompt
            const systemPrompt = this.buildVerificationSystemPrompt();
            const userPrompt = this.buildVerificationUserPrompt(expectedOutcome);

            const messages: ChatMessage[] = [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: userPrompt
                        },
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: 'image/png',
                                data: beforeBase64
                            }
                        },
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: 'image/png',
                                data: afterBase64
                            }
                        }
                    ]
                }
            ];

            const chatParams: ChatParams = {
                messages,
                model: this.config.visionModel,
                maxOutputTokens: 4000,
                temperature: 0.1
            };

            const response = await this.visionLLM.Chat(chatParams);
            
            if (!response.success || !response.data.choices.length) {
                throw new Error(`Vision verification failed: ${response.errorMessage || 'No response from model'}`);
            }

            const content = response.data.choices[0].message.content;
            return this.parseVerificationResponse(content);

        } catch (error) {
            this.log(`Vision verification error: ${this.getErrorMessage(error)}`, 'error');
            return {
                success: false,
                confidence: 0,
                explanation: `Vision verification failed: ${this.getErrorMessage(error)}`,
                beforeDescription: 'Error during analysis',
                afterDescription: 'Error during analysis',
                changesDetected: [],
                timestamp: new Date()
            };
        }
    }

    /**
     * Create an action chain from multiple actions
     */
    public createActionChain(
        actions: AtomicAction[],
        name?: string,
        description?: string,
        options?: {
            continueOnFailure?: boolean;
            timeout?: number;
        }
    ): ActionChain {
        return {
            id: uuidv4(),
            name: name || `Action Chain ${new Date().toISOString()}`,
            description: description || `Chain of ${actions.length} actions`,
            actions,
            continueOnFailure: options?.continueOnFailure || false,
            timeout: options?.timeout || 300000 // 5 minutes default
        };
    }

    /**
     * Execute an action chain
     */
    public async executeChain(chain: ActionChain, page: Page): Promise<ChainExecutionResult> {
        this.ensureInitialized();
        
        const startTime = Date.now();
        const results: ActionExecutionResult[] = [];
        let successfulActions = 0;
        let failedActions = 0;
        let abortedAt: number | undefined;

        this.log(`Executing action chain: ${chain.name} (${chain.actions.length} actions)`, 'info');

        for (let i = 0; i < chain.actions.length; i++) {
            const action = chain.actions[i];
            
            try {
                // Check timeout
                if (chain.timeout && (Date.now() - startTime) > chain.timeout) {
                    abortedAt = i;
                    this.log(`Chain execution timed out at action ${i + 1}`, 'warn');
                    break;
                }

                const result = await this.executeAction(action, page);
                results.push(result);

                if (result.success) {
                    successfulActions++;
                } else {
                    failedActions++;
                    
                    if (!chain.continueOnFailure) {
                        abortedAt = i;
                        this.log(`Chain execution aborted at action ${i + 1} due to failure`, 'warn');
                        break;
                    }
                }

            } catch (error) {
                failedActions++;
                const errorMessage = this.getErrorMessage(error);
                
                // Create failed result
                const failedResult: ActionExecutionResult = {
                    success: false,
                    actionId: action.id || uuidv4(),
                    description: action.description,
                    beforeScreenshot: '',
                    afterScreenshot: '',
                    verificationResult: {
                        success: false,
                        confidence: 0,
                        explanation: errorMessage,
                        beforeDescription: 'Error during execution',
                        afterDescription: 'Error during execution',
                        changesDetected: [],
                        timestamp: new Date()
                    },
                    attempts: 1,
                    duration: 0,
                    error: errorMessage
                };
                
                results.push(failedResult);

                if (!chain.continueOnFailure) {
                    abortedAt = i;
                    this.log(`Chain execution aborted at action ${i + 1} due to error: ${errorMessage}`, 'error');
                    break;
                }
            }
        }

        const duration = Date.now() - startTime;
        const success = failedActions === 0 && abortedAt === undefined;

        const chainResult: ChainExecutionResult = {
            success,
            chainId: chain.id,
            totalActions: chain.actions.length,
            successfulActions,
            failedActions,
            results,
            duration,
            abortedAt
        };

        if (!success) {
            chainResult.error = abortedAt !== undefined 
                ? `Chain execution aborted at action ${abortedAt + 1}`
                : `${failedActions} actions failed`;
        }

        this.log(`Chain execution completed: ${successfulActions}/${chain.actions.length} actions successful`, 
                 success ? 'info' : 'warn');

        return chainResult;
    }

    /**
     * Perform the actual browser action
     */
    private async performAction(action: AtomicAction, page: Page): Promise<void> {
        switch (action.type) {
            case 'click':
                await this.performClickAction(action, page);
                break;
            case 'type':
                await this.performTypeAction(action, page);
                break;
            case 'select':
                await this.performSelectAction(action, page);
                break;
            case 'scroll':
                await this.performScrollAction(action, page);
                break;
            case 'wait':
                await this.performWaitAction(action, page);
                break;
            default:
                throw new Error(`Unsupported action type: ${(action as any).type}`);
        }
    }

    /**
     * Perform click action
     */
    private async performClickAction(action: ClickAction, page: Page): Promise<void> {
        const element = await this.getElement(action.element, page);
        
        await element.click({
            button: action.options?.button || 'left',
            clickCount: action.options?.clickCount || 1,
            delay: action.options?.delay || 0
        });
    }

    /**
     * Perform type action
     */
    private async performTypeAction(action: TypeAction, page: Page): Promise<void> {
        const element = await this.getElement(action.element, page);
        
        if (action.options?.clear) {
            await element.clear();
        }
        
        await element.type(action.text, {
            delay: action.options?.delay || 0
        });
    }

    /**
     * Perform select action
     */
    private async performSelectAction(action: SelectAction, page: Page): Promise<void> {
        const element = await this.getElement(action.element, page);
        
        if (Array.isArray(action.value)) {
            await element.selectOption(action.value);
        } else {
            if (action.options?.index) {
                await element.selectOption({ index: parseInt(action.value) });
            } else if (action.options?.label) {
                await element.selectOption({ label: action.value });
            } else {
                await element.selectOption({ value: action.value });
            }
        }
    }

    /**
     * Perform scroll action
     */
    private async performScrollAction(action: ScrollAction, page: Page): Promise<void> {
        const amount = action.amount || 500;
        
        if (action.element) {
            const element = await this.getElement(action.element, page);
            await element.scrollIntoViewIfNeeded();
        } else {
            let deltaX = 0;
            let deltaY = 0;
            
            switch (action.direction) {
                case 'up':
                    deltaY = -amount;
                    break;
                case 'down':
                    deltaY = amount;
                    break;
                case 'left':
                    deltaX = -amount;
                    break;
                case 'right':
                    deltaX = amount;
                    break;
            }
            
            await page.mouse.wheel(deltaX, deltaY);
        }
    }

    /**
     * Perform wait action
     */
    private async performWaitAction(action: WaitAction, page: Page): Promise<void> {
        const timeout = action.timeout || 10000;
        
        switch (action.condition) {
            case 'element':
                if (!action.target) throw new Error('Target required for element wait');
                await page.waitForSelector(action.target, { timeout });
                break;
            case 'timeout':
                await this.delay(timeout);
                break;
            case 'navigation':
                await page.waitForLoadState('networkidle', { timeout });
                break;
            case 'selector':
                if (!action.target) throw new Error('Target required for selector wait');
                await page.waitForSelector(action.target, { timeout });
                break;
            default:
                throw new Error(`Unsupported wait condition: ${action.condition}`);
        }
    }

    /**
     * Get element handle from string selector or existing handle
     */
    private async getElement(element: string | ElementHandle, page: Page): Promise<ElementHandle> {
        if (typeof element === 'string') {
            const handle = await page.$(element);
            if (!handle) {
                throw new Error(`Element not found: ${element}`);
            }
            return handle;
        }
        return element;
    }

    /**
     * Take screenshot and return file path
     */
    private async takeScreenshot(page: Page, name: string): Promise<string> {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${timestamp}_${name}.png`;
        const filepath = path.join(this.config.screenshotDir, filename);
        
        await page.screenshot({
            path: filepath,
            fullPage: true,
            type: 'png'
        });
        
        return filepath;
    }

    /**
     * Build system prompt for verification
     */
    private buildVerificationSystemPrompt(): string {
        return `You are an expert vision model specialized in analyzing web page screenshots to verify browser automation actions.

Your task is to compare "before" and "after" screenshots and determine if the expected action was successfully performed.

Respond in this exact JSON format:
{
    "success": boolean,
    "confidence": number (0-1),
    "explanation": "detailed explanation of what happened",
    "beforeDescription": "description of before screenshot",
    "afterDescription": "description of after screenshot", 
    "changesDetected": ["list", "of", "specific", "changes"]
}

Guidelines:
- success: true if the expected action clearly occurred, false otherwise
- confidence: 0.9+ for clear success, 0.1 or less for clear failure, 0.3-0.7 for ambiguous
- Be specific about what changed between screenshots
- Look for UI state changes, element appearances/disappearances, text changes, etc.
- Consider that some actions may take time to show visual effects`;
    }

    /**
     * Build user prompt for verification
     */
    private buildVerificationUserPrompt(expectedOutcome: string): string {
        return `Expected action: ${expectedOutcome}

Please analyze the two screenshots (before and after) to determine if this action was successfully performed.

First screenshot: BEFORE the action
Second screenshot: AFTER the action

Compare them carefully and provide your analysis in the specified JSON format.`;
    }

    /**
     * Parse verification response from vision model
     */
    private parseVerificationResponse(content: string): VerificationResult {
        try {
            // Extract JSON from response (handle cases where model adds extra text)
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            
            const parsed = JSON.parse(jsonMatch[0]);
            
            return {
                success: Boolean(parsed.success),
                confidence: Number(parsed.confidence) || 0,
                explanation: String(parsed.explanation || 'No explanation provided'),
                beforeDescription: String(parsed.beforeDescription || 'No description'),
                afterDescription: String(parsed.afterDescription || 'No description'),
                changesDetected: Array.isArray(parsed.changesDetected) ? parsed.changesDetected.map(String) : [],
                timestamp: new Date()
            };
            
        } catch (error) {
            this.log(`Failed to parse verification response: ${this.getErrorMessage(error)}`, 'error');
            return {
                success: false,
                confidence: 0,
                explanation: `Failed to parse verification response: ${this.getErrorMessage(error)}`,
                beforeDescription: 'Parse error',
                afterDescription: 'Parse error',
                changesDetected: [],
                timestamp: new Date()
            };
        }
    }

    /**
     * Encode image file as base64
     */
    private encodeImageAsBase64(imagePath: string): string {
        try {
            const imageBuffer = fs.readFileSync(imagePath);
            return imageBuffer.toString('base64');
        } catch (error) {
            throw new Error(`Failed to encode image: ${this.getErrorMessage(error)}`);
        }
    }

    /**
     * Test vision model connectivity
     */
    private async testVisionModel(): Promise<void> {
        const testParams: ChatParams = {
            messages: [{
                role: 'user',
                content: 'Test connection. Respond with "OK".'
            }],
            model: this.config.visionModel,
            maxOutputTokens: 10
        };

        const response = await this.visionLLM.Chat(testParams);
        
        if (!response.success) {
            throw new Error(`Vision model test failed: ${response.errorMessage}`);
        }
    }

    /**
     * Ensure screenshot directory exists
     */
    private ensureScreenshotDirectory(): void {
        if (!fs.existsSync(this.config.screenshotDir)) {
            fs.mkdirSync(this.config.screenshotDir, { recursive: true });
        }
    }

    /**
     * Ensure executor is initialized
     */
    private ensureInitialized(): void {
        if (!this.initialized) {
            throw new Error('AtomicActionExecutor must be initialized before use');
        }
    }

    /**
     * Utility method for delays
     */
    private async delay(milliseconds: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }

    /**
     * Extract error message from unknown error type
     */
    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        return String(error);
    }

    /**
     * Logging utility
     */
    private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
        if (!this.config.enableDetailedLogging && level === 'info') {
            return;
        }

        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [AtomicActionExecutor] ${message}`;
        
        switch (level) {
            case 'warn':
                console.warn(logMessage);
                break;
            case 'error':
                console.error(logMessage);
                break;
            default:
                console.log(logMessage);
        }
    }
}

/**
 * Export utility function for tree-shaking prevention
 */
export function LoadAtomicActionExecutor(): void {
    // This function prevents the class from being removed by tree shaking
}