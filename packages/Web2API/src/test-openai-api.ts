/**
 * Test OpenAI API - ACTUAL API CALLS
 * 
 * Makes real HTTP requests to the production server
 * Tests all registered AI services
 */

import axios from 'axios';

const API_URL = 'http://localhost:8080';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatRequest {
  model: string;
  messages: ChatMessage[];
}

interface ChatResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
}

async function testChatCompletion(model: string, question: string): Promise<void> {
  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║   Testing: ${model.padEnd(50)} ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  const startTime = Date.now();

  try {
    const request: ChatRequest = {
      model,
      messages: [
        { role: 'user', content: question }
      ]
    };

    console.log(`📤 Sending request...`);
    console.log(`   Question: "${question}"`);

    const response = await axios.post<ChatResponse>(
      `${API_URL}/v1/chat/completions`,
      request,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000 // 60s timeout
      }
    );

    const duration = Date.now() - startTime;

    const answer = response.data.choices[0]?.message?.content || 'No response';

    console.log(`\n📥 Response received in ${(duration / 1000).toFixed(1)}s:`);
    console.log(`   Answer: "${answer}"`);
    console.log(`\n✅ SUCCESS\n`);

  } catch (error) {
    const duration = Date.now() - startTime;

    if (axios.isAxiosError(error)) {
      console.log(`\n❌ FAILED after ${(duration / 1000).toFixed(1)}s:`);
      console.log(`   Status: ${error.response?.status}`);
      console.log(`   Error: ${error.response?.data?.error?.message || error.message}`);
      console.log('');
    } else {
      console.log(`\n❌ FAILED after ${(duration / 1000).toFixed(1)}s:`);
      console.log(`   Error: ${error}`);
      console.log('');
    }
  }
}

async function listModels(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   Available Models                                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    const response = await axios.get(`${API_URL}/v1/models`);
    const models = response.data.data || [];

    if (models.length === 0) {
      console.log('❌ No models available');
      return;
    }

    for (const model of models) {
      console.log(`  • ${model.id} (${model.owned_by})`);
    }

    console.log('');

  } catch (error) {
    console.log('❌ Failed to list models:', error);
  }
}

async function listServices(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   Registered Services                                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    const response = await axios.get(`${API_URL}/admin/services`);
    const services = response.data || [];

    if (services.length === 0) {
      console.log('❌ No services registered');
      return;
    }

    for (const service of services) {
      const status = service.authenticated ? '✅ Authenticated' : '⚠️  Not authenticated';
      console.log(`  ${status} ${service.name} (${service.modelAlias})`);
      console.log(`     Flows: ${service.flows}, Last used: ${service.lastUsed || 'Never'}`);
    }

    console.log('');

  } catch (error) {
    console.log('❌ Failed to list services:', error);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Web2API OpenAI API Test Suite                            ║');
  console.log('║   ACTUAL API CALLS - NO MOCKS                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // List available models
  await listModels();

  // List registered services
  await listServices();

  // Test question
  const question = 'What model are you? Answer in one sentence.';

  // Test all models
  const models = ['deepseek', 'k2think', 'grok', 'qwen', 'zai', 'mistral'];

  console.log('\n📋 Testing all models with question:');
  console.log(`   "${question}"`);
  console.log('');

  for (const model of models) {
    await testChatCompletion(model, question);
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Test Suite Complete                                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

// Check if server is running
async function checkServer(): Promise<boolean> {
  try {
    await axios.get(`${API_URL}/health`, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

// Run tests
(async () => {
  const serverRunning = await checkServer();

  if (!serverRunning) {
    console.log('❌ Server is not running!');
    console.log('');
    console.log('Please start the server first:');
    console.log('  npm run start:production');
    console.log('');
    process.exit(1);
  }

  await main();
})();

