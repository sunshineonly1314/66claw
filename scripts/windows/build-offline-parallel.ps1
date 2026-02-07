# ============================================================================
# Clawdbot Windows Offline Build Script - Parallel Version
# ============================================================================
# 使用多线程并行构建，显著提升打包速度
#
# Usage:
#   .\build-offline-parallel.ps1
#   .\build-offline-parallel.ps1 -Version "2026.2.3"
#   .\build-offline-parallel.ps1 -MaxThreads 20     # 使用 20 核心
#   .\build-offline-parallel.ps1 -SkipBuild         # 跳过 TypeScript 构建
#
# Output:
#   E:\clawdbuild\ClawdbotCN-Setup-{version}-x64.exe (offline)
#   E:\clawdbuild\ClawdbotCN-Setup-{version}-x64-online.exe (online)
# ============================================================================

param(
    [string]$Version = "2026.2.3",
    [int]$MaxThreads = 20,
    [switch]$SkipNodeModules,
    [switch]$SkipBuild,
    [switch]$SkipEncodingConvert,
    [switch]$OnlineOnly
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

# Timing
$script:Timings = @{}
$script:TotalStartTime = Get-Date

function Write-Step {
    param([string]$Step, [string]$Message)
    Write-Host ""
    Write-Host "[$Step] $Message" -ForegroundColor Cyan
    Write-Host ("=" * 70) -ForegroundColor DarkGray
}

function Write-OK { param([string]$Message); Write-Host "  [OK] $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message); Write-Host "  [WARN] $Message" -ForegroundColor Yellow }
function Write-Err { param([string]$Message); Write-Host "  [ERROR] $Message" -ForegroundColor Red }
function Write-Info { param([string]$Message); Write-Host "  $Message" -ForegroundColor Gray }
function Write-Parallel { param([string]$Message); Write-Host "  [PARALLEL] $Message" -ForegroundColor Magenta }

function Start-Timing {
    param([string]$Name)
    $script:Timings[$Name] = @{ Start = Get-Date; End = $null }
}

function Stop-Timing {
    param([string]$Name)
    if ($script:Timings.ContainsKey($Name)) {
        $script:Timings[$Name].End = Get-Date
    }
}

function Get-TimingSeconds {
    param([string]$Name)
    if ($script:Timings.ContainsKey($Name) -and $script:Timings[$Name].End) {
        return [math]::Round(($script:Timings[$Name].End - $script:Timings[$Name].Start).TotalSeconds, 1)
    }
    return 0
}

# ============================================================================
# Header
# ============================================================================
Write-Host ""
Write-Host "========================================================================" -ForegroundColor Magenta
Write-Host "   Clawdbot Windows Offline Build - PARALLEL MODE ($MaxThreads threads)" -ForegroundColor Magenta
Write-Host "========================================================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Version:     $Version"
Write-Host "  Threads:     $MaxThreads (of $([Environment]::ProcessorCount) available)"
Write-Host "  npm Mirror:  $NpmMirror"
Write-Host "  Output:      $InstallerDir"
Write-Host ""

# ============================================================================
# Step 1: Check prerequisites
# ============================================================================
Write-Step "1/6" "Check Prerequisites"

$InnoSetupPath = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if (-not (Test-Path $InnoSetupPath)) {
    Write-Err "Inno Setup 6 not found at: $InnoSetupPath"
    exit 1
}
Write-OK "Inno Setup: $InnoSetupPath"

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) { Write-Err "Node.js not found"; exit 1 }
$nodeVer = & node -v
Write-OK "Node.js: $nodeVer"

$pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpmCmd) { Write-Err "pnpm not found"; exit 1 }
Write-OK "pnpm found"

$nodePortable = Join-Path $ScriptDir "node-portable\node.exe"
if (-not (Test-Path $nodePortable)) {
    Write-Err "Node.js portable not found: $nodePortable"
    exit 1
}
Write-OK "Node.js portable ready"

# ============================================================================
# Step 2: Parallel Phase 1 - TypeScript Build + Encoding Conversion
# ============================================================================
Write-Step "2/6" "Parallel Phase 1: Build + Encoding Conversion"

$phase1Jobs = @()

# Job 1: TypeScript Build
if (-not $SkipBuild) {
    Write-Parallel "Starting TypeScript build in background..."
    Start-Timing "tsc-build"
    
    $phase1Jobs += Start-Job -Name "tsc-build" -ScriptBlock {
        param($RootDir)
        Set-Location $RootDir
        & pnpm build 2>&1
        return $LASTEXITCODE
    } -ArgumentList $RootDir
}

# Job 2: Encoding Conversion
if (-not $SkipEncodingConvert) {
    Write-Parallel "Starting encoding conversion in background..."
    Start-Timing "encoding"
    
    $convertScript = Join-Path $ScriptDir "convert-encoding.ps1"
    if (Test-Path $convertScript) {
        $phase1Jobs += Start-Job -Name "encoding" -ScriptBlock {
            param($Script)
            & powershell -ExecutionPolicy Bypass -File $Script -All 2>&1
            return $LASTEXITCODE
        } -ArgumentList $convertScript
    }
}

