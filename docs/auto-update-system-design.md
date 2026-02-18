# OpenClawCN 自动增量升级系统设计方案

> 完整技术方案 | 2026-02-18
> 目标：实现基于阿里云服务器的自动增量升级系统

---

## 一、系统架构总览

### 1.1 核心组件

```
┌─────────────────────────────────────────────────────────────┐
│                    阿里云升级服务器                           │
├─────────────────────────────────────────────────────────────┤
│ ① 构建服务器 (CI/CD)                                         │
│    ├─ GitHub Actions / Jenkins                              │
│    ├─ 自动构建加密包                                          │
│    └─ 生成完整性校验                                          │
│                                                              │
│ ② 文件存储服务 (OSS)                                         │
│    ├─ 阿里云 OSS (Object Storage Service)                   │
│    ├─ CDN 加速分发                                            │
│    └─ 版本管理 + 增量包                                       │
│                                                              │
│ ③ 升级管理服务 (API)                                         │
│    ├─ Node.js/Express 后端                                   │
│    ├─ 版本检查 API                                            │
│    ├─ 增量计算服务                                            │
│    └─ 认证鉴权系统                                            │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    客户端更新模块                             │
├─────────────────────────────────────────────────────────────┤
│ ① 版本检测器                                                 │
│    ├─ 定时检查新版本 (每4小时/启动时)                         │
│    ├─ 比对本地版本号                                          │
│    └─ 获取更新元数据                                          │
│                                                              │
│ ② 增量下载器                                                 │
│    ├─ 计算需要的文件                                          │
│    ├─ 断点续传支持                                            │
│    ├─ 多线程并发下载                                          │
│    └─ 完整性校验 (SHA256)                                    │
│                                                              │
│ ③ 安装应用器                                                 │
│    ├─ 原子化替换文件                                          │
│    ├─ 加密文件解密/验证                                       │
│    ├─ 依赖自动安装                                            │
│    └─ 回滚机制                                               │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 更新流程图

```
┌──────────┐
│ 用户启动   │ 或 定时任务触发
└─────┬────┘
      ↓
┌──────────────────────────────────────────┐
│ 1. 版本检测                               │
│    - 读取本地 package.json: 2026.2.15    │
│    - 请求: GET /api/check-update          │
│    - 响应: { latest: "2026.2.20", ... }  │
└─────┬────────────────────────────────────┘
      ↓
┌──────────────────────────────────────────┐
│ 2. 计算差异 (增量计算)                     │
│    - 请求: POST /api/compute-delta        │
│      Body: { from: "2026.2.15",          │
│              to: "2026.2.20" }           │
│    - 响应: { files: [...], total: 15MB } │
└─────┬────────────────────────────────────┘
      ↓
┌──────────────────────────────────────────┐
│ 3. 用户确认 (可选静默更新)                 │
│    - 显示更新日志                          │
│    - 预计下载大小                          │
│    - 用户同意 / 自动静默                   │
└─────┬────────────────────────────────────┘
      ↓
┌──────────────────────────────────────────┐
│ 4. 增量下载                               │
│    - 并发下载变更文件                      │
│    - 实时进度显示                          │
│    - SHA256 校验                          │
│    - 断点续传支持                          │
└─────┬────────────────────────────────────┘
      ↓
┌──────────────────────────────────────────┐
│ 5. 应用更新                               │
│    - 备份当前版本 (快速回滚)               │
│    - 原子化替换文件                        │
│    - 解密加密文件 (.jsc)                  │
│    - 运行迁移脚本 (如有)                   │
└─────┬────────────────────────────────────┘
      ↓
┌──────────────────────────────────────────┐
│ 6. 依赖更新 (Skills/MCP)                  │
│    - 检测 skills/ 目录变更                 │
│    - 自动 pnpm install                    │
│    - 下载新增 MCP 依赖                     │
└─────┬────────────────────────────────────┘
      ↓
