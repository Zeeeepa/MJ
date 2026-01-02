/**
 * Web2API Strategies Module
 * 
 * Exports all available interaction strategies for browser automation.
 */

// Base strategy exports
export { BaseStrategy, InteractionStrategy } from './base/BaseStrategy';

// Provider strategy exports
export { StealthStrategy } from './providers/StealthStrategy';

// Type exports for external use
export type {
    StealthConfig,
    ElementContext,
    ElementAction,
    ValidationResult,
    CapabilityContext
} from './providers/StealthStrategy';