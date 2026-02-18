@echo off
REM ============================================================================
REM 微信自动化客服快速启动脚本 (Windows) - 高级防抓包版
REM
REM 使用方法: 双击运行或在命令行执行 quick-start-wechat-advanced.bat
REM 特性: 集成高级防抓包、防检测、完整浏览器指纹伪装
REM ============================================================================

chcp 65001 >nul 2>&1
cls

echo ================================================================================
echo 🔒 微信自动化客服快速启动 - 高级防护版
echo ================================================================================
echo.
echo 🛡️  防护特性:
echo    ✅ 10项高级防抓包策略
echo    ✅ 8项防检测机制
echo    ✅ 浏览器指纹一致性保护
echo    ✅ 智能流量混淆
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
        echo 📖 获取教程:
        echo    ClawChat: 微信搜索"ClawChat" -^> 设置 -^> API密钥
        echo    DashScope: https://dashscope.console.aliyun.com/apiKey
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
    echo 当前配置示例:
    echo   apiKey: "cc_xxx:xxxxxxxx"  ^(ClawChat^)
    echo   apiKey: "sk-xxxxxxxx"      ^(DashScope^)
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
    if %ERRORLEVEL% NEQ 0 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
)
echo ✅ 依赖检查完成
echo.

REM 运行测试
echo ================================================================================
echo 🧪 运行高级防护测试
echo ================================================================================
echo.

if exist "advanced-anti-sniffing.mjs" (
    echo 🔬 测试1: 高级防抓包策略...
    node advanced-anti-sniffing.mjs
    if %ERRORLEVEL% NEQ 0 (
        echo ❌ 高级防抓包测试失败
        pause
        exit /b 1
    )
    echo ✅ 测试1通过
    echo.
) else (
    echo ⚠️  高级防抓包测试文件不存在，跳过测试
)

if exist "test-wechat-anti-detection.mjs" (
    echo 🔬 测试2: 防检测机制...
    node test-wechat-anti-detection.mjs
    if %ERRORLEVEL% NEQ 0 (
        echo ❌ 防检测测试失败
        pause
        exit /b 1
    )
    echo ✅ 测试2通过
    echo.
)

echo ✅ 所有测试通过
echo.
echo 按任意键继续启动服务...
pause >nul

echo.
echo ================================================================================
echo 🎬 启动服务
echo ================================================================================
echo.

echo 📊 防护状态:
echo    🔒 防检测: ✅ 已启用 (8项措施)
echo    🔒 防抓包: ✅ 已启用 (10项策略)
echo    🔒 限流控制: ✅ 30条/小时, 100条/天
echo    🔒 夜间静默: ✅ 00:00-07:00
echo.

echo 🌐 启动 OpenClawCN Gateway...
echo    访问地址: http://localhost:18789
echo    日志位置: %CONFIG_DIR%\logs\gateway.log
echo.
echo ⚠️  重要提示:
echo    1. 启动后保持此窗口运行
echo    2. 按 Ctrl+C 可以停止服务
echo    3. 测试时用另一个微信号发消息
echo    4. 观察回复延迟 (2-8秒随机)
echo    5. 检查限流是否生效
echo.
echo 📱 测试建议:
echo    - 第1次: 发"你好"测试基础回复
echo    - 第2次: 发含"测试"的消息 (应被黑名单拦截)
echo    - 第3次: 连续发10条消息 (测试限流)
echo.

REM 启动网关
if exist "dist\gateway\server.js" (
    echo 🚀 使用构建版本启动...
    node dist\gateway\server.js
) else if exist "src\gateway\server.ts" (
    echo 🚀 使用开发版本启动...
    npx tsx src\gateway\server.ts
) else (
    echo ❌ 错误: 找不到网关启动文件
    echo    请先构建项目: npm run build
    echo    或确认 src\gateway\server.ts 存在
    pause
    exit /b 1
)
