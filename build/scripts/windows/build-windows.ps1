# ============================================================================
# ClawdbotCN Windows Unified Build Script
#
# Replaces:
#   - build-parallel-package.ps1  (regular build, 53 skills)
#   - build-full-package.ps1      (full build, 3000+ skills + proxy tools)
#   - dev-fast-build.ps1          (dev build, zip compression)
#   - extract-bundled-bins.ps1    (bundled-bins extraction)
#
# Modes:
#   standard  53 core skills, 7 bundled-bins                    ~150 MB
#   full      3061 skills (skills-merged/), + 7 proxy tools     ~500+ MB
#
# Usage:
#   .\build-windows.ps1                              # auto-detect mode
#   .\build-windows.ps1 -Mode standard               # regular build
#   .\build-windows.ps1 -Mode full                   # full offline build
#   .\build-windows.ps1 -FastCompress                # zip compression (dev)
#   .\build-windows.ps1 -Mode full -MaxThreads 22 -TestInstall
#
# Parameters:
#   -Mode              "standard" or "full" (auto-detect if omitted)
#   -MaxThreads        Concurrent threads (default: auto based on CPU cores)
#   -OutputDir         Output directory (default: E:\clawdbuild)
#   -Version           Version number (default: auto from package.json)
#   -BinariesDir       Pre-downloaded binaries (default: build\download-output)
#   -SkipBuild         Skip TypeScript + UI compilation
#   -SkipNodeModules   Skip production node_modules install
#   -SkipExtensions    Skip extension install + build
#   -SkipProxyTools    Skip proxy binary extraction (full mode only)
#   -FastCompress      Use zip compression (5-10x faster, for dev/testing)
#   -TestInstall       Auto-install after build (silent install + verify)
#   -ExtractBundledBins  Extract bundled-bins from download-output zips
# ============================================================================

param(
    [ValidateSet("standard", "full", "")]
    [string]$Mode = "",
    [int]$MaxThreads = 0,
    [string]$OutputDir = "E:\clawdbuild",
    [string]$Version = "",
    [string]$BinariesDir = "",
    [switch]$SkipBuild,
    [switch]$SkipNodeModules,
    [switch]$SkipExtensions,
    [switch]$SkipProxyTools,
    [switch]$FastCompress,
    [switch]$TestInstall,
    [switch]$ExtractBundledBins
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$ScriptStartTime = Get-Date

# ============================================================================
# Resolve paths
# ============================================================================
$_ScriptsDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$_BuildDir = Split-Path -Parent (Split-Path -Parent $_ScriptsDir)
$ProjectRoot = Split-Path -Parent $_BuildDir
$ScriptsDir = Join-Path $ProjectRoot "scripts\windows"

if (-not $BinariesDir) {
    $BinariesDir = Join-Path $_BuildDir "download-output"
}

# ============================================================================
# Dynamic thread scaling
# ============================================================================
$cpuCores = [Environment]::ProcessorCount
if ($MaxThreads -le 0) {
    $MaxThreads = [Math]::Min(22, [Math]::Max(4, $cpuCores * 2))
}

try {
    $freeMemMB = [Math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1024, 0)
    if ($freeMemMB -lt 2000) {
        Write-Host "  [!] Low memory: ${freeMemMB}MB free. Reducing threads to 4." -ForegroundColor Yellow
        $MaxThreads = [Math]::Min($MaxThreads, 4)
    }
} catch {
    # CIM query may fail on some configurations
}

# ============================================================================
# Auto-detect version
# ============================================================================
if (-not $Version) {
    $pkgJson = Get-Content "$ProjectRoot\package.json" -Raw | ConvertFrom-Json
    $Version = $pkgJson.version
    if (-not $Version) { $Version = "0.0.0" }
}

# ============================================================================
# Auto-detect mode
# ============================================================================
$skillsMergedDir = "$ProjectRoot\skills-merged"
if (-not $Mode) {
    if ((Test-Path $skillsMergedDir) -and (Get-ChildItem -Directory $skillsMergedDir -ErrorAction SilentlyContinue).Count -gt 100) {
        $Mode = "full"
        Write-Host "  [i] Auto-detected mode: full (skills-merged/ found)" -ForegroundColor DarkCyan
    } else {
        $Mode = "standard"
        Write-Host "  [i] Auto-detected mode: standard" -ForegroundColor DarkCyan
    }
}

$isFullMode = ($Mode -eq "full")

# ============================================================================
# Helper Functions
# ============================================================================

function Write-Step {
    param([string]$Step, [string]$Message)
    Write-Host ""
    Write-Host "[$Step] $Message" -ForegroundColor Cyan
    Write-Host ("-" * 60) -ForegroundColor DarkGray
}

function Write-OK {
    param([string]$Message)
    Write-Host "  [OK] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "  [!] $Message" -ForegroundColor Yellow
}

function Write-Err {
    param([string]$Message)
    Write-Host "  [X] $Message" -ForegroundColor Red
}

function Get-ElapsedTime {
    param([DateTime]$From)
    $elapsed = (Get-Date) - $From
    return "$($elapsed.Minutes)m $($elapsed.Seconds)s"
}

function Get-DiskFreeGB {
    param([string]$Path)
    try {
        $drive = (Resolve-Path $Path -ErrorAction SilentlyContinue).Drive.Name
        if (-not $drive) { $drive = $Path.Substring(0, 1) }
        $disk = Get-PSDrive $drive -ErrorAction SilentlyContinue
        if ($disk) {
            return [Math]::Round($disk.Free / 1GB, 1)
        }
    } catch {}
    return -1
}

# ============================================================================
# Calculate total steps
# ============================================================================
$totalSteps = 6  # prerequisites, parallel-all, native-addon, tools-check, verify, compile
$currentStep = 0

function Get-StepLabel {
    $script:currentStep++
    return "$($script:currentStep)/$($script:totalSteps)"
}

# ============================================================================
# Banner
# ============================================================================
$modeLabel = if ($isFullMode) { "FULL (all skills + proxy tools)" } else { "STANDARD (core skills)" }
$compressLabel = if ($FastCompress) { "zip (fast)" } else { "lzma2/max (release)" }

Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Magenta
Write-Host "  ClawdbotCN Windows Unified Builder" -ForegroundColor Magenta
Write-Host "  Mode: $modeLabel" -ForegroundColor Magenta
Write-Host "  Protection: 5-Layer (obfuscate + bytecode + native + UPX)" -ForegroundColor Magenta
Write-Host "  ============================================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Version:     $Version"
Write-Host "  Mode:        $Mode"
Write-Host "  Threads:     $MaxThreads (CPU cores: $cpuCores)"
Write-Host "  Compression: $compressLabel"
Write-Host "  Output:      $OutputDir"
Write-Host "  Project:     $ProjectRoot"
if ($isFullMode) {
    Write-Host "  Binaries:    $BinariesDir"
}
Write-Host ""

# Check disk space
$diskFreeGB = Get-DiskFreeGB $OutputDir
if ($diskFreeGB -gt 0) {
    $minGB = if ($isFullMode) { 5 } else { 2 }
    if ($diskFreeGB -lt $minGB) {
        Write-Err "Low disk space: ${diskFreeGB}GB free on output drive (need ${minGB}GB+)"
        exit 1
    }
    Write-Host "  Disk free:   ${diskFreeGB}GB"
}
Write-Host ""

# ============================================================================
# Step 1: Check Prerequisites
# ============================================================================
Write-Step (Get-StepLabel) "Checking prerequisites"

# --- Inno Setup ---
$InnoCompiler = $null
$innoPaths = @(
    "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
    "C:\Program Files\Inno Setup 6\ISCC.exe",
    "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
)
foreach ($p in $innoPaths) {
    if (Test-Path $p) { $InnoCompiler = $p; break }
}
if (-not $InnoCompiler) {
    Write-Err "Inno Setup 6 not installed!"
    Write-Host "  Please download from https://jrsoftware.org/isdl.php"
    exit 1
}
Write-OK "Inno Setup 6: $InnoCompiler"

# --- Node.js ---
$nodeVersion = & node --version 2>$null
if (-not $nodeVersion) {
    Write-Err "Node.js not installed!"
    exit 1
}
Write-OK "Node.js: $nodeVersion"

# --- pnpm ---
$pnpmVersion = & pnpm --version 2>$null
if (-not $pnpmVersion) {
    Write-Err "pnpm not installed!"
    exit 1
}
Write-OK "pnpm: $pnpmVersion"

# --- UPX (optional, for binary protection Layer 4) ---
$hasUpx = $false
try {
    $upxVersion = & upx --version 2>$null | Select-Object -First 1
    if ($upxVersion) {
        $hasUpx = $true
        Write-OK "UPX: $upxVersion"
    }
} catch {}
if (-not $hasUpx) {
    Write-Warn "UPX not found (optional). Install: choco install upx / scoop install upx"
}

# --- Native Addon build tools (optional, for Layer 3 C++ addon) ---
$hasNativeTools = $false
# Method 1: Check via vswhere (most reliable for VS Build Tools)
$vsWherePath = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vsWherePath) {
    try {
        $clPath = & $vsWherePath -latest -find "VC\Tools\MSVC\*\bin\Hostx64\x64\cl.exe" 2>$null | Select-Object -First 1
        if ($clPath) { $hasNativeTools = $true }
    } catch {}
}
# Method 2: cl.exe in PATH (e.g., inside Developer Command Prompt)
if (-not $hasNativeTools) {
    try {
        $clOutput = & where cl.exe 2>$null
        if ($clOutput) { $hasNativeTools = $true }
    } catch {}
}
# Method 3: node-gyp can find build tools on its own
if (-not $hasNativeTools) {
    try {
        $ngOutput = & npx node-gyp list 2>$null
        if ($LASTEXITCODE -eq 0) { $hasNativeTools = $true }
    } catch {}
}
if ($hasNativeTools) {
    Write-OK "Native build tools: available (C++ addon support)"
} else {
    Write-Warn "C++ build tools not found (optional). Native addon will be skipped."
    Write-Host "  Install: Visual Studio Build Tools (Desktop C++ workload)" -ForegroundColor DarkGray
}

