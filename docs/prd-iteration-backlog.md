# PRD 迭代需求归档

---

## [2026-02-08] Skills 页面 UX 优化 - 面向 Windows 小白用户

### 需求背景

Skills 页面存在严重的 UX 问题，导致 Windows 小白用户产生恐慌：

1. 诊断卡片显示 "发现一些问题 — 20可用 / 38缺依赖"，把 macOS-only 技能和可修复的缺失依赖混为一谈
2. 技能卡片显示 `缺失: bin:memo, os:darwin` 等技术术语，用户不知道 darwin 是什么
3. 技能市场 Tab 永远转圈加载，无超时/错误处理
4. 不兼容技能（macOS-only）与可安装技能没有分离

**根本原因**：50 个 bundled skills 中有 24 个依赖 Homebrew（macOS 工具），仅 1 个有明确 Windows install spec。9 个 brew-only 技能缺少 `os` 元数据限制。

---

### 改动范围

| # | 文件路径 | 改动类型 | 描述 |
|---|---------|----------|------|
| 1 | `src/agents/skills-status.ts` | 后端类型+逻辑 | 新增 `IncompatibleReason` 类型、`osIncompatible` / `incompatibleReason` 字段及计算逻辑 |
| 2 | `ui/src/ui/types.ts` | 前端类型 | 同步 `IncompatibleReason` 类型、可选字段、`SkillInstallOption.kind` 补充 `"download"` |
| 3 | `ui/src/ui/i18n/locales/zh-CN.ts` | 国际化 | 新增 ~25 条中文友好字符串（诊断卡片、分区标题、缺失提示、不兼容说明、市场加载状态） |
| 4 | `ui/src/ui/i18n/locales/en.ts` | 国际化 | 新增对应英文字符串 |
| 5 | `ui/src/styles/skills.css` | 样式 | 新增蓝色信息卡、技能分区 header、不兼容原因面板、暗色模式适配 |
| 6 | `ui/src/ui/views/skills.ts` | 前端视图（核心） | 重写诊断卡片、技能三区段分组、友好化技能卡片渲染、市场空状态错误展示 |
| 7 | `ui/src/ui/controllers/skills.ts` | 前端控制器 | 技能市场加载 15 秒超时处理 |
| 8 | `ui/src/ui/icons.ts` | 图标 | 新增 `terminal`、`key`、`info` 三个 Lucide SVG 图标 |
| 9 | `skills/*/SKILL.md` (×9) | 技能元数据 | camsnap、gog、openhue、sag、songsee、summarize、1password、himalaya、openai-whisper 添加 `"os":["darwin"]` |
| 10 | `build/windows/deploy/skills/*/SKILL.md` (×9) | 技能元数据副本 | 同步上述 9 个技能的部署副本 |

**总计改动文件：25 个**

---

### 详细改动说明

#### Phase 1: 后端类型扩展 — `src/agents/skills-status.ts`

**新增类型** `IncompatibleReason`：
```typescript
export type IncompatibleReason =
  | { kind: "os"; requiredOs: string[]; currentOs: string; humanLabel: string }
  | { kind: "fixable" }
  | null;
```

**`SkillStatusEntry` 新增字段**：
- `osIncompatible: boolean` — 技能因 OS 不匹配而不可用（不可修复）
- `incompatibleReason: IncompatibleReason` — 结构化不兼容原因

**`buildSkillStatus()` 新增计算逻辑**：
- `missing.os.length > 0` 时标记 `osIncompatible = true`
- `osLabelMap` 将 `darwin` → `"macOS"`、`win32` → `"Windows"`、`linux` → `"Linux"`
- 非 OS 不兼容但不合格 → `{ kind: "fixable" }`

#### Phase 2: 前端类型同步 — `ui/src/ui/types.ts`

- 镜像 `IncompatibleReason` 类型定义
- `SkillStatusEntry` 新增 `osIncompatible?` 和 `incompatibleReason?` 可选字段（向后兼容旧 gateway）
- `SkillInstallOption.kind` 补充 `"download"` 类型

#### Phase 3: 国际化字符串 — `zh-CN.ts` + `en.ts`

新增 key 列表：

