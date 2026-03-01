---
name: tmdb
name_zh: TMDB
description: 通过 TMDb API 搜索电影/电视剧、获取演职人员、评分、流媒体播放信息及个性化推荐。
description_zh: 通过 TMDb API 搜索电影/电视剧、获取演职人员、评分、流媒体播放信息及个性化推荐。
homepage: https://www.themoviedb.org/
metadata: {"clawdis":{"emoji":"🎬","requires":{"bins":["uv"],"env":["TMDB_API_KEY"]},"primaryEnv":"TMDB_API_KEY"}}
---
# TMDb —— 影视数据库

提供全面的电影与电视剧信息，涵盖流媒体播放渠道、个性化推荐及用户偏好定制。

## 初始化设置

设置环境变量：  
- `TMDB_API_KEY`：您的 TMDb API 密钥（可在 themoviedb.org 免费获取）

## 快捷命令

### 搜索
```bash
# Search movies
uv run {baseDir}/scripts/tmdb.py search "Inception"

# Search TV shows
uv run {baseDir}/scripts/tmdb.py search "Breaking Bad" --tv

# Search people (actors, directors)
uv run {baseDir}/scripts/tmdb.py person "Christopher Nolan"
```

### 电影/剧集详情
```bash
# Full movie info
uv run {baseDir}/scripts/tmdb.py movie 27205

# With cast
uv run {baseDir}/scripts/tmdb.py movie 27205 --cast

# TV show details
uv run {baseDir}/scripts/tmdb.py tv 1396

# By name (searches first, then shows details)
uv run {baseDir}/scripts/tmdb.py info "The Dark Knight"
```

### 播放渠道查询
```bash
# Find streaming availability
uv run {baseDir}/scripts/tmdb.py where "Inception"
uv run {baseDir}/scripts/tmdb.py where 27205

# Specify region
uv run {baseDir}/scripts/tmdb.py where "Inception" --region GB
```

### 发现新内容
```bash
# Trending this week
uv run {baseDir}/scripts/tmdb.py trending
uv run {baseDir}/scripts/tmdb.py trending --tv

# Recommendations based on a movie
uv run {baseDir}/scripts/tmdb.py recommend "Inception"

# Advanced discover
uv run {baseDir}/scripts/tmdb.py discover --genre action --year 2024
uv run {baseDir}/scripts/tmdb.py discover --genre sci-fi --rating 7.5
```

### 个性化推荐
```bash
# Get personalized suggestions (uses Plex history + preferences)
uv run {baseDir}/scripts/tmdb.py suggest <user_id>

# Set preferences
uv run {baseDir}/scripts/tmdb.py pref <user_id> --genres "sci-fi,thriller,drama"
uv run {baseDir}/scripts/tmdb.py pref <user_id> --directors "Christopher Nolan,Denis Villeneuve"
uv run {baseDir}/scripts/tmdb.py pref <user_id> --avoid "horror,romance"

# View preferences
uv run {baseDir}/scripts/tmdb.py pref <user_id> --show
```

### 观看清单
```bash
# Add to watchlist
uv run {baseDir}/scripts/tmdb.py watchlist <user_id> add 27205
uv run {baseDir}/scripts/tmdb.py watchlist <user_id> add "Dune: Part Two"

# View watchlist
uv run {baseDir}/scripts/tmdb.py watchlist <user_id>

# Remove from watchlist
uv run {baseDir}/scripts/tmdb.py watchlist <user_id> rm 27205
```

## 集成能力

### Plex  
若已启用 Plex skill，则 `suggest` 命令将拉取最近观看历史，用于优化推荐结果。

### ppl.gift（CRM）  
若已启用 ppl skill，则用户偏好将以备注形式保存在其联系人档案中，实现跨会话持久化。

## 类型 ID 列表

`--genre` 过滤器常用类型：  
- action（28）、adventure（12）、animation（16）  
- comedy（35）、crime（80）、documentary（99）  
- drama（18）、family（10751）、fantasy（14）  
- horror（27）、mystery（9648）、romance（10749）  
- sci-fi（878）、thriller（53）、war（10752）  

## 注意事项

- TMDb API 免费层级配额：每 10 秒最多 40 次请求  
- 可用流媒体服务因地区而异（默认为美国）  
- 推荐结果融合了 TMDb 数据、用户偏好及观看历史  