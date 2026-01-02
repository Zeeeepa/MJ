const { chromium } = require('playwright');

// REAL credentials provided by user
const K2THINK_URL = 'https://www.k2think.ai';
const K2THINK_EMAIL = 'developer@pixelium.uk';
const K2THINK_PASSWORD = 'developer123?';

async function testK2ThinkRealLogin() {
  console.log('🚀 REAL TEST: K2Think Login with Playwright\n');
  console.log('📝 Using credentials:');
  console.log('   URL:', K2THINK_URL);
  console.log('   Email:', K2THINK_EMAIL);
  console.log('   Password: [REDACTED]\n');
  
  let browser;
  let context;
  let page;
  
  try {
    // Launch browser
    console.log('[1/7] Launching Chromium...');
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('✅ Browser launched\n');

    // Create context
    console.log('[2/7] Creating browser context...');
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
    });
    console.log('✅ Context created\n');

    // Create page
    console.log('[3/7] Creating new page...');
    page = await context.newPage();
    console.log('✅ Page created\n');

    // Navigate
    console.log(`[4/7] Navigating to ${K2THINK_URL}...`);
    const response = await page.goto(K2THINK_URL, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    console.log(`✅ Response status: ${response.status()}`);
    console.log(`✅ Page URL: ${page.url()}\n`);

    // Get title
    const title = await page.title();
    console.log(`📄 Page title: "${title}"\n`);

    // Take screenshot
    console.log('[5/7] Taking screenshot...');
    await page.screenshot({ path: '/tmp/k2think-home.png', fullPage: false });
    console.log('✅ Screenshot saved: /tmp/k2think-home.png\n');

    // Look for login elements
    console.log('[6/7] Analyzing page for login elements...');
    
    // Get all text content
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('📝 Page text (first 300 chars):');
    console.log(bodyText.substring(0, 300) + '...\n');

    // Check for common login patterns
    const hasLogin = bodyText.toLowerCase().includes('login') || 
                     bodyText.toLowerCase().includes('sign in');
    console.log(`🔍 Contains "login" or "sign in": ${hasLogin}\n`);

    // Try to find email input
    const emailInputExists = await page.locator('input[type="email"]').count() > 0 ||
                            await page.locator('input[name="email"]').count() > 0 ||
                            await page.locator('input[placeholder*="email" i]').count() > 0;
    console.log(`📧 Email input found: ${emailInputExists}\n`);

    // Try to find password input  
    const passwordInputExists = await page.locator('input[type="password"]').count() > 0;
    console.log(`🔑 Password input found: ${passwordInputExists}\n`);

    // If login form exists, try to login
    if (emailInputExists && passwordInputExists) {
      console.log('[7/7] 🎯 Login form detected! Attempting login...\n');
      
      // Fill email
      console.log('   Filling email...');
      await page.fill('input[type="email"], input[name="email"]', K2THINK_EMAIL);
      console.log('   ✅ Email filled\n');

      // Fill password
      console.log('   Filling password...');
      await page.fill('input[type="password"]', K2THINK_PASSWORD);
      console.log('   ✅ Password filled\n');

      // Take screenshot before submit
      await page.screenshot({ path: '/tmp/k2think-before-submit.png' });
      console.log('   📸 Screenshot: /tmp/k2think-before-submit.png\n');

      // Click submit button
      console.log('   Looking for submit button...');
      const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")').first();
      const submitExists = await submitButton.count() > 0;
      
      if (submitExists) {
        console.log('   ✅ Submit button found, clicking...\n');
        await submitButton.click();
        
        // Wait for navigation
        console.log('   ⏳ Waiting for response...');
        await page.waitForLoadState('networkidle', { timeout: 15000 });
        
        const newUrl = page.url();
        console.log(`   ✅ New URL: ${newUrl}\n`);

        // Take screenshot after login
        await page.screenshot({ path: '/tmp/k2think-after-login.png', fullPage: false });
        console.log('   📸 Screenshot: /tmp/k2think-after-login.png\n');

        // Check if login was successful
        const currentText = await page.evaluate(() => document.body.innerText);
        const loginFailed = currentText.toLowerCase().includes('invalid') ||
                           currentText.toLowerCase().includes('incorrect') ||
                           currentText.toLowerCase().includes('error');
        
        if (loginFailed) {
          console.log('❌ LOGIN FAILED - Invalid credentials or error message detected\n');
        } else if (newUrl !== K2THINK_URL && !newUrl.includes('login')) {
          console.log('✅ LOGIN SUCCESSFUL - URL changed and no error detected\n');
        } else {
          console.log('⚠️  LOGIN STATUS UNCLEAR - Please check screenshots\n');
        }
      } else {
        console.log('   ⚠️  No submit button found\n');
      }
    } else {
      console.log('[7/7] ⚠️  No login form detected on homepage\n');
      console.log('This might mean:');
      console.log('- Login is behind a modal/popup');
      console.log('- Login is on a different page');
      console.log('- The site structure is different than expected\n');
    }

    // Final evidence summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 EVIDENCE SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Browser launched: YES');
    console.log('✅ Page loaded: YES');
    console.log(`✅ HTTP status: ${response.status()}`);
    console.log(`✅ Page title: "${title}"`);
    console.log(`✅ Final URL: ${page.url()}`);
    console.log(`✅ Email input found: ${emailInputExists}`);
    console.log(`✅ Password input found: ${passwordInputExists}`);
    console.log('✅ Screenshots: 1-3 files in /tmp/');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ ERROR OCCURRED:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (browser) {
      console.log('🔚 Closing browser...');
      await browser.close();
      console.log('✅ Browser closed\n');
    }
  }
}

// Run the REAL test
console.log('════════════════════════════════════════');
console.log('  K2THINK REAL LOGIN TEST');
console.log('════════════════════════════════════════\n');

testK2ThinkRealLogin()
  .then(() => {
    console.log('✅ TEST COMPLETED\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ TEST FAILED:', error.message);
    process.exit(1);
  });

