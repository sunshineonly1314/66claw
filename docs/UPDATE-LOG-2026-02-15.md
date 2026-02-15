# OpenClawCN 上游合并更新记录

> 分支: `integration/upstream-openclaw-2026-02`
> 日期: 2026-02-15
> 操作: 合并上游 OpenClaw 代码 → OpenClawCN 中国化适配

---

## 一、Critical 修复 (2 项)

### C1: 新增腾讯混元 (Tencent Hunyuan) 提供商支持
- **文件**: `src/agents/models-config.providers.ts`
- **变更**: 新增 `buildTencentHunyuanProvider()` 构建函数和 6 个模型定义 (hunyuan-turbo/pro/standard/lite/vision/code)
- **变更**: 在 `resolveImplicitProviders()` 中注册混元提供商，支持环境变量自动发现
- **Base URL**: `https://api.hunyuan.cloud.tencent.com/v1`
- **影响**: 用户设置 `HUNYUAN_API_KEY` 后即可使用混元模型
### C2: 修复混元认证环境变量映射
- **文件**: `src/agents/model-auth.ts`
- **变更**: `tencent-hunyuan` 的 envMap 从 `HUNYUAN_SECRET_ID` 改为 `HUNYUAN_API_KEY`
- **原因**: OpenAI 兼容 API 使用标准 API Key 认证，非腾讯云 SecretId/SecretKey 方式

---

## 二、High 修复 (10 项)

### H1: Moonshot 域名修正
- **文件**: `src/agents/models-config.providers.ts`
- **变更**: `MOONSHOT_BASE_URL` 从 `https://api.moonshot.ai/v1` 改为 `https://api.moonshot.cn/v1`
- **原因**: 月之暗面国内域名为 `.cn`，`.ai` 域名需要科学上网

### H2: 豆包 (Doubao) 上下文窗口修正
- **文件**: `src/agents/models-config.providers.ts`
- **变更**: `DOUBAO_DEFAULT_CONTEXT_WINDOW` 从 `32000` 改为 `256000`
- **原因**: 豆包 1.8 支持 256K 上下文

### H3: Token 统一 (3 处)
- **文件**:
  - `src/config/cn-mirrors.ts` — signalCli.token
  - `src/mcp/marketplace-sync.ts` — Skills Proxy token
  - `src/agents/skills/clawdskillsproxy-registry.ts` — Skills Proxy token
- **变更**: 旧 token `clawdskills_secret_token_2024` → 新 token `clawdbotCN778`

### H4: 扩展包名品牌统一 (src + build/deploy)
- **文件**:
  - `extensions/dingtalk/package.json` — `@clawdbot/dingtalk` → `@openclawcn/dingtalk`
  - `extensions/wecom/package.json` — `@clawdbot/wecom` → `@openclawcn/wecom`
  - `extensions/qqbot/package.json` — `@clawdbot/qqbot` → `@openclawcn/qqbot`
  - `extensions/feishu/package.json` — `@clawdbot/feishu` → `@openclawcn/feishu`
  - `build/windows/deploy/extensions/dingtalk/package.json`
  - `build/windows/deploy/extensions/wecom/package.json`
  - `build/windows/deploy/extensions/feishu/package.json`
- **变更**: `name` 字段从 `@clawdbot/*` 改为 `@openclawcn/*`，`npmSpec` 同步更新
### H5: voice-call 核心桥接修复
- **文件**: `extensions/voice-call/src/core-bridge.ts`
- **变更**: `findPackageRoot(start, "clawdbot")` → `findPackageRoot(start, "openclawcn")`
- **变更**: 环境变量 `CLAWDBOT_ROOT` → `OPENCLAWCN_ROOT`（保留向后兼容）

### H6: LINE/Matrix 用户可见品牌修复
- **文件**:
  - `extensions/line/src/channel.ts` — `Clawdbot:` → `OpenClawCN:`，CLI 命令 `clawdbot pairing` → `openclawcn pairing`
  - `extensions/matrix/src/matrix/monitor/handler.ts` — 同上

### H7: 二进制文件名品牌修复
- **文件**: `scripts/protect-binary.ts`
- **变更**: `clawdbot-win-x64.exe` → `openclawcn-win-x64.exe`，其余平台同理

### H8: 飞书 FeishuGroupConfig 补充 tools 字段
- **文件**: `extensions/feishu/src/types.ts`
- **变更**: 新增 `tools?: Record<string, unknown>` 字段
- **原因**: `policy.ts:72` 引用此字段但类型定义缺失，导致 TS 编译错误

### H9: CORE_PACKAGE_NAMES 添加 openclawcn
- **文件**: `src/infra/openclaw-root.ts`
- **变更**: `new Set(["openclaw"])` → `new Set(["openclaw", "openclawcn"])`
- **原因**: package.json 的 name 为 `openclawcn`，不加入此集合会导致 `resolveOpenClawPackageRoot()` 永远返回 null

### H10: pi-embedded-subscribe 导入路径修复
- **文件**: `src/agents/pi-embedded-subscribe.types.ts`
- **变更**: `import type { OpenClawCNConfig } from "../config/types.openclaw.js"` → `"../config/types.clawdbot.js"`
- **原因**: `types.openclaw.js` 不存在，正确的文件名是 `types.clawdbot.js`
---

## 三、Medium 修复 (5 项)

