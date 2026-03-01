---
name: clawdbites
name_zh: ClawdBites
description: 从 Instagram Reels 中提取食谱。当用户发送 Instagram Reel 链接并希望从字幕中获取食谱时使用。将食材、步骤与宏量营养素解析为格式清晰的结果。
description_zh: 从 Instagram Reels 中提取食谱。当用户发送 Instagram Reel 链接并希望从字幕中获取食谱时使用。将食材、步骤与宏量营养素解析为格式清晰的结果。
homepage: https://github.com/kylelol/ClawdBites
metadata: {"clawdbot":{"emoji":"🦞","os":["darwin","linux"],"requires":{"bins":["yt-dlp","ffmpeg","whisper"]},"install":[{"id":"yt-dlp","kind":"brew","formula":"yt-dlp","bins":["yt-dlp"],"label":"通过 Homebrew 安装 yt-dlp"},{"id":"ffmpeg","kind":"brew","formula":"ffmpeg","bins":["ffmpeg"],"label":"通过 Homebrew 安装 ffmpeg"},{"id":"whisper","kind":"download","command":"pip3 install --user openai-whisper","label":"安装 Whisper（本地运行，无需 API 密钥）"}]}}
---
# Instagram 食谱提取器

使用多层方法从 Instagram Reels 中提取食谱：
1. **字幕解析** —— 首先即时检查帖子描述
2. **音频转录** —— Whisper（本地运行，无需 API 密钥）
3. **帧分析** —— 视觉模型识别屏幕上的文字

无需 Instagram 登录。适用于公开的 Reels。

## 使用场景

- 用户发送 Instagram Reel 链接
- 用户提及“Instagram 食谱”或“保存这个 Reel”
- 用户希望从视频帖文中提取食谱详情

## 工作原理（强制流程）

**必须严格遵循此完整流程 —— 若字幕中缺少步骤说明，切勿在字幕解析后终止：**

1. 用户发送 Instagram Reel URL  
2. 使用 yt-dlp 提取元数据（`--dump-json`）  
3. 解析字幕以提取食谱详情  
4. **完整性检查**：字幕是否同时包含**食材**与**步骤说明**？  
   - ✅ **是**：直接呈现食谱  
   - ❌ **否（缺少步骤或信息不全）**：**自动进入音频转录阶段** —— 切勿停止或向用户提问  
5. 若需音频转录：  
   - 下载视频：`yt-dlp -o "/tmp/reel.mp4" "URL"`  
   - 提取音频：`ffmpeg -y -i /tmp/reel.mp4 -vn -acodec pcm_s16le -ar 16000 -ac 1 /tmp/reel.wav`  
   - 转录音频：`whisper /tmp/reel.wav --model base --output_format txt --output_dir /tmp`  
   - 合并字幕中的食材与音频中的步骤说明  
6. 呈现格式清晰、整合字幕与音频内容的食谱  
7. 由用户决定后续操作（保存至笔记、加入心愿单等）

**完整性检查启发式规则：**  
- 含食材 = 包含 3+ 个“数量+物品”模式（例如，“1 杯面粉”、“2 磅鸡肉”）  
- 含步骤说明 = 包含动作动词（搅拌、烹饪、烘烤、混合、倾倒、添加）+ 序列或编号步骤  

## 提取命令

```bash
yt-dlp --dump-json "https://www.instagram.com/reel/SHORTCODE/" 2>/dev/null
```

**JSON 输出中的关键字段：**  
- `description` —— 含食谱的字幕内容  
- `uploader` —— 创建者姓名  
- `channel` —— 创建者账号  
- `webpage_url` —— 原始 URL  
- `like_count` —— 流行度指标  

## 食谱解析

在字幕中查找以下模式：

**宏量营养素（Macros）：**  
- “X 卡路里 | X 克蛋白质 | X 克碳水 | X 克脂肪”  
- “每份宏量营养素”  
- “卡路里/蛋白质/碳水/脂肪”

**食材：**  
- 以用量开头的行（1 杯、2 汤匙、24 盎司）  
- 含计量单位的行  
- Emoji 项目符号（🥩 🌽 🧀 等）

**章节标题：**  
- “制作 [成分]：”  
- “食材：”  
- “步骤说明：”  
- “操作指南：”

## 输出格式

以清晰格式呈现提取出的食谱：

```
## [Recipe Name]
*From @[handle]*

**Macros (per serving):** X cal | Xg P | Xg C | Xg F

### Ingredients
- [ingredient 1]
- [ingredient 2]
...

### Instructions
1. [step 1]
2. [step 2]
...

---
Source: [original URL]
```

## 提取完成后的用户操作选项

由用户决定下一步操作：  
- “保存至我的食谱” → 保存至 Apple Notes（若启用 meal-planner skill）  
- “加入心愿单” → 保存至 `memory/recipe-wishlist.json`  
- “仅显示给我看” → 仅展示，不保存  
- “下周安排这道菜” → 交由 meal-planner skill 处理  

