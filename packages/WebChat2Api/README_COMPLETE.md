# WebChat2Api - Complete Implementation Guide

## 🎯 Overview

**WebChat2Api** is a production-ready gateway that converts any web chat UI into OpenAI-compatible API endpoints. Built using the full MemberJunction (MJ) platform ecosystem with comprehensive database storage for flow compression contexts.

### Key Features

✅ **OpenAI-Compatible API** - Drop-in replacement for OpenAI chat completions  
✅ **Web Automation** - Playwright-based browser control with vision analysis  
✅ **Database Persistence** - Complete flow storage with SQL Server backend  
✅ **Multi-Provider AI** - Support for OpenAI, Anthropic, Gemini, and more  
✅ **Queue Management** - Async job processing with MJQueue  
✅ **Cloud Storage** - Screenshot and artifact storage with MJStorage  
✅ **Production Ready** - Full error handling, monitoring, and analytics  

---

## 📦 MJ Packages Used

### Core Infrastructure (Tier 1) ⭐⭐⭐⭐⭐

| Package | Purpose | Usage |
|---------|---------|-------|
| `@memberjunction/server` | Express/GraphQL server | HTTP server infrastructure |
| `@memberjunction/core` | Entity management & metadata | Database CRUD operations |
| `@memberjunction/ai` | AI provider abstraction | Vision analysis, LLM calls |
| `mj_generatedentities` | ORM entities | Type-safe database access |
| `@memberjunction/storage` | Cloud storage | Screenshot/artifact storage |

### Orchestration & Actions (Tier 2) ⭐⭐⭐⭐

| Package | Purpose | Usage |
|---------|---------|-------|
| `@memberjunction/actions` | Workflow engine | Multi-step flow orchestration |
| `@memberjunction/queue` | Task queue | Async request processing |
| `@memberjunction/communication-engine` | Notifications | Email/SMS alerts |
| `@memberjunction/sqlserver-dataprovider` | Database access | SQL Server connectivity |

### AI Providers (Tier 2) ⭐⭐⭐⭐

| Package | Purpose | Models |
|---------|---------|--------|
| `@memberjunction/ai-openai` | OpenAI integration | GPT-4V, GPT-4, GPT-3.5 |
| `@memberjunction/ai-anthropic` | Claude integration | Claude 3, Claude 3.5 |
| `@memberjunction/ai-gemini` | Google Gemini | Gemini Pro Vision |
| `@memberjunction/ai-provider-bundle` | Load all providers | Prevents tree-shaking |

### Utilities (Tier 3) ⭐⭐⭐

| Package | Purpose | Usage |
|---------|---------|-------|
| `@memberjunction/metadata-sync` | Schema sync | Keep DB schema updated |
| `@memberjunction/code-execution` | Sandboxed code | User script execution |
| `@memberjunction/scheduling-engine` | Job scheduler | Periodic flow execution |
| `@memberjunction/data-context` | Session management | Request context handling |

---

## 🗄️ Database Schema

### 7 Core Tables

1. **WebChatFlows** - Flow configurations
2. **FlowSteps** - Individual step definitions
3. **FlowCredentials** - Encrypted authentication
4. **FlowExecutions** - Execution history & metrics
5. **UIFeatures** - Detected UI elements
6. **ElementInteractions** - Interaction logs
7. **FlowAnalytics** - Aggregated analytics

### Key Features

- ✅ Full encryption for credentials (AES-256-GCM)
- ✅ Comprehensive execution tracking
- ✅ Performance metrics & analytics
- ✅ UI element detection & change tracking
- ✅ Computed columns for success rates

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd packages/WebChat2Api
npm install
```

### 2. Setup Database

```bash
# Run migration script
sqlcmd -S localhost -d MemberJunction -i migrations/001_create_webchat_tables.sql
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Server Configuration
PORT=3000
NODE_ENV=production
ENABLE_CORS=true
CORS_ORIGIN=*

# Database
DATABASE_URL=Server=localhost;Database=MemberJunction;User Id=sa;Password=yourpassword;TrustServerCertificate=true

# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...

# Browser Automation
HEADLESS=true
STEALTH_MODE=false

# Storage (optional)
STORAGE_PROVIDER=s3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=webchat2api-screenshots

# Security
ENCRYPTION_KEY=your-32-byte-hex-key
```

### 4. Start Server

```bash
npm run build
npm start
```

Server starts on `http://localhost:3000`

---

## 📝 Complete Usage Example

### Step 1: Create a Flow

**Request:**

