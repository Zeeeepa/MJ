/**
 * K2Think.ai End-to-End Demo
 * 
 * Demonstrates the complete Web2API system with auto feature identification,
 * OpenAI-compatible API access, and proper stealth browser automation.
 */

import { chromium, Browser, Page } from 'playwright';
import dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config({ path: '.env.local' });

interface K2ThinkCredentials {
    url: string;
    email: string;
    password: string;
}

interface OpenAIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/**
 * Test K2Think.ai authentication
 */
async function testK2ThinkAuthentication(): Promise<void> {
    console.log('\n=== K2Think.ai Authentication Test ===\n');

    const credentials: K2ThinkCredentials = {
        url: process.env.K2THINK_URL || 'https://www.k2think.ai',
        email: process.env.K2THINK_EMAIL || '',
        password: process.env.K2THINK_PASSWORD || ''
    };

    if (!credentials.email || !credentials.password) {
        throw new Error('K2Think credentials not found in environment variables');
    }

    const browser = await chromium.launch({ 
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-blink-features=AutomationControlled'
        ]
    });

    try {
        const page = await browser.newPage();
        await page.setViewportSize({ width: 1920, height: 1080 });

        console.log(`Navigating to ${credentials.url}...`);
        await page.goto(credentials.url, { waitUntil: 'networkidle' });
        
        // Take initial screenshot
        await page.screenshot({ path: 'k2think-initial.png', fullPage: true });
        console.log('✓ Initial page loaded');

        // Look for login elements
        console.log('\nSearching for login elements...');
        
        // Try multiple selectors for email input
        const emailSelectors = [
            'input[type="email"]',
            'input[name="email"]',
            'input[placeholder*="email" i]',
            'input[id*="email" i]',
            '#email',
            '[data-testid*="email"]'
        ];

        let emailInput = null;
        for (const selector of emailSelectors) {
            try {
                emailInput = await page.waitForSelector(selector, { timeout: 2000 });
                if (emailInput) {
                    console.log(`✓ Found email input with selector: ${selector}`);
                    break;
                }
            } catch (e) {
                // Try next selector
            }
        }

        if (!emailInput) {
            console.log('Email input not found. Taking screenshot for analysis...');
            await page.screenshot({ path: 'k2think-no-email.png', fullPage: true });
            throw new Error('Email input not found');
        }

        // Try multiple selectors for password input
        const passwordSelectors = [
            'input[type="password"]',
            'input[name="password"]',
            'input[placeholder*="password" i]',
            'input[id*="password" i]',
            '#password',
            '[data-testid*="password"]'
        ];

        let passwordInput = null;
        for (const selector of passwordSelectors) {
            try {
                passwordInput = await page.waitForSelector(selector, { timeout: 2000 });
                if (passwordInput) {
                    console.log(`✓ Found password input with selector: ${selector}`);
                    break;
                }
            } catch (e) {
                // Try next selector
            }
        }

        if (!passwordInput) {
            console.log('Password input not found. Taking screenshot for analysis...');
            await page.screenshot({ path: 'k2think-no-password.png', fullPage: true });
            throw new Error('Password input not found');
        }

        // Fill in credentials with human-like delays
        console.log('\nEntering credentials...');
        await emailInput.fill(credentials.email);
        await page.waitForTimeout(500);
        
        await passwordInput.fill(credentials.password);
        await page.waitForTimeout(500);

        // Look for submit button
        const submitSelectors = [
            'button[type="submit"]',
            'button:has-text("Sign in")',
            'button:has-text("Login")',
            'button:has-text("Log in")',
            'input[type="submit"]',
            '[data-testid*="submit"]',
            '[data-testid*="login"]'
        ];

        let submitButton = null;
        for (const selector of submitSelectors) {
            try {
                submitButton = await page.waitForSelector(selector, { timeout: 2000 });
                if (submitButton) {
                    console.log(`✓ Found submit button with selector: ${selector}`);
                    break;
                }
            } catch (e) {
                // Try next selector
            }
        }

        if (!submitButton) {
            console.log('Submit button not found. Taking screenshot for analysis...');
            await page.screenshot({ path: 'k2think-no-submit.png', fullPage: true });
            throw new Error('Submit button not found');
        }

        // Click submit and wait for navigation
        console.log('\nSubmitting login form...');
        await Promise.all([
            page.waitForNavigation({ timeout: 30000 }).catch(() => console.log('No navigation detected')),
            submitButton.click()
        ]);

        await page.waitForTimeout(2000);

        // Take post-login screenshot
        await page.screenshot({ path: 'k2think-post-login.png', fullPage: true });
        console.log('✓ Login submitted');

        // Check for success indicators
        const currentUrl = page.url();
        console.log(`\nCurrent URL: ${currentUrl}`);

        if (currentUrl.includes('/dashboard') || currentUrl.includes('/app')) {
            console.log('✓ Login successful - redirected to dashboard/app');
        } else if (currentUrl === credentials.url + '/') {
            console.log('⚠ Still on login page - checking for error messages...');
            
            const errorSelectors = [
                '.error',
                '[role="alert"]',
                '.alert-danger',
                '[data-testid*="error"]'
            ];

            for (const selector of errorSelectors) {
                const errorElement = await page.$(selector);
                if (errorElement) {
                    const errorText = await errorElement.textContent();
                    console.log(`✗ Error found: ${errorText}`);
                }
            }
        }

        // Identify available features
        console.log('\n=== Feature Identification ===\n');
        await identifyFeatures(page);

    } catch (error) {
        console.error('Error during test:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

/**
 * Identify available features on the page
 */
async function identifyFeatures(page: Page): Promise<void> {
    // Get all interactive elements
    const buttons = await page.$$('button');
    const links = await page.$$('a');
    const inputs = await page.$$('input, textarea, select');

    console.log(`Found ${buttons.length} buttons`);
    console.log(`Found ${links.length} links`);
    console.log(`Found ${inputs.length} input fields`);

    // Extract navigation items
    const navItems = await page.evaluate(() => {
        const items: { text: string; href: string }[] = [];
        document.querySelectorAll('nav a, [role="navigation"] a').forEach(link => {
            const text = (link as HTMLElement).innerText.trim();
            const href = (link as HTMLAnchorElement).href;
            if (text && href) {
                items.push({ text, href });
            }
        });
        return items;
    });

    console.log('\nNavigation items:');
    navItems.forEach(item => {
        console.log(`  • ${item.text}: ${item.href}`);
    });

    // Extract form fields
    const formFields = await page.evaluate(() => {
        const fields: { type: string; name: string; placeholder: string }[] = [];
        document.querySelectorAll('input, textarea, select').forEach(field => {
            const type = field.getAttribute('type') || field.tagName.toLowerCase();
            const name = field.getAttribute('name') || field.getAttribute('id') || '';
            const placeholder = field.getAttribute('placeholder') || '';
            if (name || placeholder) {
                fields.push({ type, name, placeholder });
            }
        });
        return fields;
    });

    console.log('\nForm fields:');
    formFields.forEach(field => {
        console.log(`  • ${field.type}: ${field.name || field.placeholder}`);
    });
}

/**
 * Test OpenAI-compatible API
 */
async function testOpenAIAPI(): Promise<void> {
    console.log('\n=== OpenAI API Test ===\n');

    const apiUrl = `http://localhost:${process.env.OPENAI_API_PORT || 8080}`;
    const apiKey = process.env.WEBCHAT2API_API_KEY || 'test-key';

    try {
        // Test health endpoint
        console.log('Testing health endpoint...');
        const healthResponse = await axios.get(`${apiUrl}/health`);
        console.log(`✓ Health check: ${healthResponse.data.status}`);

        // Test models endpoint
        console.log('\nTesting models endpoint...');
        const modelsResponse = await axios.get(`${apiUrl}/v1/models`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        console.log(`✓ Available models: ${modelsResponse.data.data.length}`);
        modelsResponse.data.data.forEach((model: { id: string; description: string }) => {
            console.log(`  • ${model.id}: ${model.description}`);
        });

        // Test chat completions with K2Think automation
        console.log('\nTesting chat completions for K2Think automation...');
        const chatRequest = {
            model: 'web2api-vision',
            messages: [
                {
                    role: 'system',
                    content: 'You are a web automation assistant that helps users interact with web applications.'
                },
                {
                    role: 'user',
                    content: `Login to K2Think.ai with credentials: ${process.env.K2THINK_EMAIL} and identify available features.`
                }
            ] as OpenAIMessage[],
            stream: false
        };

        const chatResponse = await axios.post(`${apiUrl}/v1/chat/completions`, chatRequest, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✓ Chat completion response:');
        console.log(`  Model: ${chatResponse.data.model}`);
        console.log(`  Tokens: ${chatResponse.data.usage.total_tokens}`);
        console.log(`  Response: ${chatResponse.data.choices[0].message.content.substring(0, 200)}...`);

    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('API Error:', error.response?.status, error.response?.data);
        } else {
            console.error('Error:', error);
        }
    }
}

/**
 * Main demo runner
 */
async function main(): Promise<void> {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║   Web2API K2Think.ai End-to-End Demo                      ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    const demo = process.argv[2];

    try {
        switch (demo) {
            case 'auth':
                await testK2ThinkAuthentication();
                break;
            case 'api':
                await testOpenAIAPI();
                break;
            case 'all':
            default:
                await testK2ThinkAuthentication();
                await new Promise(resolve => setTimeout(resolve, 2000));
                await testOpenAIAPI();
                break;
        }

        console.log('\n✓ Demo completed successfully');
    } catch (error) {
        console.error('\n✗ Demo failed:', error);
        process.exit(1);
    }
}

// Run the demo
if (require.main === module) {
    main();
}

export { testK2ThinkAuthentication, testOpenAIAPI, identifyFeatures };
