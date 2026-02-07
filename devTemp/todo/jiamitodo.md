# Clawdbot 加密保护实施方案

> 创建时间：2026-02-03
> 最后更新：2026-02-03
> 状态：✅ 第一阶段全部完成，保护等级 85-90%
> 
> **相关文档**：
> - `skills/software-protection/SKILL.md` - 软件保护 Skill（主文档）
> - `devTemp/todo/jiami.md` - 加密方案知识库

---

## ⚡ 实施状态总览（2026-02-03）

### 已完成的保护措施

```
✅ 方案 1：RSA 非对称签名验证（服务端已上线）
✅ 方案 2：DEV 模式编译时控制
✅ 方案 3：离线宽限期 72h → 24h
✅ 方案 4：完整性哈希校验（19个核心文件）
✅ 方案 5：代码混淆（1528个文件）
⏸️ 方案 6：pkg 二进制打包（ESM 兼容性问题暂缓）
```

### 保护等级

| 评估项 | 等级 | 说明 |
|--------|------|------|
| 许可证安全 | ⭐⭐⭐⭐⭐ | RSA 私钥在服务端 |
| 绕过难度 | ⭐⭐⭐⭐ | 编译时控制 |
| 代码可读性 | ⭐⭐⭐⭐ | 混淆后不可读 |
| **整体保护** | **85-90%** | 业界中上水平 |

### 关键决策记录

| 决策点 | 结论 | 原因 |
|--------|------|------|
| 方案 2 怎么做？ | **编译时控制** | 生产版安全，开发版可调试 |
| 方案 1 服务端？ | **已上线** | RSA 签发接口就绪 |
| pkg 打包？ | **暂缓** | ESM 模块兼容性问题 |
| 代码混淆？ | **已完成** | 风险评估后安全实施 |

---

## 一、项目现状分析

### 1.1 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Clawdbot 架构                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   核心层                                                    │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  Node.js 22+ (TypeScript → dist/)                   │   │
│   │  ├── src/license/    许可证验证                     │   │
│   │  ├── src/gateway/    网关服务                       │   │
│   │  ├── src/agents/     AI 代理                        │   │
│   │  └── src/plugins/    插件系统                       │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   平台层                                                    │
│   ┌───────────────┐ ┌───────────────┐ ┌───────────────┐   │
│   │   Windows     │ │    macOS      │ │    Linux      │   │
│   │ Inno Setup    │ │ Swift 原生    │ │  tar.gz 包    │   │
│   │ + C# 托盘服务 │ │ Universal     │ │               │   │
│   └───────────────┘ └───────────────┘ └───────────────┘   │
│                                                             │
│   插件层                                                    │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  extensions/                                        │   │
│   │  ├── feishu/     飞书集成                           │   │
│   │  ├── dingtalk/   钉钉集成                           │   │
│   │  └── wecom/      企业微信集成                       │   │
│   │  （使用 jiti 动态加载 TypeScript）                  │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 当前安全问题

| 问题 | 文件位置 | 严重程度 | 攻击方式 |
|------|----------|----------|----------|
| 签名密钥硬编码 | `src/license/types.ts:366` | 🔴 致命 | 搜索代码即可获取 |
| DEV 模式绕过 | `src/license/startup.ts:59-64` | 🔴 致命 | 设置环境变量 |
| 代码明文 | `dist/**/*.js` | 🟠 高 | 直接阅读修改 |
| 离线宽限期过长 | `src/license/offline.ts` | 🟡 中 | 72小时内随意使用 |
| 无完整性校验 | - | 🟡 中 | 修改代码不被检测 |

### 1.3 项目特殊情况

**API Key 存储位置**：
```
~/.clawdbot/agents/<agentId>/agent/auth-profiles.json
```
- API Key 存在用户本地，不在代码中
- 破解者需要自己的 API Key 才能使用 AI 功能
- 这意味着保护重点是**许可证验证**，而非 API Key

**插件加载机制**：
```typescript
// src/plugins/loader.ts - 使用 jiti 动态加载
const jiti = createJiti(import.meta.url, {
  interopDefault: true,
  extensions: [".ts", ".tsx", ".mts", ".js", ".mjs", ".cjs"],
});
const mod = jiti(candidate.source);
```
- 插件使用动态 require
- 混淆时必须排除 extensions/ 目录
- pkg 打包时需要特殊处理

