/**
 * WebChat2Api Server
 * Main entry point for the gateway server
 * 
 * Uses @memberjunction/server for Express setup
 */

import express, { Express } from 'express';
import { json, urlencoded } from 'body-parser';
import cors from 'cors';
import { WebChatGateway } from './gateway/WebChatGateway';
import { Metadata } from '@memberjunction/core';
import { SQLServerDataProvider } from '@memberjunction/sqlserver-dataprovider';

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL || '';
const ENABLE_CORS = process.env.ENABLE_CORS === 'true';

class WebChat2ApiServer {
  private app: Express;
  private gateway: WebChatGateway;

  constructor() {
    this.app = express();
    this.gateway = new WebChatGateway();
  }

  /**
   * Initialize server
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing WebChat2Api Server...');

    // Setup middleware
    this.setupMiddleware();

    // Initialize database connection
    await this.initializeDatabase();

    // Initialize gateway
    await this.gateway.initializeBrowser();
    this.gateway.setupRoutes(this.app);

    // Error handling
    this.setupErrorHandling();

    console.log('✅ Server initialized');
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Body parsing
    this.app.use(json({ limit: '10mb' }));
    this.app.use(urlencoded({ extended: true, limit: '10mb' }));

    // CORS
    if (ENABLE_CORS) {
      this.app.use(cors({
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Flow-ID'],
        credentials: true
      }));
    }

    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
      });
      next();
    });

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'WebChat2Api Gateway',
        version: '1.0.0',
        status: 'operational',
        endpoints: {
          chat: 'POST /v1/chat/completions',
          models: 'GET /v1/models',
          flows: {
            create: 'POST /flows',
            list: 'GET /flows',
            get: 'GET /flows/:flowId'
          },
          health: 'GET /health'
        },
        documentation: 'https://github.com/Zeeeepa/MJ/tree/WebChat2Api/packages/WebChat2Api'
      });
    });
  }

  /**
   * Initialize database connection
   */
  private async initializeDatabase(): Promise<void> {
    console.log('📊 Connecting to database...');

    try {
      // Initialize MemberJunction metadata
      const dataProvider = new SQLServerDataProvider();
      await dataProvider.Connect(DATABASE_URL);
      
      // Register with Metadata singleton
      Metadata.Provider.Config(dataProvider);

      console.log('✅ Database connected');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: {
          message: 'Not found',
          type: 'not_found_error',
          path: req.path
        }
      });
    });

    // Global error handler
    this.app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Unhandled error:', err);
      
      res.status(500).json({
        error: {
          message: err.message || 'Internal server error',
          type: 'internal_error'
        }
      });
    });

    // Uncaught exception handler
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      this.shutdown();
    });

    // Unhandled rejection handler
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully...');
      this.shutdown();
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully...');
      this.shutdown();
    });
  }

  /**
   * Start server
   */
  async start(): Promise<void> {
    await this.initialize();

    this.app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════╗
║                                                      ║
║        🚀 WebChat2Api Gateway Running 🚀              ║
║                                                      ║
║  Server:        http://localhost:${PORT}               ║
║  Environment:   ${process.env.NODE_ENV || 'development'}                  ║
║  Database:      ${DATABASE_URL ? 'Connected' : 'Not configured'}                   ║
║                                                      ║
║  OpenAI API:    POST /v1/chat/completions           ║
║  Models:        GET  /v1/models                     ║
║  Health:        GET  /health                        ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
      `);
    });
  }

  /**
   * Graceful shutdown
   */
  private async shutdown(): Promise<void> {
    console.log('Shutting down server...');
    await this.gateway.shutdown();
    process.exit(0);
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new WebChat2ApiServer();
  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { WebChat2ApiServer };

