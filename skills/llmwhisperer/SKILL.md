---
name: llmwhisperer
name_zh: LLM Whisperer
description: 使用 LLMWhisperer API 从图像和 PDF 中提取文本及版式信息。适用于手写体识别与复杂表单处理。
description_zh: 使用 LLMWhisperer API 从图像和 PDF 中提取文本及版式信息。适用于手写体识别与复杂表单处理。
metadata: {"clawdbot":{"emoji":"📄","scripts":["scripts/llmwhisperer"]}}
---
# LLMWhisperer

使用 [LLMWhisperer API](https://unstract.com/llmwhisperer/) 从图像和 PDF 中提取文本——特别适用于手写体识别与复杂表单处理。

## 配置

需在 `~/.clawdbot/.env` 中配置 `LLMWHISPERER_API_KEY`：
```bash
echo "LLMWHISPERER_API_KEY=your_key_here" >> ~/.clawdbot/.env
```

### 获取 API 密钥
请前往 [unstract.com/llmwhisperer](https://unstract.com/llmwhisperer/) 免费获取 API 密钥。
- **免费套餐**：每日 100 页

## 使用方式

```bash
llmwhisperer <file>
```

## 脚本源码

可执行脚本位于 `scripts/llmwhisperer`。

```bash
#!/bin/bash
# Extract text using LLMWhisperer API

if [ -z "$LLMWHISPERER_API_KEY" ]; then
  if [ -f ~/.clawdbot/.env ]; then
    # shellcheck disable=SC2046
    export $(grep -v '^#' ~/.clawdbot/.env | grep 'LLMWHISPERER_API_KEY' | xargs)
  fi
fi

if [ -z "$LLMWHISPERER_API_KEY" ]; then
  echo "Error: LLMWHISPERER_API_KEY not found in env or ~/.clawdbot/.env"
  exit 1
fi

FILE="$1"
if [ -z "$FILE" ]; then
  echo "Usage: $0 <file>"
  exit 1
fi

curl -s -X POST "https://llmwhisperer-api.us-central.unstract.com/api/v2/whisper?mode=high_quality&output_mode=layout_preserving" \
  -H "Content-Type: application/octet-stream" \
  -H "unstract-key: $LLMWHISPERER_API_KEY" \
  --data-binary "@$FILE"
```

## 示例

**将文本打印至终端：**
```bash
llmwhisperer flyer.jpg
```

**将输出保存为文本文件：**
```bash
llmwhisperer invoice.pdf > invoice.txt
```

**处理手写笔记：**
```bash
llmwhisperer notes.jpg
```