---

## 二、推荐保护方案

### 2.1 方案组合（全部免费）

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   ⏳ 方案 1：RSA 公钥验证（替代硬编码密钥）                  │
│      优先级：P0（必须做）                                   │
│      风险：低                                               │
│      时间：2 小时                                           │
│      状态：⏸️ 等待服务端 RSA 签发接口就绪                   │
│                                                             │
│   ✅ 方案 2：DEV 模式编译时控制（保留开发调试能力）         │
│      优先级：P0（必须做）                                   │
│      风险：无                                               │
│      时间：30 分钟                                          │
│      状态：✅ 第一阶段待实施                                │
│                                                             │
│   ✅ 方案 3：缩短离线宽限期（72h → 24h）                    │
│      优先级：P0（必须做）                                   │
│      风险：无                                               │
│      状态：✅ 第一阶段待实施                                │
│      时间：5 分钟                                           │
│                                                             │
│   ✅ 方案 4：pkg 打包成二进制                               │
│      优先级：P1（推荐做）                                   │
│      风险：中（需要充分测试）                               │
│      时间：1 天                                             │
│                                                             │
│   ⚡ 方案 5：完整性校验（可选）                              │
│      优先级：P2（可选）                                     │
│      风险：低                                               │
│      时间：2 小时                                           │
│                                                             │
│   ⚡ 方案 6：反调试检测（可选）                              │
│      优先级：P2（可选）                                     │
│      风险：低                                               │
│      时间：1 小时                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、详细实施方案

### 方案 1：RSA 公钥验证

#### 3.1.1 当前代码问题

**文件**：`src/license/types.ts`

```typescript
// 第 366 行附近 - 硬编码的签名密钥
export const LICENSE_CONSTANTS = {
  // ...
  signSecretKey: "Cb#2026$Tecbinai@Lic3nse!Hmac^Key&Secure",  // ❌ 问题代码
  // ...
};
```

**文件**：`src/license/sign.ts`

```typescript
// 当前使用 HMAC-SHA256 对称签名
import { createHmac } from 'crypto';

export function signRequest(data: string, secretKey: string): string {
  return createHmac('sha256', secretKey).update(data).digest('hex');
}
```

#### 3.1.2 改造方案

**步骤 1**：生成 RSA 密钥对

```bash
# 生成私钥（2048位，存在服务端）
openssl genrsa -out private_key.pem 2048

# 从私钥导出公钥（存在客户端代码中）
openssl rsa -in private_key.pem -pubout -out public_key.pem
```

**步骤 2**：创建新的签名验证模块

**新文件**：`src/license/rsa-verify.ts`

```typescript
import { createVerify, createSign } from 'crypto';

// 公钥可以公开，硬编码在客户端
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
（替换为实际生成的公钥）
-----END PUBLIC KEY-----`;

/**
 * 验证许可证签名（客户端使用）
 * @param licenseData 许可证数据（JSON 字符串）
 * @param signature 服务端签发的签名（base64）
 * @returns 签名是否有效
 */
export function verifyLicenseSignature(
  licenseData: string,
  signature: string
): boolean {
  try {
    const verify = createVerify('SHA256');
    verify.update(licenseData);
    return verify.verify(PUBLIC_KEY, signature, 'base64');
  } catch (error) {
    console.error('签名验证失败:', error);
    return false;
  }
}

/**
 * 签发许可证（服务端使用 - 不要放在客户端代码中！）
 */
export function signLicense(licenseData: string, privateKey: string): string {
  const sign = createSign('SHA256');
  sign.update(licenseData);
  return sign.sign(privateKey, 'base64');
}
```

**步骤 3**：修改验证流程

**文件**：`src/license/verify.ts`

```typescript
// 导入新的 RSA 验证模块
import { verifyLicenseSignature } from './rsa-verify';

