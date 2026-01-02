/**
 * All Services Demo
 * 
 * Discovers and tests all 5 AI chat services:
 * - DeepSeek (internet toggle, model selection)
 * - Grok (feature discovery)
 * - Qwen (feature discovery)
 * - Z.AI (feature discovery)
 * - Mistral (feature discovery)
 */

import { chromium, Browser, Page } from 'playwright';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config({ path: '.env.local' });

interface ServiceConfig {
    name: string;
    url: string;
    email: string;
    password: string;
    knownFeatures?: string[];
}

const SERVICES: ServiceConfig[] = [
    {
        name: 'DeepSeek',
        url: process.env.DEEPSEEK_URL || 'https://chat.deepseek.com/',
        email: process.env.DEEPSEEK_EMAIL || '',
        password: process.env.DEEPSEEK_PASSWORD || '',
        knownFeatures: ['internet toggle', 'model selection dropdown']
    },
    {
        name: 'Grok',
        url: process.env.GROK_URL || 'https://grok.com/',
        email: process.env.GROK_EMAIL || '',
        password: process.env.GROK_PASSWORD || '',
        knownFeatures: []
    },
    {
        name: 'Qwen',
        url: process.env.QWEN_URL || 'https://chat.qwen.ai/',
        email: process.env.QWEN_EMAIL || '',
        password: process.env.QWEN_PASSWORD || '',
        knownFeatures: []
    },
    {
        name: 'Z.AI',
        url: process.env.ZAI_URL || 'https://chat.z.ai/',
        email: process.env.ZAI_EMAIL || '',
        password: process.env.ZAI_PASSWORD || '',
        knownFeatures: []
    },
    {
        name: 'Mistral',
        url: process.env.MISTRAL_URL || 'https://chat.mistral.ai',
        email: process.env.MISTRAL_EMAIL || '',
        password: process.env.MISTRAL_PASSWORD || '',
        knownFeatures: []
    }
];

/**
 * Test authentication for a service
 */
