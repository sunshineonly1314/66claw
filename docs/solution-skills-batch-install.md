# 方案设计：Skills 一键批量安装（v4 — 基于现有工程）

> 文档版本: 4.0
> 核心原则: **不重复造轮子，在现有 2300 行安装引擎上加"批量编排层"**
> 成本原则: **白嫖公共镜像为主，自有服务器兜底为辅，月成本 < 30 元**

---

## 〇、现有工程基础盘点

在设计之前，先明确现有代码**已经能做什么**，避免重复建设。

### 已有能力（直接复用，不重写）

| 能力 | 所在位置 | 状态 |
|------|---------|------|
| 单 Skill 安装引擎 | `skills-install.ts` `installSkill()` | 生产级，2300+ 行 |
| 5 种安装类型 | `SkillInstallSpec.kind`: brew/node/go/uv/download | 完整覆盖 |
| npm 三源镜像回退 | `installNodePackageWithFallback()` + npmmirror/腾讯/华为 | 已上线 |
| Go 镜像注入 | `getGoProxyEnv()` → GOPROXY=goproxy.cn | 已上线 |
| PyPI 镜像注入 | `--index-url` 清华/阿里/中科大 | 已上线 |
| GitHub 代理下载 | `BINARY_DOWNLOAD_MIRRORS.github` → ghproxy.cn | 已上线 |
| 通用镜像回退框架 | `runCommandWithMirrorFallback()` | 已上线 |
| 缺失运行时自动安装 | `installGoDependency()` / `installNodeDependency()` / `installUvDependency()` | 已上线 |
| 香港预编译二进制服务器 | `installFromHKBinaryServer()` → `43.129.194.117:8888` | 已上线，10 个工具 |
| 文件下载 + 进度回调 | `downloadFile()` + `SkillInstallProgressCallback` | 已上线 |
| SHA256 校验 | HK binary server `.sha256` 验证 | 已上线 |
| 压缩包解压 | `extractArchive()` tar.gz/zip/tar.bz2 | 已上线 |
| 中国区自动检测 | `shouldUseCNMirror()` 时区+环境变量 | 已上线 |
| 友好中文错误信息 | `getFriendlyErrorMessage()` 20+ 种 | 已上线 |
| Windows 包管理器搜索 | `findNodePackageManager()` 6 个路径 | 已上线 |
| SSRF 安全校验 | `validateUrlForSsrf()` | 已上线 |
| 平台 OS 过滤 | `SkillInstallSpec.os` + 自动跳过不兼容 | 已上线 |

### 真正需要新建的（本方案聚焦点）

| Gap | 说明 | 工作量 |
|-----|------|--------|
| **BatchInstallOrchestrator** | 在现有 `installSkill()` 上层封装并发编排 | 2 天 |
| **WebSocket 实时事件推送** | 现有 RPC 是同步等结果，需要改为事件流 | 1 天 |
| **4 个新 RPC 方法** | batch-check/install/status/cancel | 1 天 |
| **批次状态持久化** | install-state.json，支持断线恢复 | 0.5 天 |
| **UI 5 屏引导流程** | Banner → 确认 → 进度 → 结果 → 完成 | 3 天 |
| **HK 二进制服务器扩展** | 覆盖更多工具 + 迁移到阿里云轻量服务器 | 1 天 |

**总计: ~8.5 天**（比 v3 方案的 10 天少，因为不重写引擎）

---

## 一、架构：在现有引擎上加编排层

```
                        ┌─ 新增部分 ─────────────────────┐
                        │                                 │
UI (Lit)                │   BatchInstallOrchestrator      │
  [Banner]──→[确认]──→  │     │                           │
  [进度] ←── WebSocket  │     │  并发控制 (semaphore=3)    │
  [结果/完成]            │     │  状态持久化               │
                        │     │  事件聚合                  │
                        │     ▼                           │
                        └─────┬───────────────────────────┘
                              │
                              │ 调用现有函数，不修改
                              ▼
                ┌─ 现有代码（不动） ──────────────────────┐
                │                                         │
                │  installSkill(params)                   │
                │    ├─ kind=brew  → brew install         │
                │    ├─ kind=node  → npm -g + 三源回退     │
                │    ├─ kind=go    → go install + GOPROXY │
                │    ├─ kind=uv    → uv tool install      │
                │    └─ kind=download → downloadFile()     │
                │                                         │
                │  自动依赖安装:                            │
                │    ├─ 没有 Go?  → installGoDependency() │
                │    ├─ 没有 Node? → installNodeDep()     │
                │    └─ 没有 uv?  → installUvDep()        │
                │                                         │
                │  镜像系统:                               │
                │    ├─ cn-mirrors.ts (npm/go/pip/github)  │
                │    ├─ runCommandWithMirrorFallback()     │
                │    └─ installFromHKBinaryServer()        │
                │                                         │
                └─────────────────────────────────────────┘
```

**核心设计原则：BatchInstallOrchestrator 只做编排，不碰安装逻辑。**

