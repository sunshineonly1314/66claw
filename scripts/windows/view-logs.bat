@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

title ClawdbotCN Log Viewer

:: Get install directory
set "INSTALL_DIR=%~dp0"
set "LOG_DIR=%INSTALL_DIR%logs"

:menu
cls
echo ============================================
echo   ClawdbotCN Log Viewer
echo ============================================
echo.
echo   Log Directory: %LOG_DIR%
echo.
echo   [1] View Service Log (service.log)
echo   [2] View Error Log (error.log)
echo   [3] View Gateway Output (gateway-output.log)
echo   [4] View All Logs (file list)
echo   [5] Tail Service Log (real-time)
echo   [6] Search Errors in Logs
echo   [7] Export Logs for Support
echo   [0] Exit
echo.
set /p choice="Select option: "

if "%choice%"=="1" goto view_service
if "%choice%"=="2" goto view_error
if "%choice%"=="3" goto view_gateway
if "%choice%"=="4" goto list_logs
if "%choice%"=="5" goto tail_log
if "%choice%"=="6" goto search_errors
if "%choice%"=="7" goto export_logs
if "%choice%"=="0" exit

echo Invalid option!
timeout /t 2 >nul
goto menu

:view_service
cls
echo === Service Log ===
echo.
if exist "%LOG_DIR%\service.log" (
    type "%LOG_DIR%\service.log"
) else (
    echo No service log found.
)
echo.
pause
goto menu

:view_error
cls
echo === Error Log ===
echo.
if exist "%LOG_DIR%\error.log" (
    type "%LOG_DIR%\error.log"
) else (
    echo No errors recorded. (This is good!)
)
echo.
pause
goto menu

:view_gateway
cls
echo === Gateway Output Log ===
echo.
if exist "%LOG_DIR%\gateway-output.log" (
    type "%LOG_DIR%\gateway-output.log" | more
) else (
    echo No gateway output log found.
)
echo.
pause
goto menu

:list_logs
cls
echo === Log Files ===
echo.
dir /o-d "%LOG_DIR%\*.log*" 2>nul
if errorlevel 1 (
    echo No log files found.
)
echo.
pause
goto menu

:tail_log
cls
echo === Real-time Service Log (Ctrl+C to stop) ===
echo.
if exist "%LOG_DIR%\service.log" (
    powershell -Command "Get-Content '%LOG_DIR%\service.log' -Wait -Tail 20"
) else (
    echo No service log found.
    pause
)
goto menu

:search_errors
cls
echo === Searching for Errors ===
echo.
echo --- Errors in service.log ---
if exist "%LOG_DIR%\service.log" (
    findstr /i "ERROR CRASHED FAIL" "%LOG_DIR%\service.log"
)
echo.
echo --- Errors in gateway-output.log ---
if exist "%LOG_DIR%\gateway-output.log" (
    findstr /i "\[ERR\] error exception" "%LOG_DIR%\gateway-output.log"
)
echo.
pause
goto menu

:export_logs
cls
echo === Exporting Logs for Support ===
set "EXPORT_DIR=%USERPROFILE%\Desktop"
set "EXPORT_FILE=clawdbot-logs-%date:~0,4%%date:~5,2%%date:~8,2%-%time:~0,2%%time:~3,2%%time:~6,2%.zip"
set "EXPORT_FILE=%EXPORT_FILE: =0%"

echo.
echo Creating log archive...
echo Target: %EXPORT_DIR%\%EXPORT_FILE%
echo.

:: Create temp folder
set "TEMP_EXPORT=%TEMP%\clawdbot-export"
if exist "%TEMP_EXPORT%" rd /s /q "%TEMP_EXPORT%"
mkdir "%TEMP_EXPORT%"

:: Copy logs
copy "%LOG_DIR%\*.log" "%TEMP_EXPORT%\" >nul 2>&1
copy "%LOG_DIR%\*.log.*" "%TEMP_EXPORT%\" >nul 2>&1

:: Add system info
echo ClawdbotCN Log Export > "%TEMP_EXPORT%\system-info.txt"
echo Export Time: %date% %time% >> "%TEMP_EXPORT%\system-info.txt"
echo. >> "%TEMP_EXPORT%\system-info.txt"
echo === System Info === >> "%TEMP_EXPORT%\system-info.txt"
systeminfo | findstr /B /C:"OS" >> "%TEMP_EXPORT%\system-info.txt"
echo. >> "%TEMP_EXPORT%\system-info.txt"
echo === Memory === >> "%TEMP_EXPORT%\system-info.txt"
wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /value >> "%TEMP_EXPORT%\system-info.txt"

:: Create zip using PowerShell
powershell -Command "Compress-Archive -Path '%TEMP_EXPORT%\*' -DestinationPath '%EXPORT_DIR%\%EXPORT_FILE%' -Force"

if exist "%EXPORT_DIR%\%EXPORT_FILE%" (
    echo.
    echo [OK] Logs exported to:
    echo     %EXPORT_DIR%\%EXPORT_FILE%
    echo.
    echo Please send this file to support team.
) else (
    echo.
    echo [FAIL] Export failed!
)

:: Cleanup
rd /s /q "%TEMP_EXPORT%" >nul 2>&1

pause
goto menu