# Job 3: .NET Native Service Build
$serviceScript = Join-Path $ScriptDir "native\build-service.ps1"
if (Test-Path $serviceScript) {
    Write-Parallel "Starting .NET Native Service build in background..."
    Start-Timing "dotnet-service"
    
    $phase1Jobs += Start-Job -Name "dotnet-service" -ScriptBlock {
        param($Script)
        & powershell -ExecutionPolicy Bypass -File $Script 2>&1
        return $LASTEXITCODE
    } -ArgumentList $serviceScript
}

# Wait for Phase 1 jobs
if ($phase1Jobs.Count -gt 0) {
    Write-Info "Waiting for $($phase1Jobs.Count) parallel jobs..."
    $phase1Jobs | Wait-Job | Out-Null
    
    foreach ($job in $phase1Jobs) {
        $result = Receive-Job -Job $job
        Stop-Timing $job.Name
        $duration = Get-TimingSeconds $job.Name
        
        if ($job.State -eq "Completed") {
            Write-OK "$($job.Name) completed ($duration s)"
        } else {
            Write-Err "$($job.Name) failed!"
            Write-Host $result -ForegroundColor Red
            exit 1
        }
        Remove-Job -Job $job
    }
}

# ============================================================================
# Step 3: Parallel Phase 2 - Install Dependencies (Main + Extensions)
# ============================================================================
Write-Step "3/6" "Parallel Phase 2: Install Dependencies ($MaxThreads threads)"

if (-not $SkipNodeModules) {
    Start-Timing "npm-install"
    
    # Ensure output dir exists
    if (-not (Test-Path $NodeModulesCache)) {
        New-Item -ItemType Directory -Path $NodeModulesCache -Force | Out-Null
    }
    Copy-Item (Join-Path $RootDir "package.json") $NodeModulesCache -Force
    
    # Use ThreadJob for better performance (if available) or regular jobs
    $useThreadJob = Get-Command Start-ThreadJob -ErrorAction SilentlyContinue
    
    # Define all npm install tasks
    $npmTasks = @(
        @{
            Name = "main-deps"
            Dir = $NodeModulesCache
            Desc = "Main production dependencies"
        },
        @{
            Name = "dingtalk-deps"
            Dir = Join-Path $RootDir "extensions\dingtalk"
            Desc = "DingTalk extension"
        },
        @{
            Name = "feishu-deps"
            Dir = Join-Path $RootDir "extensions\feishu"
            Desc = "Feishu extension"
        },
        @{
            Name = "wecom-deps"
            Dir = Join-Path $RootDir "extensions\wecom"
            Desc = "WeCom extension"
        }
    )
    
    $npmJobs = @()
    $npmScriptBlock = {
        param($Dir, $Mirror)
        Set-Location $Dir
        & npm config set registry $Mirror
        & npm install --omit=dev --legacy-peer-deps --no-audit --no-fund --registry=$Mirror 2>&1
        return @{
            ExitCode = $LASTEXITCODE
            Dir = $Dir
        }
    }
    
    foreach ($task in $npmTasks) {
        if (Test-Path (Join-Path $task.Dir "package.json")) {
            Write-Parallel "Starting $($task.Desc)..."
            
            if ($useThreadJob) {
                $npmJobs += Start-ThreadJob -Name $task.Name -ThrottleLimit $MaxThreads -ScriptBlock $npmScriptBlock -ArgumentList $task.Dir, $NpmMirror
            } else {
                $npmJobs += Start-Job -Name $task.Name -ScriptBlock $npmScriptBlock -ArgumentList $task.Dir, $NpmMirror
            }
        }
    }
    
    # Wait for all npm jobs
    Write-Info "Running $($npmJobs.Count) npm install jobs in parallel..."
    $npmJobs | Wait-Job | Out-Null
    
    Stop-Timing "npm-install"
    $npmDuration = Get-TimingSeconds "npm-install"
    
    $allSuccess = $true
    foreach ($job in $npmJobs) {
        $result = Receive-Job -Job $job
        if ($job.State -eq "Completed" -and $result.ExitCode -eq 0) {
            Write-OK "$($job.Name) completed"
        } else {
            Write-Warn "$($job.Name) may have issues"
            $allSuccess = $false
        }
        Remove-Job -Job $job
    }
    
    # Report size
    if (Test-Path (Join-Path $NodeModulesCache "node_modules")) {
        $nmSize = (Get-ChildItem (Join-Path $NodeModulesCache "node_modules") -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
        Write-OK "Total dependencies: $([math]::Round($nmSize, 0)) MB (installed in $npmDuration s)"
    }
    
} else {
    Write-Warn "Skipping node_modules installation"
}

# ============================================================================
# Step 4: Update version
# ============================================================================
Write-Step "4/6" "Update Version in setup.iss"

$setupIss = Join-Path $ScriptDir "setup.iss"
$setupOnlineIss = Join-Path $ScriptDir "setup-online.iss"

foreach ($issFile in @($setupIss, $setupOnlineIss)) {
    if (Test-Path $issFile) {
        $content = Get-Content $issFile -Raw
        $content = $content -replace '#define MyAppVersion ".*"', "#define MyAppVersion `"$Version`""
        $content = $content -replace 'OutputBaseFilename=ClawdbotCN-Setup-[^\r\n]+-x64', "OutputBaseFilename=ClawdbotCN-Setup-$Version-x64"
        $content = $content -replace 'OutputDir=.*', "OutputDir=$InstallerDir"
        if ($issFile -eq $setupIss) {
            $content = $content -replace 'Source: "[^"]*node_modules\\\*"', "Source: `"$NodeModulesCache\node_modules\*`""
        }
        Set-Content -Path $issFile -Value $content -Encoding UTF8
        Write-OK "Updated: $(Split-Path $issFile -Leaf)"
    }
}

