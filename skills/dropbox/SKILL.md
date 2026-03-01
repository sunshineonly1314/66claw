---
name: dropbox
description: 通过 MCP 服务器和 CLI 管理 Dropbox 文件。采用 Swift 原生实现，基于 SwiftyDropbox SDK，支持 OAuth 2.0 PKCE 协议及安全的 Keychain 令牌存储。
description_zh: 通过 MCP 服务器和 CLI 管理 Dropbox 文件。采用 Swift 原生实现，基于 SwiftyDropbox SDK，支持 OAuth 2.0 PKCE 协议及安全的 Keychain 令牌存储。
---
# Dropbox 管理器 skill

通过 MCP 服务器和 CLI 管理 Dropbox 文件。采用 Swift 原生实现，基于 SwiftyDropbox SDK，支持 OAuth 2.0 PKCE 协议及安全的 Keychain 令牌存储。

## 设置

### 前提条件

```bash
# Clone and build Dropbook
git clone https://github.com/RyanLisse/Dropbook.git
cd Dropbook
make build
```

### 认证

#### 方式一：带 Keychain 的 OAuth 登录（推荐）

使用交互式 OAuth 流程，并将令牌安全地存储于 Keychain 中：

```bash
export DROPBOX_APP_KEY="your_dropbox_app_key"
export DROPBOX_APP_SECRET="your_dropbox_app_secret"
make login
# or: swift run dropbook login
```

该流程将执行以下操作：
1. 生成 PKCE 代码验证器（code verifier）及挑战值（challenge）（SHA256，符合 RFC 7636）
2. 打开含 state 参数的授权 URL（提供 CSRF 防护）
3. 提示您粘贴授权码（authorization code）
4. 使用授权码换取访问令牌（access token）和刷新令牌（refresh token）
5. **将令牌保存至 macOS Keychain**（硬件级加密保护）
6. 若 Keychain 不可用，则自动回退至 `~/.dropbook/auth.json`
7. 启用令牌自动刷新功能

**安全特性（符合 RFC 9700）：**
- 使用 S256 挑战方法的 PKCE
- 使用 state 参数防止 CSRF 攻击
- 使用 `kSecAttrAccessibleWhenUnlocked` 的 Keychain 存储
- 使用 CryptoKit 执行密码学运算

#### 方式二：环境变量（传统方式）

```bash
export DROPBOX_APP_KEY="your_dropbox_app_key"
export DROPBOX_APP_SECRET="your_dropbox_app_secret"
export DROPBOX_ACCESS_TOKEN="your_dropbox_access_token"
```

**注意**：手动配置的令牌不支持自动刷新。生产环境中请使用 OAuth 登录方式。

### 注销

清除 Keychain 和文件存储中保存的所有令牌：

```bash
make logout
# or: swift run dropbook logout
```

## MCP 服务器（推荐）

启动 MCP 服务器：

```bash
make mcp
# or: ./.build/debug/dropbook mcp
```

### MCP 工具

| 工具 | 描述 |
|------|------|
| `list_directory` | 列出 Dropbox 目录下的文件和文件夹 |
| `search` | 按名称或内容搜索文件 |
| `upload` | 将文件上传至 Dropbox |
| `download` | 从 Dropbox 下载文件 |
| `delete` | 删除 Dropbox 中的文件或文件夹（移入回收站） |
| `get_account_info` | 获取账户名称和邮箱地址 |
| `read_file` | 读取 Dropbox 中文本文件的内容 |

#### list_directory

列出 Dropbox 目录下的文件和文件夹。

**参数：**
- `path`（字符串，可选）：目录路径。默认值：“/”

**响应：**
```json
{
  "files": [
    {"type": "file", "name": "doc.pdf", "path": "/Docs/doc.pdf", "size": 1024},
    {"type": "folder", "name": "Projects", "path": "/Projects"}
  ]
}
```

#### search

按名称或内容搜索文件。

**参数：**
- `query`（字符串，必需）：搜索关键词
- `path`（字符串，可选）：限定搜索路径。默认值：“/”

**响应：**
```json
{
  "count": 2,
  "results": [
    {"matchType": "filename", "metadata": {"name": "report.pdf", "path": "/Docs/report.pdf"}}
  ]
}
```