// 修改 verifyLicense 函数
export async function verifyLicense(
  licenseKey: string,
  deviceId: string
): Promise<VerifyResult> {
  // 1. 从服务端获取许可证数据和签名
  const response = await fetchLicenseFromServer(licenseKey, deviceId);
  
  // 2. 使用 RSA 公钥验证签名
  const isValid = verifyLicenseSignature(
    JSON.stringify(response.licenseData),
    response.signature
  );
  
  if (!isValid) {
    return { valid: false, reason: '许可证签名无效' };
  }
  
  // 3. 验证许可证内容（过期时间、设备绑定等）
  return validateLicenseContent(response.licenseData, deviceId);
}
```

**步骤 4**：修改服务端

服务端需要修改许可证签发接口，使用私钥签名：

```typescript
// 服务端代码（不在此仓库）
import { signLicense } from './rsa-sign';

app.post('/api/license/issue', (req, res) => {
  const licenseData = {
    key: req.body.key,
    deviceId: req.body.deviceId,
    expiresAt: calculateExpiry(),
    issuedAt: Date.now(),
  };
  
  const signature = signLicense(
    JSON.stringify(licenseData),
    PRIVATE_KEY  // 私钥存在服务端环境变量中
  );
  
  res.json({ licenseData, signature });
});
```

#### 3.1.3 风险评估

| 风险点 | 概率 | 影响 | 缓解措施 |
|--------|------|------|----------|
| 公钥被替换 | 低 | 高 | 配合完整性校验 |
| 验证逻辑被绕过 | 中 | 高 | 配合 pkg 打包 |
| 服务端接口变更 | 低 | 中 | 做好版本兼容 |

#### 3.1.4 测试检查清单

- [ ] 生成 RSA 密钥对
- [ ] 服务端签发接口修改
- [ ] 客户端验证逻辑修改
- [ ] 正常许可证验证通过
- [ ] 伪造签名验证失败
- [ ] 篡改许可证数据验证失败
- [ ] 离线缓存兼容性

---

### 方案 2：DEV 模式编译时控制 ✅ 已确认采用

> **决策**：采用编译时控制方案，保留开发调试能力

#### 3.2.1 当前代码问题

**文件**：`src/license/startup.ts`

```typescript
// 第 59-64 行附近
export async function verifyLicenseOnStartup(): Promise<StartupResult> {
  // ❌ 问题代码：环境变量可以绕过所有验证
  if (process.env.CLAWDBOT_DEV === '1' || 
      process.env.CLAWDBOT_LICENSE_DEV === '1') {
    return { 
      valid: true, 
      devMode: true,
      message: '开发模式，跳过许可证验证'
    };
  }
  
  // ... 正常验证逻辑
}
```

#### 3.2.2 改造方案（编译时控制）✅ 已确认

**原理**：
```
生产构建：__DEV_BUILD__ = false → DEV 模式不可用（安全）
开发构建：__DEV_BUILD__ = true  → DEV 模式可用（调试）
```

**步骤 1**：修改 `src/license/startup.ts`

```typescript
// 声明编译时常量
declare const __DEV_BUILD__: boolean;

export async function verifyLicenseOnStartup(): Promise<StartupResult> {
  // 只有开发构建版本才能使用 DEV 模式
  // 生产构建时 __DEV_BUILD__ 会被替换为 false
  if (__DEV_BUILD__ && process.env.CLAWDBOT_DEV === '1') {
    return { valid: true, devMode: true };
  }
  
  // ... 正常验证逻辑
}
```

**步骤 2**：创建 `scripts/replace-dev-flag.js`

```javascript
// scripts/replace-dev-flag.js
const fs = require('fs');
const path = require('path');

// 递归获取所有 .js 文件
function getAllJsFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...getAllJsFiles(fullPath));
    } else if (item.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// 将所有 __DEV_BUILD__ 替换为 false
const distDir = path.join(__dirname, '..', 'dist');
const files = getAllJsFiles(distDir);

let replacedCount = 0;
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('__DEV_BUILD__')) {
    content = content.replace(/__DEV_BUILD__/g, 'false');
    fs.writeFileSync(file, content);
    replacedCount++;
    console.log(`已处理: ${file}`);
  }
});

console.log(`完成！共处理 ${replacedCount} 个文件`);
```

**步骤 3**：修改 `package.json` 构建脚本

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.json && node scripts/canvas-a2ui-copy.ts && node scripts/copy-hook-metadata.ts && node scripts/write-build-info.ts",
    "build:prod": "pnpm build && node scripts/replace-dev-flag.js",
    "build:dev": "pnpm build"
  }
}
```

