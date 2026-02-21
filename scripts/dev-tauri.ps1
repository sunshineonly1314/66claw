#!/usr/bin/env pwsh
<#
.SYNOPSIS
    ClawbotCN local debug script - compile and launch frontend + backend + Tauri
.DESCRIPTION
    Steps:
    1. Compile backend TypeScript (tsdown)
    2. Start backend gateway (port 19001 in dev mode)
    3. Install UI deps and start Vite dev server (port 5173)
    4. Start Tauri desktop app (loads localhost:5173)

    Flags:
      -Backend   Backend only
      -Frontend  Frontend UI only
      -Tauri     Tauri only (backend and frontend must already be running)
      -NoBuild   Skip backend compilation
.EXAMPLE
    .\scripts\dev-tauri.ps1                # Start all
    .\scripts\dev-tauri.ps1 -NoBuild       # Skip compile, start all
    .\scripts\dev-tauri.ps1 -Backend       # Backend only
    .\scripts\dev-tauri.ps1 -Frontend      # Frontend only
#>

param(
    [switch]$Backend,
    [switch]$Frontend,
    [switch]$Tauri,
    [switch]$NoBuild,
    [switch]$Help
)

$ErrorActionPreference = "Stop"

# -- Paths ---------------------------------------------------------------
$RepoRoot   = Resolve-Path (Join-Path $PSScriptRoot "..")
$UiDir      = Join-Path $RepoRoot "ui"
$DesktopDir = Join-Path (Join-Path $RepoRoot "apps") "desktop"

# Dev-mode gateway port (openclawcn --dev gateway uses 19001)
$GatewayPort = 19001

