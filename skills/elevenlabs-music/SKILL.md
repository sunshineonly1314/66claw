---
name: elevenlabs-music
name_zh: ElevenLabs音乐
description: 使用 ElevenLabs Eleven Music API，基于文本提示生成音乐。适用于根据描述创作歌曲、配乐、广告歌、摇篮曲或任何音频音乐。支持带 AI 生成歌词及人声演唱、纯器乐曲目，以及多种流派/风格。需订阅付费版 ElevenLabs 计划。
description_zh: 使用 ElevenLabs Eleven Music API，基于文本提示生成音乐。适用于根据描述创作歌曲、配乐、广告歌、摇篮曲或任何音频音乐。支持带 AI 生成歌词及人声演唱、纯器乐曲目，以及多种流派/风格。需订阅付费版 ElevenLabs 计划。
metadata: {"clawdbot":{"emoji":"🎵","requires":{"bins":["uv"],"env":["ELEVENLABS_API_KEY"]},"primaryEnv":"ELEVENLABS_API_KEY"}}
---
# ElevenLabs 音乐生成

基于文本提示，利用 AI 生成完整歌曲，含自动生成歌词与人声演唱。

## 快速入门

```bash
# Basic generation (30 seconds)
uv run {baseDir}/scripts/generate_music.py "upbeat jazz piano"

# Longer track (3 minutes)
uv run {baseDir}/scripts/generate_music.py "epic orchestral battle music" --length 180

# Instrumental only (no vocals)
uv run {baseDir}/scripts/generate_music.py "lo-fi hip hop beats" --length 120 --instrumental

# Custom output path
uv run {baseDir}/scripts/generate_music.py "romantic bossa nova" -o /tmp/bossa.mp3
```

## 可选参数

| 参数 | 说明 |
|------|-------------|
| `-l, --length` | 时长（单位：秒），取值范围 3–600，默认为 30 |
| `-o, --output` | 输出文件路径，默认为 /tmp/music.mp3 |
| `-i, --instrumental` | 强制纯器乐模式（禁用人声） |

## 提示词（Prompt）工程技巧

### 明确风格特征
- 包含流派、情绪、速度与乐器类型
- 引用年代或时期：“90 年代巴西浪漫 pagode 风格”、“1960 年代科幻电视剧主题曲”
- 描述能量变化：“由轻柔渐强至爆发”、“舒缓而私密”

### 人声相关提示
- 指定语言：“葡萄牙语人声”、“日语演唱”
- 描述人声风格：“灵魂感十足的男声”、“空灵的女声合唱”
- 包含歌词主题：“关于爱与乡愁（saudade）”、“颂扬友谊”

### 规避版权风险
- 不得直接提及艺人/乐队名称
- 改用风格描述替代：“经典 90 年代浪漫桑巴风格”，而非“类似 Raça Negra”
- 若请求被拒绝，API 将返回建议的替代提示词

### 示例提示词

**MPB（巴西流行音乐）**
```
A soulful MPB track featuring gentle acoustic guitar, warm nylon strings, 
and dreamy Rhodes piano. Bossa nova-influenced rhythm with soft brushed 
drums. Vocals in Portuguese express themes of saudade and the beauty of life.
```

**史诗管弦乐**
```
Epic military march with powerful brass fanfares, thundering timpani drums, 
and a soaring choir. Triumphant and heroic, with deep bass tubas, bold 
trumpets, snare rolls, and an anthemic melody building to a glorious crescendo.
```

**摇篮曲**
```
Gentle orchestral lullaby with sweeping strings, soft brass, and ethereal 
wordless soprano vocals. Peaceful yet majestic, evoking wonder and hope. 
Perfect for falling asleep while dreaming of adventures.
```

**喜剧摇滚**
```
Brazilian comedy rock with absurd, hilarious Portuguese lyrics full of 
wordplay. Mix energetic rock guitars with unexpected rhythms - forró 
breakdowns, pagode moments. Theatrical, exaggerated vocals singing about 
ridiculous situations.
```

## 必要条件

- **ElevenLabs API 密钥**：设置环境变量 `ELEVENLABS_API_KEY`
- **付费计划**：音乐 API 需 Creator 计划或更高级别
- **uv**：用于运行带依赖项的 Python 脚本

## 支持功能

- 文本转音乐，最长支持 10 分钟
- 多语言 AI 生成歌词与人声（英语、西班牙语、葡萄牙语、德语、日语等）
- 纯器乐模式
- 覆盖绝大多数音乐流派与风格