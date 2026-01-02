import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { DaytonaSandboxManager, SandboxInfo } from '../sandbox/DaytonaSandboxManager.js';

// OpenAI-compatible API types
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

// Strategy and Flow interfaces (placeholders for future implementation)
interface StrategyType {
    name: 'Vision' | 'ComputerUse' | 'NaturalLanguage' | 'DOM' | 'Stealth';
    priority: number;
    enabled: boolean;
}

interface ElementIdentificationRequest {
    url: string;
    selector: string;
    description: string;
    strategy?: StrategyType['name'];
}

interface ElementIdentificationResult {
    success: boolean;
    element?: {
        selector: string;
        coordinates?: { x: number; y: number };
        text?: string;
        attributes?: Record<string, string>;
    };
    strategy: StrategyType['name'];
    error?: string;
}

interface FlowStep {
    type: 'navigate' | 'click' | 'type' | 'wait' | 'extract';
    target?: string;
    value?: string;
    options?: Record<string, unknown>;
}

interface FlowExecutionRequest {
    url: string;
    steps: FlowStep[];
    sandboxId?: string;
}

interface FlowExecutionResult {
    success: boolean;
    results: Record<string, unknown>;
    screenshots?: string[];
    error?: string;
}

// Placeholder strategy classes
class StrategyOrchestrator {
    private strategies: StrategyType[] = [
        { name: 'Vision', priority: 1, enabled: true },
        { name: 'ComputerUse', priority: 2, enabled: true },
        { name: 'NaturalLanguage', priority: 3, enabled: true },
        { name: 'DOM', priority: 4, enabled: true },
        { name: 'Stealth', priority: 5, enabled: true }
    ];

    async identifyElement(request: ElementIdentificationRequest): Promise<ElementIdentificationResult> {
        // Placeholder implementation - would integrate with actual strategy providers
        const selectedStrategy = request.strategy || this.selectBestStrategy(request);
        
        // Simulate strategy execution
        await this.delay(Math.random() * 1000 + 500);
        
        return {
            success: true,
            element: {
                selector: request.selector,
                coordinates: { x: 100, y: 200 },
                text: `Element found using ${selectedStrategy} strategy`,
                attributes: { id: 'example', class: 'found-element' }
            },
            strategy: selectedStrategy
        };
    }

