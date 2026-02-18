@echo off
chcp 65001 >nul
echo ================================================
echo   ClawdbotCN Tauri 开发环境启动脚本
echo ================================================
echo.

echo [1/4] 检查依赖...
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到 pnpm，请先安装 pnpm
    echo    npm install -g pnpm
    exit /b 1
)

where rustc >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到 Rust，请访问 https://rustup.rs/ 安装
    exit /b 1
)

echo ✅ 依赖检查通过

echo.
echo [2/4] 安装 Desktop App 依赖...
pnpm install
if %errorlevel% neq 0 (
    echo ❌ 依赖安装失败
    exit /b 1
)

echo.
echo [3/4] 构建 UI 前端...
cd ..\..
call pnpm ui:build
if %errorlevel% neq 0 (
    echo ❌ UI 构建失败
    exit /b 1
)
cd apps\desktop

echo.
echo [4/4] 启动 Tauri 开发模式...
echo.
echo ℹ️  应用将在几秒钟后打开窗口
echo ℹ️  按 Ctrl+C 停止开发服务器
echo.
call pnpm tauri dev

pause
