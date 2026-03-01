---
name: krea-api
name_zh: Krea API
description: 通过 Krea.ai API（支持 Flux、Imagen、Ideogram、Seedream 等模型）生成图像
description_zh: 通过 Krea.ai API（支持 Flux、Imagen、Ideogram、Seedream 等模型）生成图像
version: 0.1.0
---
# Krea.ai 图像生成 skill

使用 Krea.ai API 生成图像，支持多种模型，包括 Flux、Imagen 4、Ideogram 3.0 等。

## 特性

- 异步任务式生成（POST → 轮询 → 获取结果）  
- 支持多种图像模型  
- 可配置参数（宽度、高度、步数、引导强度、随机种子等）  
- 支持 Webhook 实现后台完成通知  
- 仅依赖标准库（无需 `requests`）

## 设置

1. 从 https://docs.krea.ai/developers/api-keys-and-billing 获取您的 Krea.ai API 凭据  
2. 使用以下方式配置：

```bash
clawdbot config set skill.krea_api.key_id YOUR_KEY_ID
clawdbot config set skill.krea_api.secret YOUR_SECRET
```

3. 或直接将凭据作为参数传入。

## 使用方法

### 交互模式

```
You: Generate a sunset over the ocean with Flux
Klawf: Creates the image and returns the URL
```

### Python 脚本

```python
from krea_api import KreaAPI

api = KreaAPI(
    key_id="your-key-id",
    secret="your-secret"
)

# Generate and wait
urls = api.generate_and_wait(
    prompt="A serene Japanese garden",
    model="flux",
    width=1024,
    height=1024
)
print(urls)
```

### 可用模型（示例）

| 模型 | 接口端点 |
|------|----------|
| flux | `/generate/image/bfl/flux-1-dev` |
| flux-kontext | `/generate/image/bfl/flux-1-dev-kontext` |
| flux-1.1-pro | `/generate/image/bfl/flux-1-1-pro` |
| imagen-3 | `/generate/image/google/imagen-3` |
| imagen-4 | `/generate/image/google/imagen-4` |
| ideogram-3.0 | `/generate/image/ideogram/ideogram-3-0` |
| seedream-4 | `/generate/image/seedream/seedream-4` |

获取完整模型列表，请运行：

```bash
python3 krea_api.py --list-models
```

## 参数

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| prompt | str | 必填 | 图像描述（最多 1800 字符） |
| model | str | "flux" | 上表中列出的模型名称 |
| width | int | 1024 | 图像宽度（512–2368） |
| height | int | 1024 | 图像高度（512–2368） |
| steps | int | 25 | 生成步数（1–100） |
| guidance_scale | float | 3.0 | 引导强度（0–24） |
| seed | str | None | 随机种子，用于结果复现 |
| webhook_url | str | None | 完成通知回调 URL |

## 致谢

感谢 Claude Opus 4.5 协助梳理正确的 API 结构。官方文档错误地建议使用 `/v1/images/flux`，而实际可用的端点为 `/generate/image/bfl/flux-1-dev`。