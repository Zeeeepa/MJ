/**
 * Core Types for Multi-Strategy Web2API System
 * 
 * Defines interfaces for DOM interaction strategies, element identification,
 * action recording, and flow validation.
 */

import { Page } from 'playwright';

// ============================================================================
// ELEMENT IDENTIFICATION & INTERACTION
// ============================================================================

/**
 * Represents a web element that can be interacted with
 */
export interface WebElement {
  /** Unique identifier for this element */
  id: string;
  /** Type of element (button, input, link, etc.) */
  type: ElementType;
  /** Text content or label */
  text?: string;
  /** Visual description from vision model */
  visualDescription?: string;
  /** Multiple selector strategies for redundancy */
  selectors: ElementSelector[];
  /** Bounding box coordinates */
  bounds?: ElementBounds;
  /** Current state (enabled, disabled, loading, etc.) */
  state: ElementState;
  /** Confidence score from identification strategy */
  confidence: number;
  /** Which strategy successfully identified this element */
  identifiedBy: StrategyType;
}

export type ElementType = 
  | 'button' 
  | 'input' 
  | 'textarea' 
  | 'link' 
  | 'dropdown' 
  | 'checkbox' 
  | 'radio' 
  | 'slider'
  | 'menu'
  | 'modal'
  | 'container';

export interface ElementSelector {
  /** Selector type */
  type: SelectorType;
  /** Actual selector string */
  value: string;
  /** Priority for fallback (1 = highest) */
  priority: number;
  /** Whether this selector has been validated */
  validated: boolean;
}

export type SelectorType = 
  | 'css' 
  | 'xpath' 
  | 'text' 
  | 'aria-label' 
  | 'data-testid'
  | 'coordinates'
  | 'owl-natural-language'
  | 'vision-based';

export interface ElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ElementState = 
  | 'idle'
  | 'loading'
  | 'disabled'
  | 'hidden'
  | 'error'
  | 'success'
  | 'typing'
  | 'waiting';

// ============================================================================
// INTERACTION STRATEGIES
// ============================================================================

/**
 * Base interface for all DOM interaction strategies
 */
export interface InteractionStrategy {
  /** Strategy identifier */
  readonly name: StrategyType;
  
  /** Initialize strategy with page context */
  initialize(page: Page, config: StrategyConfig): Promise<void>;
  
  /** Identify elements on the page */
  identifyElements(context: IdentificationContext): Promise<WebElement[]>;
  
  /** Execute an action on an element */
  executeAction(element: WebElement, action: ElementAction): Promise<ActionResult>;
  
  /** Validate element state */
  validateElement(element: WebElement): Promise<ValidationResult>;
  
  /** Clean up resources */
  cleanup(): Promise<void>;
  
  /** Get strategy capability score for given context */
  getCapabilityScore(context: IdentificationContext): number;
}

export type StrategyType = 
  | 'vision-model'
  | 'computer-use'
  | 'natural-language'
  | 'dom-analysis'
  | 'coordinate-based'
  | 'hybrid'
  | 'fallback';

export interface StrategyConfig {
  /** Enable stealth mode */
  stealthMode?: boolean;
  /** Timeout for operations (ms) */
  timeout?: number;
  /** Enable visual debugging */
  visualDebug?: boolean;
  /** API keys for external services */
  apiKeys?: Record<string, string>;
  /** Model configuration */
  modelConfig?: ModelConfig;
}

export interface ModelConfig {
  /** Vision model to use */
  visionModel?: 'glm-4.6v' | 'claude-3.5-sonnet' | 'gpt-4o';
  /** Temperature for AI responses */
  temperature?: number;
  /** Max tokens for completions */
  maxTokens?: number;
}

export interface IdentificationContext {
  /** Page URL */
  url: string;
  /** What we're trying to identify */
  intent: string;
  /** Additional context hints */
  hints?: string[];
  /** Screenshot for vision analysis */
  screenshot?: Buffer;
  /** HTML snapshot */
  htmlSnapshot?: string;
  /** Previous failed attempts */
  previousAttempts?: StrategyType[];
}

// ============================================================================
// ACTIONS & RESULTS
// ============================================================================

