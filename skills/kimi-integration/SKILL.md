---
name: kimi-integration
name_zh: Kimi 集成
description: 将月之暗面 AI（Kimi）与 Kimi Code 模型集成至 Clawdbot 的分步指南。当用户询问如何在 Clawdbot 中添加 Kimi 模型、配置月之暗面 AI 或设置 Kimi 编程支持时使用。
description_zh: 将月之暗面 AI（Kimi）与 Kimi Code 模型集成至 Clawdbot 的分步指南。当用户询问如何在 Clawdbot 中添加 Kimi 模型、配置月之暗面 AI 或设置 Kimi 编程支持时使用。
---
# Kimi 模型集成

为 Clawdbot 添加月之暗面 AI（Kimi）与 Kimi Code 模型的完整指南。

## 概述

Kimi 提供两类独立的模型家族：

1. **月之暗面 AI（Kimi K2）** —— 通过 OpenAI 兼容 API 提供的通用模型  
2. **Kimi Code** —— 具有专用端点的代码专用模型  

两者均需从不同来源获取 API 密钥。

## 前提条件

- 已安装并配置好 Clawdbot  
- 已获取 API 密钥（参见“获取 API 密钥”章节）

## 获取 API 密钥

### 月之暗面 AI（Kimi K2）

1. 访问 https://platform.moonshot.cn  
2. 注册账户  
3. 进入 API 密钥页面  
4. 创建新 API 密钥  
5. 复制密钥（以 `sk-...` 开头）

### Kimi Code

1. 访问 https://api.kimi.com/coding  
2. 注册账户  
3. 进入 API 密钥页面  
4. 创建新 API 密钥  
5. 复制密钥（以 `sk-...` 开头）

**注意：** 月之暗面与 Kimi Code 使用彼此独立的密钥与端点。

## 集成步骤

### 方案一：月之暗面 AI（Kimi K2 模型）

#### 步骤 1：设置环境变量

```bash
export MOONSHOT_API_KEY="sk-your-moonshot-key-here"
```

或添加至 `.env` 文件：

```bash
echo 'MOONSHOT_API_KEY="sk-your-moonshot-key-here"' >> ~/.env
```

#### 步骤 2：添加提供商配置

编辑您的 `clawdbot.json` 配置文件：

```json5
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "moonshot/kimi-k2.5"
      }
    }
  },
  "models": {
    "mode": "merge",
    "providers": {
      "moonshot": {
        "baseUrl": "https://api.moonshot.cn/v1",
        "apiKey": "${MOONSHOT_API_KEY}",
        "api": "openai-completions",
        "models": [
          {
            "id": "moonlight-v1-32k",
            "name": "Moonlight V1 32K",
            "contextWindow": 32768
          },
          {
            "id": "moonshot-v1-8k",
            "name": "Moonshot V1 8K",
            "contextWindow": 8192
          },
          {
            "id": "moonshot-v1-32k",
            "name": "Moonshot V1 32K",
            "contextWindow": 32768
          },
          {
            "id": "moonshot-v1-128k",
            "name": "Moonshot V1 128K",
            "contextWindow": 131072
          },
          {
            "id": "kimi-k2.5",
            "name": "Kimi K2.5",
            "contextWindow": 200000
          }
        ]
      }
    }
  }
}
```

#### 步骤 3：重启 Clawdbot

```bash
clawdbot gateway restart
```

#### 步骤 4：验证集成

```bash
clawdbot models list
```

您应在模型列表中看到月之暗面模型。

#### 步骤 5：使用模型

设为默认模型：
```bash
clawdbot models set moonshot/kimi-k2.5
```

或在聊天中使用模型别名：
```bash
/model moonshot/kimi-k2.5
```

### 方案二：Kimi Code（专用代码模型）

#### 步骤 1：设置环境变量

```bash
export KIMICODE_API_KEY="sk-your-kimicode-key-here"
```

