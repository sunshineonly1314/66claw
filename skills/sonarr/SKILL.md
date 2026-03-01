---
name: sonarr
name_zh: Sonarr
version: 1.0.0
description: 在 Sonarr 中搜索并添加电视剧。支持监控选项与“添加即搜索”功能。
description_zh: 在 Sonarr 中搜索并添加电视剧。支持监控选项与“添加即搜索”功能。
metadata: {"clawdbot":{"emoji":"📺","requires":{"bins":["curl","jq"]}}}
---
# Sonarr

将电视剧添加至你的 Sonarr 影视库。

## 配置

创建 `~/.clawdbot/credentials/sonarr/config.json`：  
```json
{
  "url": "http://localhost:8989",
  "apiKey": "your-api-key",
  "defaultQualityProfile": 1
}
```  
- `defaultQualityProfile`：画质配置文件 ID（运行 `config` 查看可选项）

## 工作流

1. **搜索**：`search "Show Name"` —— 返回编号列表  
2. **呈现结果并附 TVDB 链接** —— 始终提供可点击链接  
3. **确认**：用户选择编号  
4. **添加**：添加剧集并立即启动搜索  

## 重要说明  
- **呈现搜索结果时，必须始终包含 TVDB 链接**  
- 格式：`[Title (Year)](https://thetvdb.com/series/SLUG)`  
- 使用配置中的 `defaultQualityProfile`；可在添加时覆盖该值  

## 命令

### 搜索剧集  
```bash
bash scripts/sonarr.sh search "Breaking Bad"
```

### 检查剧集是否已在影视库中  
```bash
bash scripts/sonarr.sh exists <tvdbId>
```

### 添加剧集（默认立即搜索）  
```bash
bash scripts/sonarr.sh add <tvdbId>              # searches right away
bash scripts/sonarr.sh add <tvdbId> --no-search  # don't search
```

### 删除剧集  
```bash
bash scripts/sonarr.sh remove <tvdbId>                # keep files
bash scripts/sonarr.sh remove <tvdbId> --delete-files # delete files too
```  
**删除时务必询问用户是否要一并删除文件！**

### 获取根目录与画质配置文件（用于配置）  
```bash
bash scripts/sonarr.sh config
```