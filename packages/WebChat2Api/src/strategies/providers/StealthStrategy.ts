/**
 * Stealth Strategy Implementation for Web2API
 * 
 * Provides advanced stealth capabilities for browser automation using playwright-toolkit.
 * Includes anti-detection measures, human-like behavior simulation, and fingerprint randomization.
 * 
 * Features:
 * - Stealth plugin integration for detection avoidance
 * - Random delays and human-like mouse movements  
 * - Fingerprint randomization (canvas, webgl, fonts)
 * - WebRTC leak protection
 * - User agent rotation and timezone spoofing
 * - Advanced element identification and interaction
 */

import { Page, Browser, ElementHandle, Locator } from 'playwright';
import { stealth } from '@skrillex1224/playwright-toolkit';
import { BaseStrategy } from '../base/BaseStrategy';

/**
 * Configuration options for stealth behavior
 */
export interface StealthConfig {
    /** Enable human-like delays between actions */
    humanizeDelays?: boolean;
    /** Base delay range in milliseconds [min, max] */
    delayRange?: [number, number];
    /** Enable mouse movement humanization */
    humanizeMouse?: boolean;
    /** Enable fingerprint randomization */
    randomizeFingerprints?: boolean;
    /** Enable WebRTC leak protection */
    webrtcProtection?: boolean;
    /** Enable user agent rotation */
    rotateUserAgent?: boolean;
    /** Enable timezone spoofing */
    spoofTimezone?: boolean;
    /** Custom user agents pool */
    userAgents?: string[];
    /** Custom timezones pool */
    timezones?: string[];
    /** Maximum retry attempts for failed actions */
    maxRetries?: number;
    /** Viewport randomization */
    randomizeViewport?: boolean;
}

/**
 * Element identification context for stealth operations
 */
export interface ElementContext {
    /** CSS selector for the element */
    selector?: string;
    /** XPath expression for the element */
    xpath?: string;
    /** Text content to search for */
    text?: string;
    /** Element role attribute */
    role?: string;
    /** Element aria-label */
    ariaLabel?: string;
    /** Element placeholder text */
    placeholder?: string;
    /** Parent element context */
    parent?: ElementContext;
    /** Index if multiple matches */
    index?: number;
    /** Element type (input, button, etc.) */
    elementType?: string;
}

/**
 * Action types that can be performed on elements
 */
export type ElementAction = 
    | { type: 'click'; button?: 'left' | 'right' | 'middle'; modifiers?: string[] }
    | { type: 'type'; text: string; delay?: number }
    | { type: 'fill'; text: string }
    | { type: 'hover' }
    | { type: 'scroll'; direction: 'up' | 'down' | 'left' | 'right'; distance?: number }
    | { type: 'focus' }
    | { type: 'blur' }
    | { type: 'press'; key: string }
    | { type: 'check' | 'uncheck' }
    | { type: 'select'; option: string }
    | { type: 'upload'; files: string[] };

/**
 * Element validation result
 */
export interface ValidationResult {
    /** Whether the element is valid */
    isValid: boolean;
    /** Validation error message if invalid */
    error?: string;
    /** Element properties for debugging */
    properties?: Record<string, unknown>;
}

/**
 * Capability scoring context
 */
export interface CapabilityContext {
    /** Target website URL */
    url: string;
    /** Page title */
    title?: string;
    /** Detected anti-bot measures */
    antiBotMeasures?: string[];
    /** Required actions */
    requiredActions?: ElementAction[];
    /** Page complexity indicators */
    complexity?: {
        /** Number of interactive elements */
        interactiveElements: number;
        /** Presence of dynamic content */
        hasDynamicContent: boolean;
        /** Presence of CAPTCHA */
        hasCaptcha: boolean;
        /** Presence of bot detection scripts */
        hasBotDetection: boolean;
    };
}

/**
 * Stealth Strategy for advanced browser automation with anti-detection capabilities
 */
