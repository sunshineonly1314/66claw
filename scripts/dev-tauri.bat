@echo off
REM ClawbotCN 本地调试一键启动 (双击即可)
REM 调用 PowerShell 脚本完成前后端编译 + Tauri 启动
cd /d "%~dp0\.."
powershell -ExecutionPolicy Bypass -File "%~dp0\dev-tauri.ps1" %*
pause
