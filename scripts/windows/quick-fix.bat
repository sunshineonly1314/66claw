@echo off
chcp 65001 >nul
echo.
echo ========================================
echo  ClawdbotCN Gateway Quick Fix
echo ========================================
echo.
echo Fixing Gateway crash (0xC0000005)...
echo.

cd /d "%~dp0..\.."

echo [1/4] Cleaning old build...
if exist dist rd /s /q dist
if exist node_modules\better-sqlite3\build rd /s /q node_modules\better-sqlite3\build

echo [2/4] Rebuilding native modules...
call pnpm rebuild better-sqlite3
if errorlevel 1 (
    echo.
    echo ERROR: Failed to rebuild better-sqlite3
    echo Make sure pnpm and Visual Studio Build Tools are installed
    pause
    exit /b 1
)

echo [3/4] Rebuilding project...
call pnpm build
if errorlevel 1 (
    echo.
    echo ERROR: Build failed
    pause
    exit /b 1
)

echo [4/4] Testing Gateway...
echo.
echo Starting Gateway (10 second test)...
echo.

set CLAWDBOT_STATE_DIR=%USERPROFILE%\.clawdbot-test
:: dev/test: no hardcoded token; gateway test uses --allow-unconfigured
set CLAWDBOT_REGION=cn

start "GatewayTest" cmd /c "node dist\entry.js gateway run --port 18790 --allow-unconfigured 2>&1"

timeout /t 5 /nobreak >nul

netstat -an | findstr ":18790 " | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo  SUCCESS! Gateway is working
    echo ========================================
    echo.
    echo Stopping test...
    taskkill /F /FI "WINDOWTITLE eq GatewayTest*" >nul 2>&1
    echo.
    echo Next steps:
    echo  1. Find your install directory:
    echo     dir /s /b E:\clawdbuild\node.exe
    echo.
    echo  2. Copy files to install directory:
    echo     powershell -File scripts\windows\rebuild-and-fix.ps1 -InstallPath "your\path"
    echo.
    echo  3. Restart ClawdbotCN
) else (
    echo.
    echo ========================================
    echo  WARNING: Gateway may not have started
    echo ========================================
    echo.
    taskkill /F /FI "WINDOWTITLE eq GatewayTest*" >nul 2>&1
    echo Check error details by running:
    echo   scripts\windows\dev-gateway.ps1
)

echo.
pause