async function testServiceAuth(service: ServiceConfig, browser: Browser): Promise<boolean> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing ${service.name}`);
    console.log(`${'='.repeat(60)}`);

    const page = await browser.newPage();
    
    try {
        console.log(`\n1. Navigating to ${service.url}...`);
        await page.goto(service.url, { waitUntil: 'networkidle', timeout: 30000 });
        
        await page.screenshot({ 
            path: `${service.name.toLowerCase()}-01-initial.png`, 
            fullPage: true 
        });
        console.log(`   ✓ Initial screenshot saved`);

        // Try to find login elements
        console.log(`\n2. Searching for login elements...`);
        
        const emailSelectors = [
            'input[type="email"]',
            'input[name="email"]',
            'input[placeholder*="email" i]',
            'input[id*="email" i]',
            'input[name="username"]'
        ];

        let emailInput = null;
        for (const selector of emailSelectors) {
            try {
                emailInput = await page.waitForSelector(selector, { timeout: 2000 });
                if (emailInput) {
                    console.log(`   ✓ Found email input: ${selector}`);
                    break;
                }
            } catch (e) {
                // Try next selector
            }
        }

        if (!emailInput) {
            console.log(`   ⚠ No email input found - might be a direct chat interface`);
            return await testDirectChatInterface(service, page);
        }

        // Find password input
        const passwordSelectors = [
            'input[type="password"]',
            'input[name="password"]'
        ];

        let passwordInput = null;
        for (const selector of passwordSelectors) {
            try {
                passwordInput = await page.waitForSelector(selector, { timeout: 2000 });
                if (passwordInput) {
                    console.log(`   ✓ Found password input: ${selector}`);
                    break;
                }
            } catch (e) {
                // Try next selector
            }
        }

        if (!passwordInput) {
            console.log(`   ✗ Password input not found`);
            return false;
        }

        // Enter credentials
        console.log(`\n3. Entering credentials...`);
        await emailInput.fill(service.email);
        await page.waitForTimeout(300);
        await passwordInput.fill(service.password);
        await page.waitForTimeout(300);
        console.log(`   ✓ Credentials entered`);

        await page.screenshot({ 
            path: `${service.name.toLowerCase()}-02-credentials.png`, 
            fullPage: true 
        });

        // Find and click submit
        const submitSelectors = [
            'button[type="submit"]',
            'button:has-text("Sign in")',
            'button:has-text("Login")',
            'button:has-text("Log in")',
            'button:has-text("Continue")',
            'input[type="submit"]'
        ];

        let submitted = false;
        for (const selector of submitSelectors) {
            try {
                const submitBtn = await page.$(selector);
                if (submitBtn) {
                    console.log(`\n4. Clicking submit button: ${selector}...`);
                    await submitBtn.click();
                    submitted = true;
                    break;
                }
            } catch (e) {
                // Try next selector
            }
        }

        if (!submitted) {
            console.log(`   ✗ Submit button not found`);
            return false;
        }

        // Wait for navigation or response
        await page.waitForTimeout(3000);

        await page.screenshot({ 
            path: `${service.name.toLowerCase()}-03-post-login.png`, 
            fullPage: true 
        });

        const currentUrl = page.url();
        console.log(`\n5. Current URL: ${currentUrl}`);

        // Check if we're logged in
        const urlChanged = currentUrl !== service.url && !currentUrl.includes('login');
        if (urlChanged) {
            console.log(`   ✓ ${service.name} authentication successful!`);
            await discoverFeatures(service, page);
            return true;
        } else {
            console.log(`   ⚠ Still on login page - checking for errors...`);
            // Look for error messages
            const errorSelectors = ['.error', '[role="alert"]', '.alert-danger'];
            for (const selector of errorSelectors) {
                const error = await page.$(selector);
                if (error) {
                    const text = await error.textContent();
                    console.log(`   ✗ Error: ${text}`);
                }
            }
            return false;
        }

    } catch (error) {
        console.error(`   ✗ Error testing ${service.name}:`, error);
        return false;
    } finally {
        await page.close();
    }
}

/**
 * Test direct chat interface (no login required)
 */
async function testDirectChatInterface(service: ServiceConfig, page: Page): Promise<boolean> {
    console.log(`\n   Checking for direct chat interface...`);
    
    // Look for chat input elements
    const chatInputSelectors = [
        'textarea[placeholder*="message" i]',
        'textarea[placeholder*="type" i]',
        'input[placeholder*="message" i]',
        '[contenteditable="true"]',
        'textarea'
    ];

    for (const selector of chatInputSelectors) {
        try {
            const input = await page.waitForSelector(selector, { timeout: 2000 });
            if (input) {
                console.log(`   ✓ Found chat input: ${selector}`);
                console.log(`   ✓ ${service.name} appears to be a direct chat interface!`);
                await discoverFeatures(service, page);
                return true;
            }
        } catch (e) {
            // Try next selector
        }
    }

    console.log(`   ✗ No chat interface found`);
    return false;
}

/**
 * Discover features on the authenticated page
 */
async function discoverFeatures(service: ServiceConfig, page: Page): Promise<void> {
    console.log(`\n6. Discovering features for ${service.name}...`);

    // Get all interactive elements
    const features = await page.evaluate(() => {
        const discovered: { type: string; text: string; selector: string }[] = [];

        // Find buttons
        document.querySelectorAll('button').forEach((btn, idx) => {
            const text = btn.textContent?.trim() || '';
            if (text && text.length < 50) {
                discovered.push({
                    type: 'button',
                    text,
                    selector: `button:nth-of-type(${idx + 1})`
                });
            }
        });

        // Find toggles/switches
        document.querySelectorAll('[role="switch"], input[type="checkbox"]').forEach((toggle, idx) => {
            const label = toggle.getAttribute('aria-label') || 
                         toggle.parentElement?.textContent?.trim() || 
                         'Toggle';
            discovered.push({
                type: 'toggle',
                text: label,
                selector: `[role="switch"]:nth-of-type(${idx + 1}), input[type="checkbox"]:nth-of-type(${idx + 1})`
            });
        });

        // Find dropdowns/selects
        document.querySelectorAll('select, [role="combobox"], [role="listbox"]').forEach((select, idx) => {
            const label = select.getAttribute('aria-label') || 
                         select.getAttribute('name') ||
                         'Dropdown';
            discovered.push({
                type: 'dropdown',
                text: label,
                selector: `select:nth-of-type(${idx + 1}), [role="combobox"]:nth-of-type(${idx + 1})`
            });
        });

        return discovered;
    });

    console.log(`\n   Found ${features.length} interactive elements:`);
    
    const grouped = features.reduce((acc, f) => {
        acc[f.type] = acc[f.type] || [];
        acc[f.type].push(f);
        return acc;
    }, {} as Record<string, typeof features>);

    for (const [type, items] of Object.entries(grouped)) {
        console.log(`\n   ${type.toUpperCase()}S (${items.length}):`);
        items.slice(0, 5).forEach(item => {
            console.log(`     • ${item.text}`);
        });
        if (items.length > 5) {
            console.log(`     ... and ${items.length - 5} more`);
        }
    }

    // Save final screenshot
    await page.screenshot({ 
        path: `${service.name.toLowerCase()}-04-features.png`, 
        fullPage: true 
    });
    console.log(`\n   ✓ Feature discovery complete`);
}

/**
 * Test OpenAI API server with discovered services
 */
async function testAPIServer(): Promise<void> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing OpenAI API Server`);
    console.log(`${'='.repeat(60)}`);

    const apiUrl = `http://localhost:${process.env.OPENAI_API_PORT || 8080}`;
    
    try {
        // Test health endpoint
        console.log(`\n1. Testing health endpoint...`);
        const healthResponse = await axios.get(`${apiUrl}/health`);
        console.log(`   ✓ Server is ${healthResponse.data.status}`);

        // Test models endpoint
        console.log(`\n2. Testing models endpoint...`);
        const modelsResponse = await axios.get(`${apiUrl}/v1/models`);
        console.log(`   ✓ Available models: ${modelsResponse.data.data.length}`);
        
        modelsResponse.data.data.slice(0, 5).forEach((model: { id: string }) => {
            console.log(`     • ${model.id}`);
        });

        // Test services endpoint
        console.log(`\n3. Testing services endpoint...`);
        const servicesResponse = await axios.get(`${apiUrl}/v1/services`);
        console.log(`   ✓ Registered services: ${servicesResponse.data.services.length}`);

    } catch (error) {
        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNREFUSED') {
                console.log(`   ⚠ Server not running. Start with: npm run start:dev`);
            } else {
                console.error(`   ✗ API Error:`, error.response?.data || error.message);
            }
        } else {
            console.error(`   ✗ Error:`, error);
        }
    }
}

