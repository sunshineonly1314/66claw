@echo off
chcp 65001 >nul
echo.
echo ========================================
echo  Testing ClawdbotCN Installation
echo ========================================
echo.

cd /d "E:\clawdbuild"

:: Find install directory
for /d %%d in (*) do (
    if exist "%%d\ClawdbotCN\node\node.exe" (
        set "INSTALL_DIR=%%d\ClawdbotCN"
        goto :found
    )
)

echo ERROR: Cannot find ClawdbotCN installation
pause
exit /b 1

:found
echo Found install: %INSTALL_DIR%
echo.

:: Kill old processes
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM ClawdbotCN.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo Starting Gateway from install directory...
echo.

cd /d "%INSTALL_DIR%"

:: Set environment
set "CLAWDBOT_STATE_DIR=%APPDATA%\ClawdbotCN"
set "CLAWDBOT_BUNDLED_PLUGINS_DIR=%INSTALL_DIR%\extensions"
set "CLAWDBOT_BUNDLED_SKILLS_DIR=%INSTALL_DIR%\skills"
set "CLAWDBOT_BUNDLED_TOOLS_DIR=%INSTALL_DIR%\tools"
set "CLAWDBOT_GATEWAY_TOKEN=clawdbot2026"
set "CLAWDBOT_REGION=cn"
set "PATH=%INSTALL_DIR%\node;%INSTALL_DIR%\tools;%PATH%"

:: Start gateway in new window
start "Gateway Test" cmd /c "node.exe dist\entry.js gateway run --port 18789 --allow-unconfigured 2>&1"

echo Waiting for Gateway to start (10 seconds)...
timeout /t 10 /nobreak >nul

:: Check if listening
netstat -an | findstr ":18789 " | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo  SUCCESS: Gateway is running!
    echo ========================================
    echo.
    echo The installation is WORKING.
    echo No need to rebuild installer.
    echo.
    echo You can now:
    echo  1. Close this test window
    echo  2. Run ClawdbotCN.exe normally
    echo.
    echo Stopping test...
    taskkill /F /FI "WINDOWTITLE eq Gateway Test*" >nul 2>&1
) else (
    echo.
    echo ========================================
    echo  FAILED: Gateway not listening
    echo ========================================
    echo.
    echo Check the Gateway Test window for errors.
    echo You may need to rebuild the installer.
)

echo.
pause
