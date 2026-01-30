# Clawdbot Windows Installer Build Script
# 
# 使用方法:
#   .\build-installer.ps1
#
# 前置要求:
#   1. 安装 Inno Setup: https://jrsoftware.org/isinfo.php
#   2. pnpm install && pnpm build
#   3. 下载 Node.js 便携版到 scripts/windows/node-portable/

param(
    [string]$Version = "2026.1.25",
    [string]$NodeVersion = "22.12.0",
    [switch]$SkipNodeDownload
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Join-Path $ScriptDir "../.."

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host " Clawdbot Windows Installer Builder" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Inno Setup
$InnoSetupPath = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if (-not (Test-Path $InnoSetupPath)) {
    Write-Host "错误: 未找到 Inno Setup" -ForegroundColor Red
    Write-Host "请从 https://jrsoftware.org/isinfo.php 下载并安装 Inno Setup 6" -ForegroundColor Yellow
    exit 1
}

# 检查构建输出
$DistDir = Join-Path $RootDir "dist"
if (-not (Test-Path $DistDir)) {
    Write-Host "错误: 未找到 dist 目录" -ForegroundColor Red
    Write-Host "请先运行 pnpm build" -ForegroundColor Yellow
    exit 1
}

# ============================================
# 检查中国区渠道插件
# ============================================
Write-Host ""
Write-Host "检查中国区渠道插件..." -ForegroundColor Green

$ChinaPlugins = @("feishu", "dingtalk", "wecom", "qwen-portal-auth")
$MissingPlugins = @()

foreach ($plugin in $ChinaPlugins) {
    $pluginPath = Join-Path $RootDir "extensions\$plugin"
    $packageJson = Join-Path $pluginPath "package.json"
    
    if (-not (Test-Path $pluginPath)) {
        $MissingPlugins += $plugin
        Write-Host "  ❌ $plugin - 目录不存在" -ForegroundColor Red
    } elseif (-not (Test-Path $packageJson)) {
        $MissingPlugins += $plugin
        Write-Host "  ⚠️  $plugin - 缺少 package.json" -ForegroundColor Yellow
    } else {
        Write-Host "  ✅ $plugin" -ForegroundColor Green
    }
}

if ($MissingPlugins.Count -gt 0) {
    Write-Host ""
    Write-Host "警告: 以下插件缺失或不完整: $($MissingPlugins -join ', ')" -ForegroundColor Yellow
    Write-Host "继续构建将不包含这些插件" -ForegroundColor Yellow
    
    $continue = Read-Host "是否继续构建? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        Write-Host "构建已取消" -ForegroundColor Red
        exit 1
    }
}

# 下载 Node.js 便携版
$NodePortableDir = Join-Path $ScriptDir "node-portable"
if (-not $SkipNodeDownload) {
    Write-Host "步骤 1: 下载 Node.js 便携版..." -ForegroundColor Green
    
    if (-not (Test-Path $NodePortableDir)) {
        New-Item -ItemType Directory -Path $NodePortableDir | Out-Null
    }
    
    $NodeZipUrl = "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip"
    $NodeZipPath = Join-Path $env:TEMP "node-v$NodeVersion-win-x64.zip"
    
    if (-not (Test-Path (Join-Path $NodePortableDir "node.exe"))) {
        Write-Host "  下载: $NodeZipUrl"
        Invoke-WebRequest -Uri $NodeZipUrl -OutFile $NodeZipPath
        
        Write-Host "  解压..."
        Expand-Archive -Path $NodeZipPath -DestinationPath $env:TEMP -Force
        
        # 复制文件到 node-portable
        $NodeExtractDir = Join-Path $env:TEMP "node-v$NodeVersion-win-x64"
        Copy-Item -Path "$NodeExtractDir\*" -Destination $NodePortableDir -Recurse -Force
        
        # 清理
        Remove-Item -Path $NodeZipPath -Force
        Remove-Item -Path $NodeExtractDir -Recurse -Force
        
        Write-Host "  Node.js 便携版已准备就绪" -ForegroundColor Green
    } else {
        Write-Host "  Node.js 便携版已存在，跳过下载" -ForegroundColor Yellow
    }
} else {
    Write-Host "步骤 1: 跳过 Node.js 下载 (使用现有文件)" -ForegroundColor Yellow
}

# 安装生产依赖
Write-Host ""
Write-Host "步骤 2: 安装生产依赖..." -ForegroundColor Green
Push-Location $RootDir
try {
    # 使用 npm ci --omit=dev 安装生产依赖
    & npm ci --omit=dev
    if ($LASTEXITCODE -ne 0) {
        throw "npm ci 失败"
    }
} finally {
    Pop-Location
}

# 创建输出目录
$InstallerDir = Join-Path $RootDir "installer"
if (-not (Test-Path $InstallerDir)) {
    New-Item -ItemType Directory -Path $InstallerDir | Out-Null
}

# 运行 Inno Setup
Write-Host ""
Write-Host "步骤 3: 构建安装程序..." -ForegroundColor Green
$SetupIss = Join-Path $ScriptDir "setup.iss"
& $InnoSetupPath $SetupIss

if ($LASTEXITCODE -ne 0) {
    Write-Host "错误: Inno Setup 构建失败" -ForegroundColor Red
    exit 1
}

# ============================================
# 后置验证
# ============================================
Write-Host ""
Write-Host "步骤 4: 后置验证..." -ForegroundColor Green

$InstallerPath = Join-Path $InstallerDir "ClawdbotSetup-$Version-x64.exe"
if (Test-Path $InstallerPath) {
    $size = (Get-Item $InstallerPath).Length / 1MB
    if ($size -lt 50) {
        Write-Host "  ⚠️  安装包过小 ($([math]::Round($size, 2)) MB)，可能缺少组件" -ForegroundColor Yellow
    } else {
        Write-Host "  ✅ 安装包大小: $([math]::Round($size, 2)) MB" -ForegroundColor Green
    }
} else {
    Write-Host "  ❌ 安装包文件不存在" -ForegroundColor Red
    exit 1
}

# 验证关键目录是否存在
Write-Host ""
Write-Host "验证源文件完整性..." -ForegroundColor Green
$RequiredDirs = @(
    "dist",
    "node_modules",
    "extensions\feishu",
    "extensions\dingtalk",
    "extensions\wecom"
)

$allPresent = $true
foreach ($dir in $RequiredDirs) {
    $fullPath = Join-Path $RootDir $dir
    if (Test-Path $fullPath) {
        Write-Host "  ✅ $dir" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $dir" -ForegroundColor Red
        $allPresent = $false
    }
}

if (-not $allPresent) {
    Write-Host ""
    Write-Host "警告: 部分源目录缺失，安装包可能不完整" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host " 构建完成!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "安装程序位置: $InstallerPath"
Write-Host ""
Write-Host "中国区插件验证命令:" -ForegroundColor Cyan
Write-Host '  @("feishu", "dingtalk", "wecom") | ForEach-Object {' -ForegroundColor Gray
Write-Host '    $p = "C:\Program Files\Clawdbot\extensions\$_"' -ForegroundColor Gray
Write-Host '    if (Test-Path $p) { Write-Host "✅ $_" -ForegroundColor Green }' -ForegroundColor Gray
Write-Host '    else { Write-Host "❌ $_" -ForegroundColor Red }' -ForegroundColor Gray
Write-Host '  }' -ForegroundColor Gray
Write-Host ""
