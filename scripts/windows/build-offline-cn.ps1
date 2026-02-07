# ============================================================================
# Clawdbot Windows Offline Build Script (China Mirrors)
# ============================================================================
# Builds offline installer using China mirrors for all downloads
#
# Usage:
#   .\build-offline-cn.ps1
#   .\build-offline-cn.ps1 -Version "2026.2.2"
#   .\build-offline-cn.ps1 -SkipNodeModules   # Skip npm install
#   .\build-offline-cn.ps1 -SkipBuild         # Skip tsc build
#
# Output:
#   E:\clawdbuild\ClawdbotCN-Setup-{version}-x64.exe (offline, ~105MB)
# ============================================================================

param(
    [string]$Version = "2026.2.2",
    [switch]$SkipNodeModules,
    [switch]$SkipBuild,
    [switch]$SkipEncodingConvert
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Resolve-Path (Join-Path $ScriptDir "../..")
$InstallerDir = "E:\clawdbuild"
$NodeModulesCache = "E:\clawdbuild\test-prod-deps"

# China mirrors
$NpmMirror = "https://registry.npmmirror.com"
$NodeMirror = "https://npmmirror.com/mirrors/node"

function Write-Step {
    param([string]$Step, [string]$Message)
    Write-Host ""
    Write-Host "[$Step] $Message" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor DarkGray
}

function Write-OK { param([string]$Message); Write-Host "  [OK] $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message); Write-Host "  [WARN] $Message" -ForegroundColor Yellow }
function Write-Err { param([string]$Message); Write-Host "  [ERROR] $Message" -ForegroundColor Red }
function Write-Info { param([string]$Message); Write-Host "  $Message" -ForegroundColor Gray }

# ============================================================================
# Main
# ============================================================================

Write-Host ""
Write-Host "========================================================" -ForegroundColor Magenta
Write-Host "   Clawdbot Windows Offline Build (China Mirrors)" -ForegroundColor Magenta
Write-Host "========================================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Version: $Version"
Write-Host "  npm Mirror: $NpmMirror"
Write-Host "  Node Mirror: $NodeMirror"
Write-Host "  Output: $InstallerDir"
Write-Host ""

# ============================================================================
# Step 1: Check prerequisites
# ============================================================================
Write-Step "1/7" "Check Prerequisites"

$InnoSetupPath = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if (-not (Test-Path $InnoSetupPath)) {
    Write-Err "Inno Setup 6 not found at: $InnoSetupPath"
    Write-Host "  Download from: https://jrsoftware.org/isinfo.php" -ForegroundColor Yellow
    exit 1
}
Write-OK "Inno Setup: $InnoSetupPath"

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Err "Node.js not found"
    exit 1
}
$nodeVer = & node -v
Write-OK "Node.js: $nodeVer"

$pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpmCmd) {
    Write-Err "pnpm not found"
    exit 1
}
Write-OK "pnpm found"

# ============================================================================
# Step 2: Convert batch file encoding (GBK + CRLF) & Build .NET Launcher
# ============================================================================
Write-Step "2/7" "Convert Batch File Encoding"

if (-not $SkipEncodingConvert) {
    $convertScript = Join-Path $ScriptDir "convert-encoding.ps1"
    if (Test-Path $convertScript) {
        & powershell -ExecutionPolicy Bypass -File $convertScript -All
        Write-OK "Batch files converted to GBK"
    } else {
        Write-Warn "convert-encoding.ps1 not found, skipping"
    }
} else {
    Write-Warn "Skipping encoding conversion"
}

# Build .NET Launcher (legacy, kept for compatibility)
Write-Info "Building .NET Launcher..."
$launcherScript = Join-Path $ScriptDir "launchers\build-launcher.ps1"
if (Test-Path $launcherScript) {
    & powershell -ExecutionPolicy Bypass -File $launcherScript
    if ($LASTEXITCODE -eq 0) {
        Write-OK ".NET Launcher built successfully"
    } else {
        Write-Warn "Launcher build failed (non-critical)"
    }
}

# Build .NET Native Service (all-in-one: tray + gateway + watchdog)
Write-Info "Building .NET Native Service..."
$serviceScript = Join-Path $ScriptDir "native\build-service.ps1"
if (Test-Path $serviceScript) {
    & powershell -ExecutionPolicy Bypass -File $serviceScript
    if ($LASTEXITCODE -eq 0) {
        Write-OK ".NET Native Service built successfully"
    } else {
        Write-Err "Native Service build failed!"
        exit 1
    }
} else {
    Write-Warn "build-service.ps1 not found, creating native folder..."
    New-Item -ItemType Directory -Path (Join-Path $ScriptDir "native") -Force | Out-Null
}

# ============================================================================
# Step 3: Build TypeScript
# ============================================================================
Write-Step "3/7" "Build TypeScript"

if (-not $SkipBuild) {
    Push-Location $RootDir
    try {
        Write-Info "Running pnpm build..."
        & pnpm build
        if ($LASTEXITCODE -ne 0) {
            Write-Err "Build failed!"
            exit 1
        }
        Write-OK "Build complete"
    } finally {
        Pop-Location
    }
} else {
    Write-Warn "Skipping build"
}

# ============================================================================
# Step 4: Prepare production node_modules
# ============================================================================
Write-Step "4/7" "Prepare Production Dependencies"

