---
name: reve-ai
name_zh: Reve AI
description: 利用 Reve AI API 生成、编辑和混搭（remix）图像。适用于根据文本提示生成图像、依据指令编辑现有图像，或结合/混搭多张参考图像的场景。需设置 REVE_API_KEY 或 REVE_AI_API_KEY 环境变量。
description_zh: 利用 Reve AI API 生成、编辑和混搭（remix）图像。适用于根据文本提示生成图像、依据指令编辑现有图像，或结合/混搭多张参考图像的场景。需设置 REVE_API_KEY 或 REVE_AI_API_KEY 环境变量。
---
# Reve AI 图像生成

利用 Reve 的 AI API 生成、编辑与混搭（remix）图像。

## 前置条件

- Bun 运行时  
- 已设置 `REVE_API_KEY` 或 `REVE_AI_API_KEY` 环境变量  

## 快速使用

```bash
# Generate image from prompt
bun scripts/reve.ts create "A beautiful sunset over mountains" -o sunset.png

# With aspect ratio
bun scripts/reve.ts create "A cat in space" -o cat.png --aspect 16:9

# Edit existing image
bun scripts/reve.ts edit "Add dramatic clouds" -i photo.png -o edited.png

# Remix multiple images
bun scripts/reve.ts remix "Person from <img>0</img> in scene from <img>1</img>" -i person.png -i background.png -o remix.png
```

## 命令

### create  
根据文本提示生成新图像。

选项：  
- `-o, --output FILE` —— 输出文件路径（默认：output.png）  
- `--aspect RATIO` —— 宽高比：16:9、9:16、3:2、2:3、4:3、3:4、1:1（默认：3:2）  
- `--version VER` —— 模型版本（默认：latest）  

### edit  
依据文本指令修改现有图像。

选项：  
- `-i, --input FILE` —— 待编辑的输入图像（必填）  
- `-o, --output FILE` —— 输出文件路径（默认：output.png）  
- `--version VER` —— 模型版本：latest、latest-fast、reve-edit@20250915、reve-edit-fast@20251030  

### remix  
将文本提示与参考图像相结合。在提示词中使用 `<img>N</img>` 按索引（从 0 开始）引用图像。

选项：  
- `-i, --input FILE` —— 参考图像（可指定多张，最多 6 张）  
- `-o, --output FILE` —— 输出文件路径（默认：output.png）  
- `--aspect RATIO` —— 宽高比（同 create 命令选项）  
- `--version VER` —— 模型版本：latest、latest-fast、reve-remix@20250915、reve-remix-fast@20251030  

## 限制条件

- 提示词最大长度：2560 字符  
- remix 操作最多支持 6 张参考图像  
- 有效宽高比：16:9、9:16、3:2、2:3、4:3、3:4、1:1  

## 响应

脚本输出包含生成详情的 JSON：  
```json
{
  "output": "path/to/output.png",
  "version": "reve-create@20250915",
  "credits_used": 18,
  "credits_remaining": 982
}
```  

## 错误类型

- `401` —— API 密钥无效  
- `402` —— 信用额度不足  
- `429` —— 触发速率限制（含 retry_after 字段）  
- `422` —— 输入无效（提示词过长、宽高比不合法等）  