# PRD-02: AI 代理引擎模块 (src/agents/)

## 1. 模块概述

AI 代理引擎是 Clawdbot 的核心模块，负责 LLM 模型管理、会话执行、工具调用、沙箱隔离和技能系统。

## 2. 功能需求

### 2.1 模型管理

**模型目录 (model-catalog.ts)**
- 从 Pi SDK 加载模型目录并缓存
- 支持按提供商/模型 ID 查找
- 判断模型是否支持视觉能力
- 缓存策略：加载一次，失败时清除

**模型兼容性 (model-compat.ts)**
- 标准化不同提供商的模型兼容性差异
- 处理 `developer` 角色在特定提供商的禁用
- 自动修正模型参数以适配提供商限制

**模型配置 (models-config.ts)**
- 合并显式配置与隐式提供商（环境变量、认证配置）
- 确保 `models.json` 文件存在并合法
- 提供商优先级解析与冲突处理

**提供商发现 (models-config.providers.ts)**
- 支持 30+ LLM 提供商（OpenAI、Anthropic、Google Gemini、硅基流动、DeepSeek、智谱、阿里云百炼等）
- 自动从环境变量解析提供商凭证
- 中国区特有提供商支持

**Bedrock 发现 (bedrock-discovery.ts)**
- AWS Bedrock 模型自动发现
- API 调用结果缓存
- 凭证验证与错误处理

### 2.2 会话执行引擎 (pi-embedded-runner/)

**模型解析 (model.ts)**
- 从提供商/模型 ID 解析模型实例
- 构建模型别名行
- 支持火山引擎 ARK 内置回退

**主执行器 (run.ts)**
- 编排 AI 代理执行流程
- 管理会话生命周期
- 处理流式响应与块状回复
- 失败转移（failover）逻辑
- 中国区错误消息本地化

**单次尝试 (run/attempt.ts)**
- 管理单次代理执行尝试
- 会话状态恢复
- 图片历史注入
- 孤立消息修复
- 诊断日志记录

**响应构建 (run/payloads.ts)**
- 从助手消息构建响应载荷
- 错误文本抑制逻辑
- 工具调用结果过滤

**会话压缩 (compact.ts)**
- 上下文过长时自动压缩
- Token 估算与验证
- 保留关键上下文信息

### 2.3 沙箱系统 (sandbox/)

**上下文解析 (context.ts)**
- 解析会话的沙箱上下文
- 确保工作区存在
- 技能同步到沙箱

**Docker 管理 (docker.ts)**
- Docker 容器生命周期管理
- 容器创建、启动、停止
- 配置哈希校验（检测配置变更）
- Docker 可用性检测

### 2.4 技能系统 (skills/)

**技能配置 (config.ts)**
- 技能可用性检查
- 二进制路径解析
- 中国区技能隐藏策略

**技能同步 (sync.ts)**
- 后台技能索引同步
- 市场数据获取
- 并发同步防护

**注册中心 (gitee-registry.ts, clawdskillsproxy-registry.ts)**
- 支持 Gitee 和 ClawdSkillsProxy 两种注册中心
- 技能下载与安装
- 版本管理

### 2.5 系统提示词 (system-prompt.ts)

- 构建代理系统提示词
- 支持多个提示词段落
- 运行时信息行构建
- 最小模式与完整模式

### 2.6 工具系统

**图片工具 (tools/image-tool.ts)**
- 视觉模型图片分析
- 沙箱模式下 URL 限制
- 媒体加载与处理

**Shell 工具 (shell-utils.ts)**
- Shell 配置管理
- 进程树终止
- 二进制输出清理
- Windows PowerShell UTF-8 修复

### 2.7 错误处理 (pi-embedded-helpers/errors.ts)

- 错误分类（可重试/不可重试）
- 失败转移原因判断
- 上下文溢出检测
- 用户友好错误格式化

## 3. 非功能性需求

### 3.1 性能
- 模型目录缓存，避免重复加载
- Bedrock 发现结果缓存
- 二进制路径查找缓存

### 3.2 可靠性
- 失败转移机制（多模型回退）
- 会话损坏恢复
- 沙箱容器状态检测

### 3.3 安全性
- 沙箱隔离（Docker）
- Shell 命令输出清理
- 图片 URL 限制（沙箱模式）

## 4. 接口定义

### 4.1 核心函数

| 函数 | 位置 | 说明 |
|------|------|------|
| `loadModelCatalog()` | model-catalog.ts | 加载模型目录 |
| `resolveModel()` | pi-embedded-runner/model.ts | 解析模型实例 |
| `runEmbeddedPiAgent()` | pi-embedded-runner/run.ts | 执行 AI 代理 |
| `ensureSandboxContainer()` | sandbox/docker.ts | 确保沙箱容器运行 |
| `syncSkillsIndex()` | skills/sync.ts | 同步技能索引 |
| `buildAgentSystemPrompt()` | system-prompt.ts | 构建系统提示词 |
| `classifyFailoverReason()` | errors.ts | 分类失败原因 |

## 5. 依赖关系

```
agents/ ──→ config/config.js (配置)
        ──→ auto-reply/ (回复处理)
        ──→ @mariozechner/pi-coding-agent (SDK)
        ──→ @mariozechner/pi-ai (AI API)
        ──→ @aws-sdk/client-bedrock (AWS)
```
