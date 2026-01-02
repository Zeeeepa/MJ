const { Stagehand } = require('@browserbasehq/stagehand');
const { Anthropic } = require('@anthropic-ai/sdk');
const EventEmitter = require('events');

/**
 * Stagehand-Powered WebChat2Api - Production-grade web chat to API gateway
 * 
 * Built on top of Stagehand (from PR #5) for:
 * - AI-powered element detection
 * - Multi-model support (Anthropic, OpenAI, Google)
 * - Built-in vision capabilities
 * - Production-tested automation
 * - Error recovery
 * 
 * Additional features:
 * - Load balancing across sessions
 * - Health monitoring
 * - OpenAI-compatible API
 * - Self-healing
 */
class StagehandWebChat2Api extends EventEmitter {
  constructor(config) {
    super();
    this.config = {
      maxSessions: config.maxSessions || 5,
      healthCheckInterval: config.healthCheckInterval || 30000,
      anthropicKey: config.anthropicKey,
      modelName: config.modelName || 'claude-3-5-sonnet-20241022',
      ...config
    };
    
    this.sessions = new Map();
    this.sessionHealth = new Map();
    this.roundRobinIndex = 0;
    this.healthCheckTimer = null;
  }

  async start() {
    console.log('🚀 Starting Stagehand-Powered WebChat2Api Gateway...');
    console.log(`   Using Stagehand v2.5.6 with AI-powered automation`);
    
    this.startHealthMonitoring();
    
    console.log(`✅ Gateway started`);
    console.log(`   Max sessions: ${this.config.maxSessions}`);
    console.log(`   Model: ${this.config.modelName}`);
    
    this.emit('started');
  }

  /**
   * Add provider with Stagehand automation
   */
  async addProvider(provider) {
    const { id, url, email, password, name } = provider;
    
    console.log(`\n📝 Adding provider: ${name || id}`);
    console.log(`   URL: ${url}`);
    console.log(`   Using Stagehand for AI-powered automation`);
    
    try {
      // Create Stagehand instance
      const stagehand = new Stagehand({
        env: 'LOCAL',
        apiKey: this.config.anthropicKey,
        modelName: this.config.modelName,
        enableCaching: true,
        headless: true
      });
      
      await stagehand.init();
      console.log(`  ✅ Stagehand initialized`);
      
      const session = {
        id,
        url,
        email,
        password,
        stagehand,
        page: stagehand.page,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        requestCount: 0,
        errorCount: 0,
        actionLog: []
      };
      
      this.sessions.set(id, session);
      this.sessionHealth.set(id, {
        status: 'healthy',
        lastCheck: Date.now(),
        consecutiveFailures: 0
      });
      
      // Navigate and login
      await this.loginWithStagehand(session, url, email, password);
      
      console.log(`✅ Provider ${id} ready\n`);
      this.emit('providerAdded', { id, session });
      
      return { success: true, sessionId: id };
      
    } catch (error) {
      console.error(`❌ Failed to add provider ${id}:`, error.message);
      this.emit('providerError', { id, error });
      throw error;
    }
  }

  /**
   * Login using Stagehand's AI-powered automation
   */
  async loginWithStagehand(session, url, email, password) {
    const { stagehand, page } = session;
    
    console.log(`  🌐 Navigating to ${url}...`);
    this.log(session, 'Navigate', 'START', { url });
    
    try {
      // Navigate
      await page.goto(url);
      await page.waitForLoadState('domcontentloaded');
      this.log(session, 'Navigate', 'SUCCESS', { url });
      
      // Stagehand AI action: Find and click login
      console.log(`  🤖 AI: Finding login button...`);
      await stagehand.act({
        action: 'click on the login button'
      });
      this.log(session, 'AI Click Login', 'SUCCESS');
      console.log(`  ✅ Login button clicked`);
      
      await page.waitForTimeout(1000);
      
      // Stagehand AI action: Fill email
      console.log(`  🤖 AI: Filling email field...`);
      await stagehand.act({
        action: `type "${email}" into the email input field`
      });
      this.log(session, 'AI Fill Email', 'SUCCESS');
      console.log(`  ✅ Email filled`);
      
      // Stagehand AI action: Fill password
      console.log(`  🤖 AI: Filling password field...`);
      await stagehand.act({
        action: `type "${password}" into the password input field`
      });
      this.log(session, 'AI Fill Password', 'SUCCESS');
      console.log(`  ✅ Password filled`);
      
      // Stagehand AI action: Submit
      console.log(`  🤖 AI: Submitting form...`);
      await stagehand.act({
        action: 'click on the sign in or submit button'
      });
      this.log(session, 'AI Submit', 'SUCCESS');
      console.log(`  ✅ Form submitted`);
      
      await page.waitForLoadState('networkidle', { timeout: 15000 });
      
      // Verify success
      console.log(`  🎯 Verifying login...`);
      const isLoggedIn = await stagehand.extract({
        instruction: 'Check if the user is logged in. Return true if logged in, false otherwise.',
        schema: {
          type: 'object',
          properties: {
            logged_in: { type: 'boolean' },
            reason: { type: 'string' }
          }
        }
      });
      
      if (isLoggedIn.logged_in) {
        console.log(`  🎉 Login successful! ${isLoggedIn.reason}`);
        this.log(session, 'Login', 'SUCCESS', { verified: true });
      } else {
        throw new Error(`Login verification failed: ${isLoggedIn.reason}`);
      }
      
    } catch (error) {
      console.error(`  ❌ Login failed:`, error.message);
      this.log(session, 'Login', 'FAILED', { error: error.message });
      session.errorCount++;
      throw error;
    }
  }

