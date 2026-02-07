# ClawdSkillsProxy 技能国际化需求

## 背景

当前 ClawdSkillsProxy `/skills/index` API 返回的技能数据缺少描述和中文翻译字段，导致前端技能市场（977个技能）只能显示英文技能名，用户体验差。

## 当前返回结构

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "globalVersion": 12345,
    "totalCount": 977,
    "skills": [
      {
        "skillId": "api-credentials-hygiene",
        "version": 612,
        "sha256": "xxx",
        "size": 1234,
        "updatedAt": 1706666666000,
        "path": "api-credentials-hygiene",
        "status": "active"
      }
    ]
  }
}
```

## 期望返回结构

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "globalVersion": 12345,
    "totalCount": 977,
    "skills": [
      {
        "skillId": "api-credentials-hygiene",
        "version": 612,
        "sha256": "xxx",
        "size": 1234,
        "updatedAt": 1706666666000,
        "path": "api-credentials-hygiene",
        "status": "active",
        // ===== 新增字段 =====
        "name": "API Credentials Hygiene",      // 英文显示名称
        "nameZh": "API凭证管理",                // 中文显示名称
        "description": "Manage API credentials and secrets securely",  // 英文描述
        "descriptionZh": "安全管理API凭证和密钥", // 中文描述
        "emoji": "🔐",                          // 图标emoji
        "tags": ["security", "api", "credentials"], // 标签
        "author": "clawdbot",                   // 作者
        "os": ["darwin"]                        // 支持的平台列表（可选）
      }
    ]
  }
}
```

## 新增字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 英文显示名称，从 SKILL.md frontmatter 的 `name` 字段解析 |
| `nameZh` | string | 否 | 中文显示名称，从 SKILL.md frontmatter 的 `name_zh` 字段解析 |
| `description` | string | 是 | 英文描述，从 SKILL.md frontmatter 的 `description` 字段解析 |
| `descriptionZh` | string | 否 | 中文描述，从 SKILL.md frontmatter 的 `description_zh` 字段解析 |
| `emoji` | string | 否 | 图标emoji，从 SKILL.md frontmatter 的 `emoji` 字段解析 |
| `tags` | string[] | 否 | 标签数组，从 SKILL.md frontmatter 的 `tags` 字段解析 |
| `author` | string | 否 | 作者，从 SKILL.md frontmatter 的 `author` 字段解析 |
| `os` | string[] | 否 | 支持的平台列表，如 `["darwin"]`(macOS)、`["win32"]`(Windows)、`["linux"]`。从 SKILL.md frontmatter 的 `os` 字段解析。如果为空或未设置，表示支持所有平台 |

## SKILL.md Frontmatter 示例

技能仓库中的 SKILL.md 文件应支持以下 frontmatter 格式：

```markdown
---
name: API Credentials Hygiene
name_zh: API凭证管理
description: Manage API credentials and secrets securely
description_zh: 安全管理API凭证和密钥
emoji: 🔐
tags:
  - security
  - api
  - credentials
author: clawdbot
os:
  - darwin
  - win32
  - linux
---

# API Credentials Hygiene

This skill helps you manage API credentials...
```

### 关于 os 字段

`os` 字段用于标识技能支持的操作系统，可选值：
- `darwin`: macOS
- `win32`: Windows  
- `linux`: Linux

示例：
- macOS 专属技能（如 Apple Mail、Bear Notes）：`os: ["darwin"]`
- Windows 专属技能（如 PowerShell 工具）：`os: ["win32"]`
- 跨平台技能：`os: ["darwin", "win32", "linux"]` 或不设置此字段

## 前端适配

前端已经做好了兼容处理：
1. 优先显示 `nameZh`，如果为空则显示 `name`，如果都为空则美化 `skillId`
2. 优先显示 `descriptionZh`，如果为空则显示 `description`，如果都为空则显示默认提示

## 优先级

**高优先级** - 影响 977 个技能的用户体验，建议尽快支持。

## 联系人

前端：[你的名字]
后端：ClawdSkillsProxy 团队
