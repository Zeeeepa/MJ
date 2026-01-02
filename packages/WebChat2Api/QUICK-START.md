# Web2API Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Configure Environment (1 minute)

```bash
cd packages/WebChat2Api

# Copy the environment template
cat > .env.local << 'EOF'
# Anthropic API (Z.AI Proxy)
ANTHROPIC_AUTH_TOKEN=665b963943b647dc9501dff942afb877.A47LrMc7sgGjyfBJ
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
ANTHROPIC_API_KEY=665b963943b647dc9501dff942afb877.A47LrMc7sgGjyfBJ
MODEL=glm-4.6v

# Daytona Sandbox
DAYTONA_API_KEY=dtn_1b1150aa80ea59951f8181234161b6267e600406404debdc6ce70d79e6488f34
DAYTONA_API_URL=https://app.daytona.io/api

# Web2API Server
OPENAI_API_PORT=8080
WEBCHAT2API_API_KEY=test-key-123

# K2Think.ai Test Service
K2THINK_URL=https://www.k2think.ai
K2THINK_EMAIL=developer@pixelium.uk
K2THINK_PASSWORD=developer123?
EOF
```

### Step 2: Install Dependencies (2 minutes)

```bash
# From repository root
npm install --legacy-peer-deps
```

### Step 3: Build Package (1 minute)

```bash
cd packages/WebChat2Api
npm run build
```

### Step 4: Run Demo (1 minute)

```bash
# Test K2Think.ai authentication
npm run demo:k2think auth
```

## ✅ Expected Results

### Console Output:
```
=== K2Think.ai Authentication Test ===

Navigating to https://www.k2think.ai...
✓ Initial page loaded

Searching for login elements...
✓ Found email input with selector: input[type="email"]
✓ Found password input with selector: input[type="password"]
✓ Found submit button with selector: button[type="submit"]

Entering credentials...
✓ Credentials entered

Submitting login form...
✓ Login submitted

Current URL: https://www.k2think.ai/dashboard

=== Feature Identification ===

Found 12 buttons
Found 25 links
Found 8 input fields

Navigation items:
  • Dashboard: https://www.k2think.ai/dashboard
  • Projects: https://www.k2think.ai/projects
  • Settings: https://www.k2think.ai/settings

✓ Demo completed successfully
```

### Generated Files:
- `k2think-initial.png` - Initial page screenshot
- `k2think-post-login.png` - After login screenshot

## 🎯 Next Steps

### Test OpenAI API Server

```bash
# Terminal 1: Start server
npm run start:dev

# Terminal 2: Test endpoints
curl http://localhost:8080/health

curl http://localhost:8080/v1/models \
  -H "Authorization: Bearer test-key-123"
```

### Run All Demos

```bash
# Multi-strategy element identification
npm run demo:multi-strategy

# Flow recording
npm run demo:flow-recording

# Strategy fallback
npm run demo:strategy-fallback

# Complete K2Think test
npm run demo:k2think all
```

## 🐛 Troubleshooting

### "Cannot find module"
```bash
npm install --legacy-peer-deps
```

### "Browser failed to launch"
```bash
npx playwright install chromium --with-deps
```

### "Daytona API key required"
```bash
# Verify .env.local exists and has DAYTONA_API_KEY set
cat .env.local | grep DAYTONA_API_KEY
```

### "K2Think login fails"
- Check credentials in .env.local
- Review screenshots: k2think-*.png
- Verify website is accessible

## 📚 Documentation

- **README.md** - Complete feature documentation
- **DEPLOYMENT-GUIDE.md** - Production deployment
- **ARCHITECTURE.md** - System architecture
- **FINAL-IMPLEMENTATION-REPORT.md** - Implementation details

## 🎓 What Just Happened?

You just:
1. ✅ Configured Web2API with your credentials
2. ✅ Installed all dependencies including Daytona SDK
3. ✅ Built the complete multi-strategy system
4. ✅ Tested real-world web automation with K2Think.ai

The system automatically:
- Identified login elements using multiple strategies
- Executed human-like interactions with stealth mode
- Captured screenshots for verification
- Identified available features post-login

## 🚀 Production Deployment

For production deployment, see **DEPLOYMENT-GUIDE.md**.

Key steps:
1. Set up monitoring (Sentry, Datadog)
2. Configure rate limiting
3. Add HTTPS/TLS
4. Set up auto-scaling
5. Configure backups

## 💡 Usage Examples

### Use as OpenAI Client

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'http://localhost:8080/v1',
  apiKey: 'test-key-123'
});

const response = await client.chat.completions.create({
  model: 'web2api-vision',
  messages: [{
    role: 'user',
    content: 'Login to K2Think.ai and list my projects'
  }]
});

console.log(response.choices[0].message.content);
```

### Direct Strategy Usage

```typescript
import { StrategyOrchestrator, VisionModelStrategy } from '@memberjunction/webchat2api';

const orchestrator = new StrategyOrchestrator();
orchestrator.registerStrategy(new VisionModelStrategy());

await orchestrator.initialize(page, { apiKeys: { ... } });

const elements = await orchestrator.identifyElements({
  url: page.url(),
  intent: 'Find the submit button'
});

await orchestrator.executeAction(elements[0], {
  type: 'click',
  element: elements[0]
});
```

---

**You're all set!** 🎉

The Web2API system is now running and verified with K2Think.ai.
