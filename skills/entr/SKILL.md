---
name: entr
name_zh: Entr
description: 当文件发生变化时运行任意命令。适用于监控文件并触发构建或测试。
description_zh: 当文件发生变化时运行任意命令。适用于监控文件并触发构建或测试。
---
# entr（事件通知测试运行器）

一个在文件发生变化时运行任意命令的工具。

## 用法

`entr` 从标准输入读取文件名列表，并执行作为第一个参数指定的工具。

### 语法
```bash
<file_listing_command> | entr <utility> [arguments]
```

### 选项
- `-c`：在调用工具前清屏。
- `-r`：重新加载一个持久化的子进程（例如服务器）。
- `-s`：使用 `SHELL` 指定的解释器来执行第一个参数。

## 示例

**当源文件变更时重建项目：**
```bash
find src/ -name "*.c" | entr make
```

**当 JS 文件变更时运行测试：**
```bash
git ls-files | grep '\.js$' | entr npm test
```

**自动重载 Node 服务器：**
```bash
ls *.js | entr -r node app.js
```

## Agent 注意事项
`entr` 会阻塞终端。当将其用作 agent 时：
1. 若需同时执行其他任务，请使用 `process` 工具在后台运行它。
2. 或者，将其用于短期“监听模式”会话，以便持续观察输出。