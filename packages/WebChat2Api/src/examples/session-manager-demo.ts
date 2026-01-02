/**
 * SessionManager Demo
 * 
 * Demonstrates how to use the SessionManager for persisting browser sessions
 */

import { SessionManager, SessionCookie, BrowserContextData } from '../core/SessionManager';

async function demonstrateSessionManager() {
    console.log('🔄 Starting SessionManager demo...');

    // Create a session manager instance
    const sessionManager = new SessionManager({
        // Use environment variable or default to in-memory PostgreSQL for demo
        connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/webchat2api_test',
        autoCreateTables: true,
        defaultIdleTimeout: 30 // 30 minutes
    });

    try {
        // Initialize the session manager
        await sessionManager.initialize();
        console.log('✅ SessionManager initialized');

        // Test connection
        const isConnected = await sessionManager.testConnection();
        console.log(`🔗 Database connection: ${isConnected ? 'SUCCESS' : 'FAILED'}`);

        if (!isConnected) {
            console.log('⚠️  Database connection failed - demo will not work properly');
            return;
        }

        // Sample cookies
        const sampleCookies: SessionCookie[] = [
            {
                name: 'session_id',
                value: 'abc123xyz789',
                domain: '.example.com',
                path: '/',
                httpOnly: true,
                secure: true,
                sameSite: 'Lax'
            },
            {
                name: 'auth_token',
                value: 'bearer_token_here',
                domain: '.example.com',
                path: '/api',
                httpOnly: true,
                secure: true
            }
        ];

        // Sample browser context data
        const contextData: BrowserContextData = {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            viewport: {
                width: 1920,
                height: 1080
            },
            locale: 'en-US',
            timezone: 'America/New_York',
            permissions: ['geolocation', 'notifications']
        };

        // Save a session
        console.log('💾 Saving session for service: chatgpt');
        const savedSession = await sessionManager.saveSession('chatgpt', sampleCookies, contextData);
        console.log(`✅ Saved session with ID: ${savedSession.id}`);

        // Load the session
        console.log('📖 Loading session for service: chatgpt');
        const loadedSession = await sessionManager.loadSession('chatgpt');
        if (loadedSession) {
            console.log(`✅ Loaded session: ${loadedSession.serviceName} (Last activity: ${loadedSession.lastActivity})`);
        }

        // Get session cookies
        const cookies = await sessionManager.getSessionCookies('chatgpt');
        console.log(`🍪 Found ${cookies.length} cookies for chatgpt`);

        // Get context data
        const context = await sessionManager.getContextData('chatgpt');
        console.log(`🖥️  Context viewport: ${context?.viewport?.width}x${context?.viewport?.height}`);

        // Save another service session
        console.log('💾 Saving session for service: claude');
        await sessionManager.saveSession('claude', [
            { name: 'claude_session', value: 'claude123', domain: '.anthropic.com' }
        ], {
            userAgent: 'Mozilla/5.0 (macOS; Intel Mac OS X 10_15_7)',
            viewport: { width: 1440, height: 900 }
        });

        // List all active sessions
        const activeSessions = await sessionManager.listActiveSessions();
        console.log(`📋 Found ${activeSessions.length} active sessions:`);
        for (const session of activeSessions) {
            console.log(`  - ${session.serviceName} (last active: ${session.lastActivity})`);
        }

        // Get session statistics
        const stats = await sessionManager.getSessionStats();
        console.log('📊 Session Statistics:');
        console.log(`  - Total sessions: ${stats.totalSessions}`);
        console.log(`  - Active sessions (last hour): ${stats.activeSessions}`);
        console.log(`  - Oldest session: ${stats.oldestSession}`);
        console.log(`  - Newest session: ${stats.newestSession}`);

        // Get pool information
        const poolInfo = sessionManager.getPoolInfo();
        console.log('🏊 Connection Pool Info:');
        console.log(`  - Total connections: ${poolInfo.totalConnections}`);
        console.log(`  - Idle connections: ${poolInfo.idleConnections}`);
        console.log(`  - Waiting clients: ${poolInfo.waitingClients}`);

        // Test session existence
        const chatgptExists = await sessionManager.sessionExists('chatgpt');
        const nonExistentExists = await sessionManager.sessionExists('nonexistent');
        console.log(`🔍 Session existence check: chatgpt=${chatgptExists}, nonexistent=${nonExistentExists}`);

        // Update last activity
        console.log('⏰ Updating last activity for chatgpt...');
        await sessionManager.updateLastActivity('chatgpt');

        // Clean up old sessions (for demo, we'll use 0 minutes so nothing should be deleted)
        console.log('🧹 Cleaning up idle sessions (0 minutes idle time for demo)...');
        const deletedCount = await sessionManager.cleanupIdleSessions(0);
        console.log(`🗑️  Deleted ${deletedCount} idle sessions`);

        // Delete a specific session
        console.log('🗑️  Deleting claude session...');
        const deleted = await sessionManager.deleteSession('claude');
        console.log(`✅ Claude session deleted: ${deleted}`);

        // Final session count
        const finalSessions = await sessionManager.listActiveSessions();
        console.log(`📋 Final session count: ${finalSessions.length}`);

    } catch (error) {
        console.error('❌ Demo failed:', error);
    } finally {
        // Clean up
        await sessionManager.close();
        console.log('🔚 SessionManager closed');
    }
}

// Run the demo if this file is executed directly
if (require.main === module) {
    demonstrateSessionManager()
        .then(() => {
            console.log('✅ SessionManager demo completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ SessionManager demo failed:', error);
            process.exit(1);
        });
}

export { demonstrateSessionManager };