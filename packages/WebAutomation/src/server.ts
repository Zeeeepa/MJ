import express from 'express';
import cors from 'cors';
import * as fs from 'fs/promises';
import { ServiceOrchestrator } from './core/ServiceOrchestrator';
import { StorageManager } from './core/StorageManager';
import { OpenAIGateway } from './api/OpenAIGateway';
import { Account, ProgressEvent } from './types';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize components
const storage = new StorageManager('./data');
const gateway = new OpenAIGateway(storage);

/**
 * Load accounts from accounts.json
 */
async function loadAccounts(): Promise<Account[]> {
  try {
    const data = await fs.readFile('./accounts.json', 'utf-8');
    const config = JSON.parse(data);
    return config.accounts.filter((account: Account) => account.enabled);
  } catch (error) {
    console.error('Failed to load accounts.json:', error);
    return [];
  }
}

/**
 * Initialize all enabled services
 */
async function initializeServices(): Promise<void> {
  console.log('🚀 Initializing services...');
  
  await storage.initialize();
  const accounts = await loadAccounts();
  
  if (accounts.length === 0) {
    console.warn('⚠️  No enabled accounts found in accounts.json');
    return;
  }
  
  console.log(`📋 Found ${accounts.length} enabled account(s)`);
  
  for (const account of accounts) {
    try {
      console.log(`\n🔧 Initializing service: ${account.name}`);
      console.log(`   URL: ${account.url}`);
      
      // Create orchestrator with progress callback
      const orchestrator = new ServiceOrchestrator(
        account,
        storage,
        (event: ProgressEvent) => {
          console.log(`   📡 [${event.event}]`, JSON.stringify(event.data));
        }
      );
      
      // Initialize service (login, discover flows)
      const service = await orchestrator.initialize();
      
      // Register with API gateway
      gateway.registerService(service.id, orchestrator);
      
      console.log(`✅ Service ready: ${service.id}`);
      console.log(`   Model name: service-${service.id}`);
      console.log(`   Flows discovered: ${service.flows?.length || 0}`);
      service.flows?.forEach(flow => {
        console.log(`      - ${flow.name}: ${flow.description || 'No description'}`);
      });
    } catch (error: any) {
      console.error(`❌ Failed to initialize ${account.name}:`, error.message);
    }
  }
  
  console.log('\n✨ All services initialized!\n');
}

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/v1/models', async (req, res) => {
  await gateway.handleListModels(req, res);
});

app.post('/v1/chat/completions', async (req, res) => {
  await gateway.handleChatCompletions(req, res);
});

app.get('/', (req, res) => {
  res.json({
    message: 'Vision-Based Web Automation Server',
    version: '1.0.0',
    endpoints: {
      health: 'GET /health',
      models: 'GET /v1/models',
      chat: 'POST /v1/chat/completions',
    },
    documentation: 'See README.md for usage instructions',
  });
});

// Start server
async function start() {
  try {
    console.log('🤖 Vision-Based Web Automation Server');
    console.log('=====================================\n');
    
    // Initialize services first
    await initializeServices();
    
    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`🌐 Server running on http://localhost:${PORT}`);
      console.log(`📖 API Documentation: http://localhost:${PORT}`);
      console.log(`💡 Health check: http://localhost:${PORT}/health`);
      console.log(`📋 List models: http://localhost:${PORT}/v1/models`);
      console.log(`💬 Chat endpoint: POST http://localhost:${PORT}/v1/chat/completions\n`);
      console.log('Example usage:');
      console.log(`  curl http://localhost:${PORT}/v1/chat/completions \\`);
      console.log(`    -H "Content-Type: application/json" \\`);
      console.log(`    -d '{"model":"service-k2think-ai","messages":[{"role":"user","content":"Hello"}]}'\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit(0);
});

// Start the server
start();
