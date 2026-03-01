---
name: process-watch
name_zh: 进程监控
description: 监控系统进程 — CPU、内存、磁盘 I/O、网络、打开的文件、端口。定位资源占用大户、终止失控进程、追踪消耗系统资源的程序
description_zh: 监控系统进程 — CPU、内存、磁盘 I/O、网络、打开的文件、端口。定位资源占用大户、终止失控进程、追踪消耗系统资源的程序
metadata:
  clawdhub:
    emoji: "📊"
    requires:
      bins: ["python3"]
---
# Process Watch（进程监控）

全面的系统进程监控工具。功能远超基础的 `top`，可显示：
- CPU 与内存占用  
- 各进程的磁盘 I/O  
- 网络连接  
- 打开的文件与句柄  
- 端口绑定情况  
- 进程树结构  

## 命令列表

### 列出进程  
```bash
process-watch list [--sort cpu|mem|disk|name] [--limit 20]
```

### 顶级资源占用者  
```bash
process-watch top [--type cpu|mem|disk|net] [--limit 10]
```

### 进程详细信息  
```bash
process-watch info <pid>
# Shows: CPU, memory, open files, network connections, children, environment
```

### 按名称查找进程  
```bash
process-watch find <name>
# e.g., process-watch find chrome
```

### 端口绑定情况  
```bash
process-watch ports [--port 3000]
# What's listening on which port?
```

### 网络连接  
```bash
process-watch net [--pid <pid>] [--established]
```

### 终止进程  
```bash
process-watch kill <pid> [--force]
process-watch kill --name "chrome" [--force]
```

### 实时监控模式（Watch mode）  
```bash
process-watch watch [--interval 2] [--alert-cpu 80] [--alert-mem 90]
# Continuous monitoring with threshold alerts
```

### 系统概览  
```bash
process-watch summary
# Quick overview: load, memory, disk, top processes
```

## 示例用法

```bash
# What's eating my CPU?
process-watch top --type cpu

# What's on port 3000?
process-watch ports --port 3000

# Details on a specific process
process-watch info 1234

# Kill all Chrome processes
process-watch kill --name chrome

# Watch with alerts
process-watch watch --alert-cpu 90 --alert-mem 85
```

## 平台支持

- **macOS**：完全支持  
- **Linux**：完全支持  
- **Windows**：部分支持（仅基础进程列表，无等效于 lsof 的功能）  