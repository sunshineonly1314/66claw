---
name: wyoming-clawdbot
name_zh: 怀俄明爬虫
description: 用于将 Home Assistant 语音助手与 Clawdbot 集成的 Wyoming 协议桥接器。
description_zh: 用于将 Home Assistant 语音助手与 Clawdbot 集成的 Wyoming 协议桥接器。
---
# Wyoming-Clawdbot

通过 Wyoming 协议，将 Home Assistant Assist 的语音指令桥接到 Clawdbot。

## 功能说明

- 接收来自 Home Assistant Assist 的语音指令  
- 将其转发至 Clawdbot 进行处理  
- 将 AI 生成的响应返回，供 Home Assistant 的 TTS（文本转语音）播报

## 设置步骤

1. 克隆并运行服务端：
```bash
git clone https://github.com/vglafirov/wyoming-clawdbot.git
cd wyoming-clawdbot
docker compose up -d
```

2. 在 Home Assistant 中添加 Wyoming 集成：
   - 设置 → 设备与服务 → 添加集成  
   - 搜索“Wyoming Protocol”  
   - 输入主机地址与端口（例如：`192.168.1.100:10600`）

3. 配置语音助手流水线（pipeline），将对话 Agent 设为“clawdbot”

## 系统要求

- Clawdbot 已在同一主机上运行  
- Home Assistant 已安装 Wyoming 集成  
- Docker（推荐）或 Python 3.11+

## 相关链接

- GitHub：https://github.com/vglafirov/wyoming-clawdbot