---

## 二、BatchInstallOrchestrator 实现

### 2.1 职责边界

| 它负责 | 它不负责（复用现有代码） |
|-------|---------------------|
| 哪些 Skill 需要装 | 怎么装一个 Skill（`installSkill()`） |
| 同时装几个（并发控制） | 镜像选择和回退（`runCommandWithMirrorFallback()`） |
| 聚合总进度并推送 WebSocket | 单文件下载进度（`downloadFile()`） |
| 持久化批次状态 | 检测缺失依赖（`skills-status.ts`） |
| 失败重试和跳过 | 具体错误处理（`getFriendlyErrorMessage()`） |

### 2.2 核心代码

```typescript
// src/gateway/batch-install.ts (新文件)

import { installSkill } from '../agents/skills-install';
import { buildWorkspaceSkillStatus } from '../agents/skills-status';
import { getSkillInstallApprovalManager } from './server-methods/skill-install-approval';

type BatchPhase = 'idle' | 'downloading' | 'completed' | 'interrupted';

interface BatchState {
  batchId: string;
  phase: BatchPhase;
  skills: BatchSkillState[];
  startedAt: number;
  completedAt?: number;
}

interface BatchSkillState {
  name: string;
  installId: string;
  stage: 'queued' | 'installing' | 'done' | 'failed';
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export class BatchInstallOrchestrator {
  private activeBatch: BatchState | null = null;
  private abortController: AbortController | null = null;
  private readonly concurrency: number = 3;

  constructor(
    private readonly pushEvent: (event: any) => void,
    private readonly statePath: string, // ~/.clawdbot/install-state.json
  ) {
    this.restoreState();
  }

  /** 检查哪些 Skill 需要安装 */
  async check(workspaceDir: string, config: any): Promise<BatchCheckResult> {
    // 复用现有 skills-status.ts 的检测逻辑
    const report = await buildWorkspaceSkillStatus(workspaceDir, config);

    const missing = report.skills.filter(s =>
      !s.eligible
      && s.missing.bins.length > 0
      && s.incompatibleReason?.kind !== 'os'  // 排除跨平台不兼容的
    );

    // 为每个 missing skill 选一个 installSpec
    // 注意：SkillStatusEntry 的字段是 .install（不是 .installOptions）
    const installable = missing
      .filter(s => s.install && s.install.length > 0)
      .map(s => ({
        name: s.name,
        emoji: s.emoji,
        installId: s.install[0].id,         // 用现有的 selectPreferredInstallSpec 逻辑
        installKind: s.install[0].kind,
        description_zh: s.description || s.name,
      }));

    return {
      missing: installable,
      total_count: installable.length,
      // 注意：预估大小和耗时是粗估，因为 brew/go/npm 无法精确预知
      estimated_seconds: installable.length * 8,  // 粗估每个 8 秒
    };
  }

  /** 启动批量安装 */
  async start(
    workspaceDir: string,
    config: any,
    skills?: string[],
  ): Promise<{ batchId: string }> {
    if (this.activeBatch?.phase === 'downloading') {
      throw new Error('ALREADY_INSTALLING');
    }

    const checkResult = await this.check(workspaceDir, config);
    const toInstall = skills
      ? checkResult.missing.filter(s => skills.includes(s.name))
      : checkResult.missing;

    const batchId = crypto.randomUUID();
    this.abortController = new AbortController();

    this.activeBatch = {
      batchId,
      phase: 'downloading',
      skills: toInstall.map(s => ({
        name: s.name,
        installId: s.installId,
        stage: 'queued',
      })),
      startedAt: Date.now(),
    };
    this.persistState();

    // 启动后台安装，不阻塞 RPC 返回
    this.runBatch(workspaceDir, config).catch(() => {});

    return { batchId };
  }

  /** 并发执行批量安装 */
  private async runBatch(workspaceDir: string, config: any): Promise<void> {
    const queue = [...this.activeBatch!.skills];
    const running = new Set<Promise<void>>();
    let completed = 0;
    const total = queue.length;

    const runOne = async (skill: BatchSkillState): Promise<void> => {
      if (this.abortController?.signal.aborted) return;

      // 互斥保护：跳过正在被单 Skill 审批流安装的
      const approvalManager = getSkillInstallApprovalManager();
      if (approvalManager.isSkillPendingOrInstalling(skill.name)) {
        skill.stage = 'done';  // 视为已完成（别人在装）
        skill.completedAt = Date.now();
        completed++;
        this.pushBatchProgress(completed, total);
        this.persistState();
        return;
      }

      skill.stage = 'installing';
      skill.startedAt = Date.now();
      this.pushSkillEvent(skill, 'installing');

      try {
        // ══════════════════════════════════════════════
        // 核心：直接调用现有的 installSkill()
        // 不修改它，不重写它，只调用它
        // ══════════════════════════════════════════════
        const result = await installSkill({
          workspaceDir,
          skillName: skill.name,
          installId: skill.installId,
          timeoutMs: 120_000,
          config,
          onProgress: (progress) => {
            // 把现有的单 Skill 进度回调 → 转换为 WebSocket 事件
            this.pushEvent({
              type: 'skill.batch.progress',
              batch_id: this.activeBatch!.batchId,
              skill: skill.name,
              stage: progress.stage,
              message: progress.message,
              percent: progress.percent,
              mirror: progress.usingCNMirror ? 'cn-mirror' : 'direct',
            });
          },
        });

        if (result.ok) {
          skill.stage = 'done';
          skill.completedAt = Date.now();
        } else {
          skill.stage = 'failed';
          skill.error = result.message || 'unknown error';
        }
      } catch (err) {
        skill.stage = 'failed';
        skill.error = err instanceof Error ? err.message : String(err);
      }

      completed++;
      this.pushSkillEvent(skill, skill.stage);
      this.pushBatchProgress(completed, total);
      this.persistState();
    };

    // ── 信号量并发控制 ──
    for (const skill of queue) {
      if (this.abortController?.signal.aborted) break;

      const promise = runOne(skill).then(() => {
        running.delete(promise);
      });
      running.add(promise);

      // 控制并发数
      if (running.size >= this.concurrency) {
        await Promise.race(running);
      }
    }

    // 等待所有剩余任务完成
    await Promise.all(running);

    // 标记批次完成
    this.activeBatch!.phase = 'completed';
    this.activeBatch!.completedAt = Date.now();
    this.persistState();

    // 推送完成事件
    const succeeded = this.activeBatch!.skills.filter(s => s.stage === 'done').map(s => s.name);
    const failed = this.activeBatch!.skills.filter(s => s.stage === 'failed').map(s => ({
      skill: s.name,
      error: s.error || 'unknown',
    }));

    this.pushEvent({
      type: 'skill.batch.complete',
      batch_id: this.activeBatch!.batchId,
      succeeded,
      failed,
      duration_ms: Date.now() - this.activeBatch!.startedAt,
    });
  }

  /** 取消 */
  cancel(): { completed: string[]; cancelled: string[] } {
    if (!this.activeBatch || this.activeBatch.phase !== 'downloading') {
      throw new Error('NO_ACTIVE_BATCH');
    }
    this.abortController?.abort();
    const completed = this.activeBatch.skills.filter(s => s.stage === 'done').map(s => s.name);
    const cancelled = this.activeBatch.skills.filter(s => s.stage !== 'done').map(s => s.name);
    this.activeBatch.phase = 'interrupted';
    this.persistState();
    return { completed, cancelled };
  }

  /** 查询状态（断线恢复用） */
  getStatus(): BatchStatusResponse {
    if (!this.activeBatch || this.activeBatch.phase === 'idle') {
      return { active: false };
    }
    return {
      active: this.activeBatch.phase === 'downloading',
      batch_id: this.activeBatch.batchId,
      phase: this.activeBatch.phase,
      skills: this.activeBatch.skills.map(s => ({ name: s.name, stage: s.stage })),
      result: this.activeBatch.phase === 'completed' ? {
        succeeded: this.activeBatch.skills.filter(s => s.stage === 'done').map(s => s.name),
        failed: this.activeBatch.skills.filter(s => s.stage === 'failed').map(s => ({ skill: s.name, error: s.error! })),
        duration_ms: (this.activeBatch.completedAt || Date.now()) - this.activeBatch.startedAt,
      } : undefined,
    };
  }

  // ── 内部方法 ──

  private pushSkillEvent(skill: BatchSkillState, stage: string) {
    this.pushEvent({
      type: 'skill.batch.progress',
      batch_id: this.activeBatch!.batchId,
      skill: skill.name,
      stage,
      error: skill.error,
    });
  }

  private pushBatchProgress(completed: number, total: number) {
    this.pushEvent({
      type: 'skill.batch.overall',
      batch_id: this.activeBatch!.batchId,
      completed,
      total,
    });
  }

  private persistState() {
    try {
      writeFileSync(this.statePath, JSON.stringify(this.activeBatch, null, 2));
    } catch { /* 静默失败 */ }
  }

  private restoreState() {
    try {
      if (existsSync(this.statePath)) {
        const data = JSON.parse(readFileSync(this.statePath, 'utf-8'));
        if (data?.phase === 'downloading') {
          data.phase = 'interrupted';  // 上次未完成
          this.activeBatch = data;
        }
      }
    } catch { /* 静默 */ }
  }
}
```

