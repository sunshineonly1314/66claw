---
name: dida365
name_zh: 滴答清单
description: 通过滴答清单 API 管理任务和待办事项。支持创建、查看、搜索、完成和删除任务，管理项目和标签。🇨🇳 中国专用 skill，替代 gkeep。
description_zh: 通过滴答清单 API 管理任务和待办事项。支持创建、查看、搜索、完成和删除任务。🇨🇳 中国专用。
homepage: https://developer.dida365.com/
metadata: {"openclawcn":{"emoji":"✅","requires":{"env":["DIDA365_ACCESS_TOKEN"]},"primaryEnv":"DIDA365_ACCESS_TOKEN","cnOnly":true}}
---
# 滴答清单 (TickTick / Dida365)

🇨🇳 **中国专用** — 替代 gkeep (Google Keep)，使用滴答清单官方 API 管理任务和待办事项。

## 前置条件

- `DIDA365_ACCESS_TOKEN` 环境变量
- 获取方式：
  1. 前往 [滴答清单开发者中心](https://developer.dida365.com/) 注册应用
  2. 通过 OAuth2 流程获取 Access Token
  3. 设置环境变量 `DIDA365_ACCESS_TOKEN`

## API 基础信息

- **API 端点**: `https://api.dida365.com/open/v1`
- **认证方式**: Bearer Token (`Authorization: Bearer $DIDA365_ACCESS_TOKEN`)
- **文档**: https://developer.dida365.com/docs

## 任务操作

### 获取所有项目（清单）

```bash
curl -s "https://api.dida365.com/open/v1/project" \
  -H "Authorization: Bearer $DIDA365_ACCESS_TOKEN"
```

### 获取项目中的任务

```bash
curl -s "https://api.dida365.com/open/v1/project/{projectId}/data" \
  -H "Authorization: Bearer $DIDA365_ACCESS_TOKEN"
```

### 创建任务

```bash
curl -s -X POST "https://api.dida365.com/open/v1/task" \
  -H "Authorization: Bearer $DIDA365_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "任务标题",
    "content": "任务详细描述",
    "projectId": "项目ID（可选，默认收集箱）",
    "priority": 0,
    "dueDate": "2026-03-10T00:00:00.000+0800"
  }'
```

**优先级说明**:
- `0`: 无优先级
- `1`: 低优先级
- `3`: 中优先级
- `5`: 高优先级

### 更新任务

```bash
curl -s -X POST "https://api.dida365.com/open/v1/task/{taskId}" \
  -H "Authorization: Bearer $DIDA365_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "更新后的标题",
    "content": "更新后的描述"
  }'
```

### 完成任务

```bash
curl -s -X POST "https://api.dida365.com/open/v1/task/{taskId}/complete" \
  -H "Authorization: Bearer $DIDA365_ACCESS_TOKEN"
```

### 删除任务

```bash
curl -s -X DELETE "https://api.dida365.com/open/v1/task/{taskId}" \
  -H "Authorization: Bearer $DIDA365_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"projectId": "项目ID"}'
```

## 项目操作

### 创建项目

```bash
curl -s -X POST "https://api.dida365.com/open/v1/project" \
  -H "Authorization: Bearer $DIDA365_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "项目名称",
    "color": "#F18181"
  }'
```

### 删除项目

```bash
curl -s -X DELETE "https://api.dida365.com/open/v1/project/{projectId}" \
  -H "Authorization: Bearer $DIDA365_ACCESS_TOKEN"
```

## 常用工作流

### 1. 列出所有待办

先获取项目列表，再逐个获取任务：
```
1. GET /open/v1/project → 获取所有项目
2. GET /open/v1/project/{id}/data → 获取每个项目的任务
3. 汇总展示
```

### 2. 快速添加任务

```
POST /open/v1/task
{
  "title": "用户说的任务",
  "priority": 3,
  "dueDate": "截止日期"
}
```

### 3. 今日待办回顾

获取所有项目数据，筛选 `dueDate` 为今天的任务。

## 输出格式

展示任务时使用友好格式：

```
📋 我的项目 (3 个任务)
  ☐ [高] 完成产品方案 — 截止 3月5日
  ☐ [中] 准备周会材料 — 截止 3月3日
  ✅ [低] 整理文档 — 已完成

📋 收集箱 (1 个任务)
  ☐ 买牛奶
```

## 与 Google Keep 的区别

| 特性 | 滴答清单 | Google Keep |
|------|----------|-------------|
| 连接稳定性 | ✅ 稳定 | ⚠️ 可能超时 |
| API 类型 | 官方 REST API | 非官方逆向 API |
| 认证方式 | OAuth2 | Google 应用密码 |
| 功能 | 任务管理+日历+习惯 | 笔记+清单 |
| 数据安全 | 官方支持 | 随时可能失效 |

## 注意事项

- Access Token 有有效期，过期需重新授权
- API 有请求频率限制，避免短时间大量请求
- 创建任务时不指定 `projectId` 则放入"收集箱"
- 日期格式为 ISO 8601，注意时区 `+0800`（中国）
