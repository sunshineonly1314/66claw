---
name: sherpa-onnx-asr
description: Local speech recognition via sherpa-onnx (offline, no cloud)
nameZh: "本地语音识别"
descriptionZh: "本地离线语音转文字（无需云服务，支持中英日韩粤）"
metadata: {"openclawcn":{"emoji":"🎙️","os":["darwin","linux","win32"],"install":[{"id":"download-sensevoice-model","kind":"download","url":"https://modelscope.cn/models/pengzhendong/sherpa-onnx-sense-voice-zh-en-ja-ko-yue/resolve/master/model.int8.onnx","extract":false,"targetDir":"~/.openclawcn/tools/sherpa-onnx-asr/models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17","label":"下载 SenseVoice 模型 (zh/en/ja/ko/yue, 228MB)"},{"id":"download-sensevoice-tokens","kind":"download","url":"https://modelscope.cn/models/pengzhendong/sherpa-onnx-sense-voice-zh-en-ja-ko-yue/resolve/master/tokens.txt","extract":false,"targetDir":"~/.openclawcn/tools/sherpa-onnx-asr/models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17","label":"下载 SenseVoice 词表 (316KB)"}]}}
---

# sherpa-onnx-asr

本地离线语音转文字，使用 sherpa-onnx SenseVoice 模型。

## 支持语言

- 中文（普通话）
- 英语
- 日语
- 韩语
- 粤语

## 模型信息

### SenseVoice (推荐)
- **语言:** zh, en, ja, ko, yue (自动检测)
- **大小:** ~228 MB (int8 量化)
- **特点:** 自动标点、逆文本正则化
- **来源:** ModelScope (阿里云, 国内高速下载)

## 安装

通过 Skills 页面一键安装：
1. 打开 ClawdBot → Skills 页面
2. 找到「本地语音识别」
3. 点击下载模型文件 (model.int8.onnx + tokens.txt)

模型文件下载到 `~/.openclawcn/tools/sherpa-onnx-asr/models/` 目录。

## 手动下载

如果自动安装失败，可以手动下载：

```bash
# 创建目录
mkdir -p ~/.openclawcn/tools/sherpa-onnx-asr/models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17
cd ~/.openclawcn/tools/sherpa-onnx-asr/models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17

# 从 ModelScope 下载 (国内推荐, ~2.3 MB/s)
wget https://modelscope.cn/models/pengzhendong/sherpa-onnx-sense-voice-zh-en-ja-ko-yue/resolve/master/model.int8.onnx
wget https://modelscope.cn/models/pengzhendong/sherpa-onnx-sense-voice-zh-en-ja-ko-yue/resolve/master/tokens.txt

# 或从 hf-mirror 下载 (备用)
wget https://hf-mirror.com/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/main/model.int8.onnx
wget https://hf-mirror.com/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/main/tokens.txt
```

## 使用

`asr` 工具已内置，自动检测已安装的模型：

```
asr({ audio_path: "/path/to/audio.wav" })
```

## 说明

- 首次调用加载模型到内存 (~1-2 秒)，后续调用极快 (~100ms)
- 音频输入：16kHz mono WAV 最佳，其他格式通过 ffmpeg 自动转换
- 纯 CPU 推理，无需 GPU
- 内存占用: ~300-500 MB
