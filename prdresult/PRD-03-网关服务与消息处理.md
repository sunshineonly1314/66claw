# PRD-03: 网关服务与消息处理模块

## 1. 模块概述

Gateway 网关层是 Clawdbot 的服务核心，提供 HTTP/WebSocket 服务、配置热更新、授权校验和 Web 管理界面。Auto-Reply 负责消息分发和 AI 代理回复生成。

## 2. 网关功能需求 (src/gateway/)

### 2.1 HTTP 服务器 (server-http.ts)

**路由体系**:
- `/api/*` - WebSocket RPC 方法的 HTTP 映射
- `/control/*` - 管理界面静态文件
- `/setup/*` - 配置向导
- `/v1/chat/completions` - OpenAI 兼容 API
- `/hooks/*` - Webhook 接收端点
- 健康检查端点

**认证机制**:
- Bearer Token 认证（HTTP Header）
- 已弃用的 Query Parameter Token（仍然可用）
- Hook Token 专用认证

### 2.2 WebSocket RPC (server-methods.ts)

**方法分组**:
| 方法组 | 文件 | 功能 |
|--------|------|------|
| chat | server-methods/chat.ts | 聊天消息收发、流式传输、中止 |
| config | server-methods/config.ts | 配置读写、Schema 获取、重载 |
| models | server-methods/models.ts | 模型列表、提供商管理 |
| skills | server-methods/skills.ts | 技能管理、安装、卸载 |
| license | server-methods/license.ts | 授权验证、设备管理 |

**聊天方法 (chat.ts, 695行)**:
- 消息发送与去重
- 流式响应传输
- 中止正在运行的任务
- 消息历史查询
- 会话管理

### 2.3 配置热更新 (config-reload.ts, 392行)

- 文件系统监听（chokidar）
- 防抖机制避免频繁重载
- `pending` 标志防止并发重载
- 重载时渠道重启
- 失败回滚策略

### 2.4 授权校验 (license-check.ts, 465行)

- 在线 Token 验证
- 本地缓存验证（离线回退）
- Token 自动刷新
- 授权状态全局管理
- 中国区专属功能

### 2.5 配置向导 (setup-wizard.ts, 2155行)

- 首次安装 Web 配置界面
- 提供商选择与 API Key 配置
- 渠道配置（Telegram、Discord 等）
- 工作区目录浏览
- 安全设置
- 授权码激活

### 2.6 管理界面 (control-ui.ts)

- 静态文件服务
- UI 资源缓存
- 路由映射

### 2.7 服务器生命周期 (server.impl.ts, server-close.ts)

- 服务器初始化与启动
- 渠道注册与启动
- 优雅关闭（graceful shutdown）
- 端口冲突处理

## 3. 消息处理功能需求 (src/auto-reply/)

### 3.1 消息分发 (dispatch.ts)

- 入站消息接收
- 消息去重
- 路由到正确的处理器
- 触发条件检查

### 3.2 回复生成 (reply/get-reply.ts, 557行)

**核心流程**:
1. 加载配置并解析代理 ID
2. 解析默认模型（提供商/模型）
3. **免费模型优先级检查**（ClawdbotCN 专属）
4. 解析心跳模型（如果是心跳请求）
5. 确保代理工作区存在
6. 媒体理解与链接理解
7. 命令授权检查
8. 会话状态初始化
9. 重置模型覆盖
10. 指令解析（/model, /think, /reset 等）
11. **应用免费模型**（如果可用且用户未手动指定模型）
12. 内联操作处理
13. 沙箱媒体暂存
14. **免费模型重试循环**（最多 3 次）
15. 回退到付费模型（所有免费模型耗尽时）
16. 添加免费模型通知到响应

### 3.3 免费模型系统

**优先级检查** (`free-model-priority.ts`):
- 检查可用的免费模型
- 按优先级排序
- 配额追踪

**自动切换逻辑**:
- 检测配额耗尽错误（HTTP 429/402等）
- 自动切换到下一个免费模型
- 所有免费模型耗尽后回退付费模型
- 最大重试次数限制（3次）

**通知系统**:
- 免费模型使用通知
- 配额耗尽通知
- 通知附加到聊天消息

### 3.4 代理执行 (reply/agent-runner.ts, agent-runner-execution.ts)

**执行编排**:
- 会话生命周期管理
- 执行失败重试
- 打字指示器控制
- 流式块传输

**执行器** (agent-runner-execution.ts):
- 底层代理执行
- 会话损坏恢复
- 转录文件删除
- 错误分类与重试

### 3.5 队列模式

| 模式 | 说明 |
|------|------|
| collect | 收集消息后统一回复 |
| followup | 追加消息到当前对话 |
| interrupt | 中断当前执行并重新回复 |
| steer | 引导当前执行方向 |

### 3.6 指令系统

| 指令 | 功能 |
|------|------|
| `/model <name>` | 切换模型 |
| `/think <level>` | 设置思考级别 |
| `/reset` | 重置会话 |
| `/status` | 查看状态 |
| `/help` | 帮助信息 |

## 4. 非功能性需求

### 4.1 性能
- WebSocket 连接复用
- 消息去重缓存
- 配置重载防抖
- 流式响应传输

### 4.2 可靠性
- 配置重载失败回滚
- 代理执行超时机制
- 会话损坏自动恢复
- 免费模型自动切换

### 4.3 安全性
- Bearer Token 认证
- SSRF 防护
- 路径遍历防护（向导目录浏览）
- 输入验证

## 5. 协议定义 (protocol/schema/)

### 5.1 RPC 协议

**agents-models-skills.ts**:
- 代理列表/详情/创建/更新/删除
- 模型列表/提供商管理
- 技能列表/安装/卸载/状态

**error-codes.ts**:
- 标准化错误码
- 用户友好错误消息
- 错误分类

## 6. 接口定义

| 函数 | 文件 | 说明 |
|------|------|------|
| `getReplyFromConfig()` | get-reply.ts | 主回复生成入口 |
| `runPreparedReply()` | get-reply-run.ts | 已准备的回复执行 |
| `resolveReplyDirectives()` | get-reply-directives.ts | 解析回复指令 |
| `handleInlineActions()` | get-reply-inline-actions.ts | 处理内联操作 |
| `checkFreeModelPriority()` | free-model-priority.ts | 免费模型检查 |
| `handleFreeModelQuotaExhausted()` | free-model-priority.ts | 处理配额耗尽 |
