# Web2API Deployment and Verification Guide

## 🚀 Quick Start Deployment

### Prerequisites

1. **Node.js 20+** installed
2. **Daytona API Key** from https://app.daytona.io
3. **Anthropic API Key** (or Z.AI proxy credentials)
4. **K2Think.ai account** for testing (optional)

### Step 1: Environment Setup

```bash
cd /tmp/Zeeeepa/MJ/packages/WebChat2Api

# Copy environment template
cp .env.local.example .env.local

# Edit with your credentials
nano .env.local
```

Required environment variables:
```bash
# Anthropic API Configuration
ANTHROPIC_AUTH_TOKEN=your_z_ai_token_here
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
ANTHROPIC_API_KEY=your_anthropic_key_here
MODEL=glm-4.6v

# Daytona Configuration
DAYTONA_API_KEY=your_daytona_key_here
DAYTONA_API_URL=https://app.daytona.io/api

# OpenAI API Server
OPENAI_API_PORT=8080
OPENAI_API_HOST=0.0.0.0
WEBCHAT2API_API_KEY=your_chosen_api_key

# K2Think.ai Test Credentials
K2THINK_URL=https://www.k2think.ai
K2THINK_EMAIL=your_email@example.com
K2THINK_PASSWORD=your_password
```

### Step 2: Install Dependencies

```bash
# From repository root
npm install --legacy-peer-deps
```

### Step 3: Build Package

```bash
cd packages/WebChat2Api
npm run build
```

Expected output:
```
✓ TypeScript compilation successful
✓ All files compiled to dist/
✓ No errors found
```

## ✅ Verification Steps

### Verification 1: Basic Demo

Test multi-strategy element identification:

```bash
npm run demo:multi-strategy
```

Expected behavior:
1. Browser opens automatically (not headless)
2. Navigates to https://chat.openai.com
3. Takes screenshot for vision analysis
4. Identifies login elements
5. Shows confidence scores for each strategy
6. Outputs found elements with selectors

Success indicators:
- ✓ "Found X elements" message
- ✓ Elements have confidence scores > 0.7
- ✓ Multiple strategies attempted
- ✓ Browser closes gracefully

### Verification 2: K2Think.ai Authentication

Test with real credentials:

```bash
npm run demo:k2think auth
```

Expected behavior:
1. Browser opens to https://www.k2think.ai
2. Finds email input field
3. Finds password input field
4. Enters credentials with human-like delays
5. Finds and clicks submit button
6. Waits for navigation/response
7. Takes screenshots at each stage
8. Identifies available features post-login

Success indicators:
- ✓ "Email input found" message
- ✓ "Password input found" message
- ✓ "Submit button found" message
- ✓ "Login submitted" message
- ✓ Screenshots saved (k2think-*.png)
- ✓ URL changes or dashboard appears
- ✓ No error messages displayed

Troubleshooting:
- If email not found: Check if login page structure changed
- If credentials rejected: Verify credentials in .env.local
- If timeout occurs: Increase timeout in demo config

### Verification 3: Daytona Sandbox Manager

Test sandbox creation and management:

```bash
# Create test file
cat > test-sandbox.ts << 'EOF'
import { DaytonaSandboxManager } from './dist/sandbox/DaytonaSandboxManager';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function test() {
    const manager = new DaytonaSandboxManager();
    
    console.log('Creating sandbox...');
    const sandbox = await manager.createSandbox();
    console.log(`✓ Sandbox created: ${sandbox.id}`);
    console.log(`  Status: ${sandbox.status}`);
    
    console.log('\nExecuting test code...');
    const result = await manager.executeBrowserCode(
        sandbox.id,
        'console.log("Hello from sandbox"); process.exit(0);'
    );
    console.log(`✓ Code executed`);
    console.log(`  Exit code: ${result.exitCode}`);
    
    console.log('\nGetting stats...');
    const stats = manager.getStats();
    console.log(`  Total sandboxes: ${stats.total}`);
    console.log(`  Active: ${stats.active}`);
    console.log(`  Total uses: ${stats.totalUses}`);
    
    console.log('\nCleaning up...');
    await manager.cleanup();
    console.log('✓ Cleanup complete');
}

test().catch(console.error);
EOF

# Run test
npx ts-node test-sandbox.ts
```

