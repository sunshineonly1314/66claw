---
name: edge-tts
name_zh: Edge TTS
description: |
description_zh: |
  使用 node-edge-tts npm 包实现文本转语音（TTS），支持多语音、多语言、语速调节、音高控制及字幕生成。
  适用场景：（1）用户通过 “tts” 触发词或关键词请求音频/语音输出；（2）内容需以语音形式呈现而非阅读（例如多任务处理、无障碍访问、驾驶、烹饪等场景）；（3）用户对 TTS 输出有特定语音、语速、音高或格式要求。
---
# Edge-TTS 技能

## 概述

通过 node-edge-tts npm 包，调用 Microsoft Edge 的神经网络 TTS 服务，生成高质量语音音频。支持多种语言与语音、可调语速/音高，以及字幕生成功能。

## 快速入门

当检测到由触发词或用户请求产生的 TTS 意图时：

1. **调用 tts 工具**（Clawdbot 内置）将文本转为语音  
2. 工具返回一个 MEDIA: 路径  
3. Clawdbot 将音频路由至当前频道  

```javascript
// Example: Built-in tts tool usage
tts("Your text to convert to speech")
// Returns: MEDIA: /path/to/audio.mp3
```

## 触发词识别

将 “tts” 关键词识别为 TTS 请求。该技能会在转换前自动过滤掉文本中与 TTS 相关的关键词，避免将触发词本身也转为语音。

## 高级自定义

### 使用 Node.js 脚本

如需更精细控制，可直接调用随附脚本：

#### TTS 转换器
```bash
cd scripts
npm install
node tts-converter.js "Your text" --voice en-US-AriaNeural --rate +10% --output output.mp3
```

**选项：**  
- `--voice, -v`：语音名称（默认：en-US-AriaNeural）  
- `--lang, -l`：语言代码（例如 en-US、es-ES）  
- `--format, -o`：输出格式（默认：audio-24khz-48kbitrate-mono-mp3）  
- `--pitch`：音高调整（例如 +10%、-20%、default）  
- `--rate, -r`：语速调整（例如 +10%、-20%、default）  
- `--volume`：音量调整（例如 +0%、-10%、default）  
- `--save-subtitles, -s`：将字幕保存为 JSON 文件  
- `--output, -f`：输出文件路径（默认：tts_output.mp3）  
- `--proxy, -p`：代理 URL（例如 http://localhost:7890）  
- `--timeout`：请求超时（毫秒，默认：10000）  
- `--list-voices, -L`：列出所有可用语音  

#### 配置管理器
```bash
cd scripts
npm install
node config-manager.js --set-voice en-US-AriaNeural

node config-manager.js --set-rate +10%

node config-manager.js --get

node config-manager.js --reset
```

### 语音选择

常用语音（使用 `--list-voices` 查看完整列表）：

**英语：**  
- `en-US-MichelleNeural`（女性，自然语音，**默认**）  
- `en-US-AriaNeural`（女性，自然语音）  
- `en-US-GuyNeural`（男性，自然语音）  
- `en-GB-SoniaNeural`（女性，英式英语）  
- `en-GB-RyanNeural`（男性，英式英语）  

**其他语言：**  
- `es-ES-ElviraNeural`（西班牙语，西班牙）  
- `fr-FR-DeniseNeural`（法语）  
- `de-DE-KatjaNeural`（德语）  
- `ja-JP-NanamiNeural`（日语）  
- `zh-CN-XiaoxiaoNeural`（中文）  
- `ar-SA-ZariyahNeural`（阿拉伯语）  

### 语速指南

语速值采用百分比格式：  
- `"default"`：正常语速  
- `"-20%"` 至 `"-10%"`：缓慢清晰（教程、故事、无障碍场景）  
- `"+10%"` 至 `"+20%"`：略快（摘要）  
- `"+30%"` 至 `"+50%"`：快速（新闻、效率优先）  

### 输出格式

根据使用场景选择音频质量：  
- `audio-24khz-48kbitrate-mono-mp3`：标准质量（语音备忘录、消息）  
- `audio-24khz-96kbitrate-mono-mp3`：高质量（演示文稿、内容）  
- `audio-48khz-96kbitrate-stereo-mp3`：最高质量（专业音频、音乐）  