export class StealthStrategy extends BaseStrategy {
    private config: Required<StealthConfig>;
    private currentPage: Page | null = null;
    private stealthInitialized = false;
    private userAgentPool: string[] = [];
    private timezonePool: string[] = [];

    constructor(config: StealthConfig = {}) {
        super();
        this.config = this.initializeConfig(config);
        this.initializePools();
    }

    /**
     * Initialize configuration with defaults
     */
    private initializeConfig(config: StealthConfig): Required<StealthConfig> {
        return {
            humanizeDelays: config.humanizeDelays ?? true,
            delayRange: config.delayRange ?? [100, 300],
            humanizeMouse: config.humanizeMouse ?? true,
            randomizeFingerprints: config.randomizeFingerprints ?? true,
            webrtcProtection: config.webrtcProtection ?? true,
            rotateUserAgent: config.rotateUserAgent ?? true,
            spoofTimezone: config.spoofTimezone ?? true,
            userAgents: config.userAgents ?? [],
            timezones: config.timezones ?? [],
            maxRetries: config.maxRetries ?? 3,
            randomizeViewport: config.randomizeViewport ?? true
        };
    }

    /**
     * Initialize user agent and timezone pools
     */
    private initializePools(): void {
        this.userAgentPool = this.config.userAgents.length > 0 
            ? this.config.userAgents 
            : this.getDefaultUserAgents();
        
        this.timezonePool = this.config.timezones.length > 0
            ? this.config.timezones
            : this.getDefaultTimezones();
    }

    /**
     * Initialize the stealth strategy with a page instance
     */
    async initialize(page: Page, config?: StealthConfig): Promise<void> {
        this.currentPage = page;
        
        if (config) {
            this.config = this.initializeConfig(config);
            this.initializePools();
        }

        await this.applyStealthMeasures(page);
        this.stealthInitialized = true;
        this.isInitialized = true;
        
        this.log('StealthStrategy initialized successfully');
    }

    /**
     * Apply comprehensive stealth measures to the page
     */
    private async applyStealthMeasures(page: Page): Promise<void> {
        // Apply playwright-toolkit stealth plugin
        await this.applyStealthPlugin(page);
        
        // Apply additional stealth measures
        await Promise.all([
            this.randomizeViewportIfEnabled(page),
            this.spoofTimezoneIfEnabled(page),
            this.protectWebRTCIfEnabled(page),
            this.randomizeFingerprintsIfEnabled(page)
        ]);
    }

    /**
     * Apply stealth plugin from playwright-toolkit
     */
    private async applyStealthPlugin(page: Page): Promise<void> {
        try {
            await stealth(page);
        } catch (error) {
            throw new Error(`Failed to apply stealth plugin: ${this.getErrorMessage(error)}`);
        }
    }

    /**
     * Randomize viewport dimensions if enabled
     */
    private async randomizeViewportIfEnabled(page: Page): Promise<void> {
        if (!this.config.randomizeViewport) return;

        const viewportSizes = [
            { width: 1920, height: 1080 },
            { width: 1366, height: 768 },
            { width: 1536, height: 864 },
            { width: 1440, height: 900 },
            { width: 1280, height: 720 }
        ];

        const randomViewport = this.getRandomArrayElement(viewportSizes);
        await page.setViewportSize(randomViewport);
    }

    /**
     * Spoof timezone if enabled
     */
    private async spoofTimezoneIfEnabled(page: Page): Promise<void> {
        if (!this.config.spoofTimezone) return;

        const timezone = this.getRandomArrayElement(this.timezonePool);
        await page.emulateTimezone(timezone);
    }

