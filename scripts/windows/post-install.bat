@echo off
setlocal enabledelayedexpansion
title ClawdbotCN - 正在启动

cd /d "%~dp0"

set "LOG_DIR=%~dp0logs"
set "GATEWAY_LOG=!LOG_DIR!\gateway-output.log"
set "STARTUP_LOG=!LOG_DIR!\startup.log"
if not exist "!LOG_DIR!" mkdir "!LOG_DIR!"

set "NODE_PATH=%~dp0node"
set "PATH=!NODE_PATH!;%PATH%"
set "CLAWDBOT_BUNDLED_PLUGINS_DIR=%~dp0extensions"
set "CLAWDBOT_BUNDLED_SKILLS_DIR=%~dp0skills"
:: 设置中国区，使用国内镜像 (Skills: ClawdSkillsProxy, npm: npmmirror.com)
set "CLAWDBOT_REGION=cn"

:: 配置目录
set "CONFIG_DIR=%USERPROFILE%\.clawdbot"
set "CONFIG_FILE=!CONFIG_DIR!\clawdbot.json"

cls
echo.
echo  ============================================================
echo.
echo              ClawdbotCN - 正在启动服务
echo.
echo  ============================================================
echo.
echo              请勿关闭此窗口
echo.
echo  ============================================================
echo.

echo   [1/7] 检查运行环境...
echo [%date% %time%] 开始启动... > "!STARTUP_LOG!"

if not exist "!NODE_PATH!\node.exe" (
    echo         [错误] Node.js 未找到
    echo [%date% %time%] ERROR: Node.js not found >> "!STARTUP_LOG!"
    pause
    exit /b 1
)
echo         [OK] Node.js 已就绪

"!NODE_PATH!\node.exe" --version > "!LOG_DIR!\node-version.txt" 2>&1
set /p NODE_VER=<"!LOG_DIR!\node-version.txt"
echo         [OK] Node.js !NODE_VER!
echo [%date% %time%] Node.js: !NODE_VER! >> "!STARTUP_LOG!"

if not exist "%~dp0dist\entry.js" (
    echo         [错误] 程序文件未找到
    echo [%date% %time%] ERROR: dist\entry.js not found >> "!STARTUP_LOG!"
    pause
    exit /b 1
)
echo         [OK] 程序文件已就绪
echo.

echo   [2/7] 创建配置文件...

:: 创建配置目录
if not exist "!CONFIG_DIR!" (
    mkdir "!CONFIG_DIR!"
    echo         [OK] 已创建配置目录
)

:: 创建默认配置文件（如果不存在）
if not exist "!CONFIG_FILE!" (
    echo { > "!CONFIG_FILE!"
    echo   "gateway": { >> "!CONFIG_FILE!"
    echo     "mode": "local", >> "!CONFIG_FILE!"
    echo     "bind": "loopback", >> "!CONFIG_FILE!"
    echo     "port": 18789 >> "!CONFIG_FILE!"
    echo   } >> "!CONFIG_FILE!"
    echo } >> "!CONFIG_FILE!"
    echo         [OK] 已创建配置文件
    echo [%date% %time%] Created config file >> "!STARTUP_LOG!"
) else (
    echo         [OK] 配置文件已存在
)
echo.

echo   [3/7] 检查端口 18789...
netstat -ano 2>nul | findstr ":18789 " | findstr "LISTENING" >nul
if !ERRORLEVEL! equ 0 (
    echo         [!] 端口被占用，正在清理...
    for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":18789 " ^| findstr "LISTENING"') do (
        taskkill /PID %%a /F >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
)

:: 清理 Gateway 锁文件 (防止 lock timeout 错误)
set "LOCK_FILE=!CONFIG_DIR!\gateway.lock"
if exist "!LOCK_FILE!" (
    echo         [!] 发现锁文件，正在清理...
    del /f "!LOCK_FILE!" >nul 2>&1
    echo [%date% %time%] Removed stale lock file >> "!STARTUP_LOG!"
)

echo         [OK] 端口 18789 可用
echo.

echo   [4/7] 设置 npm 镜像...
"!NODE_PATH!\npm.cmd" config set registry https://registry.npmmirror.com 2>nul
echo         [OK] 已设置国内镜像 (npmmirror.com)
echo [%date% %time%] Set npm registry to npmmirror.com >> "!STARTUP_LOG!"
echo.

echo   [5/7] 启动 Gateway 服务...
echo ============================================ > "!GATEWAY_LOG!"
echo [%date% %time%] Starting Gateway... >> "!GATEWAY_LOG!"
start /b cmd /c ""!NODE_PATH!\node.exe" "%~dp0dist\entry.js" gateway run --port 18789 --allow-unconfigured >> "!GATEWAY_LOG!" 2>&1"
echo [%date% %time%] Gateway start command sent >> "!STARTUP_LOG!"
timeout /t 5 /nobreak >nul
echo.

echo   [6/7] 等待服务启动 (最多30秒)...

set /a count=0
set /a maxWait=30
:waitloop
timeout /t 2 /nobreak >nul
set /a count+=2

netstat -an 2>nul | findstr ":18789 " | findstr "LISTENING" >nul
if !ERRORLEVEL! equ 0 (
    echo         [OK] 服务已就绪 - !count! 秒
    echo [%date% %time%] Gateway ready after !count! seconds >> "!STARTUP_LOG!"
    goto :success
)

echo         ... 已等待 !count! 秒
if !count! geq !maxWait! goto :timeout
goto :waitloop

:timeout
echo.
echo  ============================================================
echo         [错误] 超时 - Gateway 启动失败
echo  ============================================================
echo.
echo   Gateway 输出:
echo   ----------------------------------------
type "!GATEWAY_LOG!"
echo   ----------------------------------------
echo.
echo   可能原因:
echo   - 杀毒软件阻止
echo   - 缺少依赖
echo   - 配置错误
echo.
echo   日志文件: !GATEWAY_LOG!
echo.
echo [%date% %time%] ERROR: Gateway startup timeout >> "!STARTUP_LOG!"
pause
exit /b 1

:success
echo.
echo   [7/7] 打开浏览器...
start "" "http://localhost:18789/setup"
echo [%date% %time%] Opened browser >> "!STARTUP_LOG!"
echo.

:: 启动托盘程序 (使用 .NET Launcher 替代 VBS，兼容 Windows 11)
if exist "%~dp0ClawdbotLauncher.exe" (
    start "" "%~dp0ClawdbotLauncher.exe" tray
    echo         [OK] 托盘已启动
) else if exist "%~dp0StartTray.vbs" (
    :: 备用: VBS 方式 (旧系统)
    cscript //nologo "%~dp0StartTray.vbs" >nul 2>&1
    echo         [OK] 托盘已启动 (VBS)
)

echo.
echo  ============================================================
echo              启动完成
echo  ============================================================
echo.
echo   浏览器已打开，请在浏览器中完成设置
echo.
echo   日志文件位置:
echo   - 启动日志: !STARTUP_LOG!
echo   - Gateway日志: !GATEWAY_LOG!
echo.
echo   如需关闭此窗口，请按任意键...
echo [%date% %time%] Startup complete >> "!STARTUP_LOG!"
pause >nul
exit /b 0