### 2.3 关键设计点

**为什么不改 `installSkill()`？**

```
现有 installSkill() 已经处理了：
  ✅ 5 种安装类型的命令构建
  ✅ npm/go/pip 三源镜像回退
  ✅ 缺失运行时自动安装（Go/Node/uv）
  ✅ HK 预编译二进制服务器回退
  ✅ SHA256 校验
  ✅ Windows 路径搜索
  ✅ 20+ 种中文错误信息
  ✅ 进度回调 (onProgress)
  ✅ 超时控制

改它 = 回归测试噩梦
不改它 = 零风险复用
```

BatchInstallOrchestrator 唯一做的就是：
1. **循环调用** `installSkill()`（加并发控制）
2. **收集** 每次调用的进度回调 → 聚合推送到 WebSocket
3. **记录** 每个 Skill 的成功/失败 → 持久化

**已知限制：取消操作的粒度**

现有 `installSkill()` 接受 `timeoutMs` 但 **不接受 `AbortSignal`**。
因此 `cancel()` 的实际效果是：
- **不启动新的 Skill**（队列中 `queued` 状态的跳过）
- **已经在跑的 Skill 无法中止**（会继续运行直到完成或超时）

这是可接受的折中——单个 Skill 安装通常 5~30 秒，等它自然结束即可。
未来如需精细取消，可以给 `installSkill()` 加 `AbortSignal` 参数（改动量小，向后兼容）。

