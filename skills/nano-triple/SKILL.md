---
name: nano-triple
name_zh: Nano三元组
description: 使用 Nano Banana Pro 同一提示词生成 3 张图像。由您挑选最佳结果，或针对任一选项提供反馈，以获得 3 张优化后的图像。
description_zh: 使用 Nano Banana Pro 同一提示词生成 3 张图像。由您挑选最佳结果，或针对任一选项提供反馈，以获得 3 张优化后的图像。
triggers:
  - make me an image
  - generate an image
  - create an image
metadata:
  clawdbot:
    emoji: "🎨"
---
# Nano Triple：同一提示词，生成 3 张图像，由您选择

当用户提出图像生成需求时，生成 3 个版本供其挑选或进一步优化。

## 工作流程

### 第一步：用户提交提示词

用户输入：“为我生成一张山巅日落的图像”

### 第二步：使用**完全相同的提示词**生成 3 张图像

对全部 3 张图像使用用户**原始提示词**，不做任何修改或发挥。模型固有的随机性将自然产生 3 种不同结果。

并行运行全部 3 次调用：

```bash
# Same prompt, 3 times
uv run ~/.npm-global/lib/node_modules/clawdbot/skills/nano-banana-pro/scripts/generate_image.py \
  --prompt "[USER'S EXACT PROMPT]" \
  --filename "option-1.png" --resolution 1K

uv run ~/.npm-global/lib/node_modules/clawdbot/skills/nano-banana-pro/scripts/generate_image.py \
  --prompt "[USER'S EXACT PROMPT]" \
  --filename "option-2.png" --resolution 1K

uv run ~/.npm-global/lib/node_modules/clawdbot/skills/nano-banana-pro/scripts/generate_image.py \
  --prompt "[USER'S EXACT PROMPT]" \
  --filename "option-3.png" --resolution 1K
```

### 第三步：发送 3 张图像，并标注为 1、2、3

每张图像仅附带对应数字标签：

- **1** [图像]  
- **2** [图像]  
- **3** [图像]  

**禁止添加任何说明文字。禁止任何主观发挥。仅发送数字 1、2、3 及对应图像。**

### 第四步：用户选择或提供反馈

- 输入 “2” → 完成，该图像即为选定结果  
- 输入 “1 但色调更暖” → 基于该反馈生成 3 张新图像  
- 输入 “都不满意，重试” → 使用相同原始提示词再生成 3 张新图像  

**关键原则：对任一选项提出的反馈 = 生成 3 张应用该反馈的新图像**

## 示例

**用户：** 为我生成一张戴高顶礼帽的猫的图像  

**你：** 使用该**完全一致**的提示词生成 3 张图像，并以编号 1、2、3 形式发送  

**用户：** 2 但礼帽更大  

**你：** 在原始提示词中加入 “更大的礼帽”，再生成 3 张新图像，并以编号 1、2、3 形式发送  

**用户：** 3  

**你：** 👍  

## 规则

1. **始终生成 3 张图像**——同一提示词，3 个输出  
2. **禁止主观发挥**——严格使用用户原始提示词  
3. **仅标注 1、2、3**——不附加任何说明文字  
4. **反馈即触发新一轮 3 图生成**——任何编辑请求均生成 3 张新选项  

## API 密钥

使用环境变量或 clawdbot 配置中的 `GEMINI_API_KEY`。