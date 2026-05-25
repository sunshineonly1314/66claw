<#
.SYNOPSIS
  ClawdbotCN Gateway - dev startup script
.DESCRIPTION
  Build -> config -> kill old -> start gateway -> live log tail
.PARAMETER Port
  Gateway port (default 18789)
.PARAMETER SkipBuild
  Skip TypeScript compilation
.PARAMETER Reset
  Reset dev config
#>
param(
    [int]    $Port      = 18789,
    [string] $Bind      = "loopback",
    [string] $Region    = "cn",
    [string] $Token     = "clawdbot2026",
    [switch] $Reset,
    [switch] $SkipBuild,
    [switch] $Verbose,
    [string] $WsLog     = "full",
    [switch] $RawStream,
    [switch] $NoCn
)

$ErrorActionPreference = "Stop"
chcp 65001 | Out-Null

$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$ConfigDir   = Join-Path $env:USERPROFILE ".clawdbot"
$ConfigFile  = Join-Path $ConfigDir "clawdbot.json"
$LogDir      = Join-Path $ProjectRoot "logs"
$GwLog       = Join-Path $LogDir "gateway-dev.log"

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

Write-Host ""
Write-Host "  ==========================================================" -ForegroundColor DarkCyan
Write-Host "       ClawdbotCN Gateway - Dev Mode" -ForegroundColor White
Write-Host "  ==========================================================" -ForegroundColor DarkCyan
Write-Host ""

# ── 1. Build ──
Write-Host "  [1/6] Build TypeScript..." -ForegroundColor Cyan
if ($SkipBuild) {
    Write-Host "       [!] Skipped (-SkipBuild)" -ForegroundColor Yellow
}
else {
    $compiler = "tsgo"
    if ($env:CLAWDBOT_TS_COMPILER -eq "tsc") { $compiler = "tsc" }
    Write-Host "       compiler: $compiler" -ForegroundColor DarkGray
    Push-Location $ProjectRoot
    $prevEA = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & pnpm exec $compiler --project tsconfig.json 2>&1 | ForEach-Object { Write-Host "       $_" -ForegroundColor DarkGray }
    $bc = $LASTEXITCODE
    $ErrorActionPreference = $prevEA
    Pop-Location
    if ($bc -ne 0) {
        Write-Host "       [x] Build FAILED" -ForegroundColor Red
        exit 1
    }
    Write-Host "       [OK] Build succeeded" -ForegroundColor Green

}
Write-Host ""

