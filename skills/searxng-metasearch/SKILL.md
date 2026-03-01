---
name: searxng-metasearch
name_zh: SearXNG 元搜索
description: 使用自托管的 SearXNG 实例搜索网页。一款尊重隐私的元搜索引擎，可聚合来自多个搜索引擎的结果。
description_zh: 使用自托管的 SearXNG 实例搜索网页。一款尊重隐私的元搜索引擎，可聚合来自多个搜索引擎的结果。
metadata:
  clawdbot:
    config:
      optionalEnv:
        - SEARXNG_URL
---
# SearXNG 搜索 Skill

使用您自托管的 SearXNG 实例搜索网页。一款尊重隐私的元搜索引擎，可聚合 Google、DuckDuckGo、Brave、Startpage 及 70+ 其他搜索引擎的结果。

## 前置依赖

SearXNG 需在本地或服务器上运行。快速 Docker 部署方式如下：

```bash
mkdir -p ~/Projects/searxng/searxng
cd ~/Projects/searxng

# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
services:
  searxng:
    image: searxng/searxng:latest
    container_name: searxng
    ports:
      - "8080:8080"
    volumes:
      - ./searxng:/etc/searxng:rw
    environment:
      - SEARXNG_BASE_URL=http://localhost:8080/
    restart: unless-stopped
EOF

# Create settings.yml with JSON API enabled
cat > searxng/settings.yml << 'EOF'
use_default_settings: true
server:
  secret_key: "change-me-to-random-string"
  bind_address: "0.0.0.0"
  port: 8080
search:
  safe_search: 0
  autocomplete: "google"
  default_lang: "en"
  formats:
    - html
    - json
EOF

# Start SearXNG
docker compose up -d
```

## 配置说明

设置 SearXNG URL（默认为 http://localhost:8080）：
```bash
export SEARXNG_URL="http://localhost:8080"
```

## 使用示例

### 基础搜索
```bash
curl "http://localhost:8080/search?q=your+query&format=json" | jq '.results[:5]'
```

### 按类别搜索
```bash
# General web search
curl "http://localhost:8080/search?q=query&categories=general&format=json"

# Images
curl "http://localhost:8080/search?q=query&categories=images&format=json"

# News
curl "http://localhost:8080/search?q=query&categories=news&format=json"

# Videos
curl "http://localhost:8080/search?q=query&categories=videos&format=json"

# IT/Tech documentation
curl "http://localhost:8080/search?q=query&categories=it&format=json"

# Science/Academic
curl "http://localhost:8080/search?q=query&categories=science&format=json"
```

### 按语言/地区搜索
```bash
curl "http://localhost:8080/search?q=query&language=en-US&format=json"
curl "http://localhost:8080/search?q=query&language=de-DE&format=json"
```

### 分页结果
```bash
# Page 2 (results 11-20)
curl "http://localhost:8080/search?q=query&pageno=2&format=json"
```

## 响应格式

每个结果包含以下字段：
- `title` —— 结果标题  
- `url` —— 结果链接  
- `content` —— 摘要/描述  
- `engines` —— 返回该结果的搜索引擎数组  
- `score` —— 相关性得分（数值越高表示越相关）  
- `category` —— 结果所属类别  

## Shell 函数

添加至您的 `.zshrc` 或 `.bashrc`：

```bash
searxng() {
  local query="$*"
  local url="${SEARXNG_URL:-http://localhost:8080}"
  curl -s "${url}/search?q=$(echo "$query" | sed 's/ /+/g')&format=json" | \
    jq -r '.results[:10][] | "[\(.score | floor)] \(.title)\n    \(.url)\n    \(.content // "No description")\n"'
}
```

使用方式： `searxng how to make sourdough bread`

## Docker 管理

```bash
# Start
cd ~/Projects/searxng && docker compose up -d

# Stop
docker compose down

# View logs
docker compose logs -f searxng

# Restart
docker compose restart
```

## 故障排除

**容器无法启动：**  
```bash
docker compose logs searxng
```

**JSON 格式不可用：**  
请确保 settings.yml 中已启用 `formats: [html, json]`

**无搜索结果：**  
部分搜索引擎可能遭遇限流。请检查日志获取错误信息。

## 为何选择 SearXNG？

- **隐私保护：** 无追踪、无广告、无数据采集  
- **聚合能力：** 整合 70+ 搜索引擎的结果  
- **自托管：** 您的数据始终保留在您的设备上  
- **API 支持：** 提供 JSON 输出，便于自动化  
- **免费开放：** 无需 API 密钥，无调用频率限制  