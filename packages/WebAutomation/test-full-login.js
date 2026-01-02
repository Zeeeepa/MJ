const { chromium } = require('playwright');

// REAL credentials provided by user
const K2THINK_URL = 'https://www.k2think.ai';
const K2THINK_EMAIL = 'developer@pixelium.uk';
const K2THINK_PASSWORD = 'developer123?';

async function fullK2ThinkLoginTest() {
  console.log('🚀 FULL K2THINK LOGIN TEST WITH REAL CREDENTIALS\n');
  
  let browser, context, page;
  
  try {
    // Launch
    console.log('[1/9] Launching browser...');
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    page = await context.newPage();
    console.log('✅ Browser ready\n');

    // Navigate
    console.log('[2/9] Navigating to K2Think...');
    await page.goto(K2THINK_URL, { waitUntil: 'networkidle' });
    console.log(`✅ Loaded: ${page.url()}\n`);

    // Click Login button
    console.log('[3/9] Looking for Login button...');
    const loginButton = page.locator('text=Login').first();
    const loginExists = await loginButton.count() > 0;
    
    if (!loginExists) {
      throw new Error('Login button not found on page');
    }
    console.log('✅ Login button found\n');

    console.log('[4/9] Clicking Login button...');
    await loginButton.click();
    await page.waitForLoadState('networkidle');
    console.log(`✅ Navigated to: ${page.url()}\n`);

    // Screenshot after clicking login
    await page.screenshot({ path: '/tmp/k2think-login-page.png' });
    console.log('📸 Screenshot: /tmp/k2think-login-page.png\n');

    // Now check for email/password inputs
    console.log('[5/9] Looking for login form...');
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    
    const emailExists = await emailInput.count() > 0;
    const passwordExists = await passwordInput.count() > 0;
    
    console.log(`📧 Email input: ${emailExists}`);
    console.log(`🔑 Password input: ${passwordExists}\n`);

    if (!emailExists || !passwordExists) {
      // Get page text to understand what's on screen
      const pageText = await page.evaluate(() => document.body.innerText);
      console.log('📝 Current page text:');
      console.log(pageText.substring(0, 500) + '...\n');
      throw new Error('Login form not found after clicking Login button');
    }

    // Fill email
    console.log('[6/9] Filling email...');
    await emailInput.fill(K2THINK_EMAIL);
    console.log(`✅ Email filled: ${K2THINK_EMAIL}\n`);

    // Fill password
    console.log('[7/9] Filling password...');
    await passwordInput.fill(K2THINK_PASSWORD);
    console.log('✅ Password filled: [REDACTED]\n');

    // Screenshot before submit
    await page.screenshot({ path: '/tmp/k2think-before-submit.png' });
    console.log('📸 Screenshot: /tmp/k2think-before-submit.png\n');

    // Find and click submit
    console.log('[8/9] Looking for submit button...');
    const submitButton = page.locator('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")').first();
    const submitExists = await submitButton.count() > 0;
    
    if (!submitExists) {
      throw new Error('Submit button not found');
    }
    console.log('✅ Submit button found\n');

    console.log('[9/9] Submitting login form...');
    await submitButton.click();
    
    // Wait for response
    console.log('⏳ Waiting for login response...');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    
    const finalUrl = page.url();
    console.log(`✅ Final URL: ${finalUrl}\n`);

    // Screenshot after login
    await page.screenshot({ path: '/tmp/k2think-after-login.png' });
    console.log('📸 Screenshot: /tmp/k2think-after-login.png\n');

    // Check for success/failure
    const pageText = await page.evaluate(() => document.body.innerText);
    const hasError = pageText.toLowerCase().includes('invalid') ||
                     pageText.toLowerCase().includes('incorrect') ||
                     pageText.toLowerCase().includes('wrong password') ||
                     pageText.toLowerCase().includes('failed');
    
    const urlChanged = finalUrl !== K2THINK_URL && !finalUrl.includes('/login');
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 REAL LOGIN TEST RESULTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Browser launched: YES`);
    console.log(`✅ Page loaded: YES`);
    console.log(`✅ Login button clicked: YES`);
    console.log(`✅ Email filled: YES (${K2THINK_EMAIL})`);
    console.log(`✅ Password filled: YES`);
    console.log(`✅ Form submitted: YES`);
    console.log(`✅ URL after login: ${finalUrl}`);
    console.log(`✅ URL changed: ${urlChanged}`);
    console.log(`✅ Error detected: ${hasError}`);
    
    if (!hasError && urlChanged) {
      console.log('\n🎉 LOGIN SUCCESS - Credentials are valid!\n');
    } else if (hasError) {
      console.log('\n❌ LOGIN FAILED - Invalid credentials or error\n');
      console.log('Error text found in page');
    } else {
      console.log('\n⚠️  LOGIN STATUS UNCLEAR - Check screenshots\n');
    }
    
    console.log(`📸 Evidence: 3 screenshots in /tmp/`);
    console.log('   - k2think-login-page.png');
    console.log('   - k2think-before-submit.png');
    console.log('   - k2think-after-login.png');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌ TEST ERROR:', error.message);
    if (page) {
      await page.screenshot({ path: '/tmp/k2think-error.png' });
      console.error('📸 Error screenshot: /tmp/k2think-error.png');
    }
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('✅ Browser closed\n');
    }
  }
}

// Run test
fullK2ThinkLoginTest()
  .then(() => {
    console.log('✅ TEST COMPLETED SUCCESSFULLY\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ TEST FAILED\n');
    process.exit(1);
  });

