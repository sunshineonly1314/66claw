# TODO-02: 国际化统一

**优先级**: P1  
**预估工时**: 3-4天  
**影响**: 用户体验一致性、国际化基础

## 问题清单

### 2.1 错误消息中英文混用

**位置**: 多个文件  
- `src/agents/pi-embedded-runner/run.ts:112-135` — 中国提供商错误消息中英混杂  
- `src/agents/pi-embedded-runner/run.ts:662-668` — 中文硬编码错误消息  
- `src/agents/pi-embedded-helpers/errors.ts:375-387` — 中文硬编码  
- `src/auto-reply/reply/get-reply.ts:539` — 中文硬编码错误响应  

**现状**: 用户面对的错误消息部分用中文硬编码，部分用英文，没有统一使用 i18n 系统。  
**建议**:
- 梳理所有用户面对的错误消息（非日志）
- 提取到 `src/i18n/locales/zh-CN.ts` 和 `en.ts`
- 统一使用 `t("key", { vars })` 调用

需要新增的 i18n key 示例：
```typescript
// zh-CN.ts
"error.model_response_failed": "模型响应失败，请检查模型接口是否正常（{{provider}}/{{model}}）",
"error.api_key_invalid": "请检查 API Key 是否正确",
"error.quota_exhausted": "模型额度已用尽，正在切换...",
"error.all_models_failed": "所有模型调用均失败，未能生成响应",

// en.ts
"error.model_response_failed": "Model response failed. Please check the API ({{provider}}/{{model}})",
"error.api_key_invalid": "Please verify your API key",
"error.quota_exhausted": "Model quota exhausted, switching...",
"error.all_models_failed": "All model calls failed, no response generated",
```

---

### 2.2 i18n 默认语言检测硬编码

**位置**: `src/i18n/index.ts:32, 64-66`  
**现状**: `detectLocale()` 始终返回 `"zh-CN"`，不做实际检测。  
**说明**: 这是 ClawdbotCN 版本的有意设计，但如果未来考虑国际化，需要修改。  
**建议**:
- 短期：保留现状，添加注释说明是有意设计
- 中期：添加 `CLAWDBOT_LOCALE` 环境变量覆盖
- 长期：实现真正的系统语言检测

```typescript
function detectLocale(): Locale {
  // 环境变量优先（允许用户强制切换）
  const envLocale = process.env.CLAWDBOT_LOCALE;
  if (envLocale === "en") return "en";
  if (envLocale?.startsWith("zh")) return "zh-CN";

  // ClawdbotCN 默认中文
  return "zh-CN";
}
```

---

### 2.3 翻译缺失回退策略

**位置**: `src/i18n/index.ts:115`  
**现状**: 翻译键缺失时回退到英文翻译。  
**建议**:
- 开发环境：返回 `[MISSING: key]` 帮助发现遗漏
- 生产环境：回退到英文，如英文也缺失则返回 key 本身

## 验收标准

- [ ] 所有用户面对的错误消息通过 i18n 系统输出
- [ ] 支持 `CLAWDBOT_LOCALE` 环境变量
- [ ] 翻译缺失在开发环境有明显标记
- [ ] 中英文翻译完整覆盖所有 key
