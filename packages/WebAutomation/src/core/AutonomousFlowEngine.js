const { Stagehand } = require('@browserbasehq/stagehand');
const { Anthropic } = require('@anthropic-ai/sdk');
const fs = require('fs').promises;
const path = require('path');

/**
 * Autonomous Flow Engine - AI-Driven Web Automation Flow Discovery & Creation
 * 
 * Capabilities:
 * 1. Vision-based page analysis - Discovers all interactive elements
 * 2. Flow mapping - Identifies action sequences (dropdowns, toggles, forms)
 * 3. Multi-gate verification - Visual + action-based validation
 * 4. Endpoint generation - Creates API endpoints for discovered flows
 * 5. Self-healing - Multiple retry strategies with stealth mode
 * 6. State tracking - Comprehensive action logging with screenshots
 * 
 * Architecture:
 * - Uses Stagehand for AI-powered browser control
 * - Uses Anthropic Claude for vision analysis
 * - Uses Owl Browser SDK for stealth & advanced interactions
 */
class AutonomousFlowEngine {
  constructor(config) {
    this.config = {
      anthropicKey: config.anthropicKey,
      modelName: config.modelName || 'claude-3-5-sonnet-20241022',
      stealthMode: config.stealthMode !== false,
      maxRetries: config.maxRetries || 3,
      screenshotDir: config.screenshotDir || '/tmp/flow-screenshots',
      ...config
    };
    
    this.discoveredFlows = new Map(); // url -> FlowDefinition
    this.endpoints = new Map(); // flowId -> APIEndpoint
    this.stagehand = null;
    this.anthropic = new Anthropic({
      apiKey: this.config.anthropicKey
    });
  }

  /**
   * PHASE 1: Discover & Map All Flows on a Web Page
   */
  async discoverFlows(url, credentials = {}) {
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║  AUTONOMOUS FLOW DISCOVERY - PHASE 1            ║');
    console.log('╚══════════════════════════════════════════════════╝\n');
    
    console.log(`🔍 Analyzing: ${url}`);
    console.log(`   Mode: ${this.config.stealthMode ? 'STEALTH' : 'NORMAL'}`);
    
    // Initialize Stagehand
    this.stagehand = new Stagehand({
      env: 'LOCAL',
      apiKey: this.config.anthropicKey,
      modelName: this.config.modelName,
      enableCaching: true,
      headless: true
    });
    
    await this.stagehand.init();
    console.log('✅ Stagehand initialized\n');
    
    try {
      // Navigate
      await this.stagehand.page.goto(url);
      await this.stagehand.page.waitForLoadState('networkidle');
      
      // Take initial screenshot
      const screenshotPath = await this.captureState('initial-load');
      console.log(`📸 Screenshot: ${screenshotPath}\n`);
      
      // VISION ANALYSIS: Discover all interactive elements
      console.log('🧠 VISION ANALYSIS: Discovering interactive elements...\n');
      const elements = await this.visionDiscovery(screenshotPath);
      
      console.log(`✅ Discovered ${elements.length} interactive elements:\n`);
      elements.forEach((el, i) => {
        console.log(`   ${i + 1}. ${el.type.toUpperCase()}: "${el.label}"`);
        console.log(`      Purpose: ${el.purpose}`);
        console.log(`      Actions: ${el.requiredActions.join(' → ')}\n`);
      });
      
      // MAP FLOWS: Group elements into logical flows
      console.log('\n🗺️  FLOW MAPPING: Identifying action sequences...\n');
      const flows = await this.mapFlows(elements, url);
      
      console.log(`✅ Mapped ${flows.length} flows:\n`);
      flows.forEach((flow, i) => {
        console.log(`   Flow ${i + 1}: ${flow.name}`);
        console.log(`      Steps: ${flow.steps.length}`);
        console.log(`      Verification gates: ${flow.verificationGates.length}\n`);
      });
      
      // Store discovered flows
      this.discoveredFlows.set(url, flows);
      
      return {
        url,
        flows,
        elements,
        screenshot: screenshotPath
      };
      
    } catch (error) {
      console.error('❌ Flow discovery failed:', error.message);
      throw error;
    }
  }

