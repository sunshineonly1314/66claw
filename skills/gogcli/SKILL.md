---
name: gogcli
description: Google Workspace CLI 工具，支持 Gmail、Calendar、Drive、Sheets、Docs、Slides、Contacts、Tasks、People、Groups、Keep。当用户要求与 Google 服务交互时使用。
description_zh: Google Workspace CLI 工具，支持 Gmail、Calendar、Drive、Sheets、Docs、Slides、Contacts、Tasks、People、Groups、Keep。当用户要求与 Google 服务交互时使用。
---

# gogcli — Google Workspace CLI

## 概述

gogcli 是一款可在终端中管理 Google Workspace 服务的 CLI 工具。支持 Gmail、Calendar、Drive、Sheets、Docs、Slides、Contacts、Tasks、People、Groups 和 Keep。

## 安装

### 快速安装（如已安装 brew）：
```bash
brew install steipete/tap/gogcli
```

### 源码编译安装（未安装 brew）：
```bash
# 1. Clone repository
git clone https://github.com/steipete/gogcli.git

# 2. Navigate to directory
cd gogcli

# 3. Build
make

# 4. (Optional) Make available globally
sudo make install
```

## 首次配置

使用 gogcli 前，请先配置 OAuth 凭据：

**步骤 1：获取 OAuth 客户端凭据**  
1. 访问 Google Cloud Console 的“API 和服务”页面  
2. 创建新项目或使用已有项目  
3. 进入“OAuth 同意屏幕”  
4. 创建 OAuth 2.0 客户端，配置如下：  
   - 应用类型：“桌面应用”  
   - 名称：“gogcli for Clawdbot”  
   - 已授权重定向 URI：`http://localhost:8085/callback`  
5. 启用所需 API  
6. 下载 OAuth 客户端凭据 JSON 文件  
7. 复制到 `~/Downloads/`  

**步骤 2：授权您的账户**  
```bash
cd gogcli
./bin/gog auth add you@gmail.com ~/Downloads/client_secret_....json
```  

**步骤 3：验证**  
```bash
./bin/gog auth list
./bin/gog gmail search 'is:unread' --max 5
```  

## 常用命令

### Gmail  
```bash
# Search
./bin/gog gmail search 'query' --max 20

# Send
./bin/gog gmail send 'recipient@gmail.com' --subject 'Hello' --body 'Message'

# Labels
./bin/gog gmail labels list
```  

### 日历  
```bash
# List events
./bin/gog calendar events list --max 50

# Create event
./bin/gog calendar events create 'Meeting' --start '2026-01-30T10:00'
```  

### Drive  
```bash
# List files
./bin/gog drive ls --query 'pdf' --max 20

# Upload file
./bin/gog drive upload ~/Documents/file.pdf
```  

### Sheets  
```bash
# List sheets
./bin/gog sheets list

# Export sheet
./bin/gog sheets export <spreadsheet-id> --format pdf
```  

### 联系人  
```bash
./bin/gog contacts search 'John Doe'
```  

### Tasks  
```bash
# List tasklists
./bin/gog tasks list

# Add task
./bin/gog tasks add --title 'Task' --due '2026-01-30'
```  

## 注意事项

- 脚本编写时使用 `--json` 标志  
- 凭据存储于 `~/.config/gog/`  
- 使用 `gog auth list` 检查认证状态  