## 资源

### scripts/tts-converter.js  
主 TTS 转换脚本，基于 node-edge-tts。支持自定义语音、语速、音量、音高与格式，并支持字幕生成及语音列表功能。

### scripts/config-manager.js  
管理 TTS 设置（语音、语言、格式、音高、语速、音量）的持久化用户偏好。配置存储于 `~/.tts-config.json`。

### scripts/package.json  
NPM package configuration with node-edge-tts dependency.

### references/node_edge_tts_guide.md  
node-edge-tts npm 包的完整文档，涵盖：  
- 按语言分类的完整语音列表  
- 语调选项（语速、音高、音量）  
- 使用示例（CLI 与模块化方式）  
- 字幕生成  
- 输出格式  
- 最佳实践与局限性  

### 语音测试  
在以下网址测试不同语音并预览音质：https://tts.travisvn.com/  
当需要特定语音细节或高级功能时，请参考此文档。

## 安装

如需使用随附脚本：

```bash
cd /home/user/clawd/skills/public/tts-skill/scripts
npm install
```

该命令将安装：  
- `node-edge-tts` — TTS 库  
- `commander` — CLI 参数解析库  

## 工作流

1. **检测意图**：检查用户消息中是否包含 “tts” 触发词或关键词  
2. **选择方法**：对简单请求使用内置 `tts` 工具；对定制化需求使用 `scripts/tts-converter.js`  
3. **生成音频**：将目标文本（消息、搜索结果、摘要等）转换为语音  
4. **返回用户**：tts 工具返回 MEDIA: 路径；Clawdbot 负责投递  

## 测试

### 基础测试  
运行测试脚本验证 TTS 功能：  
```bash
cd /home/user/clawd/skills/public/edge-tts/scripts
npm test
```  
该命令将生成测试音频文件，并验证 TTS 服务是否正常运行。

### 语音测试  
在以下网址测试不同语音并预览音质：https://tts.travisvn.com/

### 集成测试  
使用内置 `tts` 工具进行快速测试：  
```javascript
// Example: Test TTS with default settings
tts("This is a test of the TTS functionality.")
```

### 配置测试  
验证配置持久化是否生效：  
```bash
cd /home/user/clawd/skills/public/edge-tts/scripts
node config-manager.js --get
node config-manager.js --set-voice en-US-GuyNeural
node config-manager.js --get
```

## 故障排查

- **测试连通性**：运行 `npm test` 检查 TTS 服务是否可达  
- **检查语音可用性**：使用 `node tts-converter.js --list-voices` 查看可用语音列表  
- **验证代理设置**：若使用代理，请用 `node tts-converter.js "test" --proxy http://localhost:7890` 进行测试  
- **检查音频输出**：测试应于 scripts 目录下生成 `test-output.mp3`  

## 注意事项

- node-edge-tts 使用 Microsoft Edge 在线 TTS 服务（已更新且认证机制正常）  
- 无需 API 密钥（免费服务）  
- 默认输出格式为 MP3  
- 需要联网  
- 支持字幕生成（JSON 格式，含词级时间戳）  
- **临时文件处理**：默认情况下，音频文件保存至系统临时目录（Unix 下为 `/tmp/edge-tts-temp/`，Windows 下为 `C:\Users\<user>\AppData\Local\Temp\edge-tts-temp\`），并使用唯一文件名（例如 `tts_1234567890_abc123.mp3`）。文件不会自动删除——调用方（Clawdbot）应在使用后负责清理。如需永久存储，可通过 `--output` 选项指定自定义输出路径。  
- **TTS 关键词过滤**：该技能会自动从待转换文本中过滤掉 TTS 相关关键词（如 tts、TTS、text-to-speech），防止触发词被转为语音  
- 对于重复使用的偏好设置，可使用 `config-manager.js` 设定默认值  
- **默认语音**：`en-US-MichelleNeural`（女性，自然语音）  
- 神经语音（Neural voices，以 `Neural` 结尾）质量高于标准语音（Standard voices）  