# Clawdbot Windows Portable Builder
# 创建 Windows 便携版安装包

param(
    [string]$OutputDir = "..\..\build\windows"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Resolve-Path (Join-Path $ScriptDir "../..")

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host " Clawdbot Windows Portable Builder" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$OutputPath = if ([System.IO.Path]::IsPathRooted($OutputDir)) {
    $OutputDir
} else {
    Resolve-Path (Join-Path $ScriptDir $OutputDir) -ErrorAction SilentlyContinue
    if (-not $?) { Join-Path $ScriptDir $OutputDir }
}

$PortableDir = Join-Path $OutputPath "clawdbot-portable"

Write-Host "Root: $RootDir"
Write-Host "Output: $OutputPath"
Write-Host ""

# Create output directory
if (Test-Path $PortableDir) {
    Write-Host "Cleaning old build..."
    Remove-Item -Path $PortableDir -Recurse -Force
}
New-Item -ItemType Directory -Path $PortableDir -Force | Out-Null

# Copy dist
Write-Host "Copying dist..."
Copy-Item -Path "$RootDir\dist" -Destination "$PortableDir\dist" -Recurse

# Copy extensions (常用插件)
Write-Host "Copying extensions..."
$ExtensionsDir = Join-Path $PortableDir "extensions"
New-Item -ItemType Directory -Path $ExtensionsDir -Force | Out-Null

# 常用插件列表
$CommonPlugins = @(
    "feishu",           # 飞书
    "dingtalk",         # 钉钉
    "wecom",            # 企业微信
    "qwen-portal-auth", # 通义千问认证
    "telegram",         # Telegram
    "discord",          # Discord
    "slack",            # Slack
    "whatsapp",         # WhatsApp
    "signal",           # Signal
    "googlechat"        # Google Chat
)

foreach ($plugin in $CommonPlugins) {
    $srcPath = Join-Path $RootDir "extensions\$plugin"
    if (Test-Path $srcPath) {
        Write-Host "  Copying plugin: $plugin"
        Copy-Item -Path $srcPath -Destination "$ExtensionsDir\$plugin" -Recurse
    } else {
        Write-Host "  Plugin not found (skipped): $plugin" -ForegroundColor Yellow
    }
}

# Copy package.json (remove postinstall)
Write-Host "Processing package.json..."
$pkg = Get-Content "$RootDir\package.json" -Raw | ConvertFrom-Json
$pkg.scripts.PSObject.Properties.Remove('postinstall')
$pkg | ConvertTo-Json -Depth 100 | Set-Content "$PortableDir\package.json" -Encoding UTF8

# Create install.bat
Write-Host "Creating install.bat..."
@"
@echo off
chcp 65001 >nul
echo.
echo  ================================================
echo   Clawdbot 安装程序
echo  ================================================
echo.
echo  正在检查 Node.js...

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  [错误] 未检测到 Node.js
    echo  请先安装 Node.js 22+ : https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo  检测到 Node.js %NODE_VER%
echo.
echo  正在安装依赖（首次运行需要几分钟）...
echo.

npm install --omit=dev

if %errorlevel% neq 0 (
    echo.
    echo  [错误] 依赖安装失败
    pause
    exit /b 1
)

echo.
echo  ================================================
echo   安装完成！
echo  ================================================
echo.
echo  运行方式:
echo    首次使用: 双击 setup.bat 打开配置向导
echo    日常使用: 双击 start.bat 启动服务（推荐创建桌面快捷方式）
echo.
pause
"@ | Out-File -FilePath "$PortableDir\install.bat" -Encoding ASCII

# Create start.bat
Write-Host "Creating start.bat..."
@"
@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Clawdbot Gateway

:: 设置内置插件目录
set "CLAWDBOT_BUNDLED_PLUGINS_DIR=%~dp0extensions"

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
node dist\entry.js gateway run --port 18789
pause
"@ | Out-File -FilePath "$PortableDir\start.bat" -Encoding ASCII

# Create setup.bat
Write-Host "Creating setup.bat..."
@"
@echo off
chcp 65001 >nul
cd /d "%~dp0"

:: 设置内置插件目录
set "CLAWDBOT_BUNDLED_PLUGINS_DIR=%~dp0extensions"

echo.
echo  ================================================
echo   Clawdbot 配置向导
echo  ================================================
echo.
start "" "http://localhost:18789/setup"
echo  正在启动服务...
node dist\entry.js gateway run --port 18789
"@ | Out-File -FilePath "$PortableDir\setup.bat" -Encoding ASCII

# Create README
Write-Host "Creating README..."
@"
# Clawdbot 便携版

## 安装步骤

1. 确保已安装 Node.js 22+ (https://nodejs.org/)
2. 双击 install.bat 安装依赖
3. 首次使用：双击 setup.bat 启动配置向导
4. 日常使用：双击 start.bat 启动服务

## 启动方式

- install.bat - 安装依赖（仅首次需要）
- start.bat   - 启动服务（日常使用，推荐创建桌面快捷方式）
- setup.bat   - 启动并打开配置向导（仅首次配置时使用）

## 访问地址

- 控制台: http://localhost:18789/
- 配置向导: http://localhost:18789/setup

## Skills 仓库

https://gitee.com/tecbinai/skills

## 技术支持

https://www.tecbinai.com/
"@ | Out-File -FilePath "$PortableDir\README.md" -Encoding UTF8

# Create ZIP
Write-Host ""
Write-Host "Creating ZIP archive..."
$ZipPath = Join-Path $OutputPath "clawdbot-windows-x64.zip"
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
Compress-Archive -Path $PortableDir -DestinationPath $ZipPath -CompressionLevel Optimal

# Get file size
$ZipSize = (Get-Item $ZipPath).Length / 1MB

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host " Build Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Portable folder: $PortableDir"
Write-Host "ZIP archive: $ZipPath"
Write-Host "ZIP size: $([math]::Round($ZipSize, 2)) MB"
Write-Host ""
