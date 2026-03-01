---
name: steam
name_zh: Steam
description: 浏览、筛选并发现 Steam 游戏库中的游戏。支持按游戏时长、评测、Steam Deck 兼容性、类型及标签进行筛选。适用于用户询问其 Steam 游戏、推荐可玩内容、游戏推荐或 Steam Deck 兼容游戏等场景。
description_zh: 浏览、筛选并发现 Steam 游戏库中的游戏。支持按游戏时长、评测、Steam Deck 兼容性、类型及标签进行筛选。适用于用户询问其 Steam 游戏、推荐可玩内容、游戏推荐或 Steam Deck 兼容游戏等场景。
homepage: https://github.com/mjrussell/steam-cli
metadata:
  clawdbot:
    emoji: "🎮"
    requires:
      bins: ["steam"]
      env: ["STEAM_API_KEY"]
---
# Steam 游戏命令行工具

用于浏览与发现您 Steam 游戏库的命令行工具。支持按游戏时长、评测、Deck 兼容性、类型及标签进行筛选。

## 安装

```bash
npm install -g steam-games-cli
```

## 配置

1. 从 https://steamcommunity.com/dev/apikey 获取 Steam Web API 密钥  
2. 配置 CLI：  
```bash
steam config set-key YOUR_API_KEY
steam config set-user YOUR_STEAM_ID
```

## 命令

### 用户资料  

```bash
steam whoami               # Profile info and library stats
steam whoami --json
```

### 游戏库  

```bash
steam library              # List all games
steam library --limit 10   # Limit results
steam library --json       # JSON output for scripting
```

### 标签与类型（即时响应）

```bash
steam tags                 # List all 440+ Steam tags
steam tags --json
steam genres               # List all genres
steam genres --json
```

## 筛选选项

### 游戏时长  

```bash
steam library --unplayed                    # Never played
steam library --min-hours 10                # At least 10 hours
steam library --max-hours 5                 # Less than 5 hours
steam library --deck                        # Played on Steam Deck
```

### 评测（1–9 分制）

```bash
steam library --reviews very-positive       # Exact category
steam library --min-reviews 7               # Score 7+ (Positive and above)
steam library --show-reviews                # Show review column
```

**分类说明：** overwhelming-positive（9 分）、very-positive（8 分）、positive（7 分）、mostly-positive（6 分）、mixed（5 分）、mostly-negative（4 分）、negative（3 分）、very-negative（2 分）、overwhelming-negative（1 分）

### Steam Deck 兼容性  

```bash
steam library --deck-compat verified        # Verified only
steam library --deck-compat playable        # Playable only
steam library --deck-compat ok              # Verified OR Playable
steam library --show-compat                 # Show Deck column
```

### 标签与类型  

```bash
steam library --tag "Roguelike"             # Filter by tag
steam library --genre "Strategy"            # Filter by genre
steam library --show-tags                   # Show tags column
```

### 排序方式  

```bash
steam library --sort name                   # Alphabetical (default)
steam library --sort playtime               # Most played first
steam library --sort deck                   # Most Deck playtime first
steam library --sort reviews                # Best reviewed first
steam library --sort compat                 # Best Deck compat first
```

## AI Agent 工作流

该 CLI 针对 AI agents 进行了优化，支持流融合（stream fusion）与提前终止（early termination）。

### 第一步：快速发现可用标签/类型（即时响应）

```bash
steam tags --json
steam genres --json
```

### 第二步：按组合条件筛选游戏库

```bash
# Unplayed Deck Verified roguelikes with good reviews
steam library --unplayed --deck-compat verified --tag "Roguelike" --min-reviews 7 --limit 10 --json

# Well-reviewed strategy games under 5 hours
steam library --max-hours 5 --genre "Strategy" --min-reviews 8 --limit 5 --json

# Trading games playable on Deck
steam library --tag "Trading" --deck-compat ok --limit 10 --json
```

## 性能说明

- 本地筛选（如游戏时长、未游玩）优先执行——即时响应  
- 远程筛选（如评测、Deck 兼容性、标签）按每款游戏并行获取  
- 提前终止：达到设定数量上限即停止  
- 建议优先使用本地筛选条件，以最小化 API 调用次数  

## 使用示例

**用户：“我在 Steam Deck 上该玩什么？”**  
```bash
steam library --deck-compat verified --min-reviews 7 --sort playtime --limit 10
```

**用户：“我有哪些 Roguelike 游戏？”**  
```bash
steam library --tag "Roguelike" --show-tags --limit 20
```

**用户：“有哪些高评分但还没玩过的游戏？”**  
```bash
steam library --unplayed --min-reviews 8 --sort reviews --limit 10 --show-reviews
```

**用户：“我总共有多少款游戏？”**  
```bash
steam whoami
```

**用户：“有哪些策略类游戏支持 Steam Deck？”**  
```bash
steam library --genre "Strategy" --deck-compat ok --show-compat --limit 15
```

**用户：“有哪些可用的标签？”**  
```bash
steam tags --json
```

## 输出格式

- 默认：彩色表格  
- `--plain`：纯文本列表  
- `--json`：JSON 格式，适用于脚本或 AI agents  