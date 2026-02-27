# Ops Diagnose Agent - Launcher for 102 (KEVINSUN) machine
# Runs on the Windows CI/CD builder to auto-process pending log reports.
#
# Architecture: Repomix packs project source code → SiliconFlow GLM-5 direct API
# No OpenCode agent loop needed — faster and more reliable on large codebases.
#
# Setup:
#   1. Copy this script to D:\bugsfind\ on 102
#   2. Edit the TOKEN values below (or set them as system env vars)
#   3. Run manually:  powershell -File D:\bugsfind\ops-agent-run.ps1
#   4. Or register as a scheduled task (see bottom of file)
#
# Requires: Node.js 22+ with tsx (installed via npm)
# Requires: Repomix (installed via npm: npm install -g repomix)

param(
    [string]$Mode = "auto",         # auto | list | ticket
    [string]$TicketCode = "",       # only used when Mode=ticket
    [switch]$DryRun,                # analyze but don't upload replies
    [switch]$Install                # install as Windows Scheduled Task
)

$ErrorActionPreference = "Stop"

# ── Configuration ─────────────────────────────────────────────────────────────

# Workspace where the repo is cloned (独立于 CI/CD，专供 Repomix + LLM 分析)
$WORKSPACE = "D:\bugsfind\openclawcn"

# Node.js path (102 machine has standalone Node, no pnpm)
$NODE_DIR = "D:\Program Files\node-v22.18.0-win-x64"
$NODE = Join-Path $NODE_DIR "node.exe"
$NPX = Join-Path $NODE_DIR "npx.cmd"

# API tokens - SET THESE before first run
# Option A: Edit these lines directly
# Option B: Set as system environment variables (preferred for security)
if (-not $env:OPS_API_TOKEN) {
    $env:OPS_API_TOKEN = "test-token-for-dev-20260222"   # TODO: replace with real token from tecbinhome
}
if (-not $env:SILICONFLOW_KEY) {
    $env:SILICONFLOW_KEY = ""   # TODO: fill in your SiliconFlow API key
}

# NPM global dir (for repomix, tsx, etc.)
$NPM_DIR = "E:\Program Files\nodejs"

# Log file
$LOG_DIR = "D:\bugsfind\ops-agent-logs"
$LOG_FILE = Join-Path $LOG_DIR "ops-agent-$(Get-Date -Format 'yyyy-MM-dd').log"

# ── Functions ─────────────────────────────────────────────────────────────────

function Write-Log {
    param([string]$Message)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] $Message"
    Write-Host $line
    if (-not (Test-Path $LOG_DIR)) { New-Item -ItemType Directory -Path $LOG_DIR -Force | Out-Null }
    Add-Content -Path $LOG_FILE -Value $line -Encoding UTF8
}

function Assert-Prerequisites {
    if (-not (Test-Path $NODE)) {
        Write-Log "ERROR: Node.js not found at $NODE"
        exit 1
    }
    if (-not (Test-Path $WORKSPACE)) {
        Write-Log "ERROR: Workspace not found at $WORKSPACE"
        exit 1
    }
    $scriptPath = Join-Path $WORKSPACE "scripts\ops-diagnose-agent.ts"
    if (-not (Test-Path $scriptPath)) {
        Write-Log "ERROR: ops-diagnose-agent.ts not found. Run 'git pull' in workspace first."
        exit 1
    }
    if ([string]::IsNullOrEmpty($env:OPS_API_TOKEN) -or $env:OPS_API_TOKEN -eq "test-token-for-dev-20260222") {
        Write-Log "WARNING: Using test OPS_API_TOKEN. Set real token for production."
    }
    if ([string]::IsNullOrEmpty($env:SILICONFLOW_KEY)) {
        Write-Log "WARNING: SILICONFLOW_KEY not set. LLM analysis will fail."
    }

    # Ensure tsx is available
    $tsxCheck = & $NPX tsx --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Log "Installing tsx globally..."
        & "$NODE_DIR\npm.cmd" install -g tsx 2>&1 | Out-Null
    }

    # Check Repomix availability (npm global install)
    $repomixCheck = & $NPX repomix --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Log "Repomix not found. Installing via npm..."
        & "$NPM_DIR\npm.cmd" install -g repomix 2>&1 | Out-Null
        $repomixCheck = & $NPX repomix --version 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Log "ERROR: Failed to install repomix. Run manually:"
            Write-Log "  npm install -g repomix"
            exit 1
        }
    }
    Write-Log "Repomix found: v$repomixCheck"

    # Check repomix.config.json exists in workspace
    $repomixConfig = Join-Path $WORKSPACE "repomix.config.json"
    if (-not (Test-Path $repomixConfig)) {
        Write-Log "WARNING: repomix.config.json not found at $repomixConfig"
        Write-Log "  Code context will not be available. Run 'git pull' to get it."
    }
}

