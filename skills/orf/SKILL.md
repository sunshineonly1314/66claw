---
name: orf-digest
name_zh: ORF
description: "按需生成德语版 ORF 新闻简报。当用户说出 'orf'、'pull orf' 或 'orf 10' 时触发。聚焦奥地利国内政治（Inland）与国际政治（Ausland），并涵盖重大头条新闻；排除体育类内容。每条新闻须单独发送为一条消息（标题 + 发布时间 + 链接）。随后，生成一幅 Nano Banana 风格的卡通 ZiB 演播室图像，画面中主持人正在播报新闻，并在细节中嵌入基于所选新闻的隐晦彩蛋（Easter eggs）。",
description_zh: "按需生成德语版 ORF 新闻简报。当用户说出 'orf'、'pull orf' 或 'orf 10' 时触发。聚焦奥地利国内政治（Inland）与国际政治（Ausland），并涵盖重大头条新闻；排除体育类内容。每条新闻须单独发送为一条消息（标题 + 发布时间 + 链接）。随后，生成一幅 Nano Banana 风格的卡通 ZiB 演播室图像，画面中主持人正在播报新闻，并在细节中嵌入基于所选新闻的隐晦彩蛋（Easter eggs）。",
---
# ORF 新闻简报（news.orf.at）

## 命令格式

将用户消息中以 `orf` 开头的内容解释为请求 ORF 新闻简报。

支持的形式如下：

- `orf` → 默认返回 5 条新闻  
- `orf <n>` → 返回 n 条新闻（最多 15 条）  
- `orf inland` / `orf ausland` → 指定倾向性（bias）筛选  
- `orf <n> inland|ausland` → 同时包含两类倾向性内容  

## 数据来源与范围

- 主要数据源：`news.orf.at`（德语）  
- 优先选取：**Inland**（奥地利国内）政治、**Ausland**（即国际）政治，以及重大头条新闻。  
- 排除：体育（Sport）类内容。  

## 输出要求

- **不得**附加任何额外评论、开场白或结束语。  
- 所有结果须以**独立消息**形式发送。  
- 每条新闻消息必须严格遵循以下三行格式：  
  - 第一行：新闻标题（德语）  
  - 第二行：`<age>`（例如 `45m ago`、`6h ago`、`2d ago`）  
  - 第三行：ORF 新闻链接  
- 在全部新闻消息发送完毕后，**再发送一条最终消息**，内容为生成的图像。  
  - 图像须在环绕式演播室视频墙中直观呈现所抓取的新闻内容，使用 **4–6 个独立的故事面板**。  
  - **面板布局要求（必须满足）：**  
    - 顶部：醒目的大号主题标签（2–3 个单词，全大写）  
    - 中部：较小字号的迷你标题（3–6 个单词，符合新闻风格）  
    - 底部：恰好 1–2 个简洁图标（禁止使用地图，禁止复杂拼贴）  
  - **可读性要求：** 文字须精简，并保持足够大的字号以确保清晰渲染。  
  - 禁止添加任何 logo 或水印。  
  - 若聊天平台要求媒体消息附带非空文字，则仅使用最简短的说明文字 `.`。  

## 执行流程

1. 从用户消息中解析 `n` 及可选的 `focus`（`inland`｜`ausland`）。  
2. 运行 `python3 skills/orf-digest/scripts/orf.py --count <n> --focus <focus> --format json`。  
3. 将每条返回的新闻按上述三行格式，各自作为一条独立消息发送。  
4. 通过 Nano Banana 生成 ZiB 演播室氛围图像：  
   - 基于新闻条目构建提示词：`python3 skills/orf-digest/scripts/orf.py --count <n> --focus <focus> --format json | node skills/orf-digest/scripts/zib_prompt.mjs`  
   - 执行图像生成：`skills/orf-digest/scripts/generate_zib_nano_banana.sh ./tmp/orf-zib/zib.png`  
   - 将生成的图像作为最终一条消息发出。  

若抓取/解析失败，或返回 0 条新闻：  
- 使用浏览器工具打开 `https://news.orf.at/`，凭人工判断选取 N 条非体育类头条新闻，并以相同三行格式发送。  
- 仍需生成一幅 ZiB 演播室图像，其中嵌入若干通用型政治新闻彩蛋（Easter eggs）。