## 心愿单存储

可选存储用户希望稍后尝试的食谱：

**memory/recipe-wishlist.json：**  
```json
{
  "recipes": [
    {
      "name": "Recipe Name",
      "source": "instagram",
      "sourceUrl": "https://instagram.com/reel/...",
      "handle": "@creator",
      "addedDate": "2026-01-26",
      "tried": false,
      "macros": {
        "calories": 585,
        "protein": 56,
        "carbs": 25,
        "fat": 28,
        "servings": 3
      },
      "ingredients": [...],
      "instructions": [...]
    }
  ]
}
```

## 错误处理

**若 yt-dlp 失败：**  
- 检查 URL 是否符合 Instagram Reel 格式  
- 可能为私密账号 —— 告知用户  
- 建议用户手动粘贴字幕文本作为备用方案  

**若字幕中未找到食谱（重要）：**  

提取完成后，扫描字幕中是否存在食谱指示信号：  
- 食材用量（数字 + 单位，如盎司、杯、汤匙、磅）  
- 食谱章节（“制作……”、“食材：”、“步骤说明：”）  
- 烹饪动词（烘焙、烹饪、煎炒、混合、合并）  
- 宏量营养素信息（卡路里、蛋白质、碳水、脂肪）  

**若均未发现，请明确告知用户：**  

> "I pulled the caption but it doesn't look like the recipe is there — it might just be a teaser or the recipe is only shown in the video itself. Here's what the caption says:  
>   
> [show caption]  
>   
> A few options:  
> 1. Check the comments — sometimes creators post recipes there  
> 2. Check their bio link — might lead to the full recipe  
> 3. Describe what you saw in the video and I can help find a similar recipe"  

**食谱检测启发式规则：**  
```
HAS_RECIPE if caption contains:
- 3+ ingredient-like patterns (quantity + food item)
- OR "recipe" + ingredient list
- OR macro breakdown + ingredients
- OR numbered/bulleted instructions

NO_RECIPE if caption is:
- Mostly hashtags
- Just a description/teaser
- Under 100 characters
- No quantities or measurements
```  

## 与 meal-planner 的集成

meal-planner skill 可调用本 skill：  
- 规划膳食时，检查心愿单中未尝试过的食谱  
- 推荐与您现有食材匹配的心愿单食谱  
- 在食谱被纳入膳食计划后标记为“已尝试”  

## 音频转录（V2）—— 强制备用方案

**当字幕中缺少步骤说明时，必须自动转录音频。** 切勿中断并向用户提问 —— 直接执行。这是最常见情形，因创作者常将食材列于字幕，而口头说明步骤。

**第 1 步：下载视频**  
```bash
yt-dlp -o "/tmp/reel.mp4" "https://instagram.com/reel/XXX"
```  

**第 2 步：提取音频**  
```bash
ffmpeg -i /tmp/reel.mp4 -vn -acodec pcm_s16le -ar 16000 -ac 1 /tmp/reel.wav
```  

**第 3 步：使用 Whisper 转录**  
```bash
/Users/kylekirkland/Library/Python/3.14/bin/whisper /tmp/reel.wav --model base --output_format txt --output_dir /tmp
```  

**第 4 步：解析转录文本以提取食谱**  
查找口头说明的烹饪步骤、 verbally 提及的食材。

## 缺失用量的智能推断

**必须始终推断未提供的用量。** 切勿呈现无具体用量的食谱 —— 应基于上下文与标准包装规格进行估算。

### 模糊表述 → 具体用量

| 表述内容 | 推断结果 |
|-----------|------------|
| “一些鸡肉” | ~1 磅 |
| “一点大蒜” | 2–3 瓣 |
| “一把菠菜” | ~2 杯 |
| “淋少许油” | 1–2 汤匙 |
| “按口味调味” | ½ 茶匙盐，¼ 茶匙胡椒粉 |
| “几滴酱油” | 1–2 汤匙 |
| “几汤匙” | 2–3 汤匙 |
| “一些米饭” | 1 杯生米 |
| “顶部撒奶酪” | ½–1 杯碎奶酪 |
| “切丁洋葱” | 1 个中等大小洋葱 |
| “彩椒” | 2 个彩椒 |

### 标准包装规格（当食材名称出现但无用量时）

| 食材 | 标准包装 | 推断结果 |
|--------|-------------|--------------|
| 千层酥皮 | 17 盎司片装 | 1 片 |
| 绞牛肉/火鸡肉 | 1 磅装 | 1 磅 |
| 鸡胸肉 | ~1.5 磅装 | 1.5 磅 |
| 香肠段 | 14 盎司 / 4–5 根 | 1 包 |
| 培根 | 12 盎司 / 12 片 | ½ 包（6 片） |
| 碎奶酪 | 8 盎司袋装 | 1–2 杯 |
| 玉米饼 | 8–10 张装 | 1 包 |
| 罐装豆类 | 15 盎司罐装 | 1 罐 |
| 高汤/肉汤 | 32 盎司纸盒装 | 1–2 杯 |
| 意面 | 16 盎司盒装 | 8 盎司（半盒） |
| 大米 | 2 磅袋装 | 1–2 杯生米 |

