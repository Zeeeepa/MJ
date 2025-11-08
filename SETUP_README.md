# MemberJunction Setup and Service Management Scripts

> **Intelligent automation scripts for deploying and managing MemberJunction**

## 📋 Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [setup.py - Installation Automation](#setuppy---installation-automation)
- [start.py - Service Manager](#startpy---service-manager)
- [Troubleshooting](#troubleshooting)
- [Advanced Usage](#advanced-usage)

---

## Overview

This directory contains three comprehensive deployment tools:

1. **INSTRUCTIONS.md** - Complete deployment guide (920 lines)
2. **setup.py** - Intelligent setup automation (800+ lines)
3. **start.py** - Service manager with AI error recovery (700+ lines)

### Key Features

✅ **Cross-Platform Support** - Works on Windows, Linux, and macOS  
✅ **AI-Powered Error Recovery** - Analyzes errors and provides context-aware solutions  
✅ **Checkpoint-Based Recovery** - Resume setup from last successful phase  
✅ **Real-Time Monitoring** - Interactive dashboard with service health  
✅ **Comprehensive Validation** - Pre-flight checks before installation/startup  
✅ **Production-Ready** - Includes pm2 process management support  

---

## Quick Start

### First-Time Setup

```bash
# 1. Check prerequisites (dry-run mode)
python3 setup.py --dry-run

# 2. Run full installation
python3 setup.py

# 3. Follow interactive configuration wizard
# Enter database credentials, authentication settings, etc.

# 4. Wait for automated installation (15-30 minutes)
```

### Daily Development

```bash
# Start all services with monitoring
python3 start.py

# Or start specific services
python3 start.py --api-only       # API server only
python3 start.py --ui-only        # Explorer UI only
python3 start.py --no-monitor     # Background mode without dashboard
```

### Quick Health Check

```bash
# Check if system is ready to start services
python3 start.py --check-only
```

---

## setup.py - Installation Automation

### Overview

Intelligent setup script that automates the entire MemberJunction installation process with AI-powered error recovery.

### Features

- **Prerequisites Verification**
  - Node.js 20+ version check
  - npm, TypeScript, Angular CLI detection
  - Disk space validation (5GB minimum)
  - SQL Server detection (Windows only)
  
- **Interactive Configuration Wizard**
  - Database connection settings
  - Authentication setup (MSAL or Auth0)
  - Initial admin user creation
  - AI API keys (optional)
  
- **AI-Powered Error Analysis**
  - Detects error patterns automatically
  - Provides context-aware solutions
  - References INSTRUCTIONS.md sections
  - Suggests exact PowerShell/bash commands
  
- **Checkpoint-Based Recovery**
  - Saves progress at each phase
  - Resume from last successful checkpoint
  - Never lose progress from long installations

### Usage

```bash
# Basic usage
python3 setup.py

# Check prerequisites without installing
python3 setup.py --dry-run

# Skip prerequisite checks (if you know they're satisfied)
python3 setup.py --skip-prereqs

# Skip database setup phase
python3 setup.py --skip-database

# Start from specific phase
python3 setup.py --start-from=packages
python3 setup.py --start-from=build
```

### Installation Phases

1. **Prerequisites** - Verify Node.js, npm, TypeScript, Angular CLI, disk space
2. **Configuration** - Interactive wizard for database, auth, users, AI keys
3. **Database** - Execute SQL scripts to create base schema
4. **Packages** - Run `npm install` for all workspaces
5. **CodeGen** - Generate entity classes, GraphQL schemas, Angular components
6. **Build** - Build all 70+ packages with Turbo

### Command-Line Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Check prerequisites without installing |
| `--skip-prereqs` | Skip prerequisite verification |
| `--skip-database` | Skip database setup phase |
| `--start-from=PHASE` | Resume from specific phase |
| `-h, --help` | Show help message |

### Checkpoint Recovery

If setup fails or is interrupted:

```bash
# Simply run the script again
python3 setup.py

# It will automatically resume from the last successful phase
# Checkpoint file: .setup_checkpoint.json
```

### Error Analysis Example

```
ERROR: Port Already in Use

Quick Solution:
1. Find process using port:
   netstat -ano | findstr :4000

2. Kill process:
   taskkill /PID <PID> /F

3. Or change port in mj.config.cjs

See INSTRUCTIONS.md Section: "Port Already in Use"
```

### Platform-Specific Notes

**Windows:**
- Full support for all features
- SQL Server detection
- PowerShell-based solutions
- Long path support checks

**Linux/macOS:**
- Full support with warnings for Windows-specific features
- SQL Server check skipped (use Azure SQL or remote instance)
- bash-based solutions

---

## start.py - Service Manager

### Overview

Intelligent service manager that starts, monitors, and auto-recovers MemberJunction services with real-time health checking.

### Features

- **Pre-Start Validation**
  - Build artifacts verification
  - Configuration file checks
  - Port availability detection
  - Environment variable validation
  
- **Multi-Service Management**
  - MJAPI (GraphQL API Server) - Port 4000
  - MJExplorer (Angular UI) - Port 4200
  - Independent or combined startup
  
- **Real-Time Health Monitoring**
  - Auto-restart on crashes (max 3 attempts)
  - Error pattern detection
  - Log collection and analysis
  - Service status tracking
  
- **Interactive Dashboard**
  - Live service status
  - Recent log output
  - Color-coded indicators
  - Keyboard commands
  
- **AI Error Recovery**
  - Analyzes service logs
  - Classifies error types
  - Retrieves solutions from INSTRUCTIONS.md
  - Provides exact fix commands

### Usage

```bash
# Start all services with interactive dashboard
python3 start.py

# Start specific services
python3 start.py --api-only
python3 start.py --ui-only

# Background mode (no interactive dashboard)
python3 start.py --no-monitor

# Check if system is ready (validation only)
python3 start.py --check-only

# Production mode with pm2
python3 start.py --production

# Verbose output
python3 start.py --verbose
```

### Command-Line Options

| Option | Description |
|--------|-------------|
| `--api-only` | Start only MJAPI server |
| `--ui-only` | Start only MJExplorer UI |
| `--all` | Start all services (default) |
| `--production` | Start in production mode with pm2 |
| `--no-monitor` | Run without interactive dashboard |
| `--check-only` | Only validate, don't start services |
| `--verbose` | Show verbose output |
| `-h, --help` | Show help message with examples |

### Interactive Dashboard

```
╔═══════════════════════════════════════════════════════════════╗
║  MemberJunction Service Dashboard                            ║
╚═══════════════════════════════════════════════════════════════╝

Service Status:

  MJAPI                Running ✓          
  MJExplorer           Starting...        

Recent Logs:

MJAPI:
  🚀 MemberJunction API Server
  📡 GraphQL server ready at http://localhost:4000/
  ✓ Database connected: MJ_Production

Commands:
  q - Quit and stop all services
  r - Restart all services
  l - View full logs (services.log)

Press Ctrl+C to stop all services
```

### Health Monitoring

The service manager continuously monitors:

- **Process Status** - Detects if service crashes
- **Ready Patterns** - Recognizes successful startup
- **Error Patterns** - Detects common error messages
- **Auto-Restart** - Restarts failed services (max 3 attempts)

### Error Recovery Example

```
[20:15:42] [MJAPI       ] ERROR: listen EADDRINUSE: address already in use :::4000

Error Analysis:

Port Conflict Detected for MJAPI

Quick Solution:
1. Find process using port:
   netstat -ano | findstr :4000

2. Kill process:
   taskkill /PID <PID> /F

3. Or change port in mj.config.cjs

See INSTRUCTIONS.md Section: "Port Already in Use"
```

### Service Configuration

Services are defined in `start.py` with:

- **Name** - Service identifier
- **Start Script** - npm command to run
- **Port** - Expected port number
- **Health Check URL** - Endpoint to verify service
- **Ready Patterns** - Log patterns indicating success
- **Error Patterns** - Log patterns indicating failures

### Log Files

- **services.log** - All service output (persistent)
- **Console** - Color-coded real-time output
- **Dashboard** - Last 50 lines per service

---

## Troubleshooting

### Setup Script Issues

#### Problem: Prerequisites check fails

```bash
# Check what's missing
python3 setup.py --dry-run

# Install missing items manually, then retry
python3 setup.py
```

#### Problem: Setup hangs or times out

```bash
# Check the log file
cat setup.log

# Try skipping the problematic phase
python3 setup.py --skip-database  # Skip DB phase
```

#### Problem: Want to restart from scratch

```bash
# Remove checkpoint file
rm .setup_checkpoint.json

# Run setup again
python3 setup.py
```

### Start Script Issues

#### Problem: Services won't start

```bash
# Run validation checks
python3 start.py --check-only

# Check what's missing
# - node_modules? Run: npm install
# - Build artifacts? Run: npm run build
# - Configuration? Check MJAPI/.env exists
```

#### Problem: Port already in use

```bash
# Find and kill process
netstat -ano | findstr :4000  # Windows
lsof -i :4000                 # Linux/Mac

# Or change port in mj.config.cjs
```

#### Problem: Dashboard won't start

```bash
# Use no-monitor mode instead
python3 start.py --no-monitor

# Check terminal supports ANSI colors
```

### General Issues

#### Problem: "Command not found" errors

```bash
# Make scripts executable (Linux/Mac)
chmod +x setup.py start.py

# Use python3 explicitly
python3 setup.py
python3 start.py
```

#### Problem: Permission denied

```bash
# Linux/Mac: Run with sudo if needed
sudo python3 setup.py

# Windows: Run PowerShell as Administrator
```

#### Problem: Import errors

```bash
# Ensure Python 3.7+ is installed
python3 --version

# Scripts use only standard library
# No additional pip packages needed
```

---

## Advanced Usage

### Custom Configuration

#### Skip Interactive Wizard

Create `install.config.json` manually before running setup:

```json
{
    "dbUrl": "localhost",
    "dbDatabase": "MJ_Production",
    "dbPort": 1433,
    "codeGenLogin": "codegen_user",
    "codeGenPwD": "your-password",
    "mjAPILogin": "mjapi_user",
    "mjAPIPwD": "your-password",
    "graphQLPort": 4000,
    "authType": "MSAL",
    "msalWebClientId": "your-client-id",
    "msalTenantId": "your-tenant-id"
}
```

Then run: `python3 setup.py` (will use existing config)

### Automated CI/CD Integration

```bash
# In your CI/CD pipeline

# Step 1: Check prerequisites
python3 setup.py --dry-run || exit 1

# Step 2: Skip interactive wizard (use pre-created config)
python3 setup.py --skip-prereqs || exit 1

# Step 3: Validate system
python3 start.py --check-only || exit 1
```

### Production Deployment

```bash
# Build for production
npm run build

# Start with pm2
python3 start.py --production

# Or manually with pm2
pm2 start packages/MJAPI/dist/index.js --name mj-api
pm2 save
```

### Custom Error Patterns

Edit `setup.py` or `start.py` to add custom error detection:

```python
# In ErrorAnalyzer or ErrorContextCollector class
ERROR_PATTERNS = {
    'custom_error': {
        'patterns': [r'YourCustomError', r'SpecificMessage'],
        'solution': """
        Your custom solution here
        """
    }
}
```

### Integration with Other Tools

**Docker:**
```bash
# The setup scripts work inside Docker containers
FROM node:20
COPY . /app
WORKDIR /app
RUN python3 setup.py --skip-database
CMD ["python3", "start.py", "--no-monitor"]
```

**Systemd Service (Linux):**
```ini
[Unit]
Description=MemberJunction Services
After=network.target

[Service]
Type=simple
User=mjuser
WorkingDirectory=/opt/MJ
ExecStart=/usr/bin/python3 start.py --no-monitor
Restart=always

[Install]
WantedBy=multi-user.target
```

---

## File Structure

```
MJ/
├── INSTRUCTIONS.md          # Complete deployment guide (920 lines)
├── SETUP_README.md          # This file - script documentation
├── setup.py                 # Intelligent setup automation (800+ lines)
├── start.py                 # Service manager with AI recovery (700+ lines)
├── .setup_checkpoint.json   # Checkpoint state (auto-generated)
├── setup.log                # Setup script log (auto-generated)
├── services.log             # Service output log (auto-generated)
└── install.config.json      # Installation config (created during setup)
```

---

## Contributing

These scripts are designed to be maintainable and extensible:

- **Adding Prerequisites Checks**: Extend `PrerequisitesChecker` class
- **Adding Error Patterns**: Update `ErrorAnalyzer.ERROR_PATTERNS`
- **Adding Services**: Update `ServiceConfig` in `start.py`
- **Custom Phases**: Extend `SetupExecutor` class

---

## Support

For issues, questions, or contributions:

1. **Documentation**: See INSTRUCTIONS.md for detailed guides
2. **GitHub Issues**: https://github.com/MemberJunction/MJ/issues
3. **Log Files**: Check setup.log and services.log
4. **Dry-Run Mode**: Use `--dry-run` to diagnose issues

---

## Version History

- **v2.0** - Cross-platform support, enhanced error recovery, new options
- **v1.0** - Initial Windows-only release

---

## License

ISC License - Same as MemberJunction project

---

**Made with ❤️ for the MemberJunction Community**

