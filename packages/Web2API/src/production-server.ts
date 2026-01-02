/**
 * Production Server - ACTUAL WORKING OPENAI API SERVER
 * 
 * Features:
 * - Flow recording and storage
 * - Flow replay from database
 * - Session management
 * - OpenAI-compatible API
 * - REAL responses from AI services
 */

import * as dotenv from 'dotenv';
import { FlowStorage } from './core/FlowStorage';
import { ServiceManager } from './core/ServiceManager';
import { OpenAIServer } from './api/OpenAIServer';

dotenv.config();

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   Web2API Production Server                                ║');
  console.log('║   OpenAI-Compatible API for Any AI Service                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  // Initialize storage
  const storage = new FlowStorage('./data');
  await storage.initialize();
  console.log('✅ Flow storage initialized');

  // Initialize service manager
  const serviceManager = new ServiceManager(storage);
  await serviceManager.initialize();
  console.log('✅ Service manager initialized');

  // Register AI services from environment
  await registerServices(serviceManager);

  // Start OpenAI API server
  const apiServer = new OpenAIServer(serviceManager, storage, 8080);
  await apiServer.start();

  console.log('');
  console.log('🎯 Ready to receive requests!');
  console.log('');
  console.log('📝 Example usage:');
  console.log('');
  console.log('curl -X POST http://localhost:8080/v1/chat/completions \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d \'{');
  console.log('    "model": "deepseek",');
  console.log('    "messages": [');
  console.log('      {"role": "user", "content": "What is 2+2?"}');
  console.log('    ]');
  console.log('  }\'');
  console.log('');

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log('');
    console.log('🛑 Shutting down...');
    await serviceManager.cleanup();
    process.exit(0);
  });
}

/**
 * Register AI services from environment variables
 */
async function registerServices(manager: ServiceManager) {
  console.log('');
  console.log('📋 Registering AI services...');
  console.log('');

  const services = [
    {
      name: 'DeepSeek',
      url: process.env.DEEPSEEK_URL || 'https://chat.deepseek.com/',
      email: process.env.DEEPSEEK_EMAIL,
      password: process.env.DEEPSEEK_PASSWORD,
      modelAlias: 'deepseek'
    },
    {
      name: 'K2Think',
      url: process.env.K2THINK_URL || 'https://www.k2think.ai/',
      email: process.env.K2THINK_EMAIL,
      password: process.env.K2THINK_PASSWORD,
      modelAlias: 'k2think'
    },
    {
      name: 'Grok',
      url: process.env.GROK_URL || 'https://grok.com/',
      email: process.env.GROK_EMAIL,
      password: process.env.GROK_PASSWORD,
      modelAlias: 'grok'
    },
    {
      name: 'Qwen',
      url: process.env.QWEN_URL || 'https://chat.qwen.ai/',
      email: process.env.QWEN_EMAIL,
      password: process.env.QWEN_PASSWORD,
      modelAlias: 'qwen'
    },
    {
      name: 'Z.AI',
      url: process.env.ZAI_URL || 'https://chat.z.ai/',
      email: process.env.ZAI_EMAIL,
      password: process.env.ZAI_PASSWORD,
      modelAlias: 'zai'
    },
    {
      name: 'Mistral',
      url: process.env.MISTRAL_URL || 'https://chat.mistral.ai',
      email: process.env.MISTRAL_EMAIL,
      password: process.env.MISTRAL_PASSWORD,
      modelAlias: 'mistral'
    }
  ];

  for (const config of services) {
    if (config.email && config.password) {
      try {
        const service = await manager.registerService(config);
        console.log(`  ✅ ${config.name} (${config.modelAlias})`);
      } catch (error) {
        console.log(`  ❌ ${config.name}: ${error}`);
      }
    } else {
      console.log(`  ⚠️  ${config.name}: No credentials (skipped)`);
    }
  }
}

// Run the server
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

