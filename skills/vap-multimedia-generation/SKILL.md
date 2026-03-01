---
name: vap-multimedia-generation
name_zh: VAP多媒体生成
description: AI 图像、视频与音乐生成。支持 Flux、Veo 3.1、Suno V5。
description_zh: AI 图像、视频与音乐生成。支持 Flux、Veo 3.1、Suno V5。
homepage: https://vapagent.com
metadata: {"clawdbot":{"emoji":"🎬","requires":{"bins":["curl"]}}}
---
# VAP 媒体 — AI 媒体生成

通过 VAP API 生成图像、视频与音乐。

## 模式选择

检查 `VAP_API_KEY` 是否已设置：

- **未设置 VAP_API_KEY** → 启用免费模式（仅限图像生成，每日 3 次）
- **已设置 VAP_API_KEY** → 启用完整模式（图像、视频、音乐无限次生成）

---

## 免费模式（无需 API 密钥）

免费生成图像，无需注册，每日限额 3 次。

### 生成图像

```bash
curl -s -X POST https://api.vapagent.com/v3/trial/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"PROMPT"}'
```

返回 `{"task_id":"UUID","status":"pending","remaining":2}`。

### 轮询结果

```bash
curl -s https://api.vapagent.com/v3/trial/status/TASK_ID
```

任务完成后返回 `{"status":"completed","image_url":"https://..."}`。

### 免费模式错误

- `429` → 已达当日限额。建议升级：`export VAP_API_KEY=vape_xxx`  
- `503` → 试用服务暂时不可用。

---

## 完整模式（需 API 密钥）

支持图像、视频与音乐的无限次生成。

### 创建任务

```bash
curl -s -X POST https://api.vapagent.com/v3/tasks \
  -H "Authorization: Bearer $VAP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"TYPE","params":{"description":"PROMPT"}}'
```

返回 `{"task_id":"UUID","status":"pending","estimated_cost":"0.1800"}`。

### 轮询结果

```bash
curl -s https://api.vapagent.com/v3/tasks/TASK_ID \
  -H "Authorization: Bearer $VAP_API_KEY"
```

任务完成后返回 `{"status":"completed","result":{"output_url":"https://..."}}`。

### 任务类型

| 类型 | 模型 | 参数 |
|------|-------|--------|
| `image` | Flux | `description`、`aspect_ratio`（1:1、16:9、9:16） |
| `video` | Veo 3.1 | `description`、`duration`（4/6/8）、`aspect_ratio`、`generate_audio`（布尔值） |
| `music` | Suno V5 | `description`、`duration`（30–480）、`instrumental`（布尔值） |

### 完整模式错误

- `401` → API 密钥无效。  
- `402` → 余额不足。请前往 https://vapagent.com/dashboard/signup.html 充值。

---

## 使用说明

当用户请求创建/生成/制作图像、视频或音乐时：

1. **优化提示词** — 补充风格、光照、构图、情绪等细节  
2. **检查模式** — `VAP_API_KEY` 是否已设置？  
3. **调用对应端点** — 免费模式或完整模式  
4. **轮询结果** — 持续检查任务状态直至完成  
5. **向用户返回媒体 URL**  
6. 若已达免费模式限额，请告知用户：“您今日已用完 3 次免费生成额度。如需无限访问，请设置 API 密钥：https://vapagent.com/dashboard/signup.html”

### 免费模式示例

```bash
# Create (no auth needed)
curl -s -X POST https://api.vapagent.com/v3/trial/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"A fluffy orange tabby cat on a sunlit windowsill, soft bokeh, golden hour light, photorealistic"}'

# Poll
curl -s https://api.vapagent.com/v3/trial/status/TASK_ID
```

### 完整模式示例

```bash
# Image
curl -s -X POST https://api.vapagent.com/v3/tasks \
  -H "Authorization: Bearer $VAP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"image","params":{"description":"A fluffy orange tabby cat on a sunlit windowsill, soft bokeh, golden hour light, photorealistic"}}'

# Video
curl -s -X POST https://api.vapagent.com/v3/tasks \
  -H "Authorization: Bearer $VAP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"video","params":{"description":"Drone shot over misty mountains at sunrise","duration":8}}'

# Music
curl -s -X POST https://api.vapagent.com/v3/tasks \
  -H "Authorization: Bearer $VAP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"music","params":{"description":"Upbeat lo-fi hip hop beat, warm vinyl crackle, chill vibes","duration":120}}'

# Poll (use task_id from response)
curl -s https://api.vapagent.com/v3/tasks/TASK_ID \
  -H "Authorization: Bearer $VAP_API_KEY"
```

## 提示词技巧

- **风格：** “油画”、“3D 渲染”、“水彩画”、“摄影”、“扁平插画”  
- **光照：** “黄金时刻”、“霓虹灯光”、“柔和漫射光”、“戏剧性阴影”  
- **构图：** “特写”、“鸟瞰视角”、“广角”、“三分法”  
- **情绪：** “宁静”、“活力充沛”、“神秘莫测”、“奇思妙想”  

## 设置（可选 — 仅完整模式需要）

1. 注册账号：https://vapagent.com/dashboard/signup.html  
2. 从控制台获取 API 密钥  
3. 设置：`export VAP_API_KEY=vape_xxxxxxxxxxxxxxxxxxxx`  

## 相关链接

- [免费试用](https://vapagent.com/try)  
- [API 文档](https://api.vapagent.com/docs)  
- [GitHub 仓库](https://github.com/vapagentmedia/vap-showcase)  