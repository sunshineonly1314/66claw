---
name: recipe-to-list
name_zh: 菜谱转清单
description: 将食谱转换为 Todoist 购物清单。通过 Gemini Flash 视觉模型解析食谱图片，或通过网页搜索+抓取提取食谱网页中的食材；随后与现有 Shopping 项目进行比对（采用保守的同义词/重叠匹配规则），跳过厨房常备品（如盐、胡椒），并在单位一致时合并数量。同时将每道已烹饪食谱自动存入工作区食谱库（recipes/ 目录下）。
description_zh: 将食谱转换为 Todoist 购物清单。通过 Gemini Flash 视觉模型解析食谱图片，或通过网页搜索+抓取提取食谱网页中的食材；随后与现有 Shopping 项目进行比对（采用保守的同义词/重叠匹配规则），跳过厨房常备品（如盐、胡椒），并在单位一致时合并数量。同时将每道已烹饪食谱自动存入工作区食谱库（recipes/ 目录下）。
---
# 创建购物清单（Gemini Flash + Todoist）

目标流程：  
1) 输入为一张**照片**或一次**食谱网页搜索**  
2) 提取食材（照片由 Gemini Flash 处理；网页则先调用 web_fetch 获取文本，再交由 Gemini 解析）  
3) 拉取当前 Todoist 中的 **Shopping** 清单  
4) 基于重叠匹配与同义词映射进行比对（策略保守；仅合并高置信度等价项，例如香菜↔芫荽、日式面包糠↔面包屑）  
5) 更新 **Shopping** 清单（默认：仅添加缺失项；跳过盐、胡椒）

使用配套脚本处理 **照片 → 食材 → Shopping 清单更新** 流程。

该脚本还会**自动保存**一条 Markdown 条目至 `recipes/`（您的食谱知识库），并追加至 `recipes/index.md`。

对于 **食谱名称 → 网页搜索** 场景，请先使用 `web_search` + `web_fetch` 进行确认式搜索，再将提取出的食材输入同一更新逻辑（并保存该食谱）。

## 前置条件

- 环境变量：`GEMINI_API_KEY`（或 `GOOGLE_API_KEY`）用于 Gemini  
- 环境变量：`TODOIST_API_TOKEN` 用于 Todoist  
- 二进制工具：`todoist`（todoist-ts-cli）

## 输出格式规范

- 各项条目统一以**食材名称**开头，后接括号标注的数量。  
- Shopping 清单保持**扁平化结构**（不使用 Todoist 的分区/分组功能）。

## 运行命令

```bash
python3 skills/recipe-to-list/scripts/recipe_to_list.py \
  --image /path/to/photo.jpg \
  --title "<optional title>" \
  --source "photo:/path/to/photo.jpg"
```

### 可选标志位

- `--model gemini-2.0-flash`（默认值；若不可用则自动回退）或任一兼容的 Gemini 视觉模型  
- `--dry-run`：仅打印提取出的食材，不创建待办任务  
- `--prefix "[Recipe] "`：为每个新建任务添加前缀  
- `--no-overlap-check`：跳过检查您现有的 Shopping 清单  
- `--include-pantry`：包含盐与胡椒  
- `--no-save`：跳过保存至 `recipes/`  

## 发送给模型的内容

脚本要求 Gemini 返回**严格 JSON 格式**：

```json
{
  "items": ["2 large globe eggplants", "kosher salt", "..."],
  "notes": "optional"
}
```

若解析失败，请重新运行，并提供裁剪更清晰的图片（仅含食材列表），或手动提供食材列表。