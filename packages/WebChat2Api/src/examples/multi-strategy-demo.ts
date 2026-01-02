/**
 * Multi-Strategy System Demo
 * 
 * Demonstrates the complete Web2API multi-strategy system with:
 * - Vision Model Strategy (GLM-4.6V, Claude 3.5 Sonnet, GPT-4o)
 * - Computer Use Strategy (@centralinc/browseragent)
 * - Natural Language Strategy (@olib-ai/owl-browser-sdk)
 * - DOM Analysis Strategy
 * - Flow recording and validation
 * - OpenAI-compatible API endpoints
 */

import { chromium, Browser, Page } from 'playwright';
import {
  StrategyOrchestrator,
  VisionModelStrategy,
  ComputerUseStrategy,
  NaturalLanguageStrategy,
  DOMAnalysisStrategy,
  FlowManager,
  IdentificationContext,
  WebService,
  FlowContext,
  ElementAction,
  StrategyConfig
} from '../strategies';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Demo: Identify login elements using multiple strategies
 */
async function demoElementIdentification() {
  console.log('\n=== DEMO: Element Identification ===\n');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Navigate to a login page
    await page.goto('https://chat.openai.com');
    await page.waitForLoadState('networkidle');

    // Initialize strategy orchestrator
    const orchestrator = new StrategyOrchestrator();

    // Configure strategies
    const config: StrategyConfig = {
      timeout: 30000,
      stealthMode: true,
      visualDebug: true,
      apiKeys: {
        anthropic: process.env.ANTHROPIC_API_KEY || '',
        openai: process.env.OPENAI_API_KEY || '',
        glm: process.env.GLM_API_KEY || ''
      },
      modelConfig: {
        visionModel: 'claude-3.5-sonnet',
        temperature: 0.1,
        maxTokens: 4000
      }
    };

    // Register all strategies
    orchestrator.registerStrategy(new VisionModelStrategy());
    orchestrator.registerStrategy(new ComputerUseStrategy());
    orchestrator.registerStrategy(new NaturalLanguageStrategy());
    orchestrator.registerStrategy(new DOMAnalysisStrategy());

    // Initialize orchestrator
    await orchestrator.initialize(page, config);

    // Take screenshot for vision analysis
    const screenshot = await page.screenshot({ fullPage: false });

    // Create identification context
    const context: IdentificationContext = {
      url: page.url(),
      intent: 'Find the login button and email input field',
      hints: ['authentication', 'sign in'],
      screenshot
    };

    // Identify elements using best strategy
    console.log('Identifying elements...');
    const elements = await orchestrator.identifyElements(context);

    console.log(`\nFound ${elements.length} elements:`);
    for (const element of elements) {
      console.log(`- ${element.type}: "${element.text || element.visualDescription}"`);
      console.log(`  Identified by: ${element.identifiedBy}`);
      console.log(`  Confidence: ${element.confidence}`);
      console.log(`  Selectors: ${element.selectors.length}`);
    }

    await orchestrator.cleanup();

  } catch (error) {
    console.error('Demo failed:', error);
  } finally {
    await browser.close();
  }
}

/**
 * Demo: Record and execute interaction flow
 */
