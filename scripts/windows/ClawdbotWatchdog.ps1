# ClawdbotCN Gateway Watchdog
# Monitors Gateway process and auto-restarts if crashed
#
# Features:
# - Monitors Gateway health every 10 seconds
# - Auto-restarts if Gateway crashes or becomes unresponsive
# - Logs all events for debugging
# - Limits restart attempts to prevent infinite loops

param(
    [int]$CheckInterval = 10,      # Health check interval (seconds)
    [int]$MaxRestarts = 5,         # Max restarts in RestartWindow
    [int]$RestartWindow = 300,     # Time window for restart counting (seconds)
    [int]$StartupWait = 15         # Wait time after starting Gateway (seconds)
)

$ErrorActionPreference = "Continue"

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$InstallDir = $ScriptDir
$Port = 18789
$BaseUrl = "http://localhost:$Port"

# Logging
$LogDir = Join-Path $InstallDir "logs"
$LogFile = Join-Path $LogDir "watchdog.log"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    try {
        if (-not (Test-Path $LogDir)) {
            New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
        }
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $logLine = "[$timestamp] [$Level] $Message"
        Add-Content -Path $LogFile -Value $logLine -Encoding UTF8
        
        # Keep log file size manageable (max 1MB)
        $logSize = (Get-Item $LogFile -ErrorAction SilentlyContinue).Length
        if ($logSize -gt 1MB) {
            $content = Get-Content $LogFile -Tail 1000
            Set-Content -Path $LogFile -Value $content -Encoding UTF8
        }
    } catch {}
}

function Test-GatewayHealth {
    # Check 1: Port listening
    try {
        $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        if (-not $conn) {
            return @{ Healthy = $false; Reason = "Port not listening" }
        }
    } catch {
        return @{ Healthy = $false; Reason = "Port check failed: $_" }
    }
    
    # Check 2: HTTP response
    try {
        $response = Invoke-WebRequest -Uri "$BaseUrl/" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            return @{ Healthy = $true; Reason = "OK" }
        }
        return @{ Healthy = $false; Reason = "HTTP status: $($response.StatusCode)" }
    } catch {
        return @{ Healthy = $false; Reason = "HTTP check failed: $_" }
    }
}

function Start-GatewayProcess {
    Write-Log "Starting Gateway..."
    
    $startScript = Join-Path $InstallDir "start-gateway.bat"
    if (-not (Test-Path $startScript)) {
        Write-Log "start-gateway.bat not found!" "ERROR"
        return $false
    }
    
    # Start Gateway
    Start-Process cmd -ArgumentList "/c", "`"$startScript`"" -WindowStyle Hidden -WorkingDirectory $InstallDir
    
    # Wait for startup
    Write-Log "Waiting $StartupWait seconds for Gateway to start..."
    Start-Sleep -Seconds $StartupWait
    
    # Verify
    $health = Test-GatewayHealth
    if ($health.Healthy) {
        Write-Log "Gateway started successfully"
        return $true
    } else {
        Write-Log "Gateway failed to start: $($health.Reason)" "ERROR"
        return $false
    }
}

function Stop-GatewayProcess {
    Write-Log "Stopping Gateway..."
    
    # Kill by port
    try {
        $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        if ($conn) {
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    } catch {}
    
    # Kill node processes with Clawdbot
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
        $_.MainWindowTitle -match "Clawdbot"
    } | Stop-Process -Force -ErrorAction SilentlyContinue
    
    # Clean lock file
    $lockFile = Join-Path $env:USERPROFILE ".clawdbot\gateway.lock"
    if (Test-Path $lockFile) {
        Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
        Write-Log "Removed stale lock file"
    }
    
    Start-Sleep -Seconds 2
}

# ============================================
# Main Watchdog Loop
# ============================================

Write-Log "========== ClawdbotCN Watchdog Started =========="
Write-Log "Check interval: ${CheckInterval}s, Max restarts: $MaxRestarts in ${RestartWindow}s"

# Track restart history
$restartTimes = @()
$consecutiveFailures = 0

# Initial check
$initialHealth = Test-GatewayHealth
if (-not $initialHealth.Healthy) {
    Write-Log "Gateway not running on startup, starting..."
    $started = Start-GatewayProcess
    if ($started) {
        $restartTimes += Get-Date
    }
}

# Main monitoring loop
while ($true) {
    Start-Sleep -Seconds $CheckInterval
    
    $health = Test-GatewayHealth
    
    if ($health.Healthy) {
        $consecutiveFailures = 0
        # Occasional status log
        if ((Get-Date).Second -lt $CheckInterval) {
            Write-Log "Gateway healthy" "DEBUG"
        }
        continue
    }
    
    # Gateway is unhealthy
    $consecutiveFailures++
    Write-Log "Gateway unhealthy: $($health.Reason) (failure #$consecutiveFailures)" "WARN"
    
    # Wait for a couple more checks before restarting (might be temporary)
    if ($consecutiveFailures -lt 2) {
        continue
    }
    
    # Check restart rate limit
    $now = Get-Date
    $windowStart = $now.AddSeconds(-$RestartWindow)
    $restartTimes = @($restartTimes | Where-Object { $_ -gt $windowStart })
    
    if ($restartTimes.Count -ge $MaxRestarts) {
        Write-Log "Restart limit reached ($MaxRestarts in ${RestartWindow}s). Pausing watchdog for 5 minutes." "ERROR"
        
        # Notify user via balloon (if tray is running)
        # TODO: Inter-process communication with tray
        
        Start-Sleep -Seconds 300
        $restartTimes = @()
        continue
    }
    
    # Restart Gateway
    Write-Log "Attempting restart (#$($restartTimes.Count + 1) in window)..."
    
    Stop-GatewayProcess
    $started = Start-GatewayProcess
    
    if ($started) {
        $restartTimes += $now
        $consecutiveFailures = 0
        Write-Log "Gateway restarted successfully"
    } else {
        Write-Log "Gateway restart failed" "ERROR"
    }
}