```bash
curl -X POST http://localhost:3000/flows \
  -H "Content-Type: application/json" \
  -d '{
    "serviceName": "Pixelium Web Chat",
    "serviceURL": "https://pixelium.uk",
    "signInURL": "https://pixelium.uk/signin",
    "description": "Pixelium customer support chat",
    "username": "developer@pixelium.uk",
    "password": "developer123?"
  }'
```

**Response:**

```json
{
  "flowId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "serviceName": "Pixelium Web Chat",
  "status": "Active"
}
```

### Step 2: Configure Flow Steps (Optional)

```bash
curl -X POST http://localhost:3000/flows/a1b2c3d4.../steps \
  -H "Content-Type: application/json" \
  -d '{
    "steps": [
      {
        "stepOrder": 1,
        "stepType": "Login",
        "stepName": "Authenticate",
        "actionType": "fill",
        "elementSelector": "input[type=email]"
      },
      {
        "stepOrder": 2,
        "stepType": "Navigate",
        "stepName": "Go to chat",
        "actionValue": "/chat"
      },
      {
        "stepOrder": 3,
        "stepType": "Extract",
        "stepName": "Get messages",
        "elementSelector": ".chat-messages"
      }
    ]
  }'
```

### Step 3: Use OpenAI-Compatible API

**Chat Completion Request:**

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-Flow-ID: a1b2c3d4-e5f6-7890-abcd-ef1234567890" \
  -d '{
    "model": "webchat:a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "messages": [
      {
        "role": "user",
        "content": "What is my account status?"
      }
    ],
    "temperature": 0.7,
    "max_tokens": 1000
  }'
```

**Response (OpenAI Format):**

```json
{
  "id": "chatcmpl-a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "object": "chat.completion",
  "created": 1703001234,
  "model": "webchat:a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Your account is active with 3 pending support tickets. Your subscription expires on 2024-12-31."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 45,
    "completion_tokens": 87,
    "total_tokens": 132
  }
}
```

### Step 4: Streaming Response

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-Flow-ID: a1b2c3d4..." \
  -d '{
    "model": "webchat:a1b2c3d4...",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'
```

**Streaming Response:**

```
data: {"id":"chatcmpl-...","object":"chat.completion.chunk","created":1703001234,"model":"webchat:...","choices":[{"index":0,"delta":{"content":"Your "},"finish_reason":null}]}

data: {"id":"chatcmpl-...","object":"chat.completion.chunk","created":1703001234,"model":"webchat:...","choices":[{"index":0,"delta":{"content":"account "},"finish_reason":null}]}

data: [DONE]
```

---

## 🔧 Advanced Configuration

### Custom Vision Provider

```typescript
import { WebChatGateway } from './gateway/WebChatGateway';
import { GetAIAPIInstance } from '@memberjunction/ai';

const gateway = new WebChatGateway();

// Override default vision provider
gateway.visionProvider = await GetAIAPIInstance('anthropic', 'claude-3-opus-20240229');
```

### Queue Configuration

```typescript
import { QueueManager } from '@memberjunction/queue';

// Configure queue processing
QueueManager.Configure({
  concurrency: 5,
  retryAttempts: 3,
  retryDelay: 1000,
  timeout: 60000
});

// Process jobs
QueueManager.ProcessJobs('webchat-execution', async (job) => {
  // Your processing logic
});
```

### Storage Configuration

```typescript
import { StorageProvider } from '@memberjunction/storage';

// Configure S3 storage
const storage = new StorageProvider({
  provider: 's3',
  bucket: 'webchat2api-screenshots',
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
});
```

---

## 📊 Monitoring & Analytics

### Flow Analytics

```bash
curl http://localhost:3000/flows/a1b2c3d4.../analytics
```

**Response:**

```json
{
  "flowId": "a1b2c3d4...",
  "period": "last_7_days",
  "statistics": {
    "totalExecutions": 1523,
    "successfulExecutions": 1487,
    "failedExecutions": 36,
    "successRate": 97.64,
    "averageExecutionTimeMs": 2345,
    "p95ExecutionTimeMs": 3890,
    "p99ExecutionTimeMs": 5234,
    "totalTokensUsed": 234567,
    "totalCost": 4.69,
    "averageCostPerExecution": 0.0031
  },
  "errors": [
    {
      "errorCode": "TIMEOUT",
      "count": 15,
      "percentage": 41.67
    },
    {
      "errorCode": "AUTH_FAILED",
      "count": 12,
      "percentage": 33.33
    }
  ],
  "performanceTrend": "improving",
  "reliabilityScore": 97.6
}
```

### Recent Executions

```bash
curl http://localhost:3000/executions?flowId=a1b2c3d4...&limit=10
```

---

## 🔐 Security Best Practices

### 1. Credential Encryption

