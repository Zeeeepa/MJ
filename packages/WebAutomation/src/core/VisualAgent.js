const { chromium } = require('playwright');
const Anthropic = require('@anthropic-ai/sdk').default;
const fs = require('fs');

/**
 * VisualAgent - Multi-strategy browser automation with visual verification
 * 
 * Strategies (in order of preference):
 * 1. Text-based selection (fastest)
 * 2. Element attribute matching
 * 3. Visual AI analysis (GLM-4.6V)
 * 4. Coordinate-based clicking
 * 5. Shape/color pattern matching
 */
class VisualAgent {
  constructor(config) {
    this.config = config;
    this.anthropic = new Anthropic({
      apiKey: config.anthropicKey,
      baseURL: config.anthropicBaseUrl
    });
    this.browser = null;
    this.context = null;
    this.page = null;
    this.actionLog = [];
    this.elementCache = new Map();
  }

  log(action, status, details = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      action,
      status,
      ...details
    };
    this.actionLog.push(entry);
    console.log(`[${entry.timestamp}] ${action}: ${status}`);
    if (details.detail) console.log(`  └─ ${details.detail}`);
    return entry;
  }

  async launch() {
    this.log('Launch Browser', 'START');
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    this.page = await this.context.newPage();
    this.log('Launch Browser', 'SUCCESS');
  }

  async goto(url) {
    this.log('Navigate', 'START', { url });
    await this.page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: 0 // NO TIMEOUT
    });
    const finalUrl = this.page.url();
    this.log('Navigate', 'SUCCESS', { url: finalUrl });
    return finalUrl;
  }

  async takeScreenshot(path, description) {
    await this.page.screenshot({ path, fullPage: false });
    this.log('Screenshot', 'SUCCESS', { path, description });
    return path;
  }

  /**
   * Visual verification using GLM-4.6V
   */
  async verifyWithVision(screenshotPath, question) {
    this.log('Visual Verification', 'START', { question });
    
    try {
      const imageData = fs.readFileSync(screenshotPath);
      const base64Image = imageData.toString('base64');
      
      const response = await this.anthropic.messages.create({
        model: 'glm-4.6v',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: base64Image
              }
            },
            {
              type: 'text',
              text: question
            }
          ]
        }]
      });
      
      const answer = response.content[0].text;
      this.log('Visual Verification', 'SUCCESS', { answer: answer.substring(0, 100) });
      return answer;
    } catch (error) {
      this.log('Visual Verification', 'FAILED', { error: error.message });
      throw error;
    }
  }

  /**
   * Multi-strategy element finding with ALL fallbacks
   */
  async findAndClickElement(description, strategies = null) {
    this.log('Find Element', 'START', { description });
    
    // Default strategies if not specified
    if (!strategies) {
      strategies = [
        'text-match',
        'role-match',
        'attribute-match',
        'visual-ai',
        'coordinate-click'
      ];
    }

    // Take screenshot for visual strategies
    const screenshotPath = `/tmp/find-${Date.now()}.png`;
    await this.takeScreenshot(screenshotPath, `Finding: ${description}`);

    // Try each strategy in order
    for (const strategy of strategies) {
      try {
        this.log(`Try Strategy: ${strategy}`, 'START', { description });
        
        switch (strategy) {
          case 'text-match':
            if (await this.tryTextMatch(description)) {
              this.log(`Try Strategy: ${strategy}`, 'SUCCESS');
              return true;
            }
            break;

          case 'role-match':
            if (await this.tryRoleMatch(description)) {
              this.log(`Try Strategy: ${strategy}`, 'SUCCESS');
              return true;
            }
            break;

          case 'attribute-match':
            if (await this.tryAttributeMatch(description)) {
              this.log(`Try Strategy: ${strategy}`, 'SUCCESS');
              return true;
            }
            break;

          case 'visual-ai':
            if (await this.tryVisualAI(description, screenshotPath)) {
              this.log(`Try Strategy: ${strategy}`, 'SUCCESS');
              return true;
            }
            break;

          case 'coordinate-click':
            if (await this.tryCoordinateClick(description, screenshotPath)) {
              this.log(`Try Strategy: ${strategy}`, 'SUCCESS');
              return true;
            }
            break;
        }
        
        this.log(`Try Strategy: ${strategy}`, 'FAILED', { detail: 'Element not found with this method' });
      } catch (error) {
        this.log(`Try Strategy: ${strategy}`, 'ERROR', { error: error.message });
      }
    }

    this.log('Find Element', 'FAILED', { description, detail: 'All strategies exhausted' });
    throw new Error(`Could not find element: ${description}`);
  }

  async tryTextMatch(description) {
    // Try exact text match
    const patterns = [
      `text="${description}"`,
      `text=${description}`,
      `text=/${description}/i`
    ];

    for (const pattern of patterns) {
      const locator = this.page.locator(pattern).first();
      if (await locator.count() > 0) {
        await locator.click({ timeout: 5000 });
        await this.page.waitForLoadState('networkidle', { timeout: 10000 });
        return true;
      }
    }
    return false;
  }

  async tryRoleMatch(description) {
    // Try common roles
    const roles = ['button', 'link', 'textbox', 'input'];
    const searchTerms = description.toLowerCase().split(' ');

    for (const role of roles) {
      for (const term of searchTerms) {
        try {
          const locator = this.page.getByRole(role, { name: new RegExp(term, 'i') });
          if (await locator.count() > 0) {
            await locator.first().click({ timeout: 5000 });
            await this.page.waitForLoadState('networkidle', { timeout: 10000 });
            return true;
          }
        } catch (e) {
          // Continue to next
        }
      }
    }
    return false;
  }

  async tryAttributeMatch(description) {
    // Try common attribute patterns
    const selectors = [
      `button:has-text("${description}")`,
      `a:has-text("${description}")`,
      `[aria-label*="${description}" i]`,
      `[title*="${description}" i]`,
      `[placeholder*="${description}" i]`,
      `[name*="${description}" i]`
    ];

    for (const selector of selectors) {
      try {
        const locator = this.page.locator(selector).first();
        if (await locator.count() > 0) {
          await locator.click({ timeout: 5000 });
          await this.page.waitForLoadState('networkidle', { timeout: 10000 });
          return true;
        }
      } catch (e) {
        // Continue
      }
    }
    return false;
  }

  async tryVisualAI(description, screenshotPath) {
    // Ask GLM-4.6V to find element
    const question = `Find the "${description}" element in this screenshot.
Describe:
1. Its exact position (left/center/right, top/middle/bottom)
2. Approximate coordinates as percentage of screen (x%, y%)
3. The exact text it contains
4. Whether it's clickable

Answer in format:
POSITION: [position]
COORDINATES: x%,y%
TEXT: [text]
CLICKABLE: yes/no`;

    const answer = await this.verifyWithVision(screenshotPath, question);
    
    // Parse coordinates from answer
    const coordMatch = answer.match(/COORDINATES:\s*(\d+)%,\s*(\d+)%/);
    if (coordMatch) {
      const xPercent = parseInt(coordMatch[1]);
      const yPercent = parseInt(coordMatch[2]);
      
      // Convert to actual coordinates
      const viewport = this.page.viewportSize();
      const x = (viewport.width * xPercent) / 100;
      const y = (viewport.height * yPercent) / 100;
      
      // Click at coordinates
      await this.page.mouse.click(x, y);
      await this.page.waitForLoadState('networkidle', { timeout: 10000 });
      
      return true;
    }
    
    return false;
  }

  async tryCoordinateClick(description, screenshotPath) {
    // Get all clickable elements and their bounding boxes
    const elements = await this.page.evaluate(() => {
      const clickable = document.querySelectorAll('button, a, input[type="button"], input[type="submit"]');
      return Array.from(clickable).map(el => {
        const rect = el.getBoundingClientRect();
        return {
          text: el.innerText || el.value || el.getAttribute('aria-label') || '',
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          width: rect.width,
          height: rect.height
        };
      });
    });

    // Find best match by text similarity
    const searchTerms = description.toLowerCase().split(' ');
    let bestMatch = null;
    let bestScore = 0;

    for (const element of elements) {
      const elementText = element.text.toLowerCase();
      let score = 0;
      
      for (const term of searchTerms) {
        if (elementText.includes(term)) {
          score += 1;
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = element;
      }
    }

    if (bestMatch && bestScore > 0) {
      await this.page.mouse.click(bestMatch.x, bestMatch.y);
      await this.page.waitForLoadState('networkidle', { timeout: 10000 });
      return true;
    }

    return false;
  }

  /**
   * Fill input with multi-strategy fallback
   */
  async fillInput(description, value) {
    this.log('Fill Input', 'START', { description, value: value.substring(0, 20) });
    
    // Strategy 1: Try by type
    const typeSelectors = [
      `input[type="email"]`,
      `input[type="text"]`,
      `input[type="password"]`,
      `input[name*="${description}" i]`,
      `input[placeholder*="${description}" i]`
    ];

    for (const selector of typeSelectors) {
      try {
        const locator = this.page.locator(selector).first();
        if (await locator.count() > 0) {
          await locator.fill(value);
          this.log('Fill Input', 'SUCCESS', { method: 'type-selector' });
          return true;
        }
      } catch (e) {
        // Continue
      }
    }

    // Strategy 2: Visual AI to find input
    const screenshotPath = `/tmp/input-${Date.now()}.png`;
    await this.takeScreenshot(screenshotPath, `Finding input: ${description}`);
    
    const question = `Find the "${description}" input field.
Give its position as percentage: COORDINATES: x%,y%`;
    
    const answer = await this.verifyWithVision(screenshotPath, question);
    const coordMatch = answer.match(/COORDINATES:\s*(\d+)%,\s*(\d+)%/);
    
    if (coordMatch) {
      const xPercent = parseInt(coordMatch[1]);
      const yPercent = parseInt(coordMatch[2]);
      const viewport = this.page.viewportSize();
      const x = (viewport.width * xPercent) / 100;
      const y = (viewport.height * yPercent) / 100;
      
      await this.page.mouse.click(x, y);
      await this.page.keyboard.type(value);
      this.log('Fill Input', 'SUCCESS', { method: 'visual-ai-coordinate' });
      return true;
    }

    throw new Error(`Could not fill input: ${description}`);
  }

  /**
   * Verify state with visual AI
   */
  async verifyState(expectedState, description) {
    this.log('Verify State', 'START', { expectedState, description });
    
    const screenshotPath = `/tmp/verify-${Date.now()}.png`;
    await this.takeScreenshot(screenshotPath, `Verifying: ${description}`);
    
    const question = `${description}
    
Expected state: ${expectedState}

Analyze the screenshot and answer:
STATE_MATCH: yes/no
CONFIDENCE: low/medium/high
EXPLANATION: [what you see]`;
    
    const answer = await this.verifyWithVision(screenshotPath, question);
    const isMatch = answer.toLowerCase().includes('state_match: yes');
    
    this.log('Verify State', isMatch ? 'SUCCESS' : 'FAILED', { 
      answer: answer.substring(0, 150),
      expected: expectedState
    });
    
    return {
      match: isMatch,
      confidence: answer.match(/CONFIDENCE:\s*(\w+)/)?.[1] || 'unknown',
      explanation: answer.match(/EXPLANATION:\s*(.+)/)?.[1] || answer,
      fullAnswer: answer
    };
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.log('Close Browser', 'SUCCESS');
    }
  }

  getActionLog() {
    return this.actionLog;
  }
}

module.exports = { VisualAgent };

