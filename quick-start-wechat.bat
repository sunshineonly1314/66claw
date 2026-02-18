@echo off
REM ============================================================================
REM 微信自动化客服快速启动脚本 (Windows)
REM
REM 使用方法: 双击运行或在命令行执行 quick-start-wechat.bat
REM ============================================================================

chcp 65001 >nul 2>&1
cls

echo ================================================================================
echo 🚀 微信自动化客服快速启动
echo ================================================================================
echo.

REM 检查 Node.js 环境
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 错误: 未安装 Node.js
    echo    请访问 https://nodejs.org/ 下载安装
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js: %NODE_VERSION%
echo.

REM 检查配置目录
set CONFIG_DIR=%USERPROFILE%\.openclawcn
set CONFIG_FILE=%CONFIG_DIR%\config.json5

if not exist "%CONFIG_DIR%" (
    echo 📁 创建配置目录: %CONFIG_DIR%
    mkdir "%CONFIG_DIR%"
)

REM 检查配置文件
if not exist "%CONFIG_FILE%" (
    echo 📝 配置文件不存在，使用模板创建...

    if exist "test-wechat-safe.json5" (
        copy /Y test-wechat-safe.json5 "%CONFIG_FILE%" >nul
        echo ✅ 配置文件已创建: %CONFIG_FILE%
        echo.
        echo ⚠️  请编辑配置文件，填入以下信息:
        echo    1. ClawChat API Key ^(从 ClawChat 小程序获取^)
        echo    2. 通义千问 API Key ^(从 DashScope 获取^)
        echo.
        echo 按任意键打开配置文件编辑...
        pause >nul
        notepad "%CONFIG_FILE%"
    ) else (
        echo ❌ 错误: 找不到模板文件 test-wechat-safe.json5
        pause
        exit /b 1
    )
) else (
    echo ✅ 配置文件已存在: %CONFIG_FILE%
)

echo.
echo ================================================================================
echo 🔍 检查配置
echo ================================================================================
echo.

REM 检查 API Key 是否配置
findstr /C:"placeholder" "%CONFIG_FILE%" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ⚠️  警告: 配置文件包含占位符，请确认已填入真实 API Key
    echo.
    set /p CONTINUE="是否继续？(y/N) "
    if /i not "%CONTINUE%"=="y" (
        echo ❌ 已取消启动
        pause
        exit /b 1
    )
)

REM 检查依赖
echo 📦 检查依赖...
if not exist "node_modules" (
    echo    安装依赖中...
    call npm install
)
echo ✅ 依赖检查完成
echo.

REM 运行测试
echo ================================================================================
echo 🧪 运行防检测测试
echo ================================================================================
echo.

if exist "test-wechat-anti-detection.mjs" (
    node test-wechat-anti-detection.mjs
    echo.
    echo 测试通过，按任意键继续启动服务...
    pause >nul
) else (
    echo ⚠️  测试文件不存在，跳过测试
)

echo.
echo ================================================================================
echo 🎬 启动服务
echo ================================================================================
echo.

echo 🌐 启动 OpenClawCN Gateway...
echo    访问地址: http://localhost:18789
echo    日志位置: %CONFIG_DIR%\logs\gateway.log
echo.
echo ⚠️  启动后保持此窗口运行
echo    按 Ctrl+C 可以停止服务
echo.
echo 📱 现在可以用另一个微信号给你的客服号发消息测试
echo.

REM 启动网关
if exist "dist\gateway\server.js" (
    node dist\gateway\server.js
) else if exist "src\gateway\server.ts" (
    npx tsx src\gateway\server.ts
) else (
    echo ❌ 错误: 找不到网关启动文件
    echo    请先构建项目: npm run build
    pause
    exit /b 1
)
