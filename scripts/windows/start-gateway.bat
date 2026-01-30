@echo off
:: Clawdbot Gateway 自动启动脚本
:: 用于 Windows 开机自启动

cd /d "%~dp0"

:: 设置 Node.js 路径
set "NODE_PATH=%~dp0node"
set "PATH=%NODE_PATH%;%PATH%"

:: 设置内置插件目录
set "CLAWDBOT_BUNDLED_PLUGINS_DIR=%~dp0extensions"

:: 启动 Gateway (后台运行，无窗口)
start "" /min "%NODE_PATH%\node.exe" "%~dp0dist\entry.js" gateway run --port 18789
