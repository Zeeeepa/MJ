# Complete Web2API System - Setup & Usage Guide

## 🎯 What This System Does

Converts 5 AI chat web services into OpenAI-compatible API endpoints with:
- **Automatic feature discovery** using vision models
- **Atomic actions** with vision verification after each step
- **Session persistence** with PostgreSQL
- **Smart job queueing** with BullMQ/Redis
- **Multi-service parallel execution** in single browser
- **Auto-scaling** with configurable concurrency

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              Fastify API Server (:8080)                 │
│  POST /v1/chat/completions                              │
│  GET  /v1/models                                        │
│  POST /v1/services/:name/discover                       │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│                 JobQueue (BullMQ + Redis)               │
│  - chat-completion jobs                                 │
│  - feature-discovery jobs                               │
│  - service-setup jobs                                   │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│           BrowserContextManager (Playwright)            │
│  Single Browser → Multiple Contexts (per service)       │
│  - DeepSeek Context                                     │
│  - Grok Context                                         │
│  - Qwen Context                                         │
│  - Z.AI Context                                         │
│  - Mistral Context                                      │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│          AtomicActionExecutor + Vision Verification     │
│  Each action → Screenshot → Vision Model → Verify       │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│         SessionManager (PostgreSQL)                     │
│  Persist cookies, contexts, sessions                    │
└─────────────────────────────────────────────────────────┘
```

## 📋 Prerequisites

### 1. Install PostgreSQL

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Docker (All platforms):**
```bash
docker run --name web2api-postgres \
  -e POSTGRES_PASSWORD=web2api_password \
  -e POSTGRES_USER=web2api \
  -e POSTGRES_DB=web2api \
  -p 5432:5432 \
  -d postgres:15
```

### 2. Install Redis

**macOS:**
```bash
brew install redis
brew services start redis
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**Docker (All platforms):**
```bash
docker run --name web2api-redis \
  -p 6379:6379 \
  -d redis:7-alpine
```

### 3. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE web2api;
CREATE USER web2api WITH ENCRYPTED PASSWORD 'web2api_password';
GRANT ALL PRIVILEGES ON DATABASE web2api TO web2api;

# Exit
\q
```

## 🚀 Quick Start

### Step 1: Verify Environment Configuration

Check `/tmp/Zeeeepa/MJ/packages/WebChat2Api/.env.local`:

```bash
# All 5 services should have credentials
DEEPSEEK_URL=https://chat.deepseek.com/
DEEPSEEK_EMAIL=zeeeepa+1@gmail.com
DEEPSEEK_PASSWORD=developer123??

GROK_URL=https://grok.com/
GROK_EMAIL=developer@pixelium.uk
GROK_PASSWORD=developer123??

QWEN_URL=https://chat.qwen.ai/
QWEN_EMAIL=developer@pixelium.uk
QWEN_PASSWORD=developer1?

ZAI_URL=https://chat.z.ai/
ZAI_EMAIL=developer@pixelium.uk
ZAI_PASSWORD=developer123?

MISTRAL_URL=https://chat.mistral.ai
MISTRAL_EMAIL=developer@pixelium.uk
MISTRAL_PASSWORD=mistraldeveloper123?

# Database & Queue
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=web2api
POSTGRES_USER=web2api
POSTGRES_PASSWORD=web2api_password

REDIS_HOST=localhost
REDIS_PORT=6379
```

### Step 2: Install Dependencies

```bash
cd /tmp/Zeeeepa/MJ
npm install --legacy-peer-deps
```

### Step 3: Build Package

```bash
cd packages/WebChat2Api
npm run build
```

### Step 4: Run Discovery Demo

This will authenticate and discover features for all 5 services:

```bash
npm run demo:all-services
```

**Expected Output:**
```
╔════════════════════════════════════════════════════════════╗
║   Web2API - All Services Discovery Demo                   ║
╚════════════════════════════════════════════════════════════╝

============================================================
Testing DeepSeek
============================================================

1. Navigating to https://chat.deepseek.com/...
   ✓ Initial screenshot saved

2. Searching for login elements...
   ✓ Found email input: input[type="email"]
   ✓ Found password input: input[type="password"]

3. Entering credentials...
   ✓ Credentials entered

4. Clicking submit button...
   ✓ Submit clicked

5. Current URL: https://chat.deepseek.com/chat
   ✓ DeepSeek authentication successful!

