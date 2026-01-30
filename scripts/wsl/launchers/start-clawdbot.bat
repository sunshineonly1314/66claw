@echo off
:: Clawdbot WSL 启动脚本
:: 在 WSL 中启动 Clawdbot 并在 Windows 浏览器中打开配置页面

setlocal enabledelayedexpansion

echo.
echo ================================================
echo  Clawdbot Gateway (WSL)
echo ================================================
echo.

:: 检查 WSL 是否可用
wsl -e echo "ok" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [错误] WSL 不可用，请先安装 WSL2
    echo 运行: wsl --install
    pause
    exit /b 1
)

echo  正在启动服务...
echo  访问地址: http://localhost:18789
echo  配置向导: http://localhost:18789/setup
echo.
echo  窗口最小化后服务将在后台运行
echo  关闭此窗口将停止服务
echo.

:: 在 WSL 中启动 Clawdbot
:: 使用 setup.sh 会自动打开 Windows 浏览器
wsl -d Ubuntu -e bash -c "cd ~/clawdbot && ./setup.sh"

pause