```typescript
import * as crypto from 'crypto';

// Encrypt password before storing
function encryptPassword(password: string, key: string): Buffer {
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return encrypted;
}

// Decrypt when needed
function decryptPassword(encrypted: Buffer, key: string): string {
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
```

### 2. Never Log Credentials

```typescript
// ❌ WRONG
console.log('Password:', password);

// ✅ CORRECT
console.log('Password: [REDACTED]');
```

### 3. IP Whitelisting

```typescript
const credentials = new FlowCredentialEntity();
credentials.IPWhitelist = JSON.stringify(['192.168.1.100', '10.0.0.0/8']);
```

### 4. Token Rotation

```typescript
// Automatic rotation schedule
credentials.RotationSchedule = 'Weekly';
credentials.NextRotationAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
```

---

## 🧪 Testing

### Run Tests

```bash
npm test
```

### Example Test

```typescript
import { WebChat2ApiServer } from './server';
import request from 'supertest';

describe('WebChat2Api Gateway', () => {
  let server: WebChat2ApiServer;

  beforeAll(async () => {
    server = new WebChat2ApiServer();
    await server.initialize();
  });

  test('POST /v1/chat/completions returns OpenAI format', async () => {
    const response = await request(server.app)
      .post('/v1/chat/completions')
      .set('X-Flow-ID', 'test-flow-id')
      .send({
        model: 'webchat:test-flow-id',
        messages: [
          { role: 'user', content: 'Hello' }
        ]
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('choices');
    expect(response.body.choices[0]).toHaveProperty('message');
  });

  afterAll(async () => {
    await server.shutdown();
  });
});
```

---

## 📈 Performance Optimization

### 1. Browser Connection Pooling

```typescript
// Maintain pool of authenticated browser contexts
class BrowserPool {
  private contexts: Map<string, BrowserContext> = new Map();

  async getContext(flowId: string): Promise<BrowserContext> {
    if (!this.contexts.has(flowId)) {
      const context = await browser.newContext();
      // Restore cookies
      this.contexts.set(flowId, context);
    }
    return this.contexts.get(flowId)!;
  }
}
```

### 2. Response Caching

```typescript
import { createClient } from 'redis';

const redis = createClient();

// Cache responses
async function getCachedResponse(flowId: string, messagesHash: string) {
  const key = `flow:${flowId}:${messagesHash}`;
  const cached = await redis.get(key);
  return cached ? JSON.parse(cached) : null;
}
```

### 3. Database Indexing

```sql
-- Add indexes for common queries
CREATE INDEX IX_FlowExecutions_FlowID_Status_CreatedAt 
ON FlowExecutions(FlowID, Status, CreatedAt DESC);

CREATE INDEX IX_UIFeatures_FlowID_IsAvailable_LastSeenAt
ON UIFeatures(FlowID, IsCurrentlyAvailable, LastSeenAt DESC);
```

---

## 🐛 Troubleshooting

### Browser Launch Fails

**Problem:** `Error: Failed to launch browser`

**Solution:**
```bash
# Install Playwright browsers
npx playwright install chromium

# Or with dependencies
npx playwright install-deps chromium
```

### Database Connection Error

**Problem:** `ConnectionError: Failed to connect to SQL Server`

**Solution:**
```bash
# Check connection string
echo $DATABASE_URL

# Test connection
sqlcmd -S localhost -U sa -P yourpassword -Q "SELECT @@VERSION"
```

### Vision Analysis Fails

**Problem:** `API key not found`

**Solution:**
```bash
# Set API key
export OPENAI_API_KEY=sk-...

# Verify
echo $OPENAI_API_KEY
```

---

## 📚 API Reference

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/chat/completions` | OpenAI-compatible chat |
| GET | `/v1/models` | List available flows |
| POST | `/flows` | Create new flow |
| GET | `/flows` | List all flows |
| GET | `/flows/:id` | Get flow details |
| PUT | `/flows/:id` | Update flow |
| DELETE | `/flows/:id` | Delete flow |
| GET | `/flows/:id/analytics` | Flow analytics |
| GET | `/executions` | List executions |
| GET | `/health` | Health check |

---

## 🤝 Contributing

Contributions welcome! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md)

---

## 📄 License

MIT License - see [LICENSE](../../LICENSE)

---

## 🙏 Acknowledgments

Built with the MemberJunction platform:
- [@memberjunction/server](https://www.npmjs.com/package/@memberjunction/server)
- [@memberjunction/core](https://www.npmjs.com/package/@memberjunction/core)
- [@memberjunction/ai](https://www.npmjs.com/package/@memberjunction/ai)
- And 30+ other packages

---

**Production Ready** ✅ | **Fully Documented** 📚 | **Battle Tested** 🛡️

