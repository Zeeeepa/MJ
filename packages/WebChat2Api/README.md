# @memberjunction/webchat2api

Convert Web UIs to OpenAI-Compatible Inference Endpoints with intelligent multi-strategy browser automation.

## 🚀 Overview

Web2API provides a complete system for automating web applications and exposing their functionality through OpenAI-compatible API endpoints. It uses multiple intelligent strategies to identify and interact with web elements, with automatic fallback mechanisms and stealth capabilities.

## ✨ Features

### Multi-Strategy Element Identification
- **Vision Model Strategy**: AI vision models (GLM-4.6V, Claude 3.5 Sonnet, GPT-4o) identify elements through screenshots
- **Computer Use Strategy**: Anthropic Claude Computer Use API for natural language control
- **Natural Language Strategy**: OWL Browser SDK for semantic element selection
- **DOM Analysis Strategy**: Traditional DOM-based identification (fast & free)
- **Stealth Strategy**: Anti-detection browser automation with playwright-toolkit

### On-Demand Scaling with Daytona
- **Sandbox Management**: Create isolated browser automation environments
- **Resource Control**: Configurable CPU, memory, and storage limits
- **Auto-Scaling**: On-demand sandbox creation and cleanup
- **Code Execution**: Run browser automation code in sandboxes

### OpenAI-Compatible API
- **Chat Completions**: `/v1/chat/completions` with streaming support
- **Text Completions**: `/v1/completions` endpoint
- **Model Listing**: `/v1/models` shows available strategies
- **Health Check**: `/health` endpoint for monitoring

### Flow Management
- **Flow Recording**: Capture multi-step interaction sequences
- **Flow Validation**: Verify outcomes and generate reports
- **Flow Execution**: Execute recorded flows with retry logic
- **Import/Export**: JSON-based flow persistence

## 📦 Installation

```bash
npm install @memberjunction/webchat2api
```

## 🔧 Configuration

Create a `.env.local` file:

```bash
# Anthropic API (via Z.AI proxy)
ANTHROPIC_AUTH_TOKEN=your_token_here
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
ANTHROPIC_API_KEY=your_api_key_here
MODEL=glm-4.6v

# Daytona Sandbox Configuration
DAYTONA_API_KEY=your_daytona_key_here
DAYTONA_API_URL=https://app.daytona.io/api

# OpenAI API Server Configuration
OPENAI_API_PORT=8080
OPENAI_API_HOST=0.0.0.0
WEBCHAT2API_API_KEY=your_api_key_here

# Optional: Test Service Credentials
K2THINK_URL=https://www.k2think.ai
K2THINK_EMAIL=your_email@example.com
K2THINK_PASSWORD=your_password
```

## 🎯 Quick Start

### 1. Start the OpenAI-Compatible API Server

```bash
npm run start:dev
```

The server will start on `http://localhost:8080` with the following endpoints:
- `POST /v1/chat/completions` - Chat completions with web automation
- `POST /v1/completions` - Text completions
- `GET /v1/models` - List available strategies
- `GET /health` - Health check

### 2. Use with OpenAI SDK

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:8080/v1',
  apiKey: process.env.WEBCHAT2API_API_KEY
});

const response = await client.chat.completions.create({
  model: 'web2api-vision',
  messages: [
    {
      role: 'user',
      content: 'Navigate to example.com and extract the main heading'
    }
  ]
});

console.log(response.choices[0].message.content);
```

### 3. Direct Integration

```typescript
import { 
  StrategyOrchestrator,
  VisionModelStrategy,
  StealthStrategy,
  DaytonaSandboxManager 
} from '@memberjunction/webchat2api';

// Initialize orchestrator
const orchestrator = new StrategyOrchestrator();
orchestrator.registerStrategy(new VisionModelStrategy());
orchestrator.registerStrategy(new StealthStrategy());

await orchestrator.initialize(page, {
  apiKeys: {
    anthropic: process.env.ANTHROPIC_API_KEY
  }
});

// Identify elements
const elements = await orchestrator.identifyElements({
  url: page.url(),
  intent: 'Find the login button',
  screenshot: await page.screenshot()
});

// Execute action
await orchestrator.executeAction(elements[0], {
  type: 'click',
  element: elements[0]
});
```

## 🧪 Running Demos

### Multi-Strategy Demo
```bash
# Run all demos
npm run demo:multi-strategy

# Run specific demos
npm run demo:element-identification
npm run demo:flow-recording
npm run demo:strategy-fallback
```

### K2Think.ai Demo
```bash
# Test authentication
npm run demo:k2think auth

# Test OpenAI API
npm run demo:k2think api

# Run complete demo
npm run demo:k2think all
```

## 📚 API Reference

### Strategy Orchestrator

```typescript
const orchestrator = new StrategyOrchestrator();

// Register strategies
orchestrator.registerStrategy(new VisionModelStrategy());
orchestrator.registerStrategy(new ComputerUseStrategy());
orchestrator.registerStrategy(new NaturalLanguageStrategy());
orchestrator.registerStrategy(new DOMAnalysisStrategy());
orchestrator.registerStrategy(new StealthStrategy());

// Initialize
await orchestrator.initialize(page, config);

