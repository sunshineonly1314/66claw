# ClawdSkillsProxy 服务端补全需求

> 提给：SkillsProxy 后端负责人
> 日期：2026-02-20
> 背景：客户端（ClawdBot CN）已经写好了完整的多层级调用链，但 SkillsProxy 服务端存在多处功能缺失，导致客户端的兜底/下载逻辑实际上是空壳。本文档按优先级列出所有需要补全的功能。

---

## 一、当前架构概览

客户端对 SkillsProxy 的依赖关系：

| 模块 | SkillsProxy 角色 | 接口 | 当前服务端状态 |
|------|-----------------|------|---------------|
| Skills 技能包 | **唯一来源**（Gitee 已封禁） | `/api/skills/index`, `/api/skills/download` | 可用，但手动同步 |
| MCP 工具市场 | Tier 3 兜底 | `/api/mcp-index` | 仅 18 条静态数据 |
| 二进制工具 | CN 用户主力源 | `/api/binaries/{tool}/...` | 仅实现 signal-cli |
| 能力包 | CN 用户主力源 | `/api/capabilities/`, `/api/capabilities/wsl/` | 可用，但手动上传 |

---

## 二、P0 需求（不做 = 功能不可用）

### 需求 1：MCP 工具市场索引自动同步

#### 问题

客户端 MCP 工具市场有四层数据源级联：Cloud Index → ModelScope → 官方 Registry → SkillsProxy。当前 Tier 0（Cloud Index）没有配置 URL，Tier 1（ModelScope）需要 API Token 且耗时长（约 10 分钟），Tier 2（官方 Registry）在国内访问不稳定。**Tier 3 SkillsProxy 是最后的兜底，但目前只有 18 条手写的静态数据，完全无法兜底。**

#### 需求描述

SkillsProxy 需要在服务端定时从上游数据源抓取 MCP 工具列表，存储到本地，通过 `/api/mcp-index` 接口返回完整数据。

#### 数据来源（按优先级）

1. **ModelScope REST API**（推荐，数据最全）
   - 接口：`PUT https://modelscope.cn/openapi/v1/mcp/servers`
   - 需要申请 ModelScope API Token（`MODELSCOPE_API_TOKEN`）
   - 搜索策略：按 14 个类别 + 单字母 a-z + 数字 0-9 搜索，可以获取 7000+ 条目
   - 每次请求间隔 300ms 以上，避免限流
   - 返回数据包含：serverId、name、description、npmPackage/pypiPackage、sseUrl、toolCount 等

2. **官方 MCP Registry**（补充）
   - 接口：`GET https://registry.modelcontextprotocol.io/v0.1/servers`
   - 支持分页（cursor 参数），无需认证
   - 数据量约 5000 条
   - 国内直连不稳定，建议通过 GitHub 代理访问：
     - `https://gh-proxy.com/https://raw.githubusercontent.com/modelcontextprotocol/servers/main/registry/servers.json`

#### 同步频率

- 建议每天同步一次（凌晨低峰期）
- 支持手动触发同步（管理接口或命令行）

#### `/api/mcp-index` 接口响应格式

客户端兼容三种格式（任选其一）：

```json
// 格式 A：直接数组
[{ "serverId": "...", ... }, ...]

// 格式 B：items 包装
{ "items": [{ "serverId": "...", ... }, ...] }

// 格式 C：data.items 包装
{ "data": { "items": [{ "serverId": "...", ... }, ...] } }
```

#### 每条 MCP 工具的必需字段

客户端 `McpMarketplaceItem` 类型定义（以下为必需字段，其余可选）：

```
serverId: string        — 唯一标识，如 "filesystem", "modelscope/fetch"
friendlyName: string    — 显示名称（中文优先）
description: string     — 描述（中文优先）
category: string        — 类别：filesystem / database / search / productivity / development 等
tags: string[]          — 搜索标签
version: string         — 版本号
requiresApiKey: boolean — 是否需要 API Key
platforms: string[]     — 支持的平台
isOfficial: boolean     — 是否官方认证
isNew: boolean          — 是否新上架
toolCount: number       — 暴露的 tool 数量
source: string          — 数据来源标识（填 "clawdskillsproxy"）
```

可选但建议提供的字段：

```
friendlyNameEn: string     — 英文名称
descriptionEn: string      — 英文描述
npmPackage: string          — npm 包名（用于 npx 安装）
pypiPackage: string         — Python 包名（用于 uvx 安装）
sseUrl: string              — SSE 云托管地址（ModelScope 托管的）
securityScore: number       — 安全评分 0-100
capabilities: string[]      — 功能列表
examplePrompts: string[]    — 示例提示词
toolNames: string[]         — 工具名列表
sourceUrl: string           — 来源详情页链接
```

#### 存储建议

- 不要打包进 JAR。存到数据库或本地 JSON 文件（如 `/data/mcp-index.json`），方便更新
- 启动时加载到内存，接口直接返回内存数据
- 同步脚本更新文件后，接口自动感知（watch 文件变化 或 定时 reload）

#### 验收标准

- `/api/mcp-index` 返回 3000+ 条 MCP 工具数据
- 数据每天自动更新一次
- 包含 serverId、friendlyName、description、npmPackage/pypiPackage 等客户端安装所需字段

---

### 需求 2：二进制工具下载补全（6 个工具）

#### 问题

客户端 `cn-mirrors-data.json` 中配置了 7 个工具的 SkillsProxy 下载端点：

| 工具 | 客户端配置的 endpoint | 服务端实现状态 |
|------|---------------------|---------------|
| signal-cli | `/api/binaries/signal-cli` | 已实现 |
| sherpa-onnx | `/api/binaries/sherpa-onnx` | **未实现** |
| ffmpeg | `/api/binaries/ffmpeg` | **未实现** |
| gh (GitHub CLI) | `/api/binaries/gh` | **未实现** |
| himalaya | `/api/binaries/himalaya` | **未实现** |
| yt-dlp | `/api/binaries/yt-dlp` | **未实现** |
| uv | `/api/binaries/uv` | **未实现** |
| rclone | `/api/binaries/rclone` | **未实现** |

客户端请求这些端点时，如果文件不存在会 404，用户体验为下载失败。

#### 需求描述

对每个工具实现以下功能：

**A. 自动从 GitHub Releases 同步**

每个工具对应一个 GitHub 仓库：

| 工具 | GitHub 仓库 | 需要下载的平台 |
|------|------------|---------------|
| sherpa-onnx | `k2-fsa/sherpa-onnx` | linux-x64, darwin-arm64, darwin-x64, win-x64 |
| ffmpeg | `BtbN/FFmpeg-Builds` | linux-x64, win-x64 |
| gh | `cli/cli` | linux-amd64, darwin-arm64, darwin-amd64, windows-amd64 |
| himalaya | `pimalaya/himalaya` | linux-x86_64, darwin-aarch64, darwin-x86_64, windows-x86_64 |
| yt-dlp | `yt-dlp/yt-dlp` | linux, darwin, windows（单文件可执行） |
| uv | `astral-sh/uv` | linux-x86_64, darwin-aarch64, darwin-x86_64, windows-x86_64 |
| rclone | `rclone/rclone` | linux-amd64, darwin-arm64, darwin-amd64, windows-amd64 |

同步流程：
1. 调用 GitHub API `GET https://api.github.com/repos/{owner}/{repo}/releases/latest` 获取最新版本
2. 由于国内 GitHub 访问不稳定，建议通过代理下载 release assets：`https://gh-proxy.com/https://github.com/{owner}/{repo}/releases/download/{version}/{filename}`
3. 下载到本地 `/data/binaries/{tool}/{version}/{filename}`
4. 同时更新 `latest.json`：`{ "version": "v1.2.3", "files": [...] }`

同步频率：
- 建议每小时检查一次（对比本地 latest.json 中的版本与 GitHub 最新版本）
- 只在有新版本时下载

**B. 接口实现**

客户端调用的接口格式（参照已有 signal-cli 的实现）：

```
GET /api/binaries/{tool}/latest
→ 返回 { "version": "v1.2.3", "files": ["filename1.tar.gz", "filename2.zip"] }

GET /api/binaries/{tool}/versions
→ 返回 ["v1.2.3", "v1.2.2", ...]

GET /api/binaries/{tool}/{version}/{filename}
→ 返回文件流（Content-Type: application/octet-stream）
```

认证：与现有接口一致，`Authorization: Bearer {token}`。

**C. 磁盘空间预估**

| 工具 | 单版本大小（所有平台） | 保留版本数 | 预估总量 |
|------|---------------------|-----------|---------|
| sherpa-onnx | ~200 MB | 2 | ~400 MB |
| ffmpeg | ~150 MB | 2 | ~300 MB |
| gh | ~50 MB | 2 | ~100 MB |
| himalaya | ~30 MB | 2 | ~60 MB |
| yt-dlp | ~20 MB | 2 | ~40 MB |
| uv | ~40 MB | 2 | ~80 MB |
| rclone | ~60 MB | 2 | ~120 MB |
| **合计** | | | **~1.1 GB** |

建议只保留最近 2 个版本，自动清理旧版本。

#### 验收标准

- 上述 7 个工具（含 signal-cli）的 `/api/binaries/{tool}/latest` 都能返回正确的版本信息
- 每个工具至少有一个版本的文件可下载
- 每小时自动检查 GitHub 新版本并同步

---

## 三、P1 需求（运维自动化）

### 需求 3：Skills 技能包自动同步

#### 现状

当前 Skills 同步流程是手动的：人工运行 `sync_and_translate.py`（从 GitHub 拉取上游 + 阿里百炼翻译） + `deploy.py`（SFTP 上传到 253 服务器）。上游 clawdbot/skills 仓库更新后，服务端数据不会自动跟进。