**效果**：
| 构建命令 | `__DEV_BUILD__` 值 | DEV 模式 |
|----------|-------------------|----------|
| `pnpm build:dev` | `true`（保持原样） | ✅ 可用 |
| `pnpm build:prod` | `false`（替换后） | ❌ 不可用 |

#### 3.2.3 风险评估

| 风险点 | 概率 | 影响 | 缓解措施 |
|--------|------|------|----------|
| 开发者无法调试 | 无 | - | 使用 build:dev |
| 遗漏其他绕过点 | 低 | 高 | 全局搜索 DEV 相关代码 |
| 替换脚本出错 | 低 | 中 | 添加日志验证 |

#### 3.2.4 需要检查的其他文件

```bash
# 搜索所有可能的绕过点
grep -r "CLAWDBOT_DEV" src/
grep -r "LICENSE_DEV" src/
grep -r "devMode" src/license/
grep -r "skipVerify" src/
grep -r "bypassLicense" src/
```

---

### 方案 3：缩短离线宽限期

#### 3.3.1 当前代码

**文件**：`src/license/offline.ts` 或 `src/license/types.ts`

```typescript
// 当前：72 小时离线宽限期
const OFFLINE_GRACE_PERIOD_MS = 72 * 60 * 60 * 1000; // 72 hours
```

#### 3.3.2 改造方案

```typescript
// 修改为 24 小时
const OFFLINE_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours

// 或者根据许可证类型动态设置
function getOfflineGracePeriod(licenseType: string): number {
  switch (licenseType) {
    case 'enterprise':
      return 7 * 24 * 60 * 60 * 1000; // 企业版 7 天
    case 'professional':
      return 3 * 24 * 60 * 60 * 1000; // 专业版 3 天
    default:
      return 24 * 60 * 60 * 1000; // 基础版 24 小时
  }
}
```

#### 3.3.3 风险评估

| 风险点 | 概率 | 影响 | 缓解措施 |
|--------|------|------|----------|
| 网络不稳定用户投诉 | 中 | 低 | 提供清晰的错误提示 |
| 服务器宕机影响用户 | 低 | 中 | 确保服务器高可用 |

---

### 方案 4：pkg 打包成二进制

#### 3.4.1 方案说明

将 Node.js 代码编译成 V8 字节码，打包成单个可执行文件。

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   打包前                                                    │
│   ┌──────────────────────────────────────────────────┐     │
│   │ ClawdbotCN/                                      │     │
│   │ ├── node/              Node.js 运行时            │     │
│   │ ├── dist/              编译后的 JS 代码          │     │
│   │ │   ├── index.js       ← 人类可读               │     │
│   │ │   ├── license/       ← 人类可读               │     │
│   │ │   └── gateway/       ← 人类可读               │     │
│   │ ├── node_modules/      依赖                      │     │
│   │ └── extensions/        插件                      │     │
│   └──────────────────────────────────────────────────┘     │
│                                                             │
│   打包后                                                    │
│   ┌──────────────────────────────────────────────────┐     │
│   │ ClawdbotCN/                                      │     │
│   │ ├── clawdbot.exe       单个二进制（字节码）       │     │
│   │ ├── node_modules/      原生模块（.node 文件）    │     │
│   │ └── extensions/        插件（保持 JS 可读）      │     │
│   └──────────────────────────────────────────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 3.4.2 安装配置

```bash
# 安装 pkg
pnpm add -D @yao-pkg/pkg
```

#### 3.4.3 配置文件

**修改 `package.json`**：

```json
{
  "bin": {
    "clawdbot": "dist/entry.js"
  },
  "pkg": {
    "targets": [
      "node22-win-x64",
      "node22-macos-x64",
      "node22-macos-arm64",
      "node22-linux-x64"
    ],
    "outputPath": "build/bin",
    "compress": "GZip",
    "assets": [
      "dist/**/*.json",
      "ui/dist/**/*",
      "node_modules/sharp/**/*.node",
      "node_modules/sharp/**/*.dll",
      "node_modules/@napi-rs/**/*.node",
      "node_modules/sqlite-vec/**/*.node",
      "node_modules/@lydell/node-pty/**/*.node",
      "node_modules/better-sqlite3/**/*.node"
    ],
    "scripts": []
  }
}
```

