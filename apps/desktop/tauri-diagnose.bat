@echo off
chcp 65001 >nul
echo ================================================
echo   ClawdbotCN Tauri 诊断工具
echo ================================================
echo.

echo [检查依赖]
echo ----------------------------------------

echo 检查 Node.js...
where node >nul 2>&1
if %errorlevel% equ 0 (
    node --version
) else (
    echo ❌ Node.js 未安装
)
echo.

echo 检查 pnpm...
where pnpm >nul 2>&1
if %errorlevel% equ 0 (
    pnpm --version
) else (
    echo ❌ pnpm 未安装
)
echo.

echo 检查 Rust...
where rustc >nul 2>&1
if %errorlevel% equ 0 (
    rustc --version
    cargo --version
) else (
    echo ❌ Rust 未安装
)
echo.

echo 检查 Tauri CLI...
cd ..\..
pnpm --filter clawdbot-desktop tauri --version 2>nul
if %errorlevel% neq 0 (
    echo ❌ Tauri CLI 未安装
)
echo.

echo [检查项目文件]
echo ----------------------------------------

if exist "dist\control-ui\index.html" (
    echo ✅ UI 前端已构建: dist\control-ui\
) else (
    echo ❌ UI 前端未构建，请运行: pnpm ui:build
)
echo.

if exist "apps\desktop\src-tauri\Cargo.toml" (
    echo ✅ Tauri 项目配置存在
) else (
    echo ❌ Tauri 项目配置缺失
)
echo.

if exist "apps\desktop\src-tauri\tauri.conf.json" (
    echo ✅ Tauri 应用配置存在
) else (
    echo ❌ Tauri 应用配置缺失
)
echo.

echo [检查端口占用]
echo ----------------------------------------

echo 检查 Vite 开发服务器端口 (5173)...
netstat -an | findstr ":5173" >nul
if %errorlevel% equ 0 (
    echo ⚠️  端口 5173 已被占用
    netstat -ano | findstr ":5173"
) else (
    echo ✅ 端口 5173 可用
)
echo.

echo 检查 Gateway 端口 (18789)...
netstat -an | findstr ":18789" >nul
if %errorlevel% equ 0 (
    echo ⚠️  端口 18789 已被占用
    netstat -ano | findstr ":18789"
) else (
    echo ✅ 端口 18789 可用
)
echo.

echo [检查进程]
echo ----------------------------------------

tasklist | findstr /i "clawdbot-desktop.exe" >nul
if %errorlevel% equ 0 (
    echo ✅ Tauri 应用正在运行
    tasklist | findstr /i "clawdbot-desktop.exe"
) else (
    echo ℹ️  Tauri 应用未运行
)
echo.

tasklist | findstr /i "node.exe" >nul
if %errorlevel% equ 0 (
    echo ✅ Node.js 进程正在运行
    echo.
    echo 运行中的 Node.js 进程:
    tasklist | findstr /i "node.exe"
) else (
    echo ℹ️  Node.js 进程未运行
)
echo.

echo [磁盘空间]
echo ----------------------------------------
for /f "tokens=3" %%a in ('dir /-c %systemdrive%\ ^| findstr /C:"bytes free"') do set FREE_SPACE=%%a
echo 可用磁盘空间: %FREE_SPACE% bytes
echo.

echo [内存使用]
echo ----------------------------------------
wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /Value
echo.

echo ================================================
echo   诊断完成
echo ================================================
echo.
echo 如果遇到问题，请检查:
echo   1. 所有依赖是否正确安装
echo   2. 端口是否被占用
echo   3. 磁盘空间是否充足
echo   4. 防火墙是否阻止了应用
echo.

pause
