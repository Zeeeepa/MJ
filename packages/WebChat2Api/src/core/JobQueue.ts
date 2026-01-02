/**
 * BullMQ-based Job Queue System for WebChat2Api
 * 
 * Provides robust job queueing with Redis for processing various types of tasks
 * including chat completions, feature discovery, and service setup.
 */

import { Queue, Worker, Job, QueueEvents, JobsOptions, JobType } from 'bullmq';
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';

// Job Types
export type JobTypeNames = 'chat-completion' | 'feature-discovery' | 'service-setup';

// Priority levels
export type JobPriority = 'urgent' | 'normal' | 'low';

// Job status enum
export type JobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'cancelled';

// Priority mapping to BullMQ priority values (higher number = higher priority)
const PRIORITY_MAP: Record<JobPriority, number> = {
    urgent: 100,
    normal: 50,
    low: 10
};

// Base job data interface
export interface BaseJobData {
    type: JobTypeNames;
    requestId: string;
    userId?: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
}

// Chat completion job data
export interface ChatCompletionJobData extends BaseJobData {
    type: 'chat-completion';
    model: string;
    messages: Array<{
        role: 'system' | 'user' | 'assistant' | 'tool';
        content?: string;
        tool_calls?: Array<{
            id: string;
            type: 'function';
            function: {
                name: string;
                arguments: string;
            };
        }>;
    }>;
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
    tools?: Array<{
        type: 'function';
        function: {
            name: string;
            description: string;
            parameters: Record<string, unknown>;
        };
    }>;
}

// Feature discovery job data
export interface FeatureDiscoveryJobData extends BaseJobData {
    type: 'feature-discovery';
    serviceUrl: string;
    discoveryMethod: 'automation' | 'api-inspection' | 'mixed';
    targetFeatures?: string[];
    timeout?: number;
}

// Service setup job data
export interface ServiceSetupJobData extends BaseJobData {
    type: 'service-setup';
    serviceUrl: string;
    serviceType: 'chat' | 'completion' | 'embedding' | 'vision';
    authConfig?: {
        type: 'api-key' | 'oauth' | 'basic' | 'none';
        credentials?: Record<string, string>;
    };
    testConnection?: boolean;
}

// Union type for all job data
export type JobData = ChatCompletionJobData | FeatureDiscoveryJobData | ServiceSetupJobData;

// Job options interface
export interface JobQueueOptions {
    priority?: JobPriority;
    delay?: number;
    attempts?: number;
    backoff?: {
        type: 'exponential' | 'fixed';
        delay: number;
    };
    removeOnComplete?: number;
    removeOnFail?: number;
    timeout?: number;
    tags?: string[];
}

// Job result interface
export interface JobResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: {
        message: string;
        code?: string;
        stack?: string;
    };
    metadata?: Record<string, unknown>;
    duration?: number;
}

// Queue statistics interface
export interface QueueStats {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    cancelled: number;
    total: number;
    throughput: {
        completed: number;
        failed: number;
        duration: string;
    };
}

// Redis configuration interface
export interface RedisConfig {
    host: string;
    port: number;
    password?: string;
    db?: number;
    maxRetriesPerRequest?: number;
    retryDelayOnFailover?: number;
    enableReadyCheck?: boolean;
    lazyConnect?: boolean;
}

// JobQueue configuration interface
export interface JobQueueConfig {
    redis: RedisConfig;
    queueName?: string;
    concurrency?: {
        'chat-completion'?: number;
        'feature-discovery'?: number;
        'service-setup'?: number;
        default?: number;
    };
    defaultJobOptions?: JobQueueOptions;
    enableMetrics?: boolean;
    cleanupInterval?: number;
}

// Job processor function type
export type JobProcessor<T extends JobData = JobData> = (
    job: Job<T, JobResult, string>,
    token?: string
) => Promise<JobResult>;

/**
 * Main JobQueue class providing comprehensive job management capabilities
 */
export class JobQueue extends EventEmitter {
    private readonly config: Required<JobQueueConfig>;
    private readonly redis: Redis;
    private readonly queue: Queue<JobData, JobResult>;
    private readonly workers: Map<JobTypeNames, Worker<JobData, JobResult>>;
    private readonly queueEvents: QueueEvents;
    private readonly processors: Map<JobTypeNames, JobProcessor>;
    private isShuttingDown = false;
    private metricsInterval?: NodeJS.Timeout;

