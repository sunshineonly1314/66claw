---
name: voice-transcribe
name_zh: 语音转录
description: 使用 OpenAI 的 gpt-4o-mini-transcribe 模型对音频文件进行转录，支持词汇提示与文本替换功能。需安装 uv（https://docs.astral.sh/uv/）。
description_zh: 使用 OpenAI 的 gpt-4o-mini-transcribe 模型对音频文件进行转录，支持词汇提示与文本替换功能。需安装 uv（https://docs.astral.sh/uv/）。
---
# voice-transcribe

使用 OpenAI 的 gpt-4o-mini-transcribe 模型对音频文件进行转录。

## 适用场景

当收到语音备忘录（尤其是通过 WhatsApp 收到时），只需运行：
```bash
uv run /Users/darin/clawd/skills/voice-transcribe/transcribe <audio-file>
```
然后根据转录内容进行回复。

## 修正转录错误

若 Darin 指出某个词被错误转录，请将其添加至 `vocab.txt`（用于提供提示）或 `replacements.txt`（用于强制修正）。详见下方章节。

## 支持的格式

- mp3、mp4、mpeg、mpga、m4a、wav、webm、ogg、opus

## 示例

```bash
# transcribe a voice memo
transcribe /tmp/voice-memo.ogg

# pipe to other tools
transcribe /tmp/memo.ogg | pbcopy
```

## 安装配置

1. 将您的 OpenAI API 密钥添加至 `/Users/darin/clawd/skills/voice-transcribe/.env`：
   ```
   OPENAI_API_KEY=sk-...
   ```

## 自定义词汇表

向 `vocab.txt`（每行一个词）中添加词汇，有助于模型识别专有名词或行业术语：
```
Clawdis
Clawdbot
```

## 文本替换规则

若模型仍持续出错，可在 `replacements.txt` 中添加替换规则：
```
wrong spelling -> correct spelling
```

## 注意事项

- 默认假设输入为英文（不进行语言检测）
- 明确使用 gpt-4o-mini-transcribe 模型
- 缓存机制基于音频文件的 SHA256 哈希值