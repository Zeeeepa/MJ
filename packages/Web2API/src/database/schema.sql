-- Web2API Database Schema for MemberJunction
-- This schema stores web services, flows, sessions, and health monitoring data

-- Services Table: Stores registered web chat services
CREATE TABLE IF NOT EXISTS Web2API_Services (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    ServiceID NVARCHAR(100) UNIQUE NOT NULL,
    Name NVARCHAR(255) NOT NULL,
    URL NVARCHAR(1000) NOT NULL,
    Status NVARCHAR(50) DEFAULT 'active' CHECK (Status IN ('active', 'inactive', 'error')),
    
    -- Encrypted credentials
    CredentialsEncrypted NVARCHAR(MAX),
    
    -- Configuration
    DefaultModel NVARCHAR(100),
    ModelAliases NVARCHAR(MAX), -- JSON array of aliases
    
    -- Features discovered
    Features NVARCHAR(MAX), -- JSON array
    
    -- Timestamps
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
    LastHealthCheck DATETIME2,
    
    -- Metadata
    Notes NVARCHAR(MAX),
    Enabled BIT DEFAULT 1,
    
    INDEX IX_ServiceID (ServiceID),
    INDEX IX_Status (Status),
    INDEX IX_Enabled (Enabled)
);

-- Flows Table: Stores interaction flows for each service
CREATE TABLE IF NOT EXISTS Web2API_Flows (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    FlowID NVARCHAR(100) UNIQUE NOT NULL,
    ServiceID NVARCHAR(100) NOT NULL,
    Name NVARCHAR(255) NOT NULL,
    Description NVARCHAR(MAX),
    FlowType NVARCHAR(50) CHECK (FlowType IN ('login', 'chat', 'upload', 'settings', 'custom')),
    
    -- Flow definition
    Steps NVARCHAR(MAX), -- JSON array of steps
    Prerequisites NVARCHAR(MAX), -- JSON array
    ExpectedOutcome NVARCHAR(MAX), -- JSON object
    
    -- Validation
    LastValidated DATETIME2,
    ValidationStatus NVARCHAR(50) CHECK (ValidationStatus IN ('valid', 'invalid', 'unknown')),
    ValidationErrors NVARCHAR(MAX), -- JSON array
    
    -- Performance
    AverageExecutionTime INT, -- milliseconds
    SuccessRate DECIMAL(5,2), -- percentage
    ExecutionCount INT DEFAULT 0,
    
    -- Timestamps
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE(),
    
    -- Metadata
    Enabled BIT DEFAULT 1,
    Priority INT DEFAULT 0,
    
    FOREIGN KEY (ServiceID) REFERENCES Web2API_Services(ServiceID) ON DELETE CASCADE,
    INDEX IX_FlowID (FlowID),
    INDEX IX_ServiceID (ServiceID),
    INDEX IX_FlowType (FlowType),
    INDEX IX_ValidationStatus (ValidationStatus)
);

-- Sessions Table: Stores active browser sessions
CREATE TABLE IF NOT EXISTS Web2API_Sessions (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    SessionID NVARCHAR(100) UNIQUE NOT NULL,
    ServiceID NVARCHAR(100) NOT NULL,
    
    -- Session state
    Status NVARCHAR(50) CHECK (Status IN ('active', 'idle', 'closed', 'error')),
    IsAuthenticated BIT DEFAULT 0,
    
    -- Browser info
    BrowserProfile NVARCHAR(MAX), -- JSON object with fingerprint info
    Cookies NVARCHAR(MAX), -- JSON array
    LocalStorage NVARCHAR(MAX), -- JSON object
    
    -- Timestamps
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    LastActivity DATETIME2 DEFAULT GETUTCDATE(),
    ExpiresAt DATETIME2,
    
    -- Usage stats
    RequestCount INT DEFAULT 0,
    ErrorCount INT DEFAULT 0,
    
    FOREIGN KEY (ServiceID) REFERENCES Web2API_Services(ServiceID) ON DELETE CASCADE,
    INDEX IX_SessionID (SessionID),
    INDEX IX_ServiceID (ServiceID),
    INDEX IX_Status (Status),
    INDEX IX_ExpiresAt (ExpiresAt)
);