    constructor(config: JobQueueConfig) {
        super();

        // Set default configuration
        this.config = {
            redis: config.redis,
            queueName: config.queueName || 'webchat2api-jobs',
            concurrency: {
                'chat-completion': config.concurrency?.['chat-completion'] || 5,
                'feature-discovery': config.concurrency?.['feature-discovery'] || 3,
                'service-setup': config.concurrency?.['service-setup'] || 2,
                default: config.concurrency?.default || 3
            },
            defaultJobOptions: {
                priority: 'normal',
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000
                },
                removeOnComplete: 100,
                removeOnFail: 50,
                timeout: 300000, // 5 minutes
                ...config.defaultJobOptions
            },
            enableMetrics: config.enableMetrics !== false,
            cleanupInterval: config.cleanupInterval || 60000 // 1 minute
        };

        // Initialize Redis connection
        this.redis = new Redis({
            ...this.config.redis,
            maxRetriesPerRequest: this.config.redis.maxRetriesPerRequest || 3,
            retryDelayOnFailover: this.config.redis.retryDelayOnFailover || 100,
            enableReadyCheck: this.config.redis.enableReadyCheck !== false,
            lazyConnect: this.config.redis.lazyConnect !== false
        });

        // Initialize queue
        this.queue = new Queue<JobData, JobResult>(this.config.queueName, {
            connection: this.redis,
            defaultJobOptions: this.createBullMQJobOptions(this.config.defaultJobOptions)
        });

        // Initialize workers map and processors map
        this.workers = new Map();
        this.processors = new Map();

        // Initialize queue events
        this.queueEvents = new QueueEvents(this.config.queueName, {
            connection: this.redis
        });

