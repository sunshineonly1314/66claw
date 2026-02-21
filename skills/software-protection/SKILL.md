---
name: software-protection
description: OpenClawCN 软件保护方案 - 防止逆向、破解、修改的加密策略
nameZh: "软件保护"
descriptionZh: "OpenClawCN 软件保护方案 - 防止逆向、破解、修改的加密策略"
homepage: https://github.com/nicekate/openclawcn
metadata: {"openclawcn":{"emoji":"🔐","category":"security"}}
---

# 软件保护方案（Software Protection）

> 最后更新：2026-02-03
> 版本：2.0.0
> 状态：第一阶段全部完成，保护等级 85-90%

---

## 一、当前保护状态总览

### 已实施的保护措施

| 方案 | 状态 | 保护效果 | 实施日期 |
|------|------|----------|----------|
| ✅ RSA 非对称签名验证 | 已完成 | 防止伪造许可证 | 2026-02-03 |
| ✅ DEV 模式编译时控制 | 已完成 | 防止环境变量绕过 | 2026-02-03 |
| ✅ 离线宽限期 24h | 已完成 | 减少离线滥用 | 2026-02-03 |
| ✅ 完整性哈希校验 | 已完成 | 检测代码篡改 | 2026-02-03 |
| ✅ 代码混淆 | 已完成 | 防止代码阅读 | 2026-02-03 |
| ⏸️ pkg 二进制打包 | 暂缓 | ESM 兼容性问题 | - |

### 保护等级评估

| 评估项 | 等级 | 说明 |
|--------|------|------|
| 许可证安全 | ⭐⭐⭐⭐⭐ | RSA 非对称签名，私钥在服务端 |
| 绕过难度 | ⭐⭐⭐⭐ | 编译时控制，运行时无法绕过 |
| 代码可读性 | ⭐⭐⭐⭐ | 混淆后变量/函数名不可读 |
| 整体保护 | **85-90%** | 业界中上水平 |

---

## 二、项目架构概览

```
OpenClawCN 架构
├── 核心层：Node.js 22+ (TypeScript → dist/)
│   ├── src/license/    许可证验证（RSA + HMAC）
│   ├── src/security/   安全模块（完整性、反调试）
│   ├── src/gateway/    网关服务
│   ├── src/agents/     AI 代理
│   └── src/plugins/    插件系统（jiti 动态加载）
│
├── 平台层
│   ├── Windows: Inno Setup + C# 托盘服务
│   ├── macOS: Swift 原生 Universal Binary
│   └── Linux: tar.gz 独立包
│
└── 插件层：extensions/（飞书、钉钉、企业微信）
```

**特殊情况**：
- API Key 存在用户本地（`~/.openclawcn/agents/<id>/agent/auth-profiles.json`）
- 插件使用 jiti 动态加载 TypeScript
- 核心价值是 AI 调用能力

---

## 三、方案详细说明

### 方案 1：RSA 公钥验证 ✅ 已完成

**目的**：替代硬编码签名密钥，防止伪造许可证

**实现架构**：
```
服务端（私钥）          客户端（公钥）
     │                      │
     │ 用私钥签发许可证      │ 用公钥验证签名
     ▼                      ▼
 签名不可伪造            可以验证真伪
```

**核心代码位置**：
- `src/license/rsa-verify.ts` - RSA 公钥验证实现
- `src/license/types.ts:375` - `enableRsaVerify: true`

**公钥存储**：
```typescript
// src/license/rsa-verify.ts
const RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAkDtHShdtjfCopovpCcIR
hiyFHopWsclr+7JQ+c4Iz2NIdWrCoAkSUTSp24fJXmVQh27m8Eq9JvGX/wMpQ8H6
...
-----END PUBLIC KEY-----`;
```

**验证流程**：
1. 从服务端获取许可证 + RSA 签名
2. 使用公钥验证签名
3. 验证服务端时间（防重放）
4. 签名无效则拒绝

---

### 方案 2：DEV 模式编译时控制 ✅ 已完成

**目的**：关闭生产版本的调试后门，保留开发版调试能力

**实现文件**：
| 文件 | 作用 |
|------|------|
| `src/license/startup.ts:64-76` | `__DEV_BUILD__` 判断逻辑 |
| `src/global.d.ts` | TypeScript 类型声明 |
| `scripts/replace-dev-flag.ts` | 构建后替换脚本 |
| `package.json` | `build:prod` 命令 |

**核心代码**：
```typescript
// src/license/startup.ts
function isDevMode(): boolean {
  // 生产构建：__DEV_BUILD__ = false，直接返回 false
  // 开发构建：__DEV_BUILD__ = true，检查环境变量
  if (!__DEV_BUILD__) {
    return false;
  }
  return (
    process.env.NODE_ENV === "development" ||
    process.env.OPENCLAWCN_DEV === "1" ||
    process.env.OPENCLAWCN_LICENSE_DEV === "1"
  );
}
```

**使用方式**：
```bash
# 开发构建（DEV 模式可用）
pnpm build