6. Discovering features for DeepSeek...
   Found 12 interactive elements:

   BUTTONS (8):
     • New Chat
     • Settings
     • Send
     • Stop
     • Regenerate
     ... and 3 more

   TOGGLES (2):
     • Internet Search
     • Code Interpreter

   DROPDOWNS (2):
     • Model Selection
     • Temperature

   ✓ Feature discovery complete

[Repeats for Grok, Qwen, Z.AI, Mistral...]

============================================================
Summary
============================================================

✓ DeepSeek: SUCCESS
✓ Grok: SUCCESS  
✓ Qwen: SUCCESS
✓ Z.AI: SUCCESS
✓ Mistral: SUCCESS

5/5 services authenticated successfully
```

### Step 5: Start API Server

```bash
npm run start:dev
```

**Expected Output:**
```
╔════════════════════════════════════════════════════════════╗
║   Web2API Server - OpenAI Compatible                      ║
╚════════════════════════════════════════════════════════════╝

✓ PostgreSQL connected (web2api@localhost:5432/web2api)
✓ Redis connected (localhost:6379)
✓ Session tables initialized
✓ Job queue initialized

Registered Services:
  ✓ DeepSeek (deepseek-chat, deepseek-coder)
  ✓ Grok (grok-1, grok-2)
  ✓ Qwen (qwen-max, qwen-plus, qwen-turbo)
  ✓ Z.AI (z-claude-3.5-sonnet, z-gpt-4, z-gemini-pro)
  ✓ Mistral (mistral-large, mistral-medium)

Server listening on http://0.0.0.0:8080

Endpoints:
  POST   /v1/chat/completions
  POST   /v1/completions  
  GET    /v1/models
  GET    /health
  POST   /v1/services/register
  GET    /v1/services
  POST   /v1/services/:name/discover
  GET    /v1/services/:name/features
  POST   /v1/services/:name/test
```

## 🎯 Using the API

### Test Health

```bash
curl http://localhost:8080/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-02T04:00:00.000Z",
  "services": {
    "redis": "connected",
    "postgres": "connected",
    "browser": "ready"
  },
  "queue": {
    "active": 0,
    "waiting": 0,
    "completed": 145
  }
}
```

### List Available Models

```bash
curl http://localhost:8080/v1/models
```

**Response:**
```json
{
  "object": "list",
  "data": [
    {
      "id": "deepseek-chat",
      "object": "model",
      "created": 1704153600,
      "owned_by": "deepseek"
    },
    {
      "id": "grok-2",
      "object": "model",
      "created": 1704153600,
      "owned_by": "x.ai"
    },
    {
      "id": "qwen-max",
      "object": "model",
      "created": 1704153600,
      "owned_by": "alibaba"
    },
    {
      "id": "z-claude-3.5-sonnet",
      "object": "model",
      "created": 1704153600,
      "owned_by": "z.ai"
    },
    {
      "id": "mistral-large",
      "object": "model",
      "created": 1704153600,
      "owned_by": "mistral"
    }
  ]
}
```

### Chat Completion Request

```bash
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "messages": [
      {"role": "user", "content": "What is the capital of France?"}
    ]
  }'
```

**Response:**
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1704153600,
  "model": "deepseek-chat",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "The capital of France is Paris."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 8,
    "total_tokens": 18
  }
}
```

### Streaming Response

```bash
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-2",
    "messages": [
      {"role": "user", "content": "Tell me a joke"}
    ],
    "stream": true
  }'
```

**Response (Server-Sent Events):**
```
data: {"id":"chatcmpl-123","choices":[{"index":0,"delta":{"role":"assistant","content":"Why"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","choices":[{"index":0,"delta":{"content":" did"},"finish_reason":null}]}

data: {"id":"chatcmpl-123","choices":[{"index":0,"delta":{"content":" the"},"finish_reason":null}]}

...

data: [DONE]
```

### Use with OpenAI SDK

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:8080/v1',
  apiKey: 'not-needed' // API key validation optional
});

// Chat completion
const response = await client.chat.completions.create({
  model: 'deepseek-chat',
  messages: [
    { role: 'user', content: 'Explain quantum computing' }
  ]
});

console.log(response.choices[0].message.content);

