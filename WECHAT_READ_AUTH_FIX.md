# WeChat Read Tool - Auth System Fix

## 问题描述 (Problem Description)

`wechat_read` 工具的视觉分析功能在 UI 中调用时失败,但独立测试脚本成功。错误信息:"无法直接查看或分析图片内容" (Cannot view or analyze image content)

The `wechat_read` tool's vision analysis failed when called through UI, but succeeded in standalone tests. Error: "Cannot view or analyze image content"

## 根本原因 (Root Cause)

工具使用了 **错误的配置加载方式**:

The tool used the **WRONG configuration loading approach**:

```typescript
// ❌ WRONG - 旧代码 (Old Code)
const cfg = loadConfig();  // 读取 OpenClawCN 主配置 (config.json5)
const qwenProvider = cfg.models?.providers?.["qwen"];
const apiKey = qwenProvider.apiKey;  // 总是 undefined!
```

**问题 (Problem)**:
- `loadConfig()` 加载的是 **OpenClawCN 全局配置** (`~/.openclawcn/config.json5`)
- 但 API 密钥存储在 **Agent 配置** (`~/.openclawcn/agents/main/agent/auth-profiles.json`)
- 两个配置系统完全独立,导致密钥无法读取

**Problem**:
- `loadConfig()` loads **OpenClawCN global config** (`~/.openclawcn/config.json5`)
- But API keys are stored in **Agent config** (`~/.openclawcn/agents/main/agent/auth-profiles.json`)
- Two separate config systems → keys not found

## 解决方案 (Solution)

使用 **Agent 标准认证系统** (与 `image-gen-tool.ts` 相同的模式):

Use the **Agent standard auth system** (same pattern as `image-gen-tool.ts`):

```typescript
// ✅ CORRECT - 新代码 (New Code)
async function analyzeScreenshotWithQwen(
  screenshotBase64: string,
  prompt: string,
  options: { cfg?: OpenClawCNConfig; agentDir?: string },
): Promise<string> {
  const agentDir = options.agentDir?.trim() || "";
  const cfg = options.cfg;

  // 1) 从 agent 的 models.json 发现模型
  //    Discover models from agent's models.json
  const modelsJson = agentDir ? await ensureOpenClawCNModelsJson(agentDir) : null;
  const models = modelsJson ? discoverModels(modelsJson) : [];

  // 2) 查找视觉模型 (qwen-vl-max)
  //    Find vision model (qwen-vl-max)
  const visionModel = models.find((m) => m.id === "qwen-vl-max" || m.id === "qwen-vl-plus");
  if (!visionModel) {
    throw new Error("No vision model configured. Please configure qwen-vl-max");
  }

  // 3) 使用认证系统获取 API 密钥 (检查 auth-profiles.json → models.json)
  //    Get API key using auth system (checks auth-profiles.json → models.json)
  const authInfo = await getApiKeyForModel({
    model: visionModel,
    cfg,
    agentDir,
  });
  const apiKey = requireApiKey(authInfo, visionModel.provider);

  // 4) 调用视觉 API
  //    Call vision API
  const response = await fetch(`${visionModel.baseUrl}/chat/completions`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: visionModel.id, messages: [...] }),
  });
  // ...
}
```

## 关键改动 (Key Changes)

### 1. 导入正确的模块 (Import Correct Modules)

```diff
- import { loadConfig } from "../../config/config.js";
+ import { getApiKeyForModel, requireApiKey } from "../model-auth.js";
+ import { ensureOpenClawCNModelsJson } from "../models-config.js";
+ import { discoverModels } from "../pi-model-discovery.js";
```

### 2. 更新函数签名 (Update Function Signature)

```diff
  async function analyzeScreenshotWithQwen(
    screenshotBase64: string,
    prompt: string,
+   options: { cfg?: OpenClawCNConfig; agentDir?: string },
  ): Promise<string>
```

### 3. 更新工具工厂 (Update Tool Factory)

```diff
- export function createWeChatReadTool(): AnyAgentTool {
+ export function createWeChatReadTool(options?: {
+   config?: OpenClawCNConfig;
+   agentDir?: string;
+ }): AnyAgentTool {
    return {
      name: "wechat_read",
-     execute: executeWeChatRead,
+     execute: (toolCallId, args) => executeWeChatRead(toolCallId, args, options),
    };
  }
```

