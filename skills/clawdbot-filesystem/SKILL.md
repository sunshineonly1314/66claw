---
name: filesystem
name_zh: ClawdBot文件系统
description: 高级文件系统操作 —— 为 Clawdbot 提供文件与目录的列举、搜索、批量处理及目录分析能力
description_zh: 高级文件系统操作 —— 为 Clawdbot 提供文件与目录的列举、搜索、批量处理及目录分析能力
homepage: https://github.com/gtrusler/clawdbot-filesystem
metadata: {"clawdbot":{"emoji":"📁","requires":{"bins":["node"]}}}
---
# 📁 文件系统管理

面向 AI agents 的高级文件系统操作。支持智能过滤、搜索与批处理能力的全面文件与目录操作。

## 功能特性

### 📋 **智能文件列表**
- **高级过滤** —— 按文件类型、模式、大小和日期过滤  
- **递归遍历** —— 支持深度控制的深层目录扫描  
- **丰富格式输出** —— 表格、树状结构及 JSON 输出格式  
- **排序选项** —— 按名称、大小、日期或类型排序  

### 🔍 **强大搜索**
- **模式匹配** —— 支持 glob 模式与正则表达式  
- **内容搜索** —— 在文件内执行全文搜索  
- **多条件组合** —— 同时结合文件名与内容搜索  
- **上下文显示** —— 显示匹配行及其上下文  

### 🔄 **批量操作**
- **安全复制** —— 基于模式的文件复制并内置校验机制  
- **预览模式（Dry Run）** —— 执行前预览操作效果  
- **进度追踪** —— 实时显示操作进度  
- **错误处理** —— 优雅应对失败并恢复  

### 🌳 **目录分析**
- **树状可视化** —— ASCII 格式的树形结构展示  
- **统计信息** —— 文件数量、大小分布、类型分析  
- **空间分析** —— 识别大文件与大目录  
- **性能指标** —— 操作耗时与优化建议  

## 快速开始

```bash
# List files with filtering
filesystem list --path ./src --recursive --filter "*.js"

# Search for content
filesystem search --pattern "TODO" --path ./src --content

# Batch copy with safety
filesystem copy --pattern "*.log" --to ./backup/ --dry-run

# Show directory tree
filesystem tree --path ./ --depth 3

# Analyze directory structure
filesystem analyze --path ./logs --stats
```

## 命令参考

### `filesystem list`
支持过滤选项的高级文件与目录列举功能。

**选项：**  
- `--path, -p <dir>` —— 目标目录（默认：当前目录）  
- `--recursive, -r` —— 包含子目录  
- `--filter, -f <pattern>` —— 按模式过滤文件  
- `--details, -d` —— 显示详细信息  
- `--sort, -s <field>` —— 按名称｜大小｜日期排序  
- `--format <type>` —— 输出格式：table｜json｜list  

### `filesystem search`
按文件名模式或内容搜索文件。

**选项：**  
- `--pattern <pattern>` —— 搜索模式（glob 或正则表达式）  
- `--path, -p <dir>` —— 搜索目录  
- `--content, -c` —— 搜索文件内容  
- `--context <lines>` —— 显示上下文行  
- `--include <pattern>` —— 包含的文件模式  
- `--exclude <pattern>` —— 排除的文件模式  

### `filesystem copy`
基于模式匹配与安全校验的批量文件复制。

**选项：**  
- `--pattern <glob>` —— 源文件模式  
- `--to <dir>` —— 目标目录  
- `--dry-run` —— 仅预览，不执行  
- `--overwrite` —— 允许覆盖已有文件  
- `--preserve` —— 保留时间戳与权限  

### `filesystem tree`
以树状结构显示目录结构。

**选项：**  
- `--path, -p <dir>` —— 根目录  
- `--depth, -d <num>` —— 最大深度  
- `--dirs-only` —— 仅显示目录  
- `--size` —— 显示文件大小  
- `--no-color` —— 禁用彩色输出  

### `filesystem analyze`
分析目录结构并生成统计信息。

**选项：**  
- `--path, -p <dir>` —— 目标目录  
- `--stats` —— 显示详细统计信息  
- `--types` —— 分析文件类型  
- `--sizes` —— 显示大小分布  
- `--largest <num>` —— 显示最大的 N 个文件  

## 安装方式

```bash
# Clone or install the skill
cd ~/.clawdbot/skills
git clone <filesystem-skill-repo>

# Or install via ClawdHub
clawdhub install filesystem

# Make executable
chmod +x filesystem/filesystem
```

## 配置

通过 `config.json` 自定义行为：

```json
{
  "defaultPath": "./",
  "maxDepth": 10,
  "defaultFilters": ["*"],
  "excludePatterns": ["node_modules", ".git", ".DS_Store"],
  "outputFormat": "table",
  "dateFormat": "YYYY-MM-DD HH:mm:ss",
  "sizeFormat": "human",
  "colorOutput": true
}
```

## 示例

### 开发工作流
```bash
# Find all JavaScript files in src
filesystem list --path ./src --recursive --filter "*.js" --details

# Search for TODO comments
filesystem search --pattern "TODO|FIXME" --path ./src --content --context 2

# Copy all logs to backup
filesystem copy --pattern "*.log" --to ./backup/logs/ --preserve

# Analyze project structure
filesystem tree --path ./ --depth 2 --size
```

### 系统管理
```bash
# Find large files
filesystem analyze --path /var/log --sizes --largest 10

# List recent files
filesystem list --path /tmp --sort date --details

# Clean old temp files
filesystem list --path /tmp --filter "*.tmp" --older-than 7d
```

## 安全特性

- **路径校验** —— 防止目录遍历攻击  
- **权限检查** —— 操作前验证读/写权限  
- **预览模式（Dry Run）** —— 对破坏性操作进行预览  
- **备份提示** —— 覆盖前建议创建备份  
- **错误恢复** —— 优雅处理权限类错误  

## 集成能力

可无缝协同其他 Clawdbot 工具使用：  
- **Security Skill** —— 对所有文件系统操作进行安全校验  
- **Git Operations** —— 尊重 .gitignore 规则  
- **Backup Tools** —— 与备份工作流集成  
- **Log Analysis** —— 特别适用于日志文件管理  

## 更新与社区

**及时获取最新 Clawdbot skills 与文件系统工具动态：**

- 🐦 在 X 平台关注 [@LexpertAI](https://x.com/LexpertAI)，获取 skill 更新与发布信息  
- 🛠️ **新文件系统功能** 与增强特性  
- 📋 **文件管理自动化最佳实践**  
- 💡 **提升工作效率的技巧与窍门**  

关注 @LexpertAI，即可提前体验新 skills 与改进功能，包括：  
- **skill 发布公告** 与新版本上线  
- **性能优化** 与功能更新  
- **集成示例** 与工作流自动化方案  
- **生产力工具相关的社区讨论**  

## 许可证

MIT 许可证 —— 可免费用于个人及商业用途。

---

**请注意**：卓越的文件系统管理始于恰当的工具。本 skill 在保障安全性与高性能的同时，提供全面的操作能力。