# --- Node portable (required for installer) ---
$nodePortableDir = "$ScriptsDir\node-portable"
if (-not (Test-Path $nodePortableDir)) {
    Write-Err "node-portable not found: $nodePortableDir"
    Write-Host "  The installer needs a portable Node.js runtime." -ForegroundColor DarkGray
    exit 1
}
Write-OK "node-portable: ready"

# --- Full mode: check skills-merged ---
if ($isFullMode) {
    if (-not (Test-Path $skillsMergedDir)) {
        Write-Err "skills-merged/ directory not found!"
        Write-Host "  Expected: $skillsMergedDir" -ForegroundColor Red
        Write-Host "  Run the skill wash pipeline first to populate skills-merged/" -ForegroundColor DarkGray
        exit 1
    }
    $skillCount = (Get-ChildItem -Directory $skillsMergedDir).Count
    if ($skillCount -eq 0) {
        Write-Err "skills-merged/ is empty!"
        exit 1
    }
    Write-OK "skills-merged/: $skillCount skills"
}

# --- Create output directory ---
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}
Write-OK "Output directory ready: $OutputDir"

# ============================================================================
# Step 2: Parallel Build Phase
#   Job A: build:secure -> ui:build (sequential within job)
#   Job B: npm install --omit=dev (production dependencies)
#   Job C1-Cn: extension install -> build (per extension)
#
#   All jobs run concurrently. npm install has retry logic for stability.
# ============================================================================
Write-Step (Get-StepLabel) "Parallel build phase (all offline assets)"

$phaseStart = Get-Date
$parallelJobs = @()

# --- Detect what needs building ---

$needMainBuild = $false
$needUiBuild = $false

if (-not $SkipBuild) {
    $distEntry = "$ProjectRoot\dist\entry.js"
    if (-not (Test-Path $distEntry)) {
        Write-Warn "dist/entry.js not found, need to build"
        $needMainBuild = $true
    }
    else {
        $distTime = (Get-Item $distEntry).LastWriteTime
        $srcFiles = Get-ChildItem -Path "$ProjectRoot\src" -Filter "*.ts" -Recurse -File
        $uiFiles = Get-ChildItem -Path "$ProjectRoot\ui\src" -Filter "*.ts" -Recurse -File -ErrorAction SilentlyContinue
        $allFiles = @($srcFiles) + @($uiFiles) | Where-Object { $_ -and $_.LastWriteTime -gt $distTime }
        if ($allFiles.Count -gt 0) {
            Write-Warn "$($allFiles.Count) source files changed since last build"
            $needMainBuild = $true
        }
    }

    $controlUiIndex = "$ProjectRoot\dist\control-ui\index.html"
    if (-not (Test-Path $controlUiIndex)) {
        Write-Warn "dist/control-ui/index.html not found, need to build UI"
        $needUiBuild = $true
    }
    else {
        $uiDistTime = (Get-Item $controlUiIndex).LastWriteTime
        $uiSrcFiles = Get-ChildItem -Path "$ProjectRoot\ui\src" -Recurse -File -ErrorAction SilentlyContinue
        $uiNewerFiles = $uiSrcFiles | Where-Object { $_.LastWriteTime -gt $uiDistTime }
        if ($uiNewerFiles.Count -gt 0) {
            Write-Warn "$($uiNewerFiles.Count) UI source files changed"
            $needUiBuild = $true
        }
    }
}

# --- Check node_modules ---
$needNpmInstall = $false
$nodeModulesDir = "$OutputDir\test-prod-deps"
$nodeModulesPath = "$nodeModulesDir\node_modules"

if (-not $SkipNodeModules) {
    if (-not (Test-Path $nodeModulesPath)) {
        Write-Warn "node_modules not found, need to install"
        $needNpmInstall = $true
    }
    else {
        $pkgJsonSrc = "$ProjectRoot\package.json"
        $pkgJsonDst = "$nodeModulesDir\package.json"
        if (Test-Path $pkgJsonDst) {
            $srcHash = (Get-FileHash $pkgJsonSrc).Hash
            $dstHash = (Get-FileHash $pkgJsonDst).Hash
            if ($srcHash -ne $dstHash) {
                Write-Warn "package.json changed, need to reinstall dependencies"
                $needNpmInstall = $true
            }
        }
        else {
            $needNpmInstall = $true
        }

        # Also check if any extension package.json changed (extension deps are merged into prod node_modules)
        if (-not $needNpmInstall) {
            $extPkgHashFile = "$nodeModulesDir\.ext-deps-hash"
            $extPkgHashes = ""
            $allExtPkgs = Get-ChildItem "$ProjectRoot\extensions\*\package.json" -ErrorAction SilentlyContinue | Sort-Object FullName
            foreach ($ep in $allExtPkgs) {
                $extPkgHashes += "$($ep.Name):$(Get-FileHash $ep.FullName | Select-Object -ExpandProperty Hash);"
            }
            $currentExtHash = [System.BitConverter]::ToString(
                [System.Security.Cryptography.SHA256]::Create().ComputeHash(
                    [System.Text.Encoding]::UTF8.GetBytes($extPkgHashes)
                )
            ).Replace("-", "")

            if (Test-Path $extPkgHashFile) {
                $savedExtHash = Get-Content $extPkgHashFile -Raw -ErrorAction SilentlyContinue
                if ($savedExtHash.Trim() -ne $currentExtHash) {
                    Write-Warn "Extension dependencies changed, need to reinstall"
                    $needNpmInstall = $true
                }
            }
            else {
                Write-Warn "Extension deps hash not found, need to install"
                $needNpmInstall = $true
            }
        }
    }
}

# --- Check extensions ---
# Extension dependencies are now merged into the production package.json (Job B)
# so they resolve from the shared {app}\node_modules at runtime.
# No per-extension npm install needed; just track which have deps for logging.
$extensionsWithDeps = @()
if (-not $SkipExtensions) {
    $allExtDirs = Get-ChildItem "$ProjectRoot\extensions" -Directory -ErrorAction SilentlyContinue
    foreach ($extFolder in $allExtDirs) {
        $pkgFile = "$($extFolder.FullName)\package.json"
        if (-not (Test-Path $pkgFile)) { continue }
        $pkgContent = Get-Content $pkgFile -Raw -Encoding UTF8 | ConvertFrom-Json
        $hasDeps = ($pkgContent.PSObject.Properties.Name -contains "dependencies") -and ($pkgContent.dependencies.PSObject.Properties.Count -gt 0)
        if ($hasDeps) { $extensionsWithDeps += $extFolder.Name }
    }
    if ($extensionsWithDeps.Count -gt 0) {
        Write-Host "  Extensions with deps (merged into prod node_modules): $($extensionsWithDeps -join ', ')" -ForegroundColor DarkGray
    }
}

# --- Detect what needs doing: proxy tools, skills copy, bundled-bins ---

$fullToolsDir = "$OutputDir\full-tools"
$fullSkillsDir = "$OutputDir\full-skills"

$ProxyToolExtractions = @(
    @{ Name = "gh";         SrcDir = "$BinariesDir\proxy-binaries\gh\win32";         Pattern = "*.zip";      ExeName = "gh.exe" }
    @{ Name = "himalaya";   SrcDir = "$BinariesDir\proxy-binaries\himalaya\win32";   Pattern = "*.exe";      ExeName = "himalaya.exe" }
    @{ Name = "yt-dlp";     SrcDir = "$BinariesDir\proxy-binaries\yt-dlp\win32";     Pattern = "yt-dlp.exe"; ExeName = "yt-dlp.exe" }
    @{ Name = "uv";         SrcDir = "$BinariesDir\proxy-binaries\uv\win32";         Pattern = "*.zip";      ExeName = "uv.exe" }
    @{ Name = "rclone";     SrcDir = "$BinariesDir\proxy-binaries\rclone\win32";     Pattern = "*.zip";      ExeName = "rclone.exe" }
    @{ Name = "ffmpeg";     SrcDir = "$BinariesDir\proxy-binaries\ffmpeg\win32";     Pattern = "*.zip";      ExeName = "ffmpeg.exe" }
    @{ Name = "sherpa-onnx"; SrcDir = "$BinariesDir\proxy-binaries\sherpa-onnx\win32"; Pattern = "*.tar.bz2"; ExeName = "sherpa-onnx-offline-tts.exe" }
)

