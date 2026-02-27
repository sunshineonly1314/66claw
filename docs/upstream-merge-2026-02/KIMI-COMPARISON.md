# Upstream vs CN: Kimi Implementation Comparison

**Date:** 2026-02-23
**Verdict:** Upstream's approach is **partially better** — adopt their `mergeProviderModels()` rewrite and error detection, but keep CN's `kimi-coding` provider with headers/compat.

---

## Commit 1: `15e32c7341` — Refresh Moonshot Kimi vision capabilities

### What Upstream Did
1. Changed `buildMoonshotProvider()` default model input from `["text"]` → `["text", "image"]`
2. Changed synthetic `hf:moonshotai/Kimi-K2.5` entry's input from `["text"]` → `["text", "image"]`
3. Changed `buildMoonshotModelDefinition()` in onboarding to include `"image"` in input
4. **CRITICAL**: Rewrote `mergeProviderModels()` in `models-config.ts` to **refresh capability metadata** (`input`, `reasoning`, `contextWindow`, `maxTokens`) from implicit catalog onto stale explicit entries, while preserving user-specific fields (`cost`, `headers`, `compat`)

### What CN Did (our fixes from 2026-02-23)
1. Added `"kimi"` to `isVision` heuristic in `siliconflow-models.ts`
2. Fixed `resolveModel()` fallback in `model.ts` to inherit `input` from `matchingModelDef` instead of hardcoding `["text"]`
3. Added `input: ["text", "image"]` to Kimi entries in `SILICONFLOW_RECOMMENDED_MODELS`

### Comparison

| Aspect | Upstream | CN | Better? |
|--------|----------|-----|---------|
| Root cause fix | Rewrote `mergeProviderModels()` to auto-refresh stale capabilities | Fixed `isVision` heuristic + resolveModel fallback | **UPSTREAM** — more general fix, covers all providers |
| Scope | Applies to all providers with stale explicit config | Only covers Kimi + SiliconFlow models | **UPSTREAM** |
| Preserves user overrides | Yes — keeps `cost`, `headers`, `compat` | N/A — different approach | **UPSTREAM** |
| Our `resolveModel()` fallback | Not present | Defense-in-depth when ModelRegistry.find() fails | **KEEP CN** — still valuable as safety net |
| SiliconFlow `isVision` heuristic | Not present (upstream doesn't have SiliconFlow) | Needed for CN setup wizard | **KEEP CN** — CN-only feature |

### Decision
- **ADOPT** upstream's `mergeProviderModels()` rewrite from `models-config.ts` — it's a strictly better approach
- **KEEP** CN's `isVision` heuristic fix (SiliconFlow is CN-only)
- **KEEP** CN's `resolveModel()` fallback (defense-in-depth)
- **ADOPT** upstream's `buildMoonshotProvider()` input change (already matches CN)
- **ADOPT** upstream's test for stale capability refresh

---

## Commit 2: `9bd04849ed` — Detect Kimi model-token-limit overflows

### What Upstream Did
Added `lower.includes("model token limit")` to `isContextOverflowError()` in `src/agents/pi-embedded-helpers/errors.ts`

### What CN Has
Our `errors.ts` is modified but we **do NOT have this Kimi-specific detection**.

### Comparison
| Aspect | Upstream | CN | Better? |
|--------|----------|-----|---------|
| Kimi token limit detection | Yes — single line | No | **UPSTREAM** |
| Impact | Kimi 400 errors correctly classified as context overflow | Kimi 400 errors fall through to generic handler | **UPSTREAM** |

### Decision
- **ADOPT** — Simple one-line addition, strictly beneficial, no conflict risk.
- Line to add in `errors.ts` `isContextOverflowError()`:
  ```
  lower.includes("model token limit") ||
  ```

---

## Commit 3: `3640484e28` — Map Moonshot developer role compatibility

### What Upstream Did
Added `isMoonshot` detection to `normalizeModelCompat()` in `model-compat.ts`:
```typescript
const isMoonshot =
  model.provider === "moonshot" ||
  baseUrl.includes("moonshot.ai") ||
  baseUrl.includes("moonshot.cn");
```
Forces `supportsDeveloperRole: false` for Moonshot models (same as Z.AI).

### What CN Has
Our `model-compat.ts` has Z.AI + Doubao/Volcengine + GLM/Zhipu detection, but **NOT Moonshot**.
However, CN handles Kimi's `supportsDeveloperRole: false` via:
1. `buildKimiCodeProvider()` which bakes in `compat: { supportsDeveloperRole: false }`
2. The `normalizeProviders()` patch at line 524 that ensures explicit Kimi configs get the compat flag

### Comparison
| Aspect | Upstream | CN | Better? |
|--------|----------|-----|---------|
| Detection scope | `moonshot` provider + `.moonshot.ai` + `.moonshot.cn` URLs | Only `kimi-coding` provider (via buildKimiCodeProvider) | **UPSTREAM** — covers more cases |
| Where applied | Runtime `normalizeModelCompat()` — catches ALL models | Provider builder + explicit config patch | CN covers its use cases |
| Covers custom endpoints | Yes — any baseUrl with moonshot.ai/.cn | No — only kimi-coding provider ID | **UPSTREAM** |

### Decision
- **ADOPT** upstream's Moonshot addition to `normalizeModelCompat()`
- **KEEP** CN's `buildKimiCodeProvider()` with `headers: {"User-Agent": "KimiCLI/0.77"}` — upstream does NOT have this, and Kimi API returns 403 without it
- **KEEP** CN's explicit config patch in `normalizeProviders()` at line 524 — belt-and-suspenders approach
- **MERGE** upstream's additions alongside CN's existing Doubao/GLM additions

### Final `normalizeModelCompat()` should include:
```typescript
const isZai = model.provider === "zai" || baseUrl.includes("api.z.ai");
const isMoonshot =
  model.provider === "moonshot" ||
  baseUrl.includes("moonshot.ai") ||
  baseUrl.includes("moonshot.cn");
const isDoubao =
  model.provider === "volcengine-ark" ||
  model.provider === "doubao" ||
  baseUrl.includes("volces.com");
const isGlm =
  model.provider === "glm" ||
  model.provider === "zhipu" ||
  baseUrl.includes("bigmodel.cn");
if ((!isZai && !isMoonshot && !isDoubao && !isGlm) || !isOpenAiCompletionsModel(model)) {
  return model;
}
```

---

## Summary Table

| Upstream Commit | Decision | Notes |
|----------------|----------|-------|
| `15e32c7341` — Vision capabilities | **ADOPT** mergeProviderModels() rewrite, **KEEP** CN isVision + resolveModel fallback | Best of both worlds |
| `9bd04849ed` — Token limit overflow | **ADOPT** — one-line addition | No conflict |
| `3640484e28` — Developer role compat | **ADOPT** Moonshot detection, **KEEP** CN Doubao/GLM additions | Merge together |

## CN-Only Code to Preserve (upstream doesn't have)
1. `buildKimiCodeProvider()` with `headers: {"User-Agent": "KimiCLI/0.77"}` — **ESSENTIAL**, Kimi returns 403 without it
2. `normalizeProviders()` line 524 Kimi-coding explicit config patch
3. `isVision` heuristic `"kimi"` check in `siliconflow-models.ts`
4. `resolveModel()` fallback in `pi-embedded-runner/model.ts`
5. SiliconFlow provider builders and model list
6. Capability registry cards
