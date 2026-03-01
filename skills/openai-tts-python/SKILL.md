---
name: openai-tts-python
name_zh: OpenAI TTS Python
description: |
description_zh: |
  使用 OpenAI 的 TTS API 将文本转换为高质量、自然流畅的语音音频。
  支持 6 种音色（alloy、echo、fable、onyx、nova、shimmer），语速调节（0.25x–4.0x）、
  高清（HD）质量模型、多种输出格式（mp3、opus、aac、flac），以及针对长文本的自动分块处理
  （单次请求上限为 4096 字符）。
  触发场景：（1）用户通过“为我朗读这段文字”、“转为音频”、“生成语音”、“文字转语音”、“tts”、“朗读”、“说话”等指令请求语音/音频输出；
  或出现关键词“openai tts”、“voice”、“podcast”。（2）内容需以语音形式播放而非阅读（例如多任务处理、无障碍访问）。（3）用户明确指定音色偏好，
  如“alloy”、“echo”、“fable”、“onyx”、“nova”、“shimmer”，或要求调整语速。
---
# OpenAI TTS

使用 OpenAI 的 TTS API 将文本转换为高质量、自然流畅的语音音频。

## 功能特性
- 6 种不同音色选项（含男性与女性音色）
- 标准与高清（HD）质量模型
- 针对长文本的自动分块处理（单次请求上限为 4096 字符）
- 多种输出格式（mp3、opus、aac、flac）

## 激活条件

当用户满足以下任一条件时，该 skill 将被激活：
- 请求语音/音频输出：“为我朗读这段文字”、“转为音频”、“生成语音”、“将此内容转为音频文件”
- 使用关键词：“tts”、“openai tts”、“text to speech”、“voice”、“audio”、“podcast”
- 因无障碍访问、多任务处理或播客制作等需求，需将内容以语音方式播放
- 明确指定音色偏好：“alloy”、“echo”、“fable”、“onyx”、“nova”、“shimmer”
- 要求“朗读”、“说话”或“发声”文本

## 前置要求

- 必须设置 `OPENAI_API_KEY` 环境变量
- Python 3.8 或更高版本
- 依赖项：`openai`，`pydub`（可选，用于处理长文本）

## 可用音色

| 音色 | 类型 | 描述 |
|------|------|------|
| alloy | 中性 | 平衡、通用 |
| echo | 男性 | 温暖、对话感强 |
| fable | 中性 | 富有表现力、适合讲故事 |
| onyx | 男性 | 深沉、权威 |
| nova | 女性 | 友好、积极向上 |
| shimmer | 女性 | 清晰、专业 |

## 使用方法

### 基础用法
```python
from openai import OpenAI
import os

client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

response = client.audio.speech.create(
    model="tts-1",      # or "tts-1-hd" for higher quality
    voice="onyx",       # choose from: alloy, echo, fable, onyx, nova, shimmer
    input="Your text here",
    speed=1.0           # 0.25 to 4.0 (optional)
)

with open("output.mp3", "wb") as f:
    for chunk in response.iter_bytes():
        f.write(chunk)
```

### 命令行
```bash
# Basic
python -c "
from openai import OpenAI
client = OpenAI()
response = client.audio.speech.create(model='tts-1', voice='onyx', input='Hello world')
open('output.mp3', 'wb').write(response.content)
"
```

### 长文本（自动分块）
```python
from openai import OpenAI
from pydub import AudioSegment
import tempfile
import os
import re

client = OpenAI()
MAX_CHARS = 4096

def split_text(text):
    if len(text) <= MAX_CHARS:
        return [text]

    chunks = []
    sentences = re.split(r'(?<=[.!?])\s+', text)
    current = ''

    for sentence in sentences:
        if len(current) + len(sentence) + 1 <= MAX_CHARS:
            current += (' ' if current else '') + sentence
        else:
            if current:
                chunks.append(current)
            current = sentence

    if current:
        chunks.append(current)

    return chunks

def generate_tts(text, output_path, voice='onyx', model='tts-1'):
    chunks = split_text(text)

    if len(chunks) == 1:
        response = client.audio.speech.create(model=model, voice=voice, input=text)
        with open(output_path, 'wb') as f:
            f.write(response.content)
    else:
        segments = []
        for chunk in chunks:
            response = client.audio.speech.create(model=model, voice=voice, input=chunk)
            with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as tmp:
                tmp.write(response.content)
                segments.append(AudioSegment.from_mp3(tmp.name))
                os.unlink(tmp.name)

        combined = segments[0]
        for seg in segments[1:]:
            combined += seg
        combined.export(output_path, format='mp3')

    return output_path

# Usage
generate_tts("Your long text here...", "output.mp3", voice="nova")
```

## 模型

| 模型 | 质量 | 速度 | 成本 |
|------|------|------|------|
| tts-1 | 标准 | 快 | $0.015 / 1K 字符 |
| tts-1-hd | 高清 | 较慢 | $0.030 / 1K 字符 |

## 输出格式

支持的格式：`mp3`（默认）、`opus`、`aac`、`flac`

```python
response = client.audio.speech.create(
    model="tts-1",
    voice="onyx",
    input="Hello",
    response_format="opus"  # or mp3, aac, flac
)
```

## 错误处理

```python
from openai import OpenAI, APIError, RateLimitError
import time

client = OpenAI()

def generate_with_retry(text, voice='onyx', max_retries=3):
    for attempt in range(max_retries):
        try:
            response = client.audio.speech.create(
                model="tts-1",
                voice=voice,
                input=text
            )
            return response.content
        except RateLimitError:
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)  # Exponential backoff
                continue
            raise
        except APIError as e:
            print(f"API Error: {e}")
            raise

    return None
```

## 示例

### 将文章转为播客
```python
def article_to_podcast(article_text, output_file):
    intro = "Welcome to today's article reading."
    outro = "Thank you for listening."

    full_text = f"{intro}\n\n{article_text}\n\n{outro}"

    generate_tts(full_text, output_file, voice='nova', model='tts-1-hd')
    print(f"Podcast saved to {output_file}")
```

### 批量处理
```python
def batch_tts(texts, output_dir, voice='onyx'):
    import os
    os.makedirs(output_dir, exist_ok=True)

    for i, text in enumerate(texts):
        output_path = os.path.join(output_dir, f"audio_{i+1}.mp3")
        generate_tts(text, output_path, voice=voice)
        print(f"Generated: {output_path}")
```

## 相关链接

- [OpenAI TTS 文档](https://platform.openai.com/docs/guides/text-to-speech)
- [OpenAI API 参考文档](https://platform.openai.com/docs/api-reference/audio/createSpeech)
- [定价信息](https://openai.com/pricing)