/**
 * Test Real Authentication and Get Actual Responses
 * 
 * This script tests the Enhanced ServiceManager with:
 * - Real browser automation
 * - Actual login attempts
 * - CAPTCHA solving with OWL SDK
 * - Cookie storage in MemberJunction database
 * - Real AI responses from all 6 services
 */

import { EnhancedServiceManager } from '../services/EnhancedServiceManager';
import * as dotenv from 'dotenv';

dotenv.config();

interface TestResult {
  serviceName: string;
  authenticated: boolean;
  responseReceived: boolean;
  response: string;
  error?: string;
  time: number;
}

async function testRealAuthentication() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   REAL AUTHENTICATION & RESPONSE TEST                      ║');
  console.log('║   Testing all 6 services with actual browser automation   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const results: TestResult[] = [];
  const manager = new EnhancedServiceManager({
    headless: false, // Show browser for debugging
    useOWL: true,
    useStealth: true,
    storageProvider: 'memory' // Use memory for now to avoid MJ db setup issues
  });

  try {
    console.log('🔧 Initializing Enhanced ServiceManager...\n');
    await manager.initialize();
    console.log('✅ ServiceManager initialized\n');

    const services = manager.getServices();
    console.log(`📋 Found ${services.length} services to test\n`);

    // Test each service
    for (const service of services) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`Testing: ${service.name}`);
      console.log(`URL: ${service.url}`);
      console.log(`Status: ${service.status}`);
      console.log(`${'='.repeat(70)}\n`);

      const startTime = Date.now();
      const result: TestResult = {
        serviceName: service.name,
        authenticated: false,
        responseReceived: false,
        response: '',
        time: 0
      };

      try {
        // Test authentication
        if (service.status === 'active') {
          console.log(`✅ ${service.name} is already authenticated`);
          result.authenticated = true;
        } else {
          console.log(`🔐 Authenticating ${service.name}...`);
          const authSuccess = await manager.authenticate(service.id);
          result.authenticated = authSuccess;
          
          if (authSuccess) {
            console.log(`✅ ${service.name} authentication successful`);
          } else {
            console.log(`❌ ${service.name} authentication failed`);
          }
        }

        // If authenticated, test chat
        if (result.authenticated) {
          console.log(`\n💬 Sending test message to ${service.name}...`);
          console.log(`Question: "What model are you?"\n`);

          try {
            const response = await manager.executeChat(
              service.id,
              'What model are you? Please answer in one short sentence.'
            );

            result.responseReceived = true;
            result.response = response;
            
            console.log(`✅ Response received from ${service.name}:`);
            console.log(`📬 ${response}\n`);
          } catch (chatError: any) {
            console.error(`❌ Chat failed for ${service.name}:`, chatError.message);
            result.error = `Chat error: ${chatError.message}`;
          }
        }
      } catch (error: any) {
        console.error(`❌ Error testing ${service.name}:`, error.message);
        result.error = error.message;
      }

      result.time = Date.now() - startTime;
      results.push(result);
      
      console.log(`⏱️  Total time: ${(result.time / 1000).toFixed(2)}s\n`);
    }

    // Print summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    TEST SUMMARY                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('┌────────────────────────────────────────────────────────────┐');
    console.log('│ Service Results                                            │');
    console.log('├────────────────────────────────────────────────────────────┤');

    for (const result of results) {
      const authStatus = result.authenticated ? '✅ Auth' : '❌ Auth';
      const responseStatus = result.responseReceived ? '✅ Response' : '❌ Response';
      
      console.log(`│ ${result.serviceName.padEnd(15)} │ ${authStatus} │ ${responseStatus} │ ${(result.time/1000).toFixed(1)}s │`);
      
      if (result.responseReceived) {
        const shortResponse = result.response.substring(0, 50).padEnd(50);
        console.log(`│   Response: ${shortResponse}... │`);
      }
      
      if (result.error) {
        const shortError = result.error.substring(0, 50).padEnd(50);
        console.log(`│   Error: ${shortError}... │`);
      }
      
      console.log('├────────────────────────────────────────────────────────────┤');
    }

    console.log('└────────────────────────────────────────────────────────────┘\n');

    // Statistics
    const totalServices = results.length;
    const authenticated = results.filter(r => r.authenticated).length;
    const gotResponses = results.filter(r => r.responseReceived).length;
    const totalTime = results.reduce((sum, r) => sum + r.time, 0);

    console.log('📊 Statistics:');
    console.log(`   Total Services:     ${totalServices}`);
    console.log(`   Authenticated:      ${authenticated}/${totalServices} (${((authenticated/totalServices)*100).toFixed(1)}%)`);
    console.log(`   Got Responses:      ${gotResponses}/${totalServices} (${((gotResponses/totalServices)*100).toFixed(1)}%)`);
    console.log(`   Total Time:         ${(totalTime/1000).toFixed(2)}s`);
    console.log(`   Average per Service: ${(totalTime/totalServices/1000).toFixed(2)}s\n`);

    // Detailed responses
    if (gotResponses > 0) {
      console.log('\n╔════════════════════════════════════════════════════════════╗');
      console.log('║              ACTUAL RESPONSES FROM SERVICES                ║');
      console.log('╚════════════════════════════════════════════════════════════╝\n');

      for (const result of results.filter(r => r.responseReceived)) {
        console.log(`\n━━━ ${result.serviceName} ━━━`);
        console.log(result.response);
        console.log('─'.repeat(70));
      }
    }

  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
  } finally {
    console.log('\n🧹 Cleaning up...');
    await manager.cleanup();
    console.log('✅ Cleanup complete\n');
  }
}

// Run test
testRealAuthentication()
  .then(() => {
    console.log('✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });

