---
name: bring-recipes
name_zh: Bring菜谱
description: 当用户希望浏览 Bring! 购物应用中的食谱灵感时使用。适用于发现食谱、查看食谱详情（名称、作者、类型、图片）或按标签筛选。注意：无法导入食材（API 限制）。
description_zh: 当用户希望浏览 Bring! 购物应用中的食谱灵感时使用。适用于发现食谱、查看食谱详情（名称、作者、类型、图片）或按标签筛选。注意：无法导入食材（API 限制）。
---
# Bring! 食谱浏览器 CLI

## 概述

用于浏览 Bring! 食谱灵感的命令行工具。**仅限浏览功能** —— Bring! Inspirations API 不提供食材列表。

## 使用场景

**适用此技能的情形：**
- 用户希望发现 Bring! 食谱
- 浏览食谱灵感
- 查看食谱元数据（名称、作者、类型、图片、链接）
- 按标签筛选食谱（全部、我的）
- 需要 JSON 格式食谱输出以供脚本调用

**不适用此技能的情形：**
- 用户希望将食材添加至购物清单（API 限制）
- 直接管理购物清单
- 需要含完整食材列表的详细食谱

## 快速参考

| 命令 | 用途 |
|---------|---------|
| `bring-recipes list` | 浏览食谱灵感（默认） |
| `bring-recipes filters` | 显示可用筛选标签 |
| `bring-recipes list --filter mine` | 显示您的个人食谱 |
| `bring-recipes list --json` | JSON 输出，适用于脚本调用 |

**环境变量：**  
```bash
export BRING_EMAIL="your@email.com"
export BRING_PASSWORD="yourpassword"
```

## 安装

```bash
cd skills/bring-recipes
npm install
```

## 常见工作流

**浏览全部食谱：**  
```bash
node index.js list --limit 10
```

**筛选您的食谱：**  
```bash
node index.js list --filter mine
```

**获取 JSON 以供脚本调用：**  
```bash
node index.js list --json | jq -r '.[] | .content.name'
```

**检查可用筛选器：**  
```bash
node index.js filters
```

## 标志（Flags）参考

| 标志 | 描述 |
|------|-------------|
| `-f, --filter <tags>` | 筛选标签：all（全部）、mine（我的） |
| `--limit <n>` | 最大返回食谱数（默认：10） |
| `--json` | JSON 输出 |
| `--no-color` | 禁用彩色输出 |
| `-q, --quiet` | 极简输出 |
| `-v, --verbose` | 调试输出 |

## API 限制

⚠️ **重要提示：** Bring! `getInspirations()` API 仅返回元数据：
- ✅ 食谱名称、作者、类型
- ✅ 图片、链接、标签、点赞数
- ❌ **食材列表**（API 未提供）

这是 Bring! API 的固有限制，而非 CLI 工具缺陷。本 CLI 专为**浏览与发现**食谱而设计。

## 食谱类型

- **TEMPLATE** —— Bring! 模板（例如，“周日早午餐”）
- **RECIPE** —— 来自合作伙伴的已解析食谱
- **POST** —— 推广内容

## 常见错误

**误以为可获取食材：**  
API 不提供食材列表。请将 CLI 用于发现目的，再手动添加商品。

**寻找季节性筛选器：**  
API 不支持季节性标签。仅提供 “all” 和 “mine” 两种筛选器。

**假定所有食谱均有名称：**  
POST 类型食谱可能显示为“无标题食谱”——此为 API 正常行为。

## 实现说明

- 使用 `node-bring-api` v2.0.2+ 调用 `getInspirations()` API
- 要求 Node.js 18.0.0+
- 不支持季节性筛选（API 限制）
- 仅提供浏览功能
- 提供 JSON 模式以支持自动化

## 实际应用场景

- **食谱发现：** 浏览 Bring! 中当前可用的食谱
- **灵感浏览：** 查看热门食谱与模板
- **个人收藏：** 筛选您已保存的食谱
- **集成扩展：** JSON 输出供外部工具调用