---

## 三、镜像策略：复用现有 + 扩展兜底服务器

### 3.1 核心事实：国内用户无法访问 GitHub

GitHub 在中国大陆 **基本不可用**（DNS 污染 + TCP RST），不能作为任何层级的回退。
所有涉及 GitHub 的环节必须 100% 走镜像/自建，**包括服务器端**。

### 3.2 现有镜像体系（不动，直接复用）

```
cn-mirrors.ts 已经配置的：

npm:     npmmirror → 腾讯云 → 华为云         (✅ 已有三源回退，纯国内)
Go:      goproxy.cn → aliyun → goproxy.io    (✅ 已有 GOPROXY 注入，纯国内)
PyPI:    清华 → 阿里 → 中科大                 (✅ 已有 --index-url，纯国内)
GitHub:  ghproxy.cn                           (⚠️ 只有 1 源，不够稳，且本质是境外代理)
HK 服务器: 43.129.194.117:8888               (⚠️ 只覆盖 10 个工具)
```

npm / Go / PyPI 三条通道 **完全走国内高校或大厂镜像，不经过 GitHub**，已经很稳。

**真正的短板**：`brew` 类 / `download` 类 Skill 依赖的二进制文件，原始源在 GitHub Release。
这部分必须通过 **公共代理（境外中转）** 或 **自建服务器（直接托管文件）** 解决。

### 3.3 扩展方案：两层，不涉及 GitHub 直连

```
┌─ 现有（有问题）─────────────────────────────────────────┐
│                                                          │
│  GitHub 代理:  ghproxy.cn (唯一一个，不稳)                │
│  HK 二进制:    43.129.194.117:8888 (只 10 个工具)        │
│  兜底:         ❌ 直连 GitHub（中国不通）                  │
│                                                          │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼ 改为
┌─ 扩展后 ─────────────────────────────────────────────────┐
│                                                           │
│  Layer 1: 公共代理 + HK 服务器（白嫖/低成本，承担主流量）   │
│    ├─ ghproxy.cn   (现有，境外中转)                        │
│    ├─ gh-proxy.com (新增，境外中转)                        │
│    ├─ ghfast.top   (新增，境外中转)                        │
│    └─ HK 服务器    (现有，直接托管二进制)                   │
│                                                           │
│  Layer 2: 阿里云轻量服务器（终极兜底，直接托管文件）        │
│    └─ skills.tecbinai.com                                 │
│       ├─ /bins/*       → 本地静态文件（CI 预先上传）       │
│       ├─ /manifest.json → 本地静态文件                     │
│       ├─ /api/report   → 接收失败上报                     │
│       └─ 覆盖所有工具二进制                                │
│                                                           │
│  ❌ 没有 Layer 3，不存在 GitHub 直连                       │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

**关键区别**：
- **Layer 2 不是 nginx 反代 GitHub**（阿里云服务器自己也连不上 GitHub）
- **Layer 2 是直接托管文件**：CI 构建时把二进制文件 scp 到服务器，nginx 直接 serve 静态文件
- **彻底不依赖 GitHub 可达性**

### 3.4 修改点：扩展 cn-mirrors.ts

```typescript
// src/config/cn-mirrors.ts 修改

export const BINARY_DOWNLOAD_MIRRORS = {
  github: {
    // Layer 1: 公共代理（境外中转，免费，90%+ 场景能用）
    primary: "https://ghproxy.cn",           // 现有
    fallback: "https://gh-proxy.com",        // 新增
    tertiary: "https://ghfast.top",          // 新增
    // Layer 2: 自建服务器（国内直接托管，终极兜底）
    safety_net: "https://skills.tecbinai.com/bins",  // 新增
    // ❌ 没有 GitHub 直连 fallback
  },
  // ... 其他不变
};
```

**注意 `safety_net` 的 URL 格式不同**：
- 公共代理格式：`https://ghproxy.cn/https://github.com/{owner}/{repo}/releases/download/{tag}/{file}`
- 自建服务器格式：`https://skills.tecbinai.com/bins/{skill}/{platform}/{file}`

