---
name: mole-mac-cleanup  
description: 一款 Mac 清理与优化工具，融合 CleanMyMac、AppCleaner 和 DaisyDisk 的核心功能：深度清理、智能卸载、磁盘使用洞察，以及项目构建产物清除。  
author: Benjamin Jesuiter <bjesuiter@gmail.com>  
metadata:  
  clawdbot:  
    emoji: "🧹"  
    os: ["darwin"]  
    requires:  
      bins: ["mo"]  
    install:  
      - id: brew  
        kind: brew  
        formula: mole  
        bins: ["mo"]  
        label: 通过 Homebrew 安装 Mole  
---

# Mole — Mac 清理与优化工具

**代码仓库：** https://github.com/tw93/Mole  
**命令：** `mo`（注意：不是 `mole`！）  
**安装：** `brew install mole`  

> **Note for humans:** `mo` without params opens an interactive TUI mode. Not useful for agents, but you might wanna try it manually! 😉  

## 功能概述

一体化工具包，整合 CleanMyMac、AppCleaner、DaisyDisk 与 iStat Menus 的关键能力：  
- **深度清理** — 清除缓存、日志、浏览器残留文件  
- **智能卸载** — 卸载应用程序及其隐藏残留项  
- **磁盘使用洞察** — 可视化磁盘空间占用，管理大文件  
- **实时监控** — 实时显示系统运行状态  
- **项目构建产物清除** — 清理 `node_modules`、`target`、`build` 等目录  

---

## 非交互式命令（支持 Clawd）

### 预览 / 试运行（务必首先执行）  
```bash
mo clean --dry-run              # Preview cleanup plan
mo clean --dry-run --debug      # Detailed preview with risk levels & file info
mo optimize --dry-run           # Preview optimization actions
mo optimize --dry-run --debug   # Detailed optimization preview
```  

### 执行清理  
```bash
mo clean                        # Run deep cleanup (caches, logs, browser data, trash)
mo clean --debug                # Cleanup with detailed logs
```  

### 系统优化  
```bash
mo optimize                     # Rebuild caches, reset services, refresh Finder/Dock
mo optimize --debug             # With detailed operation logs
```  

**`mo optimize` 的作用包括：**  
- 重建系统数据库并清除缓存  
- 重置网络服务  
- 刷新 Finder 与 Dock  
- 清理诊断日志与崩溃日志  
- 删除交换文件并重启动态分页器（dynamic pager）  
- 重建启动服务（launch services）与 Spotlight 索引  

### 白名单管理  
```bash
mo clean --whitelist            # Manage protected cache paths
mo optimize --whitelist         # Manage protected optimization rules
```  

### 项目构建产物清除  
```bash
mo purge                        # Clean old build artifacts (node_modules, target, venv, etc.)
mo purge --paths                # Configure which directories to scan
```  

配置文件路径：`~/.config/mole/purge_paths`  

### 安装包清理  
```bash
mo installer                    # Find/remove .dmg, .pkg, .zip installers
```  

扫描范围：下载目录（Downloads）、桌面（Desktop）、Homebrew 缓存、iCloud、邮件附件  

### 初始化设置与日常维护  
```bash
mo touchid                      # Configure Touch ID for sudo
mo completion                   # Set up shell tab completion
mo update                       # Update Mole itself
mo remove                       # Uninstall Mole from system
mo --version                    # Show installed version
mo --help                       # Show help
```  

---

## 典型工作流程

1. **检查将被清理的内容：**  
   ```bash
   mo clean --dry-run --debug
   ```  

2. **确认无误后，执行清理：**  
   ```bash
   mo clean
   ```  

3. **清理完成后，优化系统：**  
   ```bash
   mo optimize --dry-run
   mo optimize
   ```  

4. **清理开发项目中的构建产物：**  
   ```bash
   mo purge
   ```  

---

## `mo clean` 清理范围

- 用户级应用缓存  
- 浏览器缓存（Chrome、Safari、Firefox）  
- 开发者工具（Xcode、Node.js、npm）  
- 系统日志与临时文件  
- 应用专属缓存（Spotify、Dropbox、Slack）  
- 废纸篓（Trash）  

## 注意事项

- **终端推荐：** Ghostty、Alacritty、kitty 或 WezTerm 效果最佳；iTerm2 存在兼容性问题。  
- **安全性：** 务必先使用 `--dry-run` 参数进行试运行；本工具内置多重严格保护机制。  
- **调试：** 添加 `--debug` 参数可输出详细日志。