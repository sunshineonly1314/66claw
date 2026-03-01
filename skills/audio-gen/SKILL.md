---
name: audio-gen
name_zh: 音频生成
description: 按需生成有声书、播客或教育类音频内容。用户提出创意或主题，Claude AI 撰写脚本，ElevenLabs 将其转换为高品质音频。支持多种格式（有声书、播客、教育类）、自定义时长及语音效果。当用户要求创建音频内容、制作播客、生成有声书或制作教育类音频时使用。通过 MEDIA 令牌返回 MP3 音频文件。
description_zh: 按需生成有声书、播客或教育类音频内容。用户提出创意或主题，Claude AI 撰写脚本，ElevenLabs 将其转换为高品质音频。支持多种格式（有声书、播客、教育类）、自定义时长及语音效果。当用户要求创建音频内容、制作播客、生成有声书或制作教育类音频时使用。通过 MEDIA 令牌返回 MP3 音频文件。
homepage: https://github.com/clawdbot/clawdbot
metadata: {"clawdbot":{"emoji":"🎙️","requires":{"skills":["sag"],"env":["ANTHROPIC_API_KEY","ELEVENLABS_API_KEY"]},"primaryEnv":"ANTHROPIC_API_KEY"}}
---
# 🎙️ 音频内容生成器

利用 AI 编写的脚本与 ElevenLabs 文字转语音（TTS）技术，按需生成高品质有声书、播客或教育类音频内容。

## 快速入门

**创建一章有声书：**  
```
User: "Create a 5-minute audiobook chapter about a dragon discovering friendship"
```

**生成一期播客：**  
```
User: "Make a 10-minute podcast about the history of coffee"
```

**制作教育类内容：**  
```
User: "Generate a 15-minute educational audio explaining how neural networks work"
```

## 内容格式

### 有声书  
**风格：** 具有情感深度的叙事性讲述  
- 清晰的起承转合（开头、中段、结尾）  
- 描述性语言与生动意象  
- 富有戏剧张力的节奏，辅以深思熟虑的停顿  
- 情感基调与故事内容相匹配  
- 恰当使用语音效果 `[whispers]`、`[excited]`、`[serious]` 增强表现力  

**示例结构：**  
```
[Opening hook - set the scene]
[long pause]

[Story development with character emotions]
[short pause] between sentences
[long pause] between paragraphs

[Climax with dramatic tension]
[long pause]

[Resolution and emotional closure]
```

### 播客  
**风格：** 对话式、引人入胜  
- 温暖亲切的开场（15–30 秒）  
- 主体内容自然流畅  
- 各话题间过渡自然  
- 印象深刻的收尾，提炼关键要点  
- 全程保持对话式语调  

**示例结构：**  
```
**Intro:** "Welcome to [topic]. I'm excited to share..."
[short pause]

**Main Content:** "Let's start with... [topic 1]"
[long pause] between segments

**Outro:** "Thanks for listening! Remember..."
```

### 教育类内容  
**风格：** 清晰易懂的教学讲解  
- 用简明方式引入复杂主题  
- 分步骤拆解说明  
- 结合现实案例与类比  
- 结尾总结核心概念  
- 以热情饱满的语调呈现，并对重点内容使用 `[excited]` 强调  

**示例结构：**  
```
**Introduction:** What is [topic] and why it matters?

**Main Content:**
- Concept 1: Explanation + Example
- Concept 2: Explanation + Example
- Concept 3: Explanation + Example

**Summary:** Key takeaways and next steps
```

## 时长指南

**字数与持续时间换算：**  
- 5 分钟 ≈ 375 字  
- 10 分钟 ≈ 750 字  
- 15 分钟 ≈ 1,125 字  
- 20 分钟 ≈ 1,500 字  
- 30 分钟 ≈ 2,250 字  

**语速基准：** 平均口语语速约为每分钟 75 字  

**实际限制：**  
- 最短时长：2 分钟（≈150 字）  
- 最长时长：30 分钟（≈2,250 字）  
- 黄金时长：5–15 分钟（最佳用户参与度）

## 工作流说明

### 第一步：理解用户请求  

解析用户请求，明确以下要素：  
1. **内容类型**（有声书 / 播客 / 教育类，或由主题推断）  
2. **主题/主旨**（内容应围绕什么展开）  
3. **目标时长**（多少分钟）  
4. **语气/风格**（戏剧化、随意、教育向等）  
5. **特殊要求**（指定声音、强调特定内容等）