export interface ElementAction {
  /** Action type */
  type: ActionType;
  /** Target element */
  element: WebElement;
  /** Action parameters */
  params?: ActionParams;
  /** Expected outcome */
  expectedOutcome?: ExpectedOutcome;
}

export type ActionType = 
  | 'click'
  | 'type'
  | 'select'
  | 'hover'
  | 'drag'
  | 'scroll'
  | 'wait'
  | 'extract';

export interface ActionParams {
  /** Text to type (for type action) */
  text?: string;
  /** Option to select (for select action) */
  option?: string;
  /** Scroll amount (for scroll action) */
  scrollAmount?: number;
  /** Wait duration (for wait action) */
  waitMs?: number;
  /** Press Enter after typing */
  pressEnter?: boolean;
  /** Clear field before typing */
  clearFirst?: boolean;
}

export interface ExpectedOutcome {
  /** Expected state change */
  stateChange?: ElementState;
  /** Expected new elements to appear */
  newElements?: string[];
  /** Expected navigation */
  navigation?: boolean;
  /** Expected text change */
  textChange?: string;
}

export interface ActionResult {
  /** Whether action succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** State before action */
  stateBefore: ElementState;
  /** State after action */
  stateAfter: ElementState;
  /** Execution time (ms) */
  executionTime: number;
  /** Screenshot after action */
  screenshot?: Buffer;
  /** Additional data extracted */
  extractedData?: Record<string, unknown>;
}

export interface ValidationResult {
  /** Is element valid and interactable */
  valid: boolean;
  /** Reason if invalid */
  reason?: string;
  /** Current element state */
  state: ElementState;
  /** Confidence in validation */
  confidence: number;
}

// ============================================================================
// FLOW RECORDING & TESTING
// ============================================================================

/**
 * Represents a complete interaction flow
 */
export interface InteractionFlow {
  /** Flow identifier */
  id: string;
  /** Service this flow belongs to */
  serviceId: string;
  /** Flow name */
  name: string;
  /** Description of what this flow does */
  description: string;
  /** Sequence of steps */
  steps: FlowStep[];
  /** Prerequisites for this flow */
  prerequisites?: FlowPrerequisite[];
  /** Expected outcomes */
  expectedOutcomes: FlowOutcome[];
  /** Last validation result */
  lastValidation?: FlowValidationResult;
  /** Creation timestamp */
  createdAt: string;
  /** Last updated timestamp */
  updatedAt: string;
}

export interface FlowStep {
  /** Step number in sequence */
  stepNumber: number;
  /** Description */
  description: string;
  /** Action to execute */
  action: ElementAction;
  /** Wait for completion conditions */
  completionConditions?: CompletionCondition[];
  /** Retry configuration */
  retryConfig?: RetryConfig;
  /** Fallback strategies if primary fails */
  fallbackStrategies?: StrategyType[];
}

export interface FlowPrerequisite {
  /** Type of prerequisite */
  type: 'authentication' | 'navigation' | 'state' | 'cookies';
  /** Description */
  description: string;
  /** Validation function */
  validate: (context: FlowContext) => Promise<boolean>;
}

export interface FlowOutcome {
  /** What should happen */
  description: string;
  /** How to validate it happened */
  validation: OutcomeValidation;
}

export interface OutcomeValidation {
  /** Type of validation */
  type: 'element-exists' | 'text-contains' | 'state-change' | 'custom';
  /** Validation parameters */
  params: Record<string, unknown>;
  /** Custom validation function */
  customValidator?: (context: FlowContext) => Promise<boolean>;
}

export interface CompletionCondition {
  /** Condition type */
  type: 'element-state' | 'text-appears' | 'timeout' | 'custom';
  /** Parameters */
  params: Record<string, unknown>;
  /** Timeout (ms) */
  timeout: number;
}

export interface RetryConfig {
  /** Maximum retry attempts */
  maxAttempts: number;
  /** Delay between retries (ms) */
  delayMs: number;
  /** Exponential backoff */
  exponentialBackoff?: boolean;
}

export interface FlowContext {
  /** Current page */
  page: Page;
  /** Service configuration */
  service: WebService;
  /** Cookies and session */
  session?: SessionContext;
  /** Previously extracted data */
  data?: Record<string, unknown>;
}

export interface SessionContext {
  /** Session cookies */
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires?: number;
  }>;
  /** Local storage */
  localStorage?: Record<string, string>;
  /** Session storage */
  sessionStorage?: Record<string, string>;
}