$needSkillsCopy = $false
if ($isFullMode) {
    if (-not (Test-Path $fullSkillsDir)) {
        $needSkillsCopy = $true
    } else {
        $existingCount = (Get-ChildItem -Directory $fullSkillsDir -ErrorAction SilentlyContinue).Count
        if ($existingCount -ne $skillCount) {
            Write-Warn "Skills count mismatch ($existingCount vs $skillCount), will re-copy"
            $needSkillsCopy = $true
        }
    }
}

$bundledDownloadDir = "$BinariesDir\bundled-bins"
$bundledTargetDir = "$ScriptsDir\bundled-bins"
$bundledTools = @(
    @{ Name = "camsnap";  ExeName = "camsnap.exe" }
    @{ Name = "sag";      ExeName = "sag.exe" }
    @{ Name = "gog";      ExeName = "gog.exe" }
    @{ Name = "goplaces"; ExeName = "goplaces.exe" }
    @{ Name = "openhue";  ExeName = "openhue.exe" }
    @{ Name = "spogo";    ExeName = "spogo.exe" }
    @{ Name = "jira";     ExeName = "jira.exe" }
)

# --- Launch parallel jobs ---

# Job A: Main TypeScript build (deferred to foreground after I/O jobs)
# Pipeline: build:secure (tsc+obfuscate) → bytecode (portable Node) → integrity → ui:build
# MainBuild runs in foreground AFTER I/O jobs complete (see below)
# This avoids Start-Job PATH inheritance issues and timeout problems.
if ($needMainBuild -or $needUiBuild) {
    Write-Host "  [i] TypeScript build will run in foreground after I/O jobs" -ForegroundColor DarkCyan
}
else {
    if (-not $SkipBuild) {
        Write-OK "TypeScript & UI are up to date"
    }
    else {
        Write-Warn "Skipping build (-SkipBuild flag)"
    }
}

# Job B: Production node_modules (with retry logic for stability)
if ($needNpmInstall) {
    if (-not (Test-Path $nodeModulesDir)) {
        New-Item -ItemType Directory -Path $nodeModulesDir -Force | Out-Null
    }
    Copy-Item "$ProjectRoot\package.json" "$nodeModulesDir\" -Force

    # Merge all extension dependencies into production package.json
    # so extensions can resolve their deps from the shared {app}\node_modules
    # (extensions' own node_modules are excluded from installer due to Inno Setup 32-bit OOM)
    $prodPkgPath = "$nodeModulesDir\package.json"
    $prodPkg = Get-Content $prodPkgPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $mergedCount = 0
    $allExtPkgFiles = Get-ChildItem "$ProjectRoot\extensions\*\package.json" -ErrorAction SilentlyContinue
    foreach ($extPkgFile in $allExtPkgFiles) {
        $extPkg = Get-Content $extPkgFile.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
        if (-not ($extPkg.PSObject.Properties.Name -contains "dependencies")) { continue }
        foreach ($dep in $extPkg.dependencies.PSObject.Properties) {
            $depName = $dep.Name
            $depVer = $dep.Value
            # Skip workspace refs and zod (already in main deps)
            if ($depVer -like "workspace:*") { continue }
            if ($depName -eq "zod") { continue }
            # Add to prod dependencies if not already present
            if (-not ($prodPkg.dependencies.PSObject.Properties.Name -contains $depName)) {
                $prodPkg.dependencies | Add-Member -NotePropertyName $depName -NotePropertyValue $depVer
                $mergedCount++
            }
        }
    }
    if ($mergedCount -gt 0) {
        $prodPkg | ConvertTo-Json -Depth 10 | Set-Content $prodPkgPath -Encoding UTF8
        Write-Host "  Merged $mergedCount extension dependencies into production package.json" -ForegroundColor DarkCyan
    }

    # Save extension deps hash for change detection
    $extPkgHashes = ""
    $allExtPkgsSorted = Get-ChildItem "$ProjectRoot\extensions\*\package.json" -ErrorAction SilentlyContinue | Sort-Object FullName
    foreach ($ep in $allExtPkgsSorted) {
        $extPkgHashes += "$($ep.Name):$(Get-FileHash $ep.FullName | Select-Object -ExpandProperty Hash);"
    }
    $currentExtHash = [System.BitConverter]::ToString(
        [System.Security.Cryptography.SHA256]::Create().ComputeHash(
            [System.Text.Encoding]::UTF8.GetBytes($extPkgHashes)
        )
    ).Replace("-", "")
    Set-Content "$nodeModulesDir\.ext-deps-hash" $currentExtHash -Encoding UTF8

    Write-Host "  -> Launching: npm install --omit=dev ($MaxThreads connections)" -ForegroundColor DarkCyan
    $parallelJobs += Start-Job -Name "NodeModules" -ScriptBlock {
        param($dir, $maxThreads)
        Set-Location $dir

        $maxRetries = 3
        $lastError = ""

        for ($attempt = 1; $attempt -le $maxRetries; $attempt++) {
            $prevEA = $ErrorActionPreference
            $ErrorActionPreference = "Continue"

            $output = & npm install --omit=dev --legacy-peer-deps --no-audit --no-fund --prefer-offline --maxsockets=$maxThreads --registry=https://registry.npmmirror.com 2>&1
            $code = $LASTEXITCODE

            $ErrorActionPreference = $prevEA

            if ($code -eq 0) {
                $retryMsg = if ($attempt -gt 1) { " (succeeded on attempt $attempt)" } else { "" }
                return @{ Success = $true; Retries = ($attempt - 1); Message = $retryMsg }
            }

            $lastError = ($output | Select-Object -Last 10) -join "`n"
            if ($attempt -lt $maxRetries) {
                Start-Sleep -Seconds (3 * $attempt)
                # Clean node_modules on retry to avoid partial state
                $nmPath = Join-Path $dir "node_modules"
                if (Test-Path $nmPath) {
                    Remove-Item $nmPath -Recurse -Force -ErrorAction SilentlyContinue
                }
            }
        }

        return @{ Success = $false; Error = "npm install failed after $maxRetries attempts (exit $code)`n$lastError" }
    } -ArgumentList $nodeModulesDir, $MaxThreads
}
else {
    if (-not $SkipNodeModules) {
        Write-OK "node_modules is up to date"
    }
    else {
        Write-Warn "Skipping node_modules (-SkipNodeModules flag)"
    }
}

# Extension deps are now merged into production package.json (Job B above)
# No per-extension npm install jobs needed.

# --- Job D: Proxy tool extraction (full mode, parallel) ---
if ($isFullMode -and -not $SkipProxyTools) {
    Write-Host "  -> Launching: proxy tool extraction (7 tools)" -ForegroundColor DarkCyan
    $proxyToolsJson = ConvertTo-Json -InputObject $ProxyToolExtractions -Depth 5 -Compress
    $parallelJobs += Start-Job -Name "ProxyTools" -ScriptBlock {
        param($toolsJson, $toolsDir, $outDir)
        $tools = $toolsJson | ConvertFrom-Json
        if (-not (Test-Path $toolsDir)) {
            New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null
        }

        $found = @()
        $missing = @()

        foreach ($tool in $tools) {
            $destExe = Join-Path $toolsDir $tool.ExeName

            # Already extracted?
            if ((Test-Path $destExe) -and (Get-Item $destExe).Length -gt 100KB) {
                $sizeMB = [math]::Round((Get-Item $destExe).Length / 1MB, 1)
                $found += "$($tool.Name)(${sizeMB}MB)"
                continue
            }

            if (-not (Test-Path $tool.SrcDir)) { $missing += $tool.Name; continue }

            $archives = Get-ChildItem -Path $tool.SrcDir -Filter $tool.Pattern -File -ErrorAction SilentlyContinue
            if (-not $archives -or $archives.Count -eq 0) { $missing += $tool.Name; continue }

            $archive = $archives | Select-Object -First 1
            $tempExtract = Join-Path $outDir "temp-extract-$($tool.Name)"
            if (Test-Path $tempExtract) { Remove-Item $tempExtract -Recurse -Force }
            New-Item -ItemType Directory -Path $tempExtract -Force | Out-Null

            try {
                $ext = $archive.Extension.ToLower()
                $fullName = $archive.Name.ToLower()

                if ($ext -eq ".exe") {
                    Copy-Item $archive.FullName $destExe -Force
                }
                elseif ($ext -eq ".zip") {
                    Expand-Archive -Path $archive.FullName -DestinationPath $tempExtract -Force
                    $f = Get-ChildItem -Path $tempExtract -Filter $tool.ExeName -Recurse -File | Select-Object -First 1
                    if ($f) { Copy-Item $f.FullName $destExe -Force }
                    else { $missing += $tool.Name; continue }
                }
                elseif ($fullName -match '\.(tar\.gz|tar\.bz2|tar\.xz|tgz)$') {
                    & tar -xf $archive.FullName -C $tempExtract 2>$null
                    if ($LASTEXITCODE -ne 0) { $missing += $tool.Name; continue }
                    $f = Get-ChildItem -Path $tempExtract -Filter $tool.ExeName -Recurse -File | Select-Object -First 1
                    if ($f) {
                        Copy-Item $f.FullName $destExe -Force
                    }
                    elseif ($tool.Name -eq "sherpa-onnx") {
                        $sherpaDir = Get-ChildItem -Path $tempExtract -Directory | Select-Object -First 1
                        if ($sherpaDir) {
                            $sherpaDest = Join-Path $toolsDir "sherpa-onnx"
                            if (Test-Path $sherpaDest) { Remove-Item $sherpaDest -Recurse -Force }
                            Copy-Item $sherpaDir.FullName $sherpaDest -Recurse -Force
                            Set-Content $destExe "sherpa-onnx directory: $sherpaDest" -Encoding UTF8
                        }
                    }
                    else { $missing += $tool.Name; continue }
                }

                if (Test-Path $destExe) {
                    $sizeMB = [math]::Round((Get-Item $destExe).Length / 1MB, 1)
                    $found += "$($tool.Name)(${sizeMB}MB)"
                }
            }
            catch { $missing += $tool.Name }
            finally {
                if (Test-Path $tempExtract) { Remove-Item $tempExtract -Recurse -Force -ErrorAction SilentlyContinue }
            }
        }

        return @{ Success = $true; Found = ($found -join ", "); Missing = ($missing -join ", ") }
    } -ArgumentList $proxyToolsJson, $fullToolsDir, $OutputDir
}

