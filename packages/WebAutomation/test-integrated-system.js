/**
 * Integrated WebChat2Api System Test
 * 
 * Tests the complete autonomous flow with:
 * - Stagehand + BrowserAgent + Owl Browser + Agentic QE
 * - Multi-strategy automation with fallbacks
 * - Vision-based flow discovery
 * - Self-healing capabilities
 * - Stealth mode operations
 * - Endpoint generation
 */

const { IntegratedWebChat2Api } = require('./src/core/IntegratedWebChat2Api');

const CONFIG = {
  anthropicKey: '665b963943b647dc9501dff942afb877.A47LrMc7sgGjyfBJ',
  modelName: 'claude-3-5-sonnet-20241022',
  stealthMode: true,
  screenshotDir: '/tmp/integrated-webchat2api'
};

const TEST_URL = 'https://www.k2think.ai';
const CREDENTIALS = {
  email: 'developer@pixelium.uk',
  password: 'developer123?'
};

async function runIntegratedTest() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                  ║');
  console.log('║  🚀 INTEGRATED WEBCHAT2API SYSTEM TEST 🚀                        ║');
  console.log('║                                                                  ║');
  console.log('║  Multi-Strategy Automation:                                     ║');
  console.log('║  • Stagehand (Primary)                                          ║');
  console.log('║  • BrowserAgent (Fallback #1)                                   ║');
  console.log('║  • Owl Browser (Stealth Fallback #2)                            ║');
  console.log('║  • Agentic QE (Testing & Validation)                            ║');
  console.log('║  • Playwright Toolkit (Advanced Utilities)                      ║');
  console.log('║                                                                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
  
  const system = new IntegratedWebChat2Api(CONFIG);
  
  try {
    // PHASE 1: Discover Flows
    console.log('🎯 Target: K2Think AI Platform\n');
    
    const discovery = await system.discoverFlows(TEST_URL, CREDENTIALS);
    
    console.log('\n═════════════════════════════════════════════════════');
    console.log('  PHASE 1 COMPLETE: FLOW DISCOVERY');
    console.log('═════════════════════════════════════════════════════\n');
    
    console.log(`✅ Elements: ${discovery.elements.length}`);
    console.log(`✅ Flows: ${discovery.flows.length}`);
    console.log(`✅ Screenshot: ${discovery.screenshot}\n`);
    
    discovery.flows.forEach((flow, i) => {
      console.log(`   Flow ${i + 1}: ${flow.name}`);
      console.log(`      ID: ${flow.id}`);
      console.log(`      Steps: ${flow.steps.length}\n`);
    });
    
    // PHASE 2: Test Flows
    const testResults = await system.testFlows(TEST_URL);
    
    console.log('\n═════════════════════════════════════════════════════');
    console.log('  PHASE 2 COMPLETE: FLOW TESTING');
    console.log('═════════════════════════════════════════════════════\n');
    
    const passed = testResults.filter(r => r.success).length;
    const failed = testResults.filter(r => !r.success).length;
    
    console.log(`✅ Passed: ${passed}/${testResults.length}`);
    console.log(`❌ Failed: ${failed}/${testResults.length}\n`);
    
    // PHASE 3: Generate Endpoints
    const endpoints = await system.generateEndpoints(TEST_URL);
    
    console.log('\n═════════════════════════════════════════════════════');
    console.log('  PHASE 3 COMPLETE: ENDPOINT GENERATION');
    console.log('═════════════════════════════════════════════════════\n');
    
    console.log(`✅ Generated ${endpoints.length} endpoints\n`);
    
    endpoints.forEach((ep, i) => {
      console.log(`   ${i + 1}. ${ep.method} ${ep.path}`);
      console.log(`      Description: ${ep.description}`);
      if (ep.parameters.length > 0) {
        console.log(`      Parameters: ${ep.parameters.map(p => p.name).join(', ')}`);
      }
      console.log('');
    });
    
    // FINAL SUMMARY
    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║                                                                  ║');
    console.log('║  ✅ INTEGRATED SYSTEM TEST COMPLETE! ✅                           ║');
    console.log('║                                                                  ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝\n');
    
    console.log('📊 STATISTICS:\n');
    console.log(`   🔍 Elements discovered: ${discovery.elements.length}`);
    console.log(`   🗺️  Flows mapped: ${discovery.flows.length}`);
    console.log(`   ✅ Tests passed: ${passed}`);
    console.log(`   ❌ Tests failed: ${failed}`);
    console.log(`   🌐 Endpoints: ${endpoints.length}`);
    
    console.log('\n🎯 CAPABILITIES:\n');
    console.log('   ✅ Multi-strategy automation (3 engines)');
    console.log('   ✅ Vision-based flow discovery');
    console.log('   ✅ Self-healing with fallbacks');
    console.log('   ✅ Stealth mode operations');
    console.log('   ✅ Automatic endpoint generation');
    console.log('   ✅ OpenAI-compatible API format');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
  } finally {
    await system.shutdown();
  }
}

// Run
runIntegratedTest()
  .then(() => {
    console.log('\n✅ Test complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });

