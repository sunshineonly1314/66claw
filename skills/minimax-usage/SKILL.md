---
name: minimax-usage
name_zh: MiniMax调用
description: 监控 Minimax 编码计划（Coding Plan）用量，以确保不超出 API 限额。获取当前用量统计并提供状态告警。
description_zh: 监控 Minimax 编码计划（Coding Plan）用量，以确保不超出 API 限额。获取当前用量统计并提供状态告警。
metadata: {"clawdbot":{"emoji":"📊"}}
---
# Minimax Usage Skill

监控 Minimax 编码计划（Coding Plan）用量，以确保不超出限额。

## 设置

在脚本所在目录中创建一个 `.env` 文件：

```bash
MINIMAX_CODING_API_KEY=your_api_key_here
MINIMAX_GROUP_ID=your_group_id_here
```

从以下地址获取您的 GroupId：https://platform.minimax.io/user-center/basic-information（位于“基本信息”下）

## 使用方法

```bash
./minimax-usage.sh
```

## 输出示例

```
🔍 Checking Minimax Coding Plan usage...
✅ Usage retrieved successfully:

📊 Coding Plan Status (MiniMax-M2):
   Used:      255 / 1500 prompts (17%)
   Remaining: 1245 prompts
   Resets in: 3h 17m

💚 GREEN: 17% used. Plenty of buffer.
```

## API 详情

**端点（Endpoint）：**  
```
GET https://platform.minimax.io/v1/api/openplatform/coding_plan/remains?GroupId={GROUP_ID}
```

**必需请求头（Required Headers）：**  
```
accept: application/json, text/plain, */*
authorization: Bearer {MINIMAX_CODING_API_KEY}
referer: https://platform.minimax.io/user-center/payment/coding-plan
user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36
```

## 限额

| 指标 | 值 |
|------|----|
| 重置窗口（Reset window） | 5 小时（动态） |
| 最大目标用量（Max target） | 60% 用量 |
| 1 次 prompt ≈ | 15 次模型调用 |

## 注意事项

- 编码计划（Coding Plan）API 密钥 **仅限该计划专用**（不可与标准 API 密钥互换使用）  
- 超过 5 小时的用量将自动从统计中释放