┌──────────────────────────────────────────┐
│ 7. 重启应用                               │
│    - 保存当前会话状态                      │
│    - 优雅关闭进程                          │
│    - 启动新版本                            │
│    - 恢复会话                             │
└──────────────────────────────────────────┘
```

---

## 二、服务器端实现

### 2.1 阿里云 OSS 存储结构

```
openclawcn-updates/
├── releases/
│   ├── 2026.2.15/
│   │   ├── manifest.json              # 版本元数据
│   │   ├── full-package.tar.gz        # 完整安装包
│   │   ├── checksums.json             # 所有文件的SHA256
│   │   └── dist/                      # 解压后的文件树
│   │       ├── index.js
│   │       ├── gateway/
│   │       │   ├── server.js
│   │       │   └── cn-handlers.jsc    # 加密文件
│   │       └── ...
│   │
│   ├── 2026.2.20/
│   │   ├── manifest.json
│   │   ├── full-package.tar.gz
│   │   ├── checksums.json
│   │   ├── dist/
│   │   └── delta-from-2026.2.15/      # 增量包
│   │       ├── delta.json             # 变更清单
│   │       ├── added/                 # 新增文件
│   │       ├── modified/              # 修改文件
│   │       └── removed.json           # 删除文件列表
│   │
│   └── latest.json                    # 最新版本指针
│
├── skills-mirror/                     # Skills NPM 镜像
│   ├── @openclawcn-skill/
│   │   └── github-1.0.5.tgz
│   └── registry.json
│
└── mcp-binaries/                      # MCP Server 二进制
    ├── windows/
    │   ├── x64/
    │   └── arm64/
    ├── macos/
    └── linux/
```

### 2.2 版本元数据 (manifest.json)

```json
{
  "version": "2026.2.20",
  "buildTime": "2026-02-20T08:30:00Z",
  "gitCommit": "5d5babbe3",
  "nodeVersion": "22.12.0",
  "platform": {
    "windows": true,
    "macos": true,
    "linux": true
  },

  "files": {
    "total": 2847,
    "size": 125467890,
    "encrypted": {
      "bytecode": 23,
      "obfuscated": 156
    }
  },

  "changelog": {
    "zh-CN": "修复了 XX bug，新增了 YY 功能",
    "en-US": "Fixed XX bug, added YY feature"
  },

  "dependencies": {
    "npm": {
      "changed": ["@anthropic-ai/sdk@1.0.5"],
      "added": ["new-package@1.0.0"],
      "removed": ["old-package"]
    },
    "skills": {
      "updated": ["github", "jira"],
      "added": ["notion"]
    },
    "mcp": {
      "updated": ["filesystem"],
      "added": ["database"]
    }
  },

  "signatures": {
    "algorithm": "ed25519",
    "publicKey": "base64EncodedKey...",
    "signature": "base64Signature..."
  }
}
```

### 2.3 增量包生成算法

```typescript
// scripts/generate-delta-package.ts

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

interface DeltaManifest {
  fromVersion: string;
  toVersion: string;
  added: Array<{ path: string; sha256: string; size: number }>;
  modified: Array<{ path: string; sha256: string; size: number }>;
  removed: string[];
  totalSize: number;
}

async function generateDelta(
  fromDir: string,
  toDir: string,
  outputDir: string
): Promise<DeltaManifest> {
  const fromFiles = await scanDirectory(fromDir);
  const toFiles = await scanDirectory(toDir);

  const delta: DeltaManifest = {
    fromVersion: await readVersion(fromDir),
    toVersion: await readVersion(toDir),
    added: [],
    modified: [],
    removed: [],
    totalSize: 0,
  };

  // 1. 检测新增和修改的文件
  for (const [relPath, toHash] of toFiles) {
    const fromHash = fromFiles.get(relPath);

    if (!fromHash) {
      // 新增文件
      const srcPath = path.join(toDir, relPath);
      const dstPath = path.join(outputDir, "added", relPath);
      await fs.promises.mkdir(path.dirname(dstPath), { recursive: true });
      await fs.promises.copyFile(srcPath, dstPath);

      const size = (await fs.promises.stat(srcPath)).size;
      delta.added.push({ path: relPath, sha256: toHash, size });
      delta.totalSize += size;

    } else if (fromHash !== toHash) {
      // 修改的文件
      const srcPath = path.join(toDir, relPath);
      const dstPath = path.join(outputDir, "modified", relPath);
      await fs.promises.mkdir(path.dirname(dstPath), { recursive: true });
      await fs.promises.copyFile(srcPath, dstPath);

      const size = (await fs.promises.stat(srcPath)).size;
      delta.modified.push({ path: relPath, sha256: toHash, size });
      delta.totalSize += size;
    }
  }

  // 2. 检测删除的文件
  for (const [relPath] of fromFiles) {
    if (!toFiles.has(relPath)) {
      delta.removed.push(relPath);
    }
  }

  // 3. 写入增量清单
  await fs.promises.writeFile(
    path.join(outputDir, "delta.json"),
    JSON.stringify(delta, null, 2)
  );

  return delta;
}