    private selectBestStrategy(request: ElementIdentificationRequest): StrategyType['name'] {
        // Strategy selection logic would go here
        // For now, return the highest priority enabled strategy
        const enabledStrategies = this.strategies.filter(s => s.enabled);
        enabledStrategies.sort((a, b) => a.priority - b.priority);
        return enabledStrategies[0]?.name || 'DOM';
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

class FlowManager {
    async executeFlow(request: FlowExecutionRequest): Promise<FlowExecutionResult> {
        // Placeholder implementation - would integrate with browser automation
        await this.delay(Math.random() * 2000 + 1000);
        
        return {
            success: true,
            results: {
                url: request.url,
                stepsExecuted: request.steps.length,
                timestamp: new Date().toISOString()
            },
            screenshots: [`screenshot_${Date.now()}.png`]
        };
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Server configuration
interface ServerConfig {
    port: number;
    apiKey?: string;
    corsOptions?: cors.CorsOptions;
    rateLimit?: {
        windowMs: number;
        max: number;
    };
    sandbox?: {
        enabled: boolean;
        maxConcurrent: number;
        timeout: number;
    };
}

class WebChat2ApiServer {
    private app: express.Application;
    private config: Required<ServerConfig>;
    private sandboxManager?: DaytonaSandboxManager;
    private strategyOrchestrator: StrategyOrchestrator;
    private flowManager: FlowManager;
    private requestCount = new Map<string, { count: number; resetTime: number }>();

    constructor(config: Partial<ServerConfig> = {}) {
        this.config = {
            port: config.port || parseInt(process.env.WEBCHAT2API_PORT || '3000'),
            apiKey: config.apiKey || process.env.WEBCHAT2API_API_KEY || undefined,
            corsOptions: config.corsOptions || {
                origin: process.env.WEBCHAT2API_CORS_ORIGIN || '*',
                credentials: true
            },
            rateLimit: config.rateLimit || {
                windowMs: 60 * 1000, // 1 minute
                max: 100 // requests per window
            },
            sandbox: config.sandbox || {
                enabled: process.env.WEBCHAT2API_SANDBOX_ENABLED === 'true',
                maxConcurrent: parseInt(process.env.WEBCHAT2API_MAX_CONCURRENT || '10'),
                timeout: parseInt(process.env.WEBCHAT2API_TIMEOUT || '300000')
            }
        };

        this.app = express();
        this.strategyOrchestrator = new StrategyOrchestrator();
        this.flowManager = new FlowManager();
        
        this.initializeSandbox();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    private initializeSandbox(): void {
        if (this.config.sandbox.enabled) {
            try {
                this.sandboxManager = new DaytonaSandboxManager({
                    maxConcurrent: this.config.sandbox.maxConcurrent,
                    timeout: this.config.sandbox.timeout
                });
                console.log('Sandbox manager initialized');
            } catch (error) {
                console.warn('Failed to initialize sandbox manager:', error);
            }
        }
    }

    private setupMiddleware(): void {
        // CORS
        this.app.use(cors(this.config.corsOptions));

        // JSON parsing
        this.app.use(express.json({ limit: '10mb' }));

        // Request logging
        this.app.use(this.createRequestLogger());

        // Rate limiting
        this.app.use(this.createRateLimiter());

        // Authentication
        if (this.config.apiKey) {
            this.app.use(this.createAuthenticationMiddleware());
        }
    }

    private createRequestLogger(): (req: Request, res: Response, next: NextFunction) => void {
        return (req: Request, res: Response, next: NextFunction) => {
            const start = Date.now();
            res.on('finish', () => {
                const duration = Date.now() - start;
                console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
            });
            next();
        };
    }

    private createRateLimiter(): (req: Request, res: Response, next: NextFunction) => void {
        return (req: Request, res: Response, next: NextFunction) => {
            const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
            const now = Date.now();
            
            if (!this.requestCount.has(clientIP)) {
                this.requestCount.set(clientIP, { count: 0, resetTime: now + this.config.rateLimit.windowMs });
            }

            const clientData = this.requestCount.get(clientIP)!;
            
            if (now > clientData.resetTime) {
                clientData.count = 0;
                clientData.resetTime = now + this.config.rateLimit.windowMs;
            }

            if (clientData.count >= this.config.rateLimit.max) {
                return this.sendError(res, 429, 'rate_limit_exceeded', 'Too many requests');
            }

            clientData.count++;
            next();
        };
    }

    private createAuthenticationMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
        return (req: Request, res: Response, next: NextFunction) => {
            const authHeader = req.headers.authorization;
            
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return this.sendError(res, 401, 'invalid_authentication', 'Invalid or missing API key');
            }

            const apiKey = authHeader.substring(7);
            if (apiKey !== this.config.apiKey) {
                return this.sendError(res, 401, 'invalid_authentication', 'Invalid API key');
            }

            next();
        };
    }

    private setupRoutes(): void {
        // Health check
        this.app.get('/health', this.handleHealthCheck.bind(this));

        // OpenAI-compatible endpoints
        this.app.post('/v1/chat/completions', this.handleChatCompletions.bind(this));
        this.app.post('/v1/completions', this.handleCompletions.bind(this));
        this.app.get('/v1/models', this.handleListModels.bind(this));

        // Web2API specific endpoints
        this.app.post('/v1/web/identify-element', this.handleIdentifyElement.bind(this));
        this.app.post('/v1/web/execute-flow', this.handleExecuteFlow.bind(this));
        this.app.get('/v1/sandbox/status', this.handleSandboxStatus.bind(this));
        this.app.post('/v1/sandbox/create', this.handleCreateSandbox.bind(this));
        this.app.delete('/v1/sandbox/:id', this.handleDestroySandbox.bind(this));
    }

    private setupErrorHandling(): void {
        this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
            console.error('Unhandled error:', err);
            this.sendError(res, 500, 'internal_error', 'Internal server error');
        });

        this.app.use((req: Request, res: Response) => {
            this.sendError(res, 404, 'not_found', 'Endpoint not found');
        });
    }

    private async handleHealthCheck(req: Request, res: Response): Promise<void> {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            sandbox: this.sandboxManager ? {
                enabled: true,
                stats: this.sandboxManager.getStats()
            } : { enabled: false }
        };

        res.json(health);
    }