    /**
     * Protect WebRTC if enabled
     */
    private async protectWebRTCIfEnabled(page: Page): Promise<void> {
        if (!this.config.webrtcProtection) return;

        await page.addInitScript(() => {
            // Block WebRTC IP leaks
            Object.defineProperty(navigator, 'mediaDevices', {
                get: () => undefined
            });
            
            // Override RTCPeerConnection
            (window as any).RTCPeerConnection = undefined;
            (window as any).webkitRTCPeerConnection = undefined;
            (window as any).mozRTCPeerConnection = undefined;
        });
    }

    /**
     * Randomize browser fingerprints if enabled
     */
    private async randomizeFingerprintsIfEnabled(page: Page): Promise<void> {
        if (!this.config.randomizeFingerprints) return;

        await page.addInitScript(() => {
            // Canvas fingerprint protection
            const originalGetContext = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function(type: string, ...args: any[]) {
                const context = originalGetContext.call(this, type, ...args);
                if (type === '2d' && context) {
                    const originalFillText = context.fillText;
                    context.fillText = function(text: string, x: number, y: number, maxWidth?: number) {
                        // Add subtle noise to fingerprint
                        const noise = Math.random() * 0.1 - 0.05;
                        return originalFillText.call(this, text, x + noise, y + noise, maxWidth);
                    };
                }
                return context;
            };

            // WebGL fingerprint protection
            const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(parameter: number) {
                if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
                    return 'Intel Inc.';
                }
                if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL  
                    return 'Intel Iris OpenGL Engine';
                }
                return originalGetParameter.call(this, parameter);
            };
        });
    }

    /**
     * Identify elements on the page using multiple strategies
     */
    async identifyElements(context: ElementContext): Promise<ElementHandle[]> {
        this.ensureInitialized();
        
        if (!this.currentPage) {
            throw this.handleError('Page not initialized', 'identifyElements');
        }

        try {
            const elements = await this.findElementsWithMultipleStrategies(context);
            return await this.filterValidElements(elements);
        } catch (error) {
            throw this.handleError(error, 'identifyElements');
        }
    }

    /**
     * Find elements using multiple identification strategies
     */
    private async findElementsWithMultipleStrategies(context: ElementContext): Promise<ElementHandle[]> {
        const strategies = [
            () => this.findBySelectorStrategy(context),
            () => this.findByXPathStrategy(context),
            () => this.findByTextStrategy(context),
            () => this.findByRoleStrategy(context),
            () => this.findByAriaLabelStrategy(context),
            () => this.findByPlaceholderStrategy(context)
        ];

        for (const strategy of strategies) {
            try {
                const elements = await strategy();
                if (elements.length > 0) {
                    return this.selectElementsByIndex(elements, context.index);
                }
            } catch (error) {
                // Continue to next strategy
                console.warn(`Element identification strategy failed: ${this.getErrorMessage(error)}`);
            }
        }

        return [];
    }

    /**
     * Find elements by CSS selector
     */
    private async findBySelectorStrategy(context: ElementContext): Promise<ElementHandle[]> {
        if (!context.selector || !this.currentPage) return [];
        return this.currentPage.$$eval(context.selector, elements => elements as any);
    }

    /**
     * Find elements by XPath
     */
    private async findByXPathStrategy(context: ElementContext): Promise<ElementHandle[]> {
        if (!context.xpath || !this.currentPage) return [];
        return this.currentPage.$$(`xpath=${context.xpath}`);
    }

    /**
     * Find elements by text content
     */
    private async findByTextStrategy(context: ElementContext): Promise<ElementHandle[]> {
        if (!context.text || !this.currentPage) return [];
        return this.currentPage.getByText(context.text, { exact: false }).all();
    }

    /**
     * Find elements by role attribute
     */
    private async findByRoleStrategy(context: ElementContext): Promise<ElementHandle[]> {
        if (!context.role || !this.currentPage) return [];
        return this.currentPage.getByRole(context.role as any).all();
    }

    /**
     * Find elements by aria-label
     */
    private async findByAriaLabelStrategy(context: ElementContext): Promise<ElementHandle[]> {
        if (!context.ariaLabel || !this.currentPage) return [];
        return this.currentPage.getByLabel(context.ariaLabel).all();
    }

    /**
     * Find elements by placeholder text
     */
    private async findByPlaceholderStrategy(context: ElementContext): Promise<ElementHandle[]> {
        if (!context.placeholder || !this.currentPage) return [];
        return this.currentPage.getByPlaceholder(context.placeholder).all();
    }

    /**
     * Select elements by index if specified
     */
    private selectElementsByIndex(elements: ElementHandle[], index?: number): ElementHandle[] {
        if (index === undefined) return elements;
        if (index < 0 || index >= elements.length) return [];
        return [elements[index]];
    }

    /**
     * Filter out invalid elements
     */
    private async filterValidElements(elements: ElementHandle[]): Promise<ElementHandle[]> {
        const validElements: ElementHandle[] = [];
        
        for (const element of elements) {
            try {
                const isVisible = await element.isVisible();
                const isEnabled = await element.isEnabled();
                
                if (isVisible && isEnabled) {
                    validElements.push(element);
                }
            } catch (error) {
                // Element is likely stale, skip it
                continue;
            }
        }
        
        return validElements;
    }

    /**
     * Execute an action on an element with stealth measures
     */
    async executeAction(element: ElementHandle, action: ElementAction): Promise<void> {
        this.ensureInitialized();
        
        try {
            await this.humanizeDelayIfEnabled();
            
            const executeWithRetry = async (): Promise<void> => {
            switch (action.type) {
                case 'click':
                    await this.executeClickAction(element, action);
                    break;
                case 'type':
                    await this.executeTypeAction(element, action);
                    break;
                case 'fill':
                    await this.executeFillAction(element, action);
                    break;
                case 'hover':
                    await this.executeHoverAction(element);
                    break;
                case 'scroll':
                    await this.executeScrollAction(element, action);
                    break;
                case 'focus':
                    await element.focus();
                    break;
                case 'blur':
                    await element.blur();
                    break;
                case 'press':
                    await this.executePressAction(element, action);
                    break;
                case 'check':
                case 'uncheck':
                    await this.executeCheckAction(element, action);
                    break;
                case 'select':
                    await this.executeSelectAction(element, action);
                    break;
                case 'upload':
                    await this.executeUploadAction(element, action);
                    break;
                default:
                    throw new Error(`Unsupported action type: ${(action as any).type}`);
            }
            };

            await this.retryWithExponentialBackoff(executeWithRetry, this.config.maxRetries);
        } catch (error) {
            throw this.handleError(error, 'executeAction');
        }
    }

    /**
     * Execute click action with human-like behavior
     */
    private async executeClickAction(element: ElementHandle, action: { type: 'click'; button?: 'left' | 'right' | 'middle'; modifiers?: string[] }): Promise<void> {
        if (this.config.humanizeMouse) {
            await this.humanizeMouseMovement(element);
        }
        
        await element.click({
            button: action.button,
            modifiers: action.modifiers as any
        });
    }

    /**
     * Execute type action with humanized timing
     */
    private async executeTypeAction(element: ElementHandle, action: { type: 'type'; text: string; delay?: number }): Promise<void> {
        const delay = action.delay ?? (this.config.humanizeDelays ? this.getRandomDelay() : 0);
        await element.type(action.text, { delay });
    }

    /**
     * Execute fill action
     */
    private async executeFillAction(element: ElementHandle, action: { type: 'fill'; text: string }): Promise<void> {
        await element.fill(action.text);
    }

    /**
     * Execute hover action with human-like movement
     */
    private async executeHoverAction(element: ElementHandle): Promise<void> {
        if (this.config.humanizeMouse) {
            await this.humanizeMouseMovement(element);
        }
        await element.hover();
    }

    /**
     * Execute scroll action
     */
    private async executeScrollAction(element: ElementHandle, action: { type: 'scroll'; direction: 'up' | 'down' | 'left' | 'right'; distance?: number }): Promise<void> {
        const distance = action.distance ?? 500;
        const deltaMap = {
            up: { deltaY: -distance },
            down: { deltaY: distance },
            left: { deltaX: -distance },
            right: { deltaX: distance }
        };
        
        await element.hover(); // Ensure element is in focus
        await this.currentPage!.mouse.wheel(deltaMap[action.direction].deltaX ?? 0, deltaMap[action.direction].deltaY ?? 0);
    }

    /**
     * Execute press key action
     */
    private async executePressAction(element: ElementHandle, action: { type: 'press'; key: string }): Promise<void> {
        await element.press(action.key);
    }

    /**
     * Execute check/uncheck action
     */
    private async executeCheckAction(element: ElementHandle, action: { type: 'check' | 'uncheck' }): Promise<void> {
        const isChecked = await element.isChecked();
        const shouldCheck = action.type === 'check';
        
        if (isChecked !== shouldCheck) {
            await element.click();
        }
    }

    /**
     * Execute select option action
     */
    private async executeSelectAction(element: ElementHandle, action: { type: 'select'; option: string }): Promise<void> {
        await element.selectOption(action.option);
    }

    /**
     * Execute file upload action
     */
    private async executeUploadAction(element: ElementHandle, action: { type: 'upload'; files: string[] }): Promise<void> {
        await element.setInputFiles(action.files);
    }

    /**
     * Humanize mouse movement to appear more natural
     */
    private async humanizeMouseMovement(element: ElementHandle): Promise<void> {
        if (!this.currentPage) return;

        const box = await element.boundingBox();
        if (!box) return;

        const targetX = box.x + box.width / 2;
        const targetY = box.y + box.height / 2;
        
        // Get current mouse position or use random starting point
        const currentPos = await this.getCurrentMousePosition();
        
        // Create curved path to target
        const steps = this.generateMousePath(currentPos, { x: targetX, y: targetY });
        
        for (const step of steps) {
            await this.currentPage.mouse.move(step.x, step.y);
            await this.randomDelay(10, 30); // Small delay between movements
        }
    }

    /**
     * Get current mouse position (fallback to center of viewport)
     */
    private async getCurrentMousePosition(): Promise<{ x: number; y: number }> {
        const viewportSize = this.currentPage!.viewportSize();
        return {
            x: viewportSize ? viewportSize.width / 2 : 640,
            y: viewportSize ? viewportSize.height / 2 : 360
        };
    }

    /**
     * Generate natural mouse movement path using Bezier curve
     */
    private generateMousePath(start: { x: number; y: number }, end: { x: number; y: number }): { x: number; y: number }[] {
        const steps = 10 + Math.floor(Math.random() * 10); // 10-20 steps
        const path: { x: number; y: number }[] = [];
        
        // Add some randomness to the path
        const midX = (start.x + end.x) / 2 + (Math.random() - 0.5) * 100;
        const midY = (start.y + end.y) / 2 + (Math.random() - 0.5) * 100;
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = this.quadraticBezier(start.x, midX, end.x, t);
            const y = this.quadraticBezier(start.y, midY, end.y, t);
            path.push({ x, y });
        }
        
        return path;
    }

    /**
     * Calculate quadratic Bezier curve point
     */
    private quadraticBezier(p0: number, p1: number, p2: number, t: number): number {
        return Math.pow(1 - t, 2) * p0 + 2 * (1 - t) * t * p1 + Math.pow(t, 2) * p2;
    }

    /**
     * Validate that an element is ready for interaction
     */
    async validateElement(element: ElementHandle): Promise<ValidationResult> {
        try {
            const [isVisible, isEnabled, boundingBox] = await Promise.all([
                element.isVisible(),
                element.isEnabled(),
                element.boundingBox()
            ]);

            if (!isVisible) {
                return { isValid: false, error: 'Element is not visible' };
            }

            if (!isEnabled) {
                return { isValid: false, error: 'Element is not enabled' };
            }

            if (!boundingBox) {
                return { isValid: false, error: 'Element has no bounding box' };
            }

            const properties = await this.getElementProperties(element);
            
            return {
                isValid: true,
                properties
            };
        } catch (error) {
            return {
                isValid: false,
                error: `Element validation failed: ${this.getErrorMessage(error)}`
            };
        }
    }

    /**
     * Get element properties for debugging
     */
    private async getElementProperties(element: ElementHandle): Promise<Record<string, unknown>> {
        try {
            return await element.evaluate((el) => ({
                tagName: el.tagName,
                id: el.id,
                className: el.className,
                textContent: el.textContent?.trim(),
                type: (el as HTMLInputElement).type,
                value: (el as HTMLInputElement).value,
                href: (el as HTMLAnchorElement).href
            }));
        } catch (error) {
            return { error: this.getErrorMessage(error) };
        }
    }

    /**
     * Get capability score for handling a specific context
     */
    getCapabilityScore(context: CapabilityContext): number {
        let score = 0.5; // Base score
        
        // Boost score for sites that might have anti-bot measures
        if (context.antiBotMeasures && context.antiBotMeasures.length > 0) {
            score += 0.3;
        }
        
        // Boost score for complex interactions
        if (context.complexity) {
            if (context.complexity.hasBotDetection) score += 0.2;
            if (context.complexity.hasCaptcha) score += 0.1;
            if (context.complexity.hasDynamicContent) score += 0.1;
            if (context.complexity.interactiveElements > 50) score += 0.1;
        }
        
        // Boost score for financial or social media sites (common targets for protection)
        const protectedDomains = ['bank', 'finance', 'payment', 'social', 'auth', 'login'];
        const urlLower = context.url.toLowerCase();
        if (protectedDomains.some(domain => urlLower.includes(domain))) {
            score += 0.2;
        }

        return Math.min(score, 1.0); // Cap at 1.0
    }

    /**
     * Cleanup resources and reset state
     */
    async cleanup(): Promise<void> {
        try {
            this.currentPage = null;
            this.stealthInitialized = false;
            this.isInitialized = false;
            this.log('StealthStrategy cleaned up successfully');
        } catch (error) {
            this.handleError(error, 'cleanup');
        }
    }

    /**
     * Generate humanized delay if enabled
     */
    private async humanizeDelayIfEnabled(): Promise<void> {
        if (!this.config.humanizeDelays) return;
        await this.randomDelay(...this.config.delayRange);
    }

    /**
     * Random delay between min and max milliseconds
     */
    private async randomDelay(min: number, max: number): Promise<void> {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Get random delay based on configuration
     */
    private getRandomDelay(): number {
        const [min, max] = this.config.delayRange;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Get random element from array
     */
    private getRandomArrayElement<T>(array: T[]): T {
        return array[Math.floor(Math.random() * array.length)];
    }

    /**
     * Get default user agent pool
     */
    private getDefaultUserAgents(): string[] {
        return [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ];
    }

    /**
     * Get default timezone pool
     */
    private getDefaultTimezones(): string[] {
        return [
            'America/New_York',
            'America/Chicago',
            'America/Denver', 
            'America/Los_Angeles',
            'Europe/London',
            'Europe/Paris',
            'Europe/Berlin',
            'Asia/Tokyo',
            'Asia/Shanghai',
            'Australia/Sydney'
        ];
    }

    /**
     * Retry function with exponential backoff
     */
    private async retryWithExponentialBackoff<T>(
        fn: () => Promise<T>,
        maxRetries: number
    ): Promise<T> {
        let lastError: Error;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                
                if (attempt === maxRetries) {
                    throw lastError;
                }
                
                // Exponential backoff delay
                const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw lastError!;
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
}