async function scanDirectory(dir: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();

  async function walk(currentDir: string, prefix = "") {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.join(prefix, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath, relPath);
      } else {
        const hash = await hashFile(fullPath);
        files.set(relPath, hash);
      }
    }
  }

  await walk(dir);
  return files;
}

async function hashFile(filePath: string): Promise<string> {
  const hash = crypto.createHash("sha256");
  const stream = fs.createReadStream(filePath);

  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}
```

### 2.4 升级管理 API 服务

```typescript
// server/update-api.ts

import express from "express";
import { AliyunOSS } from "./aliyun-oss.js";
import { verifySignature } from "./crypto.js";

const app = express();
const oss = new AliyunOSS({
  region: "oss-cn-hangzhou",
  bucket: "openclawcn-updates",
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
});

// 1. 检查更新
app.get("/api/check-update", async (req, res) => {
  const currentVersion = req.query.version as string;
  const platform = req.query.platform as string;

  // 从 OSS 读取最新版本
  const latestManifest = await oss.getObject("releases/latest.json");
  const latest = JSON.parse(latestManifest.toString());

  if (latest.version === currentVersion) {
    return res.json({
      hasUpdate: false,
      current: currentVersion
    });
  }

  // 计算增量大小
  const deltaPath = `releases/${latest.version}/delta-from-${currentVersion}/delta.json`;
  let deltaSize = 0;

  try {
    const deltaManifest = await oss.getObject(deltaPath);
    const delta = JSON.parse(deltaManifest.toString());
    deltaSize = delta.totalSize;
  } catch (err) {
    // 没有增量包,需要下载完整包
    const fullManifest = await oss.getObject(`releases/${latest.version}/manifest.json`);
    deltaSize = JSON.parse(fullManifest.toString()).files.size;
  }

  res.json({
    hasUpdate: true,
    current: currentVersion,
    latest: latest.version,
    downloadSize: deltaSize,
    changelog: latest.changelog,
    releaseDate: latest.buildTime,
    critical: latest.critical || false,
  });
});

// 2. 计算增量
app.post("/api/compute-delta", async (req, res) => {
  const { fromVersion, toVersion } = req.body;

  const deltaPath = `releases/${toVersion}/delta-from-${fromVersion}/delta.json`;

  try {
    const deltaManifest = await oss.getObject(deltaPath);
    const delta = JSON.parse(deltaManifest.toString());

    // 生成签名 URL (1小时有效)
    const files = [];
    for (const file of [...delta.added, ...delta.modified]) {
      const objectKey = `releases/${toVersion}/delta-from-${fromVersion}/${
        delta.added.includes(file) ? "added" : "modified"
      }/${file.path}`;

      const url = await oss.signatureUrl(objectKey, { expires: 3600 });
      files.push({ ...file, url });
    }

    res.json({
      files,
      removed: delta.removed,
      totalSize: delta.totalSize,
    });

  } catch (err) {
    // 没有增量包,返回完整包
    const fullPackageUrl = await oss.signatureUrl(
      `releases/${toVersion}/full-package.tar.gz`,
      { expires: 3600 }
    );

    res.json({
      fullPackage: true,
      url: fullPackageUrl,
    });
  }
});

// 3. 下载依赖清单
app.get("/api/dependencies/:version", async (req, res) => {
  const { version } = req.params;
  const manifest = await oss.getObject(`releases/${version}/manifest.json`);
  const data = JSON.parse(manifest.toString());

  res.json({
    npm: data.dependencies.npm,
    skills: data.dependencies.skills,
    mcp: data.dependencies.mcp,
  });
});

// 4. Skills 镜像代理
app.get("/registry/:scope/:package/:version", async (req, res) => {
  const { scope, package: pkg, version } = req.params;
  const tarballPath = `skills-mirror/${scope}/${pkg}-${version}.tgz`;

  const stream = await oss.getStream(tarballPath);
  stream.pipe(res);
});

app.listen(3000, () => {
  console.log("Update API server running on :3000");
});
```

---

## 三、客户端实现

### 3.1 更新模块核心代码

```typescript
// src/infra/auto-updater.ts

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { download } from "./download.js";
import { applyDelta } from "./delta-applier.js";
import tar from "tar";

interface UpdateConfig {
  apiBaseUrl: string;
  checkInterval: number;  // 毫秒
  autoApply: boolean;     // 是否静默更新
  backupCount: number;    // 保留备份数量
}

