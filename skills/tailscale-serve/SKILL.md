---
name: tailscale-serve
description: 使用 `tailscale serve` 同时管理多个路径，避免冲突。
description_zh: 使用 `tailscale serve` 同时管理多个路径，避免冲突。
---
# Tailscale Serve 技能  

使用 `tailscale serve` 同时管理多个路径，避免冲突。

## 核心命令  

### 查看当前已暴露的服务  
```bash
tailscale serve status
```  

### 在指定路径下暴露一个目录或文件  
```bash
# Directory
tailscale serve --bg --set-path /slides /path/to/directory

# Single file
tailscale serve --bg --set-path /presentation /path/to/file.html

# Port (for running services)
tailscale serve --bg --set-path /api http://localhost:8080
```  

### 在根路径下暴露某端口（将覆盖所有其他路径）  
```bash
tailscale serve --bg 8888
```  

### 移除特定路径  
```bash
tailscale serve --https=443 /slides off
```  

### 重置全部暴露配置  
```bash
tailscale serve reset
```  

## 重要说明  

- **路径冲突：** 在 `/` 路径下暴露服务将覆盖所有其他路径  
- **后台运行：** 使用 `--bg` 使其持续运行  
- **多路径支持：** 可同时为不同路径暴露多个资源  
- **先查状态：** 添加新路径前，务必先运行 `tailscale serve status` 查看当前状态  

## 常见模式  

### 同时暴露演示页面与控制界面  
```bash
# If control UI is at /, serve presentation at a subpath
tailscale serve --bg --set-path /slides ~/clawd/personal-agents-presentation.html

# Access at: https://[hostname].ts.net/slides
```  

### 同时暴露多个目录  
```bash
tailscale serve --bg --set-path /docs ~/documents
tailscale serve --bg --set-path /slides ~/presentations
tailscale serve --bg --set-path /files ~/files
```  

### 暴露本地开发服务器  
```bash
tailscale serve --bg --set-path /app http://localhost:3000
```  

## 工作流  

1. 查看当前状态：`tailscale serve status`  
2. 选择一个未被占用的路径（例如 `/slides`、`/docs` 或 `/api`）  
3. 使用 `--set-path /your-path /source` 进行暴露  
4. 再次运行 `tailscale serve status` 验证  
5. 分享完整 URL：`https://[hostname].ts.net/your-path`  

## 故障排查  

**“无法访问我暴露的内容”**  
- 检查 `tailscale serve status` —— 是否位于您预期的路径？  
- 是否有其他操作覆盖了根路径 `/`？  

**“想用端口完全替换现有所有暴露配置”**  
```bash
tailscale serve reset
tailscale serve --bg 8888
```  

**“想在现有配置基础上新增路径”**  
```bash
# Don't use reset! Just add with --set-path
tailscale serve --bg --set-path /newpath /source
```  