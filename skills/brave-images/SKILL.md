---
name: brave-images
name_zh: Brave图片
description: 使用 Brave 搜索 API 搜索图像。当需要查找任意主题的图像、图片、照片或视觉内容时使用。需配置 BRAVE_API_KEY 环境变量。
description_zh: 使用 Brave 搜索 API 搜索图像。当需要查找任意主题的图像、图片、照片或视觉内容时使用。需配置 BRAVE_API_KEY 环境变量。
---
# Brave 图像搜索

通过 Brave 搜索 API 搜索图像。

## 使用方法

```bash
curl -s "https://api.search.brave.com/res/v1/images/search?q=QUERY&count=COUNT" \
  -H "X-Subscription-Token: $BRAVE_API_KEY"
```

## 参数

| 参数 | 是否必需 | 描述 |
|------|----------|------|
| `q` | 是 | 搜索关键词（需 URL 编码） |
| `count` | 否 | 返回结果数量（1–100，默认为 20） |
| `country` | 否 | 地区偏好代码（两位字母，如 US、DE、IL） |
| `search_lang` | 否 | 语言代码（如 en、de、he） |
| `safesearch` | 否 | 安全过滤级别：off、moderate、strict（默认为 moderate） |

## 响应解析

每个结果中的关键字段：
- `results[].title` — 图像标题
- `results[].properties.url` — 图像完整 URL
- `results[].thumbnail.src` — 缩略图 URL  
- `results[].source` — 图像来源网站
- `results[].properties.width/height` — 图像尺寸

## 示例

在以色列搜索 “sunset beach”（日落海滩）相关图像：
```bash
curl -s "https://api.search.brave.com/res/v1/images/search?q=sunset%20beach&count=5&country=IL" \
  -H "X-Subscription-Token: $BRAVE_API_KEY"
```

然后从 JSON 响应中提取：
- 缩略图：`.results[0].thumbnail.src`
- 完整图像：`.results[0].properties.url`

## 结果交付

向用户呈现图像搜索结果时，请遵循：
1. 直接向用户发送图像（切勿仅列出 URL）
2. 使用 `results[].properties.url` 显示完整图像，或 `results[].thumbnail.src` 显示缩略图
3. 将图像标题作为图注
4. 若存在未展示的更多结果，请明确告知用户（例如：“共找到 20 张图像，当前显示 3 张——是否需要查看更多？”）

示例流程：
```
User: "find me pictures of sunsets"
→ Search with count=10
→ Send 3-5 images with captions
→ "Found 10 sunset images, showing 5. Want to see more?"
```

## 注意事项

- 查询字符串需进行 URL 编码（空格 → `%20`）
- API 密钥来自环境变量：`$BRAVE_API_KEY`
- 请遵守各订阅层级规定的调用频率限制