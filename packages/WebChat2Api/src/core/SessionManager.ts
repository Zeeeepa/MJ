import { Pool, PoolConfig, PoolClient } from 'pg';

/**
 * Interface for service session data
 */
export interface ServiceSession {
  id: string;
  serviceName: string;
  cookiesJson: string;
  contextData: string;
  createdAt: Date;
  updatedAt: Date;
  lastActivity: Date;
}

/**
 * Interface for session cookies
 */
export interface SessionCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * Interface for browser context data
 */
export interface BrowserContextData {
  userAgent?: string;
  viewport?: {
    width: number;
    height: number;
  };
  locale?: string;
  timezone?: string;
  geolocation?: {
    latitude: number;
    longitude: number;
  };
  permissions?: string[];
  extraHTTPHeaders?: Record<string, string>;
}

/**
 * Configuration options for SessionManager
 */
export interface SessionManagerConfig {
  connectionString?: string;
  poolConfig?: PoolConfig;
  autoCreateTables?: boolean;
  defaultIdleTimeout?: number; // minutes
}

/**
 * SessionManager handles persistence of browser sessions, cookies, and context data
 * using PostgreSQL for reliable storage and recovery of authentication state.
 */
export class SessionManager {
  private readonly pool: Pool;
  private readonly autoCreateTables: boolean;
  private readonly defaultIdleTimeout: number;
  private initialized = false;

  constructor(config: SessionManagerConfig = {}) {
    const {
      connectionString = process.env.DATABASE_URL || process.env.POSTGRES_CONNECTION_STRING,
      poolConfig = {},
      autoCreateTables = true,
      defaultIdleTimeout = 60
    } = config;

    if (!connectionString) {
      throw new Error('PostgreSQL connection string is required. Set DATABASE_URL or POSTGRES_CONNECTION_STRING environment variable or provide connectionString in config.');
    }

    // Default pool configuration with reasonable defaults
    const defaultPoolConfig: PoolConfig = {
      connectionString,
      max: 20,
      min: 2,
      idleTimeoutMillis: 30000,
      acquireTimeoutMillis: 30000,
      ...poolConfig
    };

    this.pool = new Pool(defaultPoolConfig);
    this.autoCreateTables = autoCreateTables;
    this.defaultIdleTimeout = defaultIdleTimeout;

    // Handle pool errors
    this.pool.on('error', (err: Error) => {
      console.error('PostgreSQL pool error:', err);
    });
  }

  /**
   * Initialize the SessionManager and create tables if needed
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.autoCreateTables) {
      await this.createTablesIfNotExist();
    }

    this.initialized = true;
  }

  /**
   * Create the sessions table if it doesn't exist
   */
  private async createTablesIfNotExist(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          service_name VARCHAR(255) UNIQUE NOT NULL,
          cookies_json TEXT,
          context_data TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create index for efficient lookups
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_sessions_service_name 
        ON sessions(service_name)
      `);

      // Create index for cleanup operations
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_sessions_last_activity 
        ON sessions(last_activity)
      `);

