---
name: brightdata
name_zh: Bright Data
description: 通过 Bright Data API 进行网页抓取与搜索。需设置 BRIGHTDATA_API_KEY 和 BRIGHTDATA_UNLOCKER_ZONE 环境变量。可用于将任意网页抓取为 Markdown 格式（绕过机器人检测/CAPTCHA），或对 Google 进行结构化结果搜索。
description_zh: 通过 Bright Data API 进行网页抓取与搜索。需设置 BRIGHTDATA_API_KEY 和 BRIGHTDATA_UNLOCKER_ZONE 环境变量。可用于将任意网页抓取为 Markdown 格式（绕过机器人检测/CAPTCHA），或对 Google 进行结构化结果搜索。
---
# Bright Data — 网页抓取与搜索

直接通过 API 访问 Bright Data 的 Web Unlocker 和 SERP（搜索引擎结果页）服务。

## 设置

**1. 获取您的 API 密钥：**  
从 [Bright Data 控制台](https://brightdata.com/cp) 获取密钥。

**2. 创建 Web Unlocker 区域（zone）：**  
在 brightdata.com/cp 页面点击右上角“Add”按钮，选择“Unlocker zone”以创建区域。

**3. 设置环境变量：**  
```bash
export BRIGHTDATA_API_KEY="your-api-key"
export BRIGHTDATA_UNLOCKER_ZONE="your-zone-name"
```

## 使用方法

### Google 搜索
搜索 Google 并获取结构化的 JSON 结果（含标题、链接、描述）。
```bash
bash scripts/search.sh "query" [cursor]
```
- `cursor`：可选的分页页码（从 0 开始计数，默认为 0）

### 网页抓取
将任意网页抓取为 Markdown 格式。可绕过机器人检测与 CAPTCHA。
```bash
bash scripts/scrape.sh "url"
```

## 输出格式

### 搜索结果
返回包含结构化 `organic` 数组的 JSON：
```json
{
  "organic": [
    {"link": "...", "title": "...", "description": "..."}
  ]
}
```

### 抓取结果
返回网页的干净 Markdown 内容。