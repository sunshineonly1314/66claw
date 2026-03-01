---
name: pet
name_zh: PET
description: 简单的命令行代码片段管理器。用于保存和复用复杂命令。
description_zh: 简单的命令行代码片段管理器。用于保存和复用复杂命令。
metadata: {"clawdbot":{"emoji":"🐘","requires":{"bins":["pet"]}}}
---
# pet（简易命令行代码片段管理器）

pet 是一款命令行代码片段管理器，助你保存复杂命令并重复使用。

## 使用方法

### 创建新代码片段  
```bash
pet new
```  
此命令将打开编辑器。请在此输入命令及其描述。  
格式如下：  
```toml
[[snippets]]
  command = "echo 'hello'"
  description = "say hello"
  output = ""
```

### 搜索与列出代码片段  
```bash
pet search
```

### 直接执行代码片段  
```bash
pet exec
```

### 同步至 Gist（可选）  
若已在 `~/.config/pet/config.toml` 中配置，可将代码片段同步至 GitHub Gist：  
```bash
pet sync
```

## 存储位置  
代码片段保存于 `~/.config/pet/snippet.toml`。