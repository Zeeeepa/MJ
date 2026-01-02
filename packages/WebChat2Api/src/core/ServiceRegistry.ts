/**
 * Service Registry for Web2API
 * 
 * Manages registration of web services and their discovered features.
 * Provides centralized configuration, feature discovery, and action flow management
 * for AI chat services like DeepSeek, Grok, Qwen, Z.AI, and Mistral.
 */

import { Page, ElementHandle, Locator } from 'playwright';

/**
 * Supported web service providers
 */
export type ServiceProvider = 'deepseek' | 'grok' | 'qwen' | 'zai' | 'mistral';

/**
 * Types of interactive elements that can be discovered
 */
export type ElementType = 'button' | 'toggle' | 'dropdown' | 'input' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'slider';

/**
 * Selector strategies for element identification
 */
export interface SelectorStrategy {
    /** CSS selector */
    css?: string;
    /** XPath expression */
    xpath?: string;
    /** Vision-based description for AI identification */
    visionDescription?: string;
    /** Text content to match */
    text?: string;
    /** ARIA label or role */
    aria?: string;
    /** Data attributes */
    dataAttributes?: Record<string, string>;
    /** Priority order for trying selectors (lower = higher priority) */
    priority: number;
}

/**
 * Action step definition within a flow
 */
export interface ActionStep {
    /** Step identifier */
    id: string;
    /** Step description */
    description: string;
    /** Type of action to perform */
    action: 'click' | 'type' | 'select' | 'wait' | 'scroll' | 'hover' | 'screenshot' | 'evaluate';
    /** Target element selector strategy */
    target?: SelectorStrategy;
    /** Value to input or select */
    value?: string | number | boolean;
    /** Delay before executing this step (milliseconds) */
    delay?: number;
    /** Conditions that must be met before executing */
    preconditions?: string[];
    /** Expected outcome after execution */
    expectedOutcome?: string;
    /** Whether this step is optional */
    optional?: boolean;
    /** Retry configuration */
    retry?: {
        maxAttempts: number;
        delayBetweenAttempts: number;
    };
}

/**
 * Complete action flow for a feature
 */
export interface ActionFlow {
    /** Flow identifier */
    id: string;
    /** Flow name */
    name: string;
    /** Flow description */
    description: string;
    /** Prerequisites for the flow */
    prerequisites: string[];
    /** Ordered steps in the flow */
    steps: ActionStep[];
    /** Success criteria */
    successCriteria: string[];
    /** Error recovery flows */
    errorRecovery?: {
        condition: string;
        fallbackFlow: string;
    }[];
    /** Estimated execution time (milliseconds) */
    estimatedDuration?: number;
    /** Last successful execution timestamp */
    lastSuccessful?: Date;
    /** Failure count since last success */
    failureCount: number;
}

/**
 * Discovered feature information
 */
export interface DiscoveredFeature {
    /** Feature identifier */
    id: string;
    /** Feature name */
    name: string;
    /** Feature description */
    description: string;
    /** Element type */
    type: ElementType;
    /** Selector strategies for this feature */
    selectors: SelectorStrategy[];
    /** Location on page (bounds) */
    bounds?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    /** Whether feature is currently enabled/visible */
    isEnabled: boolean;
    /** Current state/value */
    currentState?: string | number | boolean;
    /** Available options (for dropdowns, selects) */
    options?: Array<{ value: string; label: string }>;
    /** Action flows associated with this feature */
    actionFlows: ActionFlow[];
    /** Discovery method used */
    discoveryMethod: 'vision' | 'dom' | 'hybrid';
    /** Discovery timestamp */
    discoveredAt: Date;
    /** Last verification timestamp */
    lastVerified?: Date;
    /** Confidence score (0-1) */
    confidence: number;
}

/**
 * Network endpoint pattern for API detection
 */
export interface NetworkPattern {
    /** Pattern identifier */
    id: string;
    /** URL pattern (supports wildcards) */
    urlPattern: string;
    /** HTTP methods this pattern handles */
    methods: string[];
    /** Expected request headers */
    expectedHeaders?: Record<string, string>;
    /** Expected response format */
    responseFormat?: 'json' | 'xml' | 'text' | 'binary';
    /** Rate limiting information */
    rateLimit?: {
        requestsPerMinute: number;
        burstLimit?: number;
    };
    /** Authentication requirements */
    authRequired?: boolean;
    /** Description of what this endpoint does */
    description: string;
}