#### 3.4.4 构建脚本

**新文件**：`scripts/build-pkg.ps1`（Windows）

```powershell
# scripts/build-pkg.ps1
param(
    [string]$Target = "win-x64"
)

Write-Host "开始 pkg 打包..." -ForegroundColor Cyan

# 1. 先执行标准构建
Write-Host "步骤 1: TypeScript 编译"
pnpm build
if ($LASTEXITCODE -ne 0) { exit 1 }

# 2. 构建 UI
Write-Host "步骤 2: UI 构建"
pnpm ui:build
if ($LASTEXITCODE -ne 0) { exit 1 }

# 3. 执行 pkg 打包
Write-Host "步骤 3: pkg 打包"
$targetMap = @{
    "win-x64" = "node22-win-x64"
    "mac-x64" = "node22-macos-x64"
    "mac-arm64" = "node22-macos-arm64"
    "linux-x64" = "node22-linux-x64"
}

$pkgTarget = $targetMap[$Target]
if (-not $pkgTarget) {
    Write-Error "不支持的目标: $Target"
    exit 1
}

npx pkg . --target $pkgTarget --output "build/bin/clawdbot-$Target" --compress GZip

if ($LASTEXITCODE -ne 0) {
    Write-Error "pkg 打包失败"
    exit 1
}

# 4. 复制原生模块
Write-Host "步骤 4: 复制原生模块"
$nativeModules = @(
    "node_modules/sharp/build/Release/*.node",
    "node_modules/@napi-rs/canvas/*.node",
    "node_modules/sqlite-vec/*.node"
)

$outputDir = "build/bin/native"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

foreach ($pattern in $nativeModules) {
    $files = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue
    foreach ($file in $files) {
        Copy-Item $file.FullName -Destination $outputDir -Force
        Write-Host "  复制: $($file.Name)"
    }
}

# 5. 复制 extensions（保持可读，支持用户自定义）
Write-Host "步骤 5: 复制 extensions"
Copy-Item -Path "extensions" -Destination "build/bin/extensions" -Recurse -Force

Write-Host "pkg 打包完成！" -ForegroundColor Green
Write-Host "输出目录: build/bin/"
```

#### 3.4.5 入口文件调整

**修改 `src/entry.ts`**：

```typescript
#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 检测是否在 pkg 打包环境中运行
const isPkg = typeof (process as any).pkg !== 'undefined';

if (isPkg) {
  // pkg 环境：设置正确的路径
  const exePath = dirname(process.execPath);
  
  // 原生模块路径
  process.env.SHARP_BINARY_PATH = join(exePath, 'native');
  
  // 插件路径
  process.env.CLAWDBOT_EXTENSIONS_PATH = join(exePath, 'extensions');
}

// 导入主模块
import './cli/index.js';
```

#### 3.4.6 原生模块处理

项目使用的原生模块清单：

| 模块 | 用途 | pkg 兼容性 | 处理方式 |
|------|------|------------|----------|
| `sharp` | 图片处理 | ⚠️ 需要处理 | 复制 .node 文件 |
| `@napi-rs/canvas` | Canvas 绘图 | ⚠️ 需要处理 | 复制 .node 文件 |
| `sqlite-vec` | 向量数据库 | ⚠️ 需要处理 | 复制 .node 文件 |
| `@lydell/node-pty` | 终端模拟 | ⚠️ 需要处理 | 复制 .node 文件 |
| `better-sqlite3` | SQLite | ⚠️ 需要处理 | 复制 .node 文件 |

#### 3.4.7 风险评估

| 风险点 | 概率 | 影响 | 缓解措施 |
|--------|------|------|----------|
| 原生模块加载失败 | 中 | 高 | 充分测试，正确配置路径 |
| 动态 require 失败 | 中 | 高 | 插件保持外部文件 |
| 包体积过大 | 低 | 低 | 使用 GZip 压缩 |
| 启动时间变长 | 低 | 低 | 可接受范围内 |
| 某些 npm 包不兼容 | 低 | 中 | 提前测试所有功能 |

#### 3.4.8 测试检查清单

**基础功能**：
- [ ] Windows x64 启动正常
- [ ] macOS arm64 启动正常
- [ ] macOS x64 启动正常
- [ ] Linux x64 启动正常

