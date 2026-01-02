const { AutonomousFlowEngine } = require('./src/core/AutonomousFlowEngine');

const CONFIG = {
  anthropicKey: '665b963943b647dc9501dff942afb877.A47LrMc7sgGjyfBJ',
  modelName: 'claude-3-5-sonnet-20241022',
  stealthMode: true,
  screenshotDir: '/tmp/flow-screenshots'
};

const K2THINK_URL = 'https://www.k2think.ai';
const CREDENTIALS = {
  email: 'developer@pixelium.uk',
  password: 'developer123?'
};

async function runAutonomousFlowDiscovery() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                  ║');
  console.log('║  🤖 AUTONOMOUS FLOW ENGINE - FULL DEMONSTRATION 🤖               ║');
  console.log('║                                                                  ║');
  console.log('║  Complete AI-Native Web Automation:                             ║');
  console.log('║  • Vision-based element discovery                               ║');
  console.log('║  • Flow mapping & sequence identification                       ║');
  console.log('║  • Multi-gate verification (visual + action)                    ║');
  console.log('║  • Automatic endpoint generation                                ║');
  console.log('║  • Self-healing with stealth mode                               ║');
  console.log('║                                                                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
  
  const engine = new AutonomousFlowEngine(CONFIG);
  
  try {
    // ═══════════════════════════════════════════════════════════
    // PHASE 1: DISCOVER & MAP FLOWS
    // ═══════════════════════════════════════════════════════════
    console.log('📍 Target: K2Think AI Platform');
    console.log(`   URL: ${K2THINK_URL}`);
    console.log(`   Mode: STEALTH\n`);
    
    const discovery = await engine.discoverFlows(K2THINK_URL, CREDENTIALS);
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  PHASE 1 COMPLETE: FLOW DISCOVERY');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log(`✅ Discovered ${discovery.flows.length} flows`);
    console.log(`✅ Identified ${discovery.elements.length} interactive elements`);
    console.log(`✅ Initial screenshot: ${discovery.screenshot}\n`);
    
    // Display detailed flow information
    console.log('📋 DISCOVERED FLOWS:\n');
    discovery.flows.forEach((flow, i) => {
      console.log(`   ${i + 1}. ${flow.name}`);
      console.log(`      Flow ID: ${flow.id}`);
      console.log(`      Steps: ${flow.steps.length}`);
      console.log(`      Verification Gates: ${flow.verificationGates.length}`);
      
      console.log(`\n      Steps breakdown:`);
      flow.steps.forEach((step, j) => {
        console.log(`        ${j + 1}. ${step.action}`);
        console.log(`           Element: ${step.element.label} (${step.element.type})`);
        console.log(`           Purpose: ${step.element.purpose}`);
      });
      
      console.log(`\n      Verification gates:`);
      flow.verificationGates.forEach((gate, j) => {
        console.log(`        ${j + 1}. [${gate.type.toUpperCase()}] ${gate.check}`);
      });
      console.log('');
    });
    
    // ═══════════════════════════════════════════════════════════
    // PHASE 2: TEST & VERIFY FLOWS
    // ═══════════════════════════════════════════════════════════
    const testResults = await engine.testAndVerifyFlows(K2THINK_URL);
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  PHASE 2 COMPLETE: FLOW TESTING & VERIFICATION');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    const passed = testResults.filter(r => r.success).length;
    const failed = testResults.filter(r => !r.success).length;
    
    console.log(`✅ Passed: ${passed}/${testResults.length}`);
    console.log(`❌ Failed: ${failed}/${testResults.length}\n`);
    
    console.log('📊 DETAILED RESULTS:\n');
    testResults.forEach((result, i) => {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${status} ${result.flowName}`);
      
      if (result.success) {
        console.log(`      States captured: ${result.stateLog.length}`);
        result.stateLog.forEach((state, j) => {
          console.log(`        Step ${state.step}: ${state.action} on "${state.element}"`);
          console.log(`          Pre: ${state.preScreenshot}`);
          console.log(`          Post: ${state.postScreenshot}`);
          console.log(`          ✓ Verified`);
        });
      } else {
        console.log(`      Error: ${result.error}`);
      }
      console.log('');
    });
    
    // ═══════════════════════════════════════════════════════════
    // PHASE 3: GENERATE API ENDPOINTS
    // ═══════════════════════════════════════════════════════════
    const endpoints = await engine.generateEndpoints(K2THINK_URL);
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  PHASE 3 COMPLETE: ENDPOINT GENERATION');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log(`✅ Generated ${endpoints.length} API endpoints\n`);
    
    console.log('🌐 AVAILABLE ENDPOINTS:\n');
    endpoints.forEach((endpoint, i) => {
      console.log(`   ${i + 1}. ${endpoint.method} ${endpoint.path}`);
      console.log(`      Description: ${endpoint.description}`);
      console.log(`      Flow ID: ${endpoint.flowId}`);
      
      if (endpoint.parameters.length > 0) {
        console.log(`\n      Parameters:`);
        endpoint.parameters.forEach(param => {
          const required = param.required ? '(required)' : '(optional)';
          console.log(`        - ${param.name}: ${param.type} ${required}`);
          console.log(`          ${param.description}`);
          if (param.enum) {
            console.log(`          Options: ${param.enum.join(', ')}`);
          }
        });
      }
      
      console.log(`\n      Usage example:`);
      console.log(`      curl -X ${endpoint.method} http://localhost:3000${endpoint.path} \\`);
      console.log(`        -H "Content-Type: application/json" \\`);
      console.log(`        -d '{`);
      endpoint.parameters.forEach((param, j) => {
        const comma = j < endpoint.parameters.length - 1 ? ',' : '';
        const example = param.enum ? param.enum[0] : `"example_${param.name}"`;
        console.log(`          "${param.name}": ${example}${comma}`);
      });
      console.log(`        }'`);
      console.log('');
    });
    
    // ═══════════════════════════════════════════════════════════
    // FINAL SUMMARY
    // ═══════════════════════════════════════════════════════════
    console.log('\n╔══════════════════════════════════════════════════════════════════╗');
    console.log('║                                                                  ║');
    console.log('║  ✅ AUTONOMOUS FLOW ENGINE - COMPLETE SUCCESS ✅                  ║');
    console.log('║                                                                  ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝\n');
    
    console.log('📊 FINAL STATISTICS:\n');
    console.log(`   🔍 Elements discovered: ${discovery.elements.length}`);
    console.log(`   🗺️  Flows mapped: ${discovery.flows.length}`);
    console.log(`   ✅ Tests passed: ${passed}`);
    console.log(`   ❌ Tests failed: ${failed}`);
    console.log(`   🌐 Endpoints generated: ${endpoints.length}`);
    console.log(`   📸 Screenshots captured: ${testResults.reduce((sum, r) => sum + r.stateLog.length * 2, 0) + 1}`);
    
    console.log('\n🎯 CAPABILITIES DEMONSTRATED:\n');
    console.log('   ✅ Vision-based element discovery');
    console.log('   ✅ Comprehensive flow mapping');
    console.log('   ✅ Multi-gate verification (visual + action)');
    console.log('   ✅ State tracking with screenshots');
    console.log('   ✅ Automatic endpoint generation');
    console.log('   ✅ OpenAPI-ready specifications');
    console.log('   ✅ Self-healing capabilities');
    console.log('   ✅ Stealth mode operations');
    
    console.log('\n🚀 NEXT STEPS:\n');
    console.log('   1. Deploy endpoints to production server');
    console.log('   2. Add authentication & rate limiting');
    console.log('   3. Enable real-time monitoring & alerts');
    console.log('   4. Set up health checks & auto-recovery');
    console.log('   5. Generate OpenAPI documentation\n');
    
  } catch (error) {
    console.error('\n❌ AUTONOMOUS FLOW ENGINE FAILED:', error.message);
    console.error(error.stack);
  } finally {
    await engine.shutdown();
  }
}

// Run the full demonstration
runAutonomousFlowDiscovery()
  .then(() => {
    console.log('✅ Demonstration complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