# --- Job E: Skills copy via robocopy (full mode, parallel) ---
if ($isFullMode -and $needSkillsCopy) {
    Write-Host "  -> Launching: skills copy ($skillCount skills, robocopy /MT:$([Math]::Min($MaxThreads, 16)))" -ForegroundColor DarkCyan
    $parallelJobs += Start-Job -Name "SkillsCopy" -ScriptBlock {
        param($srcDir, $destDir, $maxThreads)

        if (Test-Path $destDir) { Remove-Item $destDir -Recurse -Force }

        $robocopyThreads = [Math]::Min($maxThreads, 16)
        $null = & robocopy $srcDir $destDir /MIR /MT:$robocopyThreads /NFL /NDL /NJH /NJS /NC /NS /NP 2>&1
        $robocopyExit = $LASTEXITCODE

        if ($robocopyExit -ge 8) {
            Copy-Item $srcDir $destDir -Recurse -Force
        }

        $finalCount = (Get-ChildItem -Directory $destDir -ErrorAction SilentlyContinue).Count
        return @{ Success = $true; Built = "$finalCount skills copied" }
    } -ArgumentList $skillsMergedDir, $fullSkillsDir, $MaxThreads
}
elseif ($isFullMode) {
    Write-OK "Skills directory is up to date ($skillCount skills)"
}

# --- Job F: Bundled-bins extraction (parallel) ---
if ($ExtractBundledBins) {
    Write-Host "  -> Launching: bundled-bins extraction (7 tools)" -ForegroundColor DarkCyan
    $bundledToolsJson = ConvertTo-Json -InputObject $bundledTools -Depth 3 -Compress
    $parallelJobs += Start-Job -Name "BundledBins" -ScriptBlock {
        param($downloadDir, $targetDir, $toolsJson)
        $tools = $toolsJson | ConvertFrom-Json
        if (-not (Test-Path $targetDir)) {
            New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        }

        $extracted = @()
        $failed = @()

        foreach ($tool in $tools) {
            $toolDir = Join-Path $downloadDir $tool.Name
            $zipFiles = Get-ChildItem $toolDir -Filter "*.zip" -ErrorAction SilentlyContinue

            foreach ($zip in $zipFiles) {
                $extractDir = Join-Path $toolDir "extracted"
                if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
                Expand-Archive -Path $zip.FullName -DestinationPath $extractDir -Force

                $f = Get-ChildItem $extractDir -Filter $tool.ExeName -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
                if (-not $f) {
                    $f = Get-ChildItem $extractDir -Filter "*.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
                }

                if ($f) {
                    $destPath = Join-Path $targetDir $tool.ExeName
                    Copy-Item $f.FullName -Destination $destPath -Force
                    $sizeMB = [math]::Round($f.Length / 1MB, 1)
                    $extracted += "$($tool.ExeName)(${sizeMB}MB)"
                }
                else { $failed += $zip.Name }
            }
        }

        return @{ Success = $true; Built = "extracted: $($extracted -join ', ')" }
    } -ArgumentList $bundledDownloadDir, $bundledTargetDir, $bundledToolsJson
}

# --- Wait for all parallel jobs with timeout ---
if ($parallelJobs.Count -gt 0) {
    Write-Host ""
    Write-Host "  Waiting for $($parallelJobs.Count) parallel jobs..." -ForegroundColor Gray

    $jobTimeoutSec = 600  # 10 minutes max for I/O jobs (npm install, proxy tools, skills copy)
    $allDone = $false
    $waitStart = Get-Date

    while (-not $allDone) {
        Start-Sleep -Seconds 3
        $running = @($parallelJobs | Where-Object { $_.State -eq "Running" })
        $completed = @($parallelJobs | Where-Object { $_.State -eq "Completed" })
        $failed = @($parallelJobs | Where-Object { $_.State -eq "Failed" })

        $elapsed = Get-ElapsedTime $phaseStart
        $runNames = ($running | ForEach-Object { $_.Name }) -join ", "
        if ($runNames) {
            Write-Host "  [$elapsed] Running: $runNames ($($completed.Count + $failed.Count)/$($parallelJobs.Count) done)" -ForegroundColor DarkGray
        }

        if ($running.Count -eq 0) {
            $allDone = $true
        }

        # Global timeout check
        $waitElapsed = ((Get-Date) - $waitStart).TotalSeconds
        if ($waitElapsed -gt $jobTimeoutSec -and $running.Count -gt 0) {
            Write-Warn "Job timeout after ${jobTimeoutSec}s — stopping hung jobs"
            foreach ($job in $running) {
                Stop-Job $job -ErrorAction SilentlyContinue
                Write-Err "$($job.Name): Timed out after ${jobTimeoutSec}s"
            }
            $allDone = $true
        }
    }

    # Collect results
    Write-Host ""
    $hasFatal = $false

    foreach ($job in $parallelJobs) {
        $result = Receive-Job $job -ErrorAction SilentlyContinue

        if ($job.State -eq "Failed" -or $job.State -eq "Stopped") {
            $reason = ""
            try { $reason = $job.ChildJobs[0].JobStateInfo.Reason } catch {}
            Write-Err "$($job.Name): Job $($job.State.ToString().ToLower()) - $reason"
            if ($job.Name -eq "NodeModules") { $hasFatal = $true }
        }
        elseif ($result -and -not $result.Success) {
            Write-Err "$($job.Name): $($result.Error)"
            if ($job.Name -eq "NodeModules") { $hasFatal = $true }
        }
        else {
            $extra = ""
            if ($result.Built) { $extra = " ($($result.Built))" }
            if ($result.Message) { $extra += $result.Message }
            if ($result.Found) { $extra += " [found: $($result.Found)]" }
            if ($result.Missing) { $extra += " [missing: $($result.Missing)]" }
            Write-OK "$($job.Name) completed$extra"
        }

        Remove-Job $job -Force
    }

    if ($hasFatal) {
        Write-Err "Fatal build error - cannot continue"
        Write-Host ""
        Write-Host "  Troubleshooting:" -ForegroundColor Yellow
        Write-Host "    1. Check network: ping registry.npmmirror.com" -ForegroundColor DarkGray
        Write-Host "    2. Clear cache:   npm cache clean --force" -ForegroundColor DarkGray
        Write-Host "    3. Retry:         re-run this script" -ForegroundColor DarkGray
        Write-Host "    4. Skip step:     -SkipBuild or -SkipNodeModules" -ForegroundColor DarkGray
        exit 1
    }

    Write-OK "Parallel phase completed ($(Get-ElapsedTime $phaseStart))"
}
else {
    Write-OK "Everything is up to date, nothing to build"
}

