---
name: hn-digest
name_zh: HN简报
description: "按需获取并发送 Hacker News 首页帖子。当用户请求 HN、说 'hn'、'pull HN'、'hn 10'，或指定主题（如 'hn health'、'hn hacking'、'hn tech'）时触发。发送 N 篇（默认为 5 篇）帖子，每篇以标题 + 链接形式单独成条消息。排除加密货币（crypto）相关内容。"
description_zh: 按需获取并发送 Hacker News 首页帖子。当用户请求 HN、说 'hn'、'pull HN'、'hn 10'，或指定主题（如 'hn health'、'hn hacking'、'hn tech'）时触发。发送 N 篇（默认为 5 篇）帖子，每篇以标题 + 链接形式单独成条消息。排除加密货币（crypto）相关内容。
---
# HN Digest（HN 摘要）

## 命令格式

将用户消息中以 `hn` 开头的内容解释为请求 Hacker News 首页摘要。

支持的形式包括：

- `hn` → 默认发送 5 篇
- `hn <n>` → 发送 n 篇
- `hn <topic>` → 按主题筛选/提升相关性
- `hn <n> <topic>` → 同时指定数量与主题
- 若用户在已查看部分内容后要求“更多”（例如：“我们已看过前 10 名，现在请显示第 10–15 名”），应将其视为偏移量请求，并使用 `--offset`（例如：偏移量为 10，数量为 10）。

主题包括：

- `tech`（默认）
- `health`
- `hacking`
- `life` / `lifehacks`

## 输出要求

- **不得** 添加任何额外说明、前言或结语。
- 结果须以 **独立消息** 形式逐条发送。
- 每条帖子消息必须严格遵循以下三行格式：
  - 第一行：帖子标题
  - 第二行：`<age> · <commentCount> comments`（时间标识，例如 `45m ago`、`6h ago`、`3d ago`）
  - 第三行：Hacker News 评论链接（`https://news.ycombinator.com/item?id=...`）
- 在所有帖子消息之后，再发送 **一条最终消息**，即生成的图像。
  - 若聊天平台要求媒体消息附带非空文字，则使用最简短的图说 `.`。
- 严格排除加密货币（crypto）相关内容。

## 执行流程

1. 从用户消息中解析 `n` 和 `topic`。
2. 获取并排序帖子：
   - 运行 `node skills/hn-digest/scripts/hn.mjs --count <n> --offset <offset> --topic <topic> --format json`。
   - 默认 `offset` 为 0；除非用户明确在前一批结果后请求“更多/下一批”，否则不设偏移。
3. 按上述三行格式，将结果作为 **N 条独立消息** 发送。
4. 接着，通过 Nano Banana 生成一幅 **令人愉悦的情绪图像**，其灵感源自您刚刚发送的帖子：
   - 使用 `skills/hn-digest/scripts/mood_prompt.mjs` 从 JSON 数据项中构建提示词（prompt）。
   - 添加 3–4 个源自帖子主题的微妙彩蛋（不可含文字或 Logo；保持趣味性）。
   - 通过运行以下命令生成并附加图像：
     - `skills/hn-digest/scripts/generate_mood_nano_banana.sh ./tmp/hn-mood/hn-mood.png <topic> <n> <offset>`
   - 将生成的图像作为一条额外消息发送。

若获取/排序失败，或返回 0 条结果：
- 在浏览器工具中使用 `https://news.ycombinator.com/`，凭主观判断选取 N 条非加密货币类内容，并以相同三行格式发送。
- 仍需生成一幅情绪图像（整体风格为“HN 技术深度探讨”），并加入香蕉彩蛋。