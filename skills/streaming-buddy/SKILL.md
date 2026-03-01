---
name: streaming-buddy
name_zh: 直播助手
version: 2.0.0
description: "具备学习能力的个性化流媒体助手。追踪您的观看内容，学习您的口味偏好，并基于您订阅的服务、当前心情及偏好，为您推荐下一部想看的内容。当被问及电影、电视剧、流媒体服务、‘该看什么’、追踪观看进度等问题时启用。触发方式：/stream、‘我该看什么’、‘推荐点什么’、提及 Netflix/Prime/Disney+/Apple TV+、询问剧集/季/集、或提出基于心情的请求（如‘来点刺激的’）"
description_zh: 具备学习能力的个性化流媒体助手。追踪您的观看内容，学习您的口味偏好，并基于您订阅的服务、当前心情及偏好，为您推荐下一部想看的内容。当被问及电影、电视剧、流媒体服务、‘该看什么’、追踪观看进度等问题时启用。触发方式：/stream、‘我该看什么’、‘推荐点什么’、提及 Netflix/Prime/Disney+/Apple TV+、询问剧集/季/集、或提出基于心情的请求（如‘来点刺激的’）
author: clawdbot
license: MIT
metadata:
  clawdbot:
    emoji: "📺"
    triggers: ["/stream"]
    requires:
      bins: ["jq", "curl"]
      env: ["TMDB_API_KEY"]
  tags: ["streaming", "movies", "tv-shows", "recommendations", "entertainment", "learning", "preferences"]
---
# Streaming Buddy 📺

一款个性化流媒体助手，可学习您的口味偏好、追踪您的观看习惯，并为您智能推荐下一部想看的内容。

## 主要功能

- **搜索与信息查询**：借助 TMDB 数据查找电影/电视剧  
- **观看追踪**：记录您当前正在观看的内容及进度  
- **学习系统**：根据您的点赞/点踩/评分持续学习偏好  
- **智能推荐**：基于您的口味偏好生成个性化推荐  
- **心情导向搜索**：按心情（如刺激、放松、惊悚等）查找内容  
- **可用性检查**：显示您已订阅的哪些服务提供该内容  
- **匹配解释**：说明某部作品为何契合您的偏好  

## 命令列表

| 命令 | 功能说明 |
|------|----------|
| `/stream` | 显示状态及全部可用命令 |
| `/stream search <title>` | 搜索电影/电视剧 |
| `/stream info <id> [tv\|movie]` | 查看详情 + 可用性信息 |
| `/stream watch <id> [tv\|movie]` | 开始追踪某部作品 |
| `/stream progress S01E05` | 更新当前剧集的观看进度 |
| `/stream done [1-5]` | 标记为已完成 + 评分（自动学习） |
| `/stream like [id]` | 标记为喜欢 → 学习偏好 |
| `/stream dislike [id]` | 标记为不喜欢 → 学习偏好 |
| `/stream suggest [service] [tv\|movie]` | 获取个性化推荐 |
| `/stream mood <mood>` | 按心情搜索内容 |
| `/stream surprise` | 随机推荐一部作品 |
| `/stream why <id>` | 解释该推荐为何契合您 |
| `/stream watchlist` | 查看您的愿望清单（watchlist） |
| `/stream watchlist add <id>` | 添加至愿望清单 |
| `/stream history` | 查看观看历史 |
| `/stream profile` | 查看您的口味偏好档案 |
| `/stream services` | 管理流媒体订阅服务 |
| `/stream services add <name>` | 添加一项服务 |
| `/stream services remove <name>` | 移除一项服务 |

## 心情选项与对应类型

| 心情 | 对应类型 |
|------|----------|
| `exciting` | Action（动作）、Thriller（惊悚）、Sci-Fi（科幻）、Adventure（冒险） |
| `relaxing` | Comedy（喜剧）、Animation（动画）、Family（家庭）、Documentary（纪录片） |
| `thoughtful` | Drama（剧情）、Mystery（悬疑）、History（历史） |
| `scary` | Horror（恐怖）、Thriller（惊悚） |
| `romantic` | Romance（爱情）、Drama（剧情） |
| `funny` | Comedy（喜剧）、Animation（动画） |

## 支持的服务

- `netflix`、`amazon-prime`、`disney-plus`、`apple-tv-plus`  
- `youtube-premium`、`wow`、`paramount-plus`、`crunchyroll`  
- `joyn`、`rtl`、`magenta`、`mubi`  

## 学习系统

