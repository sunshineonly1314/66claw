@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion
:: ClawdbotCN Gateway Startup Script
:: Starts Gateway in minimized window

cd /d "%~dp0"

:: Create log directory
if not exist "%~dp0logs" mkdir "%~dp0logs"
set "LOG_FILE=%~dp0logs\gateway-start.log"
echo [%date% %time%] start-gateway.bat called > "%LOG_FILE%"

:: Set Node.js and tools paths
set "NODE_PATH=%~dp0node"
set "TOOLS_PATH=%~dp0tools"

:: Set required environment variables
set "CLAWDBOT_BUNDLED_PLUGINS_DIR=%~dp0extensions"
set "CLAWDBOT_BUNDLED_SKILLS_DIR=%~dp0skills"
set "CLAWDBOT_BUNDLED_TOOLS_DIR=%~dp0tools"
set "CLAWDBOT_GATEWAY_TOKEN=clawdbot2026"
:: Use China region for mirrors (Skills: ClawdSkillsProxy, npm: npmmirror.com)
set "CLAWDBOT_REGION=cn"
:: Use isolated config directory consistent with ClawdbotService.exe
set "CLAWDBOT_STATE_DIR=%APPDATA%\ClawdbotCN"

:: Add node/ and tools/ to PATH so skills can find bundled binaries (camsnap, gog, gh, etc.)
set "PATH=%NODE_PATH%;%TOOLS_PATH%;%PATH%"

:: Check files exist
if not exist "%NODE_PATH%\node.exe" (
    echo [%date% %time%] ERROR: Node.js not found at %NODE_PATH%\node.exe >> "%LOG_FILE%"
    exit /b 1
)
echo [%date% %time%] Node.js found >> "%LOG_FILE%"

if not exist "%~dp0dist\entry.js" (
    echo [%date% %time%] ERROR: entry.js not found >> "%LOG_FILE%"
    exit /b 1
)
echo [%date% %time%] entry.js found >> "%LOG_FILE%"

:: Kill ALL processes occupying port 18789
set "KILLED_ANY="
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":18789 " ^| findstr "LISTENING"') do (
    echo [%date% %time%] Port 18789 in use by PID %%a, killing... >> "%LOG_FILE%"
    taskkill /PID %%a /F >nul 2>&1
    set "KILLED_ANY=1"
)

if defined KILLED_ANY (
    timeout /t 2 /nobreak >nul
    echo [%date% %time%] Old processes killed, port released >> "%LOG_FILE%"
)

:: Start Gateway (minimized window) with --allow-unconfigured to skip config check
echo [%date% %time%] Starting Gateway... >> "%LOG_FILE%"

:: Create gateway output log
set "GATEWAY_LOG=%~dp0logs\gateway-output.log"
echo [%date% %time%] Gateway starting... > "!GATEWAY_LOG!"

:: Start Gateway process
start "ClawdbotCN Gateway" /min cmd /c ""%NODE_PATH%\node.exe" "%~dp0dist\entry.js" gateway run --port 18789 --allow-unconfigured >> "!GATEWAY_LOG!" 2>&1"

echo [%date% %time%] Gateway start command sent >> "%LOG_FILE%"

:: Wait and verify Gateway started
set /a waitCount=0
:verifyStart
timeout /t 1 /nobreak >nul
set /a waitCount+=1

netstat -an 2>nul | findstr ":18789 " | findstr "LISTENING" >nul 2>&1
if !ERRORLEVEL! equ 0 (
    echo [%date% %time%] Gateway started successfully after !waitCount! seconds >> "%LOG_FILE%"
    exit /b 0
)

if !waitCount! lss 10 goto :verifyStart

echo [%date% %time%] WARNING: Gateway may not have started within 10 seconds >> "%LOG_FILE%"
exit /b 0
