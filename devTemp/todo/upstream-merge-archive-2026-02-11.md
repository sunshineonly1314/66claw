# ClawdbotCN 上游融合归档报告

> **日期**: 2026-02-11
> **清单来源**: `upstream-definitive-checklist-2026-02-11.md`
> **上游版本**: OpenClaw 2026.1.20 → 2026.2.6
> **本地版本**: ClawdbotCN 2026.2.0

---

## 一、总体结论

| 指标 | 数值 |
|------|------|
| 清单总项数 | 203+ |
| P0 紧急必合项 | 38 |
| 实际需要新代码 | **6 项** |
| 已独立实现（标记缺失但实际已有） | ~25 项 |
| 本次新增代码行 | ~80 行 |
| 预估工时节省 | 79% (14天→3天) |
| TypeScript 编译 | 0 errors |
| 单元测试 | 925 passed / 2 pre-existing timeout / 17 skipped |

---

## 二、6 项合并结果明细

### Phase 1: 安全加固

#### #18 — exec.approvals 端点权限检查
- **状态**: ✅ 已验证（无需新代码）
- **证据**: `src/gateway/server-methods.ts:66` — `ADMIN_METHOD_PREFIXES = ["exec.approvals."]`
- **说明**: `exec.approvals.*` 方法在 `authorizeGatewayMethod()` 中要求 `operator.admin` scope，比上游要求的 `operator.approvals` 更严格
- **审查意见**: PASS — admin 是 approvals 的超集

#### #25 — config.get 凭据脱敏
- **状态**: ✅ 已实现（新增代码）
- **文件**: `src/config/config-sanitizer.ts`, `src/gateway/server-methods/config.ts`
- **改动**:
  - 新增 `redactConfigSnapshot()` — 递归脱敏 config 对象中匹配 `apiKey/token/secret/password/encodingAESKey/encryptKey/key` 的字段值
  - 新增 `redactRawConfigString()` — 正则替换 raw JSON/JSON5 字符串中的敏感值
  - `config.get` handler 在响应前调用 `redactConfigSnapshot(snapshot)`
- **审查修复**:
  - 🔴 **P0 问题**: `preserveProtectedFields()` 原实现只检查 `undefined`，脱敏后的 `"***"` 会被回写覆盖真实 license.key
  - ✅ **已修复**: 新增 `isRedactedValue()` 检测，`preserveProtectedFields()` 增加 `"***"` 回填保护

#### #8 — Gateway auth fail-closed
- **状态**: ✅ 已验证（无需新代码）
- **证据**: `src/gateway/server-runtime-config.ts:87` — `assertGatewayAuthConfigured(resolvedAuth)` 在启动时调用
- **说明**: token 模式无 token 或 password 模式无 password 时抛异常阻止启动，Tailscale-only 模式正确放行

### Phase 2: 功能增强

#### #44 — CLI compile cache (10% 启动提速)
- **状态**: ✅ 已实现（新增代码）
- **文件**: `src/cli/run-main.ts`
- **改动**: `runCli()` 最前方添加 `process.enableCompileCache()` (Node 22.8+ API)
- **风险**: 极低 — try/catch 包裹，旧版 Node 无影响

#### #91 — Opus 4.6 / gpt-5.3-codex 前向兼容
- **状态**: ✅ 已验证（无需新代码）
- **证据**:
  - `src/agents/model-catalog.ts:68` — `piSdk.discoverModels()` 动态发现，无硬编码模型名
  - `src/agents/model-selection.ts:143` — 未知模型名 passthrough 到 `{ provider, model }`
- **说明**: 不存在阻拦未知模型的 blocklist

### Phase 3: 补充安全

#### #17 — 小模型无沙盒+web 工具警告
- **状态**: ✅ 已实现（新增代码）
- **文件**: `src/agents/pi-embedded-runner/run/attempt.ts`
- **改动**: 检测 sandbox 未启用 + web 工具启用 + 模型匹配小模型特征时，输出 `log.warn` 安全警告
- **模型匹配规则**:
  - 参数量: `1.5b, 3b, 4b, 7b, 8b, 14b, 32b, 70b, 72b`
  - 名称前缀: `qwen, deepseek, yi-, phi-, mistral, llama, gemma, chatglm, glm-, baichuan, internlm, doubao`
