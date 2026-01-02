/**
 * Web2API Server - OpenAI Compatible API for Web Chat Services
 * Built with MemberJunction Framework
 */

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { ServiceManager } from '../services/ServiceManager';
import { OpenAIChatRequest, OpenAIChatResponse, OpenAIModel } from '../types';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize Service Manager
const serviceManager = new ServiceManager();

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: serviceManager.getServicesCount()
  });
});

// List all services
app.get('/admin/services', async (req: Request, res: Response) => {
  try {
    const services = await serviceManager.listServices();
    res.json({
      success: true,
      services,
      count: services.length
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Register a new service
app.post('/admin/services', async (req: Request, res: Response) => {
  try {
    const { name, url, email, username, password, defaultModel, modelAliases } = req.body;
    
    if (!name || !url) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, url'
      });
    }

    const service = await serviceManager.registerService({
      name,
      url,
      credentials: { email, username, password },
      defaultModel,
      modelAliases
    });

    res.json({
      success: true,
      service,
      message: 'Service registered successfully. Flow discovery will run in background.'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get service details with flows
app.get('/admin/services/:serviceId', async (req: Request, res: Response) => {
  try {
    const { serviceId } = req.params;
    const service = await serviceManager.getService(serviceId);
    const flows = await serviceManager.getServiceFlows(serviceId);
    
    res.json({
      success: true,
      service,
      flows,
      flowCount: flows.length
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

// OpenAI Compatible: List models
app.get('/v1/models', async (req: Request, res: Response) => {
  try {
    const services = await serviceManager.listServices();
    const models: OpenAIModel[] = services
      .filter(s => s.enabled && s.status === 'active')
      .map(service => ({
        id: service.defaultModel || service.serviceId,
        object: 'model' as const,
        created: Math.floor(new Date(service.createdAt).getTime() / 1000),
        owned_by: service.name
      }));

    // Add model aliases
    const aliases = await serviceManager.getModelAliases();
    aliases.forEach(alias => {
      if (alias.enabled) {
        models.push({
          id: alias.alias,
          object: 'model',
          created: Math.floor(new Date(alias.createdAt).getTime() / 1000),
          owned_by: 'web2api'
        });
      }
    });

    res.json({
      object: 'list',
      data: models
    });
  } catch (error: any) {
    res.status(500).json({
      error: {
        message: error.message,
        type: 'server_error',
        code: 'internal_error'
      }
    });
  }
});

// OpenAI Compatible: Chat completions
app.post('/v1/chat/completions', async (req: Request, res: Response) => {
  try {
    const request: OpenAIChatRequest = req.body;
    
    if (!request.model || !request.messages || request.messages.length === 0) {
      return res.status(400).json({
        error: {
          message: 'Missing required fields: model, messages',
          type: 'invalid_request_error',
          code: 'invalid_request'
        }
      });
    }

    // Find service by model name or alias
    const service = await serviceManager.findServiceByModel(request.model);
    if (!service) {
      return res.status(404).json({
        error: {
          message: `Model '${request.model}' not found`,
          type: 'invalid_request_error',
          code: 'model_not_found'
        }
      });
    }

    // Execute chat request
    console.log(`\n📨 Executing request on ${service.name} (${request.model})`);
    console.log(`💬 Message: ${request.messages[request.messages.length - 1].content}`);
    
    const result = await serviceManager.executeChat(service.serviceId, request);

    if (request.stream) {
      // Streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Send chunks
      for (const chunk of result.chunks || []) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      // Non-streaming response
      const response: OpenAIChatResponse = {
        id: result.id || `chatcmpl-${uuidv4()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: request.model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: result.content || ''
          },
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: result.promptTokens || 0,
          completion_tokens: result.completionTokens || 0,
          total_tokens: result.totalTokens || 0
        }
      };

      console.log(`✅ Response: ${result.content?.substring(0, 100)}...`);
      res.json(response);
    }
  } catch (error: any) {
    console.error(`❌ Error:`, error.message);
    res.status(500).json({
      error: {
        message: error.message,
        type: 'server_error',
        code: 'internal_error'
      }
    });
  }
});

// Start server
async function start() {
  try {
    console.log('🚀 Starting Web2API Server...');
    
    // Initialize service manager
    await serviceManager.initialize();
    console.log('✅ Service Manager initialized');

    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`\n🌐 Web2API Server running on http://localhost:${PORT}`);
      console.log(`\n📚 Available endpoints:`);
      console.log(`   GET  /health                    - Health check`);
      console.log(`   GET  /admin/services            - List all services`);
      console.log(`   POST /admin/services            - Register new service`);
      console.log(`   GET  /admin/services/:id        - Get service details`);
      console.log(`   GET  /v1/models                 - List models (OpenAI compatible)`);
      console.log(`   POST /v1/chat/completions       - Chat (OpenAI compatible)`);
      console.log(`\n✨ Ready to accept requests!\n`);
    });
  } catch (error: any) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutting down gracefully...');
  await serviceManager.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n🛑 Shutting down gracefully...');
  await serviceManager.cleanup();
  process.exit(0);
});

// Start the server
start().catch(console.error);

export { app, serviceManager };

