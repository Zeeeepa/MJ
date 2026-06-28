#!/usr/bin/env python3
"""
MemberJunction Intelligent Setup Script for Windows
===================================================
Automates the complete installation process with AI-powered error recovery.

Usage:
    python setup.py

Features:
    - Prerequisites verification
    - Interactive configuration wizard
    - Automated database setup
    - Error detection with context-aware troubleshooting
    - Checkpoint-based recovery system
    - Progress tracking
"""

import os
import sys
import subprocess
import json
import platform
import time
import re
import argparse
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from datetime import datetime

# ANSI color codes for better terminal output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

class SetupState:
    """Manages setup progress and checkpoints for recovery."""
    
    CHECKPOINT_FILE = ".setup_checkpoint.json"
    
    PHASES = {
        'prerequisites': 'Prerequisites Verification',
        'configuration': 'Configuration Setup',
        'database': 'Database Setup',
        'packages': 'Package Installation',
        'codegen': 'Code Generation',
        'build': 'Build All Packages',
        'complete': 'Setup Complete'
    }
    
    def __init__(self):
        self.state = self._load_state()
    
    def _load_state(self) -> Dict:
        """Load checkpoint state from disk."""
        if os.path.exists(self.CHECKPOINT_FILE):
            try:
                with open(self.CHECKPOINT_FILE, 'r') as f:
                    return json.load(f)
            except:
                pass
        return {
            'current_phase': 'prerequisites',
            'completed_phases': [],
            'failed_phases': [],
            'errors': [],
            'started_at': datetime.now().isoformat(),
            'last_updated': datetime.now().isoformat()
        }
    
    def _save_state(self):
        """Save checkpoint state to disk."""
        self.state['last_updated'] = datetime.now().isoformat()
        with open(self.CHECKPOINT_FILE, 'w') as f:
            json.dump(self.state, f, indent=2)
    
    def mark_phase_complete(self, phase: str):
        """Mark a phase as completed."""
        if phase not in self.state['completed_phases']:
            self.state['completed_phases'].append(phase)
        self.state['current_phase'] = self._next_phase(phase)
        self._save_state()
    
    def mark_phase_failed(self, phase: str, error: str):
        """Mark a phase as failed with error message."""
        if phase not in self.state['failed_phases']:
            self.state['failed_phases'].append(phase)
        self.state['errors'].append({
            'phase': phase,
            'error': error,
            'timestamp': datetime.now().isoformat()
        })
        self._save_state()
    
    def _next_phase(self, current: str) -> str:
        """Determine next phase based on current."""
        phases_list = list(self.PHASES.keys())
        try:
            idx = phases_list.index(current)
            return phases_list[idx + 1] if idx + 1 < len(phases_list) else 'complete'
        except ValueError:
            return 'complete'
    
    def can_resume_from(self, phase: str) -> bool:
        """Check if we can resume from a specific phase."""
        return phase not in self.state['completed_phases']
    
    def get_resume_phase(self) -> str:
        """Get the phase to resume from."""
        return self.state['current_phase']
    
    def clear(self):
        """Clear checkpoint state."""
        if os.path.exists(self.CHECKPOINT_FILE):
            os.remove(self.CHECKPOINT_FILE)
        self.state = self._load_state()

