# Clawdbot 软件加密保护方案

> 文档创建时间：2026-02-03
> 目标：防止软件被逆向、破解、修改，保护商业版权

---

## 一、当前安全问题（必须修复）

### 🔴 严重问题

| 问题 | 位置 | 风险等级 | 攻击方式 |
|------|------|----------|----------|
| 签名密钥硬编码 | `src/license/types.ts:366` | **致命** | 攻击者可伪造任何签名 |
| DEV 模式可绕过验证 | `src/license/startup.ts:59-64` | **致命** | 设置环境变量即可跳过验证 |
| 代码无混淆 | 整个 `dist/` 目录 | **高** | 直接阅读/修改代码 |
| 离线缓存可篡改 | `license_cache.json` | **高** | 修改过期时间 |

### 🟡 中等问题

| 问题 | 位置 | 风险等级 |
|------|------|----------|
| 授权码明文存储 | `config.json` | 中 |
| 设备ID可重置 | `.device_id` 文件 | 中 |
| 离线宽限期过长 | 72小时 | 中 |
| 心跳间隔过长 | 24小时 | 中 |
| 无代码签名 | Windows 安装包 | 中 |

---

## 二、保护方案总览

### 方案分类

| 类别 | 方案 | 成本 | 效果 | 优先级 |
|------|------|------|------|--------|
| 代码保护 | JavaScript 混淆 | 免费 | ⭐⭐⭐ | P1 |
| 代码保护 | pkg 二进制打包 | 免费 | ⭐⭐⭐⭐ | P1 |
| 代码保护 | Bytenode 字节码 | 免费 | ⭐⭐⭐⭐ | P2 |
| 许可证 | RSA 非对称签名 | 免费 | ⭐⭐⭐⭐ | P0 |
| 许可证 | 设备指纹绑定 | 免费 | ⭐⭐⭐ | P1 |
| 许可证 | 时间戳防篡改 | 免费 | ⭐⭐ | P1 |
| 运行时 | 反调试检测 | 免费 | ⭐⭐⭐ | P1 |
| 运行时 | 完整性校验 | 免费 | ⭐⭐⭐ | P1 |
| 运行时 | 环境检测 | 免费 | ⭐⭐ | P2 |
| 运行时 | 代码自毁 | 免费 | ⭐⭐ | P2 |
| 网络 | 证书固定 | 免费 | ⭐⭐⭐ | P2 |
| 网络 | 请求签名 | 免费 | ⭐⭐⭐ | P1 |
| 二进制 | VMProtect 加壳 | $250-500 | ⭐⭐⭐⭐⭐ | P3 |
| 签名 | 代码签名证书 | $400-600/年 | ⭐⭐⭐ | P2 |
| 架构 | 核心功能云端化 | 服务器成本 | ⭐⭐⭐⭐⭐⭐ | P1 |

---

## 三、免费方案详细说明

### 3.1 代码层保护

#### 3.1.1 JavaScript 混淆

**工具**：javascript-obfuscator（开源免费）

**安装**：
```bash
pnpm add -D javascript-obfuscator
```

**推荐配置** `obfuscator.config.js`：
```javascript
module.exports = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  debugProtection: true,
  debugProtectionInterval: 2000,
  disableConsoleOutput: false,  // 保留日志便于排错
  identifierNamesGenerator: 'hexadecimal',
  identifiersPrefix: '_0x',
  rotateStringArray: true,
  selfDefending: false,  // 可能导致兼容问题
  shuffleStringArray: true,
  splitStrings: true,
  splitStringsChunkLength: 5,
  stringArray: true,
  stringArrayEncoding: ['rc4'],
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  
  // ⚠️ 重要：保留关键名称
  reservedNames: [
    'licenseKey', 'deviceId', 'apiKey', 'token', 'key',
    'signature', 'timestamp', 'nonce', 'name', 'version',
    'description', 'main', 'get', 'post', 'put', 'delete',
    'use', 'listen', 'exports', 'require', 'module'
  ],
  
  // ⚠️ 排除不混淆的文件
  exclude: [
    'node_modules/**',
    'extensions/**',
    '**/config*.js',
    '**/types*.js'
  ]
};
```

