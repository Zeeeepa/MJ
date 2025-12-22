# 🤖 Vision-Based Web Automation System

**Transform any web service into an OpenAI-compatible API using AI vision and undetectable browser automation.**

## 🎯 Overview

This system automatically:
1. ✅ Analyzes login pages with GLM-4.6V vision AI
2. ✅ Logs in with credentials (bypassing CAPTCHAs if needed)
3. ✅ Discovers available flows (send message, change model, etc.)
4. ✅ Saves flows to database
5. ✅ Exposes `/v1/chat/completions` OpenAI-compatible API
6. ✅ Executes browser automation to retrieve AI responses

## 🚀 Quick Start

### 1. Installation

```bash
cd packages/WebAutomation
npm install
```

### 2. Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env`:
```env
# Vision AI Configuration (GLM-4.6V)
VISION_AI_API_KEY=your-glm-4.6v-api-key
VISION_AI_BASE_URL=https://api.z.ai/v1
VISION_AI_MODEL=glm-4.6v

# Server Configuration
PORT=3000
```

### 3. Add Service Accounts

Edit `accounts.json`:

```json
{
  "accounts": [
    {
      "name": "K2Think AI",
      "url": "https://www.k2think.ai",
      "email": "your-email@example.com",
      "password": "your-password",
      "enabled": true
    }
  ]
}
```

### 4. Start Server

```bash
npm run dev
```

## 📋 Features

### 🕵️ Undetectable Browser Automation

Based on research from:
- https://github.com/Zeeeepa/example/tree/ec69bdbb7eda5b9be1e778b54c13b116006c84c3/Chromium
- https://github.com/rebrowser/rebrowser-playwright

**Stealth Features:**
- ✅ Randomized User-Agent rotation
- ✅ Navigator.webdriver property hiding
- ✅ Canvas fingerprint randomization
- ✅ WebGL vendor/renderer spoofing
- ✅ Plugin simulation (PDF, NaCl)
- ✅ Permission API overrides
- ✅ WebRTC IP leak prevention
- ✅ 65+ Chrome flags for detection bypass

### 🧠 Vision AI Integration

- **Login Detection**: Automatically identifies login forms
- **Element Location**: Detects inputs, buttons via coordinates
- **CAPTCHA Solving**: Identifies CAPTCHA types for solving
- **Flow Discovery**: Maps available actions in UI
- **Response Detection**: Knows when AI finished responding

### 🔌 OpenAI-Compatible API

```bash
curl https://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk-service-xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "service-k2think",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

**Response:**
```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1705315200,
  "model": "service-k2think",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help you today?"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 15,
    "total_tokens": 25
  }
}
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│         accounts.json (Config)              │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│      ServiceOrchestrator (Main Logic)       │
│  ┌──────────┐  ┌────────────┐  ┌─────────┐ │
│  │ Vision   │  │  Browser   │  │  Flow   │ │
│  │Analyzer  │  │Controller  │  │Executor │ │
│  └──────────┘  └────────────┘  └─────────┘ │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│   OpenAI Gateway (API Endpoint)             │
│   POST /v1/chat/completions                 │
└─────────────────────────────────────────────┘
```

## 📁 Project Structure

```
packages/WebAutomation/
├── accounts.json              # Service credentials
├── src/
│   ├── types/index.ts         # TypeScript interfaces
│   ├── core/
│   │   ├── BrowserController.ts      # Undetectable Playwright
│   │   ├── VisionAnalyzer.ts         # GLM-4.6V integration
│   │   ├── ServiceOrchestrator.ts    # Main orchestration
│   │   ├── FlowExecutor.ts           # Execute flows
│   │   └── StorageManager.ts         # Save/load flows
│   ├── api/
│   │   └── OpenAIGateway.ts          # API endpoint
│   └── server.ts              # Express server
├── data/
│   ├── screenshots/           # Vision analysis screenshots
│   ├── cookies/               # Session cookies
│   └── flows/                 # Discovered flows
└── package.json
```

## 🔒 Security

**⚠️ WARNING: This tool uses aggressive anti-detection measures that REDUCE browser security.**

- Credentials encrypted with AES-256
- Cookies encrypted before storage
- API key authentication
- Rate limiting per service
- Audit logging for all actions

**NEVER use these Chrome flags for regular browsing!**

## 🧪 Testing

```bash
# Run tests
npm test

# Test specific service
npm run test:service https://www.k2think.ai

# Test stealth (visit bot detection sites)
npm run test:stealth
```

## 📊 Monitoring

Real-time WebSocket events:
```javascript
const ws = new WebSocket('ws://localhost:3000/ws/service-id');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data.event, data.timestamp, data.data);
};
```

**Event Types:**
- `screenshot` - New screenshot captured
- `vision_analysis` - Vision AI analysis complete
- `login` - Login started/complete
- `flow_discovery` - New flow discovered
- `flow_test` - Flow tested
- `complete` - Service ready
- `error` - Error occurred

## 🤝 Contributing

This is part of the **MemberJunction** monorepo.

## 📝 License

MIT License - See LICENSE file

## 🙏 Credits

**Anti-Detection Research:**
- https://github.com/Zeeeepa/example (Chrome flags reference)
- https://github.com/rebrowser/rebrowser-playwright
- https://github.com/AlloryDante/undetected-browser

**Vision AI:**
- GLM-4.6V by Zhipu AI

**Browser Automation:**
- Playwright by Microsoft

---

**Made with ❤️ for automated AI inference retrieval**

