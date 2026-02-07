# 审查：「Unknown model / 无法聊天」修复方案

## 方案概述

通过「运行时合并 config（文件 + 隐式 env/auth）」并统一用合并后的 config 调用 `resolveModel`，解决 `config.models.providers` 为空导致所有模型报 Unknown model 的问题；同时支持 volcengine-ark 的 profile 与内置回退。

---

## 正确性 / 设计

- **根因判断正确**：仅用 `loadConfig()` 时 `models.providers` 常为空，与「所有模型都报错」现象一致。
- **合并入口合理**：`getMergedProvidersForAgent` 与 `ensureClawdbotModelsJson` 使用同一套合并逻辑，行为一致。
- **volcengine-ark 双写**：`resolveImplicitProviders` 同时注册 `doubao` 与 `volcengine-ark`（同一引用），与向导/中国区 UI 一致，无逻辑错误。

---

## 已发现并需修复的问题

### 1. image-tool：`params.cfg` 为空时未使用合并结果（Bug）

**位置**：`src/agents/tools/image-tool.ts` 中 `cfgForModel` 的构造。

**问题**：当 `effectiveCfg` 为 `undefined`（即 `params.cfg` 未传）时，当前逻辑为 `cfgForModel = effectiveCfg`，因此始终为 `undefined`。但 `getMergedProvidersForAgent(undefined, agentDir)` 内部会 `loadConfig()` 并解析隐式 providers，**可能得到非空的 `mergedProviders`**。此时合并结果没有被传给 `resolveModel`，仍会依赖空的 config，导致「仅靠 env/凭据配置」时图片模型解析失败。

**修复**：当 `mergedProviders` 非空时，即使 `effectiveCfg` 为 `undefined`，也应构造并传入 `cfgForModel = { models: { providers: mergedProviders } }`，再交给 `resolveModel`。

### 2. TTS 摘要：getApiKeyForModel 仍用原始 cfg（一致性与边缘情况）

**位置**：`src/tts/tts.ts` 中 `summarizeText` 内调用 `getApiKeyForModel({ model: resolved.model, cfg })`。

**问题**：模型是用 `cfgForModel`（含合并后的 providers）解析的，但取 Key 时仍传的是原始 `cfg`。若摘要模型来自「仅隐式」的 provider（不在文件 config 里），`getCustomProviderApiKey(cfg, provider)` 会得到空，只能依赖 auth store / env。多数场景下 auth 或 env 存在，能工作；但若未来有「仅存在于合并后 config 的 apiKey」的路径，这里会漏。且与「用合并 config 解析就用合并 config 取 Key」的约定不一致。

**修复**：将 `getApiKeyForModel` 的 `cfg` 改为传入 `cfgForModel`，与 resolve 阶段一致。

---

## 风险与注意事项（无需改代码，但需知晓）

1. **重复计算**  
   同一次请求内会先执行 `ensureClawdbotModelsJson`（内部调用 `resolveImplicitProviders`），再执行 `getMergedProvidersForAgent`（再次调用 `resolveImplicitProviders`）。同一轮会做两次「隐式 providers 解析」。当前是只读（auth store + env），无副作用，仅多一次 I/O 与合并计算，可接受；若后续要优化，可考虑让 `ensureClawdbotModelsJson` 返回合并后的 providers 供调用方复用。

2. **doubao / volcengine-ark 共享同一对象**  
   `providers["volcengine-ark"] = doubaoProvider` 是同一引用。若有代码修改 `providers["doubao"]`（如删 apiKey），会同时影响 `volcengine-ark`。当前使用处均为只读，风险低；后续若有写操作需避免直接改共享对象。

3. **agentDir 一致性**  
   所有使用 `getMergedProvidersForAgent` 的路径都显式传入与当前请求一致的 `agentDir`，避免多租户或测试场景下用错目录，设计正确。

4. **compact/run 中 getApiKeyForModel 仍用 params.config**  
   `run/attempt.ts` 等处 `getApiKeyForModel(..., params.config)` 未改为传入合并后的 config。由于 key 解析会回退到 auth store 和 env，volcengine-ark 等通常仍能取到 key；与 TTS 类似，属于一致性问题而非必然故障。若希望「解析用合并 config、取 Key 也用合并 config」，可在后续统一把取 Key 的 `cfg` 改为合并后的 config。

---

## 结论

- 方案方向正确，能解决「所有模型 Unknown model」和 volcengine-ark 的解析与鉴权来源问题。
- **必须修**：image-tool 在 `params.cfg` 为空时仍应使用合并后的 providers（见上文修复 1）。
- **建议修**：TTS 摘要中 `getApiKeyForModel` 使用 `cfgForModel`（见上文修复 2），以保持与 resolve 阶段一致并避免未来边缘情况。
