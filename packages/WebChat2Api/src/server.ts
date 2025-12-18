import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { ServiceManager } from './ServiceManager';
import { ChatCompletionRequest, ChatCompletionResponse } from './types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const serviceManager = new ServiceManager();

// Initialize K2Think service on startup
(async () => {
  const k2thinkUrl = process.env.K2THINK_URL || 'https://www.k2think.ai';
  const k2thinkEmail = process.env.K2THINK_EMAIL || '';
  const k2thinkPassword = process.env.K2THINK_PASSWORD || '';

  if (k2thinkEmail && k2thinkPassword) {
    const serviceId = await serviceManager.registerService({
      url: k2thinkUrl,
      email: k2thinkEmail,
      password: k2thinkPassword,
      name: 'K2Think AI'
    });
    
    console.log(`✅ K2Think AI registered as: ${serviceId}`);
    console.log(`📝 Use model: "${serviceId}" in API requests`);
  } else {
    console.warn('⚠️  K2Think credentials not configured in .env file');
  }
})();

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    services: serviceManager.getServiceIds(),
    timestamp: new Date().toISOString()
  });
});

// List available models (services)
app.get('/v1/models', (req, res) => {
  const serviceIds = serviceManager.getServiceIds();
  const models = serviceIds.map(id => ({
    id,
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'webchat2api'
  }));

  res.json({
    object: 'list',
    data: models
  });
});

// Chat completions endpoint
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const request: ChatCompletionRequest = req.body;

    if (!request.model || !request.messages || request.messages.length === 0) {
      return res.status(400).json({
        error: {
          message: 'Invalid request: model and messages are required',
          type: 'invalid_request_error'
        }
      });
    }

    // Get last user message
    const userMessages = request.messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) {
      return res.status(400).json({
        error: {
          message: 'No user message found',
          type: 'invalid_request_error'
        }
      });
    }

    const lastUserMessage = userMessages[userMessages.length - 1].content;
    console.log(`\n[API] POST /v1/chat/completions`);
    console.log(`[API] Model: ${request.model}`);
    console.log(`[API] Message: ${lastUserMessage.substring(0, 100)}...`);

    // Send message to service
    const responseText = await serviceManager.sendMessage(request.model, lastUserMessage);

    // Format as OpenAI response
    const response: ChatCompletionResponse = {
      id: `chatcmpl-${uuidv4()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: request.model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: responseText
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: Math.ceil(lastUserMessage.length / 4),
        completion_tokens: Math.ceil(responseText.length / 4),
        total_tokens: Math.ceil((lastUserMessage.length + responseText.length) / 4)
      }
    };

    console.log(`[API] Response: ${responseText.substring(0, 100)}...`);
    res.json(response);

  } catch (error) {
    console.error('[API] Error:', error);
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Internal server error',
        type: 'internal_error'
      }
    });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[SERVER] Shutting down...');
  await serviceManager.closeAll();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`\n🚀 WebChat2Api Server Running`);
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`\n📖 Endpoints:`);
  console.log(`   GET  /health`);
  console.log(`   GET  /v1/models`);
  console.log(`   POST /v1/chat/completions`);
  console.log(`\n💡 Test with curl:`);
  console.log(`   curl http://localhost:${PORT}/v1/models`);
  console.log(`\n   curl http://localhost:${PORT}/v1/chat/completions \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     -d '{"model":"service-www-k2think-ai","messages":[{"role":"user","content":"Hello!"}]}'`);
  console.log(`\n`);
});