### 第二步：计算字数  

```
target_words = target_minutes × 75
```  

示例：10 分钟 = 10 × 75 = 750 字  

### 第三步：生成脚本  

严格遵循以下规则撰写完整脚本：  

**内容规范：**  
- 开篇即设引人入胜的“钩子”（hook）  
- 保持自然、对话式的行文节奏  
- 使用主动语态与简洁句式  
- 融入相关实例与故事  
- 结尾提供圆满收束  

**格式规范：**  
- 在句末添加 `[short pause]`（慎用，勿每句都加）  
- 在段落或主要章节之间添加 `[long pause]`  
- 策略性使用语音效果：`[whispers]`、`[shouts]`、`[excited]`、`[serious]`、`[sarcastic]`、`[sings]`、`[laughs]`  
- 数字一律拼写为单词形式（如 “twenty-three”，而非 “23”）  
- 首次出现缩略词时须全称+括号标注（如 “AI，或 artificial intelligence”）  
- 避免复杂标点（破折号可用，但分号不利于语音朗读）  
- TTS 转换前须清除所有 Markdown 格式  

### 第四步：呈现脚本  

向用户展示脚本，并询问：  
```
Here's the [format] script I've created (approximately [length] minutes):

[Display the script]

Would you like me to:
1. Generate the audio now
2. Make changes to the script
3. Adjust the length or tone
```  

### 第五步：处理用户反馈  

若用户提出修改要求：  
- 按调整意见重新生成脚本  
- 严守目标字数  
- 提交修订后版本  

若用户确认无误：  
- 进入音频生成环节  

### 第六步：生成音频  

**为 TTS 准备脚本：**  
1. 清除所有残留 Markdown（标题、粗体、斜体等）  
2. 确保语音效果采用标准 `[effect]` 格式  
3. 检查停顿位置是否恰当  
4. 核实数字与缩略词均已正确拼出  

**调用 TTS 脚本：**  

**重要提示：** `ELEVENLABS_API_KEY` 环境变量已在系统中预配置，可直接调用 TTS 脚本。  

```bash
uv run /home/clawdbot/clawdbot/skills/sag/scripts/tts.py \
  -o /tmp/audio-gen-[timestamp]-[topic-slug].mp3 \
  -m eleven_multilingual_v2 \
  "[formatted_script]"
```  

**对于长脚本，请使用 here-document（heredoc）语法：**  
```bash
uv run /home/clawdbot/clawdbot/skills/sag/scripts/tts.py \
  -o /tmp/audio-gen-[timestamp]-[topic-slug].mp3 \
  -m eleven_multilingual_v2 \
  "$(cat <<'EOF'
[formatted_script]
EOF
)"
```  

**返回结果：**  
```
MEDIA:/tmp/audio-gen-[timestamp]-[topic-slug].mp3

Your [format] is ready! [Brief description of content]. Duration: approximately [X] minutes.
```  

## 语音效果（SSML 标签）

可用的语音调节效果（请慎用，仅在关键处增强表现力）：  

- `[whispers]` —— 轻柔、私密式表达  
- `[shouts]` —— 响亮、强调式表达  
- `[excited]` —— 热情洋溢、充满活力的语调  
- `[serious]` —— 庄重肃穆的语调  
- `[sarcastic]` —— 讽刺、戏谑的语调  
- `[sings]` —— 音乐性、旋律化的表达  
- `[laughs]` —— 愉悦诙谐的语调  
- `[short pause]` —— 短暂停顿（约 0.5 秒）  
- `[long pause]` —— 延长停顿（约 1–2 秒）  

**最佳实践：**  
- 仅在情绪高潮处使用效果，切忌滥用  
- 停顿是控制节奏最有力的工具  
- 语音效果在有声书与戏剧化内容中最有效  
- 播客与教育类内容宜保持自然本色  

## 错误处理  

### 脚本过长  
若生成脚本超出目标字数 20% 以上：  
```
The script I generated is [X] words ([Y] minutes), which is longer than your target of [Z] minutes. Would you like me to:
1. Condense it to fit the target length
2. Split it into multiple parts
3. Keep it as is
```  

