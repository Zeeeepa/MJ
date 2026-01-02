/**
 * Core types for Web2API
 * All type definitions are directly here for simplicity
 */

export interface WebService {
  id: string;
  serviceId: string;
  name: string;
  url: string;
  status: 'active' | 'inactive' | 'error';
  credentials: ServiceCredentials;
  defaultModel?: string;
  modelAliases?: string[];
  features?: string[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastHealthCheck?: Date;
}

export interface ServiceCredentials {
  email?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  token?: string;
  [key: string]: any;
}

export interface InteractionFlow {
  id: string;
  flowId: string;
  serviceId: string;
  name: string;
  description?: string;
  flowType: 'login' | 'chat' | 'upload' | 'settings' | 'custom';
  steps: FlowStep[];
  prerequisites?: FlowPrerequisite[];
  expectedOutcome?: FlowOutcome;
  lastValidated?: Date;
  validationStatus: 'valid' | 'invalid' | 'unknown';
  validationErrors?: string[];
  averageExecutionTime?: number;
  successRate?: number;
  executionCount: number;
  enabled: boolean;
  priority: number;
}

export interface FlowStep {
  stepNumber: number;
  name: string;
  action: FlowAction;
  conditions?: FlowCondition[];
  retryConfig?: RetryConfig;
}

export interface FlowAction {
  type: 'click' | 'type' | 'select' | 'hover' | 'wait' | 'navigate' | 'extract' | 'execute';
  selector?: string;
  value?: any;
  timeout?: number;
  expectedResult?: any;
}

export interface FlowCondition {
  type: 'element_visible' | 'element_hidden' | 'text_present' | 'url_matches' | 'timeout';
  params: Record<string, any>;
  timeout?: number;
}

export interface FlowPrerequisite {
  type: 'authenticated' | 'cookie_present' | 'element_exists' | 'custom';
  params: Record<string, any>;
}

export interface FlowOutcome {
  successIndicators: string[];
  failureIndicators: string[];
  dataExtraction?: DataExtractionConfig;
}

export interface DataExtractionConfig {
  selectors: Record<string, string>;
  transform?: string;
}

export interface RetryConfig {
  maxAttempts: number;
  delay: number;
  backoff: 'linear' | 'exponential';
}

export interface BrowserSession {
  id: string;
  sessionId: string;
  serviceId: string;
  status: 'active' | 'idle' | 'closed' | 'error';
  isAuthenticated: boolean;
  browserProfile?: BrowserProfile;
  cookies?: any[];
  localStorage?: Record<string, any>;
  createdAt: Date;
  lastActivity: Date;
  expiresAt?: Date;
  requestCount: number;
  errorCount: number;
}

export interface BrowserProfile {
  userAgent: string;
  viewport: { width: number; height: number };
  timezone: string;
  locale: string;
  fingerprint: Record<string, any>;
}

export interface ModelAlias {
  id: string;
  alias: string;
  serviceId: string;
  targetModel?: string;
  defaultSystemPrompt?: string;
  parameters?: Record<string, any>;
  enabled: boolean;
  createdAt: Date;
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIChatRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  [key: string]: any;
}

export interface OpenAIChatResponse {
  id: string;
  object: 'chat.completion' | 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message?: OpenAIMessage;
    delta?: Partial<OpenAIMessage>;
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIModel {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
}

export interface ServiceRegistrationRequest {
  name: string;
  url: string;
  credentials: ServiceCredentials;
  defaultModel?: string;
  modelAliases?: string[];
}

export interface FlowDiscoveryResult {
  flows: InteractionFlow[];
  errors: string[];
  duration: number;
}
