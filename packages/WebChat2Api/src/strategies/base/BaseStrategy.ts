/**
 * Base Strategy Interface and Abstract Class for Web2API
 * 
 * Defines the core interface for interaction strategies and provides
 * a base implementation with common functionality.
 */

import { Page, ElementHandle } from 'playwright';

/**
 * Core interface that all interaction strategies must implement
 */
export interface InteractionStrategy {
    /**
     * Initialize the strategy with a page instance and configuration
     */
    initialize(page: Page, config?: unknown): Promise<void>;

    /**
     * Identify elements on the page based on context
     */
    identifyElements(context: unknown): Promise<ElementHandle[]>;

    /**
     * Execute an action on an element
     */
    executeAction(element: ElementHandle, action: unknown): Promise<void>;

    /**
     * Validate that an element is ready for interaction
     */
    validateElement(element: ElementHandle): Promise<{ isValid: boolean; error?: string; properties?: Record<string, unknown> }>;

    /**
     * Get capability score for handling a specific context (0-1)
     */
    getCapabilityScore(context: unknown): number;

    /**
     * Cleanup resources and reset state
     */
    cleanup(): Promise<void>;
}

/**
 * Abstract base class providing common functionality for interaction strategies
 */
export abstract class BaseStrategy implements InteractionStrategy {
    protected strategyName: string;
    protected isInitialized = false;

    constructor(name?: string) {
        this.strategyName = name || this.constructor.name;
    }

    /**
     * Get the strategy name
     */
    public getName(): string {
        return this.strategyName;
    }

    /**
     * Check if the strategy has been initialized
     */
    public getIsInitialized(): boolean {
        return this.isInitialized;
    }

    /**
     * Abstract methods that must be implemented by concrete strategies
     */
    abstract initialize(page: Page, config?: unknown): Promise<void>;
    abstract identifyElements(context: unknown): Promise<ElementHandle[]>;
    abstract executeAction(element: ElementHandle, action: unknown): Promise<void>;
    abstract validateElement(element: ElementHandle): Promise<{ isValid: boolean; error?: string; properties?: Record<string, unknown> }>;
    abstract getCapabilityScore(context: unknown): number;
    abstract cleanup(): Promise<void>;

    /**
     * Common utility method for logging strategy actions
     */
    protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${this.strategyName}] ${message}`;
        
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

    /**
     * Common utility method for creating delays
     */
    protected async delay(milliseconds: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, milliseconds));
    }

    /**
     * Common utility method for safe error handling
     */
    protected handleError(error: unknown, context: string): Error {
        const message = error instanceof Error ? error.message : String(error);
        const errorMessage = `${this.strategyName} error in ${context}: ${message}`;
        this.log(errorMessage, 'error');
        return new Error(errorMessage);
    }

    /**
     * Common utility method for validating initialization
     */
    protected ensureInitialized(): void {
        if (!this.isInitialized) {
            throw new Error(`${this.strategyName} must be initialized before use`);
        }
    }
}