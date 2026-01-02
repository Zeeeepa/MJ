/**
 * Stealth Strategy Usage Demo
 * 
 * Demonstrates how to use the StealthStrategy for advanced browser automation
 * with anti-detection capabilities.
 */

import { chromium, Browser, Page } from 'playwright';
import { StealthStrategy, StealthConfig, ElementContext, ElementAction } from '../strategies';

/**
 * Demo configuration for stealth operations
 */
const stealthConfig: StealthConfig = {
    humanizeDelays: true,
    delayRange: [150, 400],
    humanizeMouse: true,
    randomizeFingerprints: true,
    webrtcProtection: true,
    rotateUserAgent: true,
    spoofTimezone: true,
    maxRetries: 3,
    randomizeViewport: true,
    // Custom user agents (optional)
    userAgents: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ],
    // Custom timezones (optional)
    timezones: [
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo'
    ]
};

/**
 * Demonstration of stealth strategy capabilities
 */
async function demonstrateStealthStrategy(): Promise<void> {
    let browser: Browser | null = null;
    let page: Page | null = null;
    
    try {
        console.log('🚀 Starting Stealth Strategy Demo...');
        
        // Initialize browser with stealth-friendly settings
        browser = await chromium.launch({
            headless: false, // Set to true for production
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-extensions-except=',
                '--disable-extensions',
                '--no-first-run',
                '--disable-default-apps',
                '--disable-dev-shm-usage'
            ]
        });

        page = await browser.newPage();
        
        // Initialize the stealth strategy
        const stealthStrategy = new StealthStrategy(stealthConfig);
        await stealthStrategy.initialize(page, stealthConfig);
        
        console.log('✅ Stealth strategy initialized successfully');
        
        // Navigate to a test page
        const testUrl = 'https://bot.sannysoft.com'; // Bot detection test site
        console.log(`🔍 Navigating to bot detection test: ${testUrl}`);
        await page.goto(testUrl, { waitUntil: 'networkidle' });
        
        // Wait a moment for the page to settle
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Demonstrate element identification
        await demonstrateElementIdentification(stealthStrategy);
        
        // Demonstrate various actions
        await demonstrateStealthActions(stealthStrategy);
        
        // Get capability score for this context
        const capabilityScore = stealthStrategy.getCapabilityScore({
            url: testUrl,
            title: await page.title(),
            antiBotMeasures: ['canvas-fingerprinting', 'webrtc-detection'],
            complexity: {
                interactiveElements: 10,
                hasDynamicContent: true,
                hasCaptcha: false,
                hasBotDetection: true
            }
        });
        
        console.log(`🎯 Capability score for this context: ${capabilityScore.toFixed(2)}`);
        
        // Clean up the strategy
        await stealthStrategy.cleanup();
        console.log('🧹 Strategy cleaned up successfully');
        
    } catch (error) {
        console.error('❌ Demo failed:', error instanceof Error ? error.message : error);
    } finally {
        // Cleanup browser resources
        if (page) await page.close();
        if (browser) await browser.close();
        console.log('🏁 Demo completed');
    }
}

/**
 * Demonstrate element identification capabilities
 */
async function demonstrateElementIdentification(strategy: StealthStrategy): Promise<void> {
    console.log('\n🔍 Demonstrating element identification...');
    
    // Example element contexts to search for
    const elementContexts: ElementContext[] = [
        {
            selector: 'h1',
            elementType: 'heading'
        },
        {
            text: 'user agent',
            elementType: 'text'
        },
        {
            xpath: '//div[contains(@class, "result")]',
            elementType: 'result-div'
        }
    ];
    
    for (const context of elementContexts) {
        try {
            const elements = await strategy.identifyElements(context);
            console.log(`  ✅ Found ${elements.length} elements using ${context.elementType} context`);
            
            // Validate the first element if found
            if (elements.length > 0) {
                const validation = await strategy.validateElement(elements[0]);
                console.log(`    🔍 Element validation: ${validation.isValid ? 'VALID' : 'INVALID'}`);
                if (!validation.isValid && validation.error) {
                    console.log(`    ⚠️  Validation error: ${validation.error}`);
                }
            }
        } catch (error) {
            console.log(`  ❌ Failed to identify ${context.elementType} elements: ${error instanceof Error ? error.message : error}`);
        }
    }
}

/**
 * Demonstrate various stealth actions
 */
async function demonstrateStealthActions(strategy: StealthStrategy): Promise<void> {
    console.log('\n🎭 Demonstrating stealth actions...');
    
    try {
        // Find elements we can interact with
        const buttonContext: ElementContext = {
            selector: 'button, input[type="button"], a',
            elementType: 'interactive'
        };
        
        const interactiveElements = await strategy.identifyElements(buttonContext);
        
        if (interactiveElements.length > 0) {
            const element = interactiveElements[0];
            
            // Demonstrate various actions
            const actions: ElementAction[] = [
                { type: 'hover' },
                { type: 'focus' },
                { type: 'blur' }
            ];
            
            for (const action of actions) {
                try {
                    console.log(`  🎯 Executing ${action.type} action...`);
                    await strategy.executeAction(element, action);
                    console.log(`    ✅ ${action.type} action completed successfully`);
                } catch (error) {
                    console.log(`    ❌ ${action.type} action failed: ${error instanceof Error ? error.message : error}`);
                }
            }
        } else {
            console.log('  ⚠️  No interactive elements found for action demonstration');
        }
    } catch (error) {
        console.log(`  ❌ Action demonstration failed: ${error instanceof Error ? error.message : error}`);
    }
}

/**
 * Run the demonstration
 */
if (require.main === module) {
    demonstrateStealthStrategy()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

export { demonstrateStealthStrategy };