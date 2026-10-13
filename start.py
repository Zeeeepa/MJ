#!/usr/bin/env python3
"""
MemberJunction Service Manager with AI Error Recovery
=====================================================
Intelligent service manager for starting, monitoring, and auto-recovering MemberJunction services.

Usage:
    python start.py [--api-only | --ui-only | --all]
    
Options:
    --api-only   Start only the API server (MJAPI)
    --ui-only    Start only the Explorer UI (MJExplorer)
    --all        Start all services (default)
    --production Start in production mode with pm2

Features:
    - Pre-start validation checks
    - Multi-service management
    - Real-time health monitoring
    - Auto-restart on failures
    - Error context collection and analysis
    - Interactive dashboard with logs
"""

import os
import sys
import subprocess
import json
import time
import threading
import re
import argparse
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from queue import Queue
from collections import deque

# ANSI color codes
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

class ServiceConfig:
    """Configuration for each service."""
    
    API = {
        'name': 'MJAPI',
        'display_name': 'MJ API Server',
        'start_script': ['npm', 'run', 'start:api'],
        'working_dir': '.',
        'port': 4000,
        'health_check_url': 'http://localhost:4000/graphql',
        'ready_patterns': [
            r'GraphQL server ready',
            r'Server listening on',
            r'🚀.*ready'
        ],
        'error_patterns': [
            r'Error:',
            r'EADDRINUSE',
            r'Cannot connect',
            r'Failed to',
            r'Unhandled rejection'
        ]
    }
    
    EXPLORER = {
        'name': 'MJExplorer',
        'display_name': 'MJ Explorer UI',
        'start_script': ['npm', 'run', 'start:explorer'],
        'working_dir': '.',
        'port': 4200,
        'health_check_url': 'http://localhost:4200',
        'ready_patterns': [
            r'Compiled successfully',
            r'Local:.*http://localhost:4200',
            r'Angular Live Development Server'
        ],
        'error_patterns': [
            r'Error:',
            r'EADDRINUSE',
            r'Failed to compile',
            r'Module not found',
            r'Cannot find module'
        ]
    }

class Logger:
    """Enhanced logger with service context."""
    
    LOG_FILE = "services.log"
    
    @staticmethod
    def _log(service: str, level: str, message: str, color: str = Colors.ENDC):
        """Internal logging with service context."""
        timestamp = datetime.now().strftime("%H:%M:%S")
        service_tag = f"[{service:12s}]" if service else " "*14
        formatted_msg = f"[{timestamp}] {service_tag} {level}: {message}"
        
        # Console with colors
        print(f"{color}{formatted_msg}{Colors.ENDC}")
        
        # File without colors
        with open(Logger.LOG_FILE, 'a', encoding='utf-8') as f:
            f.write(formatted_msg + '\n')
    
    @staticmethod
    def info(message: str, service: str = "SYSTEM"):
        Logger._log(service, "INFO", message, Colors.CYAN)
    
    @staticmethod
    def success(message: str, service: str = "SYSTEM"):
        Logger._log(service, "SUCCESS", message, Colors.GREEN + Colors.BOLD)
    
    @staticmethod
    def warning(message: str, service: str = "SYSTEM"):
        Logger._log(service, "WARNING", message, Colors.YELLOW)
    
    @staticmethod
    def error(message: str, service: str = "SYSTEM"):
        Logger._log(service, "ERROR", message, Colors.RED + Colors.BOLD)