/**
 * Cookie requirement definition
 */
export interface CookieRequirement {
    /** Cookie name */
    name: string;
    /** Whether cookie is required */
    required: boolean;
    /** Expected value pattern */
    valuePattern?: string;
    /** Cookie domain */
    domain?: string;
    /** Cookie path */
    path?: string;
    /** Whether cookie should be secure */
    secure?: boolean;
    /** Whether cookie is httpOnly */
    httpOnly?: boolean;
    /** Cookie expiration requirements */
    expiration?: 'session' | 'persistent';
    /** Description of cookie purpose */
    description: string;
}

/**
 * Complete service configuration
 */
export interface ServiceConfig {
    /** Service identifier */
    id: ServiceProvider;
    /** Service display name */
    name: string;
    /** Service description */
    description: string;
    /** Base URL for the service */
    baseUrl: string;
    /** Additional URLs (CDN, API endpoints, etc.) */
    additionalUrls?: string[];
    /** Authentication configuration */
    auth?: {
        type: 'none' | 'cookie' | 'header' | 'oauth' | 'apikey';
        credentials?: Record<string, string>;
    };
    /** Discovered features */
    features: Map<string, DiscoveredFeature>;
    /** Network endpoint patterns */
    networkPatterns: NetworkPattern[];
    /** Cookie requirements */
    cookieRequirements: CookieRequirement[];
    /** Service-specific configuration */
    serviceConfig?: Record<string, unknown>;
    /** Last discovery scan timestamp */
    lastDiscovery?: Date;
    /** Discovery status */
    discoveryStatus: 'pending' | 'in-progress' | 'completed' | 'failed';
    /** Service health status */
    healthStatus: 'unknown' | 'healthy' | 'degraded' | 'down';
    /** Last health check timestamp */
    lastHealthCheck?: Date;
}

/**
 * Vision model response for element identification
 */
export interface VisionAnalysisResult {
    /** Identified elements */
    elements: Array<{
        type: ElementType;
        description: string;
        confidence: number;
        suggestedName: string;
        bounds?: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
        attributes?: Record<string, string>;
    }>;
    /** Page structure analysis */
    pageStructure: {
        title: string;
        primaryActions: string[];
        navigationElements: string[];
        formElements: string[];
        contentAreas: string[];
    };
    /** Recommendations for interaction */
    recommendations: string[];
    /** Analysis confidence */
    confidence: number;
}

/**
 * Feature discovery options
 */
export interface DiscoveryOptions {
    /** Use vision analysis */
    useVision?: boolean;
    /** Use DOM analysis */
    useDom?: boolean;
    /** Minimum confidence threshold */
    minConfidence?: number;
    /** Take screenshots during discovery */
    captureScreenshots?: boolean;
    /** Analyze network patterns */
    analyzeNetwork?: boolean;
    /** Check for dynamic content */
    waitForDynamic?: boolean;
    /** Maximum discovery time (milliseconds) */
    timeout?: number;
}

/**
 * Central registry for managing web service configurations and features
 */
export class ServiceRegistry {
    private services: Map<ServiceProvider, ServiceConfig> = new Map();
    private initialized: boolean = false;
    private visionModel?: string;
    private debugMode: boolean = false;

    constructor(options?: { visionModel?: string; debugMode?: boolean }) {
        this.visionModel = options?.visionModel || 'gpt-4-vision-preview';
        this.debugMode = options?.debugMode || false;
        this.initializeBuiltInServices();
    }

