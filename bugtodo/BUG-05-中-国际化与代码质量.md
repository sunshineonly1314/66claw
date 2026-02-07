# BUG-05: 国际化与代码质量问题 [中]

## Bug 5.1: 错误消息中英文混用

**位置**: 多个文件  
- `src/agents/pi-embedded-runner/run.ts:112-135`  
- `src/agents/pi-embedded-runner/run.ts:662-668`  
- `src/agents/pi-embedded-helpers/errors.ts:375-387`  
**严重度**: 中  
**类型**: 国际化  

**问题描述**:
代码中大量错误消息混合使用中文和英文。部分用户面对的错误消息用中文硬编码，而日志消息用英文，缺乏统一的 i18n 策略。

**示例**:
```typescript
// run.ts:665 - 中文硬编码
"模型响应失败，请检查模型接口是否正常"

// errors.ts:375 - 中文硬编码
"请检查 API Key 是否正确"

// run.ts:114 - 英文
"Error messages for Chinese providers"
```

**修复建议**:
```typescript
// 统一使用 i18n 系统
import { t } from "../../i18n/index.js";

// 替换硬编码消息
throw new Error(t("model_response_failed", { provider, model }));

// i18n/locales/zh-CN.ts 中添加
"model_response_failed": "模型响应失败，请检查模型接口是否正常（{{provider}}/{{model}}）",
"api_key_invalid": "请检查 API Key 是否正确",

// i18n/locales/en.ts 中添加
"model_response_failed": "Model response failed. Please check if the API is working ({{provider}}/{{model}})",
"api_key_invalid": "Please verify your API key is correct",
```

---

## Bug 5.2: i18n 默认语言硬编码为中文

**位置**: `src/i18n/index.ts:32, 64-66`  
**严重度**: 中  
**类型**: 国际化  

**问题描述**:
系统默认语言和检测逻辑始终返回 `"zh-CN"`，即使运行在非中文系统上。

```typescript
// index.ts:64-66
function detectLocale(): string {
  return "zh-CN"; // 硬编码
}
```

**影响**:
- 国际用户看到中文界面
- 区域检测形同虚设

**修复建议**:
```typescript
function detectLocale(): Locale {
  // 检查环境变量
  const envLang = process.env.CLAWDBOT_LOCALE || process.env.LANG || "";
  if (envLang.startsWith("zh")) return "zh-CN";
  if (envLang.startsWith("en")) return "en";
  
  // 检查区域配置
  const config = loadConfig();
  if (config.locale) return config.locale;
  
  // 检查是否中国区
  if (detectChinaRegion()) return "zh-CN";
  
  // 默认英文
  return "en";
}
```

---

## Bug 5.3: 翻译键缺失回退不当

**位置**: `src/i18n/index.ts:115`  
**严重度**: 低  
**类型**: 国际化  

**问题描述**:
翻译键缺失时回退到英文翻译，而非返回键本身。这在开发时不利于发现缺失的翻译。

**修复建议**:
```typescript
function t(key: string, vars?: Record<string, string>): string {
  const locale = getCurrentLocale();
  const dict = locales[locale] ?? locales["en"];
  
  let text = dict[key];
  if (!text) {
    // 尝试英文回退
    text = locales["en"][key];
  }
  if (!text) {
    // 开发环境返回带标记的 key
    if (process.env.NODE_ENV === "development") {
      log.warn(`Missing translation: ${key}`);
      return `[MISSING: ${key}]`;
    }
    return key; // 生产环境返回 key 本身
  }
  
  // 变量替换
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
    }
  }
  
  return text;
}
```

---

## Bug 5.4: 大文件需要拆分

**位置**: 多个文件  
**严重度**: 低  
**类型**: 代码质量  

**问题描述**:
以下文件超过项目指南建议的 500-700 行上限：

