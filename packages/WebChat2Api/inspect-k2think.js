const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('🔍 Inspecting K2Think AI page...\n');
  
  await page.goto('https://www.k2think.ai', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  const title = await page.title();
  console.log('PAGE TITLE:', title);
  console.log('\n=== INPUT FIELDS FOUND ===');
  
  const inputs = await page.$$('input');
  console.log(`Total inputs found: ${inputs.length}`);
  for (let i = 0; i < inputs.length; i++) {
    const type = await inputs[i].getAttribute('type');
    const name = await inputs[i].getAttribute('name');
    const placeholder = await inputs[i].getAttribute('placeholder');
    const id = await inputs[i].getAttribute('id');
    const className = await inputs[i].getAttribute('class');
    console.log(`Input ${i}: type=${type}, name=${name}, placeholder=${placeholder}, id=${id}, class=${className}`);
  }
  
  console.log('\n=== TEXTAREAS FOUND ===');
  const textareas = await page.$$('textarea');
  console.log(`Total textareas found: ${textareas.length}`);
  for (let i = 0; i < textareas.length; i++) {
    const placeholder = await textareas[i].getAttribute('placeholder');
    const id = await textareas[i].getAttribute('id');
    console.log(`Textarea ${i}: placeholder=${placeholder}, id=${id}`);
  }
  
  console.log('\n=== BUTTONS FOUND ===');
  const buttons = await page.$$('button');
  console.log(`Total buttons found: ${buttons.length}`);
  for (let i = 0; i < Math.min(buttons.length, 15); i++) {
    const text = await buttons[i].textContent();
    const type = await buttons[i].getAttribute('type');
    const ariaLabel = await buttons[i].getAttribute('aria-label');
    console.log(`Button ${i}: text="${text?.trim()}", type=${type}, aria-label=${ariaLabel}`);
  }
  
  console.log('\n=== PAGE URL ===');
  console.log(page.url());
  
  await page.screenshot({ path: '/tmp/k2think-page.png', fullPage: true });
  console.log('\n📸 Screenshot saved to /tmp/k2think-page.png');
  
  await browser.close();
})();