#### upload

将文件上传至 Dropbox。

**参数：**
- `localPath`（字符串，必需）：本地文件的绝对路径
- `remotePath`（字符串，必需）：在 Dropbox 中的目标路径
- `overwrite`（布尔值，可选）：若目标已存在是否覆盖。默认值：false

**响应：**
```json
{
  "uploaded": true,
  "name": "file.txt",
  "path": "/Uploads/file.txt",
  "size": 5000
}
```

#### download

从 Dropbox 下载文件。

**参数：**
- `remotePath`（字符串，必需）：Dropbox 中的文件路径
- `localPath`（字符串，必需）：本地目标路径

**响应：**
```json
{
  "downloaded": true,
  "to": "/tmp/report.pdf"
}
```

#### delete

从 Dropbox 删除文件或文件夹（移入回收站）。

**参数：**
- `path`（字符串，必需）：Dropbox 中待删除的路径

**响应：**
```json
{
  "deleted": true,
  "path": "/Docs/old-file.pdf"
}
```

#### get_account_info

获取 Dropbox 账户信息。

**参数：** 无

**响应：**
```json
{
  "name": "Ryan Lisse",
  "email": "user@example.com"
}
```

#### read_file

读取并返回 Dropbox 中文本文件的内容。

**参数：**
- `path`（字符串，必需）：Dropbox 中文件的路径

**响应：**
以文本形式返回文件内容。仅支持 UTF-8 编码的文本文件。

## CLI 命令

```bash
# Authentication
make login                 # OAuth login with Keychain storage
make logout                # Clear stored tokens

# File operations
make list                  # List root directory
swift run dropbook list /path

# Search files
swift run dropbook search "query" [path]

# Upload file
swift run dropbook upload /local/path /remote/path [--overwrite]

# Download file
swift run dropbook download /remote/path /local/path

# Start MCP server
make mcp
```

## MCP 客户端配置

### Claude Code（项目级）

本项目包含一个 `.mcp.json` 文件，用于配置 MCP 服务器：

```json
{
  "mcpServers": {
    "dropbox": {
      "command": "/path/to/Dropbook/.build/debug/dropbook",
      "args": ["mcp"],
      "env": {
        "DROPBOX_APP_KEY": "${DROPBOX_APP_KEY}",
        "DROPBOX_APP_SECRET": "${DROPBOX_APP_SECRET}"
      }
    }
  }
}
```

在 Claude Code 的 settings.json 中启用项目级 MCP 服务器：
```json
{
  "enableAllProjectMcpServers": true
}
```

### Claude Desktop

```json
{
  "mcpServers": {
    "dropbox": {
      "command": "/path/to/dropbook/.build/debug/dropbook",
      "args": ["mcp"],
      "env": {
        "DROPBOX_APP_KEY": "${DROPBOX_APP_KEY}",
        "DROPBOX_APP_SECRET": "${DROPBOX_APP_SECRET}"
      }
    }
  }
}
```

## 错误处理

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| `notConfigured` | 缺少环境变量 | 设置 DROPBOX_APP_KEY 和 DROPBOX_APP_SECRET |
| `invalidArguments` | 缺少必需参数 | 检查工具参数 |
| `notFound` | 路径不存在 | 使用 `list_directory` 验证路径有效性 |
| `itemNotFound` | Keychain 中无有效令牌 | 运行 `make login` 执行认证 |

## 架构

```
Dropbook/
├── Sources/
│   ├── DropbookCore/           # Business logic (actor-based)
│   │   ├── Auth/               # Keychain & file token storage
│   │   ├── Config/             # Configuration management
│   │   ├── Models/             # Domain models
│   │   └── Services/           # DropboxService actor
│   ├── DropbookCLI/            # CLI adapter
│   │   └── Commands/           # Login, logout, file commands
│   └── DropbookMCP/            # MCP server
├── dropbox-skill/              # Skill documentation
├── Makefile                    # Build automation
├── .mcp.json                   # MCP server configuration
└── Package.swift
```

## 使用 rclone 执行批量操作