export class AutoUpdater {
  private config: UpdateConfig;
  private currentVersion: string;
  private updateCheckTimer?: NodeJS.Timeout;

  constructor(config: UpdateConfig) {
    this.config = config;
    this.currentVersion = this.readLocalVersion();
  }

  async start(): Promise<void> {
    // 启动时检查一次
    await this.checkForUpdates();

    // 定时检查
    this.updateCheckTimer = setInterval(
      () => this.checkForUpdates(),
      this.config.checkInterval
    );
  }

  stop(): void {
    if (this.updateCheckTimer) {
      clearInterval(this.updateCheckTimer);
    }
  }

  private async checkForUpdates(): Promise<void> {
    try {
      const response = await fetch(
        `${this.config.apiBaseUrl}/api/check-update?` +
        `version=${this.currentVersion}&platform=${process.platform}`
      );

      const data = await response.json();

      if (!data.hasUpdate) {
        console.log("✓ 已是最新版本");
        return;
      }

      console.log(`🔔 发现新版本: ${data.latest}`);
      console.log(`   当前版本: ${this.currentVersion}`);
      console.log(`   下载大小: ${(data.downloadSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   更新日志: ${data.changelog["zh-CN"]}`);

      if (this.config.autoApply || data.critical) {
        await this.downloadAndApply(data);
      } else {
        // 通知用户,等待确认
        this.notifyUser(data);
      }

    } catch (err) {
      console.error("检查更新失败:", err);
    }
  }