**⚠️ 风险点**：
- 可能导致动态加载的插件无法识别
- API 字段名被混淆导致请求失败
- 错误堆栈不可读，调试困难
- 启动时间增加 5-15%
- 包体积增加 10-30%

**✅ 缓解措施**：
- 使用 `reservedNames` 保留关键字段
- 使用 `exclude` 排除敏感文件
- 生产环境删除 source map
- 保留独立的 debug 版本

---

#### 3.1.2 pkg 二进制打包

**工具**：@yao-pkg/pkg（开源免费）

**安装**：
```bash
pnpm add -D @yao-pkg/pkg
```

**配置** `package.json`：
```json
{
  "pkg": {
    "targets": [
      "node22-win-x64",
      "node22-macos-arm64",
      "node22-macos-x64",
      "node22-linux-x64"
    ],
    "outputPath": "build/bin",
    "compress": "GZip",
    "assets": [
      "dist/**/*",
      "ui/dist/**/*",
      "extensions/**/*",
      "node_modules/sharp/**/*.node",
      "node_modules/@napi-rs/**/*.node",
      "node_modules/sqlite-vec/**/*.node"
    ],
    "scripts": [
      "extensions/**/dist/**/*.js"
    ]
  }
}
```

**⚠️ 风险点**：
- 原生模块（.node 文件）需要单独处理
- 动态 require 无法识别
- 体积增加 40-60MB（内嵌 Node.js）
- 部分 npm 包可能不兼容

**✅ 缓解措施**：
- 使用 `assets` 显式包含原生模块
- 改用静态 import 替代动态 require
- 充分测试所有功能再发布

---

#### 3.1.3 Bytenode 字节码编译

**工具**：bytenode（开源免费）

**安装**：
```bash
pnpm add -D bytenode
```

**使用**：
```javascript
const bytenode = require('bytenode');

// 编译单个文件
bytenode.compileFile('dist/license/verify.js');
// 生成 dist/license/verify.jsc

// 运行时加载
require('bytenode');
require('./dist/license/verify.jsc');
```

**⚠️ 风险点**：
- 需要在目标平台编译（不能跨平台）
- Node.js 版本必须一致
- 无法与 pkg 同时使用

---

### 3.2 许可证加固

#### 3.2.1 RSA 非对称签名（替代硬编码密钥）

**原理**：私钥在服务端签名，公钥在客户端验证

**实现**：

```typescript
// src/license/crypto.ts
import { createVerify, createSign } from 'crypto';

// 公钥可以公开（放在客户端）
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----`;

// 私钥保密（只在服务端）
// const PRIVATE_KEY = ...

// 客户端：验证许可证签名
export function verifyLicenseSignature(
  licenseData: string, 
  signature: string
): boolean {
  try {
    const verify = createVerify('SHA256');
    verify.update(licenseData);
    return verify.verify(PUBLIC_KEY, signature, 'base64');
  } catch {
    return false;
  }
}

// 服务端：签发许可证
export function signLicense(licenseData: string, privateKey: string): string {
  const sign = createSign('SHA256');
  sign.update(licenseData);
  return sign.sign(privateKey, 'base64');
}
```

**⚠️ 风险点**：
- 公钥被替换（需要完整性校验配合）
- 验证逻辑被绕过（需要代码混淆配合）

**✅ 缓解措施**：
- 公钥内嵌到多处代码中
- 配合完整性校验

---

#### 3.2.2 设备指纹绑定

**实现**：

```typescript
// src/license/device-fingerprint.ts
import { cpus, networkInterfaces, hostname, platform } from 'os';
import { createHash } from 'crypto';
import { execSync } from 'child_process';

