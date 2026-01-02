/**
 * Vision Model Strategy
 * 
 * Uses AI vision models (GLM-4.6V, Claude 3.5 Sonnet, GPT-4o) to identify
 * elements and understand page layout through visual analysis.
 */

import { BaseStrategy } from '../base/BaseStrategy';
import {
  StrategyType,
  WebElement,
  ElementAction,
  ActionResult,
  IdentificationContext,
  ElementSelector,
  ElementType,
  ElementState
} from '../types';
import axios from 'axios';

interface VisionModelResponse {
  elements: Array<{
    type: ElementType;
    description: string;
    text?: string;
    bounds?: { x: number; y: number; width: number; height: number };
    suggestedSelectors: string[];
    confidence: number;
  }>;
  pageAnalysis: {
    isLoggedIn: boolean;
    currentState: string;
    suggestions: string[];
  };
}

export class VisionModelStrategy extends BaseStrategy {
  readonly name: StrategyType = 'vision-model';
  
  private modelEndpoint: string = '';
  private apiKey: string = '';
  private modelName: string = 'glm-4.6v';

  protected async onInitialize(): Promise<void> {
    // Configure model based on config
    const visionModel = this.config.modelConfig?.visionModel || 'glm-4.6v';
    this.modelName = visionModel;

    switch (visionModel) {
      case 'glm-4.6v':
        this.modelEndpoint = process.env.GLM_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
        this.apiKey = process.env.GLM_API_KEY || '';
        break;
      
      case 'claude-3.5-sonnet':
        this.modelEndpoint = 'https://api.anthropic.com/v1/messages';
        this.apiKey = process.env.ANTHROPIC_API_KEY || '';
        break;
      
      case 'gpt-4o':
        this.modelEndpoint = 'https://api.openai.com/v1/chat/completions';
        this.apiKey = process.env.OPENAI_API_KEY || '';
        break;
    }

    if (!this.apiKey) {
      throw new Error(`API key not configured for ${visionModel}`);
    }

    this.debug(`Initialized with model: ${visionModel}`);
  }

  async identifyElements(context: IdentificationContext): Promise<WebElement[]> {
    this.debug('Identifying elements via vision model...', context.intent);

    // Need screenshot for vision analysis
    if (!context.screenshot) {
      this.debug('No screenshot provided, taking one now...');
      context.screenshot = await this.page.screenshot({ fullPage: false });
    }

    // Call vision model
    const analysis = await this.analyzePageVisually(
      context.screenshot,
      context.intent,
      context.hints
    );

    // Convert vision model response to WebElement format
    const elements: WebElement[] = analysis.elements.map((elem, index) => ({
      id: `vision-${Date.now()}-${index}`,
      type: elem.type,
      text: elem.text,
      visualDescription: elem.description,
      selectors: this.createSelectorsFromVisionAnalysis(elem),
      bounds: elem.bounds,
      state: 'idle' as ElementState,
      confidence: elem.confidence,
      identifiedBy: this.name
    }));

    this.debug(`Identified ${elements.length} elements`);
    return elements;
  }