    private async handleChatCompletions(req: Request, res: Response): Promise<void> {
        try {
            const request = req.body as ChatCompletionRequest;
            
            if (!this.validateChatCompletionRequest(request)) {
                return this.sendError(res, 400, 'invalid_request', 'Invalid chat completion request');
            }

            if (request.stream) {
                await this.handleStreamingChatCompletion(request, res);
            } else {
                await this.handleNonStreamingChatCompletion(request, res);
            }
        } catch (error) {
            console.error('Chat completion error:', error);
            this.sendError(res, 500, 'internal_error', 'Failed to process chat completion');
        }
    }

    private validateChatCompletionRequest(request: ChatCompletionRequest): boolean {
        return !!(request.model && request.messages && Array.isArray(request.messages) && request.messages.length > 0);
    }

    private async handleNonStreamingChatCompletion(request: ChatCompletionRequest, res: Response): Promise<void> {
        const startTime = Date.now();
        
        // Extract web automation requests from messages
        const lastMessage = request.messages[request.messages.length - 1];
        const webTask = this.extractWebTaskFromMessage(lastMessage);

        let response: ChatCompletionResponse;

        if (webTask) {
            // Handle web automation task
            const result = await this.processWebTask(webTask);
            response = this.createChatResponseFromWebResult(request, result, startTime);
        } else {
            // Handle regular chat completion (fallback to simple echo)
            response = this.createSimpleChatResponse(request, startTime);
        }

        res.json(response);
    }

    private async handleStreamingChatCompletion(request: ChatCompletionRequest, res: Response): Promise<void> {
        res.writeHead(200, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        const responseId = `chatcmpl-${uuidv4()}`;
        const created = Math.floor(Date.now() / 1000);

        try {
            // Extract web automation requests from messages
            const lastMessage = request.messages[request.messages.length - 1];
            const webTask = this.extractWebTaskFromMessage(lastMessage);

            if (webTask) {
                // Stream web automation task result
                await this.streamWebTaskResult(request, webTask, responseId, created, res);
            } else {
                // Stream simple response
                await this.streamSimpleResponse(request, responseId, created, res);
            }
        } catch (error) {
            console.error('Streaming error:', error);
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
            res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
        } finally {
            res.write('data: [DONE]\n\n');
            res.end();
        }
    }

    private extractWebTaskFromMessage(message: OpenAIMessage): FlowExecutionRequest | ElementIdentificationRequest | null {
        if (!message.content) return null;

        try {
            // Look for JSON in the message content
            const jsonMatch = message.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                
                // Check if it's a flow execution request
                if (parsed.url && parsed.steps) {
                    return parsed as FlowExecutionRequest;
                }
                
                // Check if it's an element identification request
                if (parsed.url && (parsed.selector || parsed.description)) {
                    return parsed as ElementIdentificationRequest;
                }
            }
        } catch (error) {
            // Not a valid JSON task
        }

        return null;
    }

    private async processWebTask(task: FlowExecutionRequest | ElementIdentificationRequest): Promise<FlowExecutionResult | ElementIdentificationResult> {
        if ('steps' in task) {
            // Flow execution
            return await this.flowManager.executeFlow(task);
        } else {
            // Element identification
            return await this.strategyOrchestrator.identifyElement(task);
        }
    }

    private createChatResponseFromWebResult(
        request: ChatCompletionRequest, 
        result: FlowExecutionResult | ElementIdentificationResult, 
        startTime: number
    ): ChatCompletionResponse {
        const content = JSON.stringify(result, null, 2);
        const usage = this.estimateTokenUsage(request, content);

        return {
            id: `chatcmpl-${uuidv4()}`,
            object: 'chat.completion',
            created: Math.floor(startTime / 1000),
            model: request.model,
            choices: [{
                index: 0,
                message: {
                    role: 'assistant',
                    content
                },
                finish_reason: 'stop'
            }],
            usage
        };
    }

