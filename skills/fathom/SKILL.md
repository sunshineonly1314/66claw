---
name: fathom
name_zh: Fathom
description: 连接 Fathom AI 以获取通话录音、文字记录及摘要。当用户询问其会议、通话历史，或希望搜索过往对话时使用。
description_zh: 连接 Fathom AI 以获取通话录音、文字记录及摘要。当用户询问其会议、通话历史，或希望搜索过往对话时使用。
read_when:
  - 用户询问其 Fathom 通话或会议相关事宜  
  - 用户希望搜索通话文字记录  
  - 用户需要通话摘要或待办事项  
  - 用户希望设置 Fathom 集成  
metadata:
  clawdbot:
    emoji: "📞"
    requires:
      bins: ["curl", "jq"]
---
# Fathom 技能（Skill）

连接 [Fathom AI](https://fathom.video)，获取通话录音、文字记录及摘要。

## 设置步骤

### 1. 获取您的 API 密钥  
1. 访问 [developers.fathom.ai](https://developers.fathom.ai)  
2. 创建一个 API 密钥  
3. 复制该密钥（格式：`v1XDx...`）

### 2. 配置  
```bash
# Option A: Store in file (recommended)
echo "YOUR_API_KEY" > ~/.fathom_api_key
chmod 600 ~/.fathom_api_key

# Option B: Environment variable
export FATHOM_API_KEY="YOUR_API_KEY"
```

### 3. 测试连接  
```bash
./scripts/setup.sh
```

---

## 命令

### 列出最近的通话  
```bash
./scripts/list-calls.sh                    # Last 10 calls
./scripts/list-calls.sh --limit 20         # Last 20 calls
./scripts/list-calls.sh --after 2026-01-01 # Calls after date
./scripts/list-calls.sh --json             # Raw JSON output
```

### 获取文字记录  
```bash
./scripts/get-transcript.sh 123456789      # By recording ID
./scripts/get-transcript.sh 123456789 --json
./scripts/get-transcript.sh 123456789 --text-only
```

### 获取摘要  
```bash
./scripts/get-summary.sh 123456789         # By recording ID
./scripts/get-summary.sh 123456789 --json
```

### 搜索通话  
```bash
./scripts/search-calls.sh "product launch" # Search transcripts
./scripts/search-calls.sh --speaker "Lucas"
./scripts/search-calls.sh --after 2026-01-01 --before 2026-01-15
```

---

## API 参考文档

| 接口端点（Endpoint） | 方法（Method） | 描述 |
|----------------------|----------------|------|
| `/meetings` | GET | 按筛选条件列出会议 |
| `/recordings/{id}/transcript` | GET | 包含发言人的完整文字记录 |
| `/recordings/{id}/summary` | GET | AI 生成的摘要 + 待办事项 |
| `/webhooks` | POST | 注册 Webhook 以实现自动同步 |

**基础 URL：** `https://api.fathom.ai/external/v1`  
**认证方式：** 使用 `X-API-Key` 请求头  

---

## list-calls 的筛选参数

| 筛选参数 | 描述 | 示例 |
|----------|------|------|
| `--limit N` | 返回结果数量 | `--limit 20` |
| `--after DATE` | 指定日期之后的通话 | `--after 2026-01-01` |
| `--before DATE` | 指定日期之前的通话 | `--before 2026-01-15` |
| `--cursor TOKEN` | 分页游标 | `--cursor eyJo...` |

---

## 输出格式

| 标志（Flag） | 描述 |
|--------------|------|
| `--json` | 直接输出 API 返回的原始 JSON |
| `--table` | 格式化表格（列表类命令的默认输出） |
| `--text-only` | 纯文本（仅适用于文字记录） |

---

## 示例

### 获取您上一次通话的摘要  
```bash
# Get latest call ID
CALL_ID=$(./scripts/list-calls.sh --limit 1 --json | jq -r '.[0].recording_id')

# Get summary
./scripts/get-summary.sh $CALL_ID
```

### 导出上周全部通话记录  
```bash
./scripts/list-calls.sh --after $(date -d '7 days ago' +%Y-%m-%d) --json > last_week_calls.json
```

### 查找提及特定主题的通话  
```bash
./scripts/search-calls.sh "quarterly review"
```

---

## 故障排除

| 错误 | 解决方案 |
|------|----------|
| “未找到 API 密钥” | 运行 setup 命令，或设置 `FATHOM_API_KEY` 环境变量 |
| “401 未授权” | 检查 API 密钥是否有效 |
| “429 请求过于频繁” | 等待后重试 |
| “未找到录音” | 确认录音 ID 是否存在 |

---

## Webhook 设置（高级）

如需自动导入文字记录，请参阅 Webhook 设置指南：  
```bash
./scripts/setup-webhook.sh --url https://your-endpoint.com/webhook
```

需具备可公开访问的 HTTPS 端点。