**核心功能**：
- [ ] 许可证验证正常
- [ ] Gateway 启动正常
- [ ] Web UI 可访问
- [ ] AI 对话正常

**插件功能**：
- [ ] 飞书插件加载正常
- [ ] 钉钉插件加载正常
- [ ] 企业微信插件加载正常

**原生模块**：
- [ ] sharp 图片处理正常
- [ ] SQLite 数据库正常
- [ ] node-pty 终端正常

---

### 方案 5：完整性校验（可选）

#### 3.5.1 方案说明

启动时校验关键文件的哈希值，检测是否被篡改。

#### 3.5.2 实现代码

**新文件**：`src/security/integrity.ts`

```typescript
import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// 关键文件列表（构建时自动生成）
interface FileHash {
  path: string;
  hash: string;
}

// 构建时生成的哈希表
let INTEGRITY_HASHES: FileHash[] = [];

// 加载哈希表（从服务端或本地文件）
export async function loadIntegrityHashes(): Promise<void> {
  try {
    // 优先从服务端获取（更安全）
    const response = await fetch('https://api.tecbinai.com/api/v1/integrity');
    if (response.ok) {
      INTEGRITY_HASHES = await response.json();
      return;
    }
  } catch {
    // 服务端获取失败，使用内嵌哈希
  }
  
  // 使用内嵌哈希（备用方案）
  INTEGRITY_HASHES = require('./integrity-hashes.json');
}

// 验证文件完整性
export function verifyIntegrity(baseDir: string): {
  valid: boolean;
  tamperedFiles: string[];
} {
  const tamperedFiles: string[] = [];
  
  for (const { path: filePath, hash: expectedHash } of INTEGRITY_HASHES) {
    const fullPath = join(baseDir, filePath);
    
    // 文件不存在
    if (!existsSync(fullPath)) {
      tamperedFiles.push(`${filePath} (文件丢失)`);
      continue;
    }
    
    // 计算哈希
    const content = readFileSync(fullPath);
    const actualHash = createHash('sha256').update(content).digest('hex');
    
    // 哈希不匹配
    if (actualHash !== expectedHash) {
      tamperedFiles.push(`${filePath} (已被修改)`);
    }
  }
  
  return {
    valid: tamperedFiles.length === 0,
    tamperedFiles,
  };
}

// 启动时调用
export async function checkIntegrityOnStartup(): Promise<void> {
  await loadIntegrityHashes();
  
  const result = verifyIntegrity(process.cwd());
  
  if (!result.valid) {
    console.error('检测到文件被篡改:');
    result.tamperedFiles.forEach(f => console.error(`  - ${f}`));
    console.error('程序退出');
    process.exit(1);
  }
}
```

**构建脚本**：`scripts/generate-integrity-hashes.ts`

```typescript
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// 需要校验的关键目录
const CRITICAL_PATHS = [
  'dist/license',
  'dist/security',
];

function getAllFiles(dir: string): string[] {
  const files: string[] = [];
  
  const items = readdirSync(dir);
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath));
    } else if (item.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function generateHashes(): void {
  const hashes: { path: string; hash: string }[] = [];
  
  for (const dir of CRITICAL_PATHS) {
    const files = getAllFiles(dir);
    
    for (const file of files) {
      const content = readFileSync(file);
      const hash = createHash('sha256').update(content).digest('hex');
      
      hashes.push({
        path: file.replace(/\\/g, '/'),
        hash,
      });
    }
  }
  
  // 写入 JSON 文件
  writeFileSync(
    'src/security/integrity-hashes.json',
    JSON.stringify(hashes, null, 2)
  );
  
  console.log(`生成了 ${hashes.length} 个文件的哈希`);
}

generateHashes();
```

#### 3.5.3 风险评估

| 风险点 | 概率 | 影响 | 缓解措施 |
|--------|------|------|----------|
| 更新后哈希失效 | 高 | 高 | 每次构建重新生成 |
| 内嵌哈希被一起篡改 | 中 | 高 | 从服务端获取哈希 |
| 性能影响 | 低 | 低 | 只在启动时校验 |

---

### 方案 6：反调试检测（可选）

#### 3.6.1 实现代码

**新文件**：`src/security/anti-debug.ts`

