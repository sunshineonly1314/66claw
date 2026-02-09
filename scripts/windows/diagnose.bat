@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion
title ClawdbotCN - 诊断工具

cd /d "%~dp0"

echo.
echo ============================================================
echo              ClawdbotCN 诊断工具 / Diagnostic Tool
echo ============================================================
echo.
echo [1/7] 安装目录 / Installation Path
echo ------------------------------------------------------------
echo   路径: %~dp0
echo.

echo [2/7] Node.js 检查 / Node.js Check
echo ------------------------------------------------------------
set "NODE_PATH=%~dp0node"
if exist "%NODE_PATH%\node.exe" (
    echo   [OK] node.exe 已找到
    for /f "tokens=*" %%v in ('"%NODE_PATH%\node.exe" --version 2^>nul') do echo   版本: %%v
) else (
    echo   [错误] node.exe 未找到
    echo   路径: %NODE_PATH%
)
echo.

echo [3/7] 程序文件检查 / Entry File Check
echo ------------------------------------------------------------
if exist "%~dp0dist\entry.js" (
    echo   [OK] dist\entry.js 已找到
) else (
    echo   [错误] dist\entry.js 未找到
)
if exist "%~dp0ClawdbotService.exe" (
    echo   [OK] ClawdbotService.exe 已找到
) else (
    echo   [警告] ClawdbotService.exe 未找到 (桌面快捷方式可能无法工作)
)
echo.

echo [4/7] 端口 18789 状态 / Port 18789 Status
echo ------------------------------------------------------------
set "PORT_PID="
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":18789 " ^| findstr "LISTENING"') do (
    set "PORT_PID=%%a"
)
if defined PORT_PID (
    echo   [!] 端口 18789 被占用，PID: !PORT_PID!
    for /f "tokens=1" %%n in ('tasklist /FI "PID eq !PORT_PID!" /NH 2^>nul ^| findstr /V "INFO:"') do (
        echo   进程名: %%n
    )
) else (
    echo   [OK] 端口 18789 空闲
)
echo.

echo [5/7] Gateway 进程检查 / Gateway Process Check
echo ------------------------------------------------------------
set "GW_FOUND=0"
for /f "tokens=2" %%p in ('tasklist /FI "IMAGENAME eq node.exe" /V 2^>nul ^| findstr /I "gateway"') do (
    set "GW_FOUND=1"
    echo   [OK] Gateway 进程运行中 (PID: %%p)
)
if "!GW_FOUND!"=="0" (
    echo   [!] 未找到 Gateway 进程
)
echo.

echo [6/7] 配置文件检查 / Config Check
echo ------------------------------------------------------------
:: ClawdbotCN uses isolated config dir at %APPDATA%\ClawdbotCN (not %USERPROFILE%\.clawdbot)
set "CONFIG_FILE=%APPDATA%\ClawdbotCN\clawdbot.json"
if exist "!CONFIG_FILE!" (
    echo   [OK] 配置文件存在: !CONFIG_FILE!
    findstr /c:"gateway" "!CONFIG_FILE!" >nul 2>&1
    if !ERRORLEVEL! equ 0 (
        echo   [OK] gateway 配置已设置
    ) else (
        echo   [警告] gateway 配置可能未设置
    )
) else (
    echo   [!] 配置文件不存在 (首次运行会自动创建)
    echo   路径: !CONFIG_FILE!
)
:: Also check if old open-source config exists
if exist "%USERPROFILE%\.clawdbot\clawdbot.json" (
    echo   [!] 发现旧版 Clawdbot 配置: %USERPROFILE%\.clawdbot
    echo       ClawdbotCN 使用独立目录，不会影响旧版配置
)
echo.

echo [7/7] 最近日志 / Recent Logs
echo ------------------------------------------------------------
if exist "%~dp0logs\gateway-output.log" (
    echo   gateway-output.log 最后 10 行:
    echo   ----------------------------------------
    for /f "usebackq tokens=*" %%L in (`powershell -Command "Get-Content '%~dp0logs\gateway-output.log' -Tail 10 -ErrorAction SilentlyContinue"`) do (
        echo   %%L
    )
) else (
    echo   [!] gateway-output.log 不存在
)
echo.

echo ============================================================
echo                    诊断完成 / Complete
echo ============================================================
echo.
echo 日志目录 / Log directory: %~dp0logs\
echo.
echo 常见解决方案 / Common Solutions:
echo   - 运行 fix-gateway.bat 修复启动问题
echo   - 检查杀毒软件是否拦截 node.exe
echo   - 确保端口 18789 未被其他程序占用
echo.
pause