| Key | 中文 | 用途 |
|-----|------|------|
| `skills.diagnostic.overview` | 技能概况 | 诊断卡片标题（替代"发现一些问题"） |
| `skills.diagnostic.ready` | 可以使用 | 就绪技能计数标签 |
| `skills.diagnostic.needSetup` | 需要简单设置 | 可修复技能计数标签 |
| `skills.diagnostic.notForThisOS` | 不适用于本系统 | 不兼容技能计数标签 |
| `skills.diagnostic.incompatibleNote` | 有 {count} 个技能仅适用于其他操作系统... | 底部折叠说明 |
| `skills.diagnostic.encourageHint` | 大部分技能已就绪！... | 鼓励性提示 |
| `skills.section.ready` | 可以使用的技能 | 区段标题 |
| `skills.section.needSetup` | 需要简单设置的技能 | 区段标题 |
| `skills.section.incompatible` | 不适用于本系统的技能 | 区段标题 |
| `skills.section.incompatibleHint` | 点击展开查看 | 折叠提示 |
| `skills.needSetupBadge` | 需要设置 | 技能卡片蓝色 badge |
| `skills.needSetupLabel` | 需要完成以下设置 | 缺失项列表标题 |
| `skills.missingTool` | 安装工具「{name}」 | 友好缺失工具提示 |
| `skills.missingKey` | 配置密钥「{name}」 | 友好缺失密钥提示 |
| `skills.missingConfigItem` | 配置选项「{name}」 | 友好缺失配置提示 |
| `skills.incompatible.osDetail` | 此技能仅在 {requiredOS} 上可用... | 不兼容原因说明 |
| `skills.market.timeout` | 加载超时，请检查网络... | 市场超时提示 |
| `skills.market.errorTitle` | 暂时无法加载技能市场 | 市场错误标题 |
| `skills.market.loadingTitle` | 正在加载技能市场 | 市场加载标题 |
| `skills.market.loadingDesc` | 正在从服务器获取最新技能列表... | 市场加载描述 |

#### Phase 4: CSS 样式 — `ui/src/styles/skills.css`

| CSS 类 | 用途 |
|--------|------|
| `.diagnostic-card--info` | 蓝色信息卡（替代黄色警告卡） |
| `.diagnostic-card__icon--info` | 信息卡图标（蓝色描边） |
| `.diagnostic-stat--ready` | 就绪计数（绿色） |
| `.diagnostic-stat--setup` | 待设置计数（蓝色） |
| `.diagnostic-stat--incompatible` | 不兼容计数（灰色） |
| `.diagnostic-card__note` | 底部灰色说明面板 |
| `.skills-section` | 技能分区容器 |
| `.skills-section__header` | 分区标题 |
| `.skills-section__header--ready` | 就绪区标题（绿色） |
| `.skills-section__header--setup` | 待设置区标题（蓝色） |
| `.skills-section__header--incompatible` | 不兼容区标题（灰色，可点击） |
| `.skills-section__hint` | "点击展开查看" 提示 |
| `.skill-incompatible-reason` | 不兼容原因说明面板 |
| `.skill-status--needsetup` | 蓝色"需要设置"badge（替代橙色"已阻止"） |

含暗色模式 `@media (prefers-color-scheme: dark)` 适配。

#### Phase 5: UI 视图核心改动 — `ui/src/ui/views/skills.ts`

**新增辅助函数**：
- `getOsLabel(os)` — `"darwin"` → `"macOS（苹果电脑）"`
- `getCurrentPlatformString()` — 获取当前平台友好名称
- `isSkillOsIncompatible(skill)` — 判断技能是否 OS 不兼容（兼容旧 gateway fallback）
- `getIncompatibilityMessage(skill)` — 生成友好不兼容说明文案

**重写 `analyzeDiagnostics()`**：
- 原：二分法（eligible / blocked）
- 新：三分法 + 禁用（ready / needSetup / incompatible / disabled）
- 只对 needSetup 技能收集可修复依赖

**重写 `renderDiagnosticCard()`**：
- 标题 "发现一些问题" → "技能概况"
- 黄色 warning 卡 → 蓝色 info 卡
- 三色数字统计：绿色就绪 / 蓝色待设置 / 灰色不兼容
- 底部灰色说明 "有 N 个技能仅适用于其他操作系统，已折叠到列表底部"

**新增 `renderLocalSkillsSectioned()`**：
- 技能列表拆为三组：就绪 / 待设置 / 不兼容
- 不兼容组用 `<details>` 默认折叠
- 每组带图标 + 计数的 header