- **审查修复**: 原实现遗漏 `deepseek`(非 coder)、`chatglm/glm-/baichuan/internlm/doubao` 等中国模型及 `1.5b/3b/4b` 参数量，已补充

---

## 三、已验证无需合并的 P0 项（标记缺失但实际已实现）

| # | 项目 | 实现位置 |
|---|------|---------|
| 1-3 | Gateway 网络错误/AbortError/图片重试 | `src/infra/unhandled-rejections.ts`, `src/gateway/chat-attachments.ts` |
| 4 | Session metadata 合并顺序 | `src/gateway/session-utils.ts:384-450` — "newest wins" |
| 5-7 | PID 锁/单例锁/心跳热重载 | `src/infra/gateway-lock.ts`, `src/infra/heartbeat-runner.ts` |
| 9-10 | SSRF + cwd 验证 | Phase 2 已合 |
| 11 | DNS pinning 防 rebinding | `src/agents/tools/web-fetch.ts:6-7` — `resolvePinnedHostname` + `createPinnedDispatcher` |
| 14 | Hook 内容防注入 | `src/security/external-content.ts` — Phase 2 已修复 |
| 16 | npm tar 固定 | `package.json` 多层 override |
| 22 | Windows exec cmd.exe 绕过 | `src/infra/exec-approvals.ts` — Phase 2 已修复 |
| 26 | 不可信 metadata 排除 | `src/channels/prompt-sanitizer.ts` — Phase 2 已修复 |
| 27 | inline models 继承 baseUrl | `src/agents/pi-embedded-runner/model.ts:44-57` — Qwen/Zhipu 测试覆盖 |
| 28 | modelDefault 应用 | `src/agents/model-selection.ts:123-154` |
| 29 | 跳过冷却中 providers | `src/agents/auth-profiles/order.ts:94-125` — exponential backoff |
| 30 | memory.md 纳入 bootstrap | `src/agents/workspace.ts:206-237` — `resolveMemoryBootstrapEntries` |
| 32 | auto-compact on context overflow | `src/agents/pi-extensions/compaction-safeguard.ts` |
| 33-35 | tool error fallback + AbortSignal | `src/agents/pi-tools.abort.ts`, `model-fallback.ts` |
| 37-38 | cap sessions_history + compaction 重试 | `session-utils.fs.ts` + compaction-safeguard |

---

## 四、不合并项（永不合并 / 延后）

| # | 项目 | 原因 |
|---|------|------|
| 12 | SSH target | 非中国区优先 |
| 13 | mDNS 最小化 | 中国区不使用 mDNS |
| 15 | Tailscale | 中国区不使用 |
| 19-20 | Matrix/Slack access-group | 非中国区主要渠道 |
| 21 | shared-secret | device-auth 已有 v2 nonce |
| 23 | Canvas/A2UI auth | 已由 resolvedAuth 统一认证 |
| 24 | Skill 代码扫描 | 工作量 3-5 天，延后下阶段 |

---

## 五、变更文件清单

| 文件 | 变更类型 | 关联项 |
|------|---------|--------|
| `src/config/config-sanitizer.ts` | 新增函数 | #25 (已在前序 commit) |
| `src/gateway/server-methods/config.ts` | 修改 | #25 (redact + 回写保护) |
| `src/cli/run-main.ts` | 修改 | #44 (compile cache) |
| `src/agents/pi-embedded-runner/run/attempt.ts` | 修改 | #17 (小模型警告) |

---

## 六、审查记录

- **实施**: 专家 A（代码编写） + 专家 B（深度分析）
- **审查**: 专家 C（独立审查）
- **审查发现**:
  - P0 缺陷 1 个（preserveProtectedFields 回写 "***" 问题）→ 已修复
  - P2 改进 1 个（小模型名匹配补充中国模型）→ 已修复
  - P3 建议 1 个（重复 warn 去重）→ 记录待优化
- **测试验证**: TypeScript 0 errors, 925 tests passed