# ── 2. Config ──
Write-Host "  [2/6] Check config..." -ForegroundColor Cyan
if (-not (Test-Path $ConfigDir)) {
    New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
}
if (-not (Test-Path $ConfigFile)) {
    $cfg = @"
{
  "gateway": { "mode": "local", "bind": "$Bind", "port": $Port },
  "tools": { "exec": { "security": "full", "ask": "off", "host": "gateway" } },
  "agents": { "defaults": { "sandbox": { "mode": "off" } } }
}
"@
    [System.IO.File]::WriteAllText($ConfigFile, $cfg, [System.Text.Encoding]::UTF8)
    Write-Host "       [OK] Created $ConfigFile" -ForegroundColor Green
}
else {
    # Force-correct CN required fields (applyCnDefaults uses fill-empty, won't fix wrong values)
    try {
        $raw = Get-Content $ConfigFile -Raw -Encoding utf8
        $changed = $false

        # tools.exec.security must be "full" for CN dev
        if ($raw -match '"security"\s*:\s*"deny"') {
            $raw = $raw -replace '"security"\s*:\s*"deny"', '"security": "full"'
            $changed = $true
            Write-Host "       [!] Fixed tools.exec.security: deny -> full" -ForegroundColor Yellow
        }
        # tools.exec.ask must be "off" for CN dev
        if ($raw -match '"ask"\s*:\s*"on-miss"') {
            $raw = $raw -replace '"ask"\s*:\s*"on-miss"', '"ask": "off"'
            $changed = $true
            Write-Host "       [!] Fixed tools.exec.ask: on-miss -> off" -ForegroundColor Yellow
        }
        # tools.exec.host must be "gateway"
        if ($raw -match '"exec"\s*:\s*\{' -and $raw -notmatch '"host"\s*:\s*"gateway"') {
            $raw = $raw -replace '("exec"\s*:\s*\{)', '$1 "host": "gateway",'
            $changed = $true
            Write-Host "       [!] Added tools.exec.host: gateway" -ForegroundColor Yellow
        }
        # gateway.port must match
        if ($raw -match '"port"\s*:\s*(\d+)' -and [int]$Matches[1] -ne $Port) {
            $raw = $raw -replace '"port"\s*:\s*\d+', "`"port`": $Port"
            $changed = $true
            Write-Host "       [!] Fixed gateway.port -> $Port" -ForegroundColor Yellow
        }

        if ($changed) {
            [System.IO.File]::WriteAllText($ConfigFile, $raw, [System.Text.Encoding]::UTF8)
            Write-Host "       [OK] Config patched" -ForegroundColor Green
        } else {
            Write-Host "       [OK] Config OK, no fixes needed" -ForegroundColor Green
        }
    } catch {
        Write-Host "       [!] Config parse failed, keeping as-is: $_" -ForegroundColor Yellow
    }
}
Write-Host ""

# ── 3. Kill old process ──
Write-Host "  [3/6] Kill old process on port $Port..." -ForegroundColor Cyan
$found = $false
netstat -ano 2>$null | Select-String ":${Port}\s" | Select-String "LISTENING" | ForEach-Object {
    $p = ($_ -split '\s+')[-1]
    if ($p -match '^\d+$' -and [int]$p -gt 0) {
        Stop-Process -Id ([int]$p) -Force -ErrorAction SilentlyContinue
        Write-Host "       [!] Killed PID $p" -ForegroundColor Yellow
        $found = $true
    }
}
if ($found) { Start-Sleep -Seconds 2 }
else { Write-Host "       [OK] Port $Port free" -ForegroundColor Green }

Get-ChildItem -Path $ConfigDir -Filter "gateway.*.lock" -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
    Write-Host "       [!] Removed lock: $($_.Name)" -ForegroundColor Yellow
}
Write-Host ""

# ── 4. Env vars ──
Write-Host "  [4/6] Set env vars..." -ForegroundColor Cyan
$env:CLAWDBOT_GATEWAY_TOKEN = $Token
$env:CLAWDBOT_SKIP_CHANNELS = "1"
if (-not $NoCn) { $env:CLAWDBOT_REGION = $Region }

$sk = Join-Path $ProjectRoot "skills"
if (Test-Path $sk) { $env:CLAWDBOT_BUNDLED_SKILLS_DIR = $sk }

Write-Host "       TOKEN=$Token  REGION=$(if($NoCn){'n/a'}else{$Region})  SKIP_CHANNELS=1" -ForegroundColor DarkGray
Write-Host ""

# ── 5. Build args ──
Write-Host "  [5/6] Start Gateway..." -ForegroundColor Cyan

$entryJs = Join-Path (Join-Path $ProjectRoot "dist") "entry.js"
if (-not (Test-Path $entryJs)) {
    Write-Host "       [x] dist/entry.js not found!" -ForegroundColor Red
    exit 1
}

$gwArgs = @($entryJs, "gateway", "run", "--port", "$Port", "--allow-unconfigured", "--force")
if ($Verbose)   { $gwArgs += "--verbose" }
if ($WsLog)     { $gwArgs += "--ws-log"; $gwArgs += $WsLog }
if ($RawStream) { $gwArgs += "--raw-stream" }
if ($Reset)     { $gwArgs += "--dev"; $gwArgs += "--reset" }

$cmd = "node " + ($gwArgs -join " ")
Write-Host "       cmd: $cmd" -ForegroundColor DarkGray
Write-Host ""

# ── 6. Run with live log ──
Write-Host "  [6/6] Gateway running - live log (Ctrl+C to stop)" -ForegroundColor Cyan
Write-Host "       log: $GwLog" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  ==========================================================" -ForegroundColor DarkCyan
Write-Host "    http://localhost:${Port}/setup" -ForegroundColor White
Write-Host "  ==========================================================" -ForegroundColor DarkCyan
Write-Host ""

# Write log header
$ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
"===== [$ts] Gateway Dev Start =====" | Out-File $GwLog -Encoding utf8
"cmd: $cmd" | Out-File $GwLog -Append -Encoding utf8

# Run node, pipe both stdout+stderr to console AND log file
# Must use Continue here - node writes warnings to stderr which PS treats as errors
$ErrorActionPreference = "Continue"
Push-Location $ProjectRoot
try {
    & node $gwArgs 2>&1 | Tee-Object -FilePath $GwLog -Append
}
finally {
    Pop-Location
}

$ec = $LASTEXITCODE
$ts2 = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
"===== [$ts2] Gateway exited code=$ec =====" | Out-File $GwLog -Append -Encoding utf8
Write-Host ""
if ($ec -eq 0) {
    Write-Host "  Gateway exited normally." -ForegroundColor Green
}
else {
    Write-Host "  Gateway exited with code $ec" -ForegroundColor Red
}
