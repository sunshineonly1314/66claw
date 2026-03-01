---
name: reddit-scraper
name_zh: Reddit爬取
description: "通过抓取 old.reddit.com 网页来读取和搜索 Reddit 帖子。当 Clawdbot 需要浏览 Reddit 内容——例如从子版块读取帖子、按主题搜索、监控特定社区时，请使用此技能。仅支持只读访问，无法发帖或评论。"
description_zh: 通过抓取 old.reddit.com 网页来读取和搜索 Reddit 帖子。当 Clawdbot 需要浏览 Reddit 内容——例如从子版块读取帖子、按主题搜索、监控特定社区时，请使用此技能。仅支持只读访问，无法发帖或评论。
---
# Reddit 技能 📰

使用 Reddit 公共 JSON API 读取和搜索 Reddit 帖子。无需 API 密钥。

## 快速开始

```bash
# Read top posts from a subreddit
python3 /root/clawd/skills/reddit/scripts/reddit_scraper.py --subreddit LocalLLaMA --limit 5

# Search for posts
python3 /root/clawd/skills/reddit/scripts/reddit_scraper.py --search "clawdbot" --limit 5

# Read newest posts
python3 /root/clawd/skills/reddit/scripts/reddit_scraper.py --subreddit ClaudeAI --sort nuevos --limit 5
```

## 选项

| 选项 | 短参数 | 描述 | 默认值 |
|--------|-------|-------------|---------|
| `--subreddit` | `-s` | 子版块名称（不带 r/ 前缀） | - |
| `--search` | `-q` | 搜索关键词 | - |
| `--sort` | - | 排序方式：hot（热门）、new（最新）、top（精华）、populares（西班牙语“热门”）、nuevos（西班牙语“最新”）、rising（上升） | top |
| `--time` | `-t` | 时间范围筛选：hour（小时）、day（天）、week（周）、month（月）、year（年）、all（全部） | day |
| `--limit` | `-n` | 帖子数量（上限 100） | 25 |
| `--json` | `-j` | 以 JSON 格式输出 | false |
| `--verbose` | `-v` | 显示帖子预览文本 | false |

## 示例

### 读取子版块帖子
```bash
# Top posts of the day (default)
python3 /root/clawd/skills/reddit/scripts/reddit_scraper.py --subreddit programming

# Hot posts
python3 /root/clawd/skills/reddit/scripts/reddit_scraper.py --subreddit programming --sort hot

# New posts
python3 /root/clawd/skills/reddit/scripts/reddit_scraper.py --subreddit programming --sort nuevos

# Top posts of the week
python3 /root/clawd/skills/reddit/scripts/reddit_scraper.py --subreddit programming --sort top --time week
```

### 搜索帖子
```bash
# Search all of Reddit
python3 /root/clawd/skills/reddit/scripts/reddit_scraper.py --search "machine learning"

# Search within a subreddit
python3 /root/clawd/skills/reddit/scripts/reddit_scraper.py --subreddit selfhosted --search "docker"

# Search with time filter
python3 /root/clawd/skills/reddit/scripts/reddit_scraper.py --search "AI news" --time week
```

### JSON 输出
```bash
# Get raw JSON data for processing
python3 /root/clawd/skills/reddit/scripts/reddit_scraper.py --subreddit technology --limit 3 --json
```

## 输出字段（JSON 格式）

- `title`：帖子标题  
- `author`：用户名  
- `score`：点赞数（净得票数）  
- `num_comments`：评论数  
- `url`：外部链接 URL  
- `permalink`：Reddit 讨论页 URL  
- `subreddit`：子版块名称  
- `created_utc`：Unix 时间戳  
- `selftext`：帖子正文（前 200 字符）  
- `upvote_ratio`：点赞百分比（0–1）

## 局限性

- **仅限只读**：无法发帖、评论或投票；  
- **速率限制**：若请求过于频繁，Reddit 可能实施限流；  
- **无需认证**：部分受限内容可能无法获取。

## 技术细节

实现细节详见 [TECHNICAL.md](references/TECHNICAL.md)。