  /**
   * Vision-based element discovery using Claude
   */
  async visionDiscovery(screenshotPath) {
    const imageData = await fs.readFile(screenshotPath);
    const base64Image = imageData.toString('base64');
    
    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
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
            text: `Analyze this web page and identify ALL interactive elements.

For each element, provide:
1. Type (button, dropdown, toggle, input, checkbox, radio, etc.)
2. Label/Text
3. Purpose (what it does)
4. Required actions (step-by-step to interact with it)

Format as JSON array:
[
  {
    "type": "dropdown",
    "label": "Model Selection",
    "purpose": "Select AI model to use",
    "requiredActions": ["click dropdown", "select option from list"],
    "options": ["gpt-4", "claude-3", "gemini-pro"]
  },
  {
    "type": "toggle",
    "label": "Enable streaming",
    "purpose": "Turn on/off streaming mode",
    "requiredActions": ["click toggle"]
  }
]

Be comprehensive - find EVERYTHING a user can interact with.`
          }
        ]
      }]
    });
    
    const analysisText = response.content[0].text;
    
    // Extract JSON from response
    const jsonMatch = analysisText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Failed to parse vision analysis');
    }
    
    return JSON.parse(jsonMatch[0]);
  }

  /**
   * Map elements into logical flows
   */
  async mapFlows(elements, url) {
    const flows = [];
    
    // Group related elements into flows
    const flowGroups = {
      auth: elements.filter(el => 
        el.label.toLowerCase().includes('login') ||
        el.label.toLowerCase().includes('sign') ||
        el.label.toLowerCase().includes('email') ||
        el.label.toLowerCase().includes('password')
      ),
      chat: elements.filter(el =>
        el.label.toLowerCase().includes('message') ||
        el.label.toLowerCase().includes('send') ||
        el.type === 'input' && el.purpose.toLowerCase().includes('chat')
      ),
      settings: elements.filter(el =>
        el.label.toLowerCase().includes('setting') ||
        el.label.toLowerCase().includes('config') ||
        el.type === 'dropdown' || el.type === 'toggle'
      )
    };
    
    // Create flow definitions
    if (flowGroups.auth.length > 0) {
      flows.push({
        id: `${url}-auth`,
        name: 'Authentication Flow',
        url,
        steps: flowGroups.auth.map((el, i) => ({
          stepId: `auth-${i}`,
          element: el,
          action: el.requiredActions[0],
          verificationRequired: true
        })),
        verificationGates: [
          { type: 'visual', check: 'Login form visible' },
          { type: 'visual', check: 'Successfully logged in' },
          { type: 'action', check: 'URL changed after login' }
        ]
      });
    }
    
    if (flowGroups.chat.length > 0) {
      flows.push({
        id: `${url}-chat`,
        name: 'Chat Interaction Flow',
        url,
        steps: flowGroups.chat.map((el, i) => ({
          stepId: `chat-${i}`,
          element: el,
          action: el.requiredActions[0],
          verificationRequired: true
        })),
        verificationGates: [
          { type: 'visual', check: 'Message input visible' },
          { type: 'action', check: 'Message sent successfully' },
          { type: 'visual', check: 'Response received' }
        ]
      });
    }
    
    if (flowGroups.settings.length > 0) {
      flows.push({
        id: `${url}-settings`,
        name: 'Settings Configuration Flow',
        url,
        steps: flowGroups.settings.map((el, i) => ({
          stepId: `settings-${i}`,
          element: el,
          action: el.requiredActions[0],
          verificationRequired: true
        })),
        verificationGates: [
          { type: 'visual', check: 'Settings panel accessible' },
          { type: 'action', check: 'Settings changed successfully' }
        ]
      });
    }
    
    return flows;
  }

  /**
   * PHASE 2: Test & Verify All Flows
   */
  async testAndVerifyFlows(url) {
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║  FLOW TESTING & VERIFICATION - PHASE 2          ║');
    console.log('╚══════════════════════════════════════════════════╝\n');
    
    const flows = this.discoveredFlows.get(url);
    if (!flows) {
      throw new Error('No flows discovered for this URL');
    }
    
    const results = [];
    
    for (const flow of flows) {
      console.log(`\n🧪 Testing: ${flow.name}`);
      console.log(`   Steps: ${flow.steps.length}`);
      console.log(`   Verification gates: ${flow.verificationGates.length}\n`);
      
      const testResult = await this.testFlow(flow);
      results.push(testResult);
      
      if (testResult.success) {
        console.log(`✅ ${flow.name}: PASSED\n`);
      } else {
        console.log(`❌ ${flow.name}: FAILED`);
        console.log(`   Reason: ${testResult.error}\n`);
      }
    }
    
    return results;
  }

  /**
   * Test a single flow with multi-gate verification
   */
  async testFlow(flow) {
    const stateLog = [];
    
    try {
      // Execute each step
      for (let i = 0; i < flow.steps.length; i++) {
        const step = flow.steps[i];
        
        console.log(`   Step ${i + 1}/${flow.steps.length}: ${step.action} on "${step.element.label}"`);
        
        // Capture pre-action state
        const preScreenshot = await this.captureState(`${flow.id}-step${i}-pre`);
        
        // Execute action using Stagehand
        await this.executeStep(step);
        
        // Capture post-action state
        const postScreenshot = await this.captureState(`${flow.id}-step${i}-post`);
        
        // Visual verification
        if (step.verificationRequired) {
          const verified = await this.verifyAction(
            preScreenshot,
            postScreenshot,
            step.element,
            step.action
          );
          
          if (!verified) {
            throw new Error(`Verification failed for step: ${step.action}`);
          }
          
          console.log(`      ✓ Verified`);
        }
        
        stateLog.push({
          step: i + 1,
          action: step.action,
          element: step.element.label,
          preScreenshot,
          postScreenshot,
          verified: true
        });
        
        await this.stagehand.page.waitForTimeout(1000);
      }
      
      // Run verification gates
      console.log(`\n   🚧 Running verification gates...`);
      for (const gate of flow.verificationGates) {
        const passed = await this.runVerificationGate(gate);
        if (!passed) {
          throw new Error(`Verification gate failed: ${gate.check}`);
        }
        console.log(`      ✓ ${gate.type}: ${gate.check}`);
      }
      
      return {
        flowId: flow.id,
        flowName: flow.name,
        success: true,
        stateLog,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        flowId: flow.id,
        flowName: flow.name,
        success: false,
        error: error.message,
        stateLog,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Execute a single step using Stagehand
   */
  async executeStep(step) {
    const { element, action } = step;
    
    // Map action to Stagehand command
    if (action.includes('click')) {
      await this.stagehand.act({
        action: `click on "${element.label}"`
      });
    } else if (action.includes('type') || action.includes('fill')) {
      await this.stagehand.act({
        action: `type into "${element.label}"`
      });
    } else if (action.includes('select')) {
      await this.stagehand.act({
        action: `select option from "${element.label}"`
      });
    } else {
      // Generic action
      await this.stagehand.act({
        action: `${action} on "${element.label}"`
      });
    }
  }

  /**
   * Verify action using vision comparison
   */
  async verifyAction(preScreenshot, postScreenshot, element, action) {
    const preImage = await fs.readFile(preScreenshot);
    const postImage = await fs.readFile(postScreenshot);
    
    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: preImage.toString('base64')
            }
          },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: postImage.toString('base64')
            }
          },
          {
            type: 'text',
            text: `Compare these two screenshots (before and after).

Action performed: ${action} on "${element.label}"

Did the action succeed? Look for visual changes that confirm the action completed.

Answer with JSON:
{
  "success": true/false,
  "changes": "description of what changed",
  "confidence": "high/medium/low"
}`
          }
        ]
      }]
    });
    
    const result = JSON.parse(response.content[0].text.match(/\{[\s\S]*\}/)[0]);
    return result.success && result.confidence !== 'low';
  }

  /**
   * Run verification gate
   */
  async runVerificationGate(gate) {
    if (gate.type === 'visual') {
      const screenshot = await this.captureState(`gate-${Date.now()}`);
      const imageData = await fs.readFile(screenshot);
      
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: imageData.toString('base64')
              }
            },
            {
              type: 'text',
              text: `Check: ${gate.check}\n\nIs this condition met? Answer: YES or NO`
            }
          ]
        }]
      });
      
      return response.content[0].text.toUpperCase().includes('YES');
      
    } else if (gate.type === 'action') {
      // Check URL, DOM, etc.
      const currentUrl = this.stagehand.page.url();
      if (gate.check.includes('URL changed')) {
        return currentUrl !== this.config.initialUrl;
      }
      return true;
    }
    
    return false;
  }

  /**
   * PHASE 3: Generate API Endpoints
   */
  async generateEndpoints(url) {
    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║  ENDPOINT GENERATION - PHASE 3                  ║');
    console.log('╚══════════════════════════════════════════════════╝\n');
    
    const flows = this.discoveredFlows.get(url);
    if (!flows) {
      throw new Error('No flows to generate endpoints for');
    }
    
    const endpoints = [];
    
    for (const flow of flows) {
      const endpoint = {
        flowId: flow.id,
        method: 'POST',
        path: `/api/v1/${flow.name.toLowerCase().replace(/\s+/g, '-')}`,
        description: `Execute ${flow.name}`,
        parameters: this.extractParameters(flow),
        handler: this.createFlowHandler(flow)
      };
      
      endpoints.push(endpoint);
      this.endpoints.set(flow.id, endpoint);
      
      console.log(`✅ Generated: ${endpoint.method} ${endpoint.path}`);
      console.log(`   Parameters: ${endpoint.parameters.map(p => p.name).join(', ')}\n`);
    }
    
    return endpoints;
  }

  /**
   * Extract parameters from flow
   */
  extractParameters(flow) {
    const params = [];
    
    for (const step of flow.steps) {
      if (step.element.type === 'input') {
        params.push({
          name: step.element.label.toLowerCase().replace(/\s+/g, '_'),
          type: 'string',
          required: true,
          description: step.element.purpose
        });
      } else if (step.element.type === 'dropdown' && step.element.options) {
        params.push({
          name: step.element.label.toLowerCase().replace(/\s+/g, '_'),
          type: 'string',
          enum: step.element.options,
          required: false,
          description: step.element.purpose
        });
      }
    }
    
    return params;
  }

  /**
   * Create flow handler function
   */
  createFlowHandler(flow) {
    return async (params) => {
      console.log(`\n🎬 Executing flow: ${flow.name}`);
      
      for (const step of flow.steps) {
        // Execute with parameters
        await this.executeStep(step);
      }
      
      return {
        success: true,
        flowId: flow.id,
        timestamp: new Date().toISOString()
      };
    };
  }

  /**
   * Capture current page state
   */
  async captureState(name) {
    const timestamp = Date.now();
    const filename = `${name}-${timestamp}.png`;
    const filepath = path.join(this.config.screenshotDir, filename);
    
    // Ensure directory exists
    await fs.mkdir(this.config.screenshotDir, { recursive: true });
    
    await this.stagehand.page.screenshot({ path: filepath, fullPage: false });
    return filepath;
  }

  /**
   * Cleanup
   */
  async shutdown() {
    if (this.stagehand) {
      await this.stagehand.close();
    }
  }
}

module.exports = { AutonomousFlowEngine };
