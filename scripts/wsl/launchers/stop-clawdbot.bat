@echo off
:: Clawdbot WSL 停止脚本

echo.
echo ================================================
echo  停止 Clawdbot (WSL)
echo ================================================
echo.

:: 检查 WSL 是否可用
wsl -e echo "ok" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [错误] WSL 不可用
    pause
    exit /b 1
)

echo 正在停止 Clawdbot...

:: 在 WSL 中停止 Clawdbot
wsl -d Ubuntu -e bash -c "cd ~/clawdbot && ./stop.sh 2>/dev/null || pkill -f 'node.*clawdbot' 2>/dev/null || echo '服务未在运行'"

echo.
echo [√] Clawdbot 已停止
echo.
pause