  private async downloadAndApply(updateInfo: any): Promise<void> {
    const tempDir = path.join(process.cwd(), ".update-temp");
    await fs.promises.mkdir(tempDir, { recursive: true });

    try {
      // 1. 计算增量
      console.log("📦 计算增量包...");
      const deltaResponse = await fetch(
        `${this.config.apiBaseUrl}/api/compute-delta`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromVersion: this.currentVersion,
            toVersion: updateInfo.latest,
          }),
        }
      );

      const delta = await deltaResponse.json();

      // 2. 下载文件
      if (delta.fullPackage) {
        await this.downloadFullPackage(delta.url, tempDir);
      } else {
        await this.downloadDelta(delta, tempDir);
      }

      // 3. 备份当前版本
      console.log("💾 备份当前版本...");
      await this.backupCurrentVersion();

      // 4. 应用更新
      console.log("🔧 应用更新...");
      await applyDelta(tempDir, process.cwd(), delta);

      // 5. 更新依赖
      console.log("📥 更新依赖...");
      await this.updateDependencies(updateInfo.latest);

      // 6. 验证完整性
      console.log("🔍 验证完整性...");
      await this.verifyIntegrity(updateInfo.latest);

      // 7. 清理临时文件
      await fs.promises.rm(tempDir, { recursive: true, force: true });

      console.log("✅ 更新完成!将在重启后生效");

      // 8. 重启应用 (可选)
      if (this.config.autoApply) {
        this.restartApplication();
      }

    } catch (err) {
      console.error("❌ 更新失败:", err);
      console.log("🔄 正在回滚...");
      await this.rollback();
      throw err;
    }
  }

  private async downloadDelta(delta: any, tempDir: string): Promise<void> {
    const totalFiles = delta.files.length;
    let completed = 0;

    console.log(`⬇️  下载 ${totalFiles} 个变更文件...`);

    // 并发下载 (最多5个并发)
    const concurrency = 5;
    const chunks = [];
    for (let i = 0; i < delta.files.length; i += concurrency) {
      chunks.push(delta.files.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(async (file: any) => {
          const dstPath = path.join(tempDir, file.path);
          await fs.promises.mkdir(path.dirname(dstPath), { recursive: true });

          await download(file.url, dstPath, {
            onProgress: (percent) => {
              // 更新进度
            },
          });

          // 验证 SHA256
          const hash = await this.hashFile(dstPath);
          if (hash !== file.sha256) {
            throw new Error(`文件校验失败: ${file.path}`);
          }

          completed++;
          console.log(`  [${completed}/${totalFiles}] ${file.path}`);
        })
      );
    }
  }

  private async updateDependencies(version: string): Promise<void> {
    // 获取依赖清单
    const response = await fetch(
      `${this.config.apiBaseUrl}/api/dependencies/${version}`
    );
    const deps = await response.json();

    // 1. 更新 npm 依赖
    if (deps.npm.changed.length > 0 || deps.npm.added.length > 0) {
      console.log("  📦 更新 npm 包...");
      const { execa } = await import("execa");
      await execa("pnpm", ["install"], {
        stdio: "inherit",
      });
    }

    // 2. 更新 Skills
    if (deps.skills.updated.length > 0 || deps.skills.added.length > 0) {
      console.log("  🔌 更新 Skills...");
      for (const skill of [...deps.skills.updated, ...deps.skills.added]) {
        await this.installSkill(skill);
      }
    }

    // 3. 更新 MCP 二进制
    if (deps.mcp.updated.length > 0 || deps.mcp.added.length > 0) {
      console.log("  🛠️  更新 MCP 服务器...");
      for (const mcp of [...deps.mcp.updated, ...deps.mcp.added]) {
        await this.installMCPBinary(mcp);
      }
    }
  }

  private async installSkill(skillName: string): Promise<void> {
    const skillDir = path.join(process.cwd(), "skills", skillName);

    // 使用镜像源
    const npmrc = path.join(skillDir, ".npmrc");
    await fs.promises.writeFile(
      npmrc,
      `registry=${this.config.apiBaseUrl}/registry/\n`
    );

    const { execa } = await import("execa");
    await execa("pnpm", ["install"], {
      cwd: skillDir,
      stdio: "inherit",
    });
  }

  private async installMCPBinary(mcpName: string): Promise<void> {
    const platform = process.platform;
    const arch = process.arch;
    const binaryUrl = `${this.config.apiBaseUrl}/mcp-binaries/${platform}/${arch}/${mcpName}`;

    const dstPath = path.join(
      process.cwd(),
      "node_modules",
      ".bin",
      mcpName + (platform === "win32" ? ".exe" : "")
    );

    await download(binaryUrl, dstPath);

    // Unix: 添加执行权限
    if (platform !== "win32") {
      await fs.promises.chmod(dstPath, 0o755);
    }
  }

  private async backupCurrentVersion(): Promise<void> {
    const backupDir = path.join(process.cwd(), ".backups");
    await fs.promises.mkdir(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(
      backupDir,
      `backup-${this.currentVersion}-${timestamp}.tar.gz`
    );

    await tar.create(
      {
        gzip: true,
        file: backupPath,
        cwd: process.cwd(),
      },
      ["dist", "package.json", "skills"]
    );

    // 清理旧备份 (只保留最近N个)
    await this.cleanOldBackups(backupDir);
  }

  private async rollback(): Promise<void> {
    const backupDir = path.join(process.cwd(), ".backups");
    const backups = await fs.promises.readdir(backupDir);

    if (backups.length === 0) {
      throw new Error("没有可用的备份");
    }

    // 恢复最新的备份
    const latest = backups.sort().reverse()[0];
    const backupPath = path.join(backupDir, latest);

    await tar.extract({
      file: backupPath,
      cwd: process.cwd(),
    });

    console.log("✅ 已回滚到备份版本");
  }

  private async verifyIntegrity(version: string): Promise<void> {
    // 从服务器获取校验和文件
    const response = await fetch(
      `${this.config.apiBaseUrl}/releases/${version}/checksums.json`
    );
    const checksums = await response.json();

    // 验证关键文件
    for (const [filePath, expectedHash] of Object.entries(checksums)) {
      const fullPath = path.join(process.cwd(), filePath as string);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`缺少文件: ${filePath}`);
      }

      const actualHash = await this.hashFile(fullPath);
      if (actualHash !== expectedHash) {
        throw new Error(`文件校验失败: ${filePath}`);
      }
    }
  }

  private async hashFile(filePath: string): Promise<string> {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);

    return new Promise((resolve, reject) => {
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("end", () => resolve(hash.digest("hex")));
      stream.on("error", reject);
    });
  }

  private restartApplication(): void {
    console.log("🔄 重启应用...");

    // 保存状态
    this.saveState();

    // 重启进程
    const { spawn } = require("node:child_process");
    const args = process.argv.slice(1);
    const child = spawn(process.execPath, args, {
      detached: true,
      stdio: "ignore",
    });

    child.unref();
    process.exit(0);
  }

  private readLocalVersion(): string {
    const pkgPath = path.join(process.cwd(), "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    return pkg.version;
  }

  private notifyUser(updateInfo: any): void {
    // 通过 Web UI / 系统通知 / 托盘图标通知用户
    console.log("\n" + "=".repeat(50));
    console.log("🔔 发现新版本!");
    console.log("=".repeat(50));
    console.log(`版本: ${updateInfo.latest}`);
    console.log(`大小: ${(updateInfo.downloadSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`\n${updateInfo.changelog["zh-CN"]}`);
    console.log("\n运行 'openclawcn update' 安装更新");
    console.log("=".repeat(50) + "\n");
  }

  private saveState(): void {
    // 保存当前会话状态,重启后恢复
  }

  private async cleanOldBackups(backupDir: string): Promise<void> {
    const backups = await fs.promises.readdir(backupDir);
    const sorted = backups.sort().reverse();

    // 保留最近 N 个备份
    const toDelete = sorted.slice(this.config.backupCount);
    for (const backup of toDelete) {
      await fs.promises.unlink(path.join(backupDir, backup));
    }
  }
}
```

### 3.2 CLI 命令集成

```typescript
// src/cli/update-cli.ts

import { AutoUpdater } from "../infra/auto-updater.js";

export async function updateCommand(args: {
  check?: boolean;
  apply?: boolean;
  rollback?: boolean;
}) {
  const updater = new AutoUpdater({
    apiBaseUrl: process.env.UPDATE_SERVER_URL || "https://updates.openclawcn.com",
    checkInterval: 4 * 60 * 60 * 1000,  // 4小时
    autoApply: false,
    backupCount: 3,
  });

  if (args.check) {
    // 仅检查,不下载
    await updater.checkForUpdates();

  } else if (args.apply) {
    // 立即应用更新
    await updater.downloadAndApply();

  } else if (args.rollback) {
    // 回滚到上一个版本
    await updater.rollback();

  } else {
    // 默认:检查并询问用户
    await updater.checkForUpdates();
  }
}
```

---

## 四、加密文件处理

### 4.1 加密文件同步策略

```typescript
// src/infra/encrypted-files-sync.ts

export async function syncEncryptedFiles(
  deltaDir: string,
  targetDir: string
): Promise<void> {
  // 1. 识别加密文件 (.jsc)
  const jscFiles = await findFiles(deltaDir, "**/*.jsc");

  for (const jscFile of jscFiles) {
    const relativePath = path.relative(deltaDir, jscFile);
    const targetPath = path.join(targetDir, relativePath);

    // 2. 直接复制 .jsc 文件
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.promises.copyFile(jscFile, targetPath);

    // 3. 同时复制对应的加载器 .js
    const loaderSrc = jscFile.replace(/\.jsc$/, ".js");
    const loaderDst = targetPath.replace(/\.jsc$/, ".js");

    if (fs.existsSync(loaderSrc)) {
      await fs.promises.copyFile(loaderSrc, loaderDst);
    }
  }

  // 4. 验证加密文件完整性
  await verifyBytenodeFiles(targetDir);
}

async function verifyBytenodeFiles(dir: string): Promise<void> {
  const jscFiles = await findFiles(dir, "**/*.jsc");

  for (const jscFile of jscFiles) {
    const loaderFile = jscFile.replace(/\.jsc$/, ".js");

    if (!fs.existsSync(loaderFile)) {
      throw new Error(`缺少加载器: ${loaderFile}`);
    }

    // 检查加载器是否正确引用 .jsc
    const loaderCode = await fs.promises.readFile(loaderFile, "utf-8");
    const jscBasename = path.basename(jscFile);

    if (!loaderCode.includes(jscBasename)) {
      throw new Error(`加载器不匹配: ${loaderFile}`);
    }
  }
}
```

---

## 五、部署配置

### 5.1 阿里云 OSS 配置

```bash
# 创建 Bucket
aliyun oss mb oss://openclawcn-updates --region cn-hangzhou

# 配置 CORS (允许客户端直接下载)
cat > cors-config.json <<EOF
{
  "CORSRules": [{
    "AllowedOrigin": ["*"],
    "AllowedMethod": ["GET", "HEAD"],
    "AllowedHeader": ["*"],
    "MaxAgeSeconds": 3600
  }]
}
EOF

aliyun oss putBucketCors oss://openclawcn-updates --config cors-config.json

# 配置 CDN 加速
aliyun cdn AddDomain --domain updates.openclawcn.com \
  --sources '[{"content":"openclawcn-updates.oss-cn-hangzhou.aliyuncs.com","type":"oss"}]'
```

### 5.2 CI/CD 自动构建 (GitHub Actions)

```yaml
# .github/workflows/release.yml

name: Build and Publish Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install pnpm
        run: npm install -g pnpm@9

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build with encryption
        run: pnpm build:secure
        env:
          NODE_ENV: production

      - name: Generate checksums
        run: |
          cd dist
          find . -type f -exec sha256sum {} \; > ../checksums.json

      - name: Create full package
        run: |
          tar -czf full-package.tar.gz dist/ package.json skills/

      - name: Generate delta from previous version
        run: |
          node scripts/generate-delta-package.js \
            --from releases/2026.2.15 \
            --to dist/ \
            --output delta-from-2026.2.15/

      - name: Upload to Aliyun OSS
        uses: aliyun/oss-action@v1
        with:
          access-key-id: ${{ secrets.ALIYUN_ACCESS_KEY_ID }}
          access-key-secret: ${{ secrets.ALIYUN_ACCESS_KEY_SECRET }}
          bucket: openclawcn-updates
          endpoint: oss-cn-hangzhou.aliyuncs.com
          local-path: ./
          remote-path: releases/${{ github.ref_name }}/

      - name: Update latest.json
        run: |
          echo '{"version": "${{ github.ref_name }}", "buildTime": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' \
            | aliyun oss put oss://openclawcn-updates/releases/latest.json

      - name: Purge CDN cache
        run: |
          aliyun cdn RefreshObjectCaches \
            --objectPath https://updates.openclawcn.com/releases/latest.json
```

### 5.3 环境变量配置

```bash
# .env.production (服务器端)

# 阿里云 OSS
ALIYUN_ACCESS_KEY_ID=LTAI5t***********
ALIYUN_ACCESS_KEY_SECRET=***********
ALIYUN_OSS_REGION=oss-cn-hangzhou
ALIYUN_OSS_BUCKET=openclawcn-updates

# 签名密钥 (用于验证更新包完整性)
UPDATE_SIGNATURE_PUBLIC_KEY=ssh-ed25519 AAAAC3***********

# API 服务器
UPDATE_API_PORT=3000
UPDATE_API_HOST=0.0.0.0
```

```bash
# .env (客户端)

# 更新服务器 URL
UPDATE_SERVER_URL=https://updates.openclawcn.com

# 自动更新配置
AUTO_UPDATE_ENABLED=true
AUTO_UPDATE_CHECK_INTERVAL=14400000  # 4小时(毫秒)
AUTO_UPDATE_SILENT=false             # 静默更新
```

---

## 六、安全机制

### 6.1 数字签名验证

```typescript
// src/infra/signature-verify.ts

import { webcrypto } from "node:crypto";

const PUBLIC_KEY = `
-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...
-----END PUBLIC KEY-----
`;

export async function verifyPackageSignature(
  manifestPath: string
): Promise<boolean> {
  const manifest = JSON.parse(
    await fs.promises.readFile(manifestPath, "utf-8")
  );

  const { signature, algorithm } = manifest.signatures;

  // 导入公钥
  const publicKey = await webcrypto.subtle.importKey(
    "spki",
    Buffer.from(PUBLIC_KEY, "base64"),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"]
  );

  // 计算待验证的数据
  const dataToVerify = JSON.stringify({
    version: manifest.version,
    buildTime: manifest.buildTime,
    files: manifest.files,
  });

  // 验证签名
  const isValid = await webcrypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    Buffer.from(signature, "base64"),
    Buffer.from(dataToVerify)
  );

  if (!isValid) {
    throw new Error("更新包签名验证失败!");
  }

  return true;
}
```

### 6.2 TLS 证书固定 (Certificate Pinning)

```typescript
// src/infra/https-client.ts

import https from "node:https";

const PINNED_CERTIFICATES = [
  // SHA256 fingerprint of the server certificate
  "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
];

export function createSecureHttpsAgent(): https.Agent {
  return new https.Agent({
    checkServerIdentity: (hostname, cert) => {
      const fingerprint = crypto
        .createHash("sha256")
        .update(cert.raw)
        .digest("base64");

      const expected = `sha256/${fingerprint}`;
      if (!PINNED_CERTIFICATES.includes(expected)) {
        throw new Error(`证书固定验证失败: ${hostname}`);
      }
    },
  });
}
```

---

## 七、监控与日志

### 7.1 更新日志记录

```typescript
// src/infra/update-logger.ts

export class UpdateLogger {
  private logFile: string;

  constructor() {
    this.logFile = path.join(process.cwd(), "logs", "updates.log");
  }

  async log(event: string, data: any): Promise<void> {
    const entry = {
      timestamp: new Date().toISOString(),
      event,
      data,
    };

    await fs.promises.appendFile(
      this.logFile,
      JSON.stringify(entry) + "\n"
    );
  }

  async logUpdateStart(fromVersion: string, toVersion: string): Promise<void> {
    await this.log("update_start", { fromVersion, toVersion });
  }

  async logUpdateSuccess(version: string, duration: number): Promise<void> {
    await this.log("update_success", { version, duration });
  }

  async logUpdateFailed(error: Error): Promise<void> {
    await this.log("update_failed", {
      error: error.message,
      stack: error.stack
    });
  }

  async logRollback(reason: string): Promise<void> {
    await this.log("rollback", { reason });
  }
}
```

### 7.2 性能监控

```typescript
// src/infra/update-metrics.ts

interface UpdateMetrics {
  checkDuration: number;
  downloadDuration: number;
  applyDuration: number;
  totalDuration: number;
  downloadSize: number;
  downloadSpeed: number;  // bytes/sec
}

export async function recordMetrics(
  metrics: UpdateMetrics
): Promise<void> {
  // 发送到监控服务 (可选)
  await fetch("https://metrics.openclawcn.com/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...metrics,
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
    }),
  });
}
```

---

## 八、FAQ 与故障排查

### 8.1 常见问题

**Q: 更新失败后如何回滚?**

```bash
openclawcn update --rollback
```

**Q: 如何手动下载完整安装包?**

访问: https://updates.openclawcn.com/releases/latest.json
获取最新版本号,然后下载:
https://updates.openclawcn.com/releases/{version}/full-package.tar.gz

**Q: 如何禁用自动更新?**

```bash
# .env
AUTO_UPDATE_ENABLED=false
```

**Q: Skills 安装失败怎么办?**

```bash
# 手动清理并重装
rm -rf skills/*/node_modules
openclawcn update --apply
```

### 8.2 诊断工具

```bash
# 检查更新系统健康状态
openclawcn diagnose --updates

# 清理更新缓存
openclawcn update --clean-cache

# 验证文件完整性
openclawcn update --verify
```

---

## 九、实施路线图

### Phase 1: 基础设施 (Week 1-2)
- [x] 设计更新协议
- [ ] 搭建阿里云 OSS
- [ ] 部署更新 API 服务器
- [ ] 配置 CDN 加速

### Phase 2: 客户端开发 (Week 3-4)
- [ ] 实现 AutoUpdater 模块
- [ ] 增量下载与应用
- [ ] 加密文件同步
- [ ] CLI 命令集成

### Phase 3: CI/CD 集成 (Week 5)
- [ ] GitHub Actions 自动构建
- [ ] 增量包生成脚本
- [ ] 签名与验证
- [ ] 自动发布流程

### Phase 4: 测试与优化 (Week 6)
- [ ] 单元测试
- [ ] 集成测试
- [ ] 性能优化
- [ ] 故障恢复测试

### Phase 5: 上线与监控 (Week 7)
- [ ] Beta 测试
- [ ] 灰度发布
- [ ] 监控告警
- [ ] 文档完善

---

## 十、成本估算

### 阿里云费用 (按月)

| 项目 | 配置 | 费用 |
|------|------|------|
| ECS 服务器 (API) | 2核4G, 1Mbps | ¥70/月 |
| OSS 存储 | 100GB 标准存储 | ¥12/月 |
| OSS 流量 | 500GB/月 (CDN回源) | ¥250/月 |
| CDN 流量 | 5TB/月 (用户下载) | ¥1000/月 |
| **总计** | | **约 ¥1332/月** |

### 优化建议

1. **使用 OSS 生命周期规则**: 旧版本包自动归档到低频存储 (费用减半)
2. **缓存优化**: CDN 缓存时间延长到 7 天,减少回源流量
3. **按需压缩**: 增量包启用 Brotli 压缩,减少 30% 流量

---

## 附录

### A. 相关文档链接

- [阿里云 OSS 文档](https://help.aliyun.com/product/31815.html)
- [阿里云 CDN 文档](https://help.aliyun.com/product/27099.html)
- [bytenode 加密文档](https://github.com/bytenode/bytenode)

### B. 示例配置文件

完整配置示例见: `config/update-config.example.json`

### C. API 接口文档

完整 API 文档见: `docs/update-api.md`

---

**文档版本**: 1.0
**最后更新**: 2026-02-18
**作者**: Claude (OpenClawCN Team)