/**
 * Main demo runner
 */
async function main(): Promise<void> {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║   Web2API - All Services Discovery Demo                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    // Validate credentials
    const missingCredentials = SERVICES.filter(s => !s.email || !s.password);
    if (missingCredentials.length > 0) {
        console.log('\n⚠ Missing credentials for:');
        missingCredentials.forEach(s => console.log(`  • ${s.name}`));
        console.log('\nPlease set environment variables in .env.local');
        return;
    }

    const browser = await chromium.launch({ 
        headless: false,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
    });

    try {
        const results: Record<string, boolean> = {};

        // Test each service
        for (const service of SERVICES) {
            const success = await testServiceAuth(service, browser);
            results[service.name] = success;
            await new Promise(resolve => setTimeout(resolve, 2000)); // Delay between services
        }

        // Summary
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Summary`);
        console.log(`${'='.repeat(60)}\n`);

        for (const [name, success] of Object.entries(results)) {
            console.log(`${success ? '✓' : '✗'} ${name}: ${success ? 'SUCCESS' : 'FAILED'}`);
        }

        const successCount = Object.values(results).filter(Boolean).length;
        console.log(`\n${successCount}/${SERVICES.length} services authenticated successfully`);

        // Test API server
        await testAPIServer();

    } finally {
        await browser.close();
    }
}

// Run the demo
if (require.main === module) {
    main().catch(error => {
        console.error('Demo failed:', error);
        process.exit(1);
    });
}

export { main, testServiceAuth, discoverFeatures };
