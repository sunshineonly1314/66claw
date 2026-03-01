---
name: prowlarr
name_zh: Prowlarr
version: 1.0.0
description: 搜索索引器并管理 Prowlarr。当用户提出“搜索 torrent”、“搜索索引器”、“查找资源”、“检查索引器状态”、“列出索引器”、“prowlarr 搜索”、“同步索引器”，或提及 Prowlarr/索引器管理时使用。
description_zh: 搜索索引器并管理 Prowlarr。当用户提出“搜索 torrent”、“搜索索引器”、“查找资源”、“检查索引器状态”、“列出索引器”、“prowlarr 搜索”、“同步索引器”，或提及 Prowlarr/索引器管理时使用。
---
# Prowlarr Skill（Prowlarr 技能）

通过 API 跨所有索引器执行搜索并管理 Prowlarr。

## 设置

配置文件路径：`~/.clawdbot/credentials/prowlarr/config.json`

```json
{
  "url": "https://prowlarr.example.com",
  "apiKey": "your-api-key"
}
```

获取 API 密钥路径：Prowlarr → Settings → General → Security → API Key（Prowlarr → 设置 → 常规 → 安全 → API 密钥）

---

## 快速参考

### 搜索资源

```bash
# Basic search across all indexers
./scripts/prowlarr-api.sh search "ubuntu 22.04"

# Search torrents only
./scripts/prowlarr-api.sh search "ubuntu" --torrents

# Search usenet only
./scripts/prowlarr-api.sh search "ubuntu" --usenet

# Search specific categories (2000=Movies, 5000=TV, 3000=Audio, 7000=Books)
./scripts/prowlarr-api.sh search "inception" --category 2000

# TV search with TVDB ID
./scripts/prowlarr-api.sh tv-search --tvdb 71663 --season 1 --episode 1

# Movie search with IMDB ID
./scripts/prowlarr-api.sh movie-search --imdb tt0111161
```

### 列出索引器

```bash
# All indexers
./scripts/prowlarr-api.sh indexers

# With status details
./scripts/prowlarr-api.sh indexers --verbose
```

### 索引器健康状态与统计信息

```bash
# Usage stats per indexer
./scripts/prowlarr-api.sh stats

# Test all indexers
./scripts/prowlarr-api.sh test-all

# Test specific indexer
./scripts/prowlarr-api.sh test <indexer-id>
```

### 索引器管理

```bash
# Enable/disable an indexer
./scripts/prowlarr-api.sh enable <indexer-id>
./scripts/prowlarr-api.sh disable <indexer-id>

# Delete an indexer
./scripts/prowlarr-api.sh delete <indexer-id>
```

### 应用程序同步

```bash
# Sync indexers to Sonarr/Radarr/etc
./scripts/prowlarr-api.sh sync

# List connected apps
./scripts/prowlarr-api.sh apps
```

### 系统操作

```bash
# System status
./scripts/prowlarr-api.sh status

# Health check
./scripts/prowlarr-api.sh health
```

---

## 搜索类别

| ID | 类别 |
|----|------|
| 2000 | 电影 |
| 5000 | 电视剧 |
| 3000 | 音频 |
| 7000 | 图书 |
| 1000 | 游戏主机 |
| 4000 | PC |
| 6000 | XXX |

子类别示例：2010（电影/外语）、2020（电影/其他）、2030（电影/标清）、2040（电影/高清）、2045（电影/超高清）、2050（电影/蓝光）、2060（电影/3D）、5010（电视剧/WEB-DL）、5020（电视剧/外语）、5030（电视剧/标清）、5040（电视剧/高清）、5045（电视剧/超高清）等。

---

## 常见使用场景

**“搜索最新的 Ubuntu ISO”**  
```bash
./scripts/prowlarr-api.sh search "ubuntu 24.04"
```

**“查找《权力的游戏》S01E01”**  
```bash
./scripts/prowlarr-api.sh tv-search --tvdb 121361 --season 1 --episode 1
```

**“以 4K 格式搜索《盗梦空间》”**  
```bash
./scripts/prowlarr-api.sh search "inception 2160p" --category 2045
```

**“检查我的索引器是否健康”**  
```bash
./scripts/prowlarr-api.sh stats
./scripts/prowlarr-api.sh test-all
```

**“将索引器变更推送至 Sonarr/Radarr”**  
```bash
./scripts/prowlarr-api.sh sync
```