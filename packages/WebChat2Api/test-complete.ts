/**
 * Comprehensive Test Suite for WebChat2Api
 * 
 * Tests all functionality:
 * - Server health and initialization
 * - Provider management
 * - OpenAI-compatible API endpoints
 * - Vision model integration
 * - Real browser automation
 * - Error handling
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  response?: any;
}

class ComprehensiveTest {
  private results: TestResult[] = [];
  private startTime: number = 0;

  log(message: string, color: keyof typeof colors = 'reset'): void {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  async runAllTests(): Promise<void> {
    this.log('\n' + '='.repeat(70), 'cyan');
    this.log('🧪 WebChat2Api Comprehensive Test Suite', 'cyan');
    this.log('='.repeat(70) + '\n', 'cyan');

    this.startTime = Date.now();

    // Run tests
    await this.testHealthCheck();
    await this.testListModels();
    await this.testListProviders();
    await this.testChatCompletion();
    await this.testVisionIntegration();
    await this.testErrorHandling();

    // Summary
    this.printSummary();
  }

  private async runTest(
    name: string,
    testFn: () => Promise<any>
  ): Promise<void> {
    this.log(`\n📋 Test: ${name}`, 'blue');
    this.log('-'.repeat(70), 'blue');

    const start = Date.now();
    try {
      const response = await testFn();
      const duration = Date.now() - start;

      this.results.push({
        name,
        passed: true,
        duration,
        response
      });

      this.log(`✅ PASSED (${duration}ms)`, 'green');
      if (response) {
        this.log(`Response: ${JSON.stringify(response, null, 2).substring(0, 200)}...`, 'reset');
      }
    } catch (error: any) {
      const duration = Date.now() - start;
      
      this.results.push({
        name,
        passed: false,
        duration,
        error: error.message
      });

      this.log(`❌ FAILED (${duration}ms)`, 'red');
      this.log(`Error: ${error.message}`, 'red');
    }
  }

  async testHealthCheck(): Promise<void> {
    await this.runTest('Health Check Endpoint', async () => {
      const response = await axios.get(`${BASE_URL}/health`);
      
      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      if (!response.data.status || response.data.status !== 'ok') {
        throw new Error('Health check failed');
      }

      return response.data;
    });
  }

  async testListModels(): Promise<void> {
    await this.runTest('List Models (OpenAI-compatible)', async () => {
      const response = await axios.get(`${BASE_URL}/v1/models`);
      
      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      if (!response.data.object || response.data.object !== 'list') {
        throw new Error('Invalid response format');
      }

      if (!Array.isArray(response.data.data)) {
        throw new Error('Expected data to be an array');
      }

      return {
        modelCount: response.data.data.length,
        models: response.data.data.map((m: any) => m.id)
      };
    });
  }

  async testListProviders(): Promise<void> {
    await this.runTest('List Providers', async () => {
      const response = await axios.get(`${BASE_URL}/api/providers`);
      
      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      if (!Array.isArray(response.data)) {
        throw new Error('Expected array response');
      }

      return {
        providerCount: response.data.length,
        providers: response.data.map((p: any) => ({
          id: p.id,
          name: p.name,
          enabled: p.enabled
        }))
      };
    });
  }

  async testChatCompletion(): Promise<void> {
    await this.runTest('Chat Completion with Real Automation', async () => {
      this.log('⏳ This test will take ~15-30 seconds (real browser automation)...', 'yellow');
      
      const response = await axios.post(
        `${BASE_URL}/v1/chat/completions`,
        {
          model: 'k2think-default',
          messages: [
            {
              role: 'user',
              content: 'Hello! What is 2+2? Please answer briefly.'
            }
          ]
        },
        {
          timeout: 60000 // 60 second timeout for automation
        }
      );

      if (response.status !== 200) {
        throw new Error(`Expected status 200, got ${response.status}`);
      }

      const data = response.data;

      // Validate OpenAI-compatible format
      if (!data.id || !data.object || !data.choices) {
        throw new Error('Invalid OpenAI response format');
      }

      if (data.object !== 'chat.completion') {
        throw new Error('Invalid object type');
      }

      if (!Array.isArray(data.choices) || data.choices.length === 0) {
        throw new Error('No choices in response');
      }

      const message = data.choices[0].message;
      if (!message || !message.content) {
        throw new Error('No message content');
      }

      return {
        responseLength: message.content.length,
        finishReason: data.choices[0].finish_reason,
        usage: data.usage,
        preview: message.content.substring(0, 150)
      };
    });
  }

  async testVisionIntegration(): Promise<void> {
    await this.runTest('Vision Model Integration Check', async () => {
      const health = await axios.get(`${BASE_URL}/health`);
      
      if (!health.data.visionModel) {
        throw new Error('Vision model not configured');
      }

      return {
        visionModel: health.data.visionModel,
        configured: true
      };
    });
  }

  async testErrorHandling(): Promise<void> {
    await this.runTest('Error Handling - Invalid Model', async () => {
      try {
        await axios.post(`${BASE_URL}/v1/chat/completions`, {
          model: 'non-existent-model',
          messages: [{ role: 'user', content: 'test' }]
        });
        throw new Error('Should have thrown 404 error');
      } catch (error: any) {
        if (error.response && error.response.status === 404) {
          return { errorHandled: true, status: 404 };
        }
        throw error;
      }
    });

    await this.runTest('Error Handling - Missing Messages', async () => {
      try {
        await axios.post(`${BASE_URL}/v1/chat/completions`, {
          model: 'k2think-default'
          // Missing messages
        });
        throw new Error('Should have thrown 400 error');
      } catch (error: any) {
        if (error.response && error.response.status === 400) {
          return { errorHandled: true, status: 400 };
        }
        throw error;
      }
    });
  }

  private printSummary(): void {
    const totalDuration = Date.now() - this.startTime;
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;

    this.log('\n' + '='.repeat(70), 'cyan');
    this.log('📊 Test Summary', 'cyan');
    this.log('='.repeat(70), 'cyan');

    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const color = result.passed ? 'green' : 'red';
      this.log(
        `${status} ${result.name} (${result.duration}ms)`,
        color
      );
      if (result.error) {
        this.log(`   Error: ${result.error}`, 'red');
      }
    });

    this.log('\n' + '-'.repeat(70), 'cyan');
    this.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`, 'cyan');
    this.log(`Duration: ${(totalDuration / 1000).toFixed(2)}s`, 'cyan');
    this.log('='.repeat(70) + '\n', 'cyan');

    if (failed === 0) {
      this.log('🎉 All tests passed!', 'green');
    } else {
      this.log(`⚠️  ${failed} test(s) failed`, 'red');
    }

    // Save results
    this.saveResults();
  }

  private saveResults(): void {
    const reportPath = path.join(__dirname, '../test-results.json');
    const report = {
      timestamp: new Date().toISOString(),
      totalDuration: Date.now() - this.startTime,
      results: this.results,
      summary: {
        total: this.results.length,
        passed: this.results.filter(r => r.passed).length,
        failed: this.results.filter(r => !r.passed).length
      }
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    this.log(`\n📄 Test report saved to: ${reportPath}`, 'blue');
  }
}

// Run tests
const tester = new ComprehensiveTest();
tester.runAllTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