    /**
     * Initialize built-in service configurations from environment variables
     */
    private initializeBuiltInServices(): void {
        this.registerBuiltInService('deepseek', {
            name: 'DeepSeek Chat',
            description: 'DeepSeek AI chat interface',
            baseUrl: 'https://chat.deepseek.com',
            envVarPrefix: 'DEEPSEEK'
        });

        this.registerBuiltInService('grok', {
            name: 'Grok (X.AI)',
            description: 'Grok AI assistant by X.AI',
            baseUrl: 'https://x.ai',
            envVarPrefix: 'GROK'
        });

        this.registerBuiltInService('qwen', {
            name: 'Qwen Chat',
            description: 'Alibaba Qwen AI chat service',
            baseUrl: 'https://qwen.ai',
            envVarPrefix: 'QWEN'
        });

        this.registerBuiltInService('zai', {
            name: 'Z.AI',
            description: 'Z.AI chat interface',
            baseUrl: 'https://z.ai',
            envVarPrefix: 'ZAI'
        });

        this.registerBuiltInService('mistral', {
            name: 'Mistral Chat',
            description: 'Mistral AI chat interface',
            baseUrl: 'https://chat.mistral.ai',
            envVarPrefix: 'MISTRAL'
        });

        this.initialized = true;
    }

    /**
     * Register a built-in service with environment variable configuration
     */
    private registerBuiltInService(
        id: ServiceProvider,
        config: {
            name: string;
            description: string;
            baseUrl: string;
            envVarPrefix: string;
        }
    ): void {
        const envConfig = this.loadEnvironmentConfig(config.envVarPrefix);

        const serviceConfig: ServiceConfig = {
            id,
            name: config.name,
            description: config.description,
            baseUrl: envConfig.baseUrl || config.baseUrl,
            auth: envConfig.auth,
            features: new Map(),
            networkPatterns: [],
            cookieRequirements: [],
            serviceConfig: envConfig.additionalConfig,
            discoveryStatus: 'pending',
            healthStatus: 'unknown'
        };

        this.services.set(id, serviceConfig);
        this.log(`Registered built-in service: ${config.name}`);
    }

    /**
     * Load configuration from environment variables
     */
    private loadEnvironmentConfig(envPrefix: string): {
        baseUrl?: string;
        auth?: ServiceConfig['auth'];
        additionalConfig?: Record<string, unknown>;
    } {
        const baseUrl = process.env[`${envPrefix}_URL`];
        const apiKey = process.env[`${envPrefix}_API_KEY`];
        const authToken = process.env[`${envPrefix}_AUTH_TOKEN`];
        const username = process.env[`${envPrefix}_USERNAME`];
        const password = process.env[`${envPrefix}_PASSWORD`];

        let auth: ServiceConfig['auth'];
        
        if (apiKey) {
            auth = {
                type: 'apikey',
                credentials: { apiKey }
            };
        } else if (authToken) {
            auth = {
                type: 'header',
                credentials: { authorization: `Bearer ${authToken}` }
            };
        } else if (username && password) {
            auth = {
                type: 'header',
                credentials: { username, password }
            };
        } else {
            auth = { type: 'none' };
        }

        return {
            baseUrl,
            auth,
            additionalConfig: this.loadAdditionalEnvConfig(envPrefix)
        };
    }

    /**
     * Load additional configuration from environment variables
     */
    private loadAdditionalEnvConfig(envPrefix: string): Record<string, unknown> {
        const config: Record<string, unknown> = {};
        const envKeys = Object.keys(process.env);

        for (const key of envKeys) {
            if (key.startsWith(`${envPrefix}_`) && 
                !key.endsWith('_URL') && 
                !key.endsWith('_API_KEY') && 
                !key.endsWith('_AUTH_TOKEN') &&
                !key.endsWith('_USERNAME') &&
                !key.endsWith('_PASSWORD')) {
                const configKey = key.substring(envPrefix.length + 1).toLowerCase();
                config[configKey] = process.env[key];
            }
        }

        return config;
    }

    /**
     * Register a custom service configuration
     */
    public registerService(config: Omit<ServiceConfig, 'features' | 'discoveryStatus' | 'healthStatus'>): void {
        const serviceConfig: ServiceConfig = {
            ...config,
            features: new Map(),
            discoveryStatus: 'pending',
            healthStatus: 'unknown'
        };

        this.services.set(config.id, serviceConfig);
        this.log(`Registered custom service: ${config.name}`);
    }

