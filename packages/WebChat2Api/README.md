# WebChat2Api - Convert Web UIs to OpenAI-Compatible APIs

Transform any web chat interface into a standard OpenAI-compatible API endpoint.

## Quick Start

```bash
cd packages/WebChat2Api

# Install dependencies
npm install

# Configure credentials
cp .env.example .env
# Edit .env with your credentials

# Start server
npm run dev
```

## Usage

### Test Health
```bash
curl http://localhost:3000/health
```

### List Models
```bash
curl http://localhost:3000/v1/models
```

### Chat Completion
```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "service-www-k2think-ai",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }'
```

## How It Works

1. **Register Service**: Configure web URL + credentials
2. **Browser Automation**: Uses Playwright to control browser
3. **Auto-Login**: Detects login forms and authenticates
4. **Message Routing**: Finds chat input and sends messages
5. **Response Extraction**: Captures AI responses from page
6. **OpenAI Format**: Returns in OpenAI-compatible JSON

## Features

✅ OpenAI-compatible `/v1/chat/completions` endpoint
✅ Automatic login form detection
✅ Smart chat input/button detection  
✅ Response extraction with multiple strategies
✅ Session management and persistence
✅ Headless browser automation
✅ Works with K2Think AI out of the box

## Configuration

Edit `.env`:

```env
PORT=3000

# K2Think AI (default)
K2THINK_URL=https://www.k2think.ai
K2THINK_EMAIL=your-email@example.com
K2THINK_PASSWORD=your-password

# Add more services as needed
```

## Architecture

```
Client Request
      ↓
Express Server (/v1/chat/completions)
      ↓
ServiceManager (route to service)
      ↓
BrowserAutomation (Playwright)
      ↓
  Login + Send Message
      ↓
Extract Response
      ↓
Format as OpenAI JSON
      ↓
Return to Client
```

## Development

```bash
# Watch mode
npm run dev

# Build
npm run build

# Production
npm start
```

## Testing

```bash
# Install httpie for easier testing
pip install httpie

# Test endpoint
http POST localhost:3000/v1/chat/completions \
  model=service-www-k2think-ai \
  messages:='[{"role":"user","content":"Tell me a joke"}]'
```

## License

MIT