export function getDeviceFingerprint(): string {
  const data: string[] = [];
  
  // CPU 信息
  const cpu = cpus()[0];
  if (cpu) data.push(cpu.model);
  
  // MAC 地址（取第一个非内部网卡）
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (!net.internal && net.mac !== '00:00:00:00:00:00') {
        data.push(net.mac);
        break;
      }
    }
  }
  
  // 主机名
  data.push(hostname());
  
  // 平台特定信息
  if (platform() === 'win32') {
    try {
      // 主板序列号
      const serial = execSync(
        'wmic baseboard get serialnumber', 
        { encoding: 'utf8', timeout: 5000 }
      );
      data.push(serial.replace(/\s+/g, ''));
    } catch {}
    
    try {
      // 硬盘序列号
      const diskId = execSync(
        'wmic diskdrive get serialnumber',
        { encoding: 'utf8', timeout: 5000 }
      );
      data.push(diskId.replace(/\s+/g, ''));
    } catch {}
  }
  
  if (platform() === 'darwin') {
    try {
      // macOS 硬件 UUID
      const uuid = execSync(
        "ioreg -d2 -c IOPlatformExpertDevice | awk -F'\"' '/IOPlatformUUID/{print $4}'",
        { encoding: 'utf8', timeout: 5000 }
      );
      data.push(uuid.trim());
    } catch {}
  }
  
  if (platform() === 'linux') {
    try {
      // Linux 机器 ID
      const machineId = execSync(
        'cat /etc/machine-id 2>/dev/null || cat /var/lib/dbus/machine-id',
        { encoding: 'utf8', timeout: 5000 }
      );
      data.push(machineId.trim());
    } catch {}
  }
  
  // 生成指纹哈希
  return createHash('sha256')
    .update(data.filter(Boolean).join('|'))
    .digest('hex');
}
```

**⚠️ 风险点**：
- 虚拟机/容器环境指纹不稳定
- 用户更换硬件后需要重新激活

---

#### 3.2.3 时间戳防篡改

**实现**：

```typescript
// src/license/time-check.ts
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const TIMESTAMP_FILE = join(process.cwd(), '.last_verify');

export function checkTimeManipulation(): { valid: boolean; reason?: string } {
  const now = Date.now();
  
  if (existsSync(TIMESTAMP_FILE)) {
    try {
      const lastCheck = parseInt(readFileSync(TIMESTAMP_FILE, 'utf8'), 10);
      
      // 检测时间回拨（允许 5 分钟误差）
      if (now < lastCheck - 5 * 60 * 1000) {
        return { 
          valid: false, 
          reason: `系统时间异常：当前时间早于上次验证时间` 
        };
      }
      
      // 检测时间跳跃（超过 30 天未验证）
      if (now - lastCheck > 30 * 24 * 60 * 60 * 1000) {
        return { 
          valid: false, 
          reason: `验证间隔过长，请联网重新验证` 
        };
      }
    } catch {}
  }
  
  // 更新时间戳
  writeFileSync(TIMESTAMP_FILE, now.toString());
  return { valid: true };
}
```

---

### 3.3 运行时保护

#### 3.3.1 反调试检测

**实现**：

```typescript
// src/security/anti-debug.ts

export function startAntiDebug(): void {
  // 立即检测一次
  if (detectDebugger()) {
    handleDebuggerDetected();
  }
  
  // 定期检测（每 5 秒）
  setInterval(() => {
    if (detectDebugger()) {
      handleDebuggerDetected();
    }
  }, 5000);
}

function detectDebugger(): boolean {
  // 方法1：检测 Node.js 调试参数
  if (process.execArgv.some(arg => 
    arg.includes('--inspect') || 
    arg.includes('--debug') ||
    arg.includes('--inspect-brk')
  )) {
    return true;
  }
  
  // 方法2：检测 v8 调试对象
  // @ts-ignore
  if (typeof v8debug !== 'undefined') {
    return true;
  }
  
  // 方法3：时间检测（调试器会导致 debugger 语句暂停）
  const start = performance.now();
  debugger;
  const elapsed = performance.now() - start;
  if (elapsed > 100) {
    return true;
  }
  
  // 方法4：检测常见调试环境变量
  const debugEnvVars = [
    'NODE_OPTIONS',
    'NODE_INSPECT',
    'VSCODE_INSPECTOR_OPTIONS'
  ];
  for (const envVar of debugEnvVars) {
    const value = process.env[envVar];
    if (value && (value.includes('inspect') || value.includes('debug'))) {
      return true;
    }
  }
  
  return false;
}