async function demoFlowRecording() {
  console.log('\n=== DEMO: Flow Recording and Execution ===\n');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Initialize orchestrator
    const orchestrator = new StrategyOrchestrator();
    const config: StrategyConfig = {
      timeout: 30000,
      visualDebug: true,
      apiKeys: {
        openai: process.env.OPENAI_API_KEY || ''
      }
    };

    orchestrator.registerStrategy(new DOMAnalysisStrategy());
    orchestrator.registerStrategy(new NaturalLanguageStrategy());
    await orchestrator.initialize(page, config);

    // Initialize flow manager
    const flowManager = new FlowManager(orchestrator);

    // Navigate to demo site
    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');

    // Create a service
    const service: WebService = {
      id: 'example-service',
      name: 'Example Service',
      url: 'https://example.com',
      credentials: {},
      features: [],
      flows: [],
      status: 'active'
    };

    // Create a flow
    const flow = flowManager.createFlow(
      service.id,
      'Navigate and Extract Content',
      'Navigate to example.com and extract the main heading'
    );

    console.log(`Created flow: ${flow.name} (${flow.id})`);

    // Identify elements
    const screenshot = await page.screenshot({ fullPage: false });
    const context: IdentificationContext = {
      url: page.url(),
      intent: 'Find the main heading and "More information" link',
      screenshot
    };

    const elements = await orchestrator.identifyElements(context);
    console.log(`Identified ${elements.length} elements`);

    if (elements.length > 0) {
      // Add steps to flow
      const headingElement = elements.find(e => e.type === 'container' || e.text?.includes('Example'));
      
      if (headingElement) {
        const extractAction: ElementAction = {
          type: 'extract',
          element: headingElement,
          params: {}
        };

        flowManager.addStep(
          flow.id,
          'Extract main heading text',
          extractAction,
          [{
            type: 'timeout',
            params: { duration: 1000 },
            timeout: 5000
          }]
        );

        console.log('Added extraction step to flow');
      }
    }

    // Execute the flow
    const flowContext: FlowContext = {
      page,
      service,
      session: undefined,
      data: {}
    };

    console.log('\nExecuting flow...');
    const result = await flowManager.executeFlow(flow.id, flowContext);

    console.log('\nFlow Execution Result:');
    console.log(`Success: ${result.success}`);
    console.log(`Execution Time: ${result.executionTime}ms`);
    console.log(`Steps: ${result.stepResults.length}`);
    
    for (const stepResult of result.stepResults) {
      console.log(`  Step ${stepResult.stepNumber}: ${stepResult.success ? '✓' : '✗'} (${stepResult.executionTime}ms)`);
      if (stepResult.error) {
        console.log(`    Error: ${stepResult.error}`);
      }
    }

    // Export flows
    const exportedFlows = flowManager.exportFlows();
    console.log('\nExported flows (sample):');
    console.log(exportedFlows.substring(0, 500) + '...');

    await orchestrator.cleanup();

  } catch (error) {
    console.error('Demo failed:', error);
  } finally {
    await browser.close();
  }
}

/**
 * Demo: Multi-strategy fallback
 */
async function demoStrategyFallback() {
  console.log('\n=== DEMO: Strategy Fallback ===\n');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');

    const orchestrator = new StrategyOrchestrator();
    const config: StrategyConfig = {
      timeout: 30000,
      visualDebug: true
    };

    // Register strategies in priority order
    orchestrator.registerStrategy(new DOMAnalysisStrategy());
    orchestrator.registerStrategy(new VisionModelStrategy());
    await orchestrator.initialize(page, config);

    // Simulate identification with fallback
    const context: IdentificationContext = {
      url: page.url(),
      intent: 'Find the "More information" link',
      previousAttempts: [] // Start fresh
    };

    console.log('Attempt 1: Using best available strategy');
    let elements = await orchestrator.identifyElements(context);
    console.log(`Found ${elements.length} elements with ${elements[0]?.identifiedBy || 'unknown'} strategy`);

    // Simulate failure and retry with different strategy
    if (elements.length > 0) {
      context.previousAttempts = [elements[0].identifiedBy];
      
      console.log('\nAttempt 2: Retrying with fallback strategy');
      elements = await orchestrator.identifyElements(context);
      console.log(`Found ${elements.length} elements with ${elements[0]?.identifiedBy || 'unknown'} strategy`);
    }

    await orchestrator.cleanup();

  } catch (error) {
    console.error('Demo failed:', error);
  } finally {
    await browser.close();
  }
}

/**
 * Main demo runner
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Web2API Multi-Strategy System Demo                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const demos = [
    { name: 'Element Identification', fn: demoElementIdentification },
    { name: 'Flow Recording', fn: demoFlowRecording },
    { name: 'Strategy Fallback', fn: demoStrategyFallback }
  ];

  // Check which demo to run
  const demoArg = process.argv[2];
  
  if (demoArg) {
    const demo = demos.find(d => 
      d.name.toLowerCase().replace(' ', '-') === demoArg.toLowerCase()
    );
    
    if (demo) {
      await demo.fn();
    } else {
      console.log(`Unknown demo: ${demoArg}`);
      console.log('Available demos:', demos.map(d => d.name.toLowerCase().replace(' ', '-')).join(', '));
    }
  } else {
    // Run all demos
    for (const demo of demos) {
      await demo.fn();
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n✓ Demo completed!');
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { demoElementIdentification, demoFlowRecording, demoStrategyFallback };
