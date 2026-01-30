@echo off
setlocal enabledelayedexpansion

:: Clawdbot Windows 启动脚本
:: Clawdbot Windows Launcher Script

:: 切换到安装目录
cd /d "%~dp0"

:: 设置 Node.js 路径
set "NODE_PATH=%~dp0node"
set "PATH=%NODE_PATH%;%PATH%"

:: 设置内置插件目录
set "CLAWDBOT_BUNDLED_PLUGINS_DIR=%~dp0extensions"

:: 检查参数
if "%1"=="--setup" goto :setup
if "%1"=="--background" goto :background
if "%1"=="gateway" goto :gateway
goto :cli

:: 启动配置向导
:setup
echo.
echo  ================================================
echo   Clawdbot 配置向导
echo  ================================================
echo.
echo  正在启动 Gateway 服务...
start "" /min "%NODE_PATH%\node.exe" "%~dp0dist\entry.js" gateway run --port 18789
echo  等待服务启动...
timeout /t 3 /nobreak >nul
echo  正在打开配置页面...
start "" "http://localhost:18789/setup"
echo.
echo  配置页面已在浏览器中打开。
echo  如果页面未自动打开，请手动访问: http://localhost:18789/setup
echo.
pause
goto :eof

:: 后台启动 Gateway
:background
echo 正在后台启动 Clawdbot Gateway...
start "" /min "%NODE_PATH%\node.exe" "%~dp0dist\entry.js" gateway run --port 18789
echo Gateway 已在后台启动。
goto :eof

:: Gateway 命令
:gateway
shift
"%NODE_PATH%\node.exe" "%~dp0dist\entry.js" gateway %1 %2 %3 %4 %5 %6 %7 %8 %9
goto :eof

:: CLI 命令
:cli
"%NODE_PATH%\node.exe" "%~dp0dist\entry.js" %*
goto :eof
