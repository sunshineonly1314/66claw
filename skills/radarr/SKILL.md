---
name: radarr
name_zh: Radarr
version: 1.0.1
description: 在 Radarr 中搜索并添加电影。支持合集（collections）及“添加时即搜索”（search-on-add）选项。
description_zh: 在 Radarr 中搜索并添加电影。支持合集（collections）及“添加时即搜索”（search-on-add）选项。
metadata: {"clawdbot":{"emoji":"🎬","requires":{"bins":["curl","jq"]}}}
---
# Radarr

使用合集支持功能，将电影添加至您的 Radarr 影片库。

## 配置

创建 `~/.clawdbot/credentials/radarr/config.json`：
```json
{
  "url": "http://localhost:7878",
  "apiKey": "your-api-key",
  "defaultQualityProfile": 1
}
```
- `defaultQualityProfile`：画质配置文件 ID（运行 `config` 查看可选项）

## 工作流

1. **搜索**：`search "Movie Name"` — 返回带编号的结果列表  
2. **呈现结果并附 TMDB 链接** — 始终显示可点击链接  
3. **确认选择**：用户输入对应编号  
4. **合集提示**：若该电影属于某合集，则向用户询问是否添加整个合集  
5. **添加**：添加单部电影或整个合集  

## 重要说明
- 向用户呈现搜索结果时，**必须始终包含 TMDB 链接**  
- 格式为：`[Title (Year)](https://themoviedb.org/movie/ID)`  
- 使用配置中指定的 `defaultQualityProfile`；可在每次添加时单独覆盖  

## 命令

### 搜索电影
```bash
bash scripts/radarr.sh search "Inception"
```

### 检查电影是否已在影片库中
```bash
bash scripts/radarr.sh exists <tmdbId>
```

### 添加一部电影（默认立即执行搜索）
```bash
bash scripts/radarr.sh add <tmdbId>           # searches right away
bash scripts/radarr.sh add <tmdbId> --no-search  # don't search
```

### 添加整部合集（默认立即执行搜索）
```bash
bash scripts/radarr.sh add-collection <collectionTmdbId>
bash scripts/radarr.sh add-collection <collectionTmdbId> --no-search
```

### 删除一部电影
```bash
bash scripts/radarr.sh remove <tmdbId>              # keep files
bash scripts/radarr.sh remove <tmdbId> --delete-files  # delete files too
```  
**删除时务必询问用户是否同时删除文件！**

### 获取根目录与画质配置文件（用于配置）
```bash
bash scripts/radarr.sh config
```