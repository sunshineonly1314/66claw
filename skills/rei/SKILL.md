---
name: rei
name_zh: REI
description: 将 Rei Qwen3 Coder 配置为模型提供商。适用于配置 coder.reilabs.org、将 Rei 添加至 Clawdbot，或排查来自 Rei 端点的 403 错误。
description_zh: 将 Rei Qwen3 Coder 配置为模型提供商。适用于配置 coder.reilabs.org、将 Rei 添加至 Clawdbot，或排查来自 Rei 端点的 403 错误。
---
# Rei Qwen3 Coder  

Rei 通过 OpenAI 兼容端点 `coder.reilabs.org` 提供 Qwen3 Coder 模型。

## 通过脚本配置  

```bash
./skills/rei/scripts/setup.sh YOUR_REI_API_KEY
```  

该命令将添加提供商、将其加入模型白名单，并重启网关。

## 通过 Agent 配置  

请向您的 agent 发送：  

> "Set up Rei with API key: YOUR_KEY"  

agent 将读取本技能并为您运行配置脚本。

## 切换模型  

**通过聊天界面：**  
```
/model rei
/model opus
```  

**通过脚本：**  
```bash
./skills/rei/scripts/switch.sh rei
./skills/rei/scripts/switch.sh opus
```  

**通过 agent：**  
> "Switch to Rei" or "Switch back to Opus"  

## 恢复操作  

若配置出错，请恢复备份：  

```bash
./skills/rei/scripts/revert.sh
```  

## 手动配置  

在 `~/.clawdbot/clawdbot.json` 中添加以下内容：  

```json
{
  "models": {
    "providers": {
      "rei": {
        "baseUrl": "https://coder.reilabs.org/v1",
        "apiKey": "YOUR_API_KEY",
        "api": "openai-completions",
        "headers": { "User-Agent": "Clawdbot/1.0" },
        "models": [{
          "id": "rei-qwen3-coder",
          "name": "Rei Qwen3 Coder",
          "contextWindow": 200000,
          "maxTokens": 8192
        }]
      }
    }
  },
  "agents": {
    "defaults": {
      "models": {
        "rei/rei-qwen3-coder": { "alias": "rei" }
      }
    }
  }
}
```  

然后重启： `clawdbot gateway restart`  

## 故障排查  

**403 错误：** 必须携带 `User-Agent: Clawdbot/1.0` 请求头。配置脚本会自动添加此头。若您手动配置，请确保该请求头已正确设置。  

**“模型未被允许”：** 必须将 Rei 加入 `agents.defaults.models` 白名单后方可切换至该模型。配置脚本已处理此步骤；若手动配置，请添加上方所示白名单条目。