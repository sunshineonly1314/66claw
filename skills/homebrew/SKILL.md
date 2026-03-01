---
name: homebrew
name_zh: Homebrew
description: macOS 的 Homebrew 包管理器。搜索、安装、管理及排查软件包与 cask 应用。
description_zh: macOS 的 Homebrew 包管理器。搜索、安装、管理及排查软件包与 cask 应用。
metadata: {"clawdbot":{"emoji":"🍺","requires":{"bins":["brew"]}}}
---
# Homebrew 包管理器

面向 macOS 的完整 Homebrew 命令参考与使用指南，涵盖软件包安装、管理及故障排查。

## 适用场景
- 安装软件包或应用程序（`brew install X`）  
- 搜索可用软件包（`brew search X`）  
- 更新与升级现有软件包  
- 查询软件包信息与依赖关系  
- 排查安装问题  
- 管理已安装软件包  

## 命令参考

### 软件包搜索与信息查询

#### `brew search TEXT|/REGEX/`  
**用法：** 按名称或正则表达式模式查找软件包  
**适用场景：** 用户要求“查找 X”或“搜索 X”时  
**示例：**  
```bash
brew search python
brew search /^node/
```

#### `brew info [FORMULA|CASK...]`  
**用法：** 显示一个或多个软件包的详细信息  
**适用场景：** 安装前查看依赖项、可选参数及其他详情  
**示例：**  
```bash
brew info python
brew info chrome google-chrome
```

### 安装与升级

#### `brew install FORMULA|CASK...`  
**用法：** 安装一个或多个软件包或应用程序  
**适用场景：** 用户说“安装 X”或“用 brew 安装 X”时  
**注意事项：**  
- FORMULA = 命令行工具（安装至 /usr/local/bin）  
- CASK = 图形界面应用程序（安装至 /Applications）  
- 可同时安装多个：`brew install git python nodejs`  
**示例：**  
```bash
brew install python
brew install google-chrome  # installs as cask
brew install git python nodejs
```

#### `brew update`  
**用法：** 获取最新版 Homebrew 及全部 formulae  
**适用场景：** 当 brew 显得过时，或执行重大操作前  
**注意事项：** 仅更新软件包列表，不升级已安装软件包  
**示例：**  
```bash
brew update
```

#### `brew upgrade [FORMULA|CASK...]`  
**用法：** 升级已安装的软件包，或指定特定软件包  
**适用场景：** 用户希望升级至新版本时  
**注意事项：**  
- 不带参数：升级所有过时软件包  
- 带参数：仅升级指定软件包  
**示例：**  
```bash
brew upgrade              # upgrade all outdated packages
brew upgrade python       # upgrade just python
brew upgrade python git   # upgrade multiple
```

### 软件包管理

#### `brew uninstall FORMULA|CASK...`  
**用法：** 卸载已安装的软件包  
**适用场景：** 用户希望移除/删除某软件包时  
**注意事项：** 可同时卸载多个软件包  
**示例：**  
```bash
brew uninstall python
brew uninstall google-chrome
```

#### `brew list [FORMULA|CASK...]`  
**用法：** 列出已安装软件包，或列出特定软件包所含文件  
**适用场景：** 用户想查看已安装内容，或了解某软件包包含哪些文件时  
**示例：**  
```bash
brew list                 # show all installed packages
brew list python          # show files installed by python
```

### 配置与故障排查

#### `brew config`  
**用法：** 显示 Homebrew 配置与环境信息  
**适用场景：** 排查安装问题或检查系统配置时  
**显示内容：**  
- 安装路径  
- Xcode 位置  
- Git 版本  
- CPU 架构  
**示例：**  
```bash
brew config
```

#### `brew doctor`  
**用法：** 检查 Homebrew 安装中潜在的问题  
**适用场景：** 遇到安装问题或报错时  
**返回内容：** 警告信息及修复建议  
**示例：**  
```bash
brew doctor
```

#### `brew install --verbose --debug FORMULA|CASK`  
**用法：** 启用详细输出与调试信息进行安装  
**适用场景：** 标准安装失败，需要详细错误日志时  
**示例：**  
```bash
brew install --verbose --debug python
```

### 高级用法

#### `brew create URL [--no-fetch]`  
**用法：** 从源码创建新 formula  
**适用场景：** 创建自定义软件包（高级用户）  
**可选参数：**  
- `--no-fetch` = 不立即下载源码  
**示例：**  
```bash
brew create https://example.com/package.tar.gz
```

#### `brew edit [FORMULA|CASK...]`  
**用法：** 编辑 formula 或 cask 定义  
**适用场景：** 自定义软件包安装行为（高级用户）  
**示例：**  
```bash
brew edit python
```

#### `brew commands`  
**用法：** 显示所有可用的 brew 命令  
**适用场景：** 了解 brew 的其他功能时  
**示例：**  
```bash
brew commands
```

#### `brew help [COMMAND]`  
**用法：** 获取特定命令的详细帮助  
**适用场景：** 需要某条命令的详细说明时  
**示例：**  
```bash
brew help install
brew help upgrade
```

## 快速参考表

| 任务 | 命令 |
|------|------|
| 搜索软件包 | `brew search TEXT` |
| 查询软件包信息 | `brew info FORMULA` |
| 安装软件包 | `brew install FORMULA` |
| 安装应用程序 | `brew install CASK` |
| 更新软件包列表 | `brew update` |
| 升级全部软件包 | `brew upgrade` |
| 升级指定软件包 | `brew upgrade FORMULA` |
| 卸载软件包 | `brew uninstall FORMULA` |
| 列出已安装软件包 | `brew list` |
| 检查配置 | `brew config` |
| 排查问题 | `brew doctor` |

## 常见工作流

### 安装新软件包
1. 搜索：`brew search python`  
2. 查询信息：`brew info python@3.11`  
3. 安装：`brew install python@3.11`  

### 排查安装问题
1. 检查配置：`brew config`  
2. 运行 doctor：`brew doctor`  
3. 启用调试重试：`brew install --verbose --debug FORMULA`  

### 维护 Homebrew
1. 更新：`brew update`  
2. 查看待升级项：`brew upgrade`（显示将被升级的软件包）  
3. 升级全部：`brew upgrade`  

## 核心概念

**FORMULA：** 命令行工具与库（例如 python、git、node）  
**CASK：** 图形界面应用程序（例如 google-chrome、vscode、slack）  
**TAP：** 第三方 formula 仓库（例如 `brew tap homebrew/cask-versions`）  

## 注意事项
- 所有 brew 命令均需已安装 Homebrew  
- 从源码编译需安装 Xcode 命令行工具  
- 部分软件包安装时可能提示输入 sudo 密码  
- 不同软件包安装耗时各异  
- 软件包名称不区分大小写，但按惯例以小写形式显示  

## 资源
- 官方文档：https://docs.brew.sh  
- Formula 文档：https://github.com/Homebrew/homebrew-core  
- Cask 文档：https://github.com/Homebrew/homebrew-cask  