### 4. 传递选项给分析函数 (Pass Options to Analysis Function)

```diff
  async function executeWeChatRead(
    _toolCallId: string,
    args: Record<string, unknown>,
+   options?: { config?: OpenClawCNConfig; agentDir?: string },
  ): Promise<AgentToolResult<unknown>> {
    // ...
-   visionResult = await analyzeScreenshotWithQwen(screenshotBase64, visionPrompt);
+   visionResult = await analyzeScreenshotWithQwen(screenshotBase64, visionPrompt, {
+     cfg: options?.config,
+     agentDir: options?.agentDir,
+   });
  }
```

## 认证流程 (Auth Flow)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Tool Execution                                            │
│    createWeChatReadTool({ config, agentDir })               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Discover Models                                           │
│    ensureOpenClawCNModelsJson(agentDir)                     │
│    → ~/.openclawcn/agents/main/agent/models.json           │
│    → Find qwen-vl-max model definition                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Get API Key                                              │
│    getApiKeyForModel({ model, cfg, agentDir })              │
│    ├─ Check auth-profiles.json (qwen:default)               │
│    │  → ~/.openclawcn/agents/main/agent/auth-profiles.json │
│    ├─ Fallback to models.json (provider.apiKey)             │
│    └─ Fallback to env vars (QWEN_API_KEY)                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Call Vision API                                          │
│    fetch(baseUrl, { Authorization: `Bearer ${apiKey}` })    │
└─────────────────────────────────────────────────────────────┘
```

## 测试验证 (Verification)

### 1. 独立测试 (Standalone Test)
```bash
node test-qwen-vl-max.mjs
```
✅ 成功提取真实聊天消息 (Successfully extracted real chat messages)

### 2. UI 测试 (UI Test)
打开 http://localhost:18789,输入:
```
尝试读取 TecBin 的微信消息
```

**预期结果 (Expected Result)**:
- ✅ 工具调用成功 (Tool call succeeds)
- ✅ 截图正确 (Screenshot captured)
- ✅ 视觉分析成功 (Vision analysis succeeds)
- ✅ 返回 JSON 格式的聊天记录 (Returns JSON chat messages)

## 文件变更 (Files Changed)

1. **src/agents/tools/wechat-read.ts**
   - 导入: `getApiKeyForModel`, `ensureOpenClawCNModelsJson`, `discoverModels`
   - 函数: `analyzeScreenshotWithQwen` 重写为使用 auth 系统
   - 工厂: `createWeChatReadTool` 接受 `{ config, agentDir }`
   - 执行: `executeWeChatRead` 传递 options 给分析函数

2. **dist/pi-embedded-*.js** (自动编译)
   - 包含所有上述更改的编译代码

## 配置文件 (Config Files)

### Agent 模型配置
**~/.openclawcn/agents/main/agent/models.json**
```json
{
  "providers": {
    "qwen": {
      "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
      "apiKey": "sk-c44f643a792a448cb474e89970509f10",
      "models": [
        {
          "id": "qwen-vl-max",
          "name": "通义千问 VL Max (视觉)",
          "input": ["text", "image"],
          "contextWindow": 32000,
          "maxTokens": 2000
        }
      ]
    }
  }
}
```

### Agent 认证配置
**~/.openclawcn/agents/main/agent/auth-profiles.json**
```json
{
  "version": 1,
  "profiles": {
    "qwen:default": {
      "type": "api_key",
      "provider": "qwen",
      "key": "sk-c44f643a792a448cb474e89970509f10"
    }
  },
  "usageStats": {
    "qwen:default": {
      "lastUsed": 1771380045093,
      "errorCount": 0
    }
  }
}
```

## 总结 (Summary)

**问题**: 使用全局 config 而非 agent config → 找不到 API 密钥
**解决**: 切换到 agent 认证系统 → 正确读取 auth-profiles.json

**Problem**: Used global config instead of agent config → API key not found
**Solution**: Switched to agent auth system → Correctly reads auth-profiles.json

**关键教训 (Key Lesson)**:
OpenClawCN 有 **两个独立的配置系统**:
1. **全局配置**: `loadConfig()` → `~/.openclawcn/config.json5`
2. **Agent 配置**: `getApiKeyForModel()` → `~/.openclawcn/agents/*/agent/`

工具必须使用 **Agent 配置系统** 来访问 API 密钥!

Tools MUST use the **Agent config system** to access API keys!