| 文件 | 行数 | 建议 |
|------|------|------|
| `src/gateway/setup-wizard.ts` | 2155行 | 拆分为向导步骤模块 |
| `ui/src/ui/views/skills.ts` | 1139行 | 拆分为搜索、列表、详情组件 |
| `ui/src/ui/views/overview.ts` | 1080行 | 拆分为统计、模型选择、快速操作 |
| `ui/src/ui/app.ts` | 950行 | 提取状态管理、路由逻辑 |
| `src/gateway/server-methods/chat.ts` | 695行 | 提取流式处理、去重逻辑 |
| `extensions/wecom/src/channel.ts` | 631行 | 提取多账户逻辑、消息处理 |
| `src/cli/skills-cli.ts` | 625行 | 提取安装逻辑、远程获取 |

**修复建议**:
按职责拆分为更小的模块，每个模块 < 500行。例如 setup-wizard.ts 可以拆分为：
```
setup-wizard/
├── index.ts          (路由分发)
├── steps/
│   ├── provider.ts   (提供商选择)
│   ├── api-key.ts    (API Key 配置)
│   ├── channels.ts   (渠道配置)
│   ├── security.ts   (安全配置)
│   └── complete.ts   (完成)
├── handlers/
│   ├── browse.ts     (目录浏览)
│   ├── license.ts    (授权处理)
│   └── test.ts       (连接测试)
└── types.ts          (类型定义)
```

---

## Bug 5.5: 全局错误日志标志只记录首次错误

**位置**:  
- `src/agents/model-catalog.ts:26`  
- `src/agents/bedrock-discovery.ts:28`  
**严重度**: 低  
**类型**: 可观测性  

**问题描述**:
使用全局布尔标志控制错误日志，导致只有首次错误被记录，后续相同错误被静默忽略。

```typescript
let errorLogged = false;
// ...
if (!errorLogged) {
  log.error("...");
  errorLogged = true;
}
```

**修复建议**:
```typescript
// 使用带频率限制的日志
let lastErrorLogTime = 0;
const ERROR_LOG_INTERVAL = 60_000; // 每分钟最多记录一次

function logErrorThrottled(message: string): void {
  const now = Date.now();
  if (now - lastErrorLogTime > ERROR_LOG_INTERVAL) {
    log.error(message);
    lastErrorLogTime = now;
  }
}
```

---

## Bug 5.6: TODO 注释标记未完成功能

**位置**:  
- `src/gateway/setup-wizard.ts:844`  
- `src/gateway/setup-wizard.ts:1138`  
- `src/gateway/setup-wizard.ts:1255`  
**严重度**: 低  
**类型**: 未完成功能  

**问题描述**:
代码中存在多个 TODO 注释，标记了未实现的功能：
- 目录授权验证
- QQ Bot 验证
- 其他待实现功能

**修复建议**:
为每个 TODO 创建 GitHub Issue 追踪，或在此迭代中完成实现。

---

## Bug 5.7: 魔法数字散布

**位置**: 多个文件  
**严重度**: 低  
**类型**: 代码质量  

**问题描述**:
代码中有大量硬编码的数字常量（魔法数字），缺乏语义说明：

```typescript
// 示例
setTimeout(() => ..., 30_000);  // 为什么是 30 秒？
setTimeout(() => ..., 15_000);  // 为什么是 15 秒？
const maxRetries = 3;           // 为什么是 3 次？
```

**修复建议**:
```typescript
// 提取为有语义的常量
const GATEWAY_REQUEST_TIMEOUT_MS = 30_000;
const CONFIG_RELOAD_DEBOUNCE_MS = 500;
const MAX_LICENSE_VERIFY_RETRIES = 3;
const HEARTBEAT_INTERVAL_MS = 60_000;
const DEDUPE_CACHE_TTL_MS = 300_000;
const MAX_FREE_MODEL_RETRIES = 3;
const MESSAGE_HISTORY_DISPLAY_LIMIT = 80;
```