// ============================================================================
// SERVICE MANAGEMENT
// ============================================================================

/**
 * Represents a web service (e.g., ChatGPT, Claude, etc.)
 */
export interface WebService {
  /** Unique identifier */
  id: string;
  /** Service name */
  name: string;
  /** Base URL */
  url: string;
  /** Credentials */
  credentials: ServiceCredentials;
  /** Identified features */
  features: ServiceFeature[];
  /** Recorded flows */
  flows: InteractionFlow[];
  /** Session information */
  session?: SessionContext;
  /** Last successful interaction */
  lastUsed?: string;
  /** Service health status */
  status: ServiceStatus;
}

export interface ServiceCredentials {
  /** Username/email */
  username?: string;
  /** Password */
  password?: string;
  /** API key */
  apiKey?: string;
  /** OAuth token */
  oauthToken?: string;
  /** Custom auth headers */
  customHeaders?: Record<string, string>;
}

export interface ServiceFeature {
  /** Feature identifier */
  id: string;
  /** Feature name */
  name: string;
  /** Description */
  description: string;
  /** Type of feature */
  type: FeatureType;
  /** Associated flow for using this feature */
  flowId: string;
  /** Parameters this feature accepts */
  parameters: FeatureParameter[];
  /** Response format */
  responseFormat: ResponseFormat;
}

export type FeatureType = 
  | 'chat'
  | 'completion'
  | 'model-selection'
  | 'settings'
  | 'file-upload'
  | 'custom';

export interface FeatureParameter {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: 'string' | 'number' | 'boolean' | 'file' | 'array';
  /** Is required */
  required: boolean;
  /** Default value */
  defaultValue?: unknown;
  /** Description */
  description?: string;
}

export interface ResponseFormat {
  /** Response type */
  type: 'text' | 'json' | 'stream' | 'binary';
  /** For streaming responses */
  streaming?: boolean;
  /** Schema for structured responses */
  schema?: Record<string, unknown>;
}

export type ServiceStatus = 
  | 'active'
  | 'initializing'
  | 'error'
  | 'disabled'
  | 'rate-limited';

// ============================================================================
// VALIDATION & TESTING
// ============================================================================

export interface FlowValidationResult {
  /** Flow ID */
  flowId: string;
  /** Validation timestamp */
  timestamp: string;
  /** Overall success */
  success: boolean;
  /** Individual step results */
  stepResults: StepValidationResult[];
  /** Total execution time */
  executionTime: number;
  /** Errors encountered */
  errors?: ValidationError[];
  /** Screenshots taken during validation */
  screenshots?: Buffer[];
}

export interface StepValidationResult {
  /** Step number */
  stepNumber: number;
  /** Success */
  success: boolean;
  /** Execution time */
  executionTime: number;
  /** Strategy used */
  strategyUsed: StrategyType;
  /** Fallback attempts */
  fallbackAttempts?: number;
  /** Error if failed */
  error?: string;
}

export interface ValidationError {
  /** Error type */
  type: 'element-not-found' | 'timeout' | 'state-mismatch' | 'network-error' | 'unknown';
  /** Error message */
  message: string;
  /** Step where error occurred */
  stepNumber?: number;
  /** Stack trace */
  stack?: string;
}

// ============================================================================
// OPENAI API COMPATIBILITY
// ============================================================================

export interface OpenAICompatibleRequest {
  /** Model identifier (maps to service + flow) */
  model: string;
  /** Messages to send */
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  /** Temperature */
  temperature?: number;
  /** Max tokens */
  max_tokens?: number;
  /** Streaming */
  stream?: boolean;
  /** Custom parameters */
  [key: string]: unknown;
}

export interface OpenAICompatibleResponse {
  /** Response ID */
  id: string;
  /** Object type */
  object: 'chat.completion' | 'chat.completion.chunk';
  /** Creation timestamp */
  created: number;
  /** Model used */
  model: string;
  /** Choices */
  choices: Array<{
    index: number;
    message?: {
      role: 'assistant';
      content: string;
    };
    delta?: {
      content?: string;
    };
    finish_reason: 'stop' | 'length' | 'error' | null;
  }>;
  /** Token usage */
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