// Streaming
const stream = await client.chat.completions.create({
  model: 'grok-2',
  messages: [{ role: 'user', content: 'Write a poem' }],
  stream: true
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

## 🔍 Feature Discovery

### Discover Service Features

```bash
curl -X POST http://localhost:8080/v1/services/deepseek/discover
```

**Response:**
```json
{
  "service": "deepseek",
  "status": "discovering",
  "jobId": "discover-deepseek-123",
  "estimatedTime": 30
}
```

### Get Job Status

```bash
curl http://localhost:8080/v1/jobs/discover-deepseek-123
```

### List Service Features

```bash
curl http://localhost:8080/v1/services/deepseek/features
```

**Response:**
```json
{
  "service": "deepseek",
  "features": [
    {
      "name": "internet-search",
      "type": "toggle",
      "description": "Enable internet search for current response",
      "selectors": {
        "css": "button[aria-label='Internet Search']",
        "xpath": "//button[@aria-label='Internet Search']"
      },
      "actionFlow": {
        "steps": [
          {
            "action": "click",
            "selector": "button[aria-label='Internet Search']",
            "verify": "aria-pressed should be 'true'"
          }
        ]
      }
    },
    {
      "name": "model-selection",
      "type": "dropdown",
      "description": "Select DeepSeek model variant",
      "selectors": {
        "css": "select[name='model']",
        "xpath": "//select[@name='model']"
      },
      "actionFlow": {
        "steps": [
          {
            "action": "click",
            "selector": "select[name='model']",
            "verify": "dropdown should open"
          },
          {
            "action": "click",
            "selector": "option[value='deepseek-chat']",
            "verify": "model should change"
          }
        ]
      }
    }
  ]
}
```

## 🎨 DeepSeek Specific Features

### Use Internet Search Toggle

```bash
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-chat",
    "messages": [
      {"role": "user", "content": "What happened in tech news today?"}
    ],
    "features": {
      "internet-search": true
    }
  }'
```

### Select Specific Model

```bash
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-coder",
    "messages": [
      {"role": "user", "content": "Write a Python function to sort a list"}
    ],
    "features": {
      "model-selection": "deepseek-coder"
    }
  }'
```

## 📊 Monitoring & Management

### Queue Statistics

```bash
curl http://localhost:8080/v1/queue/stats
```

**Response:**
```json
{
  "active": 2,
  "waiting": 5,
  "completed": 145,
  "failed": 3,
  "delayed": 0,
  "paused": 0
}
```

### Active Sessions

```bash
curl http://localhost:8080/v1/sessions
```

**Response:**
```json
{
  "sessions": [
    {
      "serviceName": "deepseek",
      "createdAt": "2026-01-02T03:00:00.000Z",
      "lastActivity": "2026-01-02T04:00:00.000Z",
      "cookieCount": 5,
      "contextActive": true
    },
    {
      "serviceName": "grok",
      "createdAt": "2026-01-02T03:05:00.000Z",
      "lastActivity": "2026-01-02T03:50:00.000Z",
      "cookieCount": 3,
      "contextActive": true
    }
  ]
}
```

## 🐛 Troubleshooting

### PostgreSQL Connection Failed

```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Restart PostgreSQL
brew services restart postgresql@15  # macOS
sudo systemctl restart postgresql    # Linux

# Check logs
tail -f /usr/local/var/log/postgresql@15.log  # macOS
sudo journalctl -u postgresql -f              # Linux
```

### Redis Connection Failed

```bash
# Check if Redis is running
redis-cli ping

# Should return: PONG

# Restart Redis
brew services restart redis           # macOS
sudo systemctl restart redis-server   # Linux
```

### Service Authentication Failed

Check screenshots in `packages/WebChat2Api/`:
- `deepseek-01-initial.png` - Initial page
- `deepseek-02-credentials.png` - After entering credentials
- `deepseek-03-post-login.png` - After login attempt

Common issues:
- Wrong credentials → Update .env.local
- CAPTCHA required → Use stealth mode or manual login once
- Page structure changed → Update selectors

### Browser Crashes

```bash
# Install Playwright browsers
npx playwright install chromium --with-deps

# On Linux, install system dependencies
npx playwright install-deps chromium
```

## 📚 Additional Documentation

- **ARCHITECTURE.md** - System architecture details
- **API-REFERENCE.md** - Complete API documentation
- **FEATURE-DISCOVERY.md** - How feature discovery works
- **VISION-VERIFICATION.md** - Atomic actions with vision verification

## 🎉 Success Indicators

After successful setup, you should see:
- ✓ All 5 services authenticated
- ✓ Features discovered for each service
- ✓ API server responding on :8080
- ✓ PostgreSQL sessions table populated
- ✓ Redis queue processing jobs
- ✓ Screenshots saved for each service

**You're ready to use Web2API!** 🚀