#### 需求

在 253 服务器上配置定时任务，自动执行以下流程：

1. **定时拉取上游**：`git pull` 或 `git clone --depth 1` 最新的 `clawdbot/skills` 仓库
2. **增量翻译**：只翻译新增/变更的 skill（对比 sha256 或 mtime），复用已有翻译缓存
3. **自动部署**：翻译完成后直接写入 `/root/clawdskills/skills-gitee-temp/` 目录
4. **触发索引刷新**：Java 端已有 5 分钟定时扫描，无需额外触发（但也可以加个手动触发接口）

频率：建议每天一次（凌晨）。

通知：同步完成/失败时记录日志，最好有简单的通知机制（写入状态文件或 webhook）。

#### 验收标准

- 无需人工干预，每天自动从上游同步新 skill
- 翻译缓存生效，不会重复翻译已翻过的 skill
- 同步日志可查

---

### 需求 4：能力包构建和更新流程文档化

#### 现状

`/api/capabilities/` 下的 zip 包（browser-pack.zip、files-pack.zip 等）是手动上传的，没有任何构建脚本、版本记录或更新流程文档。

#### 需求

1. **文档化**：写一份文档说明每个能力包的内容物、构建方式、依赖项
   - browser-pack.zip 里面包含什么？Playwright 的浏览器二进制？
   - files-pack.zip 里面包含什么？
   - 各个包对应什么平台？

2. **版本管理**：每个能力包提供版本文件
   - 在 `/api/capabilities/` 根目录提供一个 `manifest.json`：
     ```json
     {
       "browser-pack.zip": { "version": "1.0.0", "size": 52428800, "sha256": "abc..." },
       "files-pack.zip": { "version": "1.0.0", "size": 2097152, "sha256": "def..." }
     }
     ```
   - 客户端可以通过 sha256 判断是否需要重新下载

3. **构建脚本**（可后续补）：最好有一个脚本可以一键重新构建所有能力包，而不是手动 zip

#### 验收标准

- 有文档说明每个能力包的内容和构建方式
- `/api/capabilities/manifest.json` 可访问，包含版本和 hash 信息

---

## 四、P2 需求（稳定性和容灾）

### 需求 5：数据备份到 OSS

#### 现状

所有数据（skills ~990 MB, binaries ~500 MB, capabilities ~300 MB）全部存在 253 单台服务器本地磁盘，无备份。

#### 需求

1. 定时将 `/root/clawdskills/` 整个目录备份到阿里云 OSS
2. 频率：每天一次
3. 保留最近 7 天的备份
4. 提供恢复脚本：一键从 OSS 恢复到本地目录

#### 验收标准

- OSS 上有每天的备份快照
- 恢复脚本可用且有文档

---

### 需求 6：90 服务器做完整 fallback

#### 现状

90 服务器（121.43.61.90）的 Nginx 只对 `/api/binaries/` 做了 70/30 权重分流（253 主 / 90 辅），其他接口（skills、mcp-index、capabilities）全部只走 253，253 挂了就完全不可用。

#### 需求

1. 在 90 上部署一份 SkillsProxy 数据的只读镜像（可以是定时 rsync 从 253 同步）
2. Nginx 增加健康检查：如果 253 的 Java 服务无响应，自动将 `/api/skills/*`、`/api/mcp-index`、`/api/capabilities/*` 也切到 90 本地的备份数据
3. 不需要在 90 上跑完整的 Java 应用，Nginx 静态文件服务就够了（skills 是文件、mcp-index 是 JSON、capabilities 是 zip）

#### 验收标准

- 模拟 253 停机后，客户端仍能从 90 获取 skills 索引、mcp-index 和能力包
- rsync 定时同步正常运行

---

## 五、补充说明

### Nginx 路径透传

90 上的 Docker Nginx（端口 8880）配置中 `location /api/` 的 `proxy_pass` 没有末尾 `/`，所以是 **完整路径透传**。所有接口实现必须以 `/api/` 开头（如 `/api/skills/index`、`/api/mcp-index`），Java 端不能省略 `/api` 前缀。

### 认证

所有 `/api/*` 接口统一使用 `Authorization: Bearer {token}` 认证，与现有实现一致。

### 限流

现有限流规则（每 IP 每小时 1000 次，超限封 24 小时）保持不变即可。

---

## 六、工作量预估参考

| 需求 | 预估工作量 | 优先级 |
|------|-----------|--------|
| MCP 索引自动同步 | 2-3 天 | P0 |
| 二进制工具同步（6 个） | 2-3 天 | P0 |
| Skills 自动同步 cron | 0.5-1 天 | P1 |
| 能力包文档 + manifest | 0.5-1 天 | P1 |
| 数据备份到 OSS | 0.5 天 | P2 |
| 90 服务器 fallback | 1-2 天 | P2 |
| **合计** | **~7-11 天** | |
