@echo off
cd /d "D:\codeknowledge\clawdbot-main\clawdbot-main\ci"
:loop
echo [%date% %time%] Connecting to FRP server... >> frpc.log
"E:\frp\frpc.exe" -c frpc.toml >> frpc.log 2>&1
echo [%date% %time%] frpc exited, reconnecting in 5s... >> frpc.log
timeout /t 5 /nobreak >nul
goto loop
