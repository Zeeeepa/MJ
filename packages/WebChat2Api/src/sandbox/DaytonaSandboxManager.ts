/**
 * Daytona Sandbox Manager
 * 
 * Manages on-demand browser automation sandboxes using Daytona infrastructure.
 * Provides isolation, scaling, and resource management for Web2API operations.
 */

import { Daytona, Sandbox, CreateSandboxBaseParams } from '@daytonaio/sdk';
import { daytona as computeDaytona } from '@computesdk/daytona';
import { Page, Browser } from 'playwright';

export interface SandboxConfig {
    apiKey?: string;
    apiUrl?: string;
    timeout?: number;
    resources?: {
        cpu?: number;
        memory?: string;
        storage?: string;
    };
    maxConcurrent?: number;
}

export interface SandboxInfo {
    id: string;
    status: 'creating' | 'active' | 'stopping' | 'stopped' | 'error';
    createdAt: Date;
    browser?: Browser;
    page?: Page;
    lastActivity: Date;
    uses: number;
}

/**
 * Manages Daytona sandboxes for browser automation with on-demand scaling
 */
export class DaytonaSandboxManager {
    private daytona: Daytona;
    private computeSDK: ReturnType<typeof computeDaytona>;
    private sandboxes: Map<string, SandboxInfo> = new Map();
    private config: Required<SandboxConfig>;
    private cleanupInterval?: NodeJS.Timeout;

    constructor(config: SandboxConfig = {}) {
        this.config = {
            apiKey: config.apiKey || process.env.DAYTONA_API_KEY || '',
            apiUrl: config.apiUrl || process.env.DAYTONA_API_URL || 'https://app.daytona.io/api',
            timeout: config.timeout || 300000, // 5 minutes default
            resources: config.resources || {
                cpu: 2,
                memory: '4Gi',
                storage: '10Gi'
            },
            maxConcurrent: config.maxConcurrent || 10
        };

        if (!this.config.apiKey) {
            throw new Error('Daytona API key is required. Set DAYTONA_API_KEY environment variable.');
        }

        // Initialize Daytona SDK
        this.daytona = new Daytona({
            apiKey: this.config.apiKey,
            apiUrl: this.config.apiUrl
        });

        // Initialize ComputeSDK for code execution capabilities
        this.computeSDK = computeDaytona({
            apiKey: this.config.apiKey
        });

        // Start cleanup interval (check every 60 seconds)
        this.startCleanupInterval();
    }