需要在 `installFromHKBinaryServer()` 或新增的下载函数中处理 URL 映射。

### 3.5 兜底服务器（阿里云轻量）— 直接托管，不反代

```
服务器: 阿里云轻量应用服务器 2C2G / 24 元/月
域名:   skills.tecbinai.com
功能:
  /bins/{skill}/{platform}/{file}  → 本地静态文件（CI 上传）
  /manifest.json                    → 本地静态文件
  /manifest.sig                     → 签名文件
  /api/report                       → 接收失败上报
```

#### 目录结构（服务器端）

```
/data/skills/
├── manifest.json
├── manifest.sig
├── bins/
│   ├── gog/
│   │   ├── darwin-arm64/gogcli-1.2.0.tar.gz
│   │   ├── darwin-x64/gogcli-1.2.0.tar.gz
│   │   ├── linux-x64/gogcli-1.2.0.tar.gz
│   │   └── win32-x64/gogcli-1.2.0.zip
│   ├── summarize/
│   │   ├── darwin-arm64/summarize-0.9.0.tar.gz
│   │   └── ...
│   ├── sag/
│   ├── oracle/        ← Node 打包的独立二进制
│   ├── blogwatcher/   ← Go 交叉编译的二进制
│   └── ...
```

#### nginx 配置

```nginx
server {
    listen 443 ssl http2;
    server_name skills.tecbinai.com;

    ssl_certificate     /etc/letsencrypt/live/skills.tecbinai.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/skills.tecbinai.com/privkey.pem;

    # ── 二进制文件：纯静态，直接从磁盘 serve ──
    location /bins/ {
        root /data/skills;
        autoindex off;
        add_header Cache-Control "public, max-age=604800";  # 7 天缓存
        add_header Access-Control-Allow-Origin "*";

        # 限速：单连接 2MB/s，防单用户打爆 3Mbps 带宽
        limit_rate 2m;
    }

    # ── Manifest（CI 推送更新） ──
    location = /manifest.json {
        root /data/skills;
        add_header Cache-Control "public, max-age=300";  # 5 分钟缓存
        add_header Access-Control-Allow-Origin "*";
    }

    location = /manifest.sig {
        root /data/skills;
        add_header Cache-Control "public, max-age=300";
    }

    # ── 失败上报 ──
    location /api/report {
        limit_req zone=report burst=5 nodelay;
        # 简单方案：写到日志文件，运维定期看
        access_log /var/log/nginx/skill-reports.log;
        return 200 '{"ok":true,"message_zh":"已收到，感谢反馈"}';
        add_header Content-Type application/json;
    }

    # ── 健康检查 ──
    location /health {
        return 200 '{"ok":true}';
        add_header Content-Type application/json;
    }
}
```

**与 v4 旧方案的关键区别**：
- **没有 `proxy_pass https://github.com/`** — 因为国内服务器自己也连不上
- **纯静态文件 serve** — nginx 直接从 `/data/skills/bins/` 读磁盘，零网络依赖
- **CI 负责上传** — 二进制文件由 CI（在境外 GitHub Actions）构建后 scp 到服务器

#### CI 上传流程

```yaml
# .github/workflows/upload-skills-bins.yml
# 运行在 GitHub Actions（境外），可以访问 GitHub Release

name: Upload Skills Binaries

on:
  push:
    paths: ['skills/*/SKILL.md']
  schedule:
    - cron: '0 4 * * 1'  # 每周一凌晨检查上游版本

jobs:
  upload:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # 1. 从 GitHub Release / go build / npm pkg 构建二进制
      - name: Build all skill binaries
        run: node scripts/build-skill-binaries.js

      # 2. 生成 manifest + 签名
      - name: Build and sign manifest
        run: |
          node scripts/build-manifest.js
          node scripts/sign-manifest.js

      # 3. 上传到阿里云服务器（SSH）
      - name: Upload to China server
        run: |
          rsync -avz --delete \
            ./dist/bins/ \
            deploy@skills.tecbinai.com:/data/skills/bins/
          scp manifest.json manifest.sig \
            deploy@skills.tecbinai.com:/data/skills/
```

#### 磁盘空间计算

```
单用户单次下载: ~100MB（当前平台可用的 ~18 个 Skill）
服务器需存储全部平台: ~1.3GB（5 个平台 × 30 个工具）
阿里云轻量 40GB SSD → 1.3GB 占 3.25%，完全够用
```

#### 流量计算

```
Layer 1 公共代理成功率: ~90%
需要走 Layer 2 兜底的用户: ~10%

500 用户/月:
  走兜底: 50 人 × 100MB = 5GB
  200GB 配额用了 2.5%

2000 用户/月:
  走兜底: 200 人 × 100MB = 20GB
  200GB 配额用了 10%

月成本: 24 元固定，到 2000 用户无需升配

⚠️ 极端场景：公共代理集体失效
  所有流量走 Layer 2: 500 人 × 100MB = 50GB（200GB 配额的 25%）
  2000 人全走兜底: 200GB，刚好打满配额
  → 建议：监控月流量，超过 150GB 时告警，考虑临时升配或增加公共代理源
```