class Logger:
    """Enhanced logger with color-coded output and file logging."""
    
    LOG_FILE = "setup.log"
    
    @staticmethod
    def _log(level: str, message: str, color: str = Colors.ENDC):
        """Internal logging method."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        formatted_msg = f"[{timestamp}] {level}: {message}"
        
        # Console output with colors
        print(f"{color}{formatted_msg}{Colors.ENDC}")
        
        # File output without colors
        with open(Logger.LOG_FILE, 'a', encoding='utf-8') as f:
            f.write(formatted_msg + '\n')
    
    @staticmethod
    def header(message: str):
        """Log header message."""
        Logger._log("HEADER", message, Colors.HEADER + Colors.BOLD)
    
    @staticmethod
    def info(message: str):
        """Log info message."""
        Logger._log("INFO", message, Colors.CYAN)
    
    @staticmethod
    def success(message: str):
        """Log success message."""
        Logger._log("SUCCESS", message, Colors.GREEN + Colors.BOLD)
    
    @staticmethod
    def warning(message: str):
        """Log warning message."""
        Logger._log("WARNING", message, Colors.YELLOW)
    
    @staticmethod
    def error(message: str):
        """Log error message."""
        Logger._log("ERROR", message, Colors.RED + Colors.BOLD)
    
    @staticmethod
    def debug(message: str):
        """Log debug message."""
        Logger._log("DEBUG", message, Colors.BLUE)

class ErrorAnalyzer:
    """Analyzes errors and provides context-aware solutions."""
    
    ERROR_PATTERNS = {
        'path_too_long': {
            'patterns': [r'ENAMETOOLONG', r'path too long', r'exceeds maximum length'],
            'solution': """
    ERROR: Windows Path Length Limit Exceeded
    
    This error occurs because Windows has a 260-character path limit by default.
    
    Solutions:
    1. Enable Long Path Support (Recommended):
       - Run PowerShell as Administrator:
         New-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\FileSystem" `
           -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
       - Restart your computer
    
    2. Or move the repository closer to root:
       - Current path: {current_path}
       - Recommended: C:\\MJ or C:\\Projects\\MJ
    
    Reference: INSTRUCTIONS.md Section "Windows-Specific Setup"
            """
        },
        'port_in_use': {
            'patterns': [r'EADDRINUSE', r'address already in use', r'port.*already.*use'],
            'solution': """
    ERROR: Port Already in Use
    
    Another process is using the required port.
    
    Solutions:
    1. Find and kill the process:
       netstat -ano | findstr :{port}
       taskkill /PID <PID> /F
    
    2. Or change the port in mj.config.cjs:
       graphqlPort: <alternative_port>
    
    Reference: INSTRUCTIONS.md Section "Troubleshooting"
            """
        },
        'sql_connection': {
            'patterns': [r'ConnectionError', r'Login failed', r'Cannot connect to.*SQL'],
            'solution': """
    ERROR: SQL Server Connection Failed
    
    Cannot connect to SQL Server database.
    
    Solutions:
    1. Verify SQL Server is running:
       Get-Service -Name MSSQL*
    
    2. Enable TCP/IP in SQL Server Configuration Manager
    
    3. Check firewall allows port 1433
    
    4. Verify credentials in .env files:
       - CodeGen/.env
       - MJAPI/.env
    
    5. Test connection with SQL Server Management Studio
    
    Reference: INSTRUCTIONS.md Section "SQL Server Configuration"
            """
        },
        'node_version': {
            'patterns': [r'requires node version', r'Unsupported engine', r'node.*version'],
            'solution': """
    ERROR: Node.js Version Incompatibility
    
    This project requires Node.js 20 or higher.
    
    Solutions:
    1. Install Node.js 20 LTS from https://nodejs.org/
    2. Or use nvm (Node Version Manager):
       nvm install 20
       nvm use 20
    
    Reference: INSTRUCTIONS.md Section "Prerequisites"
            """
        },
        'memory_error': {
            'patterns': [r'heap.*memory', r'Out of memory', r'FATAL ERROR.*heap'],
            'solution': """
    ERROR: Node.js Memory Exhausted
    
    Node.js ran out of memory during build/install.
    
    Solutions:
    1. Increase Node.js memory limit:
       $env:NODE_OPTIONS="--max-old-space-size=8192"
       npm run build
    
    2. Close unnecessary applications
    
    3. Build packages individually
    
    Reference: INSTRUCTIONS.md Section "Performance Issues"
            """
        },
        'module_not_found': {
            'patterns': [r'Cannot find module', r'MODULE_NOT_FOUND', r'TS2307'],
            'solution': """
    ERROR: Module Not Found
    
    TypeScript/Node.js cannot find a required module.
    
    Solutions:
    1. Clean and reinstall dependencies:
       Remove-Item -Recurse -Force node_modules
       Remove-Item package-lock.json
       npm install
    
    2. Rebuild packages:
       npm run build
    
    3. Link generated entities:
       npm link ../GeneratedEntities
    
    Reference: INSTRUCTIONS.md Section "TypeScript Build Errors"
            """
        }
    }
    
    @staticmethod
    def analyze(error_output: str, context: Dict) -> str:
        """Analyze error output and return context-aware solution."""
        error_output_lower = error_output.lower()
        
        for error_type, config in ErrorAnalyzer.ERROR_PATTERNS.items():
            for pattern in config['patterns']:
                if re.search(pattern, error_output, re.IGNORECASE):
                    solution = config['solution']
                    # Replace context placeholders
                    for key, value in context.items():
                        solution = solution.replace(f'{{{key}}}', str(value))
                    return solution
        
        # Generic solution if no pattern matches
        return f"""
    An error occurred during setup.
    
    Error Output:
    {error_output[:500]}
    
    Please check:
    1. The full error log in setup.log
    2. INSTRUCTIONS.md for detailed troubleshooting
    3. GitHub Issues: https://github.com/MemberJunction/MJ/issues
        """

class PrerequisitesChecker:
    """Checks and validates system prerequisites."""
    
    @staticmethod
    def check_os() -> Tuple[bool, str]:
        """Check if OS is supported."""
        os_name = platform.system()
        os_version = platform.version()
        
        if os_name == 'Windows':
            return True, f"Operating System: Windows {os_version} ✓"
        elif os_name == 'Linux':
            Logger.warning("Running on Linux. Some Windows-specific features may not be available.")
            return True, f"Operating System: Linux {os_version} ✓"
        elif os_name == 'Darwin':
            Logger.warning("Running on macOS. Some Windows-specific features may not be available.")
            return True, f"Operating System: macOS {os_version} ✓"
        else:
            return False, f"Unsupported OS: {os_name}. Supported: Windows, Linux, macOS"
    
    @staticmethod
    def check_node() -> Tuple[bool, str]:
        """Check Node.js version."""
        try:
            result = subprocess.run(['node', '-v'], capture_output=True, text=True)
            version = result.stdout.strip()
            major_version = int(version.split('.')[0].replace('v', ''))
            if major_version >= 20:
                return True, f"Node.js: {version} ✓"
            else:
                return False, f"Node.js version {version} found. Requires v20 or higher."
        except Exception as e:
            return False, f"Node.js not found or not in PATH. Please install Node.js 20+."
    
    @staticmethod
    def check_npm() -> Tuple[bool, str]:
        """Check npm version."""
        try:
            result = subprocess.run(['npm', '-v'], capture_output=True, text=True)
            version = result.stdout.strip()
            major_version = int(version.split('.')[0])
            if major_version >= 9:
                return True, f"npm: v{version} ✓"
            else:
                return False, f"npm version {version} found. Requires v9 or higher."
        except Exception as e:
            return False, f"npm not found. Should be installed with Node.js."
    
    @staticmethod
    def check_typescript() -> Tuple[bool, str]:
        """Check TypeScript installation."""
        try:
            result = subprocess.run(['tsc', '-v'], capture_output=True, text=True, timeout=5)
            version = result.stdout.strip()
            return True, f"TypeScript: {version} ✓"
        except subprocess.TimeoutExpired:
            return False, "TypeScript command timed out"
        except FileNotFoundError:
            Logger.warning("TypeScript not found globally. Will be installed locally during npm install.")
            return True, "TypeScript: Will be installed locally ⚠️"
        except Exception as e:
            Logger.warning(f"TypeScript check failed: {e}. Will be installed during npm install.")
            return True, "TypeScript: Will be installed locally ⚠️"
    
    @staticmethod
    def check_angular_cli() -> Tuple[bool, str]:
        """Check Angular CLI installation."""
        try:
            result = subprocess.run(['ng', 'version'], capture_output=True, text=True, timeout=10)
            if 'Angular CLI' in result.stdout:
                version_match = re.search(r'Angular CLI: (\d+\.\d+\.\d+)', result.stdout)
                if version_match:
                    version = version_match.group(1)
                    major = int(version.split('.')[0])
                    if major >= 18:
                        return True, f"Angular CLI: {version} ✓"
                    else:
                        Logger.warning(f"Angular CLI {version} found but v18+ recommended")
                        return True, f"Angular CLI: {version} (v18+ recommended) ⚠️"
            return True, "Angular CLI: Not detected (will use local version) ⚠️"
        except subprocess.TimeoutExpired:
            return False, "Angular CLI command timed out"
        except FileNotFoundError:
            Logger.warning("Angular CLI not found globally. Will use local version from package.")
            return True, "Angular CLI: Will use local version ⚠️"
        except Exception as e:
            Logger.warning(f"Angular CLI check failed: {e}. Will use local version.")
            return True, "Angular CLI: Will use local version ⚠️"
    
    @staticmethod
    def check_disk_space() -> Tuple[bool, str]:
        """Check available disk space."""
        try:
            import shutil
            total, used, free = shutil.disk_usage(os.getcwd())
            free_gb = free // (2**30)
            if free_gb >= 5:
                return True, f"Disk Space: {free_gb} GB available ✓"
            else:
                return False, f"Only {free_gb} GB available. Requires at least 5 GB."
        except Exception as e:
            return False, f"Could not check disk space: {e}"
    
    @staticmethod
    def check_sql_server() -> Tuple[bool, str]:
        """Check SQL Server availability (optional)."""
        try:
            # Try to detect SQL Server on Windows
            if platform.system() == 'Windows':
                result = subprocess.run(
                    ['powershell', '-Command', 'Get-Service -Name MSSQL* | Select-Object -First 1'],
                    capture_output=True,
                    text=True,
                    timeout=5
                )
                if 'MSSQL' in result.stdout and 'Running' in result.stdout:
                    return True, "SQL Server: Detected and running ✓"
                elif 'MSSQL' in result.stdout:
                    return True, "SQL Server: Detected but not running ⚠️"
                else:
                    Logger.info("SQL Server not detected. You can use Azure SQL or install later.")
                    return True, "SQL Server: Not detected (optional) ⚠️"
            else:
                Logger.info("SQL Server check skipped on non-Windows platform.")
                return True, "SQL Server: Check skipped (non-Windows) ⚠️"
        except subprocess.TimeoutExpired:
            Logger.warning("SQL Server check timed out")
            return True, "SQL Server: Check timed out (optional) ⚠️"
        except Exception as e:
            Logger.warning(f"SQL Server check failed: {e}")
            return True, "SQL Server: Check failed (optional) ⚠️"
    
    @staticmethod
    def check_all() -> bool:
        """Run all prerequisite checks."""
        Logger.header("📋 Checking Prerequisites")
        
        checks = [
            PrerequisitesChecker.check_os,
            PrerequisitesChecker.check_node,
            PrerequisitesChecker.check_npm,
            PrerequisitesChecker.check_typescript,
            PrerequisitesChecker.check_angular_cli,
            PrerequisitesChecker.check_disk_space,
            PrerequisitesChecker.check_sql_server
        ]
        
        all_passed = True
        warnings = 0
        for check in checks:
            passed, message = check()
            if passed:
                if '⚠️' in message:
                    Logger.warning(f"⚠ {message}")
                    warnings += 1
                else:
                    Logger.success(f"✓ {message}")
            else:
                Logger.error(f"✗ {message}")
                all_passed = False
        
        if warnings > 0:
            Logger.info(f"\n{warnings} warnings found. Setup can continue but some features may not work.")
        
        return all_passed

class ConfigurationWizard:
    """Interactive configuration wizard."""
    
    @staticmethod
    def _get_input(prompt: str, default: str = "", required: bool = False, secret: bool = False) -> str:
        """Get user input with required/optional indication."""
        required_text = f"{Colors.RED}[REQUIRED]{Colors.ENDC}" if required else f"{Colors.YELLOW}[OPTIONAL]{Colors.ENDC}"
        default_text = f" [{default}]" if default else ""
        full_prompt = f"{Colors.CYAN}{prompt}{default_text} {required_text}: {Colors.ENDC}"
        
        if secret:
            import getpass
            value = getpass.getpass(full_prompt)
        else:
            value = input(full_prompt).strip()
        
        if not value and required and not default:
            Logger.error(f"This field is required!")
            return ConfigurationWizard._get_input(prompt, default, required, secret)
        
        return value or default
    
    @staticmethod
    def run() -> Dict:
        """Run the configuration wizard."""
        Logger.header("🔧 Interactive Configuration Wizard")
        Logger.info("This wizard will guide you through configuring MemberJunction.")
        Logger.info(f"{Colors.RED}[REQUIRED]{Colors.ENDC} = Must be provided")
        Logger.info(f"{Colors.YELLOW}[OPTIONAL]{Colors.ENDC} = Can be skipped (press Enter)")
        Logger.info("\nFor password fields, input will be hidden for security.\n")
        
        config = {}
        
        # ===== DATABASE CONFIGURATION =====
        Logger.header("\n" + "="*60)
        Logger.header("DATABASE CONFIGURATION")
        Logger.header("="*60)
        Logger.info("Configure connection to your SQL Server database.")
        Logger.info("This is where MemberJunction will store all data.\n")
        
        config['dbUrl'] = ConfigurationWizard._get_input(
            "Database Host (IP or hostname)", 
            default="localhost", 
            required=True
        )
        
        config['dbPort'] = int(ConfigurationWizard._get_input(
            "Database Port", 
            default="1433", 
            required=True
        ))
        
        config['dbDatabase'] = ConfigurationWizard._get_input(
            "Database Name", 
            default="MJ_Production", 
            required=True
        )
        
        config['dbInstance'] = ConfigurationWizard._get_input(
            "Database Instance (named instance, if applicable)", 
            default="", 
            required=False
        )
        
        trust_cert = ConfigurationWizard._get_input(
            "Trust Server Certificate? (Y/n)", 
            default="Y", 
            required=False
        )
        config['dbTrustServerCertificate'] = trust_cert.upper() if trust_cert else "Y"
        
        # ===== DATABASE CREDENTIALS =====
        Logger.header("\n" + "="*60)
        Logger.header("DATABASE CREDENTIALS")
        Logger.header("="*60)
        Logger.info("Two database users are needed:")
        Logger.info("  1. CodeGen User: Needs elevated permissions (db_owner) for schema changes")
        Logger.info("  2. MJAPI User: Runtime user with read/write permissions only\n")
        
        Logger.info("--- CodeGen User (Elevated Permissions) ---")
        config['codeGenLogin'] = ConfigurationWizard._get_input(
            "CodeGen Username", 
            default="codegen_user", 
            required=True
        )
        
        config['codeGenPwD'] = ConfigurationWizard._get_input(
            "CodeGen Password", 
            default="", 
            required=True,
            secret=True
        )
        
        Logger.info("\n--- MJAPI Runtime User (Standard Permissions) ---")
        config['mjAPILogin'] = ConfigurationWizard._get_input(
            "MJAPI Username", 
            default="mjapi_user", 
            required=True
        )
        
        config['mjAPIPwD'] = ConfigurationWizard._get_input(
            "MJAPI Password", 
            default="", 
            required=True,
            secret=True
        )
        
        # ===== GRAPHQL SERVER CONFIGURATION =====
        Logger.header("\n" + "="*60)
        Logger.header("GRAPHQL SERVER CONFIGURATION")
        Logger.header("="*60)
        Logger.info("Configure the GraphQL API server settings.\n")
        
        config['graphQLPort'] = int(ConfigurationWizard._get_input(
            "GraphQL Server Port", 
            default="4000", 
            required=True
        ))
        
        # ===== AUTHENTICATION CONFIGURATION =====
        Logger.header("\n" + "="*60)
        Logger.header("AUTHENTICATION CONFIGURATION")
        Logger.header("="*60)
        Logger.info("MemberJunction supports multiple authentication providers:")
        Logger.info("  • MSAL (Microsoft Azure Active Directory) - Recommended for Microsoft 365 users")
        Logger.info("  • Auth0 - Flexible authentication platform")
        Logger.info("  • Okta - Enterprise identity management (configure manually later)")
        Logger.info("  • AWS Cognito - AWS-based authentication (configure manually later)")
        Logger.info("  • Google OAuth - Google authentication (configure manually later)\n")
        
        auth_type = ConfigurationWizard._get_input(
            "Primary Auth Type (MSAL/Auth0)", 
            default="MSAL", 
            required=True
        ).upper()
        
        config['authType'] = auth_type if auth_type in ['MSAL', 'AUTH0'] else 'MSAL'
        
        if config['authType'] == 'MSAL':
            Logger.info("\n--- Microsoft Azure AD (MSAL) Configuration ---")
            Logger.info("To get these values:")
            Logger.info("  1. Go to Azure Portal > Azure Active Directory > App Registrations")
            Logger.info("  2. Create a new registration (if needed)")
            Logger.info("  3. Note the Application (client) ID and Directory (tenant) ID")
            Logger.info("  4. Add redirect URI: http://localhost:4200\n")
            
            config['msalWebClientId'] = ConfigurationWizard._get_input(
                "MSAL Application (Client) ID", 
                default="", 
                required=True
            )
            
            config['msalTenantId'] = ConfigurationWizard._get_input(
                "MSAL Directory (Tenant) ID", 
                default="", 
                required=True
            )
            
            config['auth0ClientId'] = ""
            config['auth0ClientSecret'] = ""
            config['auth0Domain'] = ""
            
        else:  # Auth0
            Logger.info("\n--- Auth0 Configuration ---")
            Logger.info("To get these values:")
            Logger.info("  1. Go to auth0.com and create an account (if needed)")
            Logger.info("  2. Create a new application")
            Logger.info("  3. Note the Domain, Client ID, and Client Secret")
            Logger.info("  4. Add Allowed Callback URL: http://localhost:4200/callback\n")
            
            config['auth0Domain'] = ConfigurationWizard._get_input(
                "Auth0 Domain (e.g., your-tenant.auth0.com)", 
                default="", 
                required=True
            )
            
            config['auth0ClientId'] = ConfigurationWizard._get_input(
                "Auth0 Client ID", 
                default="", 
                required=True
            )
            
            config['auth0ClientSecret'] = ConfigurationWizard._get_input(
                "Auth0 Client Secret", 
                default="", 
                required=True,
                secret=True
            )
            
            config['msalWebClientId'] = ""
            config['msalTenantId'] = ""
        
        # ===== INITIAL ADMIN USER =====
        Logger.header("\n" + "="*60)
        Logger.header("INITIAL ADMIN USER SETUP")
        Logger.header("="*60)
        Logger.info("Create the first admin user for accessing MemberJunction.\n")
        
        create_user = ConfigurationWizard._get_input(
            "Create initial admin user? (Y/n)", 
            default="Y", 
            required=False
        )
        
        config['createNewUser'] = create_user.upper() if create_user else "Y"
        
        if config['createNewUser'].upper() == 'Y':
            config['userEmail'] = ConfigurationWizard._get_input(
                "Admin User Email", 
                default="", 
                required=True
            )
            
            config['userFirstName'] = ConfigurationWizard._get_input(
                "Admin User First Name", 
                default="", 
                required=True
            )
            
            config['userLastName'] = ConfigurationWizard._get_input(
                "Admin User Last Name", 
                default="", 
                required=True
            )
            
            config['userName'] = ConfigurationWizard._get_input(
                "Admin Username", 
                default=config['userEmail'].split('@')[0] if '@' in config['userEmail'] else "admin", 
                required=True
            )
        else:
            config['userEmail'] = ""
            config['userFirstName'] = ""
            config['userLastName'] = ""
            config['userName'] = ""
        
        # ===== AI PROVIDER API KEYS (OPTIONAL) =====
        Logger.header("\n" + "="*60)
        Logger.header("AI PROVIDER CONFIGURATION (Optional)")
        Logger.header("="*60)
        Logger.info("MemberJunction integrates with 15+ AI providers for enhanced functionality.")
        Logger.info("You can configure these now or add them later via environment variables.")
        Logger.info("Supported providers: OpenAI, Anthropic, Google, Mistral, Cohere, and more.\n")
        
        configure_ai = ConfigurationWizard._get_input(
            "Configure AI providers now? (y/N)", 
            default="N", 
            required=False
        )
        
        if configure_ai.upper() == 'Y':
            Logger.info("\n--- OpenAI Configuration ---")
            Logger.info("For GPT-4, GPT-3.5, DALL-E, Whisper, and embeddings")
            Logger.info("Get API key from: https://platform.openai.com/api-keys\n")
            config['openAIAPIKey'] = ConfigurationWizard._get_input(
                "OpenAI API Key (sk-...)", 
                default="", 
                required=False,
                secret=True
            )
            
            Logger.info("\n--- Anthropic Configuration ---")
            Logger.info("For Claude models (Claude 3.5 Sonnet, Claude 3 Opus, etc.)")
            Logger.info("Get API key from: https://console.anthropic.com/\n")
            config['anthropicAPIKey'] = ConfigurationWizard._get_input(
                "Anthropic API Key (sk-ant-...)", 
                default="", 
                required=False,
                secret=True
            )
            
            Logger.info("\n--- Mistral AI Configuration ---")
            Logger.info("For Mistral models (Mistral Large, Mistral Medium, etc.)")
            Logger.info("Get API key from: https://console.mistral.ai/\n")
            config['mistralAPIKey'] = ConfigurationWizard._get_input(
                "Mistral API Key", 
                default="", 
                required=False,
                secret=True
            )
            
            Logger.info("\n--- Google AI Configuration ---")
            Logger.info("For Gemini models and Google AI services")
            Logger.info("Get API key from: https://makersuite.google.com/app/apikey\n")
            config['googleAPIKey'] = ConfigurationWizard._get_input(
                "Google AI API Key", 
                default="", 
                required=False,
                secret=True
            )
            
            Logger.info("\n--- Additional AI Providers ---")
            Logger.info("Other providers (Cohere, Azure OpenAI, etc.) can be configured via environment variables")
            Logger.info("See INSTRUCTIONS.md for details on all supported providers\n")
        else:
            config['openAIAPIKey'] = ""
            config['anthropicAPIKey'] = ""
            config['mistralAPIKey'] = ""
            config['googleAPIKey'] = ""
        
        # ===== ADDITIONAL OPTIONAL SETTINGS =====
        Logger.header("\n" + "="*60)
        Logger.header("ADDITIONAL SETTINGS (Optional)")
        Logger.header("="*60)
        Logger.info("Additional configuration options for advanced users.\n")
        
        configure_advanced = ConfigurationWizard._get_input(
            "Configure advanced settings? (y/N)", 
            default="N", 
            required=False
        )
        
        if configure_advanced.upper() == 'Y':
            Logger.info("\n--- MCP Server Configuration ---")
            Logger.info("Model Context Protocol server for AI agent integration")
            config['mcpServerPort'] = int(ConfigurationWizard._get_input(
                "MCP Server Port", 
                default="3100", 
                required=False
            ) or "3100")
            
            Logger.info("\n--- A2A Server Configuration ---")
            Logger.info("Agent-to-Agent communication server")
            config['a2aServerPort'] = int(ConfigurationWizard._get_input(
                "A2A Server Port", 
                default="3200", 
                required=False
            ) or "3200")
            
            Logger.info("\n--- Logging Configuration ---")
            config['logLevel'] = ConfigurationWizard._get_input(
                "Log Level (debug/info/warn/error)", 
                default="info", 
                required=False
            ) or "info"
        else:
            config['mcpServerPort'] = 3100
            config['a2aServerPort'] = 3200
            config['logLevel'] = "info"
        
        # ===== CONFIGURATION SUMMARY =====
        Logger.header("\n" + "="*60)
        Logger.header("CONFIGURATION SUMMARY")
        Logger.header("="*60)
        Logger.info("Please review your configuration:\n")
        
        Logger.info(f"Database: {config['dbUrl']}:{config['dbPort']}/{config['dbDatabase']}")
        Logger.info(f"CodeGen User: {config['codeGenLogin']}")
        Logger.info(f"MJAPI User: {config['mjAPILogin']}")
        Logger.info(f"GraphQL Port: {config['graphQLPort']}")
        Logger.info(f"Auth Type: {config['authType']}")
        if config['createNewUser'].upper() == 'Y':
            Logger.info(f"Admin User: {config['userName']} ({config['userEmail']})")
        Logger.info(f"AI Providers: {len([k for k in ['openAIAPIKey', 'anthropicAPIKey', 'mistralAPIKey', 'googleAPIKey'] if config.get(k)])} configured")
        
        Logger.info("\n")
        confirm = ConfigurationWizard._get_input(
            "Is this configuration correct? (Y/n)", 
            default="Y", 
            required=False
        )
        
        if confirm.upper() == 'N':
            Logger.warning("Configuration cancelled. Restarting wizard...")
            return ConfigurationWizard.run()
        
        return config
    
    @staticmethod
    def save_config(config: Dict, filename: str = "install.config.json"):
        """Save configuration to file."""
        with open(filename, 'w') as f:
            json.dump(config, f, indent=4)
        Logger.success(f"Configuration saved to {filename}")

class SetupExecutor:
    """Executes setup phases with error handling and recovery."""
    
    def __init__(self, state: SetupState):
        self.state = state
    
    def run_command(self, cmd: List[str], phase: str, shell: bool = False, timeout: int = 600) -> bool:
        """Run a command with error handling."""
        try:
            Logger.info(f"Running: {' '.join(cmd)}")
            result = subprocess.run(
                cmd, 
                capture_output=True, 
                text=True, 
                shell=shell,
                timeout=timeout,
                cwd=os.getcwd()
            )
            
            if result.returncode != 0:
                error_msg = result.stderr or result.stdout
                Logger.error(f"Command failed with return code {result.returncode}")
                Logger.error(error_msg)
                
                # Analyze error and provide solution
                context = {
                    'current_path': os.getcwd(),
                    'port': '4000',
                    'phase': phase
                }
                solution = ErrorAnalyzer.analyze(error_msg, context)
                Logger.warning(solution)
                
                self.state.mark_phase_failed(phase, error_msg)
                return False
            
            Logger.debug(result.stdout)
            return True
        
        except subprocess.TimeoutExpired:
            Logger.error(f"Command timed out after {timeout} seconds")
            self.state.mark_phase_failed(phase, f"Timeout after {timeout}s")
            return False
        
        except Exception as e:
            Logger.error(f"Exception running command: {e}")
            self.state.mark_phase_failed(phase, str(e))
            return False
    
    def phase_database_setup(self) -> bool:
        """Execute database setup phase."""
        Logger.header("🗄️ Database Setup Phase")
        
        # Check if SQL scripts exist
        sql_scripts_path = Path("SQL Scripts/install")
        if not sql_scripts_path.exists():
            Logger.error("SQL Scripts directory not found.")
            return False
        
        structure_sql = list(sql_scripts_path.glob("MJ_BASE_Structure*.sql"))
        dataset_sql = list(sql_scripts_path.glob("MJ_BASE_Dataset*.sql"))
        
        if not structure_sql or not dataset_sql:
            Logger.error("Required SQL installation scripts not found.")
            Logger.info("Looking for: MJ_BASE_Structure*.sql and MJ_BASE_Dataset*.sql")
            return False
        
        Logger.info("Database setup files found.")
        Logger.warning("Please execute the following SQL scripts in SQL Server Management Studio:")
        Logger.info(f"1. {structure_sql[0]}")
        Logger.info(f"2. {dataset_sql[0]}")
        Logger.info("\nPress Enter when database setup is complete...")
        input()
        
        return True
    
    def phase_packages(self) -> bool:
        """Execute package installation phase."""
        Logger.header("📦 Package Installation Phase")
        Logger.info("This may take 10-15 minutes depending on your internet connection...")
        
        return self.run_command(['npm', 'install'], 'packages', timeout=1800)
    
    def phase_codegen(self) -> bool:
        """Execute code generation phase."""
        Logger.header("🔄 Code Generation Phase")
        Logger.info("Generating entity classes, GraphQL schemas, and Angular components...")
        Logger.info("This may take 5-10 minutes...")
        
        # Run InstallMJ.js which handles CodeGen and other setup
        return self.run_command(['node', 'InstallMJ.js'], 'codegen', timeout=1800)
    
    def phase_build(self) -> bool:
        """Execute build phase."""
        Logger.header("🏗️ Build All Packages Phase")
        Logger.info("Building all 70+ packages in dependency order...")
        Logger.info("This may take 15-25 minutes...")
        
        # Increase Node.js memory for build
        env = os.environ.copy()
        env['NODE_OPTIONS'] = '--max-old-space-size=8192'
        
        try:
            result = subprocess.run(
                ['npm', 'run', 'build'],
                capture_output=True,
                text=True,
                timeout=2400,
                cwd=os.getcwd(),
                env=env
            )
            
            if result.returncode != 0:
                Logger.error("Build failed")
                Logger.error(result.stderr or result.stdout)
                return False
            
            Logger.debug(result.stdout)
            return True
        
        except Exception as e:
            Logger.error(f"Build exception: {e}")
            return False
    
    def execute_all(self, start_from: Optional[str] = None) -> bool:
        """Execute all setup phases."""
        phases = [
            ('database', self.phase_database_setup),
            ('packages', self.phase_packages),
            ('codegen', self.phase_codegen),
            ('build', self.phase_build)
        ]
        
        # Start from specific phase if resuming
        if start_from:
            phase_names = [p[0] for p in phases]
            if start_from in phase_names:
                start_idx = phase_names.index(start_from)
                phases = phases[start_idx:]
        
        for phase_name, phase_func in phases:
            Logger.header(f"\n{'='*60}")
            Logger.header(f"Phase: {SetupState.PHASES.get(phase_name, phase_name)}")
            Logger.header(f"{'='*60}\n")
            
            if not phase_func():
                Logger.error(f"❌ Phase '{phase_name}' failed!")
                Logger.warning("Setup interrupted. You can resume by running this script again.")
                Logger.warning("The script will automatically resume from the failed phase.")
                return False
            
            self.state.mark_phase_complete(phase_name)
            Logger.success(f"✓ Phase '{phase_name}' completed successfully!\n")
            time.sleep(1)
        
        return True

def main():
    """Main setup script entry point."""
    
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description="MemberJunction Intelligent Setup Script")
    parser.add_argument('--dry-run', action='store_true', help="Check prerequisites without installing")
    parser.add_argument('--skip-prereqs', action='store_true', help="Skip prerequisite checks")
    parser.add_argument('--skip-database', action='store_true', help="Skip database setup phase")
    parser.add_argument('--start-from', choices=['prerequisites', 'configuration', 'database', 'packages', 'codegen', 'build'], help="Start from specific phase")
    args = parser.parse_args()
    
    # Print banner
    os_name = "Cross-Platform" if platform.system() != 'Windows' else "Windows"
    print(f"""
{Colors.HEADER}{Colors.BOLD}
╔═══════════════════════════════════════════════════════════════╗
║  MemberJunction Intelligent Setup Script                     ║
║  Version 2.0 - {os_name:<45s} ║
╚═══════════════════════════════════════════════════════════════╝
{Colors.ENDC}
    """)
    
    # Initialize state management
    state = SetupState()
    
    # Check if resuming from previous run
    if state.state['completed_phases']:
        Logger.warning("Detected previous setup run.")
        Logger.info(f"Completed phases: {', '.join(state.state['completed_phases'])}")
        Logger.info(f"Resume from: {state.get_resume_phase()}")
        
        resume = input(f"\n{Colors.YELLOW}Do you want to resume from last checkpoint? [Y/n]: {Colors.ENDC}").strip()
        if resume.upper() != 'N':
            Logger.info("Resuming from checkpoint...")
        else:
            Logger.info("Starting fresh setup...")
            state.clear()
    
    # Phase 1: Prerequisites
    if not args.skip_prereqs and state.can_resume_from('prerequisites'):
        if not PrerequisitesChecker.check_all():
            if args.dry_run:
                Logger.warning("\n⚠️ Prerequisites check failed (dry-run mode)")
                Logger.info("Install missing prerequisites before running actual setup.")
                sys.exit(0)
            else:
                Logger.error("\n❌ Prerequisites check failed!")
                Logger.error("Please install missing prerequisites and run this script again.")
                Logger.info("Refer to INSTRUCTIONS.md for detailed installation instructions.")
                Logger.info("\nTip: Run with --dry-run to check prerequisites without installing")
                sys.exit(1)
        
        if args.dry_run:
            Logger.success("\n✓ All prerequisites satisfied! Ready for installation.")
            Logger.info("\nRun without --dry-run to proceed with installation.")
            sys.exit(0)
        
        state.mark_phase_complete('prerequisites')
        Logger.success("\n✓ All prerequisites satisfied!\n")
        time.sleep(2)
    elif args.skip_prereqs:
        Logger.warning("Skipping prerequisites check (--skip-prereqs)")
        state.mark_phase_complete('prerequisites')
    
    # Phase 2: Configuration
    if state.can_resume_from('configuration'):
        config_file = "install.config.json"
        
        if os.path.exists(config_file):
            Logger.info(f"Found existing configuration: {config_file}")
            use_existing = input(f"{Colors.CYAN}Use existing configuration? [Y/n]: {Colors.ENDC}").strip()
            if use_existing.upper() == 'N':
                config = ConfigurationWizard.run()
                ConfigurationWizard.save_config(config)
        else:
            config = ConfigurationWizard.run()
            ConfigurationWizard.save_config(config)
        
        state.mark_phase_complete('configuration')
        Logger.success("\n✓ Configuration completed!\n")
        time.sleep(1)
    
    # Phase 3-6: Execute installation
    executor = SetupExecutor(state)
    resume_phase = state.get_resume_phase()
    
    if executor.execute_all(start_from=resume_phase):
        state.mark_phase_complete('complete')
        state.clear()  # Clear checkpoint on successful completion
        
        Logger.header(f"\n{'='*60}")
        Logger.success("🎉 Setup Complete!")
        Logger.header(f"{'='*60}\n")
        
        Logger.success("MemberJunction has been successfully installed!")
        Logger.info("\nNext Steps:")
        Logger.info("1. Start the API server:")
        Logger.info("   npm run start:api")
        Logger.info("\n2. In another terminal, start the Explorer UI:")
        Logger.info("   npm run start:explorer")
        Logger.info("\n3. Open your browser to: http://localhost:4200")
        Logger.info("\nFor more information, see INSTRUCTIONS.md")
        Logger.info("\nFor starting and managing services, use: python start.py")
        
        return 0
    else:
        Logger.error("\n❌ Setup failed!")
        Logger.warning("Check setup.log for detailed error information.")
        Logger.warning("Run this script again to resume from the last checkpoint.")
        Logger.info("\nFor troubleshooting, refer to INSTRUCTIONS.md")
        return 1

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        Logger.warning("\n\n⚠️ Setup interrupted by user.")
        Logger.info("Progress has been saved. Run this script again to resume.")
        sys.exit(1)
    except Exception as e:
        Logger.error(f"\n❌ Unexpected error: {e}")
        Logger.error("Please check setup.log for details.")
        sys.exit(1)