# -- Helpers --------------------------------------------------------------
function Write-Step($msg)  { Write-Host "[STEP] $msg" -ForegroundColor Cyan }
function Write-Ok($msg)    { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Warn($msg)  { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg)   { Write-Host " [ERR] $msg" -ForegroundColor Red }
function Write-Info($msg)  { Write-Host "[INFO] $msg" -ForegroundColor Gray }

# Start-Process wrapper: on Windows, .CMD/.BAT/.PS1 files like pnpm must be
# launched through cmd.exe.  Node.exe works directly.
function Start-Cmd {
    param(
        [string]$Exe,
        [string[]]$Arguments,
        [string]$WorkDir
    )
    # On Windows, resolve pnpm/npm to the .CMD file and run via cmd.exe
    # because Start-Process cannot directly run .CMD/.BAT files with spaces in path
    $resolved = $null
    $allCmds = Get-Command $Exe -All -ErrorAction SilentlyContinue
    if ($allCmds) {
        # Prefer .CMD file (works with cmd.exe), then .BAT, then anything
        $cmdFile = $allCmds | Where-Object { $_.Source -match '\.(cmd|bat)$' } | Select-Object -First 1
        if ($cmdFile) {
            $resolved = $cmdFile.Source
        } else {
            $resolved = ($allCmds | Select-Object -First 1).Source
        }
    }
    if (-not $resolved) { $resolved = $Exe }

    # Build cmd.exe /d /s /c ""path\to\exe" "arg1" "arg2""
    $argParts = $Arguments | ForEach-Object { "`"$_`"" }
    $cmdLine = "`"$resolved`" $($argParts -join ' ')"
    return Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/d","/s","/c","`"$cmdLine`"" `
        -WorkingDirectory $WorkDir `
        -PassThru -NoNewWindow
}

if ($Help) {
    Get-Help $MyInvocation.MyCommand.Path -Detailed
    exit 0
}

# If no component flag given, start everything
$All = (-not $Backend) -and (-not $Frontend) -and (-not $Tauri)

# -- Pre-checks -----------------------------------------------------------
Write-Step "Environment check"

$nodeVersion = & node --version 2>$null
if (-not $nodeVersion) { Write-Err "Node.js not found (need >= 22)"; exit 1 }
Write-Ok "Node.js $nodeVersion"

$pnpmVersion = & pnpm --version 2>$null
if (-not $pnpmVersion) { Write-Err "pnpm not found"; exit 1 }
Write-Ok "pnpm $pnpmVersion"

if ($All -or $Tauri) {
    $rustVersion = & rustc --version 2>$null
    if (-not $rustVersion) {
        Write-Err "Rust not found. Install from https://rustup.rs/"
        exit 1
    }
    Write-Ok "Rust: $rustVersion"
}

Write-Host ""

# -- Dependencies ---------------------------------------------------------
Write-Step "Check dependencies"
$rootNM = Join-Path $RepoRoot "node_modules"
if (-not (Test-Path $rootNM)) {
    Write-Info "Installing root deps..."
    & pnpm install --dir $RepoRoot
    Write-Ok "Root deps installed"
} else {
    Write-Ok "Root deps OK"
}

if ($All -or $Frontend) {
    $uiNM = Join-Path $UiDir "node_modules"
    if (-not (Test-Path $uiNM)) {
        Write-Info "Installing UI deps..."
        & pnpm install --dir $UiDir
        Write-Ok "UI deps installed"
    } else {
        Write-Ok "UI deps OK"
    }
}

if ($All -or $Tauri) {
    $desktopNM = Join-Path $DesktopDir "node_modules"
    if (-not (Test-Path $desktopNM)) {
        Write-Info "Installing Tauri deps..."
        & pnpm install --dir $DesktopDir
        Write-Ok "Tauri deps installed"
    } else {
        Write-Ok "Tauri deps OK"
    }
}

Write-Host ""

# -- Backend compile ------------------------------------------------------
if ((-not $NoBuild) -and ($All -or $Backend)) {
    Write-Step "Compiling backend TypeScript (tsdown)"
    & cmd.exe /c pnpm --dir $RepoRoot exec tsdown --no-clean
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Backend compile failed (exit $LASTEXITCODE)"
        exit 1
    }
    Write-Ok "Backend compiled -> dist/"
    Write-Host ""
}

# -- Process list ---------------------------------------------------------
$jobs = @()

# -- Start backend gateway ------------------------------------------------
if ($All -or $Backend) {
    Write-Step "Starting backend gateway (port $GatewayPort)"
    Write-Info "OPENCLAWCN_SKIP_CHANNELS=1 (skip channels for faster dev startup)"

    $env:OPENCLAWCN_SKIP_CHANNELS = "1"
    $env:CLAWDBOT_SKIP_CHANNELS = "1"
    $env:GATEWAY_PORT = "$GatewayPort"

    $backendProc = Start-Process -FilePath "node" `
        -ArgumentList "openclawcn.mjs","--dev","gateway" `
        -WorkingDirectory $RepoRoot `
        -PassThru -NoNewWindow

    $jobs += @{ Name = "Backend Gateway"; Process = $backendProc; Port = $GatewayPort }
    Write-Ok "Backend started (PID: $($backendProc.Id))"

    # Wait for gateway ready (TCP port check)
    Write-Info "Waiting for gateway on port $GatewayPort..."
    $maxWait = 60
    $waited = 0
    $ready = $false
    while ($waited -lt $maxWait) {
        $tcp = $null
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $tcp.Connect("127.0.0.1", $GatewayPort)
            if ($tcp.Connected) {
                Write-Ok "Gateway ready (${waited}s)"
                $ready = $true
                $tcp.Close()
                break
            }
        } catch {} finally {
            if ($tcp) { $tcp.Dispose() }
        }
        Start-Sleep -Seconds 1
        $waited++
        if ($waited % 10 -eq 0) { Write-Info "  waiting... ${waited}s" }
    }
    if (-not $ready) {
        Write-Warn "Gateway not ready in ${maxWait}s, continuing anyway..."
    }
    Write-Host ""
}

# -- Start frontend UI dev server -----------------------------------------
if ($All -or $Frontend) {
    Write-Step "Starting frontend UI dev server (port 5173)"

    $frontendProc = Start-Cmd -Exe "pnpm" -Arguments @("run","dev") -WorkDir $UiDir

    $jobs += @{ Name = "Frontend UI (Vite)"; Process = $frontendProc; Port = 5173 }
    Write-Ok "Vite dev server started (PID: $($frontendProc.Id))"

    Write-Info "Waiting for Vite on port 5173..."
    $maxWait = 30
    $waited = 0
    $ready = $false
    while ($waited -lt $maxWait) {
        $tcp = $null
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $tcp.Connect("127.0.0.1", 5173)
            if ($tcp.Connected) {
                Write-Ok "Vite ready (${waited}s)"
                $ready = $true
                $tcp.Close()
                break
            }
        } catch {} finally {
            if ($tcp) { $tcp.Dispose() }
        }
        Start-Sleep -Seconds 1
        $waited++
    }
    if (-not $ready) {
        Write-Warn "Vite not ready in ${maxWait}s, continuing..."
    }
    Write-Host ""
}

# -- Start Tauri desktop app ----------------------------------------------
if ($All -or $Tauri) {
    Write-Step "Starting Tauri desktop app"
    Write-Info "Tauri loads http://localhost:5173 (Vite dev server)"
    Write-Info "First run compiles Rust, may take a few minutes..."

    # Launch tauri CLI via node directly so Start-Process tracks the real process
    # (cmd.exe /c exits immediately, losing process tracking)
    $tauriJs = Join-Path $DesktopDir "node_modules\@tauri-apps\cli\tauri.js"
    $tauriProc = Start-Process -FilePath "node" `
        -ArgumentList "`"$tauriJs`"","dev" `
        -WorkingDirectory $DesktopDir `
        -PassThru -NoNewWindow

    $jobs += @{ Name = "Tauri Desktop"; Process = $tauriProc; Port = $null }
    Write-Ok "Tauri started (PID: $($tauriProc.Id))"
    Write-Host ""
}

# -- Summary ---------------------------------------------------------------
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  ClawbotCN Dev Environment Started" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Endpoints:" -ForegroundColor White
if ($All -or $Backend)  { Write-Host "    Gateway:  http://127.0.0.1:$GatewayPort" -ForegroundColor Green }
if ($All -or $Frontend) { Write-Host "    Vite UI:  http://127.0.0.1:5173" -ForegroundColor Green }
if ($All -or $Tauri)    { Write-Host "    Tauri:    desktop window" -ForegroundColor Green }
Write-Host ""
Write-Host "  Processes:" -ForegroundColor White
foreach ($job in $jobs) {
    $pi = ""
    if ($job.Port) { $pi = " (port $($job.Port))" }
    Write-Host "    $($job.Name)$pi - PID $($job.Process.Id)" -ForegroundColor Gray
}
Write-Host ""
Write-Host "  Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# -- Wait and cleanup ------------------------------------------------------
try {
    while ($true) {
        $running = @()
        foreach ($job in $jobs) {
            if ($job.Process.HasExited) {
                Write-Warn "$($job.Name) exited (code $($job.Process.ExitCode))"
            } else {
                $running += $job
            }
        }
        if ($running.Count -eq 0 -and $jobs.Count -gt 0) {
            Write-Info "All processes exited"
            break
        }
        Start-Sleep -Seconds 2
    }
} finally {
    Write-Host ""
    Write-Step "Cleaning up..."
    foreach ($job in $jobs) {
        if (-not $job.Process.HasExited) {
            Write-Info "Stopping $($job.Name) (PID $($job.Process.Id))"
            try {
                Stop-Process -Id $job.Process.Id -Force -ErrorAction SilentlyContinue
            } catch {}
        }
    }
    # Also kill any child node processes left behind
    try {
        foreach ($job in $jobs) {
            Get-CimInstance Win32_Process -Filter "ParentProcessId = $($job.Process.Id)" -ErrorAction SilentlyContinue |
                ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
        }
    } catch {}
    Write-Ok "All processes cleaned up"

    Remove-Item Env:OPENCLAWCN_SKIP_CHANNELS -ErrorAction SilentlyContinue
    Remove-Item Env:CLAWDBOT_SKIP_CHANNELS -ErrorAction SilentlyContinue
    Remove-Item Env:GATEWAY_PORT -ErrorAction SilentlyContinue
}
