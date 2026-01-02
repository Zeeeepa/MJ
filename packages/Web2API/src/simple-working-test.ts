/**
 * SIMPLE WORKING TEST - ACTUAL AUTHENTICATION & RESPONSES
 * 
 * This script:
 * 1. Uses Playwright directly (no complex dependencies)
 * 2. Authenticates to each service
 * 3. Sends REAL messages
 * 4. Gets ACTUAL responses
 * 5. Prints everything
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import * as dotenv from 'dotenv';

dotenv.config();

interface ServiceConfig {
  name: string;
  url: string;
  email?: string;
  username?: string;
  password: string;
}

interface TestResult {
  service: string;
  authenticated: boolean;
  response: string;
  error?: string;
  time: number;
}

const SERVICES: ServiceConfig[] = [
  {
    name: 'K2Think',
    url: process.env.K2THINK_URL || '',
    email: process.env.K2THINK_EMAIL || '',
    password: process.env.K2THINK_PASSWORD || ''
  },
  {
    name: 'DeepSeek',
    url: process.env.DEEPSEEK_URL || '',
    email: process.env.DEEPSEEK_EMAIL || '',
    password: process.env.DEEPSEEK_PASSWORD || ''
  },
  {
    name: 'Grok',
    url: process.env.GROK_URL || '',
    email: process.env.GROK_EMAIL || '',
    password: process.env.GROK_PASSWORD || ''
  },
  {
    name: 'Qwen',
    url: process.env.QWEN_URL || '',
    email: process.env.QWEN_EMAIL || '',
    password: process.env.QWEN_PASSWORD || ''
  },
  {
    name: 'Z.AI',
    url: process.env.ZAI_URL || '',
    email: process.env.ZAI_EMAIL || '',
    password: process.env.ZAI_PASSWORD || ''
  },
  {
    name: 'Mistral',
    url: process.env.MISTRAL_URL || '',
    email: process.env.MISTRAL_EMAIL || '',
    password: process.env.MISTRAL_PASSWORD || ''
  }
];

async function tryLogin(page: Page, service: ServiceConfig): Promise<boolean> {
  console.log(`  🔐 Attempting login for ${service.name}...`);

  try {
    // Wait for page to load
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Take screenshot for debugging
    await page.screenshot({ path: `/tmp/login-${service.name}-start.png` });

    // Try to find email/username field
    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[name="username"]',
      'input[placeholder*="email" i]',
      'input[placeholder*="username" i]',
      'input[id*="email" i]',
      'input[id*="username" i]'
    ];

    let emailFilled = false;
    for (const selector of emailSelectors) {
      try {
        const count = await page.locator(selector).count();
        if (count > 0) {
          await page.fill(selector, service.email || service.username || '', { timeout: 3000 });
          console.log(`    ✓ Filled email/username with selector: ${selector}`);
          emailFilled = true;
          await page.waitForTimeout(500);
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }

    if (!emailFilled) {
      console.log(`    ⚠️ Could not find email field`);
      return false;
    }

    // Try to find password field
    const passwordSelectors = [
      'input[type="password"]',
      'input[name="password"]',
      'input[placeholder*="password" i]',
      'input[id*="password" i]'
    ];

    let passwordFilled = false;
    for (const selector of passwordSelectors) {
      try {
        const count = await page.locator(selector).count();
        if (count > 0) {
          await page.fill(selector, service.password, { timeout: 3000 });
          console.log(`    ✓ Filled password with selector: ${selector}`);
          passwordFilled = true;
          await page.waitForTimeout(500);
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }

    if (!passwordFilled) {
      console.log(`    ⚠️ Could not find password field`);
      return false;
    }

    // Try to find and click submit button
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Sign in")',
      'button:has-text("Log in")',
      'button:has-text("Login")',
      'button:has-text("Continue")',
      'button[id*="submit" i]',
      'button[id*="login" i]'
    ];

    let submitClicked = false;
    for (const selector of submitSelectors) {
      try {
        const count = await page.locator(selector).count();
        if (count > 0) {
          await page.click(selector, { timeout: 3000 });
          console.log(`    ✓ Clicked submit with selector: ${selector}`);
          submitClicked = true;
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }

    if (!submitClicked) {
      console.log(`    ⚠️ Could not find submit button`);
      return false;
    }

    // Wait for navigation or error
    await page.waitForTimeout(5000);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    // Take screenshot after login
    await page.screenshot({ path: `/tmp/login-${service.name}-after.png` });

    // Check if we're logged in (no password field visible)
    const stillHasPasswordField = await page.locator('input[type="password"]').count() > 0;
    
    if (!stillHasPasswordField) {
      console.log(`    ✅ Login successful!`);
      return true;
    } else {
      console.log(`    ⚠️ Login may have failed (still see password field)`);
      return false;
    }
  } catch (error: any) {
    console.error(`    ❌ Login error: ${error.message}`);
    return false;
  }
}

async function tryChat(page: Page, service: ServiceConfig, message: string): Promise<string> {
  console.log(`  💬 Sending message to ${service.name}: "${message}"`);

  try {
    await page.waitForTimeout(2000);

    // Take screenshot before chat
    await page.screenshot({ path: `/tmp/chat-${service.name}-before.png` });

    // Try to find chat input
    const chatInputSelectors = [
      'textarea[placeholder*="message" i]',
      'textarea[placeholder*="ask" i]',
      'textarea[placeholder*="type" i]',
      'input[placeholder*="message" i]',
      'textarea[aria-label*="message" i]',
      '[contenteditable="true"]',
      'textarea',
      'input[type="text"]'
    ];

    let inputFilled = false;
    for (const selector of chatInputSelectors) {
      try {
        const count = await page.locator(selector).count();
        if (count > 0) {
          await page.fill(selector, message, { timeout: 3000 });
          console.log(`    ✓ Filled message with selector: ${selector}`);
          inputFilled = true;
          await page.waitForTimeout(500);
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }

    if (!inputFilled) {
      return 'ERROR: Could not find chat input field';
    }

    // Try to find and click send button
    const sendButtonSelectors = [
      'button[type="submit"]',
      'button[aria-label*="send" i]',
      'button:has-text("Send")',
      'button:has(svg)',
      'button[title*="send" i]'
    ];

    let sendClicked = false;
    for (const selector of sendButtonSelectors) {
      try {
        const count = await page.locator(selector).count();
        if (count > 0) {
          await page.click(selector, { timeout: 3000 });
          console.log(`    ✓ Clicked send with selector: ${selector}`);
          sendClicked = true;
          break;
        }
      } catch (e) {
        // Try next selector
      }
    }

    if (!sendClicked) {
      // Try pressing Enter as fallback
      try {
        await page.keyboard.press('Enter');
        console.log(`    ✓ Pressed Enter to send`);
        sendClicked = true;
      } catch (e) {
        return 'ERROR: Could not find send button or press Enter';
      }
    }

    // Wait for response
    console.log(`    ⏳ Waiting for response...`);
    await page.waitForTimeout(5000); // Initial wait
    
    // Try to wait for network idle (response loading)
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
      console.log(`    ⚠️ Network did not become idle, continuing anyway...`);
    });

    await page.waitForTimeout(3000); // Additional wait

    // Take screenshot after response
    await page.screenshot({ path: `/tmp/chat-${service.name}-after.png` });

    // Try to extract response
    const responseSelectors = [
      '[class*="message"]',
      '[class*="response"]',
      '[class*="assistant"]',
      '[class*="ai"]',
      '[class*="answer"]',
      '[data-message-author-role="assistant"]',
      '.markdown-body',
      '[role="article"]'
    ];

    let response = '';
    for (const selector of responseSelectors) {
      try {
        const count = await page.locator(selector).count();
        if (count > 0) {
          // Get the last message (most recent)
          const text = await page.locator(selector).last().textContent({ timeout: 2000 });
          if (text && text.trim().length > 0) {
            response = text.trim();
            console.log(`    ✓ Extracted response with selector: ${selector}`);
            break;
          }
        }
      } catch (e) {
        // Try next selector
      }
    }

    if (!response) {
      // Try getting all visible text as last resort
      const bodyText = await page.locator('body').textContent();
      if (bodyText) {
        // Get last 500 characters
        response = bodyText.substring(Math.max(0, bodyText.length - 500));
      }
    }

    return response || 'ERROR: Could not extract response text';
  } catch (error: any) {
    console.error(`    ❌ Chat error: ${error.message}`);
    return `ERROR: ${error.message}`;
  }
}

async function testService(service: ServiceConfig): Promise<TestResult> {
  const startTime = Date.now();
  const result: TestResult = {
    service: service.name,
    authenticated: false,
    response: '',
    time: 0
  };

  let browser: Browser | undefined;
  let context: BrowserContext | undefined;
  let page: Page | undefined;

  try {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Testing: ${service.name}`);
    console.log(`URL: ${service.url}`);
    console.log(`${'='.repeat(70)}`);

    // Launch browser
    browser = await chromium.launch({
      headless: true, // Headless mode for server environment
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    page = await context.newPage();

    // Navigate to service
    console.log(`  🌐 Navigating to ${service.url}...`);
    await page.goto(service.url, { waitUntil: 'networkidle', timeout: 30000 });
    console.log(`    ✓ Page loaded`);

    // Try to login
    const loginSuccess = await tryLogin(page, service);
    result.authenticated = loginSuccess;

    if (loginSuccess) {
      // Try to send message and get response
      const response = await tryChat(page, service, 'What model are you? Answer in one sentence.');
      result.response = response;
    } else {
      result.response = 'Could not authenticate';
      result.error = 'Authentication failed';
    }
  } catch (error: any) {
    console.error(`  ❌ Error testing ${service.name}: ${error.message}`);
    result.error = error.message;
    result.response = `ERROR: ${error.message}`;
  } finally {
    // Cleanup
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }

  result.time = Date.now() - startTime;
  return result;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   ACTUAL AUTHENTICATION & RESPONSE TEST                    ║');
  console.log('║   100% REAL - NO MOCKS                                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const results: TestResult[] = [];

  for (const service of SERVICES) {
    if (!service.url || !service.password) {
      console.log(`⚠️ Skipping ${service.name} - missing configuration`);
      continue;
    }

    const result = await testService(service);
    results.push(result);

    // Wait between services
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Print summary
  console.log('\n\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    ACTUAL RESULTS                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  for (const result of results) {
    console.log(`\n━━━ ${result.service} ━━━`);
    console.log(`Authenticated: ${result.authenticated ? '✅ YES' : '❌ NO'}`);
    console.log(`Time: ${(result.time / 1000).toFixed(1)}s`);
    console.log(`\nResponse:`);
    console.log(result.response.substring(0, 500));
    if (result.response.length > 500) {
      console.log('...(truncated)');
    }
    console.log('─'.repeat(70));
  }

  // Statistics
  console.log('\n\n📊 STATISTICS:');
  console.log(`Total Services Tested: ${results.length}`);
  console.log(`Successfully Authenticated: ${results.filter(r => r.authenticated).length}`);
  console.log(`Got Responses: ${results.filter(r => r.response && !r.response.startsWith('ERROR')).length}`);
  console.log(`Total Time: ${(results.reduce((sum, r) => sum + r.time, 0) / 1000).toFixed(1)}s`);

  console.log('\n✅ Test complete!\n');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