    /**
     * Discover features for a specific service using vision and DOM analysis
     */
    public async discoverFeatures(
        serviceName: ServiceProvider,
        page: Page,
        options: DiscoveryOptions = {}
    ): Promise<DiscoveredFeature[]> {
        const service = this.services.get(serviceName);
        if (!service) {
            throw new Error(`Service '${serviceName}' not found`);
        }

        this.log(`Starting feature discovery for ${service.name}`);
        service.discoveryStatus = 'in-progress';

        try {
            const discoveries: DiscoveredFeature[] = [];
            
            // Wait for dynamic content if requested
            if (options.waitForDynamic) {
                await page.waitForTimeout(2000);
                await page.waitForLoadState('networkidle');
            }

            // DOM-based discovery
            if (options.useDom !== false) {
                const domFeatures = await this.discoverFeaturesDom(page, serviceName);
                discoveries.push(...domFeatures);
            }

            // Vision-based discovery
            if (options.useVision) {
                const visionFeatures = await this.discoverFeaturesVision(page, serviceName);
                discoveries.push(...visionFeatures);
            }

            // Merge and deduplicate features
            const mergedFeatures = this.mergeFeatureDiscoveries(discoveries, options.minConfidence || 0.6);

            // Store discovered features
            for (const feature of mergedFeatures) {
                service.features.set(feature.id, feature);
            }

            // Analyze network patterns if requested
            if (options.analyzeNetwork) {
                await this.analyzeNetworkPatterns(page, service);
            }

            service.discoveryStatus = 'completed';
            service.lastDiscovery = new Date();

            this.log(`Discovered ${mergedFeatures.length} features for ${service.name}`);
            return mergedFeatures;

        } catch (error) {
            service.discoveryStatus = 'failed';
            this.logError(`Feature discovery failed for ${service.name}`, error);
            throw error;
        }
    }

    /**
     * Discover features using DOM analysis
     */
    private async discoverFeaturesDom(page: Page, serviceName: ServiceProvider): Promise<DiscoveredFeature[]> {
        const features: DiscoveredFeature[] = [];

        try {
            // Find interactive elements
            const interactiveElements = await page.evaluate(() => {
                const elements: Array<{
                    tagName: string;
                    type: string;
                    id: string;
                    className: string;
                    text: string;
                    placeholder: string;
                    ariaLabel: string;
                    role: string;
                    bounds: { x: number; y: number; width: number; height: number };
                    attributes: Record<string, string>;
                }> = [];

                const selectors = [
                    'button', 'input', 'select', 'textarea',
                    '[role="button"]', '[role="checkbox"]', '[role="radio"]',
                    '[role="slider"]', '[role="combobox"]', '[role="textbox"]',
                    '.toggle', '.switch', '.dropdown', '.select',
                    '[data-testid]', '[aria-label]'
                ];

                for (const selector of selectors) {
                    const nodeList = document.querySelectorAll(selector);
                    nodeList.forEach(el => {
                        const element = el as HTMLElement;
                        const rect = element.getBoundingClientRect();
                        
                        if (rect.width > 0 && rect.height > 0) {
                            const attributes: Record<string, string> = {};
                            for (let i = 0; i < element.attributes.length; i++) {
                                const attr = element.attributes[i];
                                attributes[attr.name] = attr.value;
                            }

                            elements.push({
                                tagName: element.tagName.toLowerCase(),
                                type: (element as HTMLInputElement).type || '',
                                id: element.id || '',
                                className: element.className || '',
                                text: element.textContent?.trim() || '',
                                placeholder: (element as HTMLInputElement).placeholder || '',
                                ariaLabel: element.getAttribute('aria-label') || '',
                                role: element.getAttribute('role') || '',
                                bounds: {
                                    x: rect.left,
                                    y: rect.top,
                                    width: rect.width,
                                    height: rect.height
                                },
                                attributes
                            });
                        }
                    });
                }

                return elements;
            });

            // Convert DOM elements to features
            for (const element of interactiveElements) {
                const feature = this.domElementToFeature(element, serviceName);
                if (feature) {
                    features.push(feature);
                }
            }

            this.log(`DOM discovery found ${features.length} potential features`);

        } catch (error) {
            this.logError('DOM feature discovery error', error);
        }

        return features;
    }

