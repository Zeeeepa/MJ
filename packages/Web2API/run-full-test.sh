#!/bin/bash

# Web2API Full Test Runner
# Starts server and tests all 6 services

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   Web2API - Full System Test                              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "⚠️ Please edit .env with your credentials before running tests"
    exit 1
fi

# Build the project
echo "🔨 Building project..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

# Start server in background
echo "🚀 Starting server..."
PORT=8080 HEADLESS=true node dist/server/index.js > /tmp/web2api-test.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for server to start
echo "⏳ Waiting for server to be ready..."
sleep 15

# Check if server is running
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "❌ Server failed to start. Check logs:"
    cat /tmp/web2api-test.log
    exit 1
fi

# Run tests
echo ""
echo "🧪 Running service tests..."
npm run test-services

TEST_EXIT_CODE=$?

# Cleanup
echo ""
echo "🧹 Cleaning up..."
kill $SERVER_PID 2>/dev/null

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ All tests passed!"
else
    echo "❌ Some tests failed. Check output above."
    echo "📋 Server logs available at: /tmp/web2api-test.log"
fi

exit $TEST_EXIT_CODE

