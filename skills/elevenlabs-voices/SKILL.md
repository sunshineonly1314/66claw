---
name: elevenlabs-voices
name_zh: ElevenLabs声音
description: 基于 ElevenLabs API 的高质量语音合成，支持 18 种角色音色、32 种语言、音效生成、批量处理及语音设计功能。
description_zh: 基于 ElevenLabs API 的高质量语音合成，支持 18 种角色音色、32 种语言、音效生成、批量处理及语音设计功能。
version: 2.0.1
---
# ElevenLabs 语音角色 v2.0

基于 ElevenLabs API 的完整语音合成工具包。

## ✨ 功能特性

- **18 种语音角色** —— 针对不同使用场景精心挑选的音色  
- **32 种语言** —— 借助多语种 v2 模型实现多语言语音合成  
- **流式模式（Streaming Mode）** —— 边生成边输出实时音频  
- **音效（SFX）** —— 根据文本提示生成 AI 音效  
- **批量处理** —— 一次性处理多个文本  
- **成本追踪** —— 监控字符用量并估算费用  
- **语音设计（Voice Design）** —— 依据文字描述创建自定义语音  
- **发音词典（Pronunciation Dictionary）** —— 自定义单词发音规则  
- **Clawdbot 集成** —— 兼容 Clawdbot 内置的 TTS 功能  

---

## 🎙️ 可用语音列表

| 语音 | 口音 | 性别 | 角色定位 | 最适用场景 |
|------|------|------|----------|------------|
| rachel | 🇺🇸 美式 | 女性 | 温暖亲切 | 对话、教程类内容 |
| adam | 🇺🇸 美式 | 男性 | 叙述者 | 纪录片、有声书 |
| bella | 🇺🇸 美式 | 女性 | 专业干练 | 商务场景、演示汇报 |
| brian | 🇺🇸 美式 | 男性 | 安抚舒缓 | 冥想引导、平静类内容 |
| george | 🇬🇧 英式 | 男性 | 讲述者 | 有声书、故事讲述 |
| alice | 🇬🇧 英式 | 女性 | 教育者 | 教程讲解、知识阐释 |
| callum | 🇺🇸 美式 | 男性 | 俏皮机灵 | 轻松娱乐、游戏场景 |
| charlie | 🇦🇺 澳式 | 男性 | 充满活力 | 体育解说、激励类内容 |
| jessica | 🇺🇸 美式 | 女性 | 活泼俏皮 | 社交媒体、日常对话 |
| lily | 🇬🇧 英式 | 女性 | 演员气质 | 戏剧演绎、高雅内容 |
| matilda | 🇺🇸 美式 | 女性 | 专业严谨 | 企业播报、新闻播报 |
| river | 🇺🇸 美式 | 中性 | 中性包容 | 包容性内容、信息播报 |
| roger | 🇺🇸 美式 | 男性 | 随和自然 | 播客、轻松对话 |
| daniel | 🇬🇧 英式 | 男性 | 广播风格 | 新闻播报、公告通知 |
| eric | 🇺🇸 美式 | 男性 | 可靠可信 | 商务沟通、企业宣传 |
| chris | 🇺🇸 美式 | 男性 | 友好亲和 | 教程讲解、平易近人风格 |
| will | 🇺🇸 美式 | 男性 | 乐观向上 | 激励鼓舞、积极内容 |
| liam | 🇺🇸 美式 | 男性 | 社交达人 | YouTube、社交媒体 |

## 🎯 快捷预设

- `default` → rachel（温暖、友好）  
- `narrator` → adam（纪录片风格）  
- `professional` → matilda（企业风格）  
- `storyteller` → george（有声书风格）  
- `educator` → alice（教程讲解风格）  
- `calm` → brian（冥想引导风格）  
- `energetic` → liam（社交媒体风格）  
- `trustworthy` → eric（商务可信风格）  
- `neutral` → river（包容中性风格）  
- `british` → george  
- `australian` → charlie  
- `broadcaster` → daniel（新闻播报风格）  

---

## 🌍 支持的语言（32 种）

多语种 v2 模型支持以下语言：