if (-not $SkipNodeModules) {
    if (-not (Test-Path $NodeModulesCache)) {
        New-Item -ItemType Directory -Path $NodeModulesCache -Force | Out-Null
    }
    
    # Copy package.json
    Copy-Item (Join-Path $RootDir "package.json") $NodeModulesCache -Force
    
    Push-Location $NodeModulesCache
    try {
        Write-Info "Setting npm registry to: $NpmMirror"
        & npm config set registry $NpmMirror
        
        Write-Info "Installing production dependencies (this may take a few minutes)..."
        & npm install --omit=dev --legacy-peer-deps --no-audit --no-fund --registry=$NpmMirror
        
        if ($LASTEXITCODE -ne 0) {
            Write-Err "npm install failed!"
            exit 1
        }
        
        $nmSize = (Get-ChildItem (Join-Path $NodeModulesCache "node_modules") -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
        Write-OK "Dependencies installed: $([math]::Round($nmSize, 0)) MB"
    } finally {
        Pop-Location
    }
    
    # Install extensions dependencies
    # - dingtalk: needs dingtalk-stream
    # - feishu: needs @larksuiteoapi/node-sdk (官方飞书 SDK，约 2MB)
    # - wecom: needs wecom dependencies
    Write-Info "Installing extensions dependencies..."
    $extensionsWithDeps = @("dingtalk", "feishu", "wecom")
    foreach ($ext in $extensionsWithDeps) {
        $extDir = Join-Path $RootDir "extensions\$ext"
        $extPkg = Join-Path $extDir "package.json"
        if (Test-Path $extPkg) {
            Push-Location $extDir
            try {
                Write-Info "  Installing $ext dependencies..."
                & npm install --omit=dev --legacy-peer-deps --no-audit --no-fund --registry=$NpmMirror 2>$null
                if ($LASTEXITCODE -eq 0) {
                    # 检查 feishu 的 SDK 是否安装成功
                    if ($ext -eq "feishu") {
                        $sdkPath = Join-Path $extDir "node_modules\@larksuiteoapi\node-sdk"
                        if (Test-Path $sdkPath) {
                            Write-OK "  $ext dependencies installed (including @larksuiteoapi/node-sdk)"
                        } else {
                            Write-Warn "  ${ext}: @larksuiteoapi/node-sdk not found, WebSocket mode may not work"
                        }
                    } else {
                        Write-OK "  $ext dependencies installed"
                    }
                } else {
                    Write-Warn "  $ext dependencies install failed (non-critical)"
                }
            } finally {
                Pop-Location
            }
        }
    }
} else {
    Write-Warn "Skipping node_modules"
    if (Test-Path (Join-Path $NodeModulesCache "node_modules")) {
        Write-OK "Using cached node_modules"
    } else {
        Write-Err "No cached node_modules found!"
        exit 1
    }
}

# ============================================================================
# Step 5: Check Node.js portable
# ============================================================================
Write-Step "5/7" "Check Node.js Portable"

$nodePortable = Join-Path $ScriptDir "node-portable\node.exe"
if (Test-Path $nodePortable) {
    $portableVer = & $nodePortable --version
    Write-OK "Node.js portable: $portableVer"
} else {
    Write-Err "Node.js portable not found: $nodePortable"
    Write-Host "  Please download Node.js portable and extract to scripts\windows\node-portable\" -ForegroundColor Yellow
    exit 1
}

# ============================================================================
# Step 6: Update version and paths in setup.iss
# ============================================================================
Write-Step "6/7" "Update Version"

$setupIss = Join-Path $ScriptDir "setup.iss"
if (Test-Path $setupIss) {
    $content = Get-Content $setupIss -Raw
    
    # Update version
    $content = $content -replace '#define MyAppVersion ".*"', "#define MyAppVersion `"$Version`""
    $content = $content -replace 'OutputBaseFilename=ClawdbotCN-Setup-[^\r\n]+-x64', "OutputBaseFilename=ClawdbotCN-Setup-$Version-x64"
    
    # Update dynamic paths (avoid hardcoding)
    $content = $content -replace 'OutputDir=.*', "OutputDir=$InstallerDir"
    $content = $content -replace 'Source: "[^"]*node_modules\\\*"', "Source: `"$NodeModulesCache\node_modules\*`""
    
    Set-Content -Path $setupIss -Value $content -Encoding UTF8
    Write-OK "Version updated to: $Version"
} else {
    Write-Err "setup.iss not found"
    exit 1
}

# ============================================================================
# Step 7: Compile installer
# ============================================================================
Write-Step "7/7" "Compile Installer"

if (-not (Test-Path $InstallerDir)) {
    New-Item -ItemType Directory -Path $InstallerDir -Force | Out-Null
}

# Remove old installer
$oldInstaller = Join-Path $InstallerDir "ClawdbotCN-Setup-$Version-x64.exe"
if (Test-Path $oldInstaller) {
    Remove-Item $oldInstaller -Force
}

Write-Info "Running Inno Setup compiler..."
$startTime = Get-Date

& $InnoSetupPath $setupIss

if ($LASTEXITCODE -ne 0) {
    Write-Err "Compilation failed!"
    exit 1
}

$duration = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)

$outputExe = Join-Path $InstallerDir "ClawdbotCN-Setup-$Version-x64.exe"
if (Test-Path $outputExe) {
    $fileSize = [math]::Round((Get-Item $outputExe).Length / 1MB, 2)
    Write-OK "Compilation successful!"
} else {
    Write-Err "Output file not found"
    exit 1
}

# ============================================================================
# Done
# ============================================================================
Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "   Build Complete!" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Output: $outputExe"
Write-Host "  Size:   $fileSize MB"
Write-Host "  Time:   $duration seconds"
Write-Host ""
Write-Host "  China Mirrors Used:" -ForegroundColor Cyan
Write-Host "    npm: $NpmMirror"
Write-Host "    Skills: http://121.43.61.90/api (ClawdSkillsProxy)"
Write-Host ""
Write-Host "  To test:" -ForegroundColor Cyan
Write-Host "    Start-Process `"$outputExe`""
Write-Host ""