**改写 `renderSkill()`**：
- OS 不兼容技能：显示清晰的不兼容说明、灰色 badge "不支持本系统"、隐藏所有操作按钮
- 可修复技能：蓝色 badge "需要设置"、友好中文缺失提示（"安装工具「go」"替代"缺失: bin:go"）

**改写 `renderEmptyState()`**：
- 新增 `error` 参数支持超时/错误显示
- 三态：error → loading → empty

#### Phase 6: 技能市场超时 — `ui/src/ui/controllers/skills.ts`

- 新增 `MARKET_LOAD_TIMEOUT_MS = 15_000` 常量
- `loadMarketSkills()` 和 `refreshMarketSkills()` 均添加 15 秒 `setTimeout`
- 超时设置 `skillsMarketError` 并停止 loading/syncing 状态
- try/catch/finally 中均 `clearTimeout` 确保清理

#### Phase 7: 图标补充 — `ui/src/ui/icons.ts`

新增 3 个 Lucide SVG 图标：
- `terminal` — 诊断卡片"缺失工具"图标
- `key` — 诊断卡片"缺失密钥"图标
- `info` — 信息说明图标

#### Phase 8: 技能元数据修正 — 9 个 SKILL.md

在以下 9 个 brew-only 技能的 `clawdbot` 元数据中添加 `"os":["darwin"]`：

| 技能 | 说明 | 影响 |
|------|------|------|
| camsnap | RTSP 摄像头抓帧 | Windows 上正确标记为"不适用" |
| gog | Google Workspace CLI | 同上 |
| openhue | Philips Hue 灯控 | 同上 |
| sag | ElevenLabs TTS (mac-style) | 同上 |
| songsee | 音频频谱可视化 | 同上 |
| summarize | URL/播客摘要 | 同上 |
| 1password | 1Password CLI | 同上 |
| himalaya | 邮件 CLI | 同上 |
| openai-whisper | 本地语音转文字 | 同上 |

每个技能同步修改 `skills/` 和 `build/windows/deploy/skills/` 两处副本。

---

### 向后兼容性

- `osIncompatible` 和 `incompatibleReason` 在前端标记为 `optional (?)`
- UI 使用 fallback 逻辑：`skill.osIncompatible ?? (skill.missing?.os?.length ?? 0) > 0`
- 旧 gateway 未更新时，UI 仍可通过 `missing.os` 正确判断

---

### 用户体验对比

| 维度 | 改动前 | 改动后 |
|------|--------|--------|
| 诊断卡片 | 黄色警告 "发现一些问题 - 20可用/38缺依赖" | 蓝色信息 "技能概况 - 20就绪/9需设置/19不适用" |
| macOS 技能 | 混在一起显示橙色"已阻止" | 折叠到底部，灰色"不支持本系统" |
| 缺失提示 | `缺失: bin:go, os:darwin` | "需要设置：安装工具「go」" |
| 不兼容说明 | 无 | "此技能仅在 macOS（苹果电脑）上可用，您当前使用的是 Windows 系统" |
| 技能市场加载 | 无限转圈 | 15秒超时后显示错误提示和刷新按钮 |

---

### 构建验证

- 后端 `tsc` 编译：PASS
- 前端 `vite build`：PASS
- 代码审计（3 个并行 agent 全面检查）：
  - 后端类型/逻辑：PASS
  - 前端视图（61 个 i18n key、所有图标引用、模板完整性）：PASS
  - i18n 同步、CSS 类、控制器超时、类型定义：PASS

---

### 遗留事项 / 后续迭代建议

| 优先级 | 事项 | 说明 |
|--------|------|------|
| P2 | 1password / himalaya / openai-whisper 跨平台安装 | 这三个工具实际支持 Windows（winget/cargo/pip），当前标记为 darwin-only 是权宜之计，后续可补充 Windows install spec |
| P3 | `playground.oneClickInstall` key 命名不一致 | `translateInstallLabel()` 引用了 `playground.*` 命名空间而非 `skills.*` |
| P3 | `getCurrentPlatform()` 与 `getCurrentPlatformString()` 轻微重复 | 可合并为一个函数 |
| P3 | 技能市场错误状态的「刷新」按钮 | 确认市场 tab 的刷新按钮正确触发 `refreshMarketSkills()` |