        this.setupEventHandlers();
        this.setupMetrics();
    }

    /**
     * Initialize the job queue and start workers
     */
    async initialize(): Promise<void> {
        try {
            await this.redis.ping();
            console.log('Redis connection established');

            // Set up default processors
            this.setupDefaultProcessors();

            // Start workers for each job type
            await this.startWorkers();

            if (this.config.enableMetrics) {
                this.startMetricsCollection();
            }

            this.emit('ready');
            console.log('JobQueue initialized successfully');
        } catch (error) {
            console.error('Failed to initialize JobQueue:', error);
            throw new Error(`JobQueue initialization failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Add a job to the queue
     */
    async addJob<T extends JobData>(
        type: T['type'],
        data: Omit<T, 'type' | 'timestamp'>,
        options: JobQueueOptions = {}
    ): Promise<Job<JobData, JobResult>> {
        if (this.isShuttingDown) {
            throw new Error('JobQueue is shutting down, cannot add new jobs');
        }

        const jobData: JobData = {
            ...data,
            type,
            timestamp: new Date().toISOString()
        } as T;

        const mergedOptions = { ...this.config.defaultJobOptions, ...options };
        const bullMQOptions = this.createBullMQJobOptions(mergedOptions);

        try {
            const job = await this.queue.add(type, jobData, bullMQOptions);
            
            this.emit('job:added', {
                jobId: job.id,
                type,
                priority: mergedOptions.priority,
                data: jobData
            });

            return job;
        } catch (error) {
            this.emit('job:add_failed', {
                type,
                data: jobData,
                error: error instanceof Error ? error.message : String(error)
            });
            throw new Error(`Failed to add job: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Get a job by ID
     */
    async getJob(jobId: string): Promise<Job<JobData, JobResult> | null> {
        try {
            const job = await this.queue.getJob(jobId);
            return job || null;
        } catch (error) {
            console.error(`Failed to get job ${jobId}:`, error);
            return null;
        }
    }

    /**
     * Cancel a job by ID
     */
    async cancelJob(jobId: string): Promise<boolean> {
        try {
            const job = await this.getJob(jobId);
            if (!job) {
                return false;
            }

            // Check if job can be cancelled (not already completed or failed)
            const state = await job.getState();
            if (state === 'completed' || state === 'failed') {
                return false;
            }

            // Remove the job
            await job.remove();
            
            this.emit('job:cancelled', { jobId, type: job.data.type });
            return true;
        } catch (error) {
            console.error(`Failed to cancel job ${jobId}:`, error);
            return false;
        }
    }

    /**
     * Get comprehensive queue statistics
     */
    async getQueueStats(): Promise<QueueStats> {
        try {
            const [waiting, active, completed, failed, delayed] = await Promise.all([
                this.queue.getWaiting(),
                this.queue.getActive(),
                this.queue.getCompleted(),
                this.queue.getFailed(),
                this.queue.getDelayed()
            ]);

            // Calculate throughput for the last hour
            const oneHourAgo = Date.now() - (60 * 60 * 1000);
            const recentCompleted = completed.filter(job => 
                job.finishedOn && job.finishedOn > oneHourAgo
            );
            const recentFailed = failed.filter(job => 
                job.finishedOn && job.finishedOn > oneHourAgo
            );

            return {
                waiting: waiting.length,
                active: active.length,
                completed: completed.length,
                failed: failed.length,
                delayed: delayed.length,
                cancelled: 0, // BullMQ doesn't track cancelled jobs separately
                total: waiting.length + active.length + completed.length + failed.length + delayed.length,
                throughput: {
                    completed: recentCompleted.length,
                    failed: recentFailed.length,
                    duration: '1h'
                }
            };
        } catch (error) {
            console.error('Failed to get queue stats:', error);
            throw new Error(`Failed to get queue stats: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Pause the queue
     */
    async pauseQueue(): Promise<void> {
        try {
            await this.queue.pause();
            this.emit('queue:paused');
            console.log('Queue paused');
        } catch (error) {
            console.error('Failed to pause queue:', error);
            throw new Error(`Failed to pause queue: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Resume the queue
     */
    async resumeQueue(): Promise<void> {
        try {
            await this.queue.resume();
            this.emit('queue:resumed');
            console.log('Queue resumed');
        } catch (error) {
            console.error('Failed to resume queue:', error);
            throw new Error(`Failed to resume queue: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Register a custom job processor
     */
    registerProcessor<T extends JobData>(
        type: T['type'],
        processor: JobProcessor<T>
    ): void {
        this.processors.set(type, processor as JobProcessor);
        console.log(`Registered custom processor for job type: ${type}`);
    }

    /**
     * Clean up old jobs based on configuration
     */
    async cleanupJobs(): Promise<void> {
        try {
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours
            await this.queue.clean(maxAge, 100, 'completed');
            await this.queue.clean(maxAge, 50, 'failed');
            
            this.emit('jobs:cleaned');
        } catch (error) {
            console.error('Failed to cleanup jobs:', error);
        }
    }

    /**
     * Gracefully shutdown the queue and workers
     */
    async shutdown(): Promise<void> {
        if (this.isShuttingDown) {
            return;
        }

        this.isShuttingDown = true;
        console.log('Shutting down JobQueue...');

        try {
            // Stop metrics collection
            if (this.metricsInterval) {
                clearInterval(this.metricsInterval);
            }

            // Close workers
            const workerPromises = Array.from(this.workers.values()).map(worker => worker.close());
            await Promise.all(workerPromises);

            // Close queue events
            await this.queueEvents.close();

            // Close queue
            await this.queue.close();

            // Close Redis connection
            await this.redis.quit();

            this.emit('shutdown');
            console.log('JobQueue shutdown complete');
        } catch (error) {
            console.error('Error during JobQueue shutdown:', error);
            throw error;
        }
    }

    /**
     * Setup event handlers for queue events
     */
    private setupEventHandlers(): void {
        this.queueEvents.on('completed', ({ jobId }) => {
            this.emit('job:completed', { jobId });
        });

        this.queueEvents.on('failed', ({ jobId, failedReason }) => {
            this.emit('job:failed', { jobId, reason: failedReason });
        });

        this.queueEvents.on('active', ({ jobId }) => {
            this.emit('job:active', { jobId });
        });

        this.queueEvents.on('waiting', ({ jobId }) => {
            this.emit('job:waiting', { jobId });
        });

        this.queueEvents.on('delayed', ({ jobId, delay }) => {
            this.emit('job:delayed', { jobId, delay });
        });

        this.queueEvents.on('error', (error) => {
            this.emit('error', error);
        });
    }

    /**
     * Setup metrics collection
     */
    private setupMetrics(): void {
        if (!this.config.enableMetrics) {
            return;
        }

        // Collect metrics periodically
        this.on('job:completed', () => {
            // Could integrate with metrics system here
        });

        this.on('job:failed', () => {
            // Could integrate with metrics system here
        });
    }

    /**
     * Start metrics collection interval
     */
    private startMetricsCollection(): void {
        this.metricsInterval = setInterval(async () => {
            try {
                const stats = await this.getQueueStats();
                this.emit('metrics', stats);
            } catch (error) {
                console.error('Failed to collect metrics:', error);
            }
        }, this.config.cleanupInterval);
    }

    /**
     * Setup default job processors
     */
    private setupDefaultProcessors(): void {
        // Chat completion processor
        this.registerProcessor('chat-completion', async (job) => {
            const startTime = Date.now();
            const data = job.data as ChatCompletionJobData;

            try {
                // Default implementation - could be overridden with custom processor
                console.log(`Processing chat completion job ${job.id} for model: ${data.model}`);
                
                // Simulate processing
                await new Promise(resolve => setTimeout(resolve, 1000));

                const result: JobResult = {
                    success: true,
                    data: {
                        id: `chatcmpl-${job.id}`,
                        object: 'chat.completion',
                        created: Math.floor(Date.now() / 1000),
                        model: data.model,
                        choices: [{
                            index: 0,
                            message: {
                                role: 'assistant',
                                content: 'Default response - register custom processor for actual implementation'
                            },
                            finish_reason: 'stop'
                        }],
                        usage: {
                            prompt_tokens: 10,
                            completion_tokens: 20,
                            total_tokens: 30
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
                        code: 'processing_error',
                        stack: error instanceof Error ? error.stack : undefined
                    },
                    duration: Date.now() - startTime
                };
            }
        });

        // Feature discovery processor
        this.registerProcessor('feature-discovery', async (job) => {
            const startTime = Date.now();
            const data = job.data as FeatureDiscoveryJobData;

            try {
                console.log(`Discovering features for service: ${data.serviceUrl}`);
                
                // Simulate feature discovery
                await new Promise(resolve => setTimeout(resolve, 2000));

                const result: JobResult = {
                    success: true,
                    data: {
                        serviceUrl: data.serviceUrl,
                        discoveredFeatures: ['chat', 'completions', 'models'],
                        discoveryMethod: data.discoveryMethod,
                        capabilities: {
                            supportsStreaming: true,
                            supportsTools: false,
                            maxTokens: 4096
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
                        code: 'discovery_error',
                        stack: error instanceof Error ? error.stack : undefined
                    },
                    duration: Date.now() - startTime
                };
            }
        });

        // Service setup processor
        this.registerProcessor('service-setup', async (job) => {
            const startTime = Date.now();
            const data = job.data as ServiceSetupJobData;

            try {
                console.log(`Setting up service: ${data.serviceUrl} (${data.serviceType})`);
                
                // Simulate service setup
                await new Promise(resolve => setTimeout(resolve, 1500));

                const result: JobResult = {
                    success: true,
                    data: {
                        serviceUrl: data.serviceUrl,
                        serviceType: data.serviceType,
                        setupComplete: true,
                        connectionTested: data.testConnection || false,
                        configuration: {
                            authType: data.authConfig?.type || 'none',
                            endpoints: {
                                chat: `${data.serviceUrl}/v1/chat/completions`,
                                completions: `${data.serviceUrl}/v1/completions`,
                                models: `${data.serviceUrl}/v1/models`
                            }
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
                        code: 'setup_error',
                        stack: error instanceof Error ? error.stack : undefined
                    },
                    duration: Date.now() - startTime
                };
            }
        });
    }

    /**
     * Start workers for processing jobs
     */
    private async startWorkers(): Promise<void> {
        for (const [type, processor] of this.processors.entries()) {
            const concurrency = this.config.concurrency[type] || this.config.concurrency.default;
            
            const worker = new Worker<JobData, JobResult>(
                this.config.queueName,
                async (job) => {
                    if (job.name !== type) {
                        throw new Error(`Worker ${type} received job of type ${job.name}`);
                    }
                    return await processor(job, job.token);
                },
                {
                    connection: this.redis,
                    concurrency: concurrency,
                    stalledInterval: 30000,
                    maxStalledCount: 1
                }
            );

            worker.on('completed', (job) => {
                console.log(`Job ${job.id} (${type}) completed successfully`);
            });

            worker.on('failed', (job, err) => {
                console.error(`Job ${job?.id} (${type}) failed:`, err.message);
            });

            worker.on('error', (error) => {
                console.error(`Worker ${type} error:`, error);
                this.emit('worker:error', { type, error });
            });

            this.workers.set(type, worker);
            console.log(`Started worker for ${type} with concurrency: ${concurrency}`);
        }
    }

    /**
     * Convert JobQueueOptions to BullMQ JobsOptions
     */
    private createBullMQJobOptions(options: JobQueueOptions): JobsOptions {
        return {
            priority: PRIORITY_MAP[options.priority || 'normal'],
            delay: options.delay,
            attempts: options.attempts,
            backoff: options.backoff,
            removeOnComplete: options.removeOnComplete,
            removeOnFail: options.removeOnFail,
            jobId: undefined, // Let BullMQ generate IDs
            timestamp: Date.now(),
            ...(options.timeout && { timeout: options.timeout })
        };
    }
}

export default JobQueue;