# ============================================================================
# Clawdbot Windows 原生打包脚本（统一版）
# ============================================================================
#
# 功能：构建包含 Node.js 的 Windows EXE 安装程序
#
# 使用方法：
#   .\build-windows.ps1
#   .\build-windows.ps1 -Version "2026.2.1"
#   .\build-windows.ps1 -SkipNodeDownload    # 跳过 Node.js 下载
#   .\build-windows.ps1 -SkipBuild           # 跳过项目构建
#
# 输出：
#   E:\clawdbuild\ClawdbotSetup-{version}-x64.exe
#
# ============================================================================

param(
    [string]$Version = "2026.2.1",
    [string]$NodeVersion = "22.13.1",
    [switch]$SkipNodeDownload,
    [switch]$SkipBuild,
    [switch]$SkipDeps,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Resolve-Path (Join-Path $ScriptDir "../..")
$InstallerDir = "E:\clawdbuild"
$NodePortableDir = Join-Path $ScriptDir "node-portable"

# ============================================================================
# 辅助函数
# ============================================================================

function Write-Step {
    param([string]$Step, [string]$Message)
    Write-Host ""
    Write-Host "[$Step] $Message" -ForegroundColor Cyan
    Write-Host ("=" * 50) -ForegroundColor DarkGray
}

function Write-OK {
    param([string]$Message)
    Write-Host "  [OK] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "  [WARN] $Message" -ForegroundColor Yellow
}

function Write-Err {
    param([string]$Message)
    Write-Host "  [ERROR] $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "  $Message" -ForegroundColor Gray
}

# ============================================================================
# 主流程
# ============================================================================

Write-Host ""
Write-Host "========================================================" -ForegroundColor Magenta
Write-Host "   Clawdbot Windows Native Build Script (EXE Installer)" -ForegroundColor Magenta
Write-Host "========================================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Version: $Version"
Write-Host "  Node.js: v$NodeVersion"
Write-Host "  Project: $RootDir"
Write-Host "  Output:  $InstallerDir"
Write-Host ""

# ============================================================================
# Step 1: 检查 Inno Setup
# ============================================================================
Write-Step "1/7" "Check Inno Setup"

$InnoSetupPath = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if (-not (Test-Path $InnoSetupPath)) {
    $InnoSetupPath = "C:\Program Files\Inno Setup 6\ISCC.exe"
}

if (-not (Test-Path $InnoSetupPath)) {
    Write-Err "Inno Setup 6 not found"
    Write-Host ""
    Write-Host "  Please download from https://jrsoftware.org/isinfo.php" -ForegroundColor Yellow
    exit 1
}
Write-OK "Inno Setup: $InnoSetupPath"

# ============================================================================
# Step 2: 下载/准备 Node.js 便携版
# ============================================================================
Write-Step "2/7" "Prepare Node.js Portable"

if (-not $SkipNodeDownload) {
    $NodeExe = Join-Path $NodePortableDir "node.exe"
    
    if (Test-Path $NodeExe) {
        $existingVer = & $NodeExe --version 2>$null
        Write-OK "Node.js exists: $existingVer"
    } else {
        Write-Info "Downloading Node.js v$NodeVersion..."
        
        if (-not (Test-Path $NodePortableDir)) {
            New-Item -ItemType Directory -Path $NodePortableDir -Force | Out-Null
        }
        
        $NodeZipName = "node-v$NodeVersion-win-x64.zip"
        $NodeMirrorUrl = "https://npmmirror.com/mirrors/node/v$NodeVersion/$NodeZipName"
        $NodeOfficialUrl = "https://nodejs.org/dist/v$NodeVersion/$NodeZipName"
        $NodeZipPath = Join-Path $env:TEMP $NodeZipName
        
        $downloaded = $false
        try {
            Write-Info "Trying China mirror: $NodeMirrorUrl"
            Invoke-WebRequest -Uri $NodeMirrorUrl -OutFile $NodeZipPath -UseBasicParsing -TimeoutSec 60
            $downloaded = $true
            Write-OK "Downloaded from China mirror"
        } catch {
            Write-Warn "China mirror failed, trying official..."
            try {
                Invoke-WebRequest -Uri $NodeOfficialUrl -OutFile $NodeZipPath -UseBasicParsing -TimeoutSec 120
                $downloaded = $true
                Write-OK "Downloaded from official source"
            } catch {
                Write-Err "Download failed: $_"
                exit 1
            }
        }
        
        if ($downloaded) {
            Write-Info "Extracting Node.js..."
            $TempExtract = Join-Path $env:TEMP "node-extract-temp"
            if (Test-Path $TempExtract) { Remove-Item $TempExtract -Recurse -Force }
            
            Expand-Archive -Path $NodeZipPath -DestinationPath $TempExtract -Force
            
            $ExtractedDir = Join-Path $TempExtract "node-v$NodeVersion-win-x64"
            Get-ChildItem $ExtractedDir | Copy-Item -Destination $NodePortableDir -Recurse -Force
            
            Remove-Item $TempExtract -Recurse -Force
            Remove-Item $NodeZipPath -Force -ErrorAction SilentlyContinue
            
            Write-OK "Node.js extracted"
        }
    }
} else {
    Write-Warn "Skipping Node.js download"
}

$NodeExe = Join-Path $NodePortableDir "node.exe"
if (-not (Test-Path $NodeExe)) {
    Write-Err "Node.js portable not found: $NodeExe"
    exit 1
}
$nodeVer = & $NodeExe --version 2>$null
Write-OK "Node.js version: $nodeVer"

# ============================================================================
# Step 3: 构建项目
# ============================================================================
Write-Step "3/7" "Build Project"

if (-not $SkipBuild) {
    $DistDir = Join-Path $RootDir "dist"
    $needBuild = $false
    
    if (-not (Test-Path $DistDir)) {
        Write-Warn "dist folder missing, need to build"
        $needBuild = $true
    } else {
        $srcDir = Join-Path $RootDir "src"
        $srcFiles = Get-ChildItem $srcDir -Recurse -File -Include "*.ts" -ErrorAction SilentlyContinue
        if ($srcFiles) {
            $srcLastWrite = ($srcFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime
            $distLastWrite = (Get-Item $DistDir).LastWriteTime
            
            if ($srcLastWrite -gt $distLastWrite) {
                Write-Warn "Source updated, need rebuild"
                $needBuild = $true
            } else {
                Write-OK "dist folder is up to date"
            }
        } else {
            Write-OK "dist folder exists"
        }
    }
    
    if ($needBuild) {
        Write-Info "Running pnpm build:secure (production build with obfuscation)..."
        Push-Location $RootDir
        try {
            # 使用 build:secure 确保：
            # 1. DEV 模式绕过被禁用
            # 2. 完整性哈希被生成
            # 3. 代码混淆（防止逆向分析）
            & pnpm build:secure
            if ($LASTEXITCODE -ne 0) {
                Write-Err "Build failed!"
                exit 1
            }
            Write-OK "Project built (secure mode with obfuscation)"
        } finally {
            Pop-Location
        }
    }
    
    Write-Info "Checking Extensions..."
    $extensions = @(
        "feishu", "dingtalk", "wecom",
        "qwen-portal-auth", "copilot-proxy", "google-antigravity-auth", "google-gemini-cli-auth",
        "telegram", "discord", "slack", "whatsapp", "signal", "msteams", "googlechat", "matrix", "mattermost", "line", "twitch",
        "zalo", "zalouser",
        "memory-core", "voice-call", "lobster", "llm-task", "open-prose", "diagnostics-otel",
        "nextcloud-talk", "nostr", "tlon"
    )
    foreach ($ext in $extensions) {
        $extDir = Join-Path $RootDir "extensions\$ext"
        $extDist = Join-Path $extDir "dist"
        if ((Test-Path $extDir) -and (-not (Test-Path $extDist))) {
            Write-Info "Building Extension: $ext"
            Push-Location $extDir
            & pnpm build 2>$null
            Pop-Location
        }
    }
    Write-OK "Extensions checked"
} else {
    Write-Warn "Skipping project build"
}

# ============================================================================
# Step 4: 安装生产依赖
# ============================================================================
Write-Step "4/7" "Install Dependencies"

if (-not $SkipDeps) {
    $nodeModulesDir = Join-Path $RootDir "node_modules"
    
    if (-not (Test-Path $nodeModulesDir)) {
        Write-Warn "node_modules missing, installing..."
        Push-Location $RootDir
        & pnpm install --frozen-lockfile
        Pop-Location
    }
    Write-OK "Dependencies ready"
} else {
    Write-Warn "Skipping dependency install"
}

# ============================================================================
# Step 5: 检查插件
# ============================================================================
Write-Step "5/7" "Check Plugins"

# Feishu 插件需要 @larksuiteoapi/node-sdk (官方飞书 SDK)
# 打包时会自动安装，但需要确保 extensions/feishu/node_modules 存在
$allPlugins = @(
    @{ Name = "Feishu"; Dir = "feishu"; Required = $true; ExtraDeps = "@larksuiteoapi/node-sdk" },
    @{ Name = "DingTalk"; Dir = "dingtalk"; Required = $true; ExtraDeps = "dingtalk-stream" },
    @{ Name = "WeCom"; Dir = "wecom"; Required = $false },
    @{ Name = "Qwen Auth"; Dir = "qwen-portal-auth"; Required = $false },
    @{ Name = "Copilot Proxy"; Dir = "copilot-proxy"; Required = $false },
    @{ Name = "Google Auth"; Dir = "google-antigravity-auth"; Required = $false },
    @{ Name = "Gemini Auth"; Dir = "google-gemini-cli-auth"; Required = $false },
    @{ Name = "Telegram"; Dir = "telegram"; Required = $false },
    @{ Name = "Discord"; Dir = "discord"; Required = $false },
    @{ Name = "Slack"; Dir = "slack"; Required = $false },
    @{ Name = "WhatsApp"; Dir = "whatsapp"; Required = $false },
    @{ Name = "Signal"; Dir = "signal"; Required = $false },
    @{ Name = "MS Teams"; Dir = "msteams"; Required = $false },
    @{ Name = "Google Chat"; Dir = "googlechat"; Required = $false },
    @{ Name = "Matrix"; Dir = "matrix"; Required = $false },
    @{ Name = "Mattermost"; Dir = "mattermost"; Required = $false },
    @{ Name = "LINE"; Dir = "line"; Required = $false },
    @{ Name = "Twitch"; Dir = "twitch"; Required = $false },
    @{ Name = "Zalo"; Dir = "zalo"; Required = $false },
    @{ Name = "Zalo User"; Dir = "zalouser"; Required = $false },
    @{ Name = "Memory Core"; Dir = "memory-core"; Required = $false },
    @{ Name = "Voice Call"; Dir = "voice-call"; Required = $false },
    @{ Name = "Lobster"; Dir = "lobster"; Required = $false },
    @{ Name = "LLM Task"; Dir = "llm-task"; Required = $false },
    @{ Name = "Open Prose"; Dir = "open-prose"; Required = $false },
    @{ Name = "Diagnostics"; Dir = "diagnostics-otel"; Required = $false },
    @{ Name = "Nextcloud"; Dir = "nextcloud-talk"; Required = $false },
    @{ Name = "Nostr"; Dir = "nostr"; Required = $false },
    @{ Name = "Tlon"; Dir = "tlon"; Required = $false }
)

$foundCount = 0
$missingRequired = @()

foreach ($plugin in $allPlugins) {
    $pluginPath = Join-Path $RootDir "extensions\$($plugin.Dir)"
    $packageJson = Join-Path $pluginPath "package.json"
    
    if ((Test-Path $pluginPath) -and (Test-Path $packageJson)) {
        # 检查是否有额外依赖需要验证
        if ($plugin.ExtraDeps) {
            $nodeModulesPath = Join-Path $pluginPath "node_modules"
            if (-not (Test-Path $nodeModulesPath)) {
                Write-Warn "$($plugin.Name) ($($plugin.Dir)) - node_modules missing, installing..."
                Push-Location $pluginPath
                & npm install --omit=dev --legacy-peer-deps --no-audit --no-fund 2>$null
                Pop-Location
            }
            Write-OK "$($plugin.Name) ($($plugin.Dir)) [deps: $($plugin.ExtraDeps)]"
        } else {
            Write-OK "$($plugin.Name) ($($plugin.Dir))"
        }
        $foundCount++
    } else {
        if ($plugin.Required) {
            Write-Err "$($plugin.Name) - required but not found"
            $missingRequired += $plugin.Name
        } else {
            Write-Info "  [-] $($plugin.Name) - optional, not found"
        }
    }
}

Write-Host ""
Write-Info "Found $foundCount/$($allPlugins.Count) plugins"

if ($missingRequired.Count -gt 0) {
    Write-Host ""
    Write-Err "Missing required plugins: $($missingRequired -join ', ')"
    $continue = Read-Host "  Continue anyway? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        Write-Err "Cancelled by user"
        exit 1
    }
}

# ============================================================================
# Step 6: 更新版本号
# ============================================================================
Write-Step "6/7" "Update Version"

$SetupIss = Join-Path $ScriptDir "setup.iss"
if (Test-Path $SetupIss) {
    $content = Get-Content $SetupIss -Raw
    $content = $content -replace '#define MyAppVersion ".*"', "#define MyAppVersion `"$Version`""
    Set-Content -Path $SetupIss -Value $content -Encoding UTF8
    Write-OK "Version updated: $Version"
} else {
    Write-Err "setup.iss not found"
    exit 1
}

# ============================================================================
# Step 7: 构建安装程序
# ============================================================================
Write-Step "7/7" "Build EXE Installer"

if (-not (Test-Path $InstallerDir)) {
    New-Item -ItemType Directory -Path $InstallerDir -Force | Out-Null
}

Write-Info "Running Inno Setup compiler..."
$startTime = Get-Date

$process = Start-Process -FilePath $InnoSetupPath -ArgumentList "`"$SetupIss`"" -Wait -PassThru -NoNewWindow

$duration = ((Get-Date) - $startTime).TotalSeconds

if ($process.ExitCode -ne 0) {
    Write-Err "Compilation failed, exit code: $($process.ExitCode)"
    exit 1
}

$OutputExe = Join-Path $InstallerDir "ClawdbotSetup-$Version-x64.exe"
if (Test-Path $OutputExe) {
    $fileSize = [math]::Round((Get-Item $OutputExe).Length / 1MB, 2)
    Write-OK "Compilation successful!"
} else {
    Write-Err "Output file not found"
    exit 1
}

# ============================================================================
# 完成
# ============================================================================
Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "   Build Complete!" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Output: $OutputExe"
Write-Host "  Size:   $fileSize MB"
Write-Host "  Time:   $([math]::Round($duration, 1)) seconds"
Write-Host ""
Write-Host "  To test installation:" -ForegroundColor Cyan
Write-Host "    $OutputExe"
Write-Host ""
Write-Host "  To verify installation:" -ForegroundColor Cyan
Write-Host "    .\verify-installation.ps1 -InstallDir `"C:\Program Files\Clawdbot`""
Write-Host ""
