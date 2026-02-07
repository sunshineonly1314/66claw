# PRD-06: 插件与扩展系统

## 1. 模块概述

插件系统为 Clawdbot 提供可扩展架构，支持通过插件接入新渠道、添加新功能。扩展（extensions）是一种特殊的插件，以独立 npm 包形式存在。

## 2. 插件系统 (src/plugins/)

### 2.1 配置状态管理 (config-state.ts)

**配置规范化**:
- 将原始配置转换为标准化格式
- 处理 `enabled`/`disabled` 状态
- 处理 bundled 插件默认启用
- 插件 ID 验证

**启用状态解析**:
- 显式配置 > 默认启用
- Bundled 插件默认列表
- 插件依赖关系

### 2.2 插槽系统 (slots.ts)

**互斥插槽**:
- 每种类型只能激活一个插件
- 内存插件插槽（同时只能用一个记忆插件）
- 自动禁用冲突插件

**选择逻辑**:
```
applyExclusiveSlotSelection(config, slotType, selectedPluginId)
  → 启用选中插件
  → 禁用同插槽其他插件
  → 更新配置
```

### 2.3 插件加载与注册

- 基于 `clawdbot.plugin.json` 描述文件
- jiti 动态导入
- `clawdbot/plugin-sdk` 运行时别名解析
- 运行时依赖隔离

### 2.4 技能安装 (skills-install.ts)

- npm install 执行（`--omit=dev`）
- 依赖解析
- 安装进度追踪
- 错误恢复

## 3. 扩展系统 (extensions/)

### 3.1 钉钉扩展 (extensions/dingtalk/)

**功能**:
- Webhook 模式与 Stream 模式
- 消息接收与发送
- Session Webhook 缓存
- 消息路由
- 群组消息处理

**文件结构**:
| 文件 | 说明 |
|------|------|
| channel.ts | 渠道主逻辑（453行） |
| config-schema.ts | 配置 Schema |
| types.ts | 类型定义 |

**配置**:
```json
{
  "plugins": {
    "dingtalk": {
      "enabled": true,
      "appKey": "...",
      "appSecret": "...",
      "robotCode": "..."
    }
  }
}
```

### 3.2 飞书扩展 (extensions/feishu/)

**功能**:
- WebSocket 长连接模式
- Webhook 回调模式
- 卡片消息渲染
- 媒体上传支持
- Token 管理

**文件结构**:
| 文件 | 说明 |
|------|------|
| channel.ts | 渠道主逻辑（469行） |
| api.ts | API 客户端 |
| webhook.ts | Webhook 处理 |
| config-schema.ts | 配置 Schema |
| types.ts | 类型定义 |

**特性**:
- 自动检测卡片渲染模式
- 支持富文本消息
- 媒体文件上传回退处理

### 3.3 企业微信扩展 (extensions/wecom/)

**功能**:
- 多账户支持
- 群组策略（允许/禁止）
- Bot @提及检测
- 消息加密/解密
- 回调验证

**文件结构**:
| 文件 | 说明 |
|------|------|
| channel.ts | 渠道主逻辑（631行） |
| webhook.ts | Webhook 处理 |
| config-schema.ts | 配置 Schema |
| types.ts | 类型定义 |

**多账户配置**:
```json
{
  "plugins": {
    "wecom": {
      "accounts": [
        { "corpId": "...", "agentId": "...", "secret": "..." },
        { "corpId": "...", "agentId": "...", "secret": "..." }
      ]
    }
  }
}
```

### 3.4 Lobster 工具 (extensions/lobster/)

**功能**:
- Pipeline 执行工具
- 子进程管理（超时控制）
- 路径安全验证
- JSON 信封解析
- 输出大小限制

**安全特性**:
- 路径遍历防护
- 执行超时（默认 30s）
- 输出截断（防止 DoS）
- 审批工作流集成

### 3.5 其他扩展

| 扩展 | 说明 |
|------|------|
| msteams | Microsoft Teams |
| matrix | Matrix 协议 |
| zalo | Zalo 消息平台 |
| zalouser | Zalo 用户账户模式 |
| voice-call | 语音通话 |

## 4. 插件开发规范

### 4.1 插件描述文件 (clawdbot.plugin.json)

```json
{
  "id": "plugin-name",
  "name": "Plugin Display Name",
  "version": "1.0.0",
  "description": "Plugin description",
  "main": "index.ts",
  "channel": true,
  "configSchema": "src/config-schema.ts"
}
```

### 4.2 插件 SDK

```typescript
import { definePlugin } from "clawdbot/plugin-sdk";

export default definePlugin({
  id: "my-plugin",
  channel: {
    start: async (config) => { ... },
    stop: async () => { ... },
    send: async (target, message) => { ... },
    status: async () => { ... },
  },
});
```

### 4.3 依赖管理

- 运行时依赖放在 `dependencies`
- `clawdbot` 放在 `devDependencies` 或 `peerDependencies`
- 避免 `workspace:*` 引用
- 安装时使用 `npm install --omit=dev`

## 5. 非功能性需求

### 5.1 隔离性
- 插件运行时依赖隔离
- 错误不影响主进程
- 配置独立存储

### 5.2 可发现性
- 自动扫描 extensions/ 目录
- 配置驱动的启用/禁用
- 市场列表展示

### 5.3 安全性
- 路径安全验证
- 输出大小限制
- 执行超时控制