# ============================================================================
# Foreground Build Phase: TypeScript + obfuscation + bytecode + UI
#   Runs AFTER I/O jobs complete. Foreground execution ensures:
#   - Full PATH inheritance (pnpm, node, npx all resolve correctly)
#   - No timeout — build runs to completion with real-time output
#   - Bytecode compiled with portable Node v22 (matches installer runtime)
#
#   Pipeline: build:secure (system Node) → bytecode (portable Node) → integrity → ui:build
# ============================================================================
if ($needMainBuild -or $needUiBuild) {
    Write-Host ""
    Write-Host "  --- Foreground build phase ---" -ForegroundColor White

    Set-Location $ProjectRoot

    if ($needMainBuild) {
        # Step A: build:secure = build:prod + obfuscate + integrity:gen (system Node, any version OK)
        Write-Host "  Running: build:secure (TypeScript + obfuscation)..." -ForegroundColor DarkCyan
        $buildStart = Get-Date
        $prevEA = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        & pnpm build:secure 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        $buildCode = $LASTEXITCODE
        $ErrorActionPreference = $prevEA

        if ($buildCode -ne 0) {
            Write-Err "build:secure failed (exit $buildCode)"
            exit 1
        }
        Write-OK "build:secure completed ($(Get-ElapsedTime $buildStart))"

        # Step B: Bytecode compilation with PORTABLE Node (V8 bytecode is version-specific)
        # The installer bundles portable Node, so .jsc must be compiled by the same V8 engine.
        $portableNodeExe = "$nodePortableDir\node.exe"
        if (Test-Path $portableNodeExe) {
            $portableNodeVer = (& $portableNodeExe --version 2>$null) -replace '^v', ''
            $sysNodeVer = (& node --version 2>$null) -replace '^v', ''

            Write-Host "  Running: bytecode compilation (portable Node v$portableNodeVer)..." -ForegroundColor DarkCyan
            if ($sysNodeVer -ne $portableNodeVer) {
                Write-Host "  [i] System Node v$sysNodeVer differs from portable v$portableNodeVer — using portable for V8 compatibility" -ForegroundColor Yellow
            }

            $bytecodeStart = Get-Date
            $prevEA = $ErrorActionPreference
            $ErrorActionPreference = "Continue"
            & $portableNodeExe --import tsx cn/scripts/build/compile-bytecode.ts 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
            $bytecodeCode = $LASTEXITCODE
            $ErrorActionPreference = $prevEA

            if ($bytecodeCode -ne 0) {
                Write-Err "Bytecode compilation failed (exit $bytecodeCode)"
                Write-Host "  [!] .jsc files may not work at runtime" -ForegroundColor Yellow
                # Non-fatal: app can still run without bytecode (falls back to obfuscated JS)
            } else {
                Write-OK "Bytecode compiled with portable Node v$portableNodeVer ($(Get-ElapsedTime $bytecodeStart))"
            }
        } else {
            Write-Warn "Portable Node not found, skipping bytecode compilation"
        }

        # Step C: Regenerate integrity hashes (must be AFTER bytecode, since loader stubs changed)
        Write-Host "  Regenerating integrity hashes..." -ForegroundColor DarkCyan
        $integrityStart = Get-Date
        $prevEA = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        & pnpm integrity:gen 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        $intCode = $LASTEXITCODE
        $ErrorActionPreference = $prevEA

        if ($intCode -ne 0) {
            Write-Err "Integrity hash generation failed (exit $intCode)"
            exit 1
        }
        Write-OK "Integrity hashes regenerated ($(Get-ElapsedTime $integrityStart))"
    }

    if ($needUiBuild) {
        Write-Host "  Running: ui:build..." -ForegroundColor DarkCyan
        $uiStart = Get-Date
        $prevEA = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        & pnpm ui:build 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        $uiCode = $LASTEXITCODE
        $ErrorActionPreference = $prevEA

        if ($uiCode -ne 0) {
            Write-Err "ui:build failed (exit $uiCode)"
            exit 1
        }
        Write-OK "ui:build completed ($(Get-ElapsedTime $uiStart))"
    }

    Write-OK "Foreground build phase completed"
} else {
    # Still regenerate integrity hashes even when build is skipped (ensures dist matches manifest)
    Write-Host "  Regenerating integrity hashes..." -ForegroundColor DarkCyan
    $integrityStart = Get-Date
    try {
        Set-Location $ProjectRoot
        $output = & pnpm integrity:gen 2>&1
        $code = $LASTEXITCODE
        if ($code -ne 0) {
            Write-Err "Integrity hash generation failed (exit $code)"
            $output | Select-Object -Last 10 | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
            exit 1
        }
        Write-OK "Integrity hashes regenerated ($(Get-ElapsedTime $integrityStart))"
    }
    catch {
        Write-Err "Integrity hash generation error: $_"
        exit 1
    }
}

# ============================================================================
# Step 3 (DISABLED - moved to parallel phase above)
# ============================================================================
if ($false) { # === Proxy tools + skills copy now run in parallel (Job D/E) ===

    $fullToolsDir = "$OutputDir\full-tools"
    $fullSkillsDir = "$OutputDir\full-skills"

    if (-not (Test-Path $fullToolsDir)) {
        New-Item -ItemType Directory -Path $fullToolsDir -Force | Out-Null
    }

    # ---- 3a: Extract proxy tool binaries ----
    $ProxyToolExtractions = @(
        @{ Name = "gh";         SrcDir = "$BinariesDir\proxy-binaries\gh\win32";         Pattern = "*.zip";     ExeName = "gh.exe";                     SubPath = "bin" }
        @{ Name = "himalaya";   SrcDir = "$BinariesDir\proxy-binaries\himalaya\win32";   Pattern = "*.exe";     ExeName = "himalaya.exe";               SubPath = "" }
        @{ Name = "yt-dlp";     SrcDir = "$BinariesDir\proxy-binaries\yt-dlp\win32";     Pattern = "yt-dlp.exe"; ExeName = "yt-dlp.exe";                SubPath = "" }
        @{ Name = "uv";         SrcDir = "$BinariesDir\proxy-binaries\uv\win32";         Pattern = "*.zip";     ExeName = "uv.exe";                     SubPath = "" }
        @{ Name = "rclone";     SrcDir = "$BinariesDir\proxy-binaries\rclone\win32";     Pattern = "*.zip";     ExeName = "rclone.exe";                 SubPath = "" }
        @{ Name = "ffmpeg";     SrcDir = "$BinariesDir\proxy-binaries\ffmpeg\win32";     Pattern = "*.zip";     ExeName = "ffmpeg.exe";                 SubPath = "bin" }
        @{ Name = "sherpa-onnx"; SrcDir = "$BinariesDir\proxy-binaries\sherpa-onnx\win32"; Pattern = "*.tar.bz2"; ExeName = "sherpa-onnx-offline-tts.exe"; SubPath = "bin" }
    )

    $proxyToolsFound = @()
    $proxyToolsMissing = @()

    if (-not $SkipProxyTools) {
        Write-Host "  --- Proxy tool binaries ---" -ForegroundColor White

        foreach ($tool in $ProxyToolExtractions) {
            $destExe = "$fullToolsDir\$($tool.ExeName)"

            # Already extracted?
            if ((Test-Path $destExe) -and (Get-Item $destExe).Length -gt 100KB) {
                $sizeMB = [math]::Round((Get-Item $destExe).Length / 1MB, 1)
                $proxyToolsFound += "$($tool.Name) (${sizeMB}MB)"
                continue
            }

            # Check source
            if (-not (Test-Path $tool.SrcDir)) {
                $proxyToolsMissing += $tool.Name
                continue
            }

            $archives = Get-ChildItem -Path $tool.SrcDir -Filter $tool.Pattern -File -ErrorAction SilentlyContinue
            if (-not $archives -or $archives.Count -eq 0) {
                $proxyToolsMissing += $tool.Name
                continue
            }

            $archive = $archives | Select-Object -First 1
            Write-Host "  Extracting: $($tool.Name) <- $($archive.Name)" -ForegroundColor Gray

            $tempExtract = "$OutputDir\temp-extract-$($tool.Name)"
            if (Test-Path $tempExtract) { Remove-Item $tempExtract -Recurse -Force }
            New-Item -ItemType Directory -Path $tempExtract -Force | Out-Null

            try {
                $ext = $archive.Extension.ToLower()
                $fullName = $archive.Name.ToLower()

                if ($ext -eq ".exe") {
                    Copy-Item $archive.FullName $destExe -Force
                }
                elseif ($ext -eq ".zip") {
                    Expand-Archive -Path $archive.FullName -DestinationPath $tempExtract -Force
                    $found = Get-ChildItem -Path $tempExtract -Filter $tool.ExeName -Recurse -File | Select-Object -First 1
                    if ($found) {
                        Copy-Item $found.FullName $destExe -Force
                    }
                    else {
                        Write-Warn "$($tool.Name): $($tool.ExeName) not found in archive"
                        $proxyToolsMissing += $tool.Name
                        continue
                    }
                }
                elseif ($fullName -match '\.(tar\.gz|tar\.bz2|tar\.xz|tgz)$') {
                    & tar -xf $archive.FullName -C $tempExtract 2>$null
                    if ($LASTEXITCODE -ne 0) {
                        Write-Warn "$($tool.Name): tar extraction failed"
                        $proxyToolsMissing += $tool.Name
                        continue
                    }
                    $found = Get-ChildItem -Path $tempExtract -Filter $tool.ExeName -Recurse -File | Select-Object -First 1
                    if ($found) {
                        Copy-Item $found.FullName $destExe -Force
                    }
                    elseif ($tool.Name -eq "sherpa-onnx") {
                        # sherpa-onnx: copy entire directory (DLLs + models)
                        $sherpaDir = Get-ChildItem -Path $tempExtract -Directory | Select-Object -First 1
                        if ($sherpaDir) {
                            $sherpaDest = "$fullToolsDir\sherpa-onnx"
                            if (Test-Path $sherpaDest) { Remove-Item $sherpaDest -Recurse -Force }
                            Copy-Item $sherpaDir.FullName $sherpaDest -Recurse -Force
                            Set-Content "$destExe" "sherpa-onnx directory: $sherpaDest" -Encoding UTF8
                        }
                    }
                    else {
                        Write-Warn "$($tool.Name): $($tool.ExeName) not found in archive"
                        $proxyToolsMissing += $tool.Name
                        continue
                    }
                }
                else {
                    Write-Warn "$($tool.Name): Unknown archive format: $ext"
                    $proxyToolsMissing += $tool.Name
                    continue
                }

                if (Test-Path $destExe) {
                    $sizeMB = [math]::Round((Get-Item $destExe).Length / 1MB, 1)
                    $proxyToolsFound += "$($tool.Name) (${sizeMB}MB)"
                }
            }
            catch {
                Write-Warn "$($tool.Name): Extraction error: $_"
                $proxyToolsMissing += $tool.Name
            }
            finally {
                if (Test-Path $tempExtract) { Remove-Item $tempExtract -Recurse -Force -ErrorAction SilentlyContinue }
            }
        }

        if ($proxyToolsFound.Count -gt 0) {
            Write-OK "Proxy tools ready: $($proxyToolsFound -join ', ')"
        }
        if ($proxyToolsMissing.Count -gt 0) {
            Write-Warn "Missing proxy tools: $($proxyToolsMissing -join ', ')"
            Write-Host "  Run download-proxy-binaries.ps1 first, then re-run" -ForegroundColor DarkGray
        }
    }
    else {
        Write-Warn "Skipping proxy tool extraction (-SkipProxyTools flag)"
    }

    # ---- 3b: Copy skills-merged to staging area ----
    Write-Host ""
    Write-Host "  --- Full skills directory ---" -ForegroundColor White

    $needSkillsCopy = $false
    if (-not (Test-Path $fullSkillsDir)) {
        $needSkillsCopy = $true
    }
    else {
        $existingCount = (Get-ChildItem -Directory $fullSkillsDir -ErrorAction SilentlyContinue).Count
        if ($existingCount -ne $skillCount) {
            Write-Warn "Skills count mismatch ($existingCount vs $skillCount), re-copying"
            $needSkillsCopy = $true
        }
    }

    if ($needSkillsCopy) {
        Write-Host "  Copying $skillCount skills from skills-merged/ (robocopy /MT:$([Math]::Min($MaxThreads, 16)))..." -ForegroundColor Gray
        $copyStart = Get-Date

        if (Test-Path $fullSkillsDir) {
            Remove-Item $fullSkillsDir -Recurse -Force
        }

        $robocopyThreads = [Math]::Min($MaxThreads, 16)
        $robocopyResult = & robocopy $skillsMergedDir $fullSkillsDir /MIR /MT:$robocopyThreads /NFL /NDL /NJH /NJS /NC /NS /NP 2>&1
        $robocopyExit = $LASTEXITCODE

        if ($robocopyExit -ge 8) {
            Write-Warn "robocopy returned exit code $robocopyExit, falling back to Copy-Item"
            Copy-Item $skillsMergedDir $fullSkillsDir -Recurse -Force
        }

        $finalCount = (Get-ChildItem -Directory $fullSkillsDir -ErrorAction SilentlyContinue).Count
        Write-OK "Copied $finalCount skills ($(Get-ElapsedTime $copyStart))"
    }
    else {
        Write-OK "Full skills directory is up to date ($skillCount skills)"
    }
}

