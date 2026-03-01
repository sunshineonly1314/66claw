---
name: coloring-page
name_zh: 涂色页
description: 将上传的照片转换为可打印的黑白填色页。
description_zh: 将上传的照片转换为可打印的黑白填色页。
metadata:
  clawdbot:
    config:
      requiredEnv:
        - GEMINI_API_KEY
---
# coloring-page  

将照片转换为可打印的黑白轮廓填色页。

本技能专为对话式交互设计：  
- 您上传一张图像  
- 您说：“create a coloring page”（生成一张填色页）  
- 助理运行此技能，并将生成的 PNG 图像返回给您  

底层使用 Nano Banana Pro（Gemini 3 Pro Image）图像模型。

## 要求  

- 已设置 `GEMINI_API_KEY`（建议配置于 `~/.clawdbot/.env`）  
- `uv` 可用（由底层 nano-banana-pro 技能调用）  

## 助理应如何使用本技能  

当用户消息满足以下条件时：  
- 附带一张图像（jpg/png/webp）  
- 并请求生成“coloring page”（填色页）  

请执行：  
- `bin/coloring-page --in <path-to-uploaded-image> [--out <output.png>] [--resolution 1K|2K|4K]`  

然后将输出图像发送回用户。

## CLI  

### 基础用法  

```bash
coloring-page --in photo.jpg
```  

### 指定输出文件名  

```bash
coloring-page --in photo.jpg --out coloring.png
```  

### 分辨率  

```bash
coloring-page --in photo.jpg --resolution 2K
```  

## 注意事项  

- 输入必须为光栅图像（`.jpg`、`.png`、`.webp`）。  
- 输出为白色背景上的 PNG 填色页。  