### 3.6 现有 HK 服务器的处理

**保留 HK 服务器 `43.129.194.117`，放在 Layer 1 中**：

```typescript
// 二进制下载镜像链（按优先级）
const binaryMirrors = [
  // Layer 1-a: 公共 GitHub 代理（免费，境外中转）
  { name: 'ghproxy',    rewrite: (url) => `https://ghproxy.cn/${url}` },
  { name: 'gh-proxy',   rewrite: (url) => `https://gh-proxy.com/${url}` },
  { name: 'ghfast',     rewrite: (url) => `https://ghfast.top/${url}` },

  // Layer 1-b: 现有 HK 二进制服务器（已有 10 个工具）
  { name: 'hk-server',  rewrite: (url, skill) => getHKBinaryUrl(skill) },

  // Layer 2: 阿里云兜底（国内直接托管，终极保障）
  { name: 'tecbinai',   rewrite: (url, skill, platform) =>
      `https://skills.tecbinai.com/bins/${skill}/${platform}/${filename(url)}` },

  // ❌ 没有 GitHub 直连
];
```

HK 服务器继续运行，逐步把覆盖范围从 10 个工具扩展到全部。
阿里云服务器作为终极兜底，覆盖全部工具。两者并行，不冲突。

---

## 四、RPC 方法 + WebSocket 事件

### 4.0 与现有 skill.install.* 事件体系的关系

现有代码中**已经有一套完整的单 Skill 安装事件体系**（`skill-install-approval.ts` + `skill-install.ts`），必须明确两者关系：

#### 现有体系（保留不动）

| 事件 | 触发者 | 用途 |
|------|--------|------|
| `skill.install.requested` | Agent（检测到缺失） | 弹出审批弹窗，用户确认后安装 |
| `skill.install.resolved` | UI（用户点击安装/拒绝） | 告知后端用户决策 |
| `skill.install.progress` | 后端（安装进行中） | 单 Skill 进度展示（stage/percent/downloadInfo/usingCNMirror） |
| `skill.install.cancelled` | UI（用户取消） | 清除安装请求 |

**触发场景**：用户与 Agent 对话时，Agent 自动检测缺失 Skill 并发起审批流程。是**被动发现、逐个安装**。

#### 新增体系（批量安装）

| 事件 | 触发者 | 用途 |
|------|--------|------|
| `skill.batch.progress` | 后端（BatchInstallOrchestrator） | 单个 Skill 在批次中的进度 |
| `skill.batch.overall` | 后端 | 批次总体进度（completed/total） |
| `skill.batch.complete` | 后端 | 整个批次完成（succeeded/failed 汇总） |

**触发场景**：用户进入 Chat 页，Banner 提示缺失 Skill，用户主动点击"一键安装"。是**主动发起、批量安装**。

#### 设计决策

```
两套事件并行，互不干扰：

1. 命名空间隔离
   - 单 Skill 审批流：skill.install.*（现有，不改）
   - 批量安装流：    skill.batch.*（新增）

2. UI 状态隔离
   - 现有：skillInstallQueue + skillInstallProgress（单 Skill 用）
   - 新增：batchPhase + batchSkills + batchProgress（批量用）

3. 复用点
   - 后端：两者最终都调用 installSkill()，安装逻辑 100% 复用
   - 前端：SkillInstallProgress 类型可以被 batch 进度组件参考
          （stage/percent/downloadInfo/usingCNMirror 等字段定义一致）
   - 广播：两者都使用 createGatewayBroadcaster() 的 broadcast 函数

4. 互斥保护
   - 如果某个 Skill 正在被 batch 安装，skill.install.request 应拒绝
   - 如果某个 Skill 正在被单独审批安装，batch 应跳过该 Skill
   - 通过查询 SkillInstallApprovalManager.isSkillPendingOrInstalling() 实现
```

### 4.1 新增 4 个 Gateway RPC

```typescript
// src/gateway/server-methods/skills.ts 中新增

// 1. 检查缺失（复用 skills-status.ts）
{ name: 'skills.batch-check',
  handler: (ctx, params) => orchestrator.check(workspaceDir, config) }

// 2. 启动批量安装
{ name: 'skills.batch-install',
  handler: (ctx, params) => orchestrator.start(workspaceDir, config, params?.skills) }

// 3. 查询状态（断线恢复）
{ name: 'skills.batch-status',
  handler: (ctx) => orchestrator.getStatus() }

// 4. 取消
{ name: 'skills.batch-cancel',
  handler: (ctx, params) => orchestrator.cancel() }
```

**上报复用现有 HTTP endpoint 或加到兜底服务器**，不需要额外 RPC。

### 4.2 WebSocket 事件（3 种，统一 `skill.batch.*` 前缀）

```typescript
// Gateway → UI
// 注意：使用 skill.batch.* 前缀，与现有 skill.install.* 隔离

