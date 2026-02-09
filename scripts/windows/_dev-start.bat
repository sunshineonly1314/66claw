@echo off
chcp 65001 >nul 2>&1
set CLAWDBOT_GATEWAY_TOKEN=clawdbot2026
set CLAWDBOT_SKIP_CHANNELS=1
set CLAWDBOT_REGION=cn
set CLAWDBOT_BUNDLED_SKILLS_DIR=D:\codeknowledge\clawdbot-main\clawdbot-main\skills
cd /d D:\codeknowledge\clawdbot-main\clawdbot-main
node dist\entry.js gateway run --port 18789 --allow-unconfigured --force --ws-log full
