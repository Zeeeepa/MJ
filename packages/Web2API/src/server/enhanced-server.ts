/**
 * Enhanced Web2API Server with Real Authentication
 * 
 * Features:
 * - ALWAYS logs in if credentials provided
 * - Real browser automation with CAPTCHA solving
 * - Cookie storage in MemberJunction database
 * - Multiple strategy support
 * - OpenAI-compatible API
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { EnhancedServiceManager } from '../services/EnhancedServiceManager';
import { OpenAICompatibleRequest, OpenAICompatibleResponse } from '../types';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Global service manager
let serviceManager: EnhancedServiceManager;

/**
 * Initialize server
 */
async function initializeServer() {
  console.log('🚀 Starting Enhanced Web2API Server...');
  
  serviceManager = new EnhancedServiceManager({
    headless: process.env.HEADLESS !== 'false',
    useOWL: true,
    useStealth: true,
    storageProvider: 'mj-database'
  });

  await serviceManager.initialize();
  
  console.log('\n🌐 Enhanced Web2API Server running on http://localhost:' + PORT);
  console.log('\n📚 Available endpoints:');
  console.log('   GET  /health                   - Health check');
  console.log('   GET  /admin/services           - List services');
  console.log('   POST /admin/services           - Register service');
  console.log('   POST /admin/services/:id/auth  - Authenticate service');
  console.log('   GET  /v1/models                - List models (OpenAI compatible)');
  console.log('   POST /v1/chat/completions      - Chat (OpenAI compatible)');
  console.log('\n✨ Ready to accept requests with REAL authentication!\n');
}

/**
 * Health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  const services = serviceManager.getServices();
  const activeServices = services.filter(s => s.status === 'active').length;
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    services: services.length,
    authenticated: activeServices,
    features: [
      'real-authentication',
      'captcha-solving',
      'cookie-storage',
      'mj-database',
      'openai-compatible'
    ]
  });
});

/**
 * List all services
 */
app.get('/admin/services', (req: Request, res: Response) => {
  const services = serviceManager.getServices();
  res.json({
    success: true,
    services: services.map(s => ({
      ...s,
      credentials: { email: s.credentials.email, hasPassword: !!s.credentials.password }
    }))
  });
});

/**
 * Register new service
 */
app.post('/admin/services', async (req: Request, res: Response) => {
  try {
    const { name, url, email, username, password } = req.body;

    if (!name || !url || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, url, password'
      });
    }

    const service = await serviceManager.registerService({
      name,
      url,
      email,
      username,
      password
    });

    // ALWAYS authenticate if credentials provided
    console.log(`🔐 Auto-authenticating ${name}...`);
    await serviceManager.authenticate(service.id);

    res.json({
      success: true,
      service: {
        ...service,
        credentials: { email: service.credentials.email, hasPassword: true }
      }
    });
  } catch (error: any) {
    console.error('Error registering service:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Manually trigger authentication for a service
 */
app.post('/admin/services/:id/auth', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const service = serviceManager.getService(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Service not found'
      });
    }

    console.log(`🔐 Manual authentication requested for ${service.name}...`);
    const success = await serviceManager.authenticate(id);

    res.json({
      success,
      service: {
        ...service,
        credentials: { email: service.credentials.email, hasPassword: true }
      }
    });
  } catch (error: any) {
    console.error('Error authenticating service:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * List models (OpenAI compatible)
 */
app.get('/v1/models', (req: Request, res: Response) => {
  const services = serviceManager.getServices();
  const models = services.map(service => ({
    id: service.modelAliases[0] || service.name.toLowerCase(),
    object: 'model',
    created: Math.floor((service.createdAt?.getTime() || Date.now()) / 1000),
    owned_by: service.name,
    permission: [],
    root: service.modelAliases[0] || service.name.toLowerCase(),
    parent: null,
    authenticated: service.status === 'active'
  }));

  res.json({
    object: 'list',
    data: models
  });
});

/**
 * Chat completions (OpenAI compatible) with REAL responses
 */
app.post('/v1/chat/completions', async (req: Request, res: Response) => {
  try {
    const openaiRequest: OpenAICompatibleRequest = req.body;
    
    if (!openaiRequest.model || !openaiRequest.messages || openaiRequest.messages.length === 0) {
      return res.status(400).json({
        error: {
          message: 'Invalid request: model and messages are required',
          type: 'invalid_request_error',
          code: 'invalid_request'
        }
      });
    }

    // Find service by model alias
    const services = serviceManager.getServices();
    const service = services.find(s => 
      s.modelAliases.some(alias => alias === openaiRequest.model) ||
      s.name.toLowerCase().replace(/[^a-z0-9]/g, '') === openaiRequest.model
    );

    if (!service) {
      return res.status(404).json({
        error: {
          message: `Model '${openaiRequest.model}' not found`,
          type: 'invalid_request_error',
          code: 'model_not_found'
        }
      });
    }

    // Get the user message
    const userMessage = openaiRequest.messages[openaiRequest.messages.length - 1];
    if (userMessage.role !== 'user') {
      return res.status(400).json({
        error: {
          message: 'Last message must be from user',
          type: 'invalid_request_error',
          code: 'invalid_message'
        }
      });
    }

    console.log(`\n📨 Executing request on ${service.name} (${openaiRequest.model})`);
    console.log(`💬 Message: ${userMessage.content}`);

    // Execute chat with REAL browser automation
    const responseText = await serviceManager.executeChat(service.id, userMessage.content as string);

    console.log(`✅ Got real response from ${service.name}`);
    console.log(`📬 Response: ${responseText.substring(0, 200)}...`);

    // Return OpenAI-compatible response with REAL content
    const response: OpenAICompatibleResponse = {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: openaiRequest.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: responseText
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: userMessage.content.toString().length / 4,
        completion_tokens: responseText.length / 4,
        total_tokens: (userMessage.content.toString().length + responseText.length) / 4
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('Chat completion error:', error);
    res.status(500).json({
      error: {
        message: error.message || 'Internal server error',
        type: 'server_error',
        code: 'internal_error'
      }
    });
  }
});

/**
 * Start server
 */
initializeServer()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Server started successfully`);
    });
  })
  .catch(error => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  if (serviceManager) {
    await serviceManager.cleanup();
  }
  process.exit(0);
});

export default app;