# ============================================================================
# Step N (DISABLED - moved to parallel phase above)
# ============================================================================
if ($false) { # === Bundled-bins extraction now runs in parallel (Job F) ===

    $bundledDownloadDir = "$BinariesDir\bundled-bins"
    $bundledTargetDir = "$ScriptsDir\bundled-bins"

    if (-not (Test-Path $bundledTargetDir)) {
        New-Item -ItemType Directory -Path $bundledTargetDir -Force | Out-Null
    }

    $bundledTools = @(
        @{ Name = "camsnap";  ExeName = "camsnap.exe" }
        @{ Name = "sag";      ExeName = "sag.exe" }
        @{ Name = "gog";      ExeName = "gog.exe" }
        @{ Name = "goplaces"; ExeName = "goplaces.exe" }
        @{ Name = "openhue";  ExeName = "openhue.exe" }
        @{ Name = "spogo";    ExeName = "spogo.exe" }
        @{ Name = "jira";     ExeName = "jira.exe" }
    )

    foreach ($tool in $bundledTools) {
        $toolDir = Join-Path $bundledDownloadDir $tool.Name
        $zipFiles = Get-ChildItem $toolDir -Filter "*.zip" -ErrorAction SilentlyContinue

        foreach ($zip in $zipFiles) {
            Write-Host "  Extracting $($zip.Name)..." -ForegroundColor Gray
            $extractDir = Join-Path $toolDir "extracted"
            if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
            Expand-Archive -Path $zip.FullName -DestinationPath $extractDir -Force

            $found = Get-ChildItem $extractDir -Filter $tool.ExeName -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
            if (-not $found) {
                $found = Get-ChildItem $extractDir -Filter "*.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
            }

            if ($found) {
                $destPath = Join-Path $bundledTargetDir $tool.ExeName
                Copy-Item $found.FullName -Destination $destPath -Force
                $sizeMB = [math]::Round($found.Length / 1MB, 1)
                Write-OK "$($tool.ExeName) (${sizeMB}MB)"
            }
            else {
                Write-Warn "No .exe found in $($zip.Name)"
            }
        }
    }
}

# ============================================================================
# Step N: Native Addon Build + Bytecode Runtime Deps (Layer 3)
# ============================================================================
Write-Step (Get-StepLabel) "Code protection: Native addon + bytecode runtime"

# 3a: Build C++ native addon (if build tools available and source exists)
$nativeDir = "$ProjectRoot\native"
$nativeOutputDir = "$ProjectRoot\native\build\Release"
$nativeAddonPath = "$nativeOutputDir\clawdbot_native.node"

if ($hasNativeTools -and (Test-Path "$nativeDir\binding.gyp")) {
    if (-not (Test-Path $nativeAddonPath) -or $needMainBuild) {
        Write-Host "  Building C++ native addon (Layer 3)..." -ForegroundColor DarkCyan
        try {
            $prevEA = $ErrorActionPreference
            $ErrorActionPreference = "Continue"
            $nativeOutput = & npx node-gyp rebuild --directory="$nativeDir" 2>&1
            $nativeExitCode = $LASTEXITCODE
            $ErrorActionPreference = $prevEA

            if ($nativeExitCode -eq 0 -and (Test-Path $nativeAddonPath)) {
                $addonSize = [math]::Round((Get-Item $nativeAddonPath).Length / 1KB, 1)
                Write-OK "Native addon built: clawdbot_native.node (${addonSize}KB)"
            } else {
                $nativeErrLines = ($nativeOutput | Select-Object -Last 10) -join "`n"
                Write-Warn "Native addon build failed (non-fatal): $nativeErrLines"
                Write-Host "  JS fallback will be used for security functions" -ForegroundColor DarkGray
            }
        } catch {
            Write-Warn "Native addon build failed: $_ (non-fatal, JS fallback will be used)"
        }
    } else {
        $addonSize = [math]::Round((Get-Item $nativeAddonPath).Length / 1KB, 1)
        Write-OK "Native addon up to date: clawdbot_native.node (${addonSize}KB)"
    }
} else {
    if (-not (Test-Path "$nativeDir\binding.gyp")) {
        Write-Warn "Native addon source not found (native/binding.gyp missing)"
    } else {
        Write-Warn "Skipping native addon build (C++ build tools not available)"
    }
}

# 3b: Ensure bytenode is in production node_modules (needed at runtime for .jsc loading)
if (Test-Path $nodeModulesPath) {
    $bytenodeProdPath = "$nodeModulesPath\bytenode"
    if (-not (Test-Path $bytenodeProdPath)) {
        Write-Host "  Installing bytenode runtime dependency in production node_modules..." -ForegroundColor DarkCyan
        try {
            # Pin bytenode version to match devDependency used for compilation
            $bytenodeVer = ($pkgJson.devDependencies.bytenode -replace '[\^~>=<]', '')
            if (-not $bytenodeVer) { $bytenodeVer = "1.5.7" }
            $prevLoc = Get-Location
            Set-Location $nodeModulesDir
            & npm install "bytenode@$bytenodeVer" --no-save --legacy-peer-deps --no-audit --no-fund 2>$null
            Set-Location $prevLoc
            if (Test-Path $bytenodeProdPath) {
                Write-OK "bytenode runtime installed in production node_modules"
            } else {
                Write-Warn "bytenode install may have failed (bytecode loading may not work)"
            }
        } catch {
            Write-Warn "Failed to install bytenode: $_ (bytecode loading may not work)"
        }
    } else {
        Write-OK "bytenode runtime already present in production node_modules"
    }
}

# 3c: Copy native addon to production node_modules (for installer to pick up)
if ((Test-Path $nativeAddonPath) -and (Test-Path $nodeModulesPath)) {
    $nativeDestDir = "$nodeModulesPath\..\native\build\Release"
    if (-not (Test-Path $nativeDestDir)) {
        New-Item -ItemType Directory -Path $nativeDestDir -Force | Out-Null
    }
    Copy-Item $nativeAddonPath "$nativeDestDir\" -Force
    Write-OK "Native addon copied to production staging"
}