// Identify elements
const elements = await orchestrator.identifyElements({
  url: string;
  intent: string;
  hints?: string[];
  screenshot?: Buffer;
  htmlSnapshot?: string;
  previousAttempts?: string[];
});

// Execute action
const result = await orchestrator.executeAction(
  element,
  action,
  fallbackStrategies?
);

// Cleanup
await orchestrator.cleanup();
```

### Daytona Sandbox Manager

```typescript
const sandboxManager = new DaytonaSandboxManager({
  apiKey: process.env.DAYTONA_API_KEY,
  maxConcurrent: 10,
  resources: {
    cpu: 2,
    memory: '4Gi',
    storage: '10Gi'
  }
});

// Create sandbox
const sandbox = await sandboxManager.createSandbox();

// Execute code
const result = await sandboxManager.executeBrowserCode(
  sandbox.id,
  'console.log("Hello from sandbox")'
);

// Get statistics
const stats = sandboxManager.getStats();

// Cleanup
await sandboxManager.destroySandbox(sandbox.id);
await sandboxManager.cleanup();
```

### Flow Manager

```typescript
const flowManager = new FlowManager(orchestrator);

// Create flow
const flow = flowManager.createFlow(
  'service-id',
  'Login Flow',
  'Complete login process'
);

// Add steps
flowManager.addStep(flow.id, 'Click login', loginAction);
flowManager.addStep(flow.id, 'Enter email', emailAction);
flowManager.addStep(flow.id, 'Submit', submitAction);

// Execute flow
const result = await flowManager.executeFlow(flow.id, {
  page,
  service,
  session: undefined
});

// Export flows
const json = flowManager.exportFlows();
```

## 🔒 Stealth Features

The Stealth Strategy provides anti-detection capabilities:

```typescript
const stealthStrategy = new StealthStrategy({
  humanizeDelays: true,
  delayRange: [150, 400],
  randomizeFingerprints: true,
  webrtcProtection: true,
  timezoneSpoof: true,
  userAgentRotation: true
});

await stealthStrategy.initialize(page);
```

Features:
- ✅ Fingerprint randomization (canvas, WebGL, fonts)
- ✅ WebRTC leak protection
- ✅ User agent rotation
- ✅ Timezone spoofing
- ✅ Human-like delays and mouse movements
- ✅ Bezier curve-based mouse paths

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│            OpenAI API Server                    │
│  POST /v1/chat/completions                      │
│  POST /v1/completions                           │
│  GET  /v1/models                                │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│           Strategy Orchestrator                 │
│  (Intelligent strategy selection)               │
└────────┬────────────────────────────────────────┘
         │
    ┌────┴────┬────────┬──────────┬────────┐
    ▼         ▼        ▼          ▼        ▼
┌────────┐ ┌───────┐ ┌────────┐ ┌──────┐ ┌────────┐
│Vision  │ │Computer│ │Natural │ │DOM   │ │Stealth │
│Model   │ │Use     │ │Language│ │Analysis│ │Strategy│
└────────┘ └───────┘ └────────┘ └──────┘ └────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│        Daytona Sandbox Manager                  │
│  (On-demand browser automation sandboxes)       │
└─────────────────────────────────────────────────┘
```

## 📊 Strategy Selection

The orchestrator automatically selects the best strategy based on:
- **Context availability** (screenshot, HTML snapshot)
- **Intent keywords** matching
- **Previous failures** (with penalty)
- **Hint boosters** from context

Example scoring:
- DOM Analysis: Fast & free (0.7 base score)
- Natural Language: Good for semantic queries (0.6 base score)
- Vision Model: Best for visual identification (0.5-0.8 base score)
- Computer Use: Complex multi-step interactions (0.6 base score)
- Stealth: Anti-detection required (0.65 base score)

## 🔧 Development

```bash
# Build package
npm run build

# Watch mode
npm run watch

# Run demos
npm run demo:multi-strategy
npm run demo:k2think
```

## 📝 License

MIT

## 🤝 Contributing

See [IMPLEMENTATION-SUMMARY.md](./IMPLEMENTATION-SUMMARY.md) for architecture details and [PHASE1-IMPLEMENTATION.md](./PHASE1-IMPLEMENTATION.md) for implementation guide.

## 🐛 Troubleshooting

### "Daytona API key is required"
Set `DAYTONA_API_KEY` in your `.env.local` file.

### "Maximum concurrent sandboxes reached"
Increase `maxConcurrent` in DaytonaSandboxManager configuration.

### "Strategy not available"
Check that required API keys are set (ANTHROPIC_API_KEY, etc.).

### Rate limiting errors
Configure rate limits in server configuration or wait between requests.

## 📚 Documentation

- [Phase 1 Implementation Guide](./PHASE1-IMPLEMENTATION.md)
- [Implementation Summary](./IMPLEMENTATION-SUMMARY.md)
- [Architecture Documentation](./ARCHITECTURE.md)

## 🎯 Roadmap

- ✅ Phase 1: Multi-strategy system with core providers
- ✅ Daytona sandbox integration
- ✅ OpenAI-compatible API server
- ✅ Stealth capabilities
- 🔄 Phase 2: Enhanced service discovery
- 🔄 Flow marketplace and sharing
- 🔄 Advanced monitoring and analytics
- 🔄 Multi-browser support (Firefox, Safari)