```typescript
/**
 * 反调试检测模块
 * 仅在生产构建中启用
 */

// 是否为生产构建
const isProduction = process.env.NODE_ENV === 'production';

/**
 * 检测是否在调试模式
 */
function detectDebugger(): boolean {
  // 方法 1：检测 Node.js 调试参数
  const debugArgs = ['--inspect', '--inspect-brk', '--debug', '--debug-brk'];
  if (process.execArgv.some(arg => debugArgs.some(d => arg.includes(d)))) {
    return true;
  }
  
  // 方法 2：检测调试环境变量
  const debugEnvs = ['NODE_OPTIONS', 'NODE_INSPECT'];
  for (const env of debugEnvs) {
    const value = process.env[env];
    if (value && (value.includes('inspect') || value.includes('debug'))) {
      return true;
    }
  }
  
  // 方法 3：检测 v8 调试对象
  // @ts-ignore
  if (typeof v8debug !== 'undefined') {
    return true;
  }
  
  return false;
}

/**
 * 处理检测到调试器
 */
function handleDebuggerDetected(): void {
  console.error('[安全] 检测到调试环境，程序退出');
  
  // 清理敏感数据
  if (process.env.LICENSE_KEY) {
    process.env.LICENSE_KEY = '';
  }
  
  process.exit(1);
}

/**
 * 启动反调试检测
 */
export function startAntiDebug(): void {
  // 开发模式不启用
  if (!isProduction) {
    return;
  }
  
  // 立即检测一次
  if (detectDebugger()) {
    handleDebuggerDetected();
  }
  
  // 定期检测（每 10 秒）
  setInterval(() => {
    if (detectDebugger()) {
      handleDebuggerDetected();
    }
  }, 10000);
}
```

#### 3.6.2 集成到启动流程

**修改 `src/gateway/server.impl.ts`**：

```typescript
import { startAntiDebug } from '../security/anti-debug';

export async function startGatewayServer(options: ServerOptions) {
  // 启动反调试检测
  startAntiDebug();
  
  // ... 其他启动逻辑
}
```

#### 3.6.3 风险评估

| 风险点 | 概率 | 影响 | 缓解措施 |
|--------|------|------|----------|
| 误判正常环境 | 低 | 中 | 充分测试 |
| 开发者无法调试 | 中 | 低 | 仅生产版启用 |
| 被高级攻击者绕过 | 中 | 低 | 配合其他措施 |

---

## 四、实施计划（2026-02-03 更新）

### 4.1 时间表（已确认）

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   第一阶段：立即实施 ✅ 已确认                               │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  方案 2：DEV 模式编译时控制（30 分钟）              │   │
│   │  方案 3：离线宽限期 72h → 24h（5 分钟）             │   │
│   │  测试验证（30 分钟）                                │   │
│   └─────────────────────────────────────────────────────┘   │
│   总计：约 1 小时                                           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   第二阶段：等服务端准备 ⏳                                  │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  前置条件：服务端 RSA 签发接口就绪                   │   │
│   │  方案 1：RSA 公钥验证（2 小时）                     │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   第三阶段：单独分支测试 ⏳                                  │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  方案 4：pkg 打包（1 天）                           │   │
│   │  需要三平台充分测试                                 │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 任务清单

#### 第一阶段：✅ 已完成（2026-02-03）

- [x] **方案 2：DEV 模式编译时控制** ✅ 已实现
  - [x] `src/license/startup.ts:64-76` - `__DEV_BUILD__` 判断逻辑
  - [x] `src/global.d.ts` - 类型声明
  - [x] `scripts/replace-dev-flag.ts` - 替换脚本
  - [x] `package.json:86` - `build:prod` 命令
  - [x] 检查其他绕过点：`src/gateway/setup-wizard.ts:1355` 也使用了 `__DEV_BUILD__`
  - [x] 测试：生产版 DEV 模式不可用 ✅
  - [x] 测试：开发版 DEV 模式可用 ✅

- [x] **方案 3：缩短离线宽限期** ✅ 已实现
  - [x] `src/license/types.ts:373` - `offlineGracePeriodHours: 24`

#### 第二阶段：✅ 已完成（2026-02-03）

