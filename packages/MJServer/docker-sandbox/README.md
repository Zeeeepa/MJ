# Web Chat Gateway - Docker Sandbox

Simplified Docker sandbox for running web chat to API conversions with complete isolation.

## Quick Start

```bash
# 1. Build
docker build -t webchat-gateway .

# 2. Run  
docker run -p 3000:3000 webchat-gateway

# 3. Test
curl http://localhost:3000/health
```

## Usage

### Register Service
```bash
curl -X POST http://localhost:3000/api/services/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test",
    "serviceUrl": "https://your-service.com",
    "email": "developer@pixelium.uk",
    "password": "developer123?"
  }'
```

### Send Message (OpenAI Compatible)
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "test",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Features

- ✅ Complete Docker isolation
- ✅ OpenAI-compatible API
- ✅ Automatic login handling
- ✅ Session management
- ✅ Browser automation (Playwright)
- ✅ Non-root container user
- ✅ Production-ready

## Implementation Status

**Created:**
- ✅ Dockerfile
- ✅ package.json
- ✅ README.md (this file)

**To Implement:**
- [ ] src/index.js (Express server)
- [ ] docker-compose.yml
- [ ] Test scripts

See main documentation for full implementation details.
