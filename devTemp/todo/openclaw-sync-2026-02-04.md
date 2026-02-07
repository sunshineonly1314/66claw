# OpenClaw 上游同步归档 (2026-02-04)

> **状态**: 已归档
> **归档时间**: 2026-02-04 18:00

---

## 同步概览

| 项目 | 值 |
|------|------|
| 本地版本 | 2026.1.25 |
| 上游版本 | 2026.2.2 |
| 上游最新 commit | fc40ba8e7 |
| 上次同步 | 2026-02-02 (初始分析) |
| 本次同步 | 2026-02-04 (安全修复) |
| 下次评估 | 2026-03-15 |

---

## 📊 同步状态总览

```
┌─────────────────────────────────────────────────────────────┐
│                    同步项目统计                              │
├─────────────────────────────────────────────────────────────┤
│  ✅ 已合并      │  3 项  │  SSRF、cwd验证、Telegram超时    │
│  ⏭️ 已跳过      │  4 项  │  本地已有同等实现                │
│  ⏸️ 暂缓        │  6 项  │  pi-ai升级、新功能等            │
│  ❌ 永不合并    │  4 项  │  品牌重塑、架构差异              │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ 已合并项目 (3项)

### 1. SSRF 防护
| 属性 | 值 |
|------|------|
| 编号 | #1 |
| 优先级 | P1 (安全关键) |
| 状态 | ✅ 已合并 |
| 完成时间 | 2026-02-04 |

**修复文件**:
- `src/media/fetch.ts` - 添加 `validateUrlForSsrf()` 检查
- `src/agents/skills-install.ts` - 添加 SSRF 验证
- `src/agents/skills/gitee-registry.ts` - 添加 SSRF 验证
- `src/infra/net/ssrf.ts` - 公共 SSRF 验证模块

**修复内容**: 在 fetch 调用前验证 URL 主机名，阻止 localhost、私有 IP、内网地址

---

### 2. cwd 路径注入验证
| 属性 | 值 |
|------|------|
| 编号 | #2 |
| 优先级 | P1 (安全关键) |
| 状态 | ✅ 已合并 |
| 完成时间 | 2026-02-04 |

**修复文件**:
- `src/process/exec.ts` - 新增 `validateCwdPath()` 函数
- `extensions/lobster/src/lobster-tool.ts` - 添加 cwd 验证

**修复内容**: 
- 阻止访问敏感系统目录 (Windows: system32, syswow64; Unix: /etc, /root, /proc, /sys, /dev)
- 可选限制 cwd 必须在指定 baseDir 内
- 验证目录存在性

---

### 3. Telegram 超时处理
| 属性 | 值 |
|------|------|
| 编号 | #4 |
| 优先级 | P2 (稳定性) |
| 状态 | ✅ 已合并 |
| 完成时间 | 2026-02-04 |

**修复文件**:
- `src/telegram/download.ts` - 添加 `fetchWithTimeout`
- `src/media/fetch.ts` - 添加 `timeoutMs` 选项

**修复内容**:
- getTelegramFile: 默认 30 秒超时
- downloadTelegramFile: 默认 120 秒超时
- fetchRemoteMedia: 默认 60 秒超时

---

## ⏭️ 已跳过项目 (4项) - 本地已有同等实现

| # | 项目 | 本地实现位置 | 跳过原因 |
|---|------|------------|---------|
| 1 | LD_/DYLD_ 环境变量过滤 | `src/node-host/runner.ts` sanitizeEnv | 本地已实现 |
| 2 | Windows spawn .cmd 处理 | `src/process/exec.ts` 第 90-96 行 | 本地已实现 |
| 3 | Gateway 共享密钥验证 | Ed25519 签名 + timingSafeEqual | 本地实现更完善 |
| 4 | Memory search L2 归一化 | cosineSimilarity 隐式归一化 | 当前实现可接受 |

---

## ⏸️ 暂缓项目 (6项)

### 1. pi-ai 升级到 0.50.9+
| 属性 | 值 |
|------|------|
| 编号 | #3 |
| 状态 | ⏸️ 暂缓 |
| 下次评估 | 2026-03-15 |

**暂缓原因**: API 变更过大
- `discoverAuthStorage` / `discoverModels` 导出变更 (13 文件, 49 处调用)
- `cacheControlTtl` → `cacheRetention` 类型变更 (3 文件, 10 处调用)
- `CreateAgentSessionOptions` 结构变更 (2 文件, 6 处调用)
- 总计影响 50+ 文件，预计 2-3 天工作量

**评估结论**: 
- 收益: 新功能、稳定性改进
- 风险: 大量代码修改、回归风险
- 决定: 等待上游稳定或迁移指南后再升级

---

### 2. Agents Dashboard (Web UI)
| 属性 | 值 |
|------|------|
| 状态 | ⏸️ 暂缓 |
| 原因 | 大型功能，与本地 UI 定制冲突 |

**上游功能**: 管理 agent files, tools, skills, models, channels, cron jobs

---

### 3. 子代理 thinking 配置
| 属性 | 值 |
|------|------|
| 状态 | ⏸️ 暂缓 |
| 原因 | 非核心需求 |

**上游功能**: `agents.defaults.subagents.thinking` 配置

---

### 4. CLI shell completion
| 属性 | 值 |
|------|------|
| 状态 | ⏸️ 暂缓 |
| 原因 | 非核心需求 |

**上游功能**: Zsh/Bash/PowerShell/Fish 补全命令

---

### 5. QMD Memory 后端
| 属性 | 值 |
|------|------|
| 状态 | ⏸️ 暂缓 |
| 原因 | 可选功能 |

**上游功能**: 可选的工作区记忆后端

---

### 6. Agent 工具调用修复
| 属性 | 值 |
|------|------|
| 状态 | ⏸️ 待评估 |
| 下次评估 | 2026-02-15 |

**上游功能**: repair malformed tool calls and session transcripts

---

## ❌ 永不合并项目 (4项)

| # | 项目 | 原因 |
|---|------|------|
| 1 | 品牌重塑 (openclaw) | 保留 clawdbot 品牌 |
| 2 | tsdown/tsgo 构建系统 | 构建系统差异，不影响功能 |
| 3 | Gateway auth mode 'none' 移除 | 破坏性变更，保留本地兼容性 |
| 4 | session-logs 路径变更 (.clawdbot → .openclaw) | 使用 .clawdbot 路径 |

---

## 📋 本地特有功能 (不受上游影响)

| 模块 | 路径 | 说明 |
|------|------|------|
| 授权系统 | `src/license/` | 设备ID、心跳、离线、通知 |
| 授权 UI | `ui/src/ui/license/` | 激活弹窗 |
| 中国区配置 | `src/config/region-cn.ts` | 国内 AI 提供商 |
| 国内镜像 | `src/config/cn-mirrors.ts` | npm/pip/go 镜像 |
| 钉钉扩展 | `extensions/dingtalk/` | webhook + stream 模式 |
| 飞书扩展 | `extensions/feishu/` | 飞书渠道 |
| 企业微信扩展 | `extensions/wecom/` | 企业微信渠道 |
| Gateway 授权 | `src/gateway/license-check.ts` | 授权检查 |
| 配置向导 | `src/gateway/setup-wizard.ts` | 中国区定制 |

---

## 🔄 下一步行动

| 行动 | 截止日期 | 说明 |
|------|---------|------|
| 监控上游 | 2026-03-15 | 关注 pi-ai 0.52.x 是否稳定 |
| 评估工具修复 | 2026-02-15 | 检查 Agent 工具调用修复实现 |
| 准备兼容层 | 需要时 | 为 cacheControlTtl 写适配器 |

---

## 📝 更新日志

### 2026-02-04 (归档)
- 完成安全修复同步 (SSRF、cwd验证、Telegram超时)
- 完成 pi-ai 升级评估，决定暂缓
- 归档同步状态文件
- Code Review 优化:
  - 修复正则匹配不完整问题 (`/^\/etc\/?$/` → `/^\/etc(\/|$)/`)
  - 提取 `validateUrlForSsrf` 到公共模块 `src/infra/net/ssrf.ts`
  - 消除 ~60 行重复代码

### 2026-02-02
- 初始评估完成
- 创建同步计划文档
