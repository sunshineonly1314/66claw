@echo off
cd /d "d:\codeknowledge\clawdbot-main\clawdbot-main"
node dist\index.js agent --message "使用 wechat_read 工具读取 TecBin 的最近5条微信消息" --timeout 120000