# 3d: ALWAYS compile bytecode with portable Node (hardcoded)
# V8 bytecode is version-specific — .jsc files MUST be compiled by the SAME V8 engine
# that will load them at runtime. The installer bundles portable Node, so we MUST use it.
# This runs unconditionally regardless of $needMainBuild to prevent stale/incompatible .jsc files.
$portableNodeExe = "$nodePortableDir\node.exe"
if (Test-Path $portableNodeExe) {
    $sysNodeVer = (& node --version 2>$null) -replace '^v', ''
    $portableNodeVer = (& $portableNodeExe --version 2>$null) -replace '^v', ''
    $sysV8 = (& node -e "process.stdout.write(process.versions.v8)" 2>$null)
    $portableV8 = (& $portableNodeExe -e "process.stdout.write(process.versions.v8)" 2>$null)

    if ($sysV8 -ne $portableV8) {
        Write-Host "  [i] System Node v$sysNodeVer (V8 $sysV8) differs from portable v$portableNodeVer (V8 $portableV8)" -ForegroundColor Yellow
    }

    # Check if existing .jsc files need recompilation
    # Bytecode directories driven by cn_encryption.bytecode in cn-protected-files.json:
    #   src/dispatch/ → dist/dispatch/,  src/license/ → dist/license/,  src/security/ → dist/security/
    $jscFiles = Get-ChildItem -Path "$ProjectRoot\dist\dispatch","$ProjectRoot\dist\license","$ProjectRoot\dist\security" -Filter "*.jsc" -Recurse -File -ErrorAction SilentlyContinue
    $needBytecodeRecompile = $false

    if ($needMainBuild) {
        # Full rebuild — bytecode will be compiled in the foreground build phase
        Write-Host "  [i] Bytecode will be compiled with portable Node v$portableNodeVer in build phase" -ForegroundColor DarkCyan
    } elseif (-not $jscFiles -or $jscFiles.Count -eq 0) {
        # No .jsc files exist — must compile
        $needBytecodeRecompile = $true
        Write-Warn "No .jsc files found — need to compile bytecode"
    } else {
        # .jsc files exist but may have been compiled with wrong Node version.
        # Test-load one .jsc file with portable Node to verify V8 compatibility.
        $testJsc = $jscFiles[0].FullName
        $testResult = & $portableNodeExe -e "try { require('bytenode'); require('$($testJsc.Replace('\','\\'))'); process.stdout.write('OK') } catch(e) { process.stdout.write('FAIL:' + e.message) }" 2>$null
        if ($testResult -and $testResult.StartsWith("OK")) {
            Write-OK "Bytecode verified: .jsc files load correctly with portable Node v$portableNodeVer"
        } else {
            $needBytecodeRecompile = $true
            Write-Warn "Bytecode incompatible with portable Node v$portableNodeVer — will recompile"
            if ($testResult) {
                Write-Host "  [i] Test result: $testResult" -ForegroundColor DarkGray
            }
        }
    }

    # Recompile bytecode with portable Node if needed (even when build was skipped)
    if ($needBytecodeRecompile) {
        # IMPORTANT: Must rebuild dist/ from source first — existing .js files may be
        # bytecode loaders from a previous build, not the original obfuscated ESM code.
        # Compiling loaders back to bytecode produces broken .jsc files.
        Write-Host "  Rebuilding source (build:secure) before bytecode recompilation..." -ForegroundColor DarkCyan
        $rebuildStart = Get-Date
        $prevEA = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        Set-Location $ProjectRoot
        & pnpm build:secure 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        $rebuildCode = $LASTEXITCODE
        $ErrorActionPreference = $prevEA

        if ($rebuildCode -ne 0) {
            Write-Err "build:secure failed during bytecode recompilation (exit $rebuildCode)"
            exit 1
        }
        Write-OK "Source rebuilt ($(Get-ElapsedTime $rebuildStart))"

        # Now compile bytecode with portable Node
        Write-Host "  Compiling bytecode with portable Node v$portableNodeVer..." -ForegroundColor DarkCyan
        $bytecodeStart = Get-Date
        $prevEA = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        & $portableNodeExe --import tsx cn/scripts/build/compile-bytecode.ts 2>&1 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
        $bytecodeCode = $LASTEXITCODE
        $ErrorActionPreference = $prevEA

        if ($bytecodeCode -ne 0) {
            Write-Err "Bytecode recompilation failed (exit $bytecodeCode)"
            Write-Host "  [!] .jsc files may not work at runtime" -ForegroundColor Yellow
        } else {
            Write-OK "Bytecode compiled with portable Node v$portableNodeVer ($(Get-ElapsedTime $bytecodeStart))"
        }

        # Regenerate integrity hashes (loaders replaced original .js files)
        Write-Host "  Regenerating integrity hashes..." -ForegroundColor DarkCyan
        & pnpm integrity:gen 2>&1 | Out-Null
        Write-OK "Integrity hashes updated"
    }
} else {
    Write-Err "Portable Node not found at $nodePortableDir — bytecode compilation skipped!"
    Write-Host "  [!] .jsc files will NOT work at runtime without portable Node" -ForegroundColor Red
}

# ============================================================================
# Step N: Check bundled tool binaries
# ============================================================================
Write-Step (Get-StepLabel) "Checking tool binaries"

$bundledBinsDir = "$ScriptsDir\bundled-bins"
$expectedBundled = @("camsnap", "sag", "gog", "goplaces", "openhue", "spogo", "jira")
$foundBundled = @()
$missingBundled = @()

foreach ($toolName in $expectedBundled) {
    $destExe = "$bundledBinsDir\$toolName.exe"
    if ((Test-Path $destExe) -and (Get-Item $destExe).Length -gt 100KB) {
        $sizeMB = [math]::Round((Get-Item $destExe).Length / 1MB, 1)
        $foundBundled += "$toolName (${sizeMB}MB)"
    }
    else {
        $missingBundled += $toolName
    }
}

Write-Host "  Bundled-bins:" -ForegroundColor White
if ($foundBundled.Count -gt 0) {
    Write-OK "Found: $($foundBundled -join ', ')"
}
if ($missingBundled.Count -gt 0) {
    Write-Warn "Missing: $($missingBundled -join ', ') (installer will skip these)"
}

if ($isFullMode) {
    # Also check proxy tools
    $expectedProxy = @("gh", "himalaya", "yt-dlp", "uv", "rclone", "ffmpeg")
    $foundProxy = @()
    $missingProxy = @()

    foreach ($toolName in $expectedProxy) {
        $destExe = "$fullToolsDir\$toolName.exe"
        if ((Test-Path $destExe) -and (Get-Item $destExe).Length -gt 100KB) {
            $sizeMB = [math]::Round((Get-Item $destExe).Length / 1MB, 1)
            $foundProxy += "$toolName (${sizeMB}MB)"
        }
        else {
            $missingProxy += $toolName
        }
    }

    # Special: sherpa-onnx (directory)
    $sherpaDir = "$fullToolsDir\sherpa-onnx"
    if (Test-Path $sherpaDir) {
        $sherpaSize = [math]::Round(((Get-ChildItem $sherpaDir -Recurse -File | Measure-Object -Property Length -Sum).Sum) / 1MB, 1)
        $foundProxy += "sherpa-onnx (${sherpaSize}MB dir)"
    }
    else {
        $missingProxy += "sherpa-onnx"
    }

    Write-Host "  Proxy tools:" -ForegroundColor White
    if ($foundProxy.Count -gt 0) {
        Write-OK "Found: $($foundProxy -join ', ')"
    }
    if ($missingProxy.Count -gt 0) {
        Write-Warn "Missing: $($missingProxy -join ', ')"
    }

    $totalTools = $foundBundled.Count + $foundProxy.Count
    Write-OK "Total tools: $totalTools / $($expectedBundled.Count + $expectedProxy.Count + 1)"
}

# ============================================================================
# Step N: Verify required files
# ============================================================================
Write-Step (Get-StepLabel) "Verifying required files"

$requiredFiles = @(
    "$ProjectRoot\dist\entry.js",
    "$ProjectRoot\dist\control-ui\index.html",
    "$ProjectRoot\dist\mcp\index.js",
    "$ProjectRoot\dist\security\integrity-hashes.json",
    # "$ProjectRoot\data\mcp-index.json",  # optional bundled fallback; synced at runtime
    "$ProjectRoot\package.json",
    "$OutputDir\test-prod-deps\node_modules",
    "$ScriptsDir\node-portable",
    "$ScriptsDir\native\ClawdbotService.exe",
    "$ScriptsDir\assets\clawdbot.ico",
    # setup.iss hard dependencies (no skipifsourcedoesntexist — Inno Setup will fail if missing)
    # CN build uses Chinese templates from docs-cn/
    "$ProjectRoot\docs-cn\reference\templates",
    "$ScriptsDir\start-gateway.bat",
    "$ScriptsDir\clawdbot.bat",
    "$ScriptsDir\diagnose.bat",
    "$ScriptsDir\view-logs.bat",
    "$ScriptsDir\assets\loading.html",
    # Files added to setup.iss (README, LICENSE, patches, scripts)
    "$ProjectRoot\README.md",
    "$ProjectRoot\CHANGELOG.md",
    "$ProjectRoot\LICENSE",
    "$ProjectRoot\patches",
    "$ProjectRoot\scripts\postinstall.js",
    "$ProjectRoot\scripts\format-staged.js",
    "$ProjectRoot\scripts\setup-git-hooks.js"
)

