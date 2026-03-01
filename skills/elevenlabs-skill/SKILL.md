---
name: elevenlabs
name_zh: ElevenLabs技能
description: 通过 ElevenLabs API 实现文本转语音、音效生成、音乐生成、语音管理及配额检查。适用于使用 ElevenLabs 生成音频或管理语音的场景。
description_zh: 通过 ElevenLabs API 实现文本转语音、音效生成、音乐生成、语音管理及配额检查。适用于使用 ElevenLabs 生成音频或管理语音的场景。
metadata: {"clawdbot":{"requires":{"bins":["python3"],"env":["ELEVENLABS_API_KEY"]},"primaryEnv":"ELEVENLABS_API_KEY"}}
---
# ElevenLabs Skill

与 ElevenLabs API 交互的核心工具集，支持声音生成、音乐创作与语音管理。

## 安装配置

需在环境中设置 `ELEVENLABS_API_KEY`。

## 输出格式

所有脚本均通过 `--format` 支持多种输出格式：

| 格式 | 说明 |
|--------|-------------|
| `mp3_44100_128` | MP3，44.1kHz，128kbps（默认） |
| `mp3_44100_192` | MP3，44.1kHz，192kbps |
| `pcm_16000` | 原始 PCM，16kHz |
| `pcm_22050` | 原始 PCM，22.05kHz |
| `pcm_24000` | 原始 PCM，24kHz |
| `pcm_44100` | 原始 PCM，44.1kHz |
| `ulaw_8000` | μ-law，8kHz（电话通信） |

## 工具列表

### 1. 语音合成（`speech.py`）
使用 ElevenLabs 语音进行文本转语音。

```bash
# Basic usage
python3 {baseDir}/scripts/speech.py "Hello world" -v <voice_id> -o output.mp3

# With format option
python3 {baseDir}/scripts/speech.py "Hello world" -v <voice_id> -o output.pcm --format pcm_44100

# With voice settings
python3 {baseDir}/scripts/speech.py "Hello" -v <voice_id> -o out.mp3 --stability 0.7 --similarity 0.8
```

### 2. 音效生成（`sfx.py`）
生成音效与短音频片段。

```bash
# Generate a sound
python3 {baseDir}/scripts/sfx.py "Cinematic boom" -o boom.mp3

# Generate a loop
python3 {baseDir}/scripts/sfx.py "Lo-fi hip hop beat" --duration 10 --loop -o beat.mp3

# Different format
python3 {baseDir}/scripts/sfx.py "Whoosh" -o whoosh.pcm --format pcm_44100
```

### 3. 音乐生成（`music.py`）
生成完整音乐作品或纯器乐曲目。

```bash
# Generate instrumental intro
python3 {baseDir}/scripts/music.py --prompt "Upbeat 6s news intro sting, instrumental" --length-ms 6000 -o intro.mp3

# Generate background bed
python3 {baseDir}/scripts/music.py --prompt "Soft ambient synth pad" --length-ms 30000 -o bed.mp3

# High quality MP3
python3 {baseDir}/scripts/music.py --prompt "Jazz piano" --length-ms 10000 -o jazz.mp3 --output-format mp3_44100_192
```

### 4. 语音列表（`voices.py`）
列出所有可用语音及其 ID。

```bash
# List voices
python3 {baseDir}/scripts/voices.py

# JSON output
python3 {baseDir}/scripts/voices.py --json
```

### 5. 语音克隆（`voiceclone.py`）
基于音频样本即时创建语音克隆。

```bash
# Clone from audio files
python3 {baseDir}/scripts/voiceclone.py --name "MyVoice" --files sample1.mp3 sample2.mp3

# With language and gender labels
python3 {baseDir}/scripts/voiceclone.py --name "Andi" --files *.m4a --language de --gender male

# With description and noise removal
python3 {baseDir}/scripts/voiceclone.py --name "Andi" --files *.m4a --description "German male" --denoise
```

### 6. 配额与用量（`quota.py`）
查询订阅配额与用量统计。

```bash
# Show current quota
python3 {baseDir}/scripts/quota.py

# Include usage breakdown by voice
python3 {baseDir}/scripts/quota.py --usage

# Last 7 days usage
python3 {baseDir}/scripts/quota.py --usage --days 7

# JSON output
python3 {baseDir}/scripts/quota.py --json
```

输出：
```
📊 ElevenLabs Quota
=======================================
Plan:      pro (active) — annual
Characters: 66.6K / 500.0K (13.3%)
           [███░░░░░░░░░░░░░░░░░░░░░░░░░░░]
Resets:    2026-02-18 (29 days)
Voices:    22 / 160 (IVC: ✓)
Pro Voice: 0 / 1 (PVC: ✓)
```