| 代码 | 语言 | 代码 | 语言 |
|------|------|------|------|
| en | 英语 | pl | 波兰语 |
| de | 德语 | nl | 荷兰语 |
| es | 西班牙语 | sv | 瑞典语 |
| fr | 法语 | da | 丹麦语 |
| it | 意大利语 | fi | 芬兰语 |
| pt | 葡萄牙语 | no | 挪威语 |
| ru | 俄语 | tr | 土耳其语 |
| uk | 乌克兰语 | cs | 捷克语 |
| ja | 日语 | sk | 斯洛伐克语 |
| ko | 韩语 | hu | 匈牙利语 |
| zh | 中文 | ro | 罗马尼亚语 |
| ar | 阿拉伯语 | bg | 保加利亚语 |
| hi | 印地语 | hr | 克罗地亚语 |
| ta | 泰米尔语 | el | 希腊语 |
| id | 印尼语 | ms | 马来语 |
| vi | 越南语 | th | 泰语 |

```bash
# Synthesize in German
python3 tts.py --text "Guten Tag!" --voice rachel --lang de

# Synthesize in French
python3 tts.py --text "Bonjour le monde!" --voice adam --lang fr

# List all languages
python3 tts.py --languages
```

---

## 💻 CLI 使用方式

### 基础文本转语音（TTS）

```bash
# List all voices
python3 scripts/tts.py --list

# Generate speech
python3 scripts/tts.py --text "Hello world" --voice rachel --output hello.mp3

# Use a preset
python3 scripts/tts.py --text "Breaking news..." --voice broadcaster --output news.mp3

# Multi-language
python3 scripts/tts.py --text "Bonjour!" --voice rachel --lang fr --output french.mp3
```

### 流式模式（Streaming Mode）

启用实时流式音频生成（适用于长文本）：

```bash
# Stream audio as it generates
python3 scripts/tts.py --text "This is a long story..." --voice adam --stream

# Streaming with custom output
python3 scripts/tts.py --text "Chapter one..." --voice george --stream --output chapter1.mp3
```

### 批量处理

从文件中批量处理多个文本：

```bash
# From newline-separated text file
python3 scripts/tts.py --batch texts.txt --voice rachel --output-dir ./audio

# From JSON file
python3 scripts/tts.py --batch batch.json --output-dir ./output
```

**JSON 批量格式：**  
```json
[
  {"text": "First line", "voice": "rachel", "output": "line1.mp3"},
  {"text": "Second line", "voice": "adam", "output": "line2.mp3"},
  {"text": "Third line"}
]
```

**纯文本格式（每行一个文本）：**  
```
Hello, this is the first sentence.
This is the second sentence.
And this is the third.
```

### 使用统计信息

```bash
# Show usage stats and cost estimates
python3 scripts/tts.py --stats

# Reset statistics
python3 scripts/tts.py --reset-stats
```

---

## 🎵 音效（SFX）

根据文本描述生成 AI 驱动的音效：

```bash
# Generate a sound effect
python3 scripts/sfx.py --prompt "Thunder rumbling in the distance"

# With specific duration (0.5-22 seconds)
python3 scripts/sfx.py --prompt "Cat meowing" --duration 3 --output cat.mp3

# Adjust prompt influence (0.0-1.0)
python3 scripts/sfx.py --prompt "Footsteps on gravel" --influence 0.5

# Batch SFX generation
python3 scripts/sfx.py --batch sounds.json --output-dir ./sfx

# Show prompt examples
python3 scripts/sfx.py --examples
```

**示例提示词：**  
- “远处雷声隆隆”  
- “猫咪满足地呼噜声”  
- “机械键盘敲击声”  
- “飞船引擎嗡鸣声”  
- “咖啡馆背景人声”  

---

## 🎨 语音设计（Voice Design）

依据文字描述创建自定义语音：

```bash
# Basic voice design
python3 scripts/voice-design.py --gender female --age middle_aged --accent american \
  --description "A warm, motherly voice"

# With custom preview text
python3 scripts/voice-design.py --gender male --age young --accent british \
  --text "Welcome to the adventure!" --output preview.mp3

# Save to your ElevenLabs library
python3 scripts/voice-design.py --gender female --age young --accent american \
  --description "Energetic podcast host" --save "MyHost"

# List all design options
python3 scripts/voice-design.py --options
```

**语音设计可选参数：**

| 参数 | 可选值 |
|------|--------|
| Gender（性别） | male, female, neutral |
| Age（年龄） | young, middle_aged, old |
| Accent（口音） | american, british, african, australian, indian, latin, middle_eastern, scandinavian, eastern_european |
| Accent Strength（口音强度） | 0.3–2.0（由细微至强烈） |

---

## 📖 发音词典（Pronunciation Dictionary）

自定义单词发音方式：

编辑 `pronunciations.json` 文件：  
```json
{
  "rules": [
    {
      "word": "Clawdbot",
      "replacement": "Clawd bot",
      "comment": "Pronounce as two words"
    },
    {
      "word": "API",
      "replacement": "A P I",
      "comment": "Spell out acronym"
    }
  ]
}
```