### M1: double-CN 清理 (3 处)
- **文件**:
  - `scripts/dev/gateway-smoke.ts` — `openclawcncn-ios` → `openclawcn-ios`
  - `scripts/dev/ios-node-e2e.ts` — `openclawcncn-dev-ios-node-e2e` → `openclawcn-dev-ios-node-e2e`
  - `test/helpers/temp-home.ts` — `openclawcncn-test-home-` → `openclawcn-test-home-`
- **原因**: 前期 sed 批量替换将已有的 `openclawcn` 再次替换为 `openclawcncn`

### M2: 时区检测添加 Asia/Urumqi
- **文件**:
  - `src/config/region-cn.ts` — `detectChinaRegion()` 的 Intl 和 TZ 检测均添加 `Asia/Urumqi`
  - `src/config/cn-mirrors.ts` — `shouldUseCNMirror()` 的 TZ 检测添加 `Asia/Urumqi`
- **原因**: 新疆乌鲁木齐使用 `Asia/Urumqi` 时区，属于中国区

### M3: PluginRuntime 补充 gateway 属性
- **文件**: `src/plugins/runtime/types.ts`
- **变更**: 新增 `gateway?: { port?: number }` 属性
- **原因**: gateway 模块引用此属性但类型定义缺失

### M4: createOpenClawTools 兼容导出
- **文件**: `src/agents/openclaw-tools.ts`
- **变更**: 新增 `export const createOpenClawTools = createOpenClawCNTools`
- **原因**: 6+ 个 e2e 测试文件导入上游名称 `createOpenClawTools`，需要兼容重导出
---

## 四、新增测试文件 (5 个, 99 用例)

| 测试文件 | 用例数 | 覆盖范围 |
|---|---|---|
| `src/config/region-cn.test.ts` | 31 | 中国区检测 (时区/语言/env)、Asia/Urumqi、CN 提供商配置、渠道隐藏、技能降级 |
| `src/config/cn-mirrors.test.ts` | 32 | Token 一致性 (clawdbotCN778)、镜像 URL、GitHub 代理、HK 托管、包管理器镜像 |
| `src/agents/model-auth.cn-providers.test.ts` | 16 | 12 个 CN 提供商环境变量映射、HUNYUAN_API_KEY 校验、空值/空白处理 |
| `src/infra/openclaw-root.test.ts` | 8 | CORE_PACKAGE_NAMES 同时识别 openclaw 和 openclawcn、目录向上遍历、异步/同步 |
| `src/agents/cn-brand-consistency.test.ts` | 12 | 扩展包名 @openclawcn/*、二进制文件名、无 double-CN、compat 导出、类型兼容 |
---

## 五、修改文件清单 (共 26 个文件)

### 源代码 (14 个)
1. `src/agents/models-config.providers.ts` — 混元提供商 + Moonshot 域名 + 豆包上下文窗口
2. `src/agents/model-auth.ts` — 混元 env var 映射
3. `src/agents/openclaw-tools.ts` — createOpenClawTools 兼容导出
4. `src/agents/pi-embedded-subscribe.types.ts` — 导入路径修复
5. `src/agents/skills/clawdskillsproxy-registry.ts` — Token 统一
6. `src/config/region-cn.ts` — Asia/Urumqi 时区检测
7. `src/config/cn-mirrors.ts` — Token 统一 + Asia/Urumqi 时区检测
8. `src/infra/openclaw-root.ts` — CORE_PACKAGE_NAMES 添加 openclawcn
9. `src/mcp/marketplace-sync.ts` — Token 统一
10. `src/plugins/runtime/types.ts` — gateway 属性

### 扩展 (7 个)
11. `extensions/dingtalk/package.json` — 品牌重命名
12. `extensions/wecom/package.json` — 品牌重命名
13. `extensions/qqbot/package.json` — 品牌重命名
14. `extensions/feishu/package.json` — 品牌重命名 + npmSpec
15. `extensions/feishu/src/types.ts` — tools 字段
16. `extensions/line/src/channel.ts` — 用户可见品牌
17. `extensions/matrix/src/matrix/monitor/handler.ts` — 用户可见品牌
18. `extensions/voice-call/src/core-bridge.ts` — 包根查找 + env var

### 脚本/构建 (5 个)
19. `scripts/protect-binary.ts` — 二进制文件名
20. `scripts/dev/gateway-smoke.ts` — double-CN 清理
21. `scripts/dev/ios-node-e2e.ts` — double-CN 清理
22. `build/windows/deploy/extensions/dingtalk/package.json` — 品牌重命名
23. `build/windows/deploy/extensions/wecom/package.json` — 品牌重命名
24. `build/windows/deploy/extensions/feishu/package.json` — 品牌重命名

### 测试 (6 个)
25. `test/helpers/temp-home.ts` — double-CN 清理
26. `src/config/region-cn.test.ts` — 新增测试
27. `src/config/cn-mirrors.test.ts` — 新增测试
28. `src/agents/model-auth.cn-providers.test.ts` — 新增测试
29. `src/infra/openclaw-root.test.ts` — 新增测试
30. `src/agents/cn-brand-consistency.test.ts` — 新增测试
---

## 六、验证结果

- **TypeScript 编译**: 0 新增错误 (1009 预存错误均来自其他扩展模块)
- **单元测试**: 5 文件, 99 用例, **全部通过**
- **测试耗时**: 16.57s
