export interface Account {
  name: string;
  url: string;
  email: string;
  password: string;
  enabled: boolean;
}

export interface AccountConfig {
  accounts: Account[];
}

export interface Service {
  id: string;
  name: string;
  url: string;
  email?: string;
  status: 'pending' | 'analyzing' | 'ready' | 'failed';
  apiKey?: string;
  flows?: Flow[];
  cookies?: any[];
  createdAt?: Date;
  lastAnalyzedAt?: Date;
  lastSync: Date;
}

export interface Flow {
  id?: string;
  serviceId: string;
  name: string;
  description?: string;
  type: 'message' | 'model_selection' | 'new_chat' | 'file_upload' | 'custom';
  steps: FlowStep[];
  validated?: boolean;
  successCount?: number;
  failureCount?: number;
  avgExecutionTime?: number;
}

export interface FlowStep {
  type: 'click' | 'type' | 'wait' | 'extract' | 'screenshot';
  selector?: string;
  coordinates?: { x: number; y: number };
  value?: string;
  timeout?: number;
  description?: string;
}

export interface VisionAnalysisResult {
  isLoginPage: boolean;
  elements?: {
    usernameField?: ElementInfo;
    passwordField?: ElementInfo;
    submitButton?: ElementInfo;
  };
  captchaDetected: boolean;
  captchaType?: 'checkbox' | 'slider' | 'image_grid' | 'text';
  confidence: number;
  reasoning?: string;
}

export interface ElementInfo {
  selector?: string;
  coordinates: { x: number; y: number };
  width?: number;
  height?: number;
  confidence: number;
  label: string;
}

export interface FlowDiscoveryResult {
  flows: DiscoveredFlow[];
  confidence: number;
}

export interface DiscoveredFlow {
  name: string;
  type: string;
  elements?: {
    [key: string]: ElementInfo;
  };
  actions?: Array<{
    type: string;
    description: string;
    selector?: string;
    coordinates?: { x: number; y: number };
    value?: string;
  }>;
  description: string;
}

export interface ProgressEvent {
  event: string;
  timestamp: Date;
  data: any;
  screenshotPath?: string;
}

export interface OpenAIChatRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface OpenAIChatResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: 'stop' | 'length' | 'content_filter';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
