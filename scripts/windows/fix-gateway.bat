@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion
title ClawdbotCN - 修复工具

cd /d "%~dp0"

echo.
echo ============================================================
echo              ClawdbotCN Gateway 修复工具
echo ============================================================
echo.
echo   此工具将修复 Gateway 启动问题
echo.

set "NODE_PATH=%~dp0node"
set "TOOLS_PATH=%~dp0tools"
set "PATH=%NODE_PATH%;%TOOLS_PATH%;%PATH%"
set "CLAWDBOT_BUNDLED_PLUGINS_DIR=%~dp0extensions"
set "CLAWDBOT_BUNDLED_SKILLS_DIR=%~dp0skills"
set "CLAWDBOT_BUNDLED_TOOLS_DIR=%~dp0tools"
set "CLAWDBOT_GATEWAY_TOKEN=clawdbot2026"
set "CLAWDBOT_REGION=cn"
set "CLAWDBOT_STATE_DIR=%APPDATA%\ClawdbotCN"

echo [1/4] 设置 gateway.mode=local...
"%NODE_PATH%\node.exe" "%~dp0dist\entry.js" config set gateway.mode local
if !ERRORLEVEL! equ 0 (
    echo       [OK] 配置已更新
) else (
    echo       [错误] 更新配置失败
    pause
    exit /b 1
)
echo.

echo [2/4] 验证配置...
"%NODE_PATH%\node.exe" "%~dp0dist\entry.js" config get gateway.mode
echo.

echo [3/4] 清理端口占用...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":18789 " ^| findstr "LISTENING"') do (
    echo       正在停止进程 (PID: %%a)...
    taskkill /PID %%a /F >nul 2>&1
    timeout /t 2 /nobreak >nul
)
echo       [OK] 端口已清理
echo.

echo [4/4] 启动 Gateway...
start "ClawdbotCN Gateway" /min "%NODE_PATH%\node.exe" "%~dp0dist\entry.js" gateway run --port 18789 --allow-unconfigured

echo       正在启动服务...
timeout /t 5 /nobreak >nul

:: 检查是否启动成功
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":18789 " ^| findstr "LISTENING"') do (
    set "GW_PID=%%a"
)

if defined GW_PID (
    echo.
    echo ============================================================
    echo       [成功] Gateway 已启动！
    echo       进程 PID: !GW_PID!
    echo ============================================================
    echo.
    echo   正在打开浏览器...
    start "" "http://127.0.0.1:18789/setup?token=clawdbot2026"
) else (
    echo.
    echo ============================================================
    echo       [失败] Gateway 启动失败
    echo ============================================================
    echo.
    echo   可能原因:
    echo   - 杀毒软件拦截
    echo   - 端口被占用
    echo   - 缺少依赖文件
    echo.
    echo   请运行 diagnose.bat 获取详细诊断信息
    echo   日志目录: %~dp0logs\
)

echo.
pause
