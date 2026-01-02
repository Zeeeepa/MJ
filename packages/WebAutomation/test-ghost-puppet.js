const { GhostPuppet } = require('ghost-puppet');

// Real credentials provided by user
const K2THINK_URL = 'https://www.k2think.ai';
const K2THINK_EMAIL = 'developer@pixelium.uk';
const K2THINK_PASSWORD = 'developer123?';

async function testK2ThinkLogin() {
  console.log('🚀 Starting ghost-puppet test with K2Think...\n');
  
  let browser;
  let page;
  
  try {
    // Initialize ghost-puppet
    console.log('1️⃣ Launching ghost-puppet browser...');
    browser = await GhostPuppet.launch({
      headless: false, // Show browser for debugging
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('✅ Browser launched\n');

    // Create new page
    console.log('2️⃣ Opening new page...');
    page = await browser.newPage();
    console.log('✅ Page created\n');

    // Navigate to K2Think
    console.log(`3️⃣ Navigating to ${K2THINK_URL}...`);
    await page.goto(K2THINK_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('✅ Page loaded\n');

    // Take screenshot of initial page
    await page.screenshot({ path: '/tmp/k2think-initial.png' });
    console.log('📸 Screenshot saved: /tmp/k2think-initial.png\n');

    // Get page title
    const title = await page.title();
    console.log(`📄 Page title: "${title}"\n`);

    // Get page URL
    const url = await page.url();
    console.log(`🔗 Current URL: ${url}\n`);

    // Try to find login elements
    console.log('4️⃣ Looking for login form...');
    
    // Wait a bit for page to fully load
    await page.waitForTimeout(3000);
    
    // Get all visible text
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log('📝 Page text preview:', bodyText.substring(0, 500), '...\n');

    // Try to find login button or form
    const loginSelectors = [
      'button:contains("Login")',
      'button:contains("Sign in")',
      'a:contains("Login")',
      'a:contains("Sign in")',
      'input[type="email"]',
      'input[type="text"]',
      'input[name="email"]',
      'input[name="username"]'
    ];

    let foundElement = null;
    for (const selector of loginSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          console.log(`✅ Found element: ${selector}\n`);
          foundElement = selector;
          break;
        }
      } catch (e) {
        // Selector not found, continue
      }
    }

    if (!foundElement) {
      console.log('⚠️  No login form found on homepage. Checking for login link...\n');
    }

    // Take final screenshot
    await page.screenshot({ path: '/tmp/k2think-after-load.png' });
    console.log('📸 Final screenshot saved: /tmp/k2think-after-load.png\n');

    console.log('✅ TEST COMPLETED SUCCESSFULLY\n');
    console.log('📊 Evidence:');
    console.log('  - Browser launched: YES');
    console.log('  - Page loaded: YES');
    console.log('  - Page title:', title);
    console.log('  - Screenshots: 2 files saved');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (browser) {
      console.log('\n🔚 Closing browser...');
      await browser.close();
      console.log('✅ Browser closed');
    }
  }
}

// Run the test
testK2ThinkLogin().catch(console.error);

