/**
 * Visual AI Agent - Vision-based Web Automation
 * 
 * Uses Claude 3.5 Sonnet with vision to:
 * 1. Take screenshots and analyze UI state
 * 2. Verify login status visually
 * 3. Identify UI elements (buttons, inputs) with coordinates
 * 4. Perform actions based on visual analysis
 * 5. Verify each step completed successfully
 * 6. Iterate until goal is achieved
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';

interface UIElement {
  type: 'button' | 'input' | 'link' | 'text';
  label: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  selector?: string;
}

interface VisionAnalysis {
  isLoggedIn: boolean;
  currentState: string;
  nextAction: {
    type: 'click' | 'type' | 'wait' | 'complete';
    element?: UIElement;
    text?: string;
    reason: string;
  };
  identifiedElements: UIElement[];
}

/**
 * Visual AI Agent for web automation
 */
export class VisualWebAgent {
  private browser: Browser | null = null;
  private anthropic: Anthropic;
  private maxIterations = 20;
  private screenshotDir: string;

  constructor(apiKey?: string) {
    this.anthropic = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN
    });
    this.screenshotDir = path.join(__dirname, '../screenshots');
    
    // Create screenshots directory
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }
  }

  async initialize() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: false, // Set to false to see the browser
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      console.log('✅ Browser initialized (headful mode for visual verification)');
    }
  }

  /**
   * Analyze screenshot with Claude Vision API
   */
  private async analyzeScreenshot(
    screenshotPath: string,
    goal: string,
    email?: string,
    password?: string
  ): Promise<VisionAnalysis> {
    console.log(`   🔍 Analyzing screenshot with Claude Vision...`);

    // Read screenshot as base64
    const imageData = fs.readFileSync(screenshotPath);
    const base64Image = imageData.toString('base64');

    const prompt = `You are a web automation expert analyzing a webpage screenshot.

GOAL: ${goal}
${email ? `EMAIL TO USE: ${email}` : ''}
${password ? `PASSWORD PROVIDED: Yes (use it when prompted)` : ''}

Analyze this screenshot and provide a JSON response with:

1. **isLoggedIn**: boolean - Is the user currently logged in? Look for:
   - User profile/avatar in top right
   - "Logout" or "Sign out" buttons
   - Personalized content (username, dashboard)
   - Login/Sign-in buttons (means NOT logged in)

2. **currentState**: string - Describe what you see on the page

3. **nextAction**: object with:
   - type: "click" | "type" | "wait" | "complete"
   - element: object with label, type, approximate x, y coordinates (as percentages 0-100)
   - text: (if type is "type") what text to enter
   - reason: why this action should be taken

4. **identifiedElements**: array of UI elements visible (buttons, inputs, links)

IMPORTANT RULES:
- If you see "Login" or "Sign in" button, the user is NOT logged in
- Provide coordinates as percentages of screen dimensions (0-100)
- For inputs, identify them as "email input", "password input", etc.
- Be specific about which element to interact with
- If goal is achieved, return type: "complete"

Respond ONLY with valid JSON, no markdown formatting.`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
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
              text: prompt
            }
          ]
        }]
      });

      const textContent = response.content.find(c => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text response from Claude');
      }

      // Parse JSON response
      let jsonText = textContent.text.trim();
      
      // Remove markdown code blocks if present
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }

      const analysis: VisionAnalysis = JSON.parse(jsonText);
      
      console.log(`   ✅ Vision Analysis Complete:`);
      console.log(`      - Logged In: ${analysis.isLoggedIn ? 'YES' : 'NO'}`);
      console.log(`      - State: ${analysis.currentState}`);
      console.log(`      - Next Action: ${analysis.nextAction.type} - ${analysis.nextAction.reason}`);

      return analysis;

    } catch (error: any) {
      console.error(`   ❌ Vision analysis failed:`, error.message);
      throw error;
    }
  }

  /**
   * Take screenshot and save to file
   */
  private async takeScreenshot(page: Page, stepNumber: number): Promise<string> {
    const timestamp = Date.now();
    const filename = `step-${stepNumber}-${timestamp}.png`;
    const filepath = path.join(this.screenshotDir, filename);
    
    await page.screenshot({ 
      path: filepath,
      fullPage: false // Only visible viewport
    });
    
    console.log(`   📸 Screenshot saved: ${filename}`);
    return filepath;
  }

  /**
   * Execute action based on vision analysis
   */
  private async executeAction(
    page: Page,
    analysis: VisionAnalysis,
    email?: string,
    password?: string
  ): Promise<void> {
    const action = analysis.nextAction;
    
    console.log(`\n   🎯 Executing Action: ${action.type}`);
    console.log(`      Reason: ${action.reason}`);

    if (action.type === 'complete') {
      console.log(`   ✅ Goal completed!`);
      return;
    }

    if (action.type === 'wait') {
      console.log(`   ⏳ Waiting 3 seconds...`);
      await page.waitForTimeout(3000);
      return;
    }

    if (action.type === 'click' && action.element) {
      const element = action.element;
      console.log(`   🖱️  Clicking: ${element.label}`);

      // Try multiple strategies to find and click the element
      
      // Strategy 1: Use coordinates if provided
      if (element.x !== undefined && element.y !== undefined) {
        const viewport = page.viewportSize();
        if (viewport) {
          const x = (element.x / 100) * viewport.width;
          const y = (element.y / 100) * viewport.height;
          console.log(`      - Clicking at coordinates: (${Math.round(x)}, ${Math.round(y)})`);
          await page.mouse.click(x, y);
          await page.waitForTimeout(2000);
          return;
        }
      }

      // Strategy 2: Search by text content
      const searchTexts = [
        element.label,
        element.label.toLowerCase(),
        element.label.toUpperCase()
      ];

      for (const text of searchTexts) {
        try {
          // Try button
          const button = page.locator(`button:has-text("${text}")`).first();
          if (await button.count() > 0) {
            console.log(`      - Found button with text: "${text}"`);
            await button.click();
            await page.waitForTimeout(2000);
            return;
          }

          // Try link
          const link = page.locator(`a:has-text("${text}")`).first();
          if (await link.count() > 0) {
            console.log(`      - Found link with text: "${text}"`);
            await link.click();
            await page.waitForTimeout(2000);
            return;
          }
        } catch (e) {
          // Continue to next strategy
        }
      }

      console.log(`      ⚠️  Could not find element: ${element.label}`);
    }

    if (action.type === 'type' && action.element) {
      const element = action.element;
      let textToType = action.text || '';

      // Auto-fill email/password if element type matches
      if (element.label.toLowerCase().includes('email') && email) {
        textToType = email;
        console.log(`   ⌨️  Auto-filling email: ${email}`);
      } else if (element.label.toLowerCase().includes('password') && password) {
        textToType = password;
        console.log(`   ⌨️  Auto-filling password: [REDACTED]`);
      } else {
        console.log(`   ⌨️  Typing: ${textToType}`);
      }

      // Try to find input field
      const inputSelectors = [
        'input[type="email"]',
        'input[type="text"]',
        'input[type="password"]',
        'input[name*="email"]',
        'input[name*="username"]',
        'input[name*="password"]',
        'textarea'
      ];

      for (const selector of inputSelectors) {
        try {
          const input = page.locator(selector).first();
          if (await input.count() > 0 && await input.isVisible()) {
            console.log(`      - Found input: ${selector}`);
            await input.fill(textToType);
            await page.waitForTimeout(1000);
            return;
          }
        } catch (e) {
          continue;
        }
      }

      console.log(`      ⚠️  Could not find input field`);
    }
  }

  /**
   * Main automation loop with visual verification
   */
  async automateWithVision(
    url: string,
    goal: string,
    email?: string,
    password?: string
  ): Promise<{ success: boolean; finalState: string; iterations: number }> {
    if (!this.browser) await this.initialize();

    const page = await this.browser!.newPage({
      viewport: { width: 1280, height: 720 }
    });

    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║  VISUAL AI AGENT - Starting Automation        ║');
    console.log('╚════════════════════════════════════════════════╝');
    console.log(`\n🎯 Goal: ${goal}`);
    console.log(`🌐 URL: ${url}`);
    if (email) console.log(`📧 Email: ${email}`);
    if (password) console.log(`🔑 Password: [PROVIDED]`);
    console.log('\n');

    try {
      // Navigate to URL
      console.log(`📍 Step 1: Navigating to ${url}...`);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);

      let iteration = 0;
      let goalAchieved = false;

      // Visual automation loop
      while (iteration < this.maxIterations && !goalAchieved) {
        iteration++;
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📍 Step ${iteration + 1}: Visual Analysis & Action`);
        console.log(${'='.repeat(60)});

        // Take screenshot
        const screenshotPath = await this.takeScreenshot(page, iteration);

        // Analyze with Claude Vision
        const analysis = await this.analyzeScreenshot(
          screenshotPath,
          goal,
          email,
          password
        );

        // Check if goal achieved
        if (analysis.nextAction.type === 'complete') {
          goalAchieved = true;
          console.log('\n✅ GOAL ACHIEVED!');
          console.log(`   Final State: ${analysis.currentState}`);
          break;
        }

        // Execute next action
        await this.executeAction(page, analysis, email, password);

        // Wait before next iteration
        await page.waitForTimeout(2000);
      }

      if (!goalAchieved && iteration >= this.maxIterations) {
        console.log('\n⚠️  Maximum iterations reached without achieving goal');
      }

      // Final screenshot
      const finalScreenshot = await this.takeScreenshot(page, iteration + 1);
      console.log(`\n📸 Final screenshot: ${finalScreenshot}`);

      return {
        success: goalAchieved,
        finalState: goalAchieved ? 'Goal achieved' : 'Max iterations reached',
        iterations: iteration
      };

    } catch (error: any) {
      console.error(`\n❌ Automation failed:`, error.message);
      throw error;
    } finally {
      await page.close();
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// CLI usage
if (require.main === module) {
  (async () => {
    const agent = new VisualWebAgent();

    try {
      await agent.initialize();

      // Test with K2Think AI (or any other site with login)
      const result = await agent.automateWithVision(
        'https://www.k2think.ai',
        'Login to the website and access the chat interface',
        'developer@pixelium.uk',
        'developer123?'
      );

      console.log('\n╔════════════════════════════════════════════════╗');
      console.log('║  FINAL RESULTS                                 ║');
      console.log('╚════════════════════════════════════════════════╝');
      console.log(JSON.stringify(result, null, 2));

    } catch (error: any) {
      console.error('Error:', error.message);
    } finally {
      await agent.cleanup();
      process.exit(0);
    }
  })();
}

export default VisualWebAgent;