function Invoke-GitPull {
    Write-Log "Pulling latest code..."
    Push-Location $WORKSPACE
    try {
        $result = git pull --ff-only 2>&1
        Write-Log "Git pull: $result"
    } catch {
        Write-Log "WARNING: git pull failed: $_"
    } finally {
        Pop-Location
    }
}

function Install-ScheduledTask {
    $taskName = "ClawdbotCN-OpsAgent"
    $scriptPath = $MyInvocation.ScriptName
    if (-not $scriptPath) { $scriptPath = "D:\bugsfind\ops-agent-run.ps1" }

    # Remove existing task if any
    $existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existing) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        Write-Log "Removed existing scheduled task: $taskName"
    }

    # Run every 30 minutes
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 30)
    $action = New-ScheduledTaskAction `
        -Execute "powershell.exe" `
        -Argument "-ExecutionPolicy Bypass -File `"$scriptPath`" -Mode auto" `
        -WorkingDirectory "D:\bugsfind"
    $settings = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

    Register-ScheduledTask `
        -TaskName $taskName `
        -Trigger $trigger `
        -Action $action `
        -Settings $settings `
        -Description "ClawdbotCN Ops Agent - auto-diagnose pending log reports every 30 min" `
        -RunLevel Highest

    Write-Log "Scheduled task '$taskName' registered: every 30 minutes"
    Write-Log "To check: Get-ScheduledTask -TaskName $taskName"
    Write-Log "To run now: Start-ScheduledTask -TaskName $taskName"
    Write-Log "To remove: Unregister-ScheduledTask -TaskName $taskName -Confirm:`$false"
}

# ── Main ──────────────────────────────────────────────────────────────────────

Write-Log "=== Ops Agent Start (mode=$Mode) ==="

if ($Install) {
    Install-ScheduledTask
    exit 0
}

# Add node v22 FIRST (for fetch support), then npm dir (for repomix)
$env:PATH = "$NODE_DIR;$NPM_DIR;$env:PATH"

Assert-Prerequisites
Invoke-GitPull

# Build CLI arguments
$cliArgs = @()
switch ($Mode) {
    "list"   { $cliArgs += "--list" }
    "ticket" {
        if ([string]::IsNullOrEmpty($TicketCode)) {
            Write-Log "ERROR: -TicketCode is required when Mode=ticket"
            exit 1
        }
        $cliArgs += "--ticket"
        $cliArgs += $TicketCode
    }
    "auto"   { $cliArgs += "--auto" }
    default  { $cliArgs += "--auto" }
}
if ($DryRun) { $cliArgs += "--dry-run" }

# Pass project paths to the agent script
$env:PROJECT_CWD = $WORKSPACE
$env:ISSUES_DIR = "D:\bugsfind\issues"

$scriptFile = Join-Path $WORKSPACE "scripts\ops-diagnose-agent.ts"

Write-Log "Running: npx tsx $scriptFile $($cliArgs -join ' ')"

try {
    & $NPX tsx $scriptFile @cliArgs 2>&1 | ForEach-Object { Write-Log $_ }
    if ($LASTEXITCODE -ne 0) {
        Write-Log "=== Ops Agent Failed (exit=$LASTEXITCODE) ==="
        exit $LASTEXITCODE
    }
    Write-Log "=== Ops Agent Finished ==="
} catch {
    Write-Log "ERROR: $($_.Exception.Message)"
    Write-Log "=== Ops Agent Failed ==="
    exit 1
}

# Clean up old log files (keep last 30 days)
Get-ChildItem $LOG_DIR -Filter "ops-agent-*.log" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
    Remove-Item -Force

<#
QUICK START on 102 machine:

1. Copy this script:
   scp scripts/ops-agent-run.ps1 SunBin@KEVINSUN:"D:\bugsfind\"

2. SSH into 102 and set tokens:
   ssh SunBin@KEVINSUN
   [System.Environment]::SetEnvironmentVariable("OPS_API_TOKEN", "your-real-token", "User")
   [System.Environment]::SetEnvironmentVariable("SILICONFLOW_KEY", "your-sf-key", "User")

3. Test run (list only, no AI):
   powershell -File D:\bugsfind\ops-agent-run.ps1 -Mode list

4. Test run (auto with dry-run):
   powershell -File D:\bugsfind\ops-agent-run.ps1 -Mode auto -DryRun

5. Install as scheduled task (every 30 min):
   powershell -File D:\bugsfind\ops-agent-run.ps1 -Install

#>