### 上下文感知缩放

**按菜式类型：**  
- 炒菜（供 2 人）→ 1 磅蛋白质，4 杯蔬菜  
- 汤/炖菜 → 1.5–2 磅蛋白质，4 杯高汤  
- 烤盘餐 → 1.5 磅蛋白质，3–4 杯蔬菜  
- 开胃菜 → 分量更小，估算每批约 12–15 份  

**按注明份数：**  
- “供 4 人食用” → 按 4 人份缩放标准用量  
- “一周膳食准备” → 默认按 5–8 人份估算  
- 未注明份数 → 默认按 4 人份  

**按蛋白质目标（若用户有宏量营养目标）：**  
- 每份 40–50 克蛋白质 → 每份约 6–8 盎司熟肉  
- 按此比例调整整道食谱的蛋白质用量  

### 输出格式

始终清晰标注推断用量：  
```
### Ingredients
- 1 lb ground turkey *(estimated)*
- 1 medium onion, diced *(estimated)*
- 2 cups broth *(estimated based on typical soup)*
```  

对推断得出的用量标注 *(estimated)*，以便用户区分原始来源内容与推断结果。

## 综合提取流程

```
1. TRY CAPTION (instant)
   └── yt-dlp --dump-json → parse description
   └── Recipe found? → DONE ✅
   └── Check for "pinned" / "in comments" / "check comments" → FLAG
   
2. IF FLAGGED: CHECK FOR CREATOR COMMENT
   └── Look through comments for creator's username
   └── If creator comment found with recipe → DONE ✅
   └── If not found → continue + notify user

3. TRY AUDIO (30-60 sec)
   └── Download video
   └── Extract audio with ffmpeg
   └── Transcribe with Whisper (base model)
   └── Parse transcript for recipe
   └── Infer missing measurements
   └── Recipe found? → DONE ✅

4. PRESENT RESULTS + PROMPT IF NEEDED
   └── Show what was extracted from audio
   └── If "pinned" was flagged, tell user:
       "The creator mentioned the full recipe is pinned in the comments.
        I extracted what I could from the audio, but if you want the 
        exact measurements, paste the pinned comment here and I'll 
        merge it with what I found."
   
5. TRY FRAME ANALYSIS (if audio incomplete)
   └── Extract 5-8 key frames with ffmpeg
   └── Send to Claude vision
   └── Ask: "Extract any recipe text, ingredients, or measurements shown"
   └── Merge findings with audio transcript
   
6. FALLBACK (nothing found)
   └── Inform user: "Recipe wasn't in caption or audio/video"
   └── Offer: search for similar recipe based on video title/description
```

## 帧分析

提取关键帧并使用视觉模型分析。

**提取帧：**  
```bash
# Extract 1 frame every 5 seconds
ffmpeg -i /tmp/reel.mp4 -vf "fps=1/5" /tmp/frame_%02d.jpg

# Or extract specific number of frames evenly distributed
ffmpeg -i /tmp/reel.mp4 -vf "select='not(mod(n,30))'" -vsync vfr /tmp/frame_%02d.jpg
```  

**提交至视觉模型：**  
使用 Claude 的图像分析功能读取各帧：  
- 食谱卡片 / 标题画面  
- 屏幕上显示的食材列表  
- 文字叠加层中的用量信息  
- 显示的分步说明  

**视觉模型提示词：**  
```
Analyze this frame from a cooking video. Extract any:
- Recipe name or title
- Ingredients with quantities
- Cooking instructions
- Nutritional information / macros
- Any other recipe-related text shown

If no recipe text is visible, respond with "No recipe text found."
```  

**合并策略：**  
- 音频转录 = 主要来源（口头说明的步骤）  
- 帧分析 = 补充来源（精确用量、食谱卡片）  
- 合并两者，优先采用视觉识别出的具体用量，而非音频推断结果  

## 置顶评论检测

在字幕中不区分大小写地扫描以下短语：  
- “食谱置顶”  
- “置顶于评论区”  
- “查看评论”  
- “在评论区中”  
- “下方评论”  
- “下方食谱”  
- “完整食谱见评论区”  

若检测到，提取完成后向用户标记并通知：

> "Heads up — the creator said the recipe is pinned in the comments.   
> I got what I could from the audio, but yt-dlp can't access pinned comments   
> without login. If you want the exact recipe, copy the pinned comment and   
> send it to me — I'll format it properly."  

## 系统要求

- `yt-dlp` — `brew install yt-dlp`  
- `ffmpeg` — `brew install ffmpeg`  
- `whisper` — `pip3 install openai-whisper`（本地运行，无需 API 密钥）  
- 公开 Reels 无需 Instagram 登录  