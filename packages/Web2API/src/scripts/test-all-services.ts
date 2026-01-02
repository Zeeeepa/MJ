#!/usr/bin/env ts-node
/**
 * Comprehensive Test Script for Web2API
 * Tests all 6 AI services with OpenAI API calls
 */

import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:8080';
const TEST_QUESTION = "What model are you?";

interface ServiceConfig {
  name: string;
  alias: string;
  url: string;
  email?: string;
  username?: string;
  password: string;
}

const services: ServiceConfig[] = [
  {
    name: 'K2Think',
    alias: 'k2think',
    url: process.env.K2THINK_URL!,
    email: process.env.K2THINK_EMAIL!,
    password: process.env.K2THINK_PASSWORD!
  },
  {
    name: 'DeepSeek',
    alias: 'deepseek',
    url: process.env.DEEPSEEK_URL!,
    email: process.env.DEEPSEEK_EMAIL!,
    password: process.env.DEEPSEEK_PASSWORD!
  },
  {
    name: 'Grok',
    alias: 'grok',
    url: process.env.GROK_URL!,
    email: process.env.GROK_EMAIL!,
    password: process.env.GROK_PASSWORD!
  },
  {
    name: 'Qwen',
    alias: 'qwen',
    url: process.env.QWEN_URL!,
    email: process.env.QWEN_EMAIL!,
    password: process.env.QWEN_PASSWORD!
  },
  {
    name: 'Z.AI',
    alias: 'zai',
    url: process.env.ZAI_URL!,
    email: process.env.ZAI_EMAIL!,
    password: process.env.ZAI_PASSWORD!
  },
  {
    name: 'Mistral',
    alias: 'mistral',
    url: process.env.MISTRAL_URL!,
    email: process.env.MISTRAL_EMAIL!,
    password: process.env.MISTRAL_PASSWORD!
  }
];

interface TestResult {
  service: string;
  alias: string;
  success: boolean;
  response?: string;
  error?: string;
  duration?: number;
}

async function waitForServer(maxAttempts = 30): Promise<boolean> {
  console.log('⏳ Waiting for server to start...');
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await axios.get(`${API_URL}/health`, { timeout: 2000 });
      console.log('✅ Server is ready!');
      return true;
    } catch (error) {
      process.stdout.write('.');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('\n❌ Server failed to start');
  return false;
}

async function registerService(service: ServiceConfig): Promise<boolean> {
  try {
    console.log(`📝 Registering ${service.name}...`);
    
    const response = await axios.post(`${API_URL}/admin/services`, {
      name: service.name,
      url: service.url,
      credentials: {
        email: service.email,
        username: service.username,
        password: service.password
      },
      modelAliases: [service.alias]
    }, {
      timeout: 10000
    });
    
    if (response.status === 200 || response.status === 201) {
      console.log(`✅ ${service.name} registered successfully`);
      return true;
    }
    
    console.log(`⚠️ ${service.name} registration returned status ${response.status}`);
    return false;
  } catch (error: any) {
    if (error.response?.status === 400 && error.response?.data?.error?.includes('already exists')) {
      console.log(`ℹ️ ${service.name} already registered`);
      return true;
    }
    console.error(`❌ Failed to register ${service.name}:`, error.message);
    return false;
  }
}

async function testService(service: ServiceConfig): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    console.log(`\n🧪 Testing ${service.name} (${service.alias})...`);
    
    const response = await axios.post(`${API_URL}/v1/chat/completions`, {
      model: service.alias,
      messages: [
        {
          role: 'user',
          content: TEST_QUESTION
        }
      ]
    }, {
      timeout: 60000, // 60 second timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const duration = Date.now() - startTime;
    
    if (response.status === 200 && response.data.choices && response.data.choices.length > 0) {
      const message = response.data.choices[0].message?.content || 
                     response.data.choices[0].delta?.content ||
                     'No response';
      
      console.log(`✅ ${service.name} responded in ${duration}ms`);
      console.log(`📝 Response: ${message.substring(0, 200)}${message.length > 200 ? '...' : ''}`);
      
      return {
        service: service.name,
        alias: service.alias,
        success: true,
        response: message,
        duration
      };
    }
    
    console.log(`⚠️ ${service.name} returned unexpected response format`);
    return {
      service: service.name,
      alias: service.alias,
      success: false,
      error: 'Unexpected response format',
      duration
    };
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
    
    console.log(`❌ ${service.name} failed: ${errorMessage}`);
    
    return {
      service: service.name,
      alias: service.alias,
      success: false,
      error: errorMessage,
      duration
    };
  }
}

async function listModels(): Promise<void> {
  try {
    console.log('\n📋 Listing available models...');
    const response = await axios.get(`${API_URL}/v1/models`);
    
    if (response.data && response.data.data) {
      console.log(`\nAvailable Models (${response.data.data.length}):`);
      response.data.data.forEach((model: any) => {
        console.log(`  - ${model.id} (owned by: ${model.owned_by})`);
      });
    }
  } catch (error: any) {
    console.error('❌ Failed to list models:', error.message);
  }
}

async function printSummary(results: TestResult[]): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`\n✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);
  
  if (successful.length > 0) {
    console.log('\n✅ SUCCESSFUL SERVICES:');
    successful.forEach(result => {
      console.log(`\n  📌 ${result.service} (${result.alias})`);
      console.log(`     Duration: ${result.duration}ms`);
      console.log(`     Response: ${result.response?.substring(0, 150)}...`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ FAILED SERVICES:');
    failed.forEach(result => {
      console.log(`\n  📌 ${result.service} (${result.alias})`);
      console.log(`     Error: ${result.error}`);
      if (result.duration) {
        console.log(`     Duration: ${result.duration}ms`);
      }
    });
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`🎯 Success Rate: ${Math.round((successful.length / results.length) * 100)}%`);
  console.log('='.repeat(80) + '\n');
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Web2API - Comprehensive Service Testing                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  // Check if server is running
  const serverReady = await waitForServer();
  if (!serverReady) {
    console.error('\n❌ Cannot connect to server. Please start it with: npm run dev');
    process.exit(1);
  }
  
  // List available models
  await listModels();
  
  // Register all services
  console.log('\n📝 Registering services...');
  const registrationResults = await Promise.all(
    services.map(service => registerService(service))
  );
  
  const registeredCount = registrationResults.filter(r => r).length;
  console.log(`\n✅ ${registeredCount}/${services.length} services registered\n`);
  
  // Wait for flow discovery to complete
  console.log('⏳ Waiting for flow discovery to complete (30 seconds)...');
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  // Test each service
  console.log('\n🧪 Starting service tests...');
  const results: TestResult[] = [];
  
  for (const service of services) {
    const result = await testService(service);
    results.push(result);
    
    // Wait between tests to avoid overwhelming services
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  // Print summary
  await printSummary(results);
  
  // Exit with appropriate code
  const allSuccessful = results.every(r => r.success);
  process.exit(allSuccessful ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main, testService, registerService };