Expected output:
```
Creating sandbox...
✓ Sandbox created: web2api-1234567890-abc123
  Status: active

Executing test code...
✓ Code executed
  Exit code: 0

Getting stats...
  Total sandboxes: 1
  Active: 1
  Total uses: 1

Cleaning up...
✓ Cleanup complete
```

Success indicators:
- ✓ Sandbox created within 30 seconds
- ✓ Status changes from 'creating' to 'active'
- ✓ Code executes successfully (exit code 0)
- ✓ Stats show correct counts
- ✓ Cleanup completes without errors

### Verification 4: OpenAI API Server

Start the server and test endpoints:

```bash
# Terminal 1: Start server
npm run start:dev
```

Expected server output:
```
Web2API OpenAI-Compatible Server
Listening on http://0.0.0.0:8080

Endpoints:
  POST /v1/chat/completions
  POST /v1/completions
  GET  /v1/models
  GET  /health

Strategies loaded:
  ✓ Vision Model Strategy
  ✓ Computer Use Strategy
  ✓ Natural Language Strategy
  ✓ DOM Analysis Strategy
  ✓ Stealth Strategy
```

```bash
# Terminal 2: Test endpoints
curl http://localhost:8080/health

curl http://localhost:8080/v1/models \
  -H "Authorization: Bearer ${WEBCHAT2API_API_KEY}"

curl http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer ${WEBCHAT2API_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "web2api-vision",
    "messages": [
      {"role": "user", "content": "Test message"}
    ]
  }'
```

Expected responses:
```json
// Health check
{
  "status": "healthy",
  "uptime": 123.45,
  "sandboxes": {
    "total": 0,
    "active": 0
  }
}

// Models list
{
  "object": "list",
  "data": [
    {
      "id": "web2api-vision",
      "object": "model",
      "created": 1234567890,
      "owned_by": "web2api",
      "description": "Vision Model Strategy with multi-model support"
    },
    // ... more models
  ]
}

// Chat completion
{
  "id": "chatcmpl-xyz",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "web2api-vision",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Response content here"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}
```

### Verification 5: End-to-End Flow

Test complete workflow with K2Think.ai:

```bash
npm run demo:k2think all
```

This runs:
1. Authentication test (from Verification 2)
2. Feature identification
3. OpenAI API test (from Verification 4)

Expected timeline:
- 0:00-0:10 - Browser setup and navigation
- 0:10-0:20 - Login process
- 0:20-0:30 - Feature identification
- 0:30-0:40 - API server tests
- 0:40-0:50 - Cleanup

Success indicators:
- ✓ All verification steps pass
- ✓ No error messages
- ✓ Screenshots saved
- ✓ API responses valid
- ✓ Clean exit code 0

## 🔧 Troubleshooting

### Issue: "Daytona API key is required"

**Solution:**
```bash
# Verify environment variable is set
echo $DAYTONA_API_KEY

# If empty, add to .env.local
echo "DAYTONA_API_KEY=your_key_here" >> .env.local

# Reload environment
source .env.local
```

### Issue: "Cannot find module '@daytonaio/sdk'"

**Solution:**
```bash
# Reinstall dependencies
npm install --legacy-peer-deps

# Verify package is installed
ls node_modules/@daytonaio/sdk

# If still missing, install directly
npm install @daytonaio/sdk @computesdk/daytona
```

### Issue: "Browser failed to launch"

**Solution:**
```bash
# Install Playwright browsers
npx playwright install chromium --with-deps

# On Linux, install system dependencies
npx playwright install-deps chromium
```

### Issue: "Port 8080 already in use"

**Solution:**
```bash
# Option 1: Kill existing process
lsof -ti:8080 | xargs kill -9

# Option 2: Use different port
export OPENAI_API_PORT=8081
npm run start:dev
```

### Issue: "K2Think.ai login fails"

**Possible causes:**
1. **Wrong credentials**: Verify email and password in .env.local
2. **Page structure changed**: Update selectors in k2think-demo.ts
3. **CAPTCHA/bot detection**: Use stealth mode or manual login
4. **Network issues**: Check internet connection and URL accessibility