或添加至 `.env`：

```bash
echo 'KIMICODE_API_KEY="sk-your-kimicode-key-here"' >> ~/.env
```

#### 步骤 2：添加提供商配置

编辑您的 `clawdbot.json` 配置文件：

```json5
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "kimicode/kimi-for-coding"
      },
      "models": {
        "kimicode/kimi-for-coding": {
          "alias": "kimi"
        }
      }
    }
  },
  "models": {
    "mode": "merge",
    "providers": {
      "kimicode": {
        "baseUrl": "https://api.kimi.com/coding/v1",
        "apiKey": "${KIMICODE_API_KEY}",
        "api": "openai-completions",
        "models": [
          {
            "id": "kimi-for-coding",
            "name": "Kimi For Coding",
            "contextWindow": 200000,
            "maxTokens": 8192
          }
        ]
      }
    }
  }
}
```

#### 步骤 3：重启 Clawdbot

```bash
clawdbot gateway restart
```

#### 步骤 4：验证集成

```bash
clawdbot models list
```

您应在模型列表中看到 `kimicode/kimi-for-coding`。

#### 步骤 5：使用模型

设为默认模型：
```bash
clawdbot models set kimicode/kimi-for-coding
```

或在聊天中使用模型别名：
```bash
/model kimi
```

## 同时使用两个提供商

您可以同时配置月之暗面与 Kimi Code：

```json5
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "moonshot/kimi-k2.5"
      },
      "models": {
        "kimicode/kimi-for-coding": {
          "alias": "kimi"
        },
        "moonshot/kimi-k2.5": {
          "alias": "k25"
        }
      }
    }
  },
  "models": {
    "mode": "merge",
    "providers": {
      "moonshot": {
        "baseUrl": "https://api.moonshot.cn/v1",
        "apiKey": "${MOONSHOT_API_KEY}",
        "api": "openai-completions",
        "models": [
          { "id": "kimi-k2.5", "name": "Kimi K2.5", "contextWindow": 200000 }
        ]
      },
      "kimicode": {
        "baseUrl": "https://api.kimi.com/coding/v1",
        "apiKey": "${KIMICODE_API_KEY}",
        "api": "openai-completions",
        "models": [
          { "id": "kimi-for-coding", "name": "Kimi For Coding", "contextWindow": 200000 }
        ]
      }
    }
  }
}
```

使用别名在模型间切换：
- `/model k25` —— Kimi K2.5（通用）  
- `/model kimi` —— Kimi for Coding（专用）

## 故障排除

### 模型未出现在列表中

检查配置语法：
```bash
clawdbot gateway config.get | grep -A 20 moonshot
```

验证 API 密钥是否已设置：
```bash
echo $MOONSHOT_API_KEY
echo $KIMICODE_API_KEY
```

### 认证错误

- 验证 API 密钥是否以 `sk-` 开头  
- 在提供商控制台中确认密钥有效性  
- 确保各提供商的基础 URL 正确无误  

### 连接问题

直接测试 API 端点：
```bash
curl -X POST "https://api.moonshot.cn/v1/chat/completions" \
  -H "Authorization: Bearer $MOONSHOT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "kimi-k2.5", "messages": [{"role": "user", "content": "test"}]}'
```

## 模型推荐

- **Kimi K2.5**（`moonshot/kimi-k2.5`）—— 通用任务首选，支持 200K 上下文  
- **Kimi for Coding**（`kimicode/kimi-for-coding`）—— 专精于代码生成  
- **Moonshot V1 128K**（`moonshot/moonshot-v1-128k`）—— 遗留模型，支持 128K 上下文  

## 参考资料

- 月之暗面 AI 文档：https://platform.moonshot.cn/docs  
- Kimi Code API：https://api.kimi.com/coding/docs  
- Clawdbot 模型提供商文档：/home/eyurc/clawdbot/docs/concepts/model-providers.md