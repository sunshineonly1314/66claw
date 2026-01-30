# Clawdbot Windows Standalone Builder
# 创建包含 Node.js 的完整独立安装包

param(
    [string]$OutputDir = "..\..\build\windows-standalone",
    [string]$NodeVersion = "22.13.1"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Resolve-Path (Join-Path $ScriptDir "../..")

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host " Clawdbot Windows Standalone Builder" -ForegroundColor Cyan
Write-Host " (包含 Node.js，无需用户安装)" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$OutputPath = if ([System.IO.Path]::IsPathRooted($OutputDir)) {
    $OutputDir
} else {
    Join-Path $ScriptDir $OutputDir
}

$StandaloneDir = Join-Path $OutputPath "clawdbot"
$NodeDir = Join-Path $StandaloneDir "node"
$NodeUrl = "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip"
$NodeZipName = "node-v$NodeVersion-win-x64.zip"
$NodeExtractedName = "node-v$NodeVersion-win-x64"

Write-Host "Root: $RootDir"
Write-Host "Output: $OutputPath"
Write-Host "Node.js: v$NodeVersion"
Write-Host ""

# Create output directory
if (Test-Path $StandaloneDir) {
    Write-Host "Cleaning old build..."
    Remove-Item -Path $StandaloneDir -Recurse -Force
}
New-Item -ItemType Directory -Path $StandaloneDir -Force | Out-Null

# Download Node.js
$NodeZipPath = Join-Path $OutputPath $NodeZipName
if (-not (Test-Path $NodeZipPath)) {
    Write-Host "Downloading Node.js v$NodeVersion..."
    Write-Host "URL: $NodeUrl"
    try {
        Invoke-WebRequest -Uri $NodeUrl -OutFile $NodeZipPath -UseBasicParsing
        Write-Host "Download complete!" -ForegroundColor Green
    } catch {
        Write-Host "Download failed: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please manually download from: $NodeUrl"
        Write-Host "And place it at: $NodeZipPath"
        exit 1
    }
} else {
    Write-Host "Using cached Node.js: $NodeZipPath"
}

# Extract Node.js
Write-Host "Extracting Node.js..."
$TempExtract = Join-Path $OutputPath "temp-node"
if (Test-Path $TempExtract) { Remove-Item $TempExtract -Recurse -Force }
Expand-Archive -Path $NodeZipPath -DestinationPath $TempExtract -Force
Move-Item -Path (Join-Path $TempExtract $NodeExtractedName) -Destination $NodeDir
Remove-Item $TempExtract -Recurse -Force
Write-Host "Node.js extracted to: $NodeDir"

# Copy dist
Write-Host "Copying dist..."
Copy-Item -Path "$RootDir\dist" -Destination "$StandaloneDir\dist" -Recurse

# Copy package.json (remove devDependencies and unnecessary fields)
Write-Host "Processing package.json..."
$pkg = Get-Content "$RootDir\package.json" -Raw | ConvertFrom-Json
$pkg.scripts = [PSCustomObject]@{
    start = "node dist/entry.js gateway run"
}
# Remove devDependencies and other unnecessary fields
if ($pkg.PSObject.Properties["devDependencies"]) {
    $pkg.PSObject.Properties.Remove("devDependencies")
}
if ($pkg.PSObject.Properties["optionalDependencies"]) {
    $pkg.PSObject.Properties.Remove("optionalDependencies")
}
if ($pkg.PSObject.Properties["pnpm"]) {
    $pkg.PSObject.Properties.Remove("pnpm")
}
if ($pkg.PSObject.Properties["vitest"]) {
    $pkg.PSObject.Properties.Remove("vitest")
}
$pkg | ConvertTo-Json -Depth 100 | Set-Content "$StandaloneDir\package.json" -Encoding UTF8

# Install dependencies using bundled Node
Write-Host "Installing dependencies (this may take a few minutes)..."
$env:PATH = "$NodeDir;$env:PATH"
$currentDir = Get-Location
Set-Location $StandaloneDir
try {
    # Use Start-Process for better process isolation
    $npmPath = Join-Path $NodeDir "npm.cmd"
    $process = Start-Process -FilePath $npmPath -ArgumentList "install", "--omit=dev", "--ignore-scripts" -NoNewWindow -Wait -PassThru
    if ($process.ExitCode -ne 0) {
        Write-Host "Warning: npm install returned exit code $($process.ExitCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Error during npm install: $_" -ForegroundColor Red
} finally {
    Set-Location $currentDir
}

# Verify node_modules was created
if (-not (Test-Path "$StandaloneDir\node_modules")) {
    Write-Host "Warning: node_modules directory was not created!" -ForegroundColor Yellow
    Write-Host "The standalone package may not work correctly." -ForegroundColor Yellow
} else {
    Write-Host "Dependencies installed."
}

# Create install.bat (for first-time setup message only)
Write-Host "Creating launcher scripts..."
@"
@echo off
chcp 65001 >nul
echo.
echo  ================================================
echo   Clawdbot - AI 助手
echo  ================================================
echo.
echo  本程序已包含所有必需组件，无需额外安装！
echo.
echo  使用方法:
echo    首次使用: 双击 setup.bat   - 打开配置向导
echo    日常使用: 双击 start.bat   - 启动服务（推荐创建桌面快捷方式）
echo.
echo  访问地址:
echo    控制台: http://localhost:18789/
echo    配置:   http://localhost:18789/setup
echo.
pause
"@ | Out-File -FilePath "$StandaloneDir\说明.bat" -Encoding ASCII

# Create start.bat
@"
@echo off
chcp 65001 >nul
title Clawdbot Gateway
echo.
echo  ================================================
echo   Clawdbot Gateway
echo  ================================================
echo.
echo  启动中...
echo  访问地址: http://localhost:18789
echo  配置向导: http://localhost:18789/setup
echo.
echo  按 Ctrl+C 停止服务
echo.
"%~dp0node\node.exe" "%~dp0dist\entry.js" gateway run --port 18789
pause
"@ | Out-File -FilePath "$StandaloneDir\start.bat" -Encoding ASCII

# Create setup.bat
@"
@echo off
chcp 65001 >nul
echo.
echo  ================================================
echo   Clawdbot 配置向导
echo  ================================================
echo.
echo  正在启动服务并打开配置页面...
echo.
start "" "http://localhost:18789/setup"
"%~dp0node\node.exe" "%~dp0dist\entry.js" gateway run --port 18789
"@ | Out-File -FilePath "$StandaloneDir\setup.bat" -Encoding ASCII

# Create silent start (for autostart)
@"
@echo off
cd /d "%~dp0"
start /min "" "%~dp0node\node.exe" "%~dp0dist\entry.js" gateway run --port 18789
"@ | Out-File -FilePath "$StandaloneDir\start-silent.bat" -Encoding ASCII

# Create README
@"
# Clawdbot 独立版

本安装包已包含所有必需组件（包括 Node.js），解压即可使用！

## 快速开始

1. 解压到任意目录
2. 首次使用：双击 setup.bat 启动配置向导
3. 在浏览器中完成配置
4. 日常使用：双击 start.bat 启动服务（推荐创建桌面快捷方式）

## 文件说明

- start.bat        启动服务（日常使用，推荐创建桌面快捷方式）
- setup.bat        启动服务并打开配置向导（仅首次配置时使用）
- start-silent.bat 后台启动服务
- 说明.bat         查看使用说明

## 访问地址

- 控制台: http://localhost:18789/
- 配置向导: http://localhost:18789/setup

## Skills 仓库

https://gitee.com/tecbinai/skills

## 技术支持

https://www.tecbinai.com/
"@ | Out-File -FilePath "$StandaloneDir\README.md" -Encoding UTF8

# Calculate sizes (with fallback for missing directories)
function Get-DirSize($path) {
    if (Test-Path $path) {
        $size = (Get-ChildItem $path -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum -ErrorAction SilentlyContinue).Sum
        if ($null -eq $size) { return 0 }
        return $size / 1MB
    }
    return 0
}

$DistSize = Get-DirSize "$StandaloneDir\dist"
$NodeSize = Get-DirSize "$StandaloneDir\node"
$ModulesSize = Get-DirSize "$StandaloneDir\node_modules"
$TotalSize = Get-DirSize $StandaloneDir

Write-Host ""
Write-Host "Size breakdown:"
Write-Host "  dist:         $([math]::Round($DistSize, 2)) MB"
Write-Host "  node:         $([math]::Round($NodeSize, 2)) MB"
Write-Host "  node_modules: $([math]::Round($ModulesSize, 2)) MB"
Write-Host "  Total:        $([math]::Round($TotalSize, 2)) MB"

# Create ZIP
Write-Host ""
Write-Host "Creating ZIP archive..."
$ZipPath = Join-Path $OutputPath "clawdbot-windows-x64-standalone.zip"
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
Compress-Archive -Path $StandaloneDir -DestinationPath $ZipPath -CompressionLevel Optimal

$ZipSize = (Get-Item $ZipPath).Length / 1MB

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host " Build Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Standalone folder: $StandaloneDir"
Write-Host "ZIP archive: $ZipPath"
Write-Host "ZIP size: $([math]::Round($ZipSize, 2)) MB"
Write-Host ""
Write-Host "Users: Extract ZIP, run setup.bat (first time) or start.bat (daily use)" -ForegroundColor Yellow
Write-Host ""