**Debug steps:**
```bash
# Run with increased timeout
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const page = await browser.newPage();
  await page.goto('https://www.k2think.ai');
  await page.screenshot({ path: 'debug.png', fullPage: true });
  console.log('Screenshot saved to debug.png');
  await page.waitForTimeout(30000); // 30 seconds to inspect
  await browser.close();
})();
"
```

### Issue: "Sandbox creation timeout"

**Solution:**
```bash
# Check Daytona service status
curl -H "Authorization: Bearer ${DAYTONA_API_KEY}" \
     ${DAYTONA_API_URL}/health

# Increase timeout in config
# Edit DaytonaSandboxManager.ts
# timeout: 600000 // 10 minutes
```

## 📊 Performance Benchmarks

### Expected Performance Metrics

| Operation | Time | Notes |
|-----------|------|-------|
| Sandbox creation | 15-30s | First time setup |
| Sandbox reuse | <1s | Using existing sandbox |
| Vision element ID | 2-4s | Depends on model |
| DOM element ID | <100ms | Fastest strategy |
| NaturalLanguage element ID | 1-2s | GPT-4o API call |
| Computer Use action | 3-5s | Multiple API calls |
| Stealth action | 200-500ms | With delays |
| Flow execution (5 steps) | 10-15s | With retries |

### Resource Usage

| Resource | Development | Production |
|----------|-------------|------------|
| Memory | 500MB-1GB | 1-2GB |
| CPU | 1-2 cores | 2-4 cores |
| Storage | 2GB | 10GB+ |
| Network | 10Mbps | 50Mbps+ |

## 🎯 Production Deployment Checklist

- [ ] Environment variables set and validated
- [ ] All verification tests pass
- [ ] API authentication configured
- [ ] Rate limiting configured
- [ ] Error monitoring setup (Sentry, etc.)
- [ ] Logging configured (Winston, etc.)
- [ ] HTTPS/TLS configured for API
- [ ] Firewall rules configured
- [ ] Backup strategy for flows
- [ ] Monitoring dashboards created
- [ ] Documentation updated
- [ ] Team trained on usage

## 🔐 Security Checklist

- [ ] API keys stored securely (not in code)
- [ ] Strong authentication required
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] CORS configured properly
- [ ] Sandboxes isolated from each other
- [ ] Credentials encrypted in database
- [ ] Audit logging enabled
- [ ] Regular security updates
- [ ] Penetration testing completed

## 📈 Monitoring

### Key Metrics to Track

1. **API Performance**
   - Request rate (requests/minute)
   - Response time (p50, p95, p99)
   - Error rate (%)
   - Timeout rate (%)

2. **Sandbox Health**
   - Active sandboxes count
   - Sandbox creation time
   - Sandbox failure rate
   - Resource utilization

3. **Strategy Performance**
   - Success rate per strategy
   - Average execution time
   - Fallback frequency
   - Cost per strategy execution

### Recommended Monitoring Tools

- **Application Monitoring**: New Relic, Datadog, or Application Insights
- **Log Aggregation**: ELK Stack or Splunk
- **Error Tracking**: Sentry or Rollbar
- **Uptime Monitoring**: Pingdom or UptimeRobot

## 🎓 Next Steps

After successful verification:

1. **Explore Examples**: Review code in `src/examples/`
2. **Read Architecture**: See ARCHITECTURE.md for system design
3. **Build Custom Strategies**: Extend BaseStrategy class
4. **Create Flows**: Record and automate workflows
5. **Integrate Services**: Add more web applications
6. **Scale**: Configure auto-scaling with Daytona
7. **Monitor**: Set up observability stack
8. **Optimize**: Profile and tune performance

## 📞 Support

- **Documentation**: See README.md and PHASE1-IMPLEMENTATION.md
- **Issues**: GitHub Issues
- **Community**: Discord/Slack channel
- **Commercial Support**: Contact enterprise@memberjunction.com

---

**Congratulations! Your Web2API system is now deployed and verified!** 🎉
