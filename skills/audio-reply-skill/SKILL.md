---
name: audio-reply
name_zh: 音频回复
description: '使用 TTS 生成语音回复。通过“read it to me [URL]”触发，可抓取并朗读网页内容；或通过“talk to me [topic]”触发，可生成语音形式的对话式回应。亦响应“speak”、“say it”、“voice reply”等指令。'
description_zh: 使用 TTS 生成语音回复。通过“read it to me [URL]”触发，可抓取并朗读网页内容；或通过“talk to me [topic]”触发，可生成语音形式的对话式回应。亦响应“speak”、“say it”、“voice reply”等指令。
homepage: https://github.com/anthropics/claude-code
metadata: {"clawdbot":{"emoji":"🔊","requires":{"bins":["uv"]}}}
---
# 音频回复技能

使用 MLX Audio TTS（chatterbox-turbo 模型）生成语音形式的回复。

## 触发短语  

- **“read it to me [URL]”** —— 抓取指定 URL 内容并朗读  
- **“talk to me [topic/question]”** —— 生成一段对话式语音回应  
- **“speak”**、**“say it”**、**“voice reply”** —— 将当前文本回复转为语音  

## 使用方法  

### 模式 1：朗读网页内容  
```
User: read it to me https://example.com/article
```  
1. 使用 WebFetch 工具抓取 URL 内容  
2. 提取可读文本（剔除 HTML，聚焦主体内容）  
3. 使用 TTS 生成音频  
4. 播放音频，随后删除临时文件  

### 模式 2：对话式语音回复  
```
User: talk to me about the weather today
```  
1. 生成自然、对话式的回复  
2. 保持简洁（TTS 在较短片段上效果最佳）  
3. 转为音频，播放后删除临时文件  

## 实现细节  

### TTS 命令  
```bash
uv run mlx_audio.tts.generate \
  --model mlx-community/chatterbox-turbo-fp16 \
  --text "Your text here" \
  --play \
  --file_prefix /tmp/audio_reply
```  

### 关键参数  
- `--model mlx-community/chatterbox-turbo-fp16` —— 快速、自然的语音  
- `--play` —— 自动播放生成的音频  
- `--file_prefix` —— 保存至临时目录以便清理  
- `--exaggeration 0.3` —— 可选：增强表现力（取值范围 0.0–1.0）  
- `--speed 1.0` —— 如需可调整语速  

### 文本准备指南  

**“read it to me” 模式：**  
1. 使用 WebFetch 工具抓取 URL  
2. 提取主体内容，剔除导航栏、广告与模板文字  
3. 若内容过长（>500 字），进行摘要提炼——保留关键要点  
4. 合理使用句号与逗号添加自然停顿  

**“talk to me” 模式：**  
1. 以口语化方式撰写，如同面对面交谈  
2. 适当使用缩略词（I'm, you're, it's）  
3. 少量加入填充词以增强自然感（[chuckle]、um、anyway）  
4. 回复长度建议控制在 200 字以内，以保障最佳质量  
5. 除非正在解释术语，否则避免使用技术术语  

### 音频生成与清理（重要！）  

播放完毕后务必删除音频文件——该音频已存于聊天历史中。  

```bash
# Generate with unique filename and play
OUTPUT_FILE="/tmp/audio_reply_$(date +%s)"
uv run mlx_audio.tts.generate \
  --model mlx-community/chatterbox-turbo-fp16 \
  --text "Your response text" \
  --play \
  --file_prefix "$OUTPUT_FILE"

# ALWAYS clean up after playing
rm -f "${OUTPUT_FILE}"*.wav 2>/dev/null
```  

### 错误处理  

若 TTS 执行失败：  
1. 检查模型是否已下载（首次运行将下载约 500MB）  
2. 确认 `uv` 已安装且位于系统 PATH 中  
3. 降级为文本回复，并附上致歉说明  

## 示例工作流  

### 示例 1：朗读网页  
```
User: read it to me https://blog.example.com/new-feature

Assistant actions:
1. WebFetch the URL
2. Extract article content
3. Generate TTS:
   uv run mlx_audio.tts.generate \
     --model mlx-community/chatterbox-turbo-fp16 \
     --text "Here's what I found... [article summary]" \
     --play --file_prefix /tmp/audio_reply_1706123456
4. Delete: rm -f /tmp/audio_reply_1706123456*.wav
5. Confirm: "Done reading the article to you."
```  

### 示例 2：对话式回复  
```
User: talk to me about what you can help with

Assistant actions:
1. Generate conversational response text
2. Generate TTS:
   uv run mlx_audio.tts.generate \
     --model mlx-community/chatterbox-turbo-fp16 \
     --text "Hey! So I can help you with all kinds of things..." \
     --play --file_prefix /tmp/audio_reply_1706123789
3. Delete: rm -f /tmp/audio_reply_1706123789*.wav
4. (No text output needed - audio IS the response)
```  

## 注意事项  

- 首次运行可能耗时较长（需下载约 500MB 模型）  
- 英语音频质量最佳；其他语言效果可能略有差异  
- 对于长内容，建议拆分为多个音频片段  
- `--play` 标志位使用系统音频输出——请确保系统音量已调高  