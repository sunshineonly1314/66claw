@echo off
chcp 65001 >nul 2>&1
title ClawdbotCN 全量卸载工具

echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║         ClawdbotCN 全量卸载工具 (Full Uninstall)         ║
echo ╠═══════════════════════════════════════════════════════════╣
echo ║                                                           ║
echo ║  此工具将彻底清除 ClawdbotCN 的所有安装痕迹：            ║
echo ║    - 程序安装目录                                         ║
echo ║    - 用户数据、配置文件、会话记录                         ║
echo ║    - WebView2 缓存数据                                    ║
echo ║    - 注册表项、计划任务、快捷方式                         ║
echo ║    - PATH 环境变量条目                                    ║
echo ║    - Defender 排除项                                      ║
echo ║    - 临时文件                                             ║
echo ║                                                           ║
echo ║  清除后下次安装将是全新环境，无历史残留。                 ║
echo ║                                                           ║
echo ║  !! 警告: 操作不可恢复！请确认后再继续。                  ║
echo ║                                                           ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

echo 请选择操作：
echo.
echo   [1] 全量卸载 - 删除所有数据（全新环境）
echo   [2] 普通卸载 - 保留用户数据（保留配置/会话）
echo   [3] 预览模式 - 只看不删，先确认会删什么
echo   [4] 取消退出
echo.

set /p choice="请输入选项 (1/2/3/4): "

if "%choice%"=="4" goto :cancel
if "%choice%"=="3" goto :preview
if "%choice%"=="2" goto :keep_data
if "%choice%"=="1" goto :full_uninstall

echo 无效选项，请重新运行。
pause
exit /b 1

:preview
echo.
echo 正在预览将要删除的内容...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0full-uninstall.ps1" -DryRun -Force
goto :done

:keep_data
echo.
echo 即将执行普通卸载（保留用户数据）...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0full-uninstall.ps1" -KeepData
goto :done

:full_uninstall
echo.
echo 即将执行全量卸载...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0full-uninstall.ps1"
goto :done

:cancel
echo.
echo 已取消。
goto :done

:done
echo.
echo ────────────────────────────────────────────────────────────
echo 按任意键关闭窗口...
pause >nul
