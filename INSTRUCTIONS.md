# MemberJunction Windows Deployment Guide

> **Complete setup and deployment instructions for Windows environments**

## 📋 Table of Contents

1. [What is MemberJunction?](#what-is-memberjunction)
2. [Architecture Overview](#architecture-overview)
3. [Prerequisites](#prerequisites)
4. [Windows-Specific Setup](#windows-specific-setup)
5. [Installation Steps](#installation-steps)
6. [Configuration Guide](#configuration-guide)
7. [Running the Application](#running-the-application)
8. [Troubleshooting](#troubleshooting)
9. [Package Reference](#package-reference)

---

## What is MemberJunction?

**MemberJunction (MJ)** is an enterprise-grade, open-source, **metadata-driven application development platform** that unifies data management, business logic, and user interfaces through a comprehensive Common Data Platform (CDP).

### Key Capabilities

- **🗄️ Unified Data Platform** - Integrate data from multiple sources into a centralized, well-organized repository
- **📊 Metadata-Driven Architecture** - Auto-generates UIs, APIs, and documentation directly from database metadata
- **🤖 AI Integration** - Built-in support for 15+ AI providers (OpenAI, Anthropic, Google, Mistral, etc.)
- **📨 Communication Framework** - Multi-channel messaging (Email, SMS, WhatsApp) with template support
- **⚡ Actions System** - Flexible framework for implementing custom business logic and workflows
- **🔐 Enterprise Security** - Row-level security, field permissions, Auth0/MSAL integration
- **🛠️ Developer Friendly** - Full TypeScript, comprehensive APIs, extensive documentation
- **📦 Modular Architecture** - 70+ npm packages that can be used independently or together

### Originally Built For

Non-profits and associations, but suitable for any organization that needs a powerful, flexible data management and application development platform.

---

## Architecture Overview

### Technology Stack

**Backend:**
- Node.js 20+ with TypeScript 5.4.5
- GraphQL API (Apollo Server 4.9+)
- SQL Server 2019+ data provider
- JWT authentication (MSAL, Auth0, extensible)

**Frontend:**
- Angular 18.0.2 with Kendo UI components
- Reactive forms and RxJS 7.8+
- MSAL Angular for authentication

**Infrastructure:**
- Monorepo with 100+ TypeScript packages
- Turbo build orchestration
- Flyway database migrations
- pm2 process management (production)

### Runtime Services

1. **MJAPI** (Port 4000) - GraphQL API Server
   - Entity CRUD operations
   - Authentication & authorization
   - AI integration endpoints
   - Action execution

2. **MJExplorer** (Port 4200) - Angular Web Application
   - Entity browsing and management
   - Dashboard system
   - AI chat interface
   - Form builder

3. **Optional Services:**
   - MCP Server (Port 3100) - Model Context Protocol
   - A2A Server (Port 3200) - Agent-to-Agent protocol

### Code Generation Flow

```
Database Schema
      ↓
  MJ Metadata
      ↓
   CodeGen
      ├── TypeScript Entity Classes
      ├── GraphQL Schemas & Resolvers
      ├── Angular Forms & Components
      └── SQL Scripts
```

---

## Prerequisites

### Required Software

#### 1. Node.js 20+ (Recommended: 20.x LTS)
```powershell
# Download from: https://nodejs.org/
# Verify installation:
node -v  # Should show v20.x.x or higher
npm -v   # Should show 9.x.x or higher
```

#### 2. TypeScript (Global Installation)
```powershell
npm install -g typescript
tsc -v  # Should show version 5.x.x
```

#### 3. Angular CLI 18+
```powershell
npm install -g @angular/cli@18
ng version  # Should show Angular CLI: 18.x.x
```

#### 4. SQL Server 2019+ or Azure SQL Database
- **Local SQL Server**: Download from [Microsoft SQL Server Downloads](https://www.microsoft.com/en-us/sql-server/sql-server-downloads)
- **SQL Server Management Studio (SSMS)**: Recommended for database management
- **Azure SQL**: Create database in Azure Portal

**Required Permissions:**
- `db_owner` for CodeGen user (schema modifications)
- `db_datareader`, `db_datawriter` for MJAPI user (runtime operations)

#### 5. Git for Windows
```powershell
# Download from: https://git-scm.com/download/win
git --version  # Verify installation
```

### Recommended Software

- **Visual Studio Code** with extensions:
  - TypeScript and JavaScript Language Features
  - Angular Language Service
  - SQL Server (mssql)
  - Prettier
  - ESLint

- **Windows Terminal** - Better PowerShell/CMD experience
- **Postman** or **Insomnia** - For API testing

### System Requirements

- **OS**: Windows 10/11 (64-bit)
- **RAM**: 8GB minimum (16GB recommended)
- **Disk Space**: 5GB free (including node_modules)
- **CPU**: Multi-core processor recommended for parallel builds

---

## Windows-Specific Setup

### 1. Enable Long Path Support (Critical!)

MemberJunction's deep `node_modules` structure can exceed Windows' default 260-character path limit.

**Option A: Via Group Policy (Recommended)**
```powershell
# Run as Administrator
1. Open: gpedit.msc
2. Navigate to: Computer Configuration > Administrative Templates > System > Filesystem
3. Enable: "Enable Win32 long paths"
4. Restart computer
```

**Option B: Via Registry**
```powershell
# Run PowerShell as Administrator
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" `
  -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

### 2. Configure Windows Firewall

Allow ports for development:

```powershell
# Run as Administrator
New-NetFirewallRule -DisplayName "MJ API Server" -Direction Inbound -LocalPort 4000 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "MJ Explorer UI" -Direction Inbound -LocalPort 4200 -Protocol TCP -Action Allow
```

### 3. Set PowerShell Execution Policy

```powershell
# Run as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 4. SQL Server Configuration

**Enable TCP/IP Protocol:**
```powershell
1. Open SQL Server Configuration Manager
2. SQL Server Network Configuration > Protocols
3. Enable "TCP/IP"
4. Restart SQL Server service
```

**Create Database:**
```sql
CREATE DATABASE MJ_Production
GO

-- Optional: Set recovery model for development
ALTER DATABASE MJ_Production SET RECOVERY SIMPLE
GO
```

**Create Users:**
```sql
-- CodeGen user (needs elevated permissions)
CREATE LOGIN codegen_user WITH PASSWORD = 'YourSecurePassword123!';
CREATE USER codegen_user FOR LOGIN codegen_user;
ALTER ROLE db_owner ADD MEMBER codegen_user;
GO

-- MJAPI runtime user
CREATE LOGIN mjapi_user WITH PASSWORD = 'YourSecurePassword456!';
CREATE USER mjapi_user FOR LOGIN mjapi_user;
ALTER ROLE db_datareader ADD MEMBER mjapi_user;
ALTER ROLE db_datawriter ADD MEMBER mjapi_user;
GO
```

---

## Installation Steps

### Step 1: Clone the Repository

```powershell
# Clone to a path WITHOUT spaces
cd C:\Projects
git clone https://github.com/MemberJunction/MJ.git
cd MJ
```

### Step 2: Configure Installation

Edit `install.config.json`:

```json
{
    "dbUrl": "localhost",
    "dbInstance": "",
    "dbTrustServerCertificate": "Y",
    "dbDatabase": "MJ_Production",
    "dbPort": 1433,
    "codeGenLogin": "codegen_user",
    "codeGenPwD": "YourSecurePassword123!",
    "mjAPILogin": "mjapi_user",
    "mjAPIPwD": "YourSecurePassword456!",
    "graphQLPort": 4000,
    "authType": "MSAL",
    "msalWebClientId": "your-azure-client-id",
    "msalTenantId": "your-azure-tenant-id",
    "auth0ClientId": "",
    "auth0ClientSecret": "",
    "auth0Domain": "",
    "createNewUser": "Y",
    "userEmail": "admin@yourdomain.com",
    "userFirstName": "Admin",
    "userLastName": "User",
    "userName": "admin",
    "openAIAPIKey": "",
    "anthropicAPIKey": "",
    "mistralAPIKey": ""
}
```

**Authentication Setup:**

- **For MSAL (Azure AD):**
  1. Go to Azure Portal > Azure Active Directory > App Registrations
  2. Create new registration
  3. Note the Application (client) ID and Directory (tenant) ID
  4. Add redirect URI: `http://localhost:4200`

- **For Auth0:**
  1. Create Auth0 account at auth0.com
  2. Create new application
  3. Note Domain, Client ID, and Client Secret
  4. Add Allowed Callback URL: `http://localhost:4200/callback`

### Step 3: Run Database Setup

**Option A: Manual SQL Execution (Recommended for first-time setup)**

```powershell
# Open SQL Server Management Studio
# Connect to your SQL Server instance
# Open and execute in this order:

1. SQL Scripts\install\MJ_BASE_Structure.v2_0_x.16_JUL_2024.sql
2. SQL Scripts\install\MJ_BASE_Dataset.v2_0_x.16_JUL_2024.sql
```

This creates the base MemberJunction schema with all core tables, views, and stored procedures.

**Option B: Using InstallMJ.js (Automated)**

The installation script will run these automatically in Step 4.

### Step 4: Run Installation Script

```powershell
# This will:
# 1. Verify prerequisites
# 2. Install dependencies
# 3. Run CodeGen
# 4. Build all packages
node InstallMJ.js
```

**Expected Duration:** 15-30 minutes depending on your system

**Installation Progress:**
```
✓ Checking prerequisites...
✓ Bootstrapping GeneratedEntities...
✓ Processing CodeGen...
  - Setting up .env and config.json
  - Running npm install
  - Linking GeneratedEntities
✓ Running CodeGen...
  - Generating entity classes
  - Generating GraphQL schemas
  - Generating Angular components
✓ Bootstrapping MJAPI...
✓ Processing MJExplorer...
✓ Installation complete!
```

### Step 5: Build All Packages

```powershell
# Build everything using Turbo
npm run build
```

This builds all 70+ packages in the correct dependency order using Turbo's parallel build system.

**Build Time:** ~10-20 minutes

### Step 6: Run Database Migrations (If Applicable)

If you have existing database versions, run migrations:

```powershell
# Install MJ CLI globally
npm install -g @memberjunction/cli

# Run migrations
mj migrate
```

---

## Configuration Guide

### Main Configuration File: `mj.config.cjs`

This file contains all configuration for CodeGen, MJAPI, and optional services.

**Key Configuration Sections:**

#### 1. Database Connection
```javascript
{
  dbHost: process.env.DB_HOST ?? 'localhost',
  dbPort: process.env.DB_PORT ?? 1433,
  dbDatabase: process.env.DB_DATABASE,
  dbUsername: process.env.DB_USERNAME,
  dbPassword: process.env.DB_PASSWORD,
  dbTrustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE,
}
```

#### 2. Authentication Providers
```javascript
authProviders: [
  // Azure AD (MSAL)
  {
    name: 'azure',
    type: 'msal',
    issuer: `https://login.microsoftonline.com/${process.env.TENANT_ID}/v2.0`,
    audience: process.env.WEB_CLIENT_ID,
    clientId: process.env.WEB_CLIENT_ID,
    tenantId: process.env.TENANT_ID
  },
  // Auth0
  {
    name: 'auth0',
    type: 'auth0',
    issuer: `https://${process.env.AUTH0_DOMAIN}/`,
    audience: process.env.AUTH0_CLIENT_ID,
    clientId: process.env.AUTH0_CLIENT_ID,
    domain: process.env.AUTH0_DOMAIN
  }
]
```

#### 3. AI Provider API Keys

Create environment variables or add to `.env` files:

```powershell
# In MJAPI/.env
AI_VENDOR_API_KEY__OpenAILLM=sk-...
AI_VENDOR_API_KEY__AnthropicLLM=sk-ant-...
AI_VENDOR_API_KEY__MistralLLM=...
AI_VENDOR_API_KEY__GoogleLLM=...
```

#### 4. GraphQL Server Settings
```javascript
{
  graphqlPort: process.env.GRAPHQL_PORT ?? 4000,
  graphqlRootPath: process.env.GRAPHQL_ROOT_PATH ?? '/',
  baseUrl: process.env.GRAPHQL_BASE_URL ?? 'http://localhost',
}
```

### Environment Files

**CodeGen/.env:**
```env
DB_HOST=localhost
DB_PORT=1433
DB_USERNAME=codegen_user
DB_PASSWORD=YourSecurePassword123!
DB_DATABASE=MJ_Production
DB_TRUST_SERVER_CERTIFICATE=1
OUTPUT_CODE=MJ_Production
MJ_CORE_SCHEMA=__mj
```

**MJAPI/.env:**
```env
DB_HOST=localhost
DB_PORT=1433
DB_USERNAME=mjapi_user
DB_PASSWORD=YourSecurePassword456!
DB_DATABASE=MJ_Production
DB_TRUST_SERVER_CERTIFICATE=1
PORT=4000
WEB_CLIENT_ID=your-azure-client-id
TENANT_ID=your-azure-tenant-id
MJ_CORE_SCHEMA=__mj
```

**MJExplorer/src/environments/environment.ts:**
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:4000',
  msalConfig: {
    auth: {
      clientId: 'your-azure-client-id',
      authority: 'https://login.microsoftonline.com/your-tenant-id'
    }
  }
};
```

---

## Running the Application

### Development Mode

**Terminal 1 - Start API Server:**
```powershell
npm run start:api
```

Output:
```
🚀 MemberJunction API Server
📡 GraphQL server ready at http://localhost:4000/
🔐 Authentication: MSAL (Azure AD)
✓ Database connected: MJ_Production
✓ Metadata loaded: 150 entities
```

**Terminal 2 - Start Explorer UI:**
```powershell
npm run start:explorer
```

Output:
```
✔ Browser application bundle generation complete.
** Angular Live Development Server is listening on localhost:4200 **
✔ Compiled successfully.
```

### Access the Application

1. Open browser to: **http://localhost:4200**
2. You'll be redirected to Azure AD or Auth0 for login
3. After authentication, you'll land on the MemberJunction Explorer home page

### Production Mode

```powershell
# Build for production
npm run build

# Start API with pm2 (install globally first)
npm install -g pm2
pm2 start packages/MJAPI/dist/index.js --name mj-api

# Serve Angular build (use IIS or nginx)
# Build output is in: packages/MJExplorer/dist/
```

---

## Troubleshooting

### Common Windows Issues

#### Issue: Path Too Long Errors

**Symptom:**
```
Error: ENAMETOOLONG: name too long
```

**Solution:**
1. Enable long path support (see Windows-Specific Setup)
2. Clone repository closer to root: `C:\MJ` instead of `C:\Users\YourName\Documents\Projects\MJ`

#### Issue: Port Already in Use

**Symptom:**
```
Error: listen EADDRINUSE: address already in use :::4000
```

**Solution:**
```powershell
# Find process using port
netstat -ano | findstr :4000

# Kill process by PID
taskkill /PID <PID> /F

# Or change port in mj.config.cjs:
graphqlPort: 4001
```

#### Issue: SQL Server Connection Failed

**Symptom:**
```
ConnectionError: Failed to connect to localhost:1433
```

**Solution:**
1. Verify SQL Server is running:
   ```powershell
   Get-Service -Name MSSQL*
   ```
2. Enable TCP/IP in SQL Server Configuration Manager
3. Check firewall allows port 1433
4. Verify credentials in `.env` files
5. Test connection with SSMS

#### Issue: TypeScript Build Errors

**Symptom:**
```
error TS2307: Cannot find module '@memberjunction/core'
```

**Solution:**
```powershell
# Clean and reinstall
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install

# Rebuild packages
npm run build
```

#### Issue: Angular Build Memory Error

**Symptom:**
```
FATAL ERROR: Ineffective mark-compacts near heap limit
```

**Solution:**
```powershell
# Increase Node.js memory
$env:NODE_OPTIONS="--max-old-space-size=8192"
npm run build
```

#### Issue: CodeGen Fails

**Symptom:**
```
Error: Cannot connect to database
```

**Solution:**
1. Verify CodeGen user has `db_owner` permissions
2. Check `CodeGen/.env` file exists with correct credentials
3. Ensure database exists and is accessible
4. Review `CodeGen/codegen.output.log` for details

### Database-Related Issues

#### Issue: Migration Fails

**Symptom:**
```
Flyway migration failed
```

**Solution:**
```powershell
# Check current version
mj migrate --status

# Clean and re-run (caution: dev only!)
mj migrate --clean
mj migrate
```

#### Issue: Schema Mismatch

**Symptom:**
```
Entity 'Users' not found in metadata
```

**Solution:**
```powershell
# Regenerate entities
cd packages/CodeGenLib
npm run build
cd ../..
mj codegen
```

### AI Integration Issues

#### Issue: OpenAI API Key Invalid

**Symptom:**
```
Error: OpenAI API key is invalid
```

**Solution:**
1. Verify API key format: `sk-...`
2. Check API key is active at platform.openai.com
3. Ensure key is in correct `.env` file:
   ```env
   AI_VENDOR_API_KEY__OpenAILLM=sk-your-actual-key
   ```

### Performance Issues

#### Issue: Slow Build Times

**Solution:**
```powershell
# Use Turbo cache
npm run build

# Build only changed packages
npm run build -- --filter=changed

# Parallel builds (already default with Turbo)
# But ensure you have multiple cores available
```

#### Issue: High Memory Usage

**Solution:**
1. Close unnecessary applications
2. Increase Node.js memory:
   ```powershell
   $env:NODE_OPTIONS="--max-old-space-size=4096"
   ```
3. Build packages individually instead of all at once

### Getting Help

1. **Check Logs:**
   - API logs: Console output from `npm run start:api`
   - CodeGen logs: `CodeGen/codegen.output.log`
   - Angular logs: Browser console (F12)

2. **Documentation:**
   - Official docs: https://docs.memberjunction.org
   - GitHub Issues: https://github.com/MemberJunction/MJ/issues

3. **Community:**
   - GitHub Discussions
   - Stack Overflow (tag: memberjunction)

---

## Package Reference

### Core Framework Packages

| Package | Description | Purpose |
|---------|-------------|---------|
| `@memberjunction/global` | Foundation utilities | Class factory, singleton management |
| `@memberjunction/core` | Metadata engine | Entity management, data access |
| `@memberjunction/core-entities` | Generated entities | Strongly-typed entity classes |
| `@memberjunction/server` | GraphQL API server | Authentication, resolvers, directives |
| `@memberjunction/sqlserver-dataprovider` | SQL Server provider | Database connectivity and queries |

### AI Framework Packages

| Package | Description | Purpose |
|---------|-------------|---------|
| `@memberjunction/ai` | AI core abstractions | Provider-agnostic AI interfaces |
| `@memberjunction/aiengine` | AI orchestration | High-level AI operations |
| `@memberjunction/ai-prompts` | Prompt management | Template-based AI prompts |
| `@memberjunction/ai-agents` | AI agents | Agent framework and execution |
| `@memberjunction/ai-vectors-core` | Vector operations | Embeddings and similarity search |

### Actions Framework Packages

| Package | Description | Purpose |
|---------|-------------|---------|
| `@memberjunction/actions` | Action engine | Execute custom business logic |
| `@memberjunction/core-actions` | Built-in actions | Standard action implementations |
| `@memberjunction/actions-apollo` | Apollo actions | GraphQL-specific actions |

### Communication Packages

| Package | Description | Purpose |
|---------|-------------|---------|
| `@memberjunction/communication-engine` | Communication core | Orchestrate multi-channel messaging |
| `@memberjunction/communication-sendgrid` | SendGrid provider | Email via SendGrid |
| `@memberjunction/communication-twilio` | Twilio provider | SMS, WhatsApp, Messenger |
| `@memberjunction/communication-ms-graph` | MS Graph provider | Office 365 email |

### Angular UI Packages

| Package | Description | Purpose |
|---------|-------------|---------|
| `@memberjunction/ng-explorer-core` | Explorer shell | Main application framework |
| `@memberjunction/ng-user-view-grid` | Data grid | Entity data display |
| `@memberjunction/ng-dashboards` | Dashboard system | Widget-based dashboards |
| `@memberjunction/ng-core-entity-forms` | Entity forms | Auto-generated forms |

### Developer Tools

| Package | Description | Purpose |
|---------|-------------|---------|
| `@memberjunction/cli` | Command-line tools | `mj` command for migrations, codegen |
| `@memberjunction/codegen-lib` | Code generation | Generate entities, resolvers, forms |
| `@memberjunction/metadata-sync` | Metadata sync | Synchronize metadata changes |

---

## Advanced Topics

### Using the MJ CLI

```powershell
# Install globally
npm install -g @memberjunction/cli

# Available commands
mj migrate          # Run database migrations
mj migrate --status # Check migration status
mj codegen          # Generate entity classes and types
mj sync             # Sync metadata
mj doc              # Generate database documentation
```

### Custom Entity Development

1. Create tables in SQL Server
2. Run CodeGen: `mj codegen`
3. Entity classes auto-generated in `packages/GeneratedEntities/src/generated/`
4. Use in code:
   ```typescript
   const md = new Metadata();
   const entity = await md.GetEntityObject<MyEntityEntity>('My Entities');
   await entity.Load(id);
   entity.Name = 'Updated Name';
   await entity.Save();
   ```

### Metadata-Driven Forms

Forms are auto-generated from entity metadata:
- Field types, validation, and relationships from database schema
- Form layout can be customized via metadata
- Forms regenerated on each CodeGen run

### Row-Level Security

Implement via metadata:
- Define security filters per entity
- Applied automatically in all queries
- User/role-based access control

---

## Production Deployment

### Windows Server Deployment

1. **IIS Setup** for MJExplorer:
   ```powershell
   # Install IIS
   Install-WindowsFeature -name Web-Server -IncludeManagementTools
   
   # Copy build output
   Copy-Item packages/MJExplorer/dist/* C:\inetpub\wwwroot\mj -Recurse
   
   # Create IIS site
   New-IISSite -Name "MJ Explorer" -PhysicalPath "C:\inetpub\wwwroot\mj" -BindingInformation "*:80:"
   ```

2. **Windows Service** for MJAPI:
   ```powershell
   # Install pm2
   npm install -g pm2 pm2-windows-service
   
   # Setup pm2 as Windows service
   pm2-service-install
   
   # Start MJAPI
   pm2 start packages/MJAPI/dist/index.js --name mj-api
   pm2 save
   ```

3. **SQL Server**: Use SQL Server Express or Standard edition

### Azure Deployment

- **App Service**: Deploy MJAPI as Node.js app
- **Static Web Apps**: Deploy MJExplorer
- **Azure SQL Database**: Use as database backend
- **Azure AD**: Use for authentication

### Docker Deployment

```powershell
# Build Docker image
docker build -f docker/MJAPI/Dockerfile -t mj-api .

# Run container
docker run -d -p 4000:4000 `
  -e DB_HOST=your-sql-server `
  -e DB_DATABASE=MJ_Production `
  --name mj-api `
  mj-api
```

---

## Security Best Practices

1. **Never commit secrets to Git**
   - Use `.env` files (already in `.gitignore`)
   - Use Azure Key Vault or similar for production

2. **Use strong database passwords**
   - Minimum 12 characters
   - Mix of uppercase, lowercase, numbers, symbols

3. **Enable HTTPS in production**
   - Use SSL certificates
   - Configure in `mj.config.cjs`:
     ```javascript
     baseUrl: 'https://yourdomain.com'
     ```

4. **Restrict database access**
   - CodeGen user: Development only
   - MJAPI user: Read/Write only (no DDL)
   - Read-only user: Reports and analytics

5. **Keep dependencies updated**
   ```powershell
   npm audit
   npm audit fix
   ```

---

## Conclusion

You now have a complete guide to deploying MemberJunction on Windows. The platform's metadata-driven approach means you can:

- ✅ Define data structures in SQL Server
- ✅ Auto-generate TypeScript entities
- ✅ Auto-generate GraphQL APIs
- ✅ Auto-generate Angular forms
- ✅ Leverage built-in AI, communications, and actions

**Need Help?**
- 📚 Documentation: https://docs.memberjunction.org
- 💬 GitHub Discussions: https://github.com/MemberJunction/MJ/discussions
- 🐛 Issues: https://github.com/MemberJunction/MJ/issues

**Happy Building with MemberJunction!** 🚀

