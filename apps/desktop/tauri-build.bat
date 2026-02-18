@echo off
chcp 65001 >nul
echo ================================================
echo   ClawdbotCN Tauri 生产构建脚本
echo ================================================
echo.

echo [1/5] 检查依赖...
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到 pnpm
    exit /b 1
)

where rustc >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到 Rust
    exit /b 1
)

echo ✅ 依赖检查通过

echo.
echo [2/5] 安装依赖...
pnpm install

echo.
echo [3/5] 构建后端代码...
cd ..\..
call pnpm build
if %errorlevel% neq 0 (
    echo ❌ 后端构建失败
    exit /b 1
)

echo.
echo [4/5] 构建 UI 前端...
call pnpm ui:build
if %errorlevel% neq 0 (
    echo ❌ UI 构建失败
    exit /b 1
)

echo.
echo [5/5] 构建 Tauri 应用...
cd apps\desktop
call pnpm tauri build
if %errorlevel% neq 0 (
    echo ❌ Tauri 构建失败
    exit /b 1
)

echo.
echo ================================================
echo   ✅ 构建完成！
echo ================================================
echo.
echo 安装包位置:
echo   src-tauri\target\release\bundle\nsis\
echo.

pause
