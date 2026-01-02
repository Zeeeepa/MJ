const express = require('express');
const { WebChat2Api } = require('../core/WebChat2Api');

/**
 * OpenAI-compatible API Server for WebChat2Api
 */
class ApiServer {
  constructor(config) {
    this.config = config;
    this.app = express();
    this.gateway = new WebChat2Api(config);
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json({ limit: '10mb' }));
    
    // CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });
    
    // Logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
      next();
    });
  }

  setupRoutes() {
    // OpenAI-compatible chat completions
    this.app.post('/v1/chat/completions', async (req, res) => {
      try {
        const { messages, model, stream = false } = req.body;
        
        const lastUserMessage = messages.filter(m => m.role === 'user').pop();
        const result = await this.gateway.sendMessage(lastUserMessage.content);
        
        const response = {
          id: `chatcmpl-${Date.now()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: model || 'webchat-default',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: result.response
            },
            finish_reason: 'stop'
          }]
        };
        
        res.json(response);
      } catch (error) {
        res.status(500).json({ error: { message: error.message } });
      }
    });

    // Health check
    this.app.get('/health', (req, res) => {
      const stats = this.gateway.getStats();
      res.json({
        status: stats.healthySessions > 0 ? 'healthy' : 'degraded',
        totalSessions: stats.totalSessions,
        healthySessions: stats.healthySessions
      });
    });

    // Stats
    this.app.get('/stats', (req, res) => {
      res.json(this.gateway.getStats());
    });

    // Root
    this.app.get('/', (req, res) => {
      res.json({
        name: 'WebChat2Api',
        version: '1.0.0',
        endpoints: {
          chat: 'POST /v1/chat/completions',
          health: 'GET /health',
          stats: 'GET /stats'
        }
      });
    });
  }

  async start(port = 3000) {
    await this.gateway.start();
    
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        console.log(`\n🌐 API Server: http://localhost:${port}`);
        console.log(`   OpenAI: http://localhost:${port}/v1/chat/completions`);
        console.log(`   Health: http://localhost:${port}/health\n`);
        resolve();
      });
    });
  }

  async shutdown() {
    if (this.server) {
      await new Promise((resolve) => this.server.close(resolve));
    }
    await this.gateway.shutdown();
  }
}

module.exports = { ApiServer };