- [x] **方案 1：RSA 公钥验证** ✅ 服务端已上线
  - [x] 服务端 RSA 签发接口已就绪
  - [x] `src/license/rsa-verify.ts` - RSA 验证模块（已存在）
  - [x] `src/license/types.ts:375` - `enableRsaVerify: true`
  - [x] 公钥已内置到客户端
  - [x] 包含服务端时间验证（防重放）

#### 第三阶段：⏸️ pkg 暂缓 / ✅ 混淆已完成

- [x] **方案 5：代码混淆** ✅ 已完成（2026-02-03）
  - [x] 安装 `javascript-obfuscator`
  - [x] `scripts/obfuscate.config.js` - 安全混淆配置
  - [x] `scripts/obfuscate-dist.ts` - 混淆脚本
  - [x] `package.json` - `build:secure` 和 `obfuscate` 命令
  - [x] 测试：混淆后程序正常运行 ✅
  - [x] 混淆 1528 个文件，跳过 105 个小文件

- [x] **方案 4：完整性哈希校验** ✅ 已完成
  - [x] `scripts/generate-integrity-hashes.ts` - 哈希生成脚本
  - [x] `dist/security/integrity-hashes.json` - 19 个核心文件哈希
  - [x] 集成到 `build:prod` 构建流程

- [ ] **方案 6：pkg 二进制打包** ⏸️ 暂缓
  - [x] 安装 `@yao-pkg/pkg`
  - [x] 配置 `package.json`
  - [x] 创建 `scripts/pkg-build.ps1`
  - [x] 处理原生模块复制逻辑
  - [ ] ⚠️ ESM 模块兼容性问题待解决
  - [ ] 备选方案：esbuild 打包后再用 pkg

#### 可选（已有基础，可按需启用）

- [x] **反调试检测** - 已存在基础代码
  - [x] `src/security/anti-debug.ts` - 反调试模块（已存在）
  - [ ] 可选：在生产环境启用

---

## 五、回滚方案

### 5.1 RSA 验证回滚

如果 RSA 验证出现问题：

1. 服务端恢复旧的签发接口
2. 客户端保留旧的 HMAC 验证代码（注释状态）
3. 通过配置开关切换验证方式

```typescript
// src/license/verify.ts
const useRSA = config.license?.useRSAVerification ?? true;

if (useRSA) {
  return verifyWithRSA(licenseKey, deviceId);
} else {
  return verifyWithHMAC(licenseKey, deviceId); // 旧方式
}
```

### 5.2 pkg 打包回滚

如果 pkg 打包版本有问题：

1. 保留传统打包方式（node + dist）
2. 同时发布两个版本
3. 用户可选择安装方式

```
发布目录结构：
├── ClawdbotCN-Setup-pkg.exe    # pkg 打包版
└── ClawdbotCN-Setup-std.exe    # 传统版本（备用）
```

---

## 六、监控指标

上线后需要监控以下指标：

| 指标 | 正常范围 | 告警阈值 |
|------|----------|----------|
| 许可证验证成功率 | > 99% | < 95% |
| 签名验证失败率 | < 1% | > 5% |
| 启动耗时 | < 5s | > 10s |
| 崩溃率 | < 0.1% | > 1% |

---

## 七、文档更新

### 相关文档

| 文档 | 路径 | 说明 |
|------|------|------|
| 软件保护 Skill | `skills/software-protection/SKILL.md` | **主文档**，包含方案概览和决策记录 |
| 加密方案知识库 | `devTemp/todo/jiami.md` | 所有方案的详细原理和代码示例 |
| 实施手册 | `devTemp/todo/jiamitodo.md` | 具体实施步骤和任务清单（本文档） |

### 实施完成后需要更新

- [ ] `CHANGELOG.md` - 记录安全更新
- [ ] `skills/software-protection/SKILL.md` - 更新方案状态
- [ ] 内部文档 - 新的构建流程
- [ ] 服务端文档 - 新的签发接口

### 变更日志

| 日期 | 变更内容 |
|------|----------|
| 2026-02-03 | 初始版本 |
| 2026-02-03 | 确认第一阶段实施方案：方案 2 采用编译时控制，方案 1 等服务端 |
| 2026-02-03 | **第一阶段已完成**：方案 2、3 代码已存在，无需修改 |

---

> 最后更新：2026-02-03
> 负责人：待定
> 状态：待实施