    /**
     * Convert DOM element to feature
     */
    private domElementToFeature(
        element: {
            tagName: string;
            type: string;
            id: string;
            className: string;
            text: string;
            placeholder: string;
            ariaLabel: string;
            role: string;
            bounds: { x: number; y: number; width: number; height: number };
            attributes: Record<string, string>;
        },
        serviceName: ServiceProvider
    ): DiscoveredFeature | null {
        // Determine element type
        let elementType: ElementType;
        
        switch (element.tagName) {
            case 'button':
                elementType = 'button';
                break;
            case 'input':
                elementType = this.mapInputType(element.type);
                break;
            case 'select':
                elementType = 'select';
                break;
            case 'textarea':
                elementType = 'textarea';
                break;
            default:
                if (element.role === 'button') elementType = 'button';
                else if (element.role === 'checkbox') elementType = 'checkbox';
                else if (element.role === 'radio') elementType = 'radio';
                else if (element.role === 'slider') elementType = 'slider';
                else if (element.role === 'combobox') elementType = 'dropdown';
                else return null; // Skip unknown elements
        }

        // Generate feature name
        const name = this.generateFeatureName(element);
        const id = `${serviceName}-${elementType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Create selector strategies
        const selectors: SelectorStrategy[] = [];
        
        if (element.id) {
            selectors.push({ css: `#${element.id}`, priority: 1 });
        }
        
        if (element.ariaLabel) {
            selectors.push({ aria: element.ariaLabel, priority: 2 });
        }
        
        if (element.text) {
            selectors.push({ text: element.text, priority: 3 });
        }
        
        if (element.className) {
            selectors.push({ css: `.${element.className.split(' ').join('.')}`, priority: 4 });
        }

        // Generate basic action flow
        const actionFlow: ActionFlow = {
            id: `${id}-default-flow`,
            name: `Default ${elementType} interaction`,
            description: `Default action flow for ${name}`,
            prerequisites: ['element_visible', 'element_enabled'],
            steps: this.generateDefaultActionSteps(elementType, selectors[0]),
            successCriteria: ['action_completed'],
            failureCount: 0
        };

