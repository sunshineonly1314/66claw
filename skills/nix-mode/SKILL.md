---
name: nix-mode
name_zh: Nix模式
description: 在 Nix 模式下处理 Clawdbot 运维操作（配置管理、环境检测）。
description_zh: 在 Nix 模式下处理 Clawdbot 运维操作（配置管理、环境检测）。
metadata: {"clawdbot":{"emoji":"❄️","requires":{"bins":["nix","bash"],"envs":["CLAWDBOT_NIX_MODE"]},"install":[]}}
---
# Clawdbot Nix 模式技能（Clawdbot Nix Mode Skill）

本技能专用于 Clawdbot 在 Nix 模式下运行时的相关运维操作。

## Nix 模式专属功能

### 环境检测
- 检测 `CLAWDBOT_NIX_MODE=1` 是否已设置  
- 识别 Nix 托管的配置路径  
- 辨识 Nix 特有的错误消息与行为表现  

### 配置管理
- 明确 Nix 模式下自动安装流程已被禁用  
- 引导用户采用正确的 Nix 包管理方式  
- 解释为何部分自修改功能在该模式下不可用  

### 路径处理
- 识别 Nix store 路径  
- 理解配置目录（config directory）与状态目录（state directory）的区别  
- 正确处理 `CLAWDBOT_CONFIG_PATH` 和 `CLAWDBOT_STATE_DIR`  

### 故障排查
- 识别 Nix 特有的修复提示信息  
- 引导用户通过 Nix 进行依赖管理  
- 解释只读 Nix 模式横幅（read-only Nix mode banner）的行为逻辑  

## 使用准则

在 Nix 模式下运行时：
1. 不得尝试自动安装依赖项  
2. 应引导用户使用 Nix 包管理工具  
3. 尊重 Nix 安装的不可变性（immutable nature）  
4. 就 Nix 环境下的正确配置实践提供建议  