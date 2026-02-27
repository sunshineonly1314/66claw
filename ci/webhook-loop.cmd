@echo off
cd /d "D:\codeknowledge\clawdbot-main\clawdbot-main\ci"
:loop
echo [%date% %time%] Starting webhook server... >> webhook.log
"D:\Program Files\node\node.exe" webhook-server.js >> webhook.log 2>&1
echo [%date% %time%] webhook server exited, restarting in 3s... >> webhook.log
timeout /t 3 /nobreak >nul
goto loop
