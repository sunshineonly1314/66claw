@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: ClawdbotCN Windows Launcher Script
:: ============================================================================

cd /d "%~dp0"

set "NODE_PATH=%~dp0node"
set "PATH=%NODE_PATH%;%PATH%"
set "CLAWDBOT_BUNDLED_PLUGINS_DIR=%~dp0extensions"
set "CLAWDBOT_BUNDLED_SKILLS_DIR=%~dp0skills"
set "CLAWDBOT_GATEWAY_TOKEN=clawdbot2026"
:: Use China region for mirrors (Skills: ClawdSkillsProxy, npm: npmmirror.com)
set "CLAWDBOT_REGION=cn"
set "CONFIG_FILE=%USERPROFILE%\.clawdbot\clawdbot.json"
set "TOKEN=clawdbot2026"

if "%1"=="--setup" goto :setup
if "%1"=="--open" goto :smartopen
if "%1"=="--background" goto :background
if "%1"=="gateway" goto :gateway
goto :cli

:smartopen
:: Check if Gateway is running
netstat -an 2>nul | findstr ":18789 " | findstr "LISTENING" >nul 2>&1
if !ERRORLEVEL! neq 0 (
    :: Gateway not running, start it
    call "%~dp0start-gateway.bat"
    
    :: Wait for Gateway to start (max 30 seconds)
    set /a waitCount=0
    set /a maxWait=15
    :waitGateway
    timeout /t 2 /nobreak >nul
    set /a waitCount+=1
    
    netstat -an 2>nul | findstr ":18789 " | findstr "LISTENING" >nul 2>&1
    if !ERRORLEVEL! equ 0 goto :gatewayReady
    
    if !waitCount! lss !maxWait! goto :waitGateway
    
    :: Gateway failed to start, show error
    echo Gateway failed to start. Please run start-gateway.bat manually.
    start "" "%~dp0start-gateway.bat"
    goto :eof
)

:gatewayReady
:: Check config to decide which page to open
set "OPEN_URL=http://localhost:18789/setup?token=!TOKEN!"
set "CONFIGURED=0"
if exist "%CONFIG_FILE%" (
    findstr /c:"apiKey" "%CONFIG_FILE%" >nul 2>&1
    if !ERRORLEVEL! equ 0 set "CONFIGURED=1"
    findstr /c:"models" "%CONFIG_FILE%" >nul 2>&1
    if !ERRORLEVEL! equ 0 set "CONFIGURED=1"
)

if "!CONFIGURED!"=="1" (
    set "OPEN_URL=http://localhost:18789/?token=!TOKEN!"
)

start "" "!OPEN_URL!"
goto :eof

:setup
:: Start Gateway
netstat -an | findstr "18789" | findstr "LISTENING" >nul 2>&1
if !ERRORLEVEL! neq 0 (
    call "%~dp0start-gateway.bat"
    timeout /t 3 /nobreak >nul
)
start "" "http://localhost:18789/setup?token=!TOKEN!"
goto :eof

:background
:: Start Gateway in background
call "%~dp0start-gateway.bat"
goto :eof

:gateway
shift
"%NODE_PATH%\node.exe" "%~dp0dist\entry.js" gateway %1 %2 %3 %4 %5 %6 %7 %8 %9
goto :eof

:cli
"%NODE_PATH%\node.exe" "%~dp0dist\entry.js" %*
goto :eof
