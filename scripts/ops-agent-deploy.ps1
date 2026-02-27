# Deploy Ops Agent to 102 (KEVINSUN) machine
# Run from local dev machine to push the agent script, Repomix config,
# and launcher, then verify it works.
#
# Architecture: Repomix packs source → SiliconFlow GLM-5 direct API
# No OpenCode binary needed.
#
# Usage:
#   powershell -File scripts\ops-agent-deploy.ps1
#   powershell -File scripts\ops-agent-deploy.ps1 -TestRun
#   powershell -File scripts\ops-agent-deploy.ps1 -InstallTask

param(
    [switch]$TestRun,       # after deploy, run --list to verify connectivity
    [switch]$InstallTask    # after deploy, register Windows Scheduled Task on 102
)

$ErrorActionPreference = "Stop"

$REMOTE_HOST = "SunBin@KEVINSUN"
$REMOTE_WORKSPACE = "D:\bugsfind"
$REMOTE_BUGSFIND = "D:\bugsfind"
$LOCAL_ROOT = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $LOCAL_ROOT) { $LOCAL_ROOT = (Get-Location).Path }

Write-Host "=== Deploying Ops Agent (Repomix + SiliconFlow) to 102 (KEVINSUN) ===" -ForegroundColor Cyan

# 1. Ensure 102 workspace has latest code
Write-Host "[1/7] Pulling latest code on 102..."
ssh $REMOTE_HOST "cd /d D:\bugsfind\openclawcn && git pull --ff-only" 2>&1 | Write-Host

# 2. Copy launcher script
Write-Host "[2/7] Copying ops-agent-run.ps1..."
scp "$LOCAL_ROOT\scripts\ops-agent-run.ps1" "${REMOTE_HOST}:`"$REMOTE_WORKSPACE\ops-agent-run.ps1`""
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: SCP ops-agent-run.ps1 failed" -ForegroundColor Red
    exit 1
}
Write-Host "  Copied to $REMOTE_WORKSPACE\ops-agent-run.ps1" -ForegroundColor Green

# 3. Install Repomix on 102 (npm global)
Write-Host "[3/7] Installing Repomix on 102..."
ssh $REMOTE_HOST "if not exist `"$REMOTE_BUGSFIND`" mkdir `"$REMOTE_BUGSFIND`"" 2>&1 | Out-Null
ssh $REMOTE_HOST "if not exist `"$REMOTE_BUGSFIND\issues`" mkdir `"$REMOTE_BUGSFIND\issues`"" 2>&1 | Out-Null
ssh $REMOTE_HOST "set PATH=D:\Program Files\node-v22.18.0-win-x64;%PATH% && npm list -g repomix 2>nul || npm install -g repomix" 2>&1 | Write-Host
Write-Host "  Repomix installed" -ForegroundColor Green

# 4. Copy Repomix config
Write-Host "[4/7] Copying repomix.config.json to workspace..."
if (Test-Path "$LOCAL_ROOT\repomix.config.json") {
    scp "$LOCAL_ROOT\repomix.config.json" "${REMOTE_HOST}:`"$REMOTE_WORKSPACE\openclawcn\repomix.config.json`""
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Copied repomix.config.json" -ForegroundColor Green
    }
} else {
    Write-Host "WARNING: repomix.config.json not found at $LOCAL_ROOT" -ForegroundColor Yellow
}

# 5. Ensure tsx is installed on 102
Write-Host "[5/7] Ensuring tsx is installed on 102..."
ssh $REMOTE_HOST "set PATH=D:\Program Files\node-v22.18.0-win-x64;%PATH% && npm list -g tsx 2>nul || npm install -g tsx" 2>&1 | Write-Host

# 6. Verify issues directory
Write-Host "[6/7] Ensuring issues archive directory exists..."
ssh $REMOTE_HOST "if not exist `"$REMOTE_BUGSFIND\issues`" mkdir `"$REMOTE_BUGSFIND\issues`"" 2>&1 | Out-Null
Write-Host "  Issues dir: $REMOTE_BUGSFIND\issues" -ForegroundColor Green

# 7. Verify deployment
Write-Host "[7/7] Verifying files on 102..."
ssh $REMOTE_HOST "dir `"$REMOTE_WORKSPACE\ops-agent-run.ps1`" && dir `"$REMOTE_WORKSPACE\openclawcn\scripts\ops-diagnose-agent.ts`" && dir `"$REMOTE_WORKSPACE\openclawcn\repomix.config.json`" 2>nul && dir `"$REMOTE_BUGSFIND\issues`"" 2>&1 | Write-Host

Write-Host ""
Write-Host "=== Deployment complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps on 102:" -ForegroundColor Yellow
Write-Host "  1. Set env vars (run in PowerShell on 102 via RDP or SSH):"
Write-Host '     [System.Environment]::SetEnvironmentVariable("OPS_API_TOKEN", "YOUR_TOKEN", "User")'
Write-Host '     [System.Environment]::SetEnvironmentVariable("SILICONFLOW_KEY", "YOUR_KEY", "User")'
Write-Host ""
Write-Host "  2. Test:  ssh $REMOTE_HOST `"powershell -File $REMOTE_WORKSPACE\ops-agent-run.ps1 -Mode list`""
Write-Host ""

if ($TestRun) {
    Write-Host "=== Running test (--list) ===" -ForegroundColor Cyan
    ssh $REMOTE_HOST "powershell -ExecutionPolicy Bypass -File `"$REMOTE_WORKSPACE\ops-agent-run.ps1`" -Mode list" 2>&1 | Write-Host
}

if ($InstallTask) {
    Write-Host "=== Installing Scheduled Task ===" -ForegroundColor Cyan
    ssh $REMOTE_HOST "powershell -ExecutionPolicy Bypass -File `"$REMOTE_WORKSPACE\ops-agent-run.ps1`" -Install" 2>&1 | Write-Host
}
