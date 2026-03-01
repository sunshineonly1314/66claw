---
name: gkeep
name_zh: Google Keep
description: 通过 gkeepapi 操作 Google Keep 笔记。支持列出、搜索、创建及管理笔记。
description_zh: 通过 gkeepapi 操作 Google Keep 笔记。支持列出、搜索、创建及管理笔记。
homepage: https://github.com/kiwiz/gkeepapi
metadata: {"clawdbot":{"emoji":"📝","requires":{"bins":["gkeep"]}}}
---
# gkeep

基于 gkeepapi（非官方 API）封装的 Google Keep 命令行工具。

## 设置

使用您的 Google 账户登录：
```bash
gkeep login your.email@gmail.com
```

**重要提示**：请使用 [应用专用密码](https://myaccount.google.com/apppasswords)，而非常规账户密码。必须已启用两步验证（2FA）。

## 命令

列出笔记：
```bash
gkeep list
gkeep list --limit 10
```

搜索笔记：
```bash
gkeep search "shopping"
```

获取指定笔记：
```bash
gkeep get <note_id>
```

创建新笔记：
```bash
gkeep create "Title" "Body text here"
```

归档笔记：
```bash
gkeep archive <note_id>
```

删除（移入回收站）：
```bash
gkeep delete <note_id>
```

置顶笔记：
```bash
gkeep pin <note_id>
```

取消置顶：
```bash
gkeep unpin <note_id>
```

## 注意事项

- 本工具依赖逆向工程实现的非官方 API  
- 若 Google 更改其内部 API，本工具可能失效  
- 认证令牌存储于 `~/.config/gkeep/token.json`  
- 首次运行将在 `skills/gkeep/.venv` 初始化本地虚拟环境（venv）  
- 该项目持续活跃更新（截至 2026 年 1 月）