function handleDebuggerDetected(): void {
  console.error('检测到调试环境，程序退出');
  // 清理敏感数据
  process.env.LICENSE_KEY = '';
  process.exit(1);
}
```

**⚠️ 风险点**：
- 开发者自己调试也会被阻止
- 某些 IDE 可能误触发

**✅ 缓解措施**：
- 只在生产构建中启用
- 提供 `--allow-debug` 参数（需要授权）

---

#### 3.3.2 完整性校验

**实现**：

```typescript
// src/security/integrity.ts
import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// 构建时生成，或从服务端获取
interface FileHash {
  path: string;
  hash: string;
}

export async function verifyIntegrity(
  hashSource: 'embedded' | 'server' = 'embedded'
): Promise<{ valid: boolean; tamperedFiles: string[] }> {
  
  let expectedHashes: FileHash[];
  
  if (hashSource === 'server') {
    // 从服务端获取（更安全，但需要联网）
    expectedHashes = await fetchHashesFromServer();
  } else {
    // 内嵌哈希表（离线可用，但可能被一起篡改）
    expectedHashes = EMBEDDED_HASHES;
  }
  
  const tamperedFiles: string[] = [];
  
  for (const { path: filePath, hash: expectedHash } of expectedHashes) {
    const fullPath = join(process.cwd(), filePath);
    
    if (!existsSync(fullPath)) {
      tamperedFiles.push(`${filePath} (文件丢失)`);
      continue;
    }
    
    const content = readFileSync(fullPath);
    const actualHash = createHash('sha256').update(content).digest('hex');
    
    if (actualHash !== expectedHash) {
      tamperedFiles.push(`${filePath} (哈希不匹配)`);
    }
  }
  
  return {
    valid: tamperedFiles.length === 0,
    tamperedFiles
  };
}

// 需要在构建时生成
const EMBEDDED_HASHES: FileHash[] = [
  // 构建脚本自动填充
];

async function fetchHashesFromServer(): Promise<FileHash[]> {
  const response = await fetch('https://api.yourserver.com/integrity-hashes');
  return response.json();
}
```

**构建时生成哈希表**：

```typescript
// scripts/generate-integrity-hashes.ts
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const CRITICAL_DIRS = ['dist/license', 'dist/gateway', 'dist/security'];

function generateHashes(): void {
  const hashes: { path: string; hash: string }[] = [];
  
  for (const dir of CRITICAL_DIRS) {
    const files = getAllFiles(dir);
    for (const file of files) {
      const content = readFileSync(file);
      const hash = createHash('sha256').update(content).digest('hex');
      hashes.push({ path: file, hash });
    }
  }
  
  // 写入到源文件
  const output = `export const EMBEDDED_HASHES = ${JSON.stringify(hashes, null, 2)};`;
  writeFileSync('src/security/integrity-hashes.ts', output);
}

