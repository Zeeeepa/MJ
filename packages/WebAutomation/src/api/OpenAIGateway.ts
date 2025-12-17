import { Request, Response } from 'express';
import { ServiceOrchestrator } from '../core/ServiceOrchestrator';
import { StorageManager } from '../core/StorageManager';
import { OpenAIChatRequest, OpenAIChatResponse } from '../types';

export class OpenAIGateway {
  private services: Map<string, ServiceOrchestrator> = new Map();
  private storage: StorageManager;
  
  constructor(storage: StorageManager) {
    this.storage = storage;
  }
  
  /**
   * Register a service orchestrator
   */
  registerService(serviceId: string, orchestrator: ServiceOrchestrator): void {
    this.services.set(serviceId, orchestrator);
  }
  
  /**
   * Handle OpenAI chat completions request
   */
  async handleChatCompletions(req: Request, res: Response): Promise<void> {
    try {
      const request: OpenAIChatRequest = req.body;
      
      // Validate request
      if (!request.model || !request.messages || request.messages.length === 0) {
        res.status(400).json({
          error: {
            message: 'Invalid request: model and messages are required',
            type: 'invalid_request_error',
          },
        });
        return;
      }
      
      // Extract service ID from model name (format: "service-{serviceId}")
      const serviceId = this.extractServiceId(request.model);
      
      if (!serviceId) {
        res.status(400).json({
          error: {
            message: `Invalid model format. Expected: service-{serviceId}, got: ${request.model}`,
            type: 'invalid_request_error',
          },
        });
        return;
      }
      
      // Get service orchestrator
      const orchestrator = this.services.get(serviceId);
      
      if (!orchestrator) {
        res.status(404).json({
          error: {
            message: `Service not found: ${serviceId}`,
            type: 'invalid_request_error',
          },
        });
        return;
      }
      
      // Extract user message (last message in conversation)
      const lastMessage = request.messages[request.messages.length - 1];
      
      if (lastMessage.role !== 'user') {
        res.status(400).json({
          error: {
            message: 'Last message must be from user',
            type: 'invalid_request_error',
          },
        });
        return;
      }
      
      const userMessage = lastMessage.content;
      
      // Execute message via browser automation
      const responseText = await orchestrator.sendMessage(userMessage);
      
      // Format as OpenAI response
      const response: OpenAIChatResponse = {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: request.model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: responseText,
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: this.estimateTokens(userMessage),
          completion_tokens: this.estimateTokens(responseText),
          total_tokens: this.estimateTokens(userMessage) + this.estimateTokens(responseText),
        },
      };
      
      res.json(response);
    } catch (error: any) {
      console.error('Error handling chat completions:', error);
      res.status(500).json({
        error: {
          message: error.message || 'Internal server error',
          type: 'internal_error',
        },
      });
    }
  }
  
  /**
   * Handle models list request
   */
  async handleListModels(req: Request, res: Response): Promise<void> {
    try {
      const services = await this.storage.listServices();
      
      const models = services.map(service => ({
        id: `service-${service.id}`,
        object: 'model',
        created: Math.floor(service.lastSync.getTime() / 1000),
        owned_by: 'web-automation',
      }));
      
      res.json({
        object: 'list',
        data: models,
      });
    } catch (error: any) {
      console.error('Error listing models:', error);
      res.status(500).json({
        error: {
          message: error.message || 'Internal server error',
          type: 'internal_error',
        },
      });
    }
  }
  
  /**
   * Extract service ID from model name
   */
  private extractServiceId(model: string): string | null {
    const match = model.match(/^service-(.+)$/);
    return match ? match[1] : null;
  }
  
  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}

