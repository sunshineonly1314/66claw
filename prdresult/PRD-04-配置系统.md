# PRD-04: 配置系统模块 (src/config/)

## 1. 模块概述

配置系统是 Clawdbot 的基础设施模块，负责类型定义、Schema 验证、配置加载/存储、区域检测和插件自动启用。

## 2. 功能需求

### 2.1 类型系统

**主配置类型 (types.clawdbot.ts)**:
```typescript
ClawdbotConfig {
  agents?: AgentConfig        // AI 代理配置
  models?: ModelsConfig       // 模型与提供商
  channels?: ChannelConfig    // 渠道配置
  plugins?: PluginConfig      // 插件配置
  session?: SessionConfig     // 会话设置
  security?: SecurityConfig   // 安全设置
  license?: LicenseConfig     // 授权配置
  hooks?: HookConfig          // 钩子配置
  cron?: CronConfig           // 定时任务
  sandbox?: SandboxConfig     // 沙箱配置
  tts?: TtsConfig             // 语音合成
  gateway?: GatewayConfig     // 网关配置
  ...
}
```

**模块化类型文件**:
| 文件 | 说明 |
|------|------|
| types.agents.ts | 代理配置类型 |
| types.models.ts | 模型/提供商类型 |
| types.channels.ts | 渠道配置类型 |
| types.license.ts | 授权配置类型 |
| types.sandbox.ts | 沙箱配置类型 |
| types.skills.ts | 技能配置类型 |
| types.hooks.ts | 钩子配置类型 |
| types.tools.ts | 工具配置类型 |
| types.telegram.ts | Telegram 专有类型 |
| types.discord.ts | Discord 专有类型 |
| types.slack.ts | Slack 专有类型 |
| types.whatsapp.ts | WhatsApp 专有类型 |
| types.signal.ts | Signal 专有类型 |

### 2.2 Schema 验证 (zod-schema.ts)

**验证层次**:
1. Zod Schema 结构验证
2. 自定义业务规则验证
3. 插件配置验证
4. 路径安全验证

**主要 Schema 文件**:
| 文件 | 说明 |
|------|------|
| zod-schema.ts | 主 Schema 定义 |
| zod-schema.core.ts | 核心配置 Schema |
| zod-schema.agents.ts | 代理配置 Schema |
| zod-schema.channels.ts | 渠道配置 Schema |
| zod-schema.providers.ts | 提供商 Schema |
| zod-schema.providers-cn.ts | 中国提供商 Schema |
| zod-schema.hooks.ts | 钩子 Schema |
| zod-schema.session.ts | 会话 Schema |
| zod-schema.approvals.ts | 审批 Schema |
| zod-schema.agent-defaults.ts | 代理默认值 Schema |
| zod-schema.agent-runtime.ts | 代理运行时 Schema |

### 2.3 配置验证 (validation.ts)

**多阶段验证流程**:
1. 遗留配置检查与迁移
2. Zod Schema 验证
3. 自定义业务规则
4. 头像路径安全验证（防止路径遍历）
5. 插件配置验证

**头像路径验证**:
- 确保路径相对于工作区
- Windows 绝对路径检测
- 防止 `../` 路径遍历

### 2.4 中国区支持 (region-cn.ts)

**区域检测**:
- 时区检测 (Asia/Shanghai, Asia/Chongqing 等)
- `LANG` 环境变量检测
- 手动区域覆盖配置

**中国区默认配置**:
- 推荐提供商列表（硅基流动、DeepSeek、智谱等）
- 联盟链接（注册返利）
- 隐藏的渠道/提供商
- 安全配置默认值

**提供商配置**:
- 30+ 中国区 LLM 提供商详细配置
- 模型列表、定价信息
- API Base URL 配置
- 免费额度信息

### 2.5 插件自动启用 (plugin-auto-enable.ts)

- 根据渠道/提供商配置自动启用插件
- `preferOver` 关系处理
- 允许列表自动管理
- 新渠道配置后自动启用对应插件

### 2.6 版本管理 (version.ts)

- 从 package.json 读取版本
- 构建信息注入
- 版本比较

### 2.7 会话管理 (sessions.ts)

- 会话缓存
- 会话过期策略
- 会话存储路径管理

## 3. 非功能性需求

### 3.1 可扩展性
- 模块化类型定义，易于新增配置项
- Zod Schema 可组合
- 插件配置动态注册

### 3.2 向后兼容性
- 遗留配置自动迁移
- 可选字段默认值
- 版本号追踪 (`lastTouchedVersion`)

### 3.3 安全性
- 路径遍历防护
- 敏感配置不输出到日志
- 配置文件权限控制（0o600）

## 4. 配置文件格式

### 4.1 主配置 (~/.clawdbot/config.json)

```json
{
  "agents": {
    "defaults": {
      "provider": "openai",
      "model": "gpt-4o",
      "typingIntervalSeconds": 6,
      "heartbeat": { "model": "..." }
    }
  },
  "models": {
    "providers": [...],
    "aliases": {...}
  },
  "channels": {
    "telegram": { "token": "..." },
    "discord": { "token": "..." }
  },
  "license": {
    "key": "...",
    "enabled": true
  }
}
```

## 5. 接口定义

| 函数 | 文件 | 说明 |
|------|------|------|
| `loadConfig()` | config.ts | 加载配置 |
| `writeConfigFile()` | config.ts | 写入配置 |
| `validateConfigObjectWithPlugins()` | validation.ts | 带插件验证 |
| `detectChinaRegion()` | region-cn.ts | 检测中国区 |
| `getCnRegionConfig()` | region-cn.ts | 获取中国区配置 |
| `CN_PROVIDERS` | region-cn.ts | 中国区提供商列表 |