### 脚本过短  
若生成脚本低于目标字数 20% 以上：  
```
The script is [X] words ([Y] minutes), shorter than your target. Would you like me to:
1. Expand it with more detail
2. Add additional examples or stories
3. Generate as is
```  

### TTS 生成失败  
若 TTS 脚本执行失败：  
```
I've created the script, but I'm unable to generate the audio right now. Here's your script:

[Display script]

Error: [specific error message]

You can:
1. Check that ELEVENLABS_API_KEY is configured
2. Use the script with your own text-to-speech tool
3. Try again in a moment
4. Ask me to troubleshoot the audio generation
```  

**常见 TTS 问题：**  
- API 密钥未设置：请核查配置中是否已设定 ELEVENLABS_API_KEY  
- 触达速率限制：稍候片刻后重试  
- 文本过长：拆分为更小片段（单次最多约 5000 字符）  

### 请求无效  
针对不切实际的请求（例如：“生成 100 小时的有声书”）：  
```
That length would require [X] words and take significant time to generate. I recommend:
- Breaking it into multiple episodes/chapters
- Targeting 5-30 minutes per audio file
- Creating a series instead of one long file
```  

## 提升效果的实用建议  

### 制作引人入胜的有声书  
- 聚焦人物情感与感官细节  
- 借助停顿营造戏剧张力  
- 变换句长以增强韵律感  
- 加入内心独白与反思性内容  

### 制作扣人心弦的播客  
- 以提问或惊人事实开篇  
- 使用口语化表达，如：“你猜怎么着……”  
- 引入日常生活中易产生共鸣的实例  
- 收尾提供可操作的关键要点  

### 制作高效能的教育类内容  
- 采用“像给五岁孩子解释一样”的思路  
- 从简单概念逐步递进至复杂内容  
- 重复关键术语与定义  
- 提供多个示例以确保清晰易懂  

## 技术说明  

**TTS 实现方式：**  
- 使用 Python 脚本：`~/.clawdbot/clawdbot/skills/sag/scripts/tts.py`  
- 无需二进制安装（纯 Python + requests）  
- 直接调用 ElevenLabs API  
- 兼容 Linux 与 macOS  

**文件存储：**  
- 音频文件保存至 `/tmp/audio-gen/`  
- 文件命名格式：`audio-gen-[timestamp]-[topic-slug].mp3`  
- 文件将在 24 小时后自动清理  

**API 依赖：**  
- Anthropic API（用于脚本生成，已预配置）  
- ElevenLabs API（用于文字转语音，通过 ELEVENLABS_API_KEY 配置）  
- 两项服务均须完成配置且账户余额充足  

**支持的模型：**  
- `eleven_multilingual_v2` —— 最佳音质（默认）  
- `eleven_turbo_v2` —— 生成速度更快  
- `eleven_turbo_v2_5` —— 生成速度最快  
- `eleven_multilingual_v1` —— 旧版模型  

**成本估算：**  
- 10 分钟音频（≈750 字）：约 $1.43  
  - Claude API：≈$0.075  
  - ElevenLabs：≈$1.35  
- 更长内容按比例线性增长  

**生成耗时：**  
- 脚本生成：5–30 秒（依长度而异）  
- 音频生成：5–15 秒（ElevenLabs 处理时间）  
- 总耗时：10 分钟音频通常少于 1 分钟  

## 局限性  

1. **最长时长限制：** 单个音频文件上限为 30 分钟（≈2,250 字）  
   - 如需更长内容，请拆分为多部分/多集  

2. **单一声道：** 当前仅支持一位叙述者声音  
   - 不支持多角色对话或角色专属配音  

3. **无背景音乐：** 仅为纯人声朗读  
   - 不含背景音乐、音效或音频混音功能  

4. **实时生成：** 每次请求均生成全新内容  
   - 不使用预设模板，亦不缓存音频  

5. **语言支持：** 主要面向英语  
   - ElevenLabs 支持其他语言，但内容生成流程专为英语优化  

## 示例对话  