    /**
     * Create a new sandbox with browser automation capabilities
     */
    async createSandbox(): Promise<SandboxInfo> {
        // Check concurrent limit
        const activeSandboxes = Array.from(this.sandboxes.values())
            .filter(s => s.status === 'active' || s.status === 'creating');
        
        if (activeSandboxes.length >= this.config.maxConcurrent) {
            throw new Error(`Maximum concurrent sandboxes (${this.config.maxConcurrent}) reached`);
        }

        const sandboxId = `web2api-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        
        const sandboxInfo: SandboxInfo = {
            id: sandboxId,
            status: 'creating',
            createdAt: new Date(),
            lastActivity: new Date(),
            uses: 0
        };

        this.sandboxes.set(sandboxId, sandboxInfo);

        try {
            // Create Daytona sandbox with browser support
            const params: CreateSandboxBaseParams = {
                image: 'mcr.microsoft.com/playwright:v1.57.0-focal', // Playwright image with browsers
                timeout: this.config.timeout,
                resources: {
                    cpu: this.config.resources.cpu.toString(),
                    memory: this.config.resources.memory
                }
            };

            const sandbox = await this.daytona.sandboxes.create(params);
            
            // Install required dependencies in sandbox
            await this.setupSandbox(sandbox);

            sandboxInfo.status = 'active';
            sandboxInfo.lastActivity = new Date();

            return sandboxInfo;
        } catch (error) {
            sandboxInfo.status = 'error';
            throw new Error(`Failed to create sandbox: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Setup sandbox with required dependencies
     */
    private async setupSandbox(sandbox: Sandbox): Promise<void> {
        // Install Node.js dependencies needed for browser automation
        const setupScript = `
#!/bin/bash
set -e

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# Install npm packages
npm install -g playwright@1.57.0

# Install Playwright browsers
npx playwright install chromium --with-deps

echo "Sandbox setup complete"
`;

        await sandbox.filesystem.writeFile('/tmp/setup.sh', setupScript);
        const result = await sandbox.process.start({
            cmd: 'bash /tmp/setup.sh'
        });

        // Wait for setup to complete
        await result.wait();

        if (result.exitCode !== 0) {
            throw new Error(`Sandbox setup failed: ${result.stderr}`);
        }
    }

    /**
     * Get or create a sandbox
     */
    async getOrCreateSandbox(reuse: boolean = true): Promise<SandboxInfo> {
        if (reuse) {
            // Try to reuse an existing active sandbox
            const available = Array.from(this.sandboxes.values())
                .find(s => s.status === 'active');
            
            if (available) {
                available.lastActivity = new Date();
                available.uses++;
                return available;
            }
        }

        return this.createSandbox();
    }

    /**
     * Execute browser automation code in a sandbox
     */
    async executeBrowserCode(sandboxId: string, code: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
        const sandboxInfo = this.sandboxes.get(sandboxId);
        if (!sandboxInfo) {
            throw new Error(`Sandbox ${sandboxId} not found`);
        }

        if (sandboxInfo.status !== 'active') {
            throw new Error(`Sandbox ${sandboxId} is not active (status: ${sandboxInfo.status})`);
        }

        try {
            // Use ComputeSDK to execute code
            const computeSandbox = await this.computeSDK.sandbox.create();
            const result = await computeSandbox.runCode(code, 'node');
            await computeSandbox.destroy();

            sandboxInfo.lastActivity = new Date();
            sandboxInfo.uses++;

            return {
                stdout: result.stdout || '',
                stderr: result.stderr || '',
                exitCode: result.error ? 1 : 0
            };
        } catch (error) {
            return {
                stdout: '',
                stderr: error instanceof Error ? error.message : 'Unknown error',
                exitCode: 1
            };
        }
    }

    /**
     * Stop and remove a sandbox
     */
    async destroySandbox(sandboxId: string): Promise<void> {
        const sandboxInfo = this.sandboxes.get(sandboxId);
        if (!sandboxInfo) {
            return; // Already removed
        }

        try {
            sandboxInfo.status = 'stopping';
            
            // Close browser if open
            if (sandboxInfo.browser) {
                await sandboxInfo.browser.close();
            }

            // Note: Daytona SDK automatically manages sandbox lifecycle
            // Sandboxes are destroyed when no longer referenced

            sandboxInfo.status = 'stopped';
            this.sandboxes.delete(sandboxId);
        } catch (error) {
            console.error(`Error destroying sandbox ${sandboxId}:`, error);
            sandboxInfo.status = 'error';
        }
    }

    /**
     * Get sandbox information
     */
    getSandbox(sandboxId: string): SandboxInfo | undefined {
        return this.sandboxes.get(sandboxId);
    }

    /**
     * List all sandboxes
     */
    listSandboxes(): SandboxInfo[] {
        return Array.from(this.sandboxes.values());
    }

    /**
     * Get sandbox statistics
     */
    getStats(): {
        total: number;
        active: number;
        creating: number;
        stopped: number;
        error: number;
        totalUses: number;
    } {
        const sandboxes = this.listSandboxes();
        return {
            total: sandboxes.length,
            active: sandboxes.filter(s => s.status === 'active').length,
            creating: sandboxes.filter(s => s.status === 'creating').length,
            stopped: sandboxes.filter(s => s.status === 'stopped').length,
            error: sandboxes.filter(s => s.status === 'error').length,
            totalUses: sandboxes.reduce((sum, s) => sum + s.uses, 0)
        };
    }

    /**
     * Start cleanup interval to remove idle sandboxes
     */
    private startCleanupInterval(): void {
        this.cleanupInterval = setInterval(() => {
            this.cleanupIdleSandboxes();
        }, 60000); // Every minute
    }

    /**
     * Cleanup sandboxes that have been idle for too long
     */
    private async cleanupIdleSandboxes(): Promise<void> {
        const maxIdleTime = 10 * 60 * 1000; // 10 minutes
        const now = Date.now();

        for (const [sandboxId, info] of this.sandboxes.entries()) {
            if (info.status === 'active') {
                const idleTime = now - info.lastActivity.getTime();
                if (idleTime > maxIdleTime) {
                    console.log(`Cleaning up idle sandbox ${sandboxId} (idle for ${Math.round(idleTime / 1000)}s)`);
                    await this.destroySandbox(sandboxId);
                }
            } else if (info.status === 'error' || info.status === 'stopped') {
                // Remove from tracking
                this.sandboxes.delete(sandboxId);
            }
        }
    }

    /**
     * Cleanup all sandboxes and stop manager
     */
    async cleanup(): Promise<void> {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        const sandboxIds = Array.from(this.sandboxes.keys());
        await Promise.all(sandboxIds.map(id => this.destroySandbox(id)));
        
        this.sandboxes.clear();
    }
}