      // Create trigger to update updated_at timestamp
      await client.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$ language 'plpgsql'
      `);

      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_sessions_updated_at') THEN
            CREATE TRIGGER update_sessions_updated_at 
            BEFORE UPDATE ON sessions 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
          END IF;
        END
        $$
      `);

    } catch (error) {
      throw new Error(`Failed to create sessions table: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      client.release();
    }
  }

  /**
   * Save or update a session for a specific service
   */
  public async saveSession(
    serviceName: string, 
    cookies: SessionCookie[], 
    contextData: BrowserContextData
  ): Promise<ServiceSession> {
    await this.ensureInitialized();

    const cookiesJson = JSON.stringify(cookies);
    const contextDataJson = JSON.stringify(contextData);
    const now = new Date();

    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        INSERT INTO sessions (service_name, cookies_json, context_data, last_activity)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (service_name) 
        DO UPDATE SET 
          cookies_json = EXCLUDED.cookies_json,
          context_data = EXCLUDED.context_data,
          last_activity = EXCLUDED.last_activity,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [serviceName, cookiesJson, contextDataJson, now]);

      return this.mapRowToSession(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to save session for service '${serviceName}': ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      client.release();
    }
  }

  /**
   * Load a session for a specific service
   */
  public async loadSession(serviceName: string): Promise<ServiceSession | null> {
    await this.ensureInitialized();

    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM sessions WHERE service_name = $1',
        [serviceName]
      );

      if (result.rows.length === 0) {
        return null;
      }

      // Update last activity
      await client.query(
        'UPDATE sessions SET last_activity = CURRENT_TIMESTAMP WHERE service_name = $1',
        [serviceName]
      );

      return this.mapRowToSession(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to load session for service '${serviceName}': ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      client.release();
    }
  }

  /**
   * Delete a session for a specific service
   */
  public async deleteSession(serviceName: string): Promise<boolean> {
    await this.ensureInitialized();

    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'DELETE FROM sessions WHERE service_name = $1',
        [serviceName]
      );

      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      throw new Error(`Failed to delete session for service '${serviceName}': ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      client.release();
    }
  }

  /**
   * Clean up idle sessions that haven't been active for the specified time
   */
  public async cleanupIdleSessions(maxIdleMinutes?: number): Promise<number> {
    await this.ensureInitialized();

    const idleMinutes = maxIdleMinutes ?? this.defaultIdleTimeout;
    const cutoffTime = new Date(Date.now() - (idleMinutes * 60 * 1000));

    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'DELETE FROM sessions WHERE last_activity < $1',
        [cutoffTime]
      );

      return result.rowCount ?? 0;
    } catch (error) {
      throw new Error(`Failed to cleanup idle sessions: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      client.release();
    }
  }

  /**
   * List all active sessions
   */
  public async listActiveSessions(): Promise<ServiceSession[]> {
    await this.ensureInitialized();

    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT * FROM sessions 
        ORDER BY last_activity DESC
      `);

      return result.rows.map(row => this.mapRowToSession(row));
    } catch (error) {
      throw new Error(`Failed to list active sessions: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      client.release();
    }
  }

  /**
   * Get session cookies for a specific service
   */
  public async getSessionCookies(serviceName: string): Promise<SessionCookie[]> {
    const session = await this.loadSession(serviceName);
    if (!session || !session.cookiesJson) {
      return [];
    }

    try {
      return JSON.parse(session.cookiesJson) as SessionCookie[];
    } catch (error) {
      throw new Error(`Failed to parse cookies for service '${serviceName}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get context data for a specific service
   */
  public async getContextData(serviceName: string): Promise<BrowserContextData | null> {
    const session = await this.loadSession(serviceName);
    if (!session || !session.contextData) {
      return null;
    }

    try {
      return JSON.parse(session.contextData) as BrowserContextData;
    } catch (error) {
      throw new Error(`Failed to parse context data for service '${serviceName}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update last activity timestamp for a session
   */
  public async updateLastActivity(serviceName: string): Promise<void> {
    await this.ensureInitialized();

    const client = await this.pool.connect();
    try {
      await client.query(
        'UPDATE sessions SET last_activity = CURRENT_TIMESTAMP WHERE service_name = $1',
        [serviceName]
      );
    } catch (error) {
      throw new Error(`Failed to update last activity for service '${serviceName}': ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      client.release();
    }
  }

  /**
   * Check if a session exists for a service
   */
  public async sessionExists(serviceName: string): Promise<boolean> {
    await this.ensureInitialized();

    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT 1 FROM sessions WHERE service_name = $1',
        [serviceName]
      );

      return result.rows.length > 0;
    } catch (error) {
      throw new Error(`Failed to check session existence for service '${serviceName}': ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      client.release();
    }
  }

  /**
   * Get session statistics
   */
  public async getSessionStats(): Promise<{
    totalSessions: number;
    activeSessions: number; // active in last hour
    oldestSession?: Date;
    newestSession?: Date;
  }> {
    await this.ensureInitialized();

    const client = await this.pool.connect();
    try {
      const statsResult = await client.query(`
        SELECT 
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN last_activity > NOW() - INTERVAL '1 hour' THEN 1 END) as active_sessions,
          MIN(created_at) as oldest_session,
          MAX(created_at) as newest_session
        FROM sessions
      `);

      const row = statsResult.rows[0];
      return {
        totalSessions: parseInt(row.total_sessions, 10),
        activeSessions: parseInt(row.active_sessions, 10),
        oldestSession: row.oldest_session ? new Date(row.oldest_session) : undefined,
        newestSession: row.newest_session ? new Date(row.newest_session) : undefined
      };
    } catch (error) {
      throw new Error(`Failed to get session statistics: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      client.release();
    }
  }

  /**
   * Close the connection pool
   */
  public async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Helper method to ensure the manager is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Map database row to ServiceSession interface
   */
  private mapRowToSession(row: Record<string, unknown>): ServiceSession {
    return {
      id: String(row.id),
      serviceName: String(row.service_name),
      cookiesJson: String(row.cookies_json || ''),
      contextData: String(row.context_data || ''),
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      lastActivity: new Date(row.last_activity as string)
    };
  }

  /**
   * Test database connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  /**
   * Get connection pool information
   */
  public getPoolInfo(): {
    totalConnections: number;
    idleConnections: number;
    waitingClients: number;
  } {
    return {
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingClients: this.pool.waitingCount
    };
  }
}

/**
 * Default singleton instance for convenience
 */
let defaultSessionManager: SessionManager | null = null;

/**
 * Get the default SessionManager instance
 */
export function getSessionManager(config?: SessionManagerConfig): SessionManager {
  if (!defaultSessionManager) {
    defaultSessionManager = new SessionManager(config);
  }
  return defaultSessionManager;
}

/**
 * Reset the default SessionManager instance (useful for testing)
 */
export function resetSessionManager(): void {
  if (defaultSessionManager) {
    defaultSessionManager.close().catch(console.error);
    defaultSessionManager = null;
  }
}