该 agent 通过以下方式学习您的偏好：

1. **评分反馈**：当您使用 `/stream done [1-5]` 完成观看时：  
   - 评分为 4–5 分：将对应类型、主题、演员加入“喜欢”列表  
   - 评分为 1–2 分：将对应类型加入“回避”列表  

2. **显式反馈**：使用 `/stream like` 和 `/stream dislike`：  
   - 提取类型、主题、演员、导演等信息  
   - 动态更新偏好权重  

3. **偏好档案（Preference Profile）包含：**  
   - 类型偏好（加权评分）  
   - 喜欢/回避的主题  
   - 最喜爱的演员与导演  
   - 自定义心情映射关系  

## Handler 使用方式

```bash
# Core commands
handler.sh status $WORKSPACE
handler.sh search "severance" $WORKSPACE
handler.sh info 95396 tv $WORKSPACE
handler.sh watch 95396 tv $WORKSPACE
handler.sh progress S01E05 $WORKSPACE
handler.sh done 5 "Great show!" $WORKSPACE

# Learning commands
handler.sh like $WORKSPACE                    # Like current watching
handler.sh like 12345 movie $WORKSPACE        # Like specific title
handler.sh dislike $WORKSPACE
handler.sh why 95396 tv $WORKSPACE
handler.sh profile $WORKSPACE

# Recommendation commands
handler.sh suggest $WORKSPACE                 # All services, all types
handler.sh suggest prime movie $WORKSPACE     # Prime movies only
handler.sh mood exciting $WORKSPACE
handler.sh mood relaxing tv $WORKSPACE
handler.sh surprise $WORKSPACE

# List commands
handler.sh watchlist list $WORKSPACE
handler.sh watchlist add 12345 tv $WORKSPACE
handler.sh history $WORKSPACE

# Service management
handler.sh services list $WORKSPACE
handler.sh services add netflix $WORKSPACE
handler.sh services remove netflix $WORKSPACE
```

## 数据文件

所有数据均存储于 `$WORKSPACE/memory/streaming-buddy/` 目录中：

| 文件 | 用途 |
|------|------|
| `config.json` | 存储 TMDB API 密钥、地区、语言等配置 |
| `profile.json` | 用户档案元数据 |
| `services.json` | 当前已订阅的流媒体服务列表 |
| `preferences.json` | 已学习的口味偏好数据 |
| `watching.json` | 当前正在观看的内容 |
| `watchlist.json` | 愿望清单（Want to watch list） |
| `history.json` | 已观看内容及评分记录 |
| `cache/*.json` | API 响应缓存（24 小时） |

## 设置步骤

1. 获取 TMDB API 密钥：https://www.themoviedb.org/settings/api  
2. 将密钥写入 `memory/streaming-buddy/config.json` 文件：  
   ```json
   {
     "tmdbApiKey": "your_api_key",
     "region": "DE",
     "language": "de-DE"
   }
   ```  
3. 运行 `/stream setup` 配置您的流媒体服务  

## 对话示例

**基于心情的搜索：**  
```
User: I want something exciting tonight
Bot: 🎬 Exciting picks for you:
     1. Reacher S3 (Prime) ⭐8.5
     2. Jack Ryan (Prime) ⭐8.1
     ...
```

**通过反馈学习偏好：**  
```
User: /stream done 5
Bot: ✅ Severance marked as done (⭐5)
     📚 Learned: +Drama, +Mystery, +Sci-Fi
     Actors: Adam Scott, Britt Lower saved to favorites
```

**解释推荐理由：**  
```
User: /stream why 95396
Bot: 🎯 Why Severance matches you:
     ✓ Genre "Drama" (you like this, +2)
     ✓ Genre "Mystery" (you like this, +2)
     ✓ Theme "office" in your preferences
     ✓ With Adam Scott (your favorite)
     Similar to: Fallout ⭐5
```

## 多语言支持

- 语言由 `config.json` 自动检测（依据 `language: "de-DE"` 或 `"en"`）  
- 所有输出内容适配已配置的语言  
- 命令可在任意语言下使用  

## 系统依赖

- `jq`（JSON 处理器）  
- `curl`（HTTP 客户端）  
- `bash` 4.0+  
- TMDB API 密钥（免费获取）  

## 参考文档

- [services.md](references/services.md) — 流媒体服务完整列表  
- [tmdb-api.md](references/tmdb-api.md) — TMDB API 使用说明  
- [justwatch.md](references/justwatch.md) — 可用性数据集成说明  