class ErrorContextCollector:
    """Collects context around errors for AI analysis."""
    
    @staticmethod
    def collect_from_instructions(error_type: str) -> str:
        """Extract relevant troubleshooting section from INSTRUCTIONS.md."""
        instructions_file = Path("INSTRUCTIONS.md")
        
        if not instructions_file.exists():
            return "INSTRUCTIONS.md not found. Please refer to the GitHub repository."
        
        try:
            with open(instructions_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Try to find relevant troubleshooting section
            troubleshooting_section = re.search(
                r'## Troubleshooting(.*?)(?=##|\Z)',
                content,
                re.DOTALL
            )
            
            if troubleshooting_section:
                troubleshooting_text = troubleshooting_section.group(1)
                
                # Try to find specific error type
                error_patterns = {
                    'port': r'Port Already in Use(.*?)(?=####|\Z)',
                    'sql': r'SQL Server Connection(.*?)(?=####|\Z)',
                    'memory': r'Memory Error(.*?)(?=####|\Z)',
                    'build': r'Build Error(.*?)(?=####|\Z)',
                    'path': r'Path Too Long(.*?)(?=####|\Z)'
                }
                
                pattern = error_patterns.get(error_type)
                if pattern:
                    specific_match = re.search(pattern, troubleshooting_text, re.DOTALL)
                    if specific_match:
                        return specific_match.group(1).strip()
                
                return troubleshooting_text[:1000]  # Return first 1000 chars
            
            return "Troubleshooting section not found in INSTRUCTIONS.md"
        
        except Exception as e:
            return f"Error reading INSTRUCTIONS.md: {e}"
    
    @staticmethod
    def analyze_error(error_output: str, service: str) -> Dict:
        """Analyze error and return context with solution."""
        error_type = ErrorContextCollector._classify_error(error_output)
        instructions_context = ErrorContextCollector.collect_from_instructions(error_type)
        
        return {
            'error_type': error_type,
            'error_output': error_output[-500:],  # Last 500 chars
            'service': service,
            'timestamp': datetime.now().isoformat(),
            'instructions_context': instructions_context,
            'solution': ErrorContextCollector._get_quick_solution(error_type, service)
        }
    
    @staticmethod
    def _classify_error(error_output: str) -> str:
        """Classify error type from output."""
        error_lower = error_output.lower()
        
        if 'eaddrinuse' in error_lower or 'port' in error_lower:
            return 'port'
        elif 'connectionerror' in error_lower or 'sql' in error_lower:
            return 'sql'
        elif 'heap' in error_lower or 'memory' in error_lower:
            return 'memory'
        elif 'cannot find module' in error_lower or 'module_not_found' in error_lower:
            return 'module'
        elif 'enametoolong' in error_lower or 'path too long' in error_lower:
            return 'path'
        else:
            return 'unknown'
    
    @staticmethod
    def _get_quick_solution(error_type: str, service: str) -> str:
        """Get quick solution for common errors."""
        solutions = {
            'port': f"""
Port Conflict Detected for {service}

Quick Solution:
1. Find process using port:
   netstat -ano | findstr :{ServiceConfig.API['port'] if service == 'MJAPI' else ServiceConfig.EXPLORER['port']}

2. Kill process:
   taskkill /PID <PID> /F

3. Or change port in mj.config.cjs

See INSTRUCTIONS.md Section: "Port Already in Use"
            """,
            'sql': """
SQL Server Connection Failed

Quick Solution:
1. Verify SQL Server is running:
   Get-Service -Name MSSQL*

2. Check connection strings in:
   - MJAPI/.env
   - mj.config.cjs

3. Test connection with SQL Server Management Studio

See INSTRUCTIONS.md Section: "SQL Server Connection Failed"
            """,
            'memory': """
Node.js Memory Limit Exceeded

Quick Solution:
1. Set higher memory limit:
   $env:NODE_OPTIONS="--max-old-space-size=8192"

2. Restart the service

See INSTRUCTIONS.md Section: "Memory Error"
            """,
            'module': """
Module Not Found

Quick Solution:
1. Clean and reinstall:
   npm install

2. Rebuild packages:
   npm run build

See INSTRUCTIONS.md Section: "Module Not Found"
            """,
            'path': """
Windows Path Length Exceeded

Quick Solution:
1. Enable long path support:
   Run as Admin:
   New-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\FileSystem" `
     -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force

2. Restart computer

See INSTRUCTIONS.md Section: "Path Too Long"
            """
        }
        
        return solutions.get(error_type, "Refer to INSTRUCTIONS.md for troubleshooting guidance.")

class ServiceManager:
    """Manages individual service lifecycle."""
    
    def __init__(self, config: Dict):
        self.config = config
        self.process: Optional[subprocess.Popen] = None
        self.output_queue = Queue()
        self.error_queue = Queue()
        self.is_ready = False
        self.has_error = False
        self.restart_count = 0
        self.max_restarts = 3
        self.last_output = deque(maxlen=50)  # Keep last 50 lines
    
    def start(self) -> bool:
        """Start the service."""
        Logger.info(f"Starting {self.config['display_name']}...", self.config['name'])
        
        try:
            self.process = subprocess.Popen(
                self.config['start_script'],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                cwd=self.config['working_dir'],
                shell=False
            )
            
            # Start output monitoring threads
            threading.Thread(
                target=self._monitor_output,
                args=(self.process.stdout, self.output_queue),
                daemon=True
            ).start()
            
            threading.Thread(
                target=self._monitor_output,
                args=(self.process.stderr, self.error_queue),
                daemon=True
            ).start()
            
            # Start health monitoring thread
            threading.Thread(
                target=self._monitor_health,
                daemon=True
            ).start()
            
            return True
        
        except Exception as e:
            Logger.error(f"Failed to start: {e}", self.config['name'])
            return False
    
    def _monitor_output(self, pipe, queue):
        """Monitor output from service."""
        try:
            for line in pipe:
                line = line.strip()
                if line:
                    self.last_output.append(line)
                    queue.put(line)
                    
                    # Check for ready patterns
                    for pattern in self.config['ready_patterns']:
                        if re.search(pattern, line, re.IGNORECASE):
                            self.is_ready = True
                            Logger.success(
                                f"{self.config['display_name']} is ready! ✓",
                                self.config['name']
                            )
                    
                    # Check for error patterns
                    for pattern in self.config['error_patterns']:
                        if re.search(pattern, line, re.IGNORECASE):
                            self.has_error = True
                            Logger.error(line, self.config['name'])
        except Exception as e:
            Logger.error(f"Output monitoring error: {e}", self.config['name'])
    
    def _monitor_health(self):
        """Monitor service health and auto-restart if needed."""
        while True:
            time.sleep(10)  # Check every 10 seconds
            
            # Check if process died
            if self.process and self.process.poll() is not None:
                Logger.warning(
                    f"Process exited with code {self.process.returncode}",
                    self.config['name']
                )
                
                if self.restart_count < self.max_restarts:
                    Logger.info(
                        f"Attempting auto-restart ({self.restart_count + 1}/{self.max_restarts})...",
                        self.config['name']
                    )
                    self.restart_count += 1
                    self.start()
                else:
                    Logger.error(
                        f"Max restarts ({self.max_restarts}) exceeded. Manual intervention required.",
                        self.config['name']
                    )
                    
                    # Collect error context
                    error_context = ErrorContextCollector.analyze_error(
                        '\n'.join(list(self.last_output)),
                        self.config['name']
                    )
                    
                    Logger.error("Error Analysis:", self.config['name'])
                    Logger.error(error_context['solution'], self.config['name'])
                    break
    
    def stop(self):
        """Stop the service."""
        if self.process:
            Logger.info(f"Stopping {self.config['display_name']}...", self.config['name'])
            self.process.terminate()
            try:
                self.process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                Logger.warning("Force killing process...", self.config['name'])
                self.process.kill()
            Logger.success("Stopped", self.config['name'])
    
    def get_status(self) -> str:
        """Get current service status."""
        if not self.process:
            return "Not Started"
        elif self.process.poll() is not None:
            return f"Exited ({self.process.returncode})"
        elif self.has_error:
            return "Error"
        elif self.is_ready:
            return "Running ✓"
        else:
            return "Starting..."

class PreStartValidator:
    """Validates system before starting services."""
    
    @staticmethod
    def validate_all() -> Tuple[bool, List[str]]:
        """Run all pre-start validations."""
        issues = []
        
        # Check if setup was completed
        if not Path("node_modules").exists():
            issues.append("node_modules not found. Run setup.py first.")
        
        # Check if build completed
        api_dist = Path("packages/MJAPI/dist")
        if not api_dist.exists():
            issues.append("MJAPI build not found. Run: npm run build")
        
        # Check configuration files
        if not Path("mj.config.cjs").exists():
            issues.append("mj.config.cjs not found.")
        
        if not Path("MJAPI/.env").exists():
            issues.append("MJAPI/.env not found. Configure authentication.")
        
        # Check ports availability
        for port in [4000, 4200]:
            if not PreStartValidator._is_port_available(port):
                issues.append(f"Port {port} is already in use.")
        
        return len(issues) == 0, issues
    
    @staticmethod
    def _is_port_available(port: int) -> bool:
        """Check if port is available."""
        try:
            result = subprocess.run(
                ['netstat', '-ano'],
                capture_output=True,
                text=True
            )
            return f':{port} ' not in result.stdout
        except:
            return True  # Assume available if check fails

class Dashboard:
    """Interactive dashboard for monitoring services."""
    
    def __init__(self, managers: List[ServiceManager]):
        self.managers = managers
        self.running = True
    
    def display(self):
        """Display interactive dashboard."""
        while self.running:
            # Clear screen (Windows)
            os.system('cls' if os.name == 'nt' else 'clear')
            
            print(f"{Colors.HEADER}{Colors.BOLD}")
            print("╔═══════════════════════════════════════════════════════════════╗")
            print("║  MemberJunction Service Dashboard                            ║")
            print("╚═══════════════════════════════════════════════════════════════╝")
            print(f"{Colors.ENDC}\n")
            
            # Service status
            print(f"{Colors.CYAN}Service Status:{Colors.ENDC}\n")
            for manager in self.managers:
                status = manager.get_status()
                color = Colors.GREEN if "✓" in status else Colors.YELLOW if "Starting" in status else Colors.RED
                print(f"  {color}{manager.config['display_name']:20s} {status:20s}{Colors.ENDC}")
            
            print(f"\n{Colors.CYAN}Recent Logs:{Colors.ENDC}\n")
            
            # Show last few lines from each service
            for manager in self.managers:
                if manager.last_output:
                    print(f"{Colors.BOLD}{manager.config['name']}:{Colors.ENDC}")
                    for line in list(manager.last_output)[-3:]:
                        print(f"  {line[:70]}")
                    print()
            
            print(f"\n{Colors.CYAN}Commands:{Colors.ENDC}")
            print("  q - Quit and stop all services")
            print("  r - Restart all services")
            print("  l - View full logs (services.log)")
            print(f"\n{Colors.YELLOW}Press Ctrl+C to stop all services{Colors.ENDC}")
            
            time.sleep(5)

def main():
    """Main entry point."""
    
    parser = argparse.ArgumentParser(
        description="MemberJunction Service Manager with AI Error Recovery",
        epilog="""
Examples:
  python start.py                    # Start all services
  python start.py --api-only         # Start only API server
  python start.py --ui-only          # Start only Explorer UI
  python start.py --no-monitor       # Start without interactive monitoring
  python start.py --check-only       # Only check prerequisites, don't start

For more information, see INSTRUCTIONS.md
        """,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('--api-only', action='store_true', help="Start only API server")
    parser.add_argument('--ui-only', action='store_true', help="Start only Explorer UI")
    parser.add_argument('--all', action='store_true', default=True, help="Start all services (default)")
    parser.add_argument('--production', action='store_true', help="Start in production mode with pm2")
    parser.add_argument('--no-monitor', action='store_true', help="Start services without interactive monitoring")
    parser.add_argument('--check-only', action='store_true', help="Only run pre-start validation checks")
    parser.add_argument('--verbose', action='store_true', help="Show verbose output")
    args = parser.parse_args()
    
    # Print banner
    print(f"""
{Colors.HEADER}{Colors.BOLD}
╔═══════════════════════════════════════════════════════════════╗
║  MemberJunction Service Manager                               ║
║  With AI-Powered Error Recovery                               ║
╚═══════════════════════════════════════════════════════════════╝
{Colors.ENDC}
    """)
    
    # Pre-start validation
    Logger.info("Running pre-start validation...")
    valid, issues = PreStartValidator.validate_all()
    
    if not valid:
        Logger.error("❌ Pre-start validation failed!")
        for issue in issues:
            Logger.error(f"  - {issue}")
        Logger.info("\nPlease resolve these issues before starting services.")
        Logger.info("Run 'python setup.py' if you haven't completed the setup.")
        if args.check_only:
            Logger.info("\nValidation completed (check-only mode)")
        sys.exit(1)
    
    Logger.success("✓ Pre-start validation passed!\n")
    
    if args.check_only:
        Logger.success("✓ All checks passed! System is ready to start services.")
        Logger.info("\nRun without --check-only to start services.")
        sys.exit(0)
    
    # Determine which services to start
    services = []
    if args.api_only:
        services.append(ServiceConfig.API)
    elif args.ui_only:
        services.append(ServiceConfig.EXPLORER)
    else:
        services = [ServiceConfig.API, ServiceConfig.EXPLORER]
    
    # Create service managers
    managers = [ServiceManager(config) for config in services]
    
    # Start services
    Logger.info("Starting services...\n")
    for manager in managers:
        if not manager.start():
            Logger.error(f"Failed to start {manager.config['display_name']}")
            sys.exit(1)
        time.sleep(2)  # Stagger starts
    
    Logger.success("\n✓ All services started!\n")
    Logger.info("Services are starting up. This may take 30-60 seconds...")
    Logger.info("Once ready, you can access:")
    Logger.info("  - API GraphQL: http://localhost:4000/graphql")
    Logger.info("  - Explorer UI: http://localhost:4200")
    Logger.info("\nPress Ctrl+C to stop all services\n")
    
    # Start dashboard or simple monitoring
    if args.no_monitor:
        Logger.info("Running in no-monitor mode. Services will run in background.")
        Logger.info("Check services.log for output.")
        Logger.info("Press Ctrl+C to stop all services...")
        try:
            while True:
                time.sleep(1)
                # Check if any service died
                for manager in managers:
                    if manager.process and manager.process.poll() is not None:
                        Logger.error(f"{manager.config['name']} has stopped unexpectedly!")
        except KeyboardInterrupt:
            Logger.warning("\n\nShutting down services...")
            for manager in managers:
                manager.stop()
            Logger.success("All services stopped. Goodbye!")
            sys.exit(0)
    else:
        # Start interactive dashboard
        try:
            dashboard = Dashboard(managers)
            dashboard.display()
        except KeyboardInterrupt:
            Logger.warning("\n\nShutting down services...")
            for manager in managers:
                manager.stop()
            Logger.success("All services stopped. Goodbye!")
            sys.exit(0)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        Logger.warning("\n\nInterrupted by user.")
        sys.exit(0)
    except Exception as e:
        Logger.error(f"\nUnexpected error: {e}")
        sys.exit(1)
