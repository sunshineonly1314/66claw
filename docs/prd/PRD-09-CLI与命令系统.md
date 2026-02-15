# PRD-09: CLI 与命令系统

## 1. 模块概述

CLI 系统基于 Commander.js，提供 OpenClawCN 的命令行界面，包括网关管理、技能操作、配置向导、维护诊断等功能。

## 2. 功能需求

### 2.1 网关 CLI (src/cli/gateway-cli/register.ts)

**命令**:
| 命令 | 说明 |
|------|------|
| `openclawcn gateway run` | 启动网关服务 |
| `openclawcn gateway status` | 查看网关状态 |
| `openclawcn gateway health` | 健康检查 |
| `openclawcn gateway probe` | 探测连接 |
| `openclawcn gateway discover` | Bonjour 发现 |
| `openclawcn gateway usage` | 使用统计 |

**选项**:
- `--bind <mode>` - 绑定模式（loopback/any）
- `--port <port>` - 端口号
- `--force` - 强制启动
- `--dev` - 开发模式

### 2.2 技能 CLI (src/cli/skills-cli.ts, 625行)

**命令**:
| 命令 | 说明 |
|------|------|
| `openclawcn skills list` | 列出已安装技能 |
| `openclawcn skills info <name>` | 技能详情 |
| `openclawcn skills install <name>` | 安装技能 |
| `openclawcn skills remote` | 远程技能列表 |
| `openclawcn skills sync` | 同步技能索引 |

**特性**:
- 远程技能从 Gitee 安装
- 技能搜索与筛选
- 安装进度显示
- 依赖解析

### 2.3 维护命令 (src/cli/program/register.maintenance.ts)

| 命令 | 说明 |
|------|------|
| `openclawcn doctor` | 诊断检查 |
| `openclawcn dashboard` | 仪表盘 |
| `openclawcn reset` | 重置配置 |
| `openclawcn uninstall` | 卸载 |

### 2.4 配置命令 (src/commands/)

**认证配置**:
| 文件 | 说明 |
|------|------|
| onboard-auth.ts | 认证引导主流程 |
| onboard-auth.credentials.ts | 凭证管理 |
| onboard-auth.models.ts | 模型配置 |
| onboard-auth.config-core.ts | 核心配置 |
| auth-choice.apply.cn-providers.ts | 中国区提供商配置 |

**其他命令**:
| 文件 | 说明 |
|------|------|
| onboard-skills.ts | 技能引导 |
| signal-install.ts | Signal 安装 |
| uninstall.ts | 卸载流程 |

### 2.5 设置向导 (src/wizard/)

**引导流程**:
1. 区域选择（中国/国际）
2. 提供商选择
3. API Key 配置
4. 渠道选择与配置
5. 安全设置
6. 完成确认

**文件**:
| 文件 | 说明 |
|------|------|
| onboarding.ts | 主引导流程 |
| onboarding.finalize.ts | 完成处理 |
| onboarding.gateway-config.ts | 网关配置 |
| clack-prompter.ts | 交互式提示 |
| prompts.ts | 提示工具 |
| session.ts | 向导会话 |

## 3. 进度与日志

### 3.1 进度显示 (src/cli/progress.ts)

- `osc-progress` 终端进度条
- `@clack/prompts` 交互式提示
- 统一的进度回调接口

### 3.2 表格输出 (src/terminal/table.ts)

- ANSI 安全的表格渲染
- 自动列宽计算
- 终端宽度适配

## 4. 非功能性需求

### 4.1 用户体验
- 交互式引导（clack prompts）
- 彩色终端输出
- 进度指示器
- 错误友好提示

### 4.2 可靠性
- 超时处理（Bonjour 发现）
- 错误恢复
- 配置备份

### 4.3 安全性
- 敏感信息不显示在日志
- Token 安全输入
- 配置文件权限