# 生产构建（DEV 模式不可用）
pnpm build:prod
```

---

### 方案 3：缩短离线宽限期 ✅ 已完成

**目的**：减少离线滥用时间

**实现位置**：`src/license/types.ts:373`

```typescript
export const DEFAULT_LICENSE_CONFIG: LicenseModuleConfig = {
  // ...
  offlineGracePeriodHours: 24, // 从 72h 缩短到 24h
  // ...
};
```

---

### 方案 4：完整性哈希校验 ✅ 已完成

**目的**：检测代码文件是否被篡改

**实现文件**：
| 文件 | 作用 |
|------|------|
| `scripts/generate-integrity-hashes.ts` | 生成哈希 |
| `dist/security/integrity-hashes.json` | 哈希存储 |
| `src/security/integrity.ts` | 运行时验证 |

**受保护文件**（19个核心文件）：
- `license/*.js` - 许可证模块（10个）
- `security/*.js` - 安全模块（9个）

---

### 方案 5：代码混淆 ✅ 已完成

**目的**：防止代码被直接阅读和理解

**实现文件**：
| 文件 | 作用 |
|------|------|
| `scripts/obfuscate.config.js` | 混淆配置 |
| `scripts/obfuscate-dist.ts` | 混淆脚本 |
| `package.json` | `build:secure` 命令 |

**混淆配置**：
```javascript
// scripts/obfuscate.config.js
module.exports = {
  // 控制流混淆
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  
  // 死代码注入
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.2,
  
  // 字符串加密
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.5,
  
  // 安全选项（不破坏代码）
  renameGlobals: false,
  renameProperties: false,  // 关键！保留属性名
  
  target: 'node',
};
```

**使用方式**：
```bash
# 完整安全构建
pnpm build:secure

# 单独混淆（dist 已存在时）
pnpm obfuscate
```

**混淆效果**：
- 1528 个文件被混淆
- 变量名：`const name` → `const _0x1a2b3c`
- 字符串：加密存储在数组中
- 控制流：扁平化，难以追踪

---

### 方案 6：pkg 二进制打包 ⏸️ 暂缓

**目的**：将代码编译成 V8 字节码

**当前状态**：由于 ESM 模块兼容性问题暂缓

**问题描述**：
- 项目使用 `"type": "module"` (ESM)
- pkg 对 ESM 支持不完善
- 打包后出现 `ERR_MODULE_NOT_FOUND` 错误

**已完成的准备工作**：
- ✅ 安装 `@yao-pkg/pkg`
- ✅ 配置 `package.json` pkg 字段
- ✅ 创建打包脚本 `scripts/pkg-build.ps1`

**备选方案**：
1. 使用 esbuild 先打包成单文件再用 pkg
2. 使用 Bun 编译
3. 保持当前方式（混淆已提供足够保护）

---

## 四、构建命令

```bash
# 开发构建
pnpm build

# 生产构建（DEV 禁用 + 完整性哈希）
pnpm build:prod

# 安全构建（生产构建 + 代码混淆）
pnpm build:secure

# 单独混淆
pnpm obfuscate
```

---

## 五、安全检测点

| 检测点 | 文件 | 触发条件 |
|--------|------|----------|
| 许可证验证 | `src/license/startup.ts` | 程序启动 |
| RSA 签名验证 | `src/license/rsa-verify.ts` | 许可证响应 |
| 服务端时间 | `src/license/rsa-verify.ts` | 防止重放 |
| 离线宽限期 | `src/license/offline.ts` | 网络断开 |
| 完整性校验 | `src/security/integrity.ts` | 可选启用 |
| 反调试检测 | `src/security/anti-debug.ts` | 可选启用 |

---

## 六、攻击场景 vs 防护

| 攻击场景 | 防护措施 | 效果 |
|----------|----------|------|
| 伪造许可证 | RSA 签名 | ✅ 无法伪造 |
| 环境变量绕过 | 编译时控制 | ✅ 无法绕过 |
| 阅读源码 | 代码混淆 | ✅ 难以理解 |
| 修改代码 | 完整性校验 | ✅ 可检测 |
| 离线破解 | 24h 宽限期 | ⚠️ 有限防护 |
| 系统时间篡改 | 服务端时间验证 | ✅ 可检测 |

---

## 七、变更日志

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-02-03 | 1.0.0 | 初始版本，确认实施方案 |
| 2026-02-03 | 1.1.0 | 完成方案 2（DEV 编译时控制）+ 方案 3（离线 24h） |
| 2026-02-03 | 1.2.0 | 完成方案 1（RSA 验证，服务端已上线） |
| 2026-02-03 | 2.0.0 | 完成方案 5（代码混淆），pkg 暂缓 |

---

## 八、相关文档

- `devTemp/todo/jiami.md` - 加密方案知识库（所有方案详解）
- `devTemp/todo/jiamitodo.md` - 实施手册（具体代码和步骤）
- `docs/requirements/server-api-requirements.md` - 服务端 API 要求
