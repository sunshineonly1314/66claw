---
name: searxng-self-hosted
name_zh: 自托管 SearXNG
description: 使用自托管的 SearXNG 实例搜索网络。尊重隐私的元搜索引擎，聚合来自多个引擎的结果。
description_zh: 使用自托管的 SearXNG 实例搜索网络。尊重隐私的元搜索引擎，聚合来自多个引擎的结果。
metadata:
  clawdbot:
    config:
      optionalEnv:
        - SEARXNG_URL
---
# SearXNG 搜索 skill

使用您自托管的 SearXNG 实例搜索网络。该尊重隐私的元搜索引擎可聚合来自 Google、DuckDuckGo、Brave、Startpage 及 70 多个其他搜索引擎的结果。

## 前置条件

SearXNG 已在本地或服务器上运行。快速 Docker 部署方式如下：

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

## 配置

设置 SearXNG 的 URL（默认为 http://localhost:8080）：
```bash
export SEARXNG_URL="http://localhost:8080"
```

## 使用示例

### 基础搜索
```bash
curl "http://localhost:8080/search?q=your+query&format=json" | jq '.results[:5]'
```

### 按分类搜索
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

每条结果包含以下字段：
- `title` — 结果标题
- `url` — 结果链接  
- `content` — 片段/描述
- `engines` — 返回该结果的搜索引擎数组
- `score` — 相关性得分（越高表示越相关）
- `category` — 结果分类

## Shell 函数

添加到您的 `.zshrc` 或 `.bashrc` 中：

```bash
searxng() {
  local query="$*"
  local url="${SEARXNG_URL:-http://localhost:8080}"
  curl -s "${url}/search?q=$(echo "$query" | sed 's/ /+/g')&format=json" | \
    jq -r '.results[:10][] | "[\(.score | floor)] \(.title)\n    \(.url)\n    \(.content // "No description")\n"'
}
```

用法：`searxng how to make sourdough bread`

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

**JSON 格式不生效：**
确保 `formats: [html, json]` 已在您的 settings.yml 中启用

**无搜索结果：**
部分搜索引擎可能受到速率限制。请检查日志中是否存在错误。

## 为何选择 SearXNG？

- **隐私保护**：不追踪、无广告、不收集数据
- **聚合能力**：整合来自 70 多个搜索引擎的结果
- **自托管**：您的数据始终保留在您自己的设备上
- **API 支持**：提供 JSON 输出，便于自动化集成
- **免费开源**：无需 API 密钥，亦无调用频率限制