// 单 Skill 在批次中的进度（来自 installSkill 的 onProgress 回调）
{ type: 'skill.batch.progress', batch_id, skill, stage, message, percent, mirror }

// 批次总体进度
{ type: 'skill.batch.overall', batch_id, completed, total }

// 整个批次完成
{ type: 'skill.batch.complete', batch_id, succeeded, failed, duration_ms }
```

### 4.3 事件推送接入

现有 Gateway 已有 WebSocket event 机制（`ui/src/ui/gateway.ts` 的 `event` frame type）。

广播函数由 `createGatewayBroadcaster()` 创建（`server-broadcast.ts`），签名为：
```typescript
broadcast(event: string, payload: unknown, opts?: { dropIfSlow?: boolean })
```

在 `BatchInstallOrchestrator` 构造时注入 `broadcast` 引用：

```typescript
// src/gateway/server.impl.ts 中初始化
// broadcast 来自 createGatewayBroadcaster()，已在 runtime state 中
const orchestrator = new BatchInstallOrchestrator(
  (event) => broadcast(event.type, event, { dropIfSlow: true }),  // 复用现有广播机制
  path.join(stateDir, 'install-state.json'),
);
```

> 注：现有单 Skill 安装在 RPC handler 内使用 `context.broadcast()`，
> BatchInstallOrchestrator 因为是异步后台任务（不在 RPC handler 内），
> 需要直接持有 `broadcast` 函数引用。两种方式最终调用同一个广播器。

---

## 五、UI 流程（5 个 Screen）

UI 流程设计**不变**（PRD v1 的 5 屏设计是好的），但实现方式基于现有 Lit 组件模式。

### 5.1 状态机

```typescript
// ui/src/ui/app-view-state.ts 扩展

type BatchInstallPhase = 'idle' | 'banner' | 'confirm' | 'progress' | 'result' | 'complete';

// 新增到 AppViewState
batchPhase: BatchInstallPhase;
batchSkills: { name: string; emoji: string; stage: string; error?: string }[];
batchProgress: { completed: number; total: number };
batchResult?: { succeeded: string[]; failed: { skill: string; error: string }[]; duration_ms: number };
```

### 5.2 事件处理

```typescript
// ui/src/ui/app-gateway.ts 扩展 handleGatewayEventUnsafe()
// 新增 skill.batch.* 事件处理（在现有 skill.install.* 处理之后）

if (evt.event === 'skill.batch.progress') {
  // 更新批次中单个 skill 的 stage
  updateBatchSkillStage(host, evt.payload);
  return;
}

if (evt.event === 'skill.batch.overall') {
  host.batchProgress = evt.payload;
  return;
}

if (evt.event === 'skill.batch.complete') {
  host.batchResult = evt.payload;
  host.batchPhase = evt.payload.failed.length > 0 ? 'result' : 'complete';
  return;
}
```

### 5.3 重连恢复

```typescript
// ui/src/ui/app-gateway.ts 的 onHello 中增加

