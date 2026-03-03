---
name: yuque-blog-writer
name_zh: 语雀博客写作
description: 通过语雀 API 撰写并发布博客文章到语雀知识库。支持从构思到发布的完整写作工作流，包括风格匹配、内容生成和直接发布。🇨🇳 中国专用 skill，替代 blog-writer (Notion)。
description_zh: 通过语雀 API 撰写并发布文章到语雀知识库。🇨🇳 中国专用，替代 blog-writer。
homepage: https://www.yuque.com/yuque/developer
metadata: {"openclawcn":{"emoji":"📝","requires":{"env":["YUQUE_TOKEN"]},"primaryEnv":"YUQUE_TOKEN","cnOnly":true}}
---
# 语雀博客写作

🇨🇳 **中国专用** — 替代 blog-writer (Notion)，使用语雀官方 API 撰写并发布文章。

## 前置条件

- `YUQUE_TOKEN` 环境变量
- 获取方式：语雀 → 个人设置 → Token → 新建 Token
- 文档：https://www.yuque.com/yuque/developer/api

## API 基础信息

- **API 端点**: `https://www.yuque.com/api/v2`
- **认证方式**: `X-Auth-Token: $YUQUE_TOKEN`
- **Content-Type**: `application/json`

## 写作工作流

### 第一阶段：收集信息

向用户索取：
- 主题或核心议题
- 任何特定切入角度或待探讨的核心论点
- 研究资料、链接或笔记（如有）
- 目标篇幅偏好（默认：800–1500 字）
- 目标知识库（哪个语雀知识库/仓库）

### 第二阶段：准备发布目标

#### 获取用户信息
```bash
curl -s "https://www.yuque.com/api/v2/user" \
  -H "X-Auth-Token: $YUQUE_TOKEN"
```
→ 记录 `login` 字段（用户名）

#### 获取知识库列表
```bash
curl -s "https://www.yuque.com/api/v2/users/{login}/repos" \
  -H "X-Auth-Token: $YUQUE_TOKEN"
```
→ 让用户选择目标知识库，记录 `namespace`（格式：`用户名/知识库slug`）

### 第三阶段：草拟内容

写作要求：
1. 以强有力的开篇确立核心论点
2. 适当使用第一人称
3. 每 2-3 段设置清晰的子标题
4. 段落简短（2-4 句）
5. 研究材料自然融入行文
6. 结尾处加入反思或行动呼吁

### 第四阶段：发布到语雀

#### 创建文档
```bash
curl -s -X POST "https://www.yuque.com/api/v2/repos/{namespace}/docs" \
  -H "X-Auth-Token: $YUQUE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "文章标题",
    "slug": "article-slug",
    "format": "markdown",
    "body": "文章 Markdown 内容...",
    "status": 0
  }'
```

**status 说明**:
- `0`: 草稿（默认，推荐先发草稿）
- `1`: 公开发布

#### 更新文档
```bash
curl -s -X PUT "https://www.yuque.com/api/v2/repos/{namespace}/docs/{id}" \
  -H "X-Auth-Token: $YUQUE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "更新后的标题",
    "body": "更新后的内容"
  }'
```

#### 发布文档（草稿→公开）
```bash
curl -s -X PUT "https://www.yuque.com/api/v2/repos/{namespace}/docs/{id}" \
  -H "X-Auth-Token: $YUQUE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": 1}'
```

### 第五阶段：审阅与迭代

1. 提交初稿（草稿状态），提供语雀链接
2. 收集用户反馈
3. 通过 PUT 接口更新文档内容
4. 用户确认后设置 `status: 1` 正式发布

## 其他常用 API

### 获取文档列表
```bash
curl -s "https://www.yuque.com/api/v2/repos/{namespace}/docs" \
  -H "X-Auth-Token: $YUQUE_TOKEN"
```

### 获取文档详情
```bash
curl -s "https://www.yuque.com/api/v2/repos/{namespace}/docs/{slug}" \
  -H "X-Auth-Token: $YUQUE_TOKEN"
```

### 搜索文档
```bash
curl -s "https://www.yuque.com/api/v2/search?q=关键词&type=doc" \
  -H "X-Auth-Token: $YUQUE_TOKEN"
```

### 删除文档
```bash
curl -s -X DELETE "https://www.yuque.com/api/v2/repos/{namespace}/docs/{id}" \
  -H "X-Auth-Token: $YUQUE_TOKEN"
```

## 输出格式

发布成功后展示：

```
✅ 文章已发布到语雀！

📄 标题：[文章标题]
📚 知识库：[知识库名称]
🔗 链接：https://www.yuque.com/{namespace}/{slug}
📊 状态：草稿 / 已发布
📅 时间：[日期]
```

## 与 Notion blog-writer 的区别

| 特性 | 语雀 | Notion |
|------|------|--------|
| 连接稳定性 | ✅ 稳定 | ⚠️ 可能超时 |
| API 类型 | 官方 REST API | 官方 REST API |
| 认证方式 | Token | Integration Token |
| 中文体验 | 原生中文 | 英文为主 |
| Markdown | 原生支持 | 需转换 Notion Blocks |
| 知识库 | 语雀知识库 | Notion Database |

## 注意事项

- 建议先以草稿状态（`status: 0`）创建，确认无误后再发布
- `slug` 会出现在 URL 中，建议使用英文短横线格式（如 `my-blog-post`）
- `format: "markdown"` 支持标准 Markdown 语法
- 语雀 API 有请求频率限制（通常 100 次/分钟）
- Token 权限需包含读写知识库的权限
