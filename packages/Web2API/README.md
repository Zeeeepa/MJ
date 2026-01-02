# Web2API - MemberJunction Edition

Convert any web chat interface into an OpenAI-compatible API endpoint using the MemberJunction framework.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd packages/Web2API
npm install --legacy-peer-deps
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your service credentials
```

### 3. Build

```bash
npm run build
```

### 4. Start Server

```bash
npm run dev
```

Server will start on `http://localhost:8080`

### 5. Test All Services

```bash
# In another terminal
npm run test-services
```

This will:
- Wait for server to be ready
- List all registered services
- Test each service with "What model are you?"
- Print all responses

## 📚 API Endpoints

### Admin Endpoints

- `GET /health` - Server health check
- `GET /admin/services` - List all registered services
- `POST /admin/services` - Register a new service
- `GET /admin/services/:id` - Get service details and flows

### OpenAI-Compatible Endpoints

- `GET /v1/models` - List available models
- `POST /v1/chat/completions` - Chat completion (supports streaming)

## 🔧 Usage Examples

### List All Services

```bash
curl http://localhost:8080/admin/services
```

### List Available Models

```bash
curl http://localhost:8080/v1/models
```

### Send Chat Message

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "k2think",
    "messages": [
      {"role": "user", "content": "What model are you?"}
    ]
  }'
```

### Register New Service

```bash
curl -X POST http://localhost:8080/admin/services \
  -H "Content-Type: application/json" \
  -d '{
    "name": "MyService",
    "url": "https://example.com/chat",
    "email": "user@example.com",
    "password": "password123",
    "defaultModel": "myservice",
    "modelAliases": ["myservice", "my-model"]
  }'
```

## 🎯 Features

### ✅ Implemented

- **Auto-registration** - Services from .env are registered automatically on startup
- **Flow Discovery** - Automatically discovers login and chat flows
- **OpenAI Compatibility** - Full OpenAI API compatibility
- **Model Aliasing** - Map friendly names to services (e.g., "k2think" → K2Think service)
- **Session Management** - Reuses browser contexts for efficiency
- **Browser Automation** - Uses Playwright with stealth features
- **Multiple Services** - Supports 6 services out of the box (K2Think, DeepSeek, Grok, Qwen, Z.AI, Mistral)

### 🚧 Planned (Phase 2)

- **Database Persistence** - SQL Server integration with MemberJunction
- **jshook-reverse-tool Integration** - Advanced JS reverse engineering
- **Health Monitoring** - Automatic flow validation
- **Load Balancing** - Multiple browser instances per service
- **Caching** - Response caching for common queries
- **Rate Limiting** - Per-service rate limits
- **Authentication** - JWT-based API authentication

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│       Express Server (Port 8080)        │
│   - /health                             │
│   - /admin/*                            │
│   - /v1/*                               │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│         Service Manager                 │
│  - Service Registration                 │
│  - Flow Discovery                       │
│  - Session Management                   │
│  - Chat Execution                       │
└────────────────┬────────────────────────┘
                 │
      ┌──────────┴──────────┬──────────┐
      ▼                     ▼          ▼
┌──────────┐        ┌──────────┐  ┌──────────┐
│K2Think   │        │DeepSeek  │  │  Grok    │
│Service   │        │Service   │  │  Service │
└──────────┘        └──────────┘  └──────────┘
```

## 📦 MemberJunction Integration

This package uses the following MemberJunction packages:

- `@memberjunction/core` - Core entity framework
- `@memberjunction/server` - Server infrastructure
- `@memberjunction/ai` - AI model abstractions
- `@memberjunction/ai-anthropic` - Anthropic (Claude) integration
- `@memberjunction/ai-openai` - OpenAI integration
- `@memberjunction/ai-gemini` - Gemini integration
- `@memberjunction/queue` - Job queue management
- `@memberjunction/storage` - File storage
- `@memberjunction/sqlserver-dataprovider` - SQL Server data access

## 🔍 Flow Discovery

The system automatically discovers interaction flows by analyzing the web page:

### Login Flow Discovery

1. Searches for email/username inputs
2. Searches for password inputs
3. Searches for submit buttons
4. Creates a multi-step flow with retry logic

### Chat Flow Discovery

1. Searches for message input (textarea, contenteditable, etc.)
2. Searches for submit button
3. Identifies response containers
4. Creates extraction selectors

## 🧪 Testing

### Manual Testing

```bash
# Start server
npm run dev

# In another terminal, test K2Think
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "k2think", "messages": [{"role": "user", "content": "Hello"}]}'
```

### Automated Testing

```bash
npm run test-services
```

This script will:
1. Wait for server to start
2. List all services
3. Test each service with "What model are you?"
4. Print summary of results

## 📝 Service Configuration

Services are configured in `.env`:

```bash
# Service Name
SERVICENAME_URL=https://example.com
SERVICENAME_EMAIL=user@example.com
SERVICENAME_PASSWORD=password123
```

The system will automatically:
- Register the service on startup
- Discover login and chat flows
- Create model alias (e.g., "servicename")
- Make it available via `/v1/chat/completions`

## 🐛 Troubleshooting

### Server won't start

```bash
# Check if port is in use
lsof -i :8080

# Try different port
PORT=3000 npm run dev
```

### Flow discovery fails

1. Check credentials in `.env`
2. Try with `HEADLESS=false` to see browser
3. Check service URL is correct
4. Some services may have CAPTCHA

### Chat execution fails

1. Verify flows were discovered: `curl http://localhost:8080/admin/services`
2. Check if service needs manual login first
3. Increase timeout in ServiceManager
4. Check browser console for errors

## 📖 Documentation

- **Architecture**: See [ARCHITECTURE.md](./ARCHITECTURE.md)
- **API Reference**: See [API.md](./API.md)
- **Development**: See [DEVELOPMENT.md](./DEVELOPMENT.md)

## 🤝 Contributing

This is part of the MemberJunction monorepo. See the main [README](../../README.md) for contribution guidelines.

## 📄 License

MIT