对于大规模操作（如备份、同步或批量传输），请使用 [rclone](https://rclone.org/) —— 一款功能强大的云同步工具，原生支持 Dropbox。

### 安装 rclone

```bash
brew install rclone
```

### 为 Dropbox 配置 rclone

```bash
# Interactive setup (opens browser for OAuth)
rclone authorize dropbox

# Save the token output to config
mkdir -p ~/.config/rclone
cat > ~/.config/rclone/rclone.conf << 'EOF'
[dropbox]
type = dropbox
token = {"access_token":"...paste token here..."}
EOF
```

### 备份至网络驱动器 / Time Capsule

```bash
# Full backup with progress
rclone copy dropbox: /Volumes/TimeCapsule/Dropbox-Backup \
    --progress \
    --transfers 4 \
    --checkers 8 \
    --retries 10 \
    --log-file /tmp/dropbox-backup.log

# Sync (mirror - deletes files not in source)
rclone sync dropbox: /Volumes/Backup/Dropbox --progress

# Check what would be copied (dry run)
rclone copy dropbox: /Volumes/Backup --dry-run
```

### 常用 rclone 命令

```bash
# List remote contents
rclone lsd dropbox:              # List directories
rclone ls dropbox:               # List all files
rclone size dropbox:             # Calculate total size

# Copy operations
rclone copy dropbox:folder /local/path    # Download folder
rclone copy /local/path dropbox:folder    # Upload folder

# Sync (bidirectional)
rclone bisync dropbox: /local/path --resync

# Mount as filesystem (macOS - requires macFUSE)
rclone mount dropbox: /mnt/dropbox --vfs-cache-mode full
```

### 提升可靠性的 rclone 标志（flags）

| 标志 | 描述 |
|------|------|
| `--progress` | 显示实时传输进度 |
| `--transfers 4` | 并行传输数 |
| `--checkers 8` | 并行校验数 |
| `--retries 10` | 对失败操作进行重试 |
| `--low-level-retries 20` | 对底层错误进行重试 |
| `--log-file path` | 将日志写入文件 |
| `--dry-run` | 预览将要执行的操作（dry-run） |
| `--checksum` | 使用校验和进行校验 |

### 速率限制（Rate Limiting）

Dropbox 对 API 调用有严格的速率限制。若您遇到 `too_many_requests` 错误：

```bash
# Use bandwidth limiting
rclone copy dropbox: /backup --bwlimit 1M

# Or add delays between operations
rclone copy dropbox: /backup --tpslimit 2
```

rclone 会自动通过指数退避（exponential backoff）机制处理速率限制。

## 最佳实践

1. **使用 OAuth 登录** —— 采用安全的 Keychain 存储并支持令牌自动刷新  
2. **对 agents 使用 MCP** —— 更适用于程序化访问  
3. **对批量操作使用 rclone** —— 更适合备份及大规模数据传输  
4. **操作前先验证路径** —— 在执行操作前使用 `list_directory` 验证路径  
5. **优雅地处理错误** —— 检查响应中是否存在错误字段  
6. **遵守速率限制** —— 在批量操作之间加入适当延迟  
7. **使用绝对路径** —— 文件操作时始终提供完整路径  

## 安全性

- **Keychain 存储**：令牌采用硬件级加密保护  
- **PKCE**：Proof Key for Code Exchange，防止授权码被截获  
- **state 参数**：为 OAuth 流程提供 CSRF 防护  
- **令牌刷新**：在令牌过期前自动刷新  
- **CryptoKit**：现代 Swift 加密框架  

## 依赖项

- **SwiftyDropbox**（v10.2.4+）：官方 Dropbox Swift SDK  
- **MCP（swift-sdk）**：Model Context Protocol SDK  
- **CryptoKit**：Apple 提供的加密框架  
- **rclone**（可选）：用于批量操作和备份（`brew install rclone`）

## 参见

- [Dropbook GitHub](https://github.com/RyanLisse/Dropbook)  
- [CLAUDE.md](../CLAUDE.md) —— 完整项目文档  
- [Dropbox API 文档](https://www.dropbox.com/developers/documentation)  
- [rclone Dropbox 文档](https://rclone.org/dropbox/) —— 批量同步与备份  
- [RFC 7636 - PKCE](https://datatracker.ietf.org/doc/html/rfc7636)  
- [RFC 9700 - OAuth 2.0 安全最佳实践](https://datatracker.ietf.org/doc/html/rfc9700)