# ============================================================================
# Step 5: Parallel Phase 3 - Compile Installers
# ============================================================================
Write-Step "5/6" "Parallel Phase 3: Compile Installers"

if (-not (Test-Path $InstallerDir)) {
    New-Item -ItemType Directory -Path $InstallerDir -Force | Out-Null
}

Start-Timing "compile"

$compileJobs = @()

# Offline installer
if (-not $OnlineOnly) {
    $offlineExe = Join-Path $InstallerDir "ClawdbotCN-Setup-$Version-x64.exe"
    Remove-Item $offlineExe -Force -ErrorAction SilentlyContinue
    
    Write-Parallel "Compiling offline installer..."
    $compileJobs += Start-Job -Name "offline" -ScriptBlock {
        param($InnoPath, $IssFile)
        & $InnoPath $IssFile 2>&1
        return $LASTEXITCODE
    } -ArgumentList $InnoSetupPath, $setupIss
}

# Online installer (if exists)
if (Test-Path $setupOnlineIss) {
    $onlineExe = Join-Path $InstallerDir "ClawdbotCN-Setup-$Version-x64-online.exe"
    Remove-Item $onlineExe -Force -ErrorAction SilentlyContinue
    
    Write-Parallel "Compiling online installer..."
    $compileJobs += Start-Job -Name "online" -ScriptBlock {
        param($InnoPath, $IssFile)
        & $InnoPath $IssFile 2>&1
        return $LASTEXITCODE
    } -ArgumentList $InnoSetupPath, $setupOnlineIss
}

# Wait for compilation
Write-Info "Compiling $($compileJobs.Count) installers in parallel..."
$compileJobs | Wait-Job | Out-Null

Stop-Timing "compile"
$compileDuration = Get-TimingSeconds "compile"

foreach ($job in $compileJobs) {
    $result = Receive-Job -Job $job
    if ($job.State -eq "Completed") {
        Write-OK "$($job.Name) installer compiled"
    } else {
        Write-Err "$($job.Name) compilation failed!"
        Write-Host $result -ForegroundColor Red
    }
    Remove-Job -Job $job
}

# ============================================================================
# Step 6: Summary
# ============================================================================
Write-Step "6/6" "Build Summary"

$totalDuration = [math]::Round(((Get-Date) - $script:TotalStartTime).TotalSeconds, 1)

Write-Host ""
Write-Host "========================================================================" -ForegroundColor Green
Write-Host "   Build Complete! (Total: $totalDuration seconds)" -ForegroundColor Green
Write-Host "========================================================================" -ForegroundColor Green
Write-Host ""

# Timing breakdown
Write-Host "  Timing Breakdown:" -ForegroundColor Cyan
$timingTable = @()
foreach ($key in $script:Timings.Keys) {
    $sec = Get-TimingSeconds $key
    if ($sec -gt 0) {
        $timingTable += "    - $key : $sec s"
    }
}
$timingTable | Sort-Object | ForEach-Object { Write-Host $_ }
Write-Host ""

# Output files
Write-Host "  Output Files:" -ForegroundColor Cyan
Get-ChildItem "$InstallerDir\ClawdbotCN-Setup-$Version*.exe" -ErrorAction SilentlyContinue | ForEach-Object {
    $size = [math]::Round($_.Length / 1MB, 2)
    Write-Host "    - $($_.Name) --> $size MB" -ForegroundColor White
}
Write-Host ""

# Performance comparison
$estimatedSerial = (Get-TimingSeconds "tsc-build") + (Get-TimingSeconds "encoding") + (Get-TimingSeconds "npm-install") + (Get-TimingSeconds "compile") + 30
if ($estimatedSerial -gt $totalDuration) {
    $speedup = [math]::Round($estimatedSerial / $totalDuration, 1)
    Write-Host "  Performance:" -ForegroundColor Cyan
    Write-Host "    - Parallel mode saved ~$([math]::Round($estimatedSerial - $totalDuration, 0)) seconds" -ForegroundColor Green
    Write-Host "    - Speedup: ~${speedup}x vs serial execution" -ForegroundColor Green
}
Write-Host ""

Write-Host "  To test:" -ForegroundColor Cyan
$testExe = Get-ChildItem "$InstallerDir\ClawdbotCN-Setup-$Version-x64.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($testExe) {
    Write-Host "    Start-Process `"$($testExe.FullName)`""
}
Write-Host ""