    private createSimpleChatResponse(request: ChatCompletionRequest, startTime: number): ChatCompletionResponse {
        const content = 'I am WebChat2Api - a Web UI to OpenAI-compatible API bridge. Send me web automation tasks as JSON in your messages.';
        const usage = this.estimateTokenUsage(request, content);

        return {
            id: `chatcmpl-${uuidv4()}`,
            object: 'chat.completion',
            created: Math.floor(startTime / 1000),
            model: request.model,
            choices: [{
                index: 0,
                message: {
                    role: 'assistant',
                    content
                },
                finish_reason: 'stop'
            }],
            usage
        };
    }

    private async streamWebTaskResult(
        request: ChatCompletionRequest,
        task: FlowExecutionRequest | ElementIdentificationRequest,
        responseId: string,
        created: number,
        res: Response
    ): Promise<void> {
        // Send initial chunk
        const initialChunk: ChatCompletionStreamDelta = {
            id: responseId,
            object: 'chat.completion.chunk',
            created,
            model: request.model,
            choices: [{
                index: 0,
                delta: { role: 'assistant', content: 'Processing web automation task...\n\n' },
            }]
        };
        res.write(`data: ${JSON.stringify(initialChunk)}\n\n`);

        // Process the task
        const result = await this.processWebTask(task);
        
        // Send result chunks
        const resultText = JSON.stringify(result, null, 2);
        const chunks = this.splitIntoChunks(resultText, 100);
        
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
            res.write(`data: ${JSON.stringify(streamChunk)}\n\n`);
            
            // Small delay for streaming effect
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Send final chunk
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
        res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
    }

