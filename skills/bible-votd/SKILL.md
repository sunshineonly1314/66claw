---
name: bible
name_zh: 圣经日读
description: 获取 Bible.com 每日金句（Verse of the Day），含可分享图片。
description_zh: 获取 Bible.com 每日金句（Verse of the Day），含可分享图片。
homepage: https://bible.com
metadata: {"clawdis":{"emoji":"📖","requires":{"bins":["python3"]}}}
---
# Bible.com 每日金句

从 Bible.com（YouVersion）获取每日金句，含可分享的图片。

## 快捷命令

### 获取每日金句（JSON 格式）
```bash
python3 ~/clawd/skills/bible/votd.py
```

返回结果：
```json
{
  "reference": "Psalms 27:4",
  "text": "One thing I ask from the LORD...",
  "usfm": "PSA.27.4",
  "date": "2026-01-04T21:00:10.178Z",
  "image_url": "https://imageproxy.youversionapi.com/1280x1280/...",
  "attribution": "Bible.com / YouVersion"
}
```

### 获取每日金句并下载图片
```bash
python3 ~/clawd/skills/bible/votd.py --download /tmp/votd.jpg
```

将 1280×1280 像素的可分享图片下载至指定路径。

## 分享金句

分享每日金句时，请遵循以下规范：  
1. 使用 `image_url` 展示或发送预渲染图片  
2. 包含 `reference`（例如：“诗篇 27:4”）  
3. 注明 `attribution`：“Bible.com / YouVersion”

## 图片详情

- 图片尺寸为 1280×1280 像素，高质量 JPG 格式  
- 已预渲染，金句文字叠加于精美背景之上  
- 专为社交媒体或即时通讯分享而优化  

## 注意事项

- 金句每日更新（依据 YouVersion 日程安排）  
- 无需 API 密钥 —— 直接抓取 Bible.com 公开网页  
- 分享时请务必注明来源：Bible.com / YouVersion  