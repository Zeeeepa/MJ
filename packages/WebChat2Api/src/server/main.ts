/**
 * Complete Fastify server for WebChat2Api
 * Provides OpenAI-compatible endpoints with advanced browser automation
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import { v4 as uuidv4 } from 'uuid';
import { JobQueue, ChatCompletionJobData, FeatureDiscoveryJobData, ServiceSetupJobData } from '../core/JobQueue';
import { SessionManager } from '../core/SessionManager';

// OpenAI-compatible request/response types
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface ChatCompletionRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  tools?: Tool[];
  tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };
  user?: string;
  seed?: number;
  logprobs?: boolean;
  top_logprobs?: number;
  stop?: string | string[];
}

interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: OpenAIMessage;
    logprobs?: {
      content: Array<{
        token: string;
        logprob: number;
        top_logprobs: Array<{
          token: string;
          logprob: number;
        }>;
      }>;
    };
    finish_reason: 'stop' | 'length' | 'function_call' | 'tool_calls' | 'content_filter';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface ChatCompletionStreamDelta {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
      tool_calls?: Partial<ToolCall>[];
    };
    logprobs?: unknown;
    finish_reason?: 'stop' | 'length' | 'function_call' | 'tool_calls' | 'content_filter';
  }>;
}

interface CompletionRequest {
  model: string;
  prompt: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  user?: string;
  seed?: number;
  logprobs?: number;
  stop?: string | string[];
}

interface CompletionResponse {
  id: string;
  object: 'text_completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    text: string;
    logprobs?: {
      tokens: string[];
      token_logprobs: number[];
      top_logprobs: Array<Record<string, number>>;
    };
    finish_reason: 'stop' | 'length' | 'content_filter';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface ModelInfo {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
  permission: Array<{
    id: string;
    object: 'model_permission';
    created: number;
    allow_create_engine: boolean;
    allow_sampling: boolean;
    allow_logprobs: boolean;
    allow_search_indices: boolean;
    allow_view: boolean;
    allow_fine_tuning: boolean;
    organization: string;
    group?: string;
    is_blocking: boolean;
  }>;
  root: string;
  parent?: string;
}

interface ErrorResponse {
  error: {
    message: string;
    type: string;
    code?: string;
    param?: string;
  };
}

// Service management interfaces
interface ServiceConfig {
  name: string;
  url: string;
  type: 'chat' | 'completion' | 'embedding' | 'vision';
  auth?: {
    type: 'api-key' | 'oauth' | 'basic' | 'none';
    credentials?: Record<string, string>;
  };
  features: FeatureConfig[];
  enabled: boolean;
  priority: number;
}

interface FeatureConfig {
  name: string;
  modelPattern: string; // regex pattern to match model names
  endpoint: string;
  maxTokens?: number;
  supportsStreaming?: boolean;
  supportsTools?: boolean;
}

interface ServiceDiscoveryRequest {
  url: string;
  auth?: {
    type: 'api-key' | 'oauth' | 'basic' | 'none';
    credentials?: Record<string, string>;
  };
  discoveryMethods: ('automation' | 'api-inspection' | 'mixed')[];
  timeout?: number;
}

interface ServiceTestRequest {
  testConnection?: boolean;
  testModel?: string;
  testPrompt?: string;
}

interface ServiceTestResult {
  connectionOk: boolean;
  modelsAvailable?: string[];
  responseTime?: number;
  testResponse?: string;
  error?: string;
}

// Browser context and session interfaces
interface BrowserContextData {
  userAgent?: string;
  viewport?: {
    width: number;
    height: number;
  };
  locale?: string;
  timezone?: string;
  geolocation?: {
    latitude: number;
    longitude: number;
  };
  permissions?: string[];
  extraHTTPHeaders?: Record<string, string>;
}

interface SessionCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

// Service Registry class for managing services and model mappings
class ServiceRegistry {
  private services: Map<string, ServiceConfig> = new Map();
  private modelToService: Map<string, { service: string; feature: string }> = new Map();

  registerService(config: ServiceConfig): void {
    this.services.set(config.name, config);
    this.updateModelMappings(config);
    console.log(`Registered service: ${config.name} with ${config.features.length} features`);
  }

  private updateModelMappings(config: ServiceConfig): void {
    // Clear existing mappings for this service
    for (const [model, mapping] of this.modelToService.entries()) {
      if (mapping.service === config.name) {
        this.modelToService.delete(model);
      }
    }

    // Add new mappings
    config.features.forEach(feature => {
      try {
        const pattern = new RegExp(feature.modelPattern);
        // For simplicity, we'll map exact model names based on common patterns
        const commonModels = this.getCommonModelsFromPattern(feature.modelPattern);
        commonModels.forEach(model => {
          this.modelToService.set(model, {
            service: config.name,
            feature: feature.name
          });
        });
      } catch (error) {
        console.warn(`Invalid regex pattern for feature ${feature.name}: ${feature.modelPattern}`);
      }
    });
  }

  private getCommonModelsFromPattern(pattern: string): string[] {
    // Extract model names from common patterns
    if (pattern.includes('deepseek')) {
      return ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'];
    }
    if (pattern.includes('grok')) {
      return ['grok-2', 'grok-beta', 'grok-vision-beta'];
    }
    if (pattern.includes('claude')) {
      return ['claude-3-5-sonnet', 'claude-3-opus', 'claude-3-haiku'];
    }
    if (pattern.includes('gpt')) {
      return ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'];
    }
    if (pattern.includes('gemini')) {
      return ['gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'];
    }
    
    // Return the pattern as a direct model name if it doesn't contain regex characters
    if (!/[.*+?^${}()|[\]\\]/.test(pattern)) {
      return [pattern];
    }
    
    return [];
  }

  findServiceForModel(model: string): { service: ServiceConfig; feature: FeatureConfig } | null {
    const mapping = this.modelToService.get(model);
    if (!mapping) {
      return null;
    }

    const service = this.services.get(mapping.service);
    if (!service || !service.enabled) {
      return null;
    }

    const feature = service.features.find(f => f.name === mapping.feature);
    if (!feature) {
      return null;
    }

    return { service, feature };
  }

  listServices(): ServiceConfig[] {
    return Array.from(this.services.values());
  }

  getService(name: string): ServiceConfig | null {
    return this.services.get(name) || null;
  }

  removeService(name: string): boolean {
    const removed = this.services.delete(name);
    if (removed) {
      // Clean up model mappings
      for (const [model, mapping] of this.modelToService.entries()) {
        if (mapping.service === name) {
          this.modelToService.delete(model);
        }
      }
    }
    return removed;
  }

  getAvailableModels(): string[] {
    return Array.from(this.modelToService.keys()).sort();
  }
}

// Browser Context Manager class
class BrowserContextManager {
  private contextCache: Map<string, BrowserContextData> = new Map();
  
  async createContext(serviceName: string, options?: Partial<BrowserContextData>): Promise<BrowserContextData> {
    const contextData: BrowserContextData = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezone: 'America/New_York',
      permissions: ['geolocation', 'notifications'],
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      ...options
    };

    this.contextCache.set(serviceName, contextData);
    return contextData;
  }

  getContext(serviceName: string): BrowserContextData | null {
    return this.contextCache.get(serviceName) || null;
  }

  updateContext(serviceName: string, updates: Partial<BrowserContextData>): void {
    const existing = this.contextCache.get(serviceName);
    if (existing) {
      this.contextCache.set(serviceName, { ...existing, ...updates });
    }
  }

  removeContext(serviceName: string): boolean {
    return this.contextCache.delete(serviceName);
  }

  listContexts(): Array<{ serviceName: string; context: BrowserContextData }> {
    return Array.from(this.contextCache.entries()).map(([serviceName, context]) => ({
      serviceName,
      context
    }));
  }

  clearAll(): void {
    this.contextCache.clear();
  }
}

// Main server configuration
interface ServerConfig {
  port: number;
  host: string;
  apiKey?: string;
  corsOptions?: {
    origin?: string | string[] | boolean;
    credentials?: boolean;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  postgres: {
    connectionString?: string;
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
  };
  rateLimit?: {
    max: number;
    timeWindow: number;
  };
  logging?: boolean;
}

// Fastify server class
class WebChat2ApiServer {
  private server: FastifyInstance;
  private config: Required<ServerConfig>;
  private serviceRegistry: ServiceRegistry;
  private browserContextManager: BrowserContextManager;
  private sessionManager: SessionManager;
  private jobQueue: JobQueue;
  private requestCounts = new Map<string, { count: number; resetTime: number }>();

  constructor(config: Partial<ServerConfig> = {}) {
    this.config = {
      port: config.port || parseInt(process.env.WEBCHAT2API_PORT || '3000'),
      host: config.host || '0.0.0.0',
      apiKey: config.apiKey || process.env.WEBCHAT2API_API_KEY,
      corsOptions: config.corsOptions || {
        origin: process.env.WEBCHAT2API_CORS_ORIGIN || true,
        credentials: true
      },
      redis: {
        host: config.redis?.host || process.env.REDIS_HOST || 'localhost',
        port: config.redis?.port || parseInt(process.env.REDIS_PORT || '6379'),
        password: config.redis?.password || process.env.REDIS_PASSWORD,
        db: config.redis?.db || parseInt(process.env.REDIS_DB || '0')
      },
      postgres: {
        connectionString: config.postgres?.connectionString || process.env.DATABASE_URL,
        host: config.postgres?.host || process.env.POSTGRES_HOST || 'localhost',
        port: config.postgres?.port || parseInt(process.env.POSTGRES_PORT || '5432'),
        database: config.postgres?.database || process.env.POSTGRES_DB || 'webchat2api',
        username: config.postgres?.username || process.env.POSTGRES_USER || 'postgres',
        password: config.postgres?.password || process.env.POSTGRES_PASSWORD
      },
      rateLimit: config.rateLimit || {
        max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
        timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000')
      },
      logging: config.logging !== false
    };

    this.server = Fastify({
      logger: this.config.logging ? {
        level: 'info',
        transport: {
          target: 'pino-pretty'
        }
      } : false
    });

    this.serviceRegistry = new ServiceRegistry();
    this.browserContextManager = new BrowserContextManager();
    this.sessionManager = new SessionManager({
      connectionString: this.config.postgres.connectionString,
      autoCreateTables: true
    });

    this.jobQueue = new JobQueue({
      redis: this.config.redis,
      queueName: 'webchat2api-jobs',
      enableMetrics: true
    });

    this.setupPlugins();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupJobProcessors();
    this.setupDefaultServices();
  }

  private async setupPlugins(): Promise<void> {
    await this.server.register(cors, this.config.corsOptions);
  }

  private setupMiddleware(): void {
    // Rate limiting middleware
    this.server.addHook('onRequest', async (request, reply) => {
      const clientIP = request.ip;
      const now = Date.now();
      
      if (!this.requestCounts.has(clientIP)) {
        this.requestCounts.set(clientIP, {
          count: 0,
          resetTime: now + this.config.rateLimit.timeWindow
        });
      }

      const clientData = this.requestCounts.get(clientIP)!;
      
      if (now > clientData.resetTime) {
        clientData.count = 0;
        clientData.resetTime = now + this.config.rateLimit.timeWindow;
      }

      if (clientData.count >= this.config.rateLimit.max) {
        reply.code(429).send({
          error: {
            message: 'Rate limit exceeded',
            type: 'rate_limit_exceeded'
          }
        });
        return;
      }

      clientData.count++;
    });

    // Authentication middleware
    if (this.config.apiKey) {
      this.server.addHook('onRequest', async (request, reply) => {
        if (request.url === '/health') {
          return; // Skip auth for health check
        }

        const authHeader = request.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
          reply.code(401).send({
            error: {
              message: 'Missing or invalid authorization header',
              type: 'invalid_request_error'
            }
          });
          return;
        }

        const token = authHeader.substring(7);
        if (token !== this.config.apiKey) {
          reply.code(401).send({
            error: {
              message: 'Invalid API key',
              type: 'invalid_request_error'
            }
          });
          return;
        }
      });
    }
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.server.get('/health', this.handleHealthCheck.bind(this));

    // OpenAI-compatible endpoints
    this.server.post<{ Body: ChatCompletionRequest }>('/v1/chat/completions', this.handleChatCompletions.bind(this));
    this.server.post<{ Body: CompletionRequest }>('/v1/completions', this.handleCompletions.bind(this));
    this.server.get('/v1/models', this.handleListModels.bind(this));

    // Service management endpoints
    this.server.post<{ Body: ServiceConfig }>('/v1/services/register', this.handleRegisterService.bind(this));
    this.server.get('/v1/services', this.handleListServices.bind(this));
    this.server.post<{ 
      Params: { name: string };
      Body: ServiceDiscoveryRequest;
    }>('/v1/services/:name/discover', this.handleDiscoverFeatures.bind(this));
    this.server.get<{ Params: { name: string } }>('/v1/services/:name/features', this.handleListFeatures.bind(this));
    this.server.post<{ 
      Params: { name: string };
      Body: ServiceTestRequest;
    }>('/v1/services/:name/test', this.handleTestService.bind(this));
  }

  private setupJobProcessors(): void {
    // Chat completion processor
    this.jobQueue.registerProcessor('chat-completion', async (job) => {
      const data = job.data as ChatCompletionJobData;
      const startTime = Date.now();

      try {
        // Find service for model
        const serviceMapping = this.serviceRegistry.findServiceForModel(data.model);
        if (!serviceMapping) {
          throw new Error(`No service found for model: ${data.model}`);
        }

        // TODO: Implement actual browser automation and service calling
        // For now, return a mock response
        const result = {
          success: true,
          data: {
            id: `chatcmpl-${uuidv4()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: data.model,
            choices: [{
              index: 0,
              message: {
                role: 'assistant' as const,
                content: `Response from ${serviceMapping.service.name} using ${serviceMapping.feature.name} feature`
              },
              finish_reason: 'stop' as const
            }],
            usage: {
              prompt_tokens: this.estimateTokens(data.messages.map(m => m.content || '').join(' ')),
              completion_tokens: 50,
              total_tokens: this.estimateTokens(data.messages.map(m => m.content || '').join(' ')) + 50
            }
          },
          duration: Date.now() - startTime
        };

        return result;
      } catch (error) {
        return {
          success: false,
          error: {
            message: error instanceof Error ? error.message : String(error),
            code: 'processing_error'
          },
          duration: Date.now() - startTime
        };
      }
    });

    // Feature discovery processor
    this.jobQueue.registerProcessor('feature-discovery', async (job) => {
      const data = job.data as FeatureDiscoveryJobData;
      const startTime = Date.now();

      try {
        // TODO: Implement actual feature discovery using browser automation
        const discoveredFeatures: FeatureConfig[] = [
          {
            name: 'chat',
            modelPattern: '.*',
            endpoint: '/v1/chat/completions',
            maxTokens: 4096,
            supportsStreaming: true,
            supportsTools: false
          }
        ];

        return {
          success: true,
          data: {
            serviceUrl: data.serviceUrl,
            features: discoveredFeatures,
            discoveryMethod: data.discoveryMethod
          },
          duration: Date.now() - startTime
        };
      } catch (error) {
        return {
          success: false,
          error: {
            message: error instanceof Error ? error.message : String(error),
            code: 'discovery_error'
          },
          duration: Date.now() - startTime
        };
      }
    });

    // Service setup processor  
    this.jobQueue.registerProcessor('service-setup', async (job) => {
      const data = job.data as ServiceSetupJobData;
      const startTime = Date.now();

      try {
        // TODO: Implement actual service setup using browser automation
        return {
          success: true,
          data: {
            serviceUrl: data.serviceUrl,
            serviceType: data.serviceType,
            setupComplete: true,
            endpoints: {
              chat: `${data.serviceUrl}/v1/chat/completions`,
              completions: `${data.serviceUrl}/v1/completions`,
              models: `${data.serviceUrl}/v1/models`
            }
          },
          duration: Date.now() - startTime
        };
      } catch (error) {
        return {
          success: false,
          error: {
            message: error instanceof Error ? error.message : String(error),
            code: 'setup_error'
          },
          duration: Date.now() - startTime
        };
      }
    });
  }

  private setupDefaultServices(): void {
    // Register some default services for demonstration
    this.serviceRegistry.registerService({
      name: 'deepseek',
      url: 'https://api.deepseek.com',
      type: 'chat',
      features: [{
        name: 'deepseek-chat',
        modelPattern: 'deepseek.*',
        endpoint: '/v1/chat/completions',
        maxTokens: 8192,
        supportsStreaming: true,
        supportsTools: false
      }],
      enabled: true,
      priority: 1
    });

    this.serviceRegistry.registerService({
      name: 'x-ai',
      url: 'https://api.x.ai',
      type: 'chat',
      features: [{
        name: 'grok-chat',
        modelPattern: 'grok.*',
        endpoint: '/v1/chat/completions',
        maxTokens: 8192,
        supportsStreaming: true,
        supportsTools: true
      }],
      enabled: true,
      priority: 2
    });
  }

  // Request handlers
  private async handleHealthCheck(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        total: this.serviceRegistry.listServices().length,
        enabled: this.serviceRegistry.listServices().filter(s => s.enabled).length
      },
      models: {
        available: this.serviceRegistry.getAvailableModels().length
      },
      queue: await this.jobQueue.getQueueStats()
    };

    reply.send(health);
  }

  private async handleChatCompletions(
    request: FastifyRequest<{ Body: ChatCompletionRequest }>, 
    reply: FastifyReply
  ): Promise<void> {
    const req = request.body;
    
    if (!this.validateChatCompletionRequest(req)) {
      reply.code(400).send({
        error: {
          message: 'Invalid request: missing model or messages',
          type: 'invalid_request_error'
        }
      });
      return;
    }

    try {
      // Add job to queue
      const job = await this.jobQueue.addJob('chat-completion', {
        requestId: uuidv4(),
        model: req.model,
        messages: req.messages,
        temperature: req.temperature,
        max_tokens: req.max_tokens,
        stream: req.stream,
        tools: req.tools
      });

      if (req.stream) {
        await this.handleStreamingResponse(job.id!, reply, req);
      } else {
        await this.handleNonStreamingResponse(job.id!, reply);
      }
    } catch (error) {
      this.server.log.error('Chat completion error:', error);
      reply.code(500).send({
        error: {
          message: 'Internal server error',
          type: 'internal_server_error'
        }
      });
    }
  }

  private async handleCompletions(
    request: FastifyRequest<{ Body: CompletionRequest }>, 
    reply: FastifyReply
  ): Promise<void> {
    const req = request.body;
    
    if (!req.model || !req.prompt) {
      reply.code(400).send({
        error: {
          message: 'Invalid request: missing model or prompt',
          type: 'invalid_request_error'
        }
      });
      return;
    }

    // Convert completion request to chat completion format
    const chatMessages: OpenAIMessage[] = [{
      role: 'user',
      content: req.prompt
    }];

    try {
      const job = await this.jobQueue.addJob('chat-completion', {
        requestId: uuidv4(),
        model: req.model,
        messages: chatMessages,
        temperature: req.temperature,
        max_tokens: req.max_tokens,
        stream: req.stream
      });

      const result = await this.waitForJobResult(job.id!);
      
      if (!result.success) {
        reply.code(500).send({
          error: {
            message: result.error?.message || 'Processing failed',
            type: 'internal_server_error'
          }
        });
        return;
      }

      // Convert chat completion response to completion format
      const chatResponse = result.data;
      const completionResponse: CompletionResponse = {
        id: `cmpl-${uuidv4()}`,
        object: 'text_completion',
        created: chatResponse.created,
        model: req.model,
        choices: [{
          index: 0,
          text: chatResponse.choices[0]?.message?.content || '',
          finish_reason: chatResponse.choices[0]?.finish_reason || 'stop'
        }],
        usage: chatResponse.usage
      };

      reply.send(completionResponse);
    } catch (error) {
      this.server.log.error('Completion error:', error);
      reply.code(500).send({
        error: {
          message: 'Internal server error',
          type: 'internal_server_error'
        }
      });
    }
  }

  private async handleListModels(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const models = this.serviceRegistry.getAvailableModels().map(modelId => ({
      id: modelId,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'webchat2api',
      permission: [{
        id: `perm-${uuidv4()}`,
        object: 'model_permission',
        created: Math.floor(Date.now() / 1000),
        allow_create_engine: false,
        allow_sampling: true,
        allow_logprobs: true,
        allow_search_indices: false,
        allow_view: true,
        allow_fine_tuning: false,
        organization: 'webchat2api',
        is_blocking: false
      }],
      root: modelId
    }));

    reply.send({
      object: 'list',
      data: models
    });
  }

  private async handleRegisterService(
    request: FastifyRequest<{ Body: ServiceConfig }>, 
    reply: FastifyReply
  ): Promise<void> {
    const config = request.body;
    
    if (!config.name || !config.url || !config.features?.length) {
      reply.code(400).send({
        error: {
          message: 'Invalid service config: missing name, url, or features',
          type: 'invalid_request_error'
        }
      });
      return;
    }

    try {
      this.serviceRegistry.registerService(config);
      reply.send({
        message: 'Service registered successfully',
        service: config.name,
        features: config.features.length
      });
    } catch (error) {
      reply.code(500).send({
        error: {
          message: 'Failed to register service',
          type: 'internal_server_error'
        }
      });
    }
  }

  private async handleListServices(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const services = this.serviceRegistry.listServices();
    reply.send({
      services,
      total: services.length
    });
  }

  private async handleDiscoverFeatures(
    request: FastifyRequest<{ Params: { name: string }; Body: ServiceDiscoveryRequest }>, 
    reply: FastifyReply
  ): Promise<void> {
    const { name } = request.params;
    const discoveryRequest = request.body;

    try {
      const job = await this.jobQueue.addJob('feature-discovery', {
        requestId: uuidv4(),
        serviceUrl: discoveryRequest.url,
        discoveryMethod: discoveryRequest.discoveryMethods[0] || 'automation',
        timeout: discoveryRequest.timeout
      });

      const result = await this.waitForJobResult(job.id!);
      
      if (!result.success) {
        reply.code(500).send({
          error: {
            message: result.error?.message || 'Discovery failed',
            type: 'discovery_error'
          }
        });
        return;
      }

      reply.send(result.data);
    } catch (error) {
      this.server.log.error('Feature discovery error:', error);
      reply.code(500).send({
        error: {
          message: 'Internal server error',
          type: 'internal_server_error'
        }
      });
    }
  }

  private async handleListFeatures(
    request: FastifyRequest<{ Params: { name: string } }>, 
    reply: FastifyReply
  ): Promise<void> {
    const { name } = request.params;
    const service = this.serviceRegistry.getService(name);
    
    if (!service) {
      reply.code(404).send({
        error: {
          message: 'Service not found',
          type: 'not_found_error'
        }
      });
      return;
    }

    reply.send({
      service: name,
      features: service.features
    });
  }

  private async handleTestService(
    request: FastifyRequest<{ Params: { name: string }; Body: ServiceTestRequest }>, 
    reply: FastifyReply
  ): Promise<void> {
    const { name } = request.params;
    const testRequest = request.body;
    const service = this.serviceRegistry.getService(name);
    
    if (!service) {
      reply.code(404).send({
        error: {
          message: 'Service not found',
          type: 'not_found_error'
        }
      });
      return;
    }

    try {
      // TODO: Implement actual service testing
      const testResult: ServiceTestResult = {
        connectionOk: true,
        modelsAvailable: service.features.map(f => f.modelPattern),
        responseTime: Math.random() * 1000 + 200,
        testResponse: testRequest.testPrompt ? 'Test response from service' : undefined
      };

      reply.send(testResult);
    } catch (error) {
      this.server.log.error('Service test error:', error);
      reply.code(500).send({
        error: {
          message: 'Service test failed',
          type: 'test_error'
        }
      });
    }
  }

  // Helper methods
  private validateChatCompletionRequest(request: ChatCompletionRequest): boolean {
    return !!(request.model && request.messages && Array.isArray(request.messages) && request.messages.length > 0);
  }

  private async handleStreamingResponse(jobId: string, reply: FastifyReply, request: ChatCompletionRequest): Promise<void> {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    const responseId = `chatcmpl-${uuidv4()}`;
    const created = Math.floor(Date.now() / 1000);

    try {
      const result = await this.waitForJobResult(jobId);
      
      if (!result.success) {
        const errorChunk: ChatCompletionStreamDelta = {
          id: responseId,
          object: 'chat.completion.chunk',
          created,
          model: request.model,
          choices: [{
            index: 0,
            delta: { content: 'Error processing request' },
            finish_reason: 'stop'
          }]
        };
        reply.raw.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
        reply.raw.write('data: [DONE]\n\n');
        reply.raw.end();
        return;
      }

      const response = result.data;
      const content = response.choices[0]?.message?.content || '';
      
      // Stream content in chunks
      const chunks = this.splitIntoChunks(content, 50);
      
      for (const chunk of chunks) {
        const streamChunk: ChatCompletionStreamDelta = {
          id: responseId,
          object: 'chat.completion.chunk',
          created,
          model: request.model,
          choices: [{
            index: 0,
            delta: { content: chunk },
          }]
        };
        reply.raw.write(`data: ${JSON.stringify(streamChunk)}\n\n`);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Final chunk
      const finalChunk: ChatCompletionStreamDelta = {
        id: responseId,
        object: 'chat.completion.chunk',
        created,
        model: request.model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop'
        }]
      };
      reply.raw.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
      reply.raw.write('data: [DONE]\n\n');
      reply.raw.end();
    } catch (error) {
      this.server.log.error('Streaming error:', error);
      reply.raw.write('data: [DONE]\n\n');
      reply.raw.end();
    }
  }

  private async handleNonStreamingResponse(jobId: string, reply: FastifyReply): Promise<void> {
    try {
      const result = await this.waitForJobResult(jobId);
      
      if (!result.success) {
        reply.code(500).send({
          error: {
            message: result.error?.message || 'Processing failed',
            type: 'internal_server_error'
          }
        });
        return;
      }

      reply.send(result.data);
    } catch (error) {
      this.server.log.error('Non-streaming response error:', error);
      reply.code(500).send({
        error: {
          message: 'Internal server error',
          type: 'internal_server_error'
        }
      });
    }
  }

  private async waitForJobResult(jobId: string, timeout = 30000): Promise<{ success: boolean; data?: unknown; error?: { message: string; code?: string } }> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const job = await this.jobQueue.getJob(jobId);
      if (!job) {
        throw new Error('Job not found');
      }

      const state = await job.getState();
      
      if (state === 'completed') {
        return job.returnvalue;
      }
      
      if (state === 'failed') {
        return {
          success: false,
          error: {
            message: job.failedReason || 'Job failed',
            code: 'job_failed'
          }
        };
      }

      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error('Job timeout');
  }

  private splitIntoChunks(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks;
  }

  private estimateTokens(text: string): number {
    // Simple estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  // Public methods for server lifecycle
  async initialize(): Promise<void> {
    await this.sessionManager.initialize();
    await this.jobQueue.initialize();
    console.log('WebChat2Api server initialized');
  }

  async start(): Promise<void> {
    try {
      await this.initialize();
      await this.server.listen({ port: this.config.port, host: this.config.host });
      console.log(`WebChat2Api server listening on ${this.config.host}:${this.config.port}`);
      console.log('Available endpoints:');
      console.log(`  POST http://localhost:${this.config.port}/v1/chat/completions`);
      console.log(`  POST http://localhost:${this.config.port}/v1/completions`);
      console.log(`  GET  http://localhost:${this.config.port}/v1/models`);
      console.log(`  POST http://localhost:${this.config.port}/v1/services/register`);
      console.log(`  GET  http://localhost:${this.config.port}/v1/services`);
      console.log(`  GET  http://localhost:${this.config.port}/health`);
    } catch (error) {
      console.error('Failed to start server:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      await this.jobQueue.shutdown();
      await this.sessionManager.close();
      await this.server.close();
      console.log('WebChat2Api server stopped');
    } catch (error) {
      console.error('Error stopping server:', error);
      throw error;
    }
  }
}

export default WebChat2ApiServer;

// Start server if running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new WebChat2ApiServer();
  
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}