        return {
            id,
            name,
            description: `${elementType} element: ${name}`,
            type: elementType,
            selectors,
            bounds: element.bounds,
            isEnabled: true,
            actionFlows: [actionFlow],
            discoveryMethod: 'dom',
            discoveredAt: new Date(),
            confidence: 0.8 // DOM elements have high confidence
        };
    }

    /**
     * Map HTML input types to ElementType
     */
    private mapInputType(inputType: string): ElementType {
        switch (inputType) {
            case 'checkbox': return 'checkbox';
            case 'radio': return 'radio';
            case 'range': return 'slider';
            case 'text':
            case 'email':
            case 'password':
            case 'search':
            case 'url':
            case 'tel':
            default: return 'input';
        }
    }

    /**
     * Generate human-readable feature name
     */
    private generateFeatureName(element: {
        text: string;
        placeholder: string;
        ariaLabel: string;
        id: string;
        className: string;
    }): string {
        if (element.ariaLabel) return element.ariaLabel;
        if (element.text) return element.text;
        if (element.placeholder) return element.placeholder;
        if (element.id) return element.id.replace(/[-_]/g, ' ');
        if (element.className) {
            return element.className.split(' ')
                .filter(cls => cls.length > 2)
                .join(' ')
                .replace(/[-_]/g, ' ');
        }
        return 'Unnamed element';
    }

    /**
     * Generate default action steps for element type
     */
    private generateDefaultActionSteps(elementType: ElementType, selector: SelectorStrategy): ActionStep[] {
        switch (elementType) {
            case 'button':
                return [{
                    id: 'click-button',
                    description: 'Click the button',
                    action: 'click',
                    target: selector,
                    delay: 100,
                    preconditions: ['element_visible', 'element_enabled'],
                    expectedOutcome: 'button_clicked'
                }];
            
            case 'input':
            case 'textarea':
                return [
                    {
                        id: 'focus-input',
                        description: 'Focus the input field',
                        action: 'click',
                        target: selector,
                        delay: 100,
                        preconditions: ['element_visible'],
                        expectedOutcome: 'input_focused'
                    },
                    {
                        id: 'type-text',
                        description: 'Type text into the field',
                        action: 'type',
                        target: selector,
                        value: '{TEXT_INPUT}',
                        delay: 50,
                        preconditions: ['input_focused'],
                        expectedOutcome: 'text_entered'
                    }
                ];
            
            case 'checkbox':
            case 'toggle':
                return [{
                    id: 'toggle-checkbox',
                    description: 'Toggle the checkbox',
                    action: 'click',
                    target: selector,
                    delay: 100,
                    preconditions: ['element_visible', 'element_enabled'],
                    expectedOutcome: 'checkbox_toggled'
                }];
            
            case 'dropdown':
            case 'select':
                return [
                    {
                        id: 'open-dropdown',
                        description: 'Open the dropdown',
                        action: 'click',
                        target: selector,
                        delay: 100,
                        preconditions: ['element_visible', 'element_enabled'],
                        expectedOutcome: 'dropdown_opened'
                    },
                    {
                        id: 'select-option',
                        description: 'Select an option',
                        action: 'select',
                        target: selector,
                        value: '{OPTION_VALUE}',
                        delay: 100,
                        preconditions: ['dropdown_opened'],
                        expectedOutcome: 'option_selected'
                    }
                ];
            
            default:
                return [{
                    id: 'interact-element',
                    description: 'Interact with the element',
                    action: 'click',
                    target: selector,
                    delay: 100,
                    preconditions: ['element_visible'],
                    expectedOutcome: 'interaction_completed'
                }];
        }
    }

    /**
     * Discover features using vision analysis (placeholder - would integrate with vision model)
     */
    private async discoverFeaturesVision(page: Page, serviceName: ServiceProvider): Promise<DiscoveredFeature[]> {
        // Placeholder for vision-based discovery
        // In a real implementation, this would:
        // 1. Take a screenshot of the page
        // 2. Send it to a vision model (GPT-4V, Claude Vision, etc.)
        // 3. Parse the response to identify interactive elements
        // 4. Create DiscoveredFeature objects from the results

        this.log('Vision-based discovery not implemented yet');
        return [];
    }

    /**
     * Merge and deduplicate feature discoveries from different methods
     */
    private mergeFeatureDiscoveries(
        features: DiscoveredFeature[],
        minConfidence: number
    ): DiscoveredFeature[] {
        // Filter by confidence
        const filteredFeatures = features.filter(f => f.confidence >= minConfidence);
        
        // Simple deduplication by bounds proximity and type
        const merged: DiscoveredFeature[] = [];
        
        for (const feature of filteredFeatures) {
            const existing = merged.find(m => 
                m.type === feature.type &&
                this.areElementsNearby(m.bounds, feature.bounds, 10)
            );
            
            if (!existing) {
                merged.push(feature);
            } else {
                // Merge selectors and use higher confidence
                if (feature.confidence > existing.confidence) {
                    existing.selectors.push(...feature.selectors);
                    existing.confidence = feature.confidence;
                    existing.discoveryMethod = 'hybrid';
                }
            }
        }
        
        return merged;
    }

    /**
     * Check if two elements are nearby (for deduplication)
     */
    private areElementsNearby(
        bounds1?: { x: number; y: number; width: number; height: number },
        bounds2?: { x: number; y: number; width: number; height: number },
        threshold: number = 10
    ): boolean {
        if (!bounds1 || !bounds2) return false;
        
        return Math.abs(bounds1.x - bounds2.x) <= threshold &&
               Math.abs(bounds1.y - bounds2.y) <= threshold;
    }

    /**
     * Analyze network patterns for API endpoint detection
     */
    private async analyzeNetworkPatterns(page: Page, service: ServiceConfig): Promise<void> {
        // Listen to network events and analyze patterns
        // This would be used to detect API endpoints, WebSocket connections, etc.
        this.log(`Network pattern analysis for ${service.name} not fully implemented`);
    }

    /**
     * Get a specific feature for a service
     */
    public getFeature(serviceName: ServiceProvider, featureName: string): DiscoveredFeature | null {
        const service = this.services.get(serviceName);
        if (!service) return null;
        
        return service.features.get(featureName) || null;
    }

    /**
     * List all features for a service
     */
    public listFeatures(serviceName: ServiceProvider): DiscoveredFeature[] {
        const service = this.services.get(serviceName);
        if (!service) return [];
        
        return Array.from(service.features.values());
    }

    /**
     * Update feature data
     */
    public updateFeature(
        serviceName: ServiceProvider,
        featureName: string,
        updates: Partial<DiscoveredFeature>
    ): boolean {
        const service = this.services.get(serviceName);
        if (!service) return false;
        
        const feature = service.features.get(featureName);
        if (!feature) return false;
        
        Object.assign(feature, updates);
        feature.lastVerified = new Date();
        
        return true;
    }

    /**
     * Get action flow for a specific feature
     */
    public getActionFlow(serviceName: ServiceProvider, featureName: string, flowId?: string): ActionFlow | null {
        const feature = this.getFeature(serviceName, featureName);
        if (!feature) return null;
        
        if (flowId) {
            return feature.actionFlows.find(flow => flow.id === flowId) || null;
        }
        
        // Return the first (default) action flow
        return feature.actionFlows[0] || null;
    }

    /**
     * Get service configuration
     */
    public getService(serviceName: ServiceProvider): ServiceConfig | null {
        return this.services.get(serviceName) || null;
    }

    /**
     * List all registered services
     */
    public listServices(): ServiceConfig[] {
        return Array.from(this.services.values());
    }

    /**
     * Check service health status
     */
    public async checkServiceHealth(serviceName: ServiceProvider, page: Page): Promise<'healthy' | 'degraded' | 'down'> {
        const service = this.services.get(serviceName);
        if (!service) return 'down';
        
        try {
            await page.goto(service.baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
            service.healthStatus = 'healthy';
            service.lastHealthCheck = new Date();
            return 'healthy';
        } catch (error) {
            service.healthStatus = 'down';
            service.lastHealthCheck = new Date();
            this.logError(`Health check failed for ${service.name}`, error);
            return 'down';
        }
    }

    /**
     * Export service configuration for backup/sharing
     */
    public exportServiceConfig(serviceName: ServiceProvider): string | null {
        const service = this.services.get(serviceName);
        if (!service) return null;
        
        // Convert Map to object for JSON serialization
        const exportData = {
            ...service,
            features: Object.fromEntries(service.features)
        };
        
        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Import service configuration from backup/sharing
     */
    public importServiceConfig(configJson: string): boolean {
        try {
            const config = JSON.parse(configJson);
            
            // Convert features object back to Map
            const featuresMap = new Map(Object.entries(config.features));
            
            const serviceConfig: ServiceConfig = {
                ...config,
                features: featuresMap
            };
            
            this.services.set(config.id, serviceConfig);
            this.log(`Imported configuration for ${config.name}`);
            return true;
        } catch (error) {
            this.logError('Failed to import service configuration', error);
            return false;
        }
    }

    /**
     * Clear all discovered features for a service
     */
    public clearFeatures(serviceName: ServiceProvider): boolean {
        const service = this.services.get(serviceName);
        if (!service) return false;
        
        service.features.clear();
        service.discoveryStatus = 'pending';
        this.log(`Cleared features for ${service.name}`);
        return true;
    }

    /**
     * Get registry statistics
     */
    public getStats(): {
        totalServices: number;
        totalFeatures: number;
        servicesByStatus: Record<string, number>;
        featuresByType: Record<string, number>;
    } {
        const stats = {
            totalServices: this.services.size,
            totalFeatures: 0,
            servicesByStatus: {} as Record<string, number>,
            featuresByType: {} as Record<string, number>
        };
        
        for (const service of this.services.values()) {
            stats.totalFeatures += service.features.size;
            
            stats.servicesByStatus[service.discoveryStatus] = 
                (stats.servicesByStatus[service.discoveryStatus] || 0) + 1;
            
            for (const feature of service.features.values()) {
                stats.featuresByType[feature.type] = 
                    (stats.featuresByType[feature.type] || 0) + 1;
            }
        }
        
        return stats;
    }

    /**
     * Logging utility
     */
    private log(message: string): void {
        if (this.debugMode) {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] [ServiceRegistry] ${message}`);
        }
    }

    /**
     * Error logging utility
     */
    private logError(message: string, error: unknown): void {
        const timestamp = new Date().toISOString();
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[${timestamp}] [ServiceRegistry] ${message}: ${errorMessage}`);
        
        if (this.debugMode && error instanceof Error && error.stack) {
            console.error(error.stack);
        }
    }
}