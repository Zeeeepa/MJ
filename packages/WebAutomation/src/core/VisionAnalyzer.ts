import axios from 'axios';
import { VisionAnalysisResult, FlowDiscoveryResult, ElementInfo } from '../types';

export class VisionAnalyzer {
  constructor(
    private apiKey: string,
    private baseURL: string = 'https://api.z.ai/v1',
    private model: string = 'glm-4.6v'
  ) {}
  
  /**
   * Analyze a screenshot to detect login page elements
   */
  async analyzeLoginPage(screenshotBase64: string): Promise<VisionAnalysisResult> {
    const prompt = `Analyze this screenshot and determine if it's a login page.

Please identify:
1. Is this a login page? (yes/no)
2. Location of username/email field (provide CSS selector if visible, or pixel coordinates)
3. Location of password field (provide CSS selector if visible, or pixel coordinates)
4. Location of submit/login button (provide CSS selector if visible, or pixel coordinates)
5. Is there a CAPTCHA present? If yes, what type? (checkbox, slider, image_grid, text)

Provide your analysis in JSON format:
{
  "isLoginPage": boolean,
  "elements": {
    "usernameField": {
      "selector": "string or null",
      "coordinates": {"x": number, "y": number},
      "confidence": number (0-1),
      "label": "description"
    },
    "passwordField": { ... },
    "submitButton": { ... }
  },
  "captchaDetected": boolean,
  "captchaType": "string or null",
  "confidence": number (0-1),
  "reasoning": "brief explanation"
}`;

    try {
      const response = await this.callVisionAPI(screenshotBase64, prompt);
      return this.parseLoginAnalysis(response);
    } catch (error) {
      console.error('Vision analysis error:', error);
      throw new Error(`Failed to analyze login page: ${error}`);
    }
  }
  
  /**
   * Discover available flows in the authenticated interface
   */
  async discoverFlows(screenshotBase64: string): Promise<FlowDiscoveryResult> {
    const prompt = `Analyze this chat/AI interface screenshot and identify all available actions and UI elements.

Look for:
1. Message input field (where users type messages)
2. Send button
3. Model selection dropdown or button
4. New chat button
5. File/image upload button
6. Settings or configuration options
7. Any other interactive elements

For each element found, provide:
- name: A descriptive name (e.g., "send_message", "change_model")
- type: The type of action (message, model_selection, new_chat, file_upload, custom)
- elements: Object containing all UI elements needed for this action
  - Each element should have: selector (if visible), coordinates, confidence, label

Return as JSON:
{
  "flows": [
    {
      "name": "send_message",
      "type": "message",
      "description": "Send a message to the AI",
      "actions": [
        {"type": "click", "description": "Click input", "selector": "#input", "coordinates": {"x": 400, "y": 300}},
        {"type": "type", "description": "Type message", "value": "{message}"},
        {"type": "click", "description": "Click send", "selector": "button", "coordinates": {"x": 500, "y": 350}},
        {"type": "wait", "description": "Wait for response"}
      ]
    }
  ],
  "confidence": 0.95
}`;

    try {
      const response = await this.callVisionAPI(screenshotBase64, prompt);
      return this.parseFlowDiscovery(response);
    } catch (error) {
      console.error('Flow discovery error:', error);
      throw new Error(`Failed to discover flows: ${error}`);
    }
  }
  
  /**
   * Verify if login was successful
   */
  async verifyLoginSuccess(screenshotBase64: string, expectedUrl?: string): Promise<boolean> {
    const prompt = `Analyze this screenshot and determine if the login was successful.

Look for indicators of successful login:
1. Presence of user profile/avatar
2. Dashboard or main interface
3. Absence of login form
4. Presence of logout button
${expectedUrl ? `5. URL should have changed from login page to: ${expectedUrl}` : ''}

Return JSON:
{
  "loginSuccessful": boolean,
  "confidence": number (0-1),
  "reasoning": "brief explanation"
}`;

    try {
      const response = await this.callVisionAPI(screenshotBase64, prompt);
      const result = this.parseJSON(response);
      return result.loginSuccessful === true;
    } catch (error) {
      console.error('Login verification error:', error);
      return false;
    }
  }
  
  /**
   * Detect response completion by analyzing UI state
   */
  async detectResponseCompletion(screenshotBase64: string): Promise<boolean> {
    const prompt = `Analyze this chat interface screenshot and determine if the AI has finished responding.

Look for indicators:
1. Send button is enabled (not disabled/grayed out)
2. No loading indicators or typing animations
3. Complete message visible in chat
4. Cursor or typing indicator not present

Return JSON:
{
  "responseComplete": boolean,
  "confidence": number (0-1)
}`;

    try {
      const response = await this.callVisionAPI(screenshotBase64, prompt);
      const result = this.parseJSON(response);
      return result.responseComplete === true;
    } catch (error) {
      console.error('Response detection error:', error);
      return false;
    }
  }
  
  /**
   * Call the vision AI API with image and prompt
   */
  private async callVisionAPI(imageBase64: string, prompt: string): Promise<string> {
    const response = await axios.post(
      `${this.baseURL}/chat/completions`,
      {
        model: this.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${imageBase64}`
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.1
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
   * Parse login analysis response
   */
  private parseLoginAnalysis(response: string): VisionAnalysisResult {
    const parsed = this.parseJSON(response);
    
    return {
      isLoginPage: parsed.isLoginPage || false,
      elements: parsed.elements || {},
      captchaDetected: parsed.captchaDetected || false,
      captchaType: parsed.captchaType || undefined,
      confidence: parsed.confidence || 0,
      reasoning: parsed.reasoning
    };
  }
  
  /**
   * Parse flow discovery response
   */
  private parseFlowDiscovery(response: string): FlowDiscoveryResult {
    const parsed = this.parseJSON(response);
    
    return {
      flows: parsed.flows || [],
      confidence: parsed.confidence || 0
    };
  }
  
  /**
   * Parse JSON from vision model response (handles markdown code blocks)
   */
  private parseJSON(response: string): any {
    try {
      // Try direct parse
      return JSON.parse(response);
    } catch (e) {
      // Try extracting from markdown code block
      const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }
      
      // Try finding JSON object in response
      const objectMatch = response.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        return JSON.parse(objectMatch[0]);
      }
      
      throw new Error('Could not extract JSON from response');
    }
  }
}