function getAllFiles(dir: string): string[] {
  const files: string[] = [];
  const items = readdirSync(dir);
  
  for (const item of items) {
    const fullPath = join(dir, item);
    if (statSync(fullPath).isDirectory()) {
      files.push(...getAllFiles(fullPath));
    } else if (item.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

generateHashes();
```

---

#### 3.3.3 环境检测

**实现**：

```typescript
// src/security/environment.ts
import { cpus, totalmem } from 'os';
import { execSync } from 'child_process';

interface EnvironmentCheck {
  isVM: boolean;
  isSandbox: boolean;
  suspiciousProcesses: string[];
  warnings: string[];
}

export function checkEnvironment(): EnvironmentCheck {
  const result: EnvironmentCheck = {
    isVM: false,
    isSandbox: false,
    suspiciousProcesses: [],
    warnings: []
  };
  
  // 检测虚拟机
  const cpu = cpus()[0]?.model.toLowerCase() || '';
  const vmKeywords = ['virtual', 'vmware', 'vbox', 'qemu', 'xen', 'hyperv', 'kvm'];
  if (vmKeywords.some(kw => cpu.includes(kw))) {
    result.isVM = true;
    result.warnings.push('检测到虚拟机环境');
  }
  
  // 检测内存过小（可能是沙箱）
  const totalMemGB = totalmem() / (1024 * 1024 * 1024);
  if (totalMemGB < 2) {
    result.isSandbox = true;
    result.warnings.push(`内存过小 (${totalMemGB.toFixed(1)}GB)，可能是沙箱环境`);
  }
  
  // Windows: 检测可疑进程
  if (process.platform === 'win32') {
    try {
      const processes = execSync('tasklist', { encoding: 'utf8' }).toLowerCase();
      const suspiciousNames = [
        'ollydbg', 'x64dbg', 'x32dbg', 'ida', 'ida64',
        'wireshark', 'fiddler', 'charles', 'procmon',
        'processhacker', 'cheatengine'
      ];
      
      for (const name of suspiciousNames) {
        if (processes.includes(name)) {
          result.suspiciousProcesses.push(name);
        }
      }
    } catch {}
  }
  
  return result;
}
```

---

### 3.4 网络层保护

#### 3.4.1 请求签名

**实现**：

```typescript
// src/security/request-sign.ts
import { createHmac, randomBytes } from 'crypto';

export interface SignedRequest {
  data: object;
  timestamp: number;
  nonce: string;
  signature: string;
}

export function createSignedRequest(data: object): SignedRequest {
  const timestamp = Date.now();
  const nonce = randomBytes(16).toString('hex');
  
  // 动态派生密钥（比硬编码更安全）
  const key = deriveRequestKey(timestamp, nonce);
  
  const payload = JSON.stringify(data) + timestamp + nonce;
  const signature = createHmac('sha256', key)
    .update(payload)
    .digest('hex');
  
  return { data, timestamp, nonce, signature };
}

// 密钥派生函数（客户端和服务端使用相同算法）
function deriveRequestKey(timestamp: number, nonce: string): string {
  // 基于时间窗口的密钥（每小时变化）
  const timeWindow = Math.floor(timestamp / 3600000);
  const base = Buffer.from([
    0x43, 0x4c, 0x41, 0x57, 0x44, // 固定前缀
    ...Buffer.from(timeWindow.toString()),
    ...Buffer.from(nonce.slice(0, 8))
  ]);
  
  return createHmac('sha256', base)
    .update(nonce)
    .digest('hex');
}
```

---

## 四、付费方案说明

### 4.1 VMProtect / Themida 加壳

**适用**：Windows 平台

**费用**：$250-500（一次性购买）

**效果**：
- 代码虚拟化：关键代码转为自定义字节码
- 反调试：多层检测机制
- 反篡改：运行时自校验
- 导入表保护：隐藏 API 调用

**使用方式**：
1. 购买授权
2. 将 pkg 打包的 .exe 文件拖入 VMProtect
3. 选择保护强度
4. 生成保护后的 .exe

---

### 4.2 代码签名证书

**适用**：Windows / macOS

**费用**：
- Windows EV 证书：$400-600/年（DigiCert、Sectigo）
- Apple Developer：$99/年（已有可跳过）

**效果**：
- 消除"未知发布者"警告
- SmartScreen 信任
- 防止篡改（签名验证失败会报警）

---

### 4.3 核心功能云端化（终极方案）

**架构**：
```
客户端 → 你们的服务端（验证许可证）→ AI 服务商

- API Key 存储在服务端
- 所有 AI 请求经过服务端代理
- 服务端验证许可证后才转发
```

**效果**：即使客户端被完全破解，也无法使用 AI 功能

**费用**：服务器成本（按需）

---

## 五、风险评估矩阵

| 方案 | 出问题概率 | 影响程度 | 回滚难度 | 建议 |
|------|------------|----------|----------|------|
| 移除硬编码密钥 | 极低 | 无 | 简单 | ✅ 立即做 |
| 删除 DEV 绕过 | 极低 | 无 | 简单 | ✅ 立即做 |
| RSA 签名 | 低 | 低 | 简单 | ✅ 立即做 |
| 反调试检测 | 低 | 低 | 简单 | ✅ 立即做 |
| 时间戳防篡改 | 低 | 低 | 简单 | ✅ 立即做 |
| 完整性校验 | 低 | 中 | 中等 | ✅ 谨慎做 |
| 设备指纹加强 | 低 | 中 | 简单 | ✅ 谨慎做 |
| 请求签名 | 低 | 中 | 中等 | ✅ 谨慎做 |
| **JavaScript 混淆** | **中** | **高** | **困难** | ⚠️ 充分测试 |
| **pkg 打包** | **中** | **高** | **困难** | ⚠️ 充分测试 |
| 环境检测 | 中 | 中 | 简单 | ⚠️ 可选 |
| 证书固定 | 中 | 高 | 困难 | ⚠️ 可选 |

---

## 六、实施计划

### 第一阶段：零风险措施（1-2天）

**优先级 P0**，不会导致任何问题：

- [ ] 移除硬编码签名密钥（`src/license/types.ts`）
- [ ] 实现 RSA 公钥验证
- [ ] 删除 DEV 模式绕过代码（`src/license/startup.ts`）
- [ ] 添加反调试检测模块
- [ ] 添加时间戳防篡改

### 第二阶段：低风险措施（2-3天）

**优先级 P1**，需要简单测试：

- [ ] 添加完整性校验模块
- [ ] 加强设备指纹算法
- [ ] 实现请求签名
- [ ] 缩短离线宽限期（72h → 24h）
- [ ] 缩短心跳间隔（24h → 6h）

### 第三阶段：需要测试（1周）

**优先级 P1-P2**，在单独分支进行：

- [ ] 配置 JavaScript 混淆
- [ ] 配置 pkg 打包
- [ ] 处理原生模块兼容性
- [ ] 全功能回归测试
- [ ] 三平台验证（Windows/macOS/Linux）

### 第四阶段：可选增强（按需）

**优先级 P2-P3**：

- [ ] 购买代码签名证书
- [ ] VMProtect 加壳（Windows）
- [ ] 核心功能云端化
- [ ] 环境检测
- [ ] 证书固定

---

## 七、测试检查清单

### 混淆后测试项

- [ ] 网关正常启动
- [ ] 许可证验证正常
- [ ] 所有消息通道连接正常
- [ ] 插件加载正常
- [ ] 配置读写正常
- [ ] Web UI 正常
- [ ] 自动更新正常
- [ ] 错误日志可读（关键信息）

### pkg 打包后测试项

- [ ] Windows x64 启动正常
- [ ] macOS arm64 启动正常
- [ ] macOS x64 启动正常
- [ ] Linux x64 启动正常
- [ ] sharp 图片处理正常
- [ ] SQLite 数据库正常
- [ ] node-pty 终端正常
- [ ] 所有原生模块正常

---

## 八、回滚方案

### 如果混淆导致问题

1. 保留未混淆的构建产物
2. 配置文件记录混淆版本号
3. 发布时同时保留 debug 版本
4. 紧急情况发布未混淆版本

### 如果 pkg 打包导致问题

1. 保留传统打包方式（node + dist）
2. 提供备用下载链接
3. 用户可选择安装方式

---

## 九、监控和告警

### 异常检测项

- 同一许可证短时间内多设备登录
- 设备指纹频繁变化
- 请求签名验证失败率上升
- 非正常时间段的大量请求

### 告警阈值

| 指标 | 阈值 | 动作 |
|------|------|------|
| 同一许可证设备数 | > 3 | 警告 |
| 签名验证失败率 | > 5% | 调查 |
| 异常设备指纹 | > 10次/天 | 临时封禁 |

---

## 十、参考资源

### 开源工具

- [javascript-obfuscator](https://github.com/javascript-obfuscator/javascript-obfuscator)
- [pkg](https://github.com/yao-pkg/pkg)
- [bytenode](https://github.com/bytenode/bytenode)

### 商业工具

- [VMProtect](https://vmpsoft.com/)
- [Themida](https://www.oreans.com/Themida.php)
- [Enigma Protector](https://enigmaprotector.com/)

### 代码签名证书

- [DigiCert](https://www.digicert.com/signing/code-signing-certificates)
- [Sectigo](https://sectigo.com/ssl-certificates-tls/code-signing)
- [GlobalSign](https://www.globalsign.com/en/code-signing-certificate)

---

> 最后更新：2026-02-03
> 负责人：待定
> 下次评审：实施第一阶段后