  /**
   * Send message using Stagehand AI
   */
  async sendMessage(message, options = {}) {
    const session = this.getHealthySession();
    if (!session) {
      throw new Error('No healthy sessions available');
    }
    
    console.log(`\n💬 Sending message via session ${session.id}...`);
    session.lastUsed = Date.now();
    session.requestCount++;
    
    try {
      const { stagehand } = session;
      
      // Use Stagehand AI to send message
      await stagehand.act({
        action: `type "${message}" into the chat input and send it`
      });
      
      this.log(session, 'Send Message', 'SUCCESS');
      
      // Wait for response
      await session.page.waitForTimeout(2000);
      
      // Extract response using Stagehand AI
      const response = await stagehand.extract({
        instruction: 'Extract the last message from the assistant/bot',
        schema: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        }
      });
      
      console.log(`✅ Response received`);
      
      return {
        success: true,
        response: response.message,
        sessionId: session.id
      };
      
    } catch (error) {
      console.error(`❌ Send message failed:`, error.message);
      session.errorCount++;
      this.log(session, 'Send Message', 'FAILED', { error: error.message });
      
      // Try self-healing
      await this.healSession(session);
      
      throw error;
    }
  }

  /**
   * Get healthy session (load balancing)
   */
  getHealthySession() {
    const healthySessions = Array.from(this.sessions.values())
      .filter(s => this.sessionHealth.get(s.id)?.status === 'healthy');
    
    if (healthySessions.length === 0) {
      return null;
    }
    
    // Round-robin
    const session = healthySessions[this.roundRobinIndex % healthySessions.length];
    this.roundRobinIndex++;
    
    return session;
  }

  /**
   * Health monitoring
   */
  startHealthMonitoring() {
    this.healthCheckTimer = setInterval(async () => {
      console.log('\n🏥 Health check...');
      
      for (const [id, session] of this.sessions) {
        try {
          const isHealthy = await this.checkHealth(session);
          const health = this.sessionHealth.get(id);
          
          if (isHealthy) {
            health.status = 'healthy';
            health.consecutiveFailures = 0;
            console.log(`  ✅ ${id}: healthy`);
          } else {
            health.consecutiveFailures++;
            console.log(`  ⚠️  ${id}: unhealthy (${health.consecutiveFailures} failures)`);
            
            if (health.consecutiveFailures >= 3) {
              await this.healSession(session);
            }
          }
          
          health.lastCheck = Date.now();
        } catch (error) {
          console.error(`  ❌ Health check failed for ${id}`);
        }
      }
    }, this.config.healthCheckInterval);
  }

  async checkHealth(session) {
    try {
      const { page } = session;
      await page.title();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Self-healing
   */
  async healSession(session) {
    console.log(`\n🔧 Healing session ${session.id}...`);
    
    try {
      await this.loginWithStagehand(
        session,
        session.url,
        session.email,
        session.password
      );
      
      const health = this.sessionHealth.get(session.id);
      health.status = 'healthy';
      health.consecutiveFailures = 0;
      
      console.log(`✅ Session ${session.id} healed`);
      this.emit('sessionHealed', { sessionId: session.id });
      
    } catch (error) {
      console.error(`❌ Healing failed: ${error.message}`);
      
      const health = this.sessionHealth.get(session.id);
      health.status = 'failed';
      
      this.emit('sessionFailed', { sessionId: session.id, error });
    }
  }

  log(session, action, status, details = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      sessionId: session.id,
      action,
      status,
      ...details
    };
    session.actionLog.push(entry);
  }

  getStats() {
    const stats = {
      totalSessions: this.sessions.size,
      healthySessions: 0,
      unhealthySessions: 0,
      totalRequests: 0,
      totalErrors: 0,
      sessions: []
    };
    
    for (const [id, session] of this.sessions) {
      const health = this.sessionHealth.get(id);
      
      if (health.status === 'healthy') {
        stats.healthySessions++;
      } else {
        stats.unhealthySessions++;
      }
      
      stats.totalRequests += session.requestCount;
      stats.totalErrors += session.errorCount;
      
      stats.sessions.push({
        id,
        status: health.status,
        requestCount: session.requestCount,
        errorCount: session.errorCount,
        uptime: Date.now() - session.createdAt
      });
    }
    
    return stats;
  }

  async shutdown() {
    console.log('\n🛑 Shutting down...');
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    for (const [id, session] of this.sessions) {
      try {
        await session.stagehand.close();
        console.log(`  ✅ Session ${id} closed`);
      } catch (e) {
        console.error(`  ❌ Error closing ${id}`);
      }
    }
    
    this.sessions.clear();
    console.log('✅ Shutdown complete');
    this.emit('shutdown');
  }
}

module.exports = { StagehandWebChat2Api };