if ($isFullMode) {
    $requiredFiles += "$OutputDir\full-skills"
}

$missingFiles = @()
foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Err "Missing required files:"
    foreach ($f in $missingFiles) {
        Write-Host "    - $f" -ForegroundColor Red
    }
    exit 1
}
Write-OK "All required files present"

# ============================================================================
# Step N: Compile installer (Inno Setup)
# ============================================================================
Write-Step (Get-StepLabel) "Compiling installer (Inno Setup)"

$compileStart = Get-Date
$issSource = "$ScriptsDir\setup.iss"
$issContent = Get-Content $issSource -Raw

# --- Update version ---
$issContent = $issContent -replace '#define MyAppVersion ".*"', "#define MyAppVersion `"$Version`""

# --- Set compression mode ---
if ($FastCompress) {
    $issContent = $issContent -replace 'Compression=lzma2/max', 'Compression=zip'
    $issContent = $issContent -replace 'Compression=lzma2/ultra64', 'Compression=zip'
    $issContent = $issContent -replace 'SolidCompression=yes', 'SolidCompression=no'
}

if ($isFullMode) {
    # --- Full mode: modify ISS ---

    # Change output filename
    $issContent = $issContent -replace 'OutputBaseFilename=ClawdbotCN-Setup-[\d.]+-x64', "OutputBaseFilename=ClawdbotCN-Full-Setup-$Version-x64"

    # Sync OutputDir
    $issContent = $issContent -replace 'OutputDir=.*', "OutputDir=$OutputDir"

    # Replace skills/ with full-skills/
    # Note: backslash is NOT special in .NET regex replacement strings, no escaping needed
    $issContent = $issContent -replace 'Source: "\.\.\\\.\.\\skills\\\*"', "Source: `"$fullSkillsDir\*`""

    # Add proxy tool binaries after bundled-bins block
    $proxyToolIssLines = @"

; === FULL BUILD: Pre-downloaded proxy tool binaries ===
Source: "$fullToolsDir\gh.exe"; DestDir: "{app}\tools"; Flags: ignoreversion skipifsourcedoesntexist
Source: "$fullToolsDir\himalaya.exe"; DestDir: "{app}\tools"; Flags: ignoreversion skipifsourcedoesntexist
Source: "$fullToolsDir\yt-dlp.exe"; DestDir: "{app}\tools"; Flags: ignoreversion skipifsourcedoesntexist
Source: "$fullToolsDir\uv.exe"; DestDir: "{app}\tools"; Flags: ignoreversion skipifsourcedoesntexist
Source: "$fullToolsDir\rclone.exe"; DestDir: "{app}\tools"; Flags: ignoreversion skipifsourcedoesntexist
Source: "$fullToolsDir\ffmpeg.exe"; DestDir: "{app}\tools"; Flags: ignoreversion skipifsourcedoesntexist
Source: "$fullToolsDir\sherpa-onnx\*"; DestDir: "{app}\tools\sherpa-onnx"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist
"@

    $issContent = $issContent -replace '(Source: "bundled-bins\\jira\.exe".*skipifsourcedoesntexist)', "`$1`r`n$proxyToolIssLines"

    $outputExeName = "ClawdbotCN-Full-Setup-$Version-x64.exe"
}
else {
    # --- Standard mode ---
    $issContent = $issContent -replace 'OutputBaseFilename=ClawdbotCN-Setup-[\d.]+-x64', "OutputBaseFilename=ClawdbotCN-Setup-$Version-x64"
    $issContent = $issContent -replace 'OutputDir=.*', "OutputDir=$OutputDir"

    $outputExeName = "ClawdbotCN-Setup-$Version-x64.exe"
}

if ($FastCompress) {
    $outputExeName = $outputExeName -replace '\.exe$', '-dev.exe'
    $issContent = $issContent -replace "(OutputBaseFilename=[^\r\n]+)", "`$1-dev" -replace "-dev-dev", "-dev"
}

$outputExe = "$OutputDir\$outputExeName"

# Write ISS to temp file (never modify the original setup.iss)
# Normalize line endings to CRLF (Inno Setup requires CRLF; mixed LF/CRLF causes
# preprocessor to miscount lines and treat #$xxxx char constants as directives)
$issContent = $issContent -replace "`r`n", "`n"
$issContent = $issContent -replace "`n", "`r`n"
$tempIssFile = "$ScriptsDir\setup-build-temp.iss"
$utf8BOM = New-Object System.Text.UTF8Encoding $true
[System.IO.File]::WriteAllText($tempIssFile, $issContent, $utf8BOM)

$compressMode = if ($FastCompress) { "zip (fast)" } else { "LZMA2/max" }
Write-OK "ISS prepared (mode=$Mode, compress=$compressMode)"
Write-Host "  Output:   $outputExe"
if ($isFullMode) {
    Write-Host "  Skills:   $skillCount from skills-merged/"
}
Write-Host "  Compiling... ($compressMode compression)"

# Remove old output
Remove-Item $outputExe -Force -ErrorAction SilentlyContinue

# Compile
& $InnoCompiler "`"$tempIssFile`""
$innoExitCode = $LASTEXITCODE

if ($innoExitCode -ne 0) {
    # Keep temp ISS for debugging on failure
    Write-Warn "Temp ISS kept for debugging: $tempIssFile"
    Write-Err "Inno Setup compilation failed! Exit code: $innoExitCode"
    Write-Host ""
    Write-Host "  Troubleshooting:" -ForegroundColor Yellow
    Write-Host "    1. Check ISS syntax: open setup.iss in Inno Setup IDE" -ForegroundColor DarkGray
    Write-Host "    2. Check disk space: $OutputDir" -ForegroundColor DarkGray
    Write-Host "    3. Check file locks: close Explorer windows in project dir" -ForegroundColor DarkGray
    exit 1
}

# Verify output exists
if (-not (Test-Path $outputExe)) {
    # Try to find it with a glob (in case filename doesn't exactly match)
    $foundExe = Get-ChildItem "$OutputDir\ClawdbotCN-*-$Version-*x64*.exe" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($foundExe) {
        $outputExe = $foundExe.FullName
    }
    else {
        Write-Err "Compilation completed but output file not found!"
        exit 1
    }
}

# Clean up temp ISS on success
Remove-Item $tempIssFile -Force -ErrorAction SilentlyContinue

$fileSize = [math]::Round((Get-Item $outputExe).Length / 1MB, 2)
Write-OK "Compilation completed: $(Split-Path -Leaf $outputExe)"
Write-Host "  File size: $fileSize MB"
Write-Host "  Compile time: $(Get-ElapsedTime $compileStart)"

# ============================================================================
# Optional: Test Install
# ============================================================================
if ($TestInstall) {
    Write-Host ""
    Write-Host "  --- Test Install ---" -ForegroundColor White

    $testDir = "$OutputDir\test\ClawdbotCN"
    Write-Host "  Installing to: $testDir" -ForegroundColor Gray

    $installStart = Get-Date
    Start-Process $outputExe -ArgumentList "/DIR=$testDir", "/SILENT", "/SUPPRESSMSGBOXES" -Wait
    $installDuration = [math]::Round(((Get-Date) - $installStart).TotalSeconds, 1)

    if (Test-Path "$testDir\dist\entry.js") {
        Write-OK "Test install succeeded (${installDuration}s)"
    }
    else {
        Write-Warn "Test install may have issues, check $testDir"
    }
}

# ============================================================================
# Summary
# ============================================================================
$totalTime = (Get-Date) - $ScriptStartTime

Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Green
Write-Host "  Build Complete!" -ForegroundColor Green
Write-Host "  ============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Output:      $outputExe" -ForegroundColor White
Write-Host "  Size:        $fileSize MB" -ForegroundColor White
Write-Host "  Mode:        $Mode" -ForegroundColor White
Write-Host "  Compression: $compressMode" -ForegroundColor White

# Protection status summary
$protectionLayers = @()
$protectionLayers += "L1:Bytecode"
$protectionLayers += "L2:Obfuscation(2-tier)"
if (Test-Path $nativeAddonPath) { $protectionLayers += "L3:NativeAddon" }
if ($hasUpx) { $protectionLayers += "L4:UPX" }
$protectionLayers += "L5:Runtime"
Write-Host "  Protection:  $($protectionLayers -join ' + ')" -ForegroundColor White

if ($isFullMode) {
    Write-Host "  Skills:      $skillCount (from skills-merged/)" -ForegroundColor White
    Write-Host "  Tools:       $totalTools pre-bundled" -ForegroundColor White
}
Write-Host "  Total time:  $($totalTime.Minutes)m $($totalTime.Seconds)s" -ForegroundColor White
Write-Host "  Threads:     $MaxThreads (CPU cores: $cpuCores)" -ForegroundColor White
Write-Host ""
Write-Host "  Test command:" -ForegroundColor Yellow
Write-Host "    $outputExe /SILENT" -ForegroundColor DarkGray
Write-Host ""