### 示例 1：快速生成有声书  
```
User: Create a 5-minute audiobook chapter about a lonely robot learning to feel emotions

Agent: I'll create a 5-minute sci-fi audiobook chapter. Let me write the story...

[Generates ~400-word narrative with emotional arc]

Here's the story I've created about Unit-7, a maintenance robot who discovers the meaning of friendship through an unexpected encounter. Would you like me to generate the audio or make changes first?

User: Generate the audio

Agent: [Invokes SAG with formatted script]

MEDIA:/tmp/audio-gen-1234567890-lonely-robot.mp3

Your audiobook chapter is ready! The story follows Unit-7's emotional awakening through a touching encounter with a young engineer. Duration: approximately 5 minutes.
```  

### 示例 2：带修订的播客  
```
User: Make a 10-minute podcast about sustainable living tips

Agent: [Generates podcast script with intro, 5 practical tips, outro]

Here's a 10-minute podcast with 5 actionable sustainable living tips. The tone is encouraging and practical. Would you like me to:
1. Generate audio now
2. Make it more urgent/climate-focused
3. Add more specific examples
4. Adjust the length

User: Add more specific examples for each tip

Agent: [Regenerates with detailed examples]

Better? I've added specific examples like calculating your carbon footprint, composting at home, and choosing sustainable brands. Ready for audio?

User: Perfect!

Agent: MEDIA:/tmp/audio-gen-1234567890-sustainable-living.mp3

Your sustainable living podcast is ready with 5 practical tips, each with concrete examples you can start using today! Duration: 10 minutes.
```  

### 示例 3：教育类内容  
```
User: Create a 15-minute educational audio explaining quantum computing for beginners

Agent: I'll create a beginner-friendly 15-minute explanation of quantum computing...

[Generates ~1,100 words with analogies, examples, and clear structure]

Script preview:
- Introduction: What is quantum computing? (2 min)
- Classical vs Quantum: The key differences (4 min)
- Qubits and Superposition: How it works (5 min)
- Real Applications: What it means for you (3 min)
- Conclusion: The future of computing (1 min)

Should I generate the audio?

User: Yes please

Agent: MEDIA:/tmp/audio-gen-1234567890-quantum-computing.mp3

Your educational podcast on quantum computing is ready! It uses everyday analogies to explain qubits, superposition, and real-world applications. Duration: approximately 15 minutes.
```  

## 何时使用本 skill  

当用户提出以下请求时，请启用 audio-gen skill：  
- “创建一本关于……的有声书”  
- “制作一期关于……的播客节目”  
- “生成一段讲解……的音频内容”  
- “录制一个关于……的故事”  
- “制作一份关于……的音频指南”  
- “创建……的配音版本”  
- “制作一段关于……的音频课程”  

**请勿用于：**  
- 转录已有音频（请改用 whisper skills）  
- 将用户自行撰写的文本转为音频（请直接调用 SAG skill）  
- 实时语音交互（请使用 voice-call 插件）  
- 多人对话或访谈（当前能力所限）  

## 高级用法  

### 声音选择  
用户可指定特定声音：  
```
User: Create a podcast with the Rachel voice

Agent: [Checks voice configuration for "Rachel" voice ID and uses it in SAG command]
```  

### 系列/分集  
针对多部分连续内容：  
```
User: Create a 3-episode series about space exploration

Agent: I'll create Episode 1 first. Each episode will be 10 minutes. Let's start with "The Dawn of the Space Age"...

[After completion]

Episode 1 is ready! Would you like me to continue with Episode 2?
```  

### 格式融合  
混合不同格式以打造独特风格：  
```
User: Create an educational podcast that tells a story

Agent: [Generates content that combines storytelling narrative with educational explanations]
```  

## 故障排查  

**问题：** 音频听感机械或不自然  
**解决方案：** 增加停顿与语音效果；多用缩略形式（如 “it’s”）及口语化表达  

**问题：** 脚本长度与用户要求不符  
**解决方案：** 明确指定字数目标后重新生成；复核计算（75 字/分钟）  

**问题：** 内容过于艰深或过于浅显  
**解决方案：** 向用户确认目标受众；据此调整内容复杂度  

**问题：** SAG 命令执行失败  
**解决方案：** 检查 ELEVENLABS_API_KEY 是否已设置；确认 SAG skill 已正确安装并正常运行  

**问题：** 用户希望手动编辑脚本  
**解决方案：** 提供纯文本脚本；用户可自行修改后粘贴回系统以生成音频  

---

💡 **专业提示：** 务必先生成脚本并获得用户确认，再执行音频生成。此举可节省时间与 API 成本，并确保最终交付完全符合用户预期。