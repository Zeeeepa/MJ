/**
 * Web Chat to API Gateway - Type Definitions
 * 
 * Converts web-only chat interfaces into OpenAI-compatible API endpoints
 */

/**
 * Service credentials for web chat authentication
 */
export interface ServiceCredentials {
  serviceUrl: string;
  email?: string;
  username?: string;
  password: string;
  apiKey?: string; // For services that support API keys
  additionalHeaders?: Record<string, string>;
}

/**
 * Session state for maintaining web chat connections
 */
export interface ChatSession {
  sessionId: string;
  serviceType: string;
  credentials: ServiceCredentials;
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires?: number;
  }>;
  tokens?: {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  };
  conversationId?: string;
  messageHistory: Message[];
  createdAt: Date;
  lastUsedAt: Date;
  metadata?: Record<string, any>;
}

/**
 * Message format (unified across services)
 */
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string | MessageContent[];
  name?: string;
  metadata?: Record<string, any>;
}

/**
 * Multimodal message content
 */
export type MessageContent = 
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }
  | { type: 'video_url'; video_url: { url: string } }
  | { type: 'file'; file: { url: string; mime_type?: string } };

/**
 * OpenAI-compatible chat completion request
 */
export interface ChatCompletionRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stop?: string | string[];
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  user?: string;
  
  // Extended for web gateway
  service?: string; // Specific service to use (k2thinking, qwen, etc.)
  agent_type?: 'general' | 'coding' | 'research' | 'vision';
}

/**
 * OpenAI-compatible chat completion response
 */
export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion' | 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message?: Message;
    delta?: Partial<Message>;
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Service adapter interface
 */
export interface WebChatAdapter {
  /**
   * Service type identifier (e.g., 'k2thinking', 'qwen')
   */
  readonly serviceType: string;
  
  /**
   * Initialize and authenticate session
   */
  login(credentials: ServiceCredentials): Promise<ChatSession>;
  
  /**
   * Send message and get response
   */
  sendMessage(session: ChatSession, messages: Message[]): Promise<string>;
  
  /**
   * Send message with streaming response
   */
  sendMessageStream(
    session: ChatSession,
    messages: Message[],
    onChunk: (chunk: string) => void
  ): Promise<void>;
  
  /**
   * Upload media (image, video, file)
   */
  uploadMedia(session: ChatSession, content: MessageContent): Promise<string>;
  
  /**
   * Validate session is still active
   */
  validateSession(session: ChatSession): Promise<boolean>;
  
  /**
   * Refresh session if expired
   */
  refreshSession(session: ChatSession): Promise<ChatSession>;
  
  /**
   * Clean up session resources
   */
  closeSession(session: ChatSession): Promise<void>;
  
  /**
   * Get service capabilities
   */
  getCapabilities(): ServiceCapabilities;
}

/**
 * Service capabilities
 */
export interface ServiceCapabilities {
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsVideo: boolean;
  supportsFiles: boolean;
  maxTokens?: number;
  maxImageSize?: number;
  maxVideoSize?: number;
  supportedFileTypes?: string[];
  rateLimits?: {
    requestsPerMinute?: number;
    requestsPerDay?: number;
  };
}

/**
 * Browser automation context
 */
export interface BrowserContext {
  browserId: string;
  page: any; // Playwright Page
  context: any; // Playwright BrowserContext
  createdAt: Date;
  lastUsedAt: Date;
  isActive: boolean;
}

/**
 * Service configuration
 */
export interface ServiceConfig {
  serviceType: string;
  enabled: boolean;
  maxConcurrentSessions: number;
  sessionTimeout: number; // milliseconds
  retryAttempts: number;
  retryDelay: number; // milliseconds
  browserConfig?: {
    headless: boolean;
    viewport?: { width: number; height: number };
    userAgent?: string;
  };
}

/**
 * Gateway statistics
 */
export interface GatewayStats {
  totalRequests: number;
  activeSessions: number;
  averageResponseTime: number;
  errorRate: number;
  serviceStats: Record<string, {
    requests: number;
    errors: number;
    avgResponseTime: number;
  }>;
}

/**
 * Adapter factory configuration
 */
export interface AdapterFactoryConfig {
  services: ServiceConfig[];
  browserPoolSize: number;
  sessionCacheSize: number;
}

/**
 * Request context
 */
export interface RequestContext {
  requestId: string;
  userId?: string;
  apiKey?: string;
  startTime: Date;
  service?: string;
  agentType?: string;
}

/**
 * Error types
 */
export class WebChatGatewayError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'WebChatGatewayError';
  }
}

export class AuthenticationError extends WebChatGatewayError {
  constructor(message: string, details?: any) {
    super(message, 'AUTHENTICATION_ERROR', 401, details);
    this.name = 'AuthenticationError';
  }
}

export class SessionExpiredError extends WebChatGatewayError {
  constructor(message: string, details?: any) {
    super(message, 'SESSION_EXPIRED', 401, details);
    this.name = 'SessionExpiredError';
  }
}

export class RateLimitError extends WebChatGatewayError {
  constructor(message: string, details?: any) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, details);
    this.name = 'RateLimitError';
  }
}

export class ServiceUnavailableError extends WebChatGatewayError {
  constructor(message: string, details?: any) {
    super(message, 'SERVICE_UNAVAILABLE', 503, details);
    this.name = 'ServiceUnavailableError';
  }
}