const batchStatus = await client.request('skills.batch-status');
if (batchStatus.active) {
  state.batchPhase = 'progress';
  state.batchSkills = batchStatus.skills;
} else if (batchStatus.phase === 'completed') {
  state.batchPhase = batchStatus.result.failed.length > 0 ? 'result' : 'complete';
  state.batchResult = batchStatus.result;
} else if (batchStatus.phase === 'interrupted') {
  // 显示 "上次安装中断，是否继续？"
  state.batchPhase = 'banner'; // 带恢复提示的 banner
}
```

### 5.4 Banner 显示逻辑

```typescript
// 进入 Chat 页时
async function checkBatchBanner(state: AppViewState) {
  if (isDismissed()) return;

  const result = await state.client.request('skills.batch-check');
  if (result.missing.length > 0) {
    state.batchPhase = 'banner';
    state.batchSkills = result.missing;
  }
}
```

关闭策略：渐进冷却（前 2 次 24h，第 3 次起 7 天）。

---

## 六、Manifest 签名（轻量级方案）

### 6.1 为什么还需要 Manifest？

现有代码中每个 Skill 的版本/SHA256 **没有集中管理**。HK 二进制服务器的 SHA256 是每次下载时从 `{url}.sha256` 获取的——如果 `.sha256` 文件也被篡改呢？

Manifest 的价值：**集中式可信源**，签名后客户端可以验证完整性。

### 6.2 简化方案

Manifest 不需要像 v3 方案那样复杂。它只需要：

```json
{
  "version": "2026-02-08",
  "min_client_version": "1.3.0",
  "public_mirrors": {
    "github": ["https://ghproxy.cn", "https://gh-proxy.com", "https://ghfast.top"]
  },
  "fallback_server": "https://skills.tecbinai.com",
  "hk_binary_tools": {
    "gog":       { "version": "1.2.0", "sha256": { "darwin-arm64": "abc...", "win32-x64": "def..." } },
    "summarize": { "version": "0.9.0", "sha256": { "darwin-arm64": "123...", "win32-x64": "456..." } }
  }
}
```

- 只记录 **HK/兜底服务器上的预编译二进制** 的 SHA256
- npm/go/pip 走包管理器安装的**不需要在 manifest 里**（包管理器自带完整性校验）
- 体积小，加载快

### 6.3 签名 + 托管

```
CI 构建 → Ed25519 签名 → scp 到阿里云轻量服务器
客户端启动 → 从 skills.tecbinai.com 拉 manifest → 验签 → 缓存本地
```

公钥内嵌客户端。公共镜像挂了？更新 manifest 的 `public_mirrors` 列表即可，**分钟级修复**。

---

## 七、实施路线图

### Phase 0: 基础设施（第 0~1 天）

- [ ] 阿里云轻量服务器 + nginx + HTTPS + Let's Encrypt
- [ ] CI 脚本：构建全平台预编译二进制 + rsync 上传到阿里云
- [ ] `cn-mirrors.ts` 扩展公共代理源（gh-proxy.com、ghfast.top）+ 阿里云兜底
- [ ] Ed25519 密钥对 + 签名脚本
- [ ] manifest.json 生成脚本（从 SKILL.md 提取元数据）

### Phase 1: BatchInstallOrchestrator（第 1~3 天）

- [ ] `BatchInstallOrchestrator` 类（并发控制 + 状态管理）
- [ ] `installSkill()` 的 `onProgress` 回调 → WebSocket 事件转换
- [ ] install-state.json 持久化 + 重启恢复
- [ ] 4 个新 RPC 方法注册

### Phase 2: UI（第 3~6 天）

- [ ] `<skills-batch-banner>` + 显示/关闭逻辑
- [ ] `<skills-batch-confirm>` 弹窗
- [ ] `<skills-batch-progress>` 进度页
- [ ] `<skills-batch-result>` 结果页
- [ ] 重连恢复逻辑
- [ ] 集成 Screen 5（已有原型）

### Phase 3: 联调 + 测试（第 6~8 天）

- [ ] 全流程联调
- [ ] 模拟镜像故障 → 验证回退
- [ ] 断线恢复测试
- [ ] 多标签页测试
- [ ] Windows / macOS / Linux 测试

---

## 八、v3 → v4 变更对照

| 项目 | v3（重新设计） | v4（基于现有工程） |
|------|--------------|-----------------|
| 安装引擎 | 新建 `SkillPackageManager` 全套 | **复用** `installSkill()` |
| 镜像选择 | 新建 `MirrorSelector` | **复用** `cn-mirrors.ts` + `runCommandWithMirrorFallback()` |
| 下载器 | 新建 `BinaryDownloader` | **复用** `downloadFile()` + `installFromHKBinaryServer()` |
| SHA256 | 新建 `IntegrityGuard` | **复用** HK server `.sha256` 校验 |
| 解压 | 新建 `BinaryInstaller` | **复用** `extractArchive()` |
| 错误信息 | 未提及 | **复用** `getFriendlyErrorMessage()` |
| 运行时依赖 | "消灭"，全部预编译 | **复用** `installGoDependency()` 等自动安装 |
| 新建代码量 | ~2000 行后端 + UI | **~500 行后端** + UI |
| 风险 | 高（新引擎需全面测试） | **低**（只加编排层） |
| 兜底服务器 | nginx 反代 GitHub（不通） | nginx 直接托管文件（CI 上传） + HK 服务器（保留） |

**核心差异：v4 新增代码量是 v3 的 1/4，因为引擎层全部复用。**

---

## 附录：现有代码改动清单

| 文件 | 改动 | 类型 |
|------|------|------|
| `src/gateway/batch-install.ts` | **新建** BatchInstallOrchestrator | 新文件 |
| `src/gateway/server-methods/skills.ts` | **新增** 4 个 RPC handler（`skills.batch-*`） | 小改 |
| `src/gateway/server-methods/skill-install-approval.ts` | **无改动**，batch 通过 `isSkillPendingOrInstalling()` 做互斥检查 | 不动 |
| `src/gateway/server.impl.ts` | **新增** orchestrator 初始化 + broadcast 注入 | 小改 |
| `src/config/cn-mirrors.ts` | **扩展** GitHub 代理源 + safety_net | 小改 |
| `ui/src/ui/app-view-state.ts` | **新增** batch 状态字段（与现有 `skillInstall*` 并行） | 小改 |
| `ui/src/ui/app-gateway.ts` | **新增** `skill.batch.*` 事件处理 + 重连恢复 | 中改 |
| `ui/src/ui/controllers/skill-install.ts` | **无改动**，现有解析器仍处理 `skill.install.*` | 不动 |
| `ui/src/ui/views/skills-batch-*.ts` | **新建** 4 个 Lit 组件 | 新文件 |
| `ui/src/ui/app-render.ts` | **新增** batch overlay 渲染 | 小改 |