-- Health Checks Table: Stores service health monitoring data
CREATE TABLE IF NOT EXISTS Web2API_HealthChecks (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    ServiceID NVARCHAR(100) NOT NULL,
    
    -- Check results
    Status NVARCHAR(50) CHECK (Status IN ('healthy', 'degraded', 'unhealthy')),
    ResponseTime INT, -- milliseconds
    ErrorMessage NVARCHAR(MAX),
    
    -- Validation details
    FlowsValidated INT DEFAULT 0,
    FlowsPassed INT DEFAULT 0,
    FlowsFailed INT DEFAULT 0,
    
    -- Timestamp
    CheckedAt DATETIME2 DEFAULT GETUTCDATE(),
    
    FOREIGN KEY (ServiceID) REFERENCES Web2API_Services(ServiceID) ON DELETE CASCADE,
    INDEX IX_ServiceID (ServiceID),
    INDEX IX_Status (Status),
    INDEX IX_CheckedAt (CheckedAt)
);

-- Request Logs Table: Stores API request history
CREATE TABLE IF NOT EXISTS Web2API_RequestLogs (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    RequestID NVARCHAR(100) UNIQUE NOT NULL,
    SessionID NVARCHAR(100),
    ServiceID NVARCHAR(100) NOT NULL,
    
    -- Request details
    Method NVARCHAR(10),
    Endpoint NVARCHAR(500),
    Model NVARCHAR(100),
    
    -- Request/Response
    RequestBody NVARCHAR(MAX),
    ResponseBody NVARCHAR(MAX),
    StatusCode INT,
    
    -- Performance
    ExecutionTime INT, -- milliseconds
    Success BIT,
    ErrorMessage NVARCHAR(MAX),
    
    -- Tokens (for OpenAI compatibility)
    PromptTokens INT,
    CompletionTokens INT,
    TotalTokens INT,
    
    -- Timestamp
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    
    FOREIGN KEY (ServiceID) REFERENCES Web2API_Services(ServiceID) ON DELETE CASCADE,
    FOREIGN KEY (SessionID) REFERENCES Web2API_Sessions(SessionID) ON DELETE SET NULL,
    INDEX IX_RequestID (RequestID),
    INDEX IX_SessionID (SessionID),
    INDEX IX_ServiceID (ServiceID),
    INDEX IX_CreatedAt (CreatedAt)
);

-- Model Aliases Table: Maps model names to services
CREATE TABLE IF NOT EXISTS Web2API_ModelAliases (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    Alias NVARCHAR(100) UNIQUE NOT NULL,
    ServiceID NVARCHAR(100) NOT NULL,
    TargetModel NVARCHAR(100),
    
    -- Configuration
    DefaultSystemPrompt NVARCHAR(MAX),
    Parameters NVARCHAR(MAX), -- JSON object
    
    -- Metadata
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    Enabled BIT DEFAULT 1,
    
    FOREIGN KEY (ServiceID) REFERENCES Web2API_Services(ServiceID) ON DELETE CASCADE,
    INDEX IX_Alias (Alias),
    INDEX IX_ServiceID (ServiceID),
    INDEX IX_Enabled (Enabled)
);

-- Create views for easy querying
GO

CREATE OR ALTER VIEW Web2API_ServiceHealth AS
SELECT 
    s.ServiceID,
    s.Name,
    s.Status,
    s.Enabled,
    COUNT(DISTINCT f.FlowID) as TotalFlows,
    COUNT(DISTINCT CASE WHEN f.ValidationStatus = 'valid' THEN f.FlowID END) as ValidFlows,
    COUNT(DISTINCT sess.SessionID) as ActiveSessions,
    MAX(h.CheckedAt) as LastHealthCheck,
    MAX(h.Status) as LastHealthStatus
FROM Web2API_Services s
LEFT JOIN Web2API_Flows f ON s.ServiceID = f.ServiceID
LEFT JOIN Web2API_Sessions sess ON s.ServiceID = sess.ServiceID AND sess.Status = 'active'
LEFT JOIN Web2API_HealthChecks h ON s.ServiceID = h.ServiceID
GROUP BY s.ServiceID, s.Name, s.Status, s.Enabled;

GO

CREATE OR ALTER VIEW Web2API_FlowStatistics AS
SELECT 
    f.FlowID,
    f.ServiceID,
    s.Name as ServiceName,
    f.Name as FlowName,
    f.FlowType,
    f.ValidationStatus,
    f.AverageExecutionTime,
    f.SuccessRate,
    f.ExecutionCount,
    f.LastValidated,
    DATEDIFF(HOUR, f.LastValidated, GETUTCDATE()) as HoursSinceValidation
FROM Web2API_Flows f
JOIN Web2API_Services s ON f.ServiceID = s.ServiceID
WHERE f.Enabled = 1;

