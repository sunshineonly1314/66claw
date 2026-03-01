---
name: firecrawler
name_zh: Firecrawler
description: 使用 Firecrawl API 进行网页抓取与爬取。可将网页内容获取为 Markdown 格式、截取全页截图、提取结构化数据、执行 Web 搜索，以及爬取文档类网站。当用户需要抓取某个 URL、获取当前网页信息、截取屏幕快照、从页面中提取特定数据，或为某框架/库爬取文档时，请使用本 skill。
description_zh: 使用 Firecrawl API 进行网页抓取与爬取。可将网页内容获取为 Markdown 格式、截取全页截图、提取结构化数据、执行 Web 搜索，以及爬取文档类网站。当用户需要抓取某个 URL、获取当前网页信息、截取屏幕快照、从页面中提取特定数据，或为某框架/库爬取文档时，请使用本 skill。
version: 1.0.0
author: captmarbles
---
# Firecrawl Web Skill

使用 [Firecrawl](https://firecrawl.dev) 抓取、搜索和爬取网页。

## 配置（Setup）

1. 从 [firecrawl.dev/app/api-keys](https://www.firecrawl.dev/app/api-keys) 获取您的 API 密钥  
2. 设置环境变量：  
   ```bash
   export FIRECRAWL_API_KEY=fc-your-key-here
   ```  
3. 安装 SDK：  
   ```bash
   pip3 install firecrawl
   ```  

## 使用方法（Usage）

所有命令均调用本 skill 目录下打包的 `fc.py` 脚本。

### 将网页获取为 Markdown

获取任意 URL 并转换为干净的 Markdown 格式。支持处理 JavaScript 渲染的内容。

```bash
python3 fc.py markdown "https://example.com"
python3 fc.py markdown "https://example.com" --main-only  # skip nav/footer
```

### 截取屏幕快照（Screenshot）

捕获任意 URL 的全页截图。

```bash
python3 fc.py screenshot "https://example.com" -o screenshot.png
```

### 提取结构化数据

依据 JSON Schema 从网页中提取指定字段。

**Schema 示例** (`schema.json`)：  
```json
{
  "type": "object",
  "properties": {
    "title": { "type": "string" },
    "price": { "type": "number" },
    "features": { "type": "array", "items": { "type": "string" } }
  }
}
```

```bash
python3 fc.py extract "https://example.com/product" --schema schema.json
python3 fc.py extract "https://example.com/product" --schema schema.json --prompt "Extract the main product details"
```

### Web 搜索

执行 Web 搜索并获取结果内容（可能需要付费套餐）。

```bash
python3 fc.py search "Python 3.13 new features" --limit 5
```

### 爬取文档网站

爬取整套文档网站。非常适合学习新框架。

```bash
python3 fc.py crawl "https://docs.example.com" --limit 30
python3 fc.py crawl "https://docs.example.com" --limit 50 --output ./docs
```

**注意**：每爬取一个页面消耗 1 个积分。请设置合理的限制。

### 映射网站 URL 列表（Map Site URLs）

在决定抓取哪些内容前，先发现网站上的全部 URL。

```bash
python3 fc.py map "https://example.com" --limit 100
python3 fc.py map "https://example.com" --search "api"
```

## 示例提示词（Example Prompts）

- *“抓取 https://blog.example.com/post 并为其生成摘要”*  
- *“截取 stripe.com 的屏幕快照”*  
- *“从此产品页面中提取名称、价格和功能列表”*  
- *“爬取 Astro 官方文档，以便协助我构建网站”*  
- *“映射 docs.stripe.com 上的所有 URL”*  

## 定价（Pricing）

免费套餐包含 500 个积分。1 积分 = 1 个页面 / 1 次截图 / 1 次搜索查询。