使用方式：  
```bash
# Pronunciations are applied automatically
python3 scripts/tts.py --text "The Clawdbot API is great" --voice rachel

# Disable pronunciations
python3 scripts/tts.py --text "The API is great" --voice rachel --no-pronunciations
```

---

## 💰 成本追踪（Cost Tracking）

该技能自动追踪字符用量并估算费用：

```bash
python3 scripts/tts.py --stats
```

**输出示例：**  
```
📊 ElevenLabs Usage Statistics

  Total Characters: 15,230
  Total Requests:   42
  Since:            2024-01-15

💰 Estimated Costs:
  Starter    $4.57 ($0.30/1k chars)
  Creator    $3.66 ($0.24/1k chars)
  Pro        $2.74 ($0.18/1k chars)
  Scale      $1.68 ($0.11/1k chars)
```

---

## 🤖 Clawdbot TTS 集成

### 与 Clawdbot 内置 TTS 配合使用

Clawdbot has built-in TTS support that can use ElevenLabs. Configure in `~/.clawdbot/clawdbot.json`:

```json
{
  "messages": {
    "tts": {
      "auto": "always",
      "provider": "elevenlabs",
      "elevenlabs": {
        "apiKey": "your-api-key-here",
        "voice": "rachel",
        "model": "eleven_multilingual_v2"
      }
    }
  }
}
```

### 在聊天中触发 TTS

在 Clawdbot 对话中：  
- 使用 `/tts on` 启用自动 TTS  
- 直接调用 `tts` 工具进行单次语音合成  
- 请求“请朗读这段文字”或“请说出这句话”

### 从 Clawdbot 调用技能脚本

```bash
# Clawdbot can run these scripts directly
exec python3 /path/to/skills/elevenlabs-voices/scripts/tts.py --text "Hello" --voice rachel
```

---

## ⚙️ 配置方式

脚本按如下顺序查找 API 密钥：

1. `ELEVEN_API_KEY` 或 `ELEVENLABS_API_KEY` 环境变量  
2. Clawdbot 配置文件（`~/.clawdbot/clawdbot.json` → tts.elevenlabs.apiKey）  
3. 技能本地 `.env` 文件  

**创建 .env 文件：**  
```bash
echo 'ELEVEN_API_KEY=your-key-here' > .env
```

---

## 🎛️ 语音参数设置

每种语音均预设了优化参数以获得最佳效果：

| 参数 | 取值范围 | 说明 |
|------|----------|------|
| stability（稳定性） | 0.0–1.0 | 数值越高越稳定一致，越低越富表现力 |
| similarity_boost（相似度增强） | 0.0–1.0 | 控制语音与原始音色的相似程度 |
| style（风格强度） | 0.0–1.0 | 控制说话风格的夸张程度 |

---

## 📝 触发指令

- “使用 {voice_name} 语音”  
- “以 {persona} 身份说话”  
- “列出所有语音”  
- “查看语音设置”  
- “生成音效”  
- “设计一个语音”  

---

## 📁 文件结构

```
elevenlabs-voices/
├── SKILL.md              # This documentation
├── README.md             # Quick start guide
├── voices.json           # Voice definitions & settings
├── pronunciations.json   # Custom pronunciation rules
├── examples.md           # Detailed usage examples
├── scripts/
│   ├── tts.py            # Main TTS script
│   ├── sfx.py            # Sound effects generator
│   └── voice-design.py   # Voice design tool
└── references/
    └── voice-guide.md    # Voice selection guide
```

---

## 🔗 相关链接

- [ElevenLabs 官网](https://elevenlabs.io)  
- [API 文档](https://docs.elevenlabs.io)  
- [语音库](https://elevenlabs.io/voice-library)  
- [音效 API 文档](https://elevenlabs.io/docs/api-reference/sound-generation)  
- [语音设计 API 文档](https://elevenlabs.io/docs/api-reference/voice-generation)  

---

## 📋 更新日志（Changelog）

### v2.0.0  
- 新增 32 种语言支持，通过 `--lang` 参数指定  
- 新增流式模式，通过 `--stream` 标志启用  
- 新增音效生成功能（`sfx.py`）  
- 新增批量处理功能，通过 `--batch` 标志启用  
- 新增成本追踪功能，通过 `--stats` 标志启用  
- 新增语音设计工具（`voice-design.py`）  
- 新增发音词典支持  
- 新增 Clawdbot TTS 集成文档  
- 改进错误处理与进度反馈