    private async streamSimpleResponse(
        request: ChatCompletionRequest,
        responseId: string,
        created: number,
        res: Response
    ): Promise<void> {
        const message = 'I am WebChat2Api - a Web UI to OpenAI-compatible API bridge. Send me web automation tasks as JSON in your messages.';
        const chunks = this.splitIntoChunks(message, 20);

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
            res.write(`data: ${JSON.stringify(streamChunk)}\n\n`);
            await new Promise(resolve => setTimeout(resolve, 100));
        }

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
        res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
    }

    private splitIntoChunks(text: string, chunkSize: number): string[] {
        const chunks: string[] = [];
        for (let i = 0; i < text.length; i += chunkSize) {
            chunks.push(text.substring(i, i + chunkSize));
        }
        return chunks;
    }

    private async handleCompletions(req: Request, res: Response): Promise<void> {
        try {
            const request = req.body as CompletionRequest;
            
            if (!request.model || !request.prompt) {
                return this.sendError(res, 400, 'invalid_request', 'Missing model or prompt');
            }

            const response: CompletionResponse = {
                id: `cmpl-${uuidv4()}`,
                object: 'text_completion',
                created: Math.floor(Date.now() / 1000),
                model: request.model,
                choices: [{
                    index: 0,
                    text: `Completion for: ${request.prompt.substring(0, 100)}...`,
                    finish_reason: 'stop'
                }],
                usage: this.estimateTokenUsageFromText(request.prompt, 'Completion response')
            };

            res.json(response);
        } catch (error) {
            console.error('Completion error:', error);
            this.sendError(res, 500, 'internal_error', 'Failed to process completion');
        }
    }

    private async handleListModels(req: Request, res: Response): Promise<void> {
        const models: ModelInfo[] = [
            this.createModelInfo('web2api-vision', 'Vision-based web automation'),
            this.createModelInfo('web2api-computer-use', 'Computer use automation'),
            this.createModelInfo('web2api-natural-language', 'Natural language web interaction'),
            this.createModelInfo('web2api-dom', 'DOM-based automation'),
            this.createModelInfo('web2api-stealth', 'Stealth automation'),
            this.createModelInfo('web2api-multi-strategy', 'Multi-strategy orchestration')
        ];

        res.json({
            object: 'list',
            data: models
        });
    }

    private createModelInfo(id: string, description: string): ModelInfo {
        return {
            id,
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
            root: id
        };
    }

    private async handleIdentifyElement(req: Request, res: Response): Promise<void> {
        try {
            const request = req.body as ElementIdentificationRequest;
            
            if (!request.url) {
                return this.sendError(res, 400, 'invalid_request', 'Missing URL');
            }

            const result = await this.strategyOrchestrator.identifyElement(request);
            res.json(result);
        } catch (error) {
            console.error('Element identification error:', error);
            this.sendError(res, 500, 'internal_error', 'Failed to identify element');
        }
    }

    private async handleExecuteFlow(req: Request, res: Response): Promise<void> {
        try {
            const request = req.body as FlowExecutionRequest;
            
            if (!request.url || !request.steps) {
                return this.sendError(res, 400, 'invalid_request', 'Missing URL or steps');
            }

            const result = await this.flowManager.executeFlow(request);
            res.json(result);
        } catch (error) {
            console.error('Flow execution error:', error);
            this.sendError(res, 500, 'internal_error', 'Failed to execute flow');
        }
    }

    private async handleSandboxStatus(req: Request, res: Response): Promise<void> {
        if (!this.sandboxManager) {
            return this.sendError(res, 503, 'service_unavailable', 'Sandbox service not enabled');
        }

        const stats = this.sandboxManager.getStats();
        const sandboxes = this.sandboxManager.listSandboxes();
        
        res.json({
            enabled: true,
            stats,
            sandboxes: sandboxes.map(s => ({
                id: s.id,
                status: s.status,
                created: s.createdAt,
                lastActivity: s.lastActivity,
                uses: s.uses
            }))
        });
    }

    private async handleCreateSandbox(req: Request, res: Response): Promise<void> {
        if (!this.sandboxManager) {
            return this.sendError(res, 503, 'service_unavailable', 'Sandbox service not enabled');
        }

        try {
            const sandbox = await this.sandboxManager.createSandbox();
            res.json({
                id: sandbox.id,
                status: sandbox.status,
                created: sandbox.createdAt
            });
        } catch (error) {
            console.error('Sandbox creation error:', error);
            this.sendError(res, 500, 'internal_error', 'Failed to create sandbox');
        }
    }

    private async handleDestroySandbox(req: Request, res: Response): Promise<void> {
        if (!this.sandboxManager) {
            return this.sendError(res, 503, 'service_unavailable', 'Sandbox service not enabled');
        }

        try {
            const { id } = req.params;
            await this.sandboxManager.destroySandbox(id);
            res.json({ success: true });
        } catch (error) {
            console.error('Sandbox destruction error:', error);
            this.sendError(res, 500, 'internal_error', 'Failed to destroy sandbox');
        }
    }

    private estimateTokenUsage(request: ChatCompletionRequest, response: string): { prompt_tokens: number; completion_tokens: number; total_tokens: number } {
        const promptText = request.messages.map(m => m.content || '').join(' ');
        return this.estimateTokenUsageFromText(promptText, response);
    }

    private estimateTokenUsageFromText(prompt: string, completion: string): { prompt_tokens: number; completion_tokens: number; total_tokens: number } {
        // Simple estimation: roughly 4 characters per token
        const promptTokens = Math.ceil(prompt.length / 4);
        const completionTokens = Math.ceil(completion.length / 4);
        
        return {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: promptTokens + completionTokens
        };
    }

    private sendError(res: Response, status: number, type: string, message: string): void {
        const errorResponse: ErrorResponse = {
            error: {
                message,
                type,
                code: type
            }
        };
        res.status(status).json(errorResponse);
    }

    public async start(): Promise<void> {
        return new Promise((resolve) => {
            this.app.listen(this.config.port, () => {
                console.log(`WebChat2Api server listening on port ${this.config.port}`);
                console.log(`OpenAI-compatible endpoints:`);
                console.log(`  POST http://localhost:${this.config.port}/v1/chat/completions`);
                console.log(`  POST http://localhost:${this.config.port}/v1/completions`);
                console.log(`  GET  http://localhost:${this.config.port}/v1/models`);
                console.log(`Web automation endpoints:`);
                console.log(`  POST http://localhost:${this.config.port}/v1/web/identify-element`);
                console.log(`  POST http://localhost:${this.config.port}/v1/web/execute-flow`);
                console.log(`  GET  http://localhost:${this.config.port}/health`);
                
                if (this.config.apiKey) {
                    console.log(`Authentication required: Bearer ${this.config.apiKey.substring(0, 8)}...`);
                }
                
                resolve();
            });
        });
    }

    public async stop(): Promise<void> {
        if (this.sandboxManager) {
            await this.sandboxManager.cleanup();
        }
    }
}

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

    server.start().catch(console.error);
}

export { WebChat2ApiServer };
export default WebChat2ApiServer;