  protected async executeActionInternal(
    element: WebElement,
    action: ElementAction
  ): Promise<ActionResult> {
    const startTime = Date.now();
    const stateBefore = element.state;

    try {
      // Use visual description and bounds for coordinate-based interaction
      if (element.bounds && this.config.modelConfig?.visionModel) {
        this.debug(`Executing ${action.type} at coordinates:`, element.bounds);
        
        // Calculate click point (center of element)
        const x = element.bounds.x + element.bounds.width / 2;
        const y = element.bounds.y + element.bounds.height / 2;

        switch (action.type) {
          case 'click':
            await this.page.mouse.click(x, y);
            break;
          
          case 'hover':
            await this.page.mouse.move(x, y);
            break;
          
          case 'type':
            if (action.params?.text) {
              await this.page.mouse.click(x, y);
              await this.page.keyboard.type(action.params.text);
              
              if (action.params.pressEnter) {
                await this.page.keyboard.press('Enter');
              }
            }
            break;
          
          default:
            throw new Error(`Action type ${action.type} not supported by vision strategy`);
        }

        // Wait for page to stabilize
        await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        return this.createSuccessResult(stateBefore, 'idle', startTime);
      }

      // Fallback to selector-based interaction
      return await this.executeSelectorBasedAction(element, action, stateBefore, startTime);

    } catch (error) {
      return this.createErrorResult(
        stateBefore,
        'error',
        startTime,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  getCapabilityScore(context: IdentificationContext): number {
    let score = 0.5; // Base score

    // Strongly prefer vision strategy when screenshot is available
    if (context.screenshot) {
      score += 0.3;
    }

    // Good for complex visual layouts
    if (context.intent.includes('visual') || context.intent.includes('image')) {
      score += 0.2;
    }

    // Hints boost score
    if (context.hints?.some(h => h.includes('visual') || h.includes('screenshot'))) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Analyze page visually using AI model
   */
  private async analyzePageVisually(
    screenshot: Buffer,
    intent: string,
    hints?: string[]
  ): Promise<VisionModelResponse> {
    const base64Image = screenshot.toString('base64');
    
    const prompt = this.buildAnalysisPrompt(intent, hints);

    try {
      let response;

      if (this.modelName === 'claude-3.5-sonnet') {
        response = await this.callClaudeVision(base64Image, prompt);
      } else if (this.modelName === 'gpt-4o') {
        response = await this.callGPT4Vision(base64Image, prompt);
      } else {
        response = await this.callGLMVision(base64Image, prompt);
      }

      return this.parseVisionResponse(response);

    } catch (error) {
      this.debug('Vision API call failed:', error);
      throw new Error(`Vision analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Build analysis prompt for vision model
   */
  private buildAnalysisPrompt(intent: string, hints?: string[]): string {
    let prompt = `Analyze this webpage screenshot and identify interactive elements.

**Task**: ${intent}

**Instructions**:
1. Identify all interactive elements (buttons, inputs, links, dropdowns)
2. For each element, provide:
   - Type (button, input, link, etc.)
   - Visual description
   - Any visible text
   - Approximate position (x, y, width, height in pixels)
   - Confidence score (0-1)
   - Suggested CSS/XPath selectors

3. Also analyze:
   - Is the user logged in?
   - Current page state
   - Suggested actions

**Format your response as JSON**:
{
  "elements": [
    {
      "type": "button",
      "description": "Blue submit button at bottom right",
      "text": "Submit",
      "bounds": { "x": 100, "y": 200, "width": 80, "height": 40 },
      "suggestedSelectors": ["button.submit", "//button[text()='Submit']"],
      "confidence": 0.95
    }
  ],
  "pageAnalysis": {
    "isLoggedIn": true,
    "currentState": "Ready to submit form",
    "suggestions": ["Fill in required fields before submitting"]
  }
}`;

    if (hints && hints.length > 0) {
      prompt += `\n\n**Additional Context**: ${hints.join(', ')}`;
    }

    return prompt;
  }

  /**
   * Call GLM-4.6V vision API
   */
  private async callGLMVision(base64Image: string, prompt: string): Promise<string> {
    const response = await axios.post(
      this.modelEndpoint,
      {
        model: 'glm-4v-plus',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        temperature: this.config.modelConfig?.temperature || 0.1,
        max_tokens: this.config.modelConfig?.maxTokens || 4000
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content;
  }

  /**
   * Call Claude 3.5 Sonnet vision API
   */
  private async callClaudeVision(base64Image: string, prompt: string): Promise<string> {
    const response = await axios.post(
      this.modelEndpoint,
      {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: this.config.modelConfig?.maxTokens || 4000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: base64Image
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ]
      },
      {
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.content[0].text;
  }

  /**
   * Call GPT-4o vision API
   */
  private async callGPT4Vision(base64Image: string, prompt: string): Promise<string> {
    const response = await axios.post(
      this.modelEndpoint,
      {
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: this.config.modelConfig?.maxTokens || 4000,
        temperature: this.config.modelConfig?.temperature || 0.1
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content;
  }

  /**
   * Parse vision model response
   */
  private parseVisionResponse(responseText: string): VisionModelResponse {
    // Extract JSON from response (handle markdown code blocks)
    let jsonText = responseText.trim();
    
    // Remove markdown code blocks if present
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```json?\s*/i, '').replace(/```\s*$/, '');
    }

    try {
      return JSON.parse(jsonText) as VisionModelResponse;
    } catch (error) {
      this.debug('Failed to parse vision response, attempting recovery...');
      
      // Attempt to extract JSON from text
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as VisionModelResponse;
      }

      throw new Error('Could not parse vision model response as JSON');
    }
  }

  /**
   * Create selectors from vision analysis
   */
  private createSelectorsFromVisionAnalysis(
    elem: VisionModelResponse['elements'][0]
  ): ElementSelector[] {
    const selectors: ElementSelector[] = [];
    let priority = 1;

    // Add suggested selectors from vision model
    for (const selector of elem.suggestedSelectors) {
      const type = selector.startsWith('//') ? 'xpath' : 'css';
      
      selectors.push({
        type,
        value: selector,
        priority: priority++,
        validated: false
      });
    }

    // Add text-based selector if we have text
    if (elem.text) {
      selectors.push({
        type: 'text',
        value: elem.text,
        priority: priority++,
        validated: false
      });
    }

    // Add coordinate-based fallback
    if (elem.bounds) {
      selectors.push({
        type: 'coordinates',
        value: JSON.stringify(elem.bounds),
        priority: priority++,
        validated: false
      });
    }

    return selectors;
  }

  /**
   * Execute action using selectors
   */
  private async executeSelectorBasedAction(
    element: WebElement,
    action: ElementAction,
    stateBefore: ElementState,
    startTime: number
  ): Promise<ActionResult> {
    // Try each selector in priority order
    for (const selector of element.selectors.sort((a, b) => a.priority - b.priority)) {
      if (selector.type === 'coordinates') {
        continue; // Skip coordinate selectors in this method
      }

      const locator = this.getLocator(selector.type, selector.value);
      if (!locator) {
        continue;
      }

      try {
        const isVisible = await locator.isVisible();
        if (!isVisible) {
          continue;
        }

        // Execute action
        switch (action.type) {
          case 'click':
            await locator.click();
            break;
          
          case 'type':
            if (action.params?.text) {
              if (action.params.clearFirst) {
                await locator.clear();
              }
              await locator.fill(action.params.text);
              
              if (action.params.pressEnter) {
                await locator.press('Enter');
              }
            }
            break;
          
          case 'hover':
            await locator.hover();
            break;
          
          default:
            throw new Error(`Action type ${action.type} not implemented`);
        }

        // Success!
        return this.createSuccessResult(stateBefore, 'idle', startTime);

      } catch (error) {
        this.debug(`Selector ${selector.value} failed:`, error);
        continue;
      }
    }

    // All selectors failed
    throw new Error('All selectors failed to execute action');
  }
}
