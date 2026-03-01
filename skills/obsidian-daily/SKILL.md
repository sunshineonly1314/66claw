---
name: obsidian-daily
name_zh: Obsidian每日笔记
description: 通过 obsidian-cli 管理 Obsidian 每日笔记。创建并打开每日笔记，追加条目（日记、日志、任务、链接），按日期读取过往笔记，并搜索知识库内容。支持“昨天”、“上周五”、“3 天前”等相对日期表达。
description_zh: 通过 obsidian-cli 管理 Obsidian 每日笔记。创建并打开每日笔记，追加条目（日记、日志、任务、链接），按日期读取过往笔记，并搜索知识库内容。支持“昨天”、“上周五”、“3 天前”等相对日期表达。
compatibility: 需通过 Homebrew（Mac/Linux）或 Scoop（Windows）安装 obsidian-cli
metadata: {"clawdbot":{"requires":{"bins":["obsidian-cli"]},"install":[{"id":"brew","kind":"brew","formula":"yakitrak/yakitrak/obsidian-cli","bins":["obsidian-cli"],"label":"Install obsidian-cli (brew)"}]}}
---
# Obsidian 每日笔记

与 Obsidian 每日笔记交互：创建笔记、追加条目、按日期读取、搜索内容。

## 设置

检查是否已配置默认知识库：

```bash
obsidian-cli print-default --path-only 2>/dev/null && echo "OK" || echo "NOT_SET"
```

若 `NOT_SET`，请向用户询问：
1. **知识库名称**（必填）
2. **每日笔记文件夹**（默认：知识库根目录；常见路径：`Daily Notes`、`Journal`、`daily`）
3. **日期格式**（默认：`YYYY-MM-DD`）

配置知识库：

```bash
obsidian-cli set-default "VAULT_NAME"
```

**Obsidian 每日笔记插件默认设置：**
- 日期格式：`YYYY-MM-DD`
- 新建文件位置：知识库根目录
- 模板文件位置：（无）

## 日期处理

获取当前日期：

```bash
date +%Y-%m-%d
```

跨平台相对日期（优先 GNU 工具，BSD 为备选）：

| 参考 | 命令 |
|------|------|
| 今天 | `date +%Y-%m-%d` |
| 昨天 | `date -d yesterday +%Y-%m-%d 2>/dev/null \|\| date -v-1d +%Y-%m-%d` |
| 上周五 | `date -d "last friday" +%Y-%m-%d 2>/dev/null \|\| date -v-friday +%Y-%m-%d` |
| 3 天前 | `date -d "3 days ago" +%Y-%m-%d 2>/dev/null \|\| date -v-3d +%Y-%m-%d` |
| 下周一 | `date -d "next monday" +%Y-%m-%d 2>/dev/null \|\| date -v+monday +%Y-%m-%d` |

## 命令

### 打开/创建今日笔记

```bash
obsidian-cli daily
```

在 Obsidian 中打开今日的每日笔记；若该笔记尚不存在，则基于模板创建。

### 追加条目

```bash
obsidian-cli daily && obsidian-cli create "$(date +%Y-%m-%d).md" --content "$(printf '\n%s' "ENTRY_TEXT")" --append
```

指定自定义文件夹：

```bash
obsidian-cli daily && obsidian-cli create "Daily Notes/$(date +%Y-%m-%d).md" --content "$(printf '\n%s' "ENTRY_TEXT")" --append
```

### 读取笔记

今日笔记：

```bash
obsidian-cli print "$(date +%Y-%m-%d).md"
```

指定日期：

```bash
obsidian-cli print "2025-01-10.md"
```

相对日期（如“昨天”）：

```bash
obsidian-cli print "$(date -d yesterday +%Y-%m-%d 2>/dev/null || date -v-1d +%Y-%m-%d).md"
```

### 搜索内容

```bash
obsidian-cli search-content "TERM"
```

### 搜索笔记

交互式模糊查找器：

```bash
obsidian-cli search
```

### 指定知识库

在任意命令中添加 `--vault "NAME"`：

```bash
obsidian-cli print "2025-01-10.md" --vault "Work"
```

## 示例输出

```markdown
- Went to the doctor
- [ ] Buy groceries
- https://github.com/anthropics/skills
- 15:45 This is a log line
```

## 使用场景

**日记条目：**
```bash
obsidian-cli daily && obsidian-cli create "$(date +%Y-%m-%d).md" --content "$(printf '\n%s' "- Went to the doctor")" --append
```

**任务：**
```bash
obsidian-cli daily && obsidian-cli create "$(date +%Y-%m-%d).md" --content "$(printf '\n%s' "- [ ] Buy groceries")" --append
```

**链接：**
```bash
obsidian-cli daily && obsidian-cli create "$(date +%Y-%m-%d).md" --content "$(printf '\n%s' "- https://github.com/anthropics/skills")" --append
```

**带时间戳的日志：**
```bash
obsidian-cli daily && obsidian-cli create "$(date +%Y-%m-%d).md" --content "$(printf '\n%s' "- $(date +%H:%M) This is a log line")" --append
```

**读取上周五的笔记：**
```bash
obsidian-cli print "$(date -d 'last friday' +%Y-%m-%d 2>/dev/null || date -v-friday +%Y-%m-%d).md"
```

**搜索“meeting”：**
```bash
obsidian-cli search-content "meeting"
```