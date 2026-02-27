# OpenClawCN 全项目深度代码审查报告

**审查日期:** 2026-02-19
**审查方法:** 10 个并行 AI Agent 对全项目进行模块化深度扫描
**总发现问题:** 280+ 个（CRITICAL: 15, HIGH: 65+, MEDIUM: 110+, LOW: 90+）

---

## 目录

1. [执行摘要](#1-执行摘要)
2. [CI/CD 流水线和发布工作流](#2-cicd-流水线和发布工作流)
3. [Windows/macOS 打包和构建系统](#3-windowsmacos-打包和构建系统)
4. [自动更新/平滑升级系统](#4-自动更新平滑升级系统)
5. [Skills 系统和 MCP 集成](#5-skills-系统和-mcp-集成)
6. [Embedding 和智能搜索推荐系统](#6-embedding-和智能搜索推荐系统)
7. [Chat UI 和交互层](#7-chat-ui-和交互层)
8. [多模型配置系统](#8-多模型配置系统)
9. [扩展系统（WeChat/DingTalk/Feishu/QQ/WeCom）](#9-扩展系统wechatdingtalkfeishuqqwecom)
10. [Agent 工具和桌面控制](#10-agent-工具和桌面控制)
11. [优先修复建议](#11-优先修复建议)

---

## 1. 执行摘要

### 各模块问题统计

| 模块 | CRITICAL | HIGH | MEDIUM | LOW | 总计 |
|------|----------|------|--------|-----|------|
| CI/CD | 5 | 7 | 12 | 14 | 38 |
| 打包构建 | 4 | 6 | 15 | 13 | 38 |
| 自动更新 | 3 | 4 | 8 | 15 | 30 |
| Skills/MCP | 3 | 4 | 8 | 15 | 30 |
| Embedding/搜索 | 2 | 4 | 8 | 20 | 34 |
| Chat UI | 0 | 5 | 15 | 14 | 34 |
| 多模型配置 | 4 | 6 | 7 | 22 | 39 |
| 扩展系统 | 6 | 10 | 12 | 14 | 42 |
| Agent 工具 | 1 | 7 | 18 | 8 | 34 |
| **总计** | **28** | **53** | **103** | **135** | **319** |

### 最紧急修复项（Top 10）

1. **`ci/config.json` 硬编码 Gitee 访问令牌** — 凭证泄露
2. **Delta 更新路径遍历漏洞** — `installer-updater.ts:315-353`
3. **MCP `servers.add` 允许执行任意命令** — 无命令验证
4. **QQ Bot Webhook 返回空 Ed25519 签名** — 认证绕过
5. **BM25 分数全部被截断为 1.0** — `hybrid.ts:81-84` 搜索质量完全失效
6. **Tool Discovery 从不传递查询向量** — 向量搜索完全未使用
7. **HTTP 更新服务器** — `setup.iss:9` 中间人攻击风险
8. **API Key 明文传输且 UI 使用 `type="text"`** — `model-config.ts`
9. **扩展系统 Webhook 认证可选** — DingTalk/QQ Bot 签名验证可绕过
10. **桌面控制工具无互斥锁** — 并发调用导致操作冲突

---

## 2. CI/CD 流水线和发布工作流

**审查文件：** `.github/workflows/`, `ci/`, `scripts/generate-*.ts`, `scripts/release-deploy.ts`
**发现问题：38 个**

### CRITICAL

| # | 文件:行 | 问题描述 |
|---|---------|---------|
| 2.1 | `ci/config.json:13,25` | **硬编码 Gitee 访问令牌** — `7c15433c23160cdae4aea6fff0996543` 明文嵌入 URL，提交到仓库。任何人可用此凭证推送到 Gitee 仓库 |
| 2.2 | `ci/config.json:36` | **硬编码 Webhook 密钥** — `clawdbot-ci-secret-2026` 明文存储，可伪造 Webhook 请求 |
| 2.3 | `setup.iss:9` | **HTTP 更新服务器** — `http://47.98.123.45` 使用未加密 HTTP，中间人可注入恶意更新 |
| 2.4 | `release-simple.yml:166-168` | **SSH 密钥写入磁盘后未清理** — 自托管 Runner 上密钥将持久化 |
| 2.5 | 多个工作流 | **Secrets 直接在 Shell 中插值** — `${{ secrets.* }}` 在 `run:` 块中未引用，存在命令注入风险 |

### HIGH

| # | 文件:行 | 问题描述 |
|---|---------|---------|
| 2.6 | `release-build.yml:11-17` | **双重触发** — Tag 推送到 main 时工作流触发两次（branch push + tag push）|
| 2.7 | `release-build.yml:383-424` | **分支推送可创建意外 Release** — `always()` 条件允许在 changelog 失败时仍创建发布 |
| 2.8 | 多个工作流 | **`--frozen-lockfile` 使用不一致** — `release-build.yml` 用 `--no-frozen-lockfile`，CI 用 `--frozen-lockfile`，导致依赖可能漂移 |
| 2.9 | `release-with-auto-update.yml:70` | **版本提取 Bug** — `release-*` 标签的版本提取逻辑错误，`${GITHUB_REF#refs/tags/v}` 无法正确处理 |
| 2.10 | `docker-release.yml:43-98` | **Docker 架构标签混乱** — amd64 和 arm64 构建推送相同标签，包含对方架构后缀 |
| 2.11 | `docker-release.yml:138-141` | **Digest 输出名称错误** — `image-digest` 与 action 实际输出 `digest` 不匹配 |
| 2.12 | `ci/webhook-server.js:314` | **路径遍历漏洞** — `/logs/:filename` 未校验，`/logs/../../config.json` 可读取凭证文件 |

### MEDIUM

| # | 文件:行 | 问题描述 |
|---|---------|---------|
| 2.13 | `release-simple.yml:83-98` | Heredoc 内 JSON 生成脆弱，变量含特殊字符时 JSON 格式损坏 |
| 2.14 | `generate-manifest.ts:158` | 混淆检测仅检查文件是否包含 "obfuscated" 或大于 100KB，极不可靠 |
| 2.15 | `generate-changelog.ts:299-319` | 版本分组逻辑错误，条目可能分配到错误版本 |
| 2.16 | `release-deploy.ts:614` | `server!` 非空断言不安全 |
| 2.17 | `release-deploy.ts:752-766` | `ali-oss` 缺失时错误信息不友好 |
| 2.18 | `ci.yml:134-135` | 所有矩阵条目都安装 Bun，即使只需要 Node.js |
| 2.19 | `release-with-auto-update.yml:399` | 使用已弃用的 `softprops/action-gh-release@v1` |
| 2.20 | `release-with-auto-update.yml:263` | `UPDATE_SERVER_DOMAIN` 和 `UPDATE_SERVER_HOST` 密钥名不一致 |
| 2.21 | `ci/webhook-server.js:261-310` | 状态页 XSS — 配置数据直接渲染到 HTML |
| 2.22 | `ci/webhook-server.js:164-169` | 超时竞态条件 — Promise 可能同时 resolve 和 reject |
| 2.23 | `release-simple.yml:89` | Git SHA 截断长度为 9（非标准 7） |
| 2.24 | `release-simple.yml:37` | pnpm 版本不一致 — 此工作流用 pnpm@9，其他用 10.23.0 |

### LOW

| # | 文件:行 | 问题描述 |
|---|---------|---------|
| 2.25 | 多个工作流 | 硬编码 `E:\clawdbuild` 路径 |
| 2.26 | `docker-build-test.yml:71-75` | 构建失败被静默忽略，使用假测试服务器 |
| 2.27 | `docker-e2e-test.yml:44,49` | 同上 |
| 2.28 | `daily-upstream-sync.yml:307` | 脆弱的合并提交回退链 |
| 2.29 | `daily-upstream-sync.yml` | 合并分支永远不清理 |
| 2.30 | `ci.yml:157` | 用相同参数重试失败的 pnpm install |
| 2.31 | `build-macos.yml:50-51` | 回退 install 反而丢掉了 `--no-frozen-lockfile` |
| 2.32 | `release-with-auto-update.yml:80` | `HEAD^` 在初始提交上失败 |
| 2.33 | 多个工作流 | 版本字符串无验证 |
| 2.34 | `release-deploy.ts:499` | 服务器地址 `@` 分割脆弱 |
| 2.35 | `quick-build.yml:186` | `uname -m` 返回 `x86_64` 而非脚本期望的 `x64` |
| 2.36 | `ci/build-*.sh` | SSH `StrictHostKeyChecking=no` |
| 2.37 | `generate-changelog.ts` | 无 Git Tag 时整个 changelog 折叠为单一版本 |
| 2.38 | `ci.yml:249-252` | Windows 矩阵不必要安装 Bun |

---

## 3. Windows/macOS 打包和构建系统

**审查文件：** `scripts/windows/`, `scripts/desktop/`, `apps/desktop/src-tauri/`, `build/scripts/`
**发现问题：38 个**

### CRITICAL

| # | 文件:行 | 问题描述 |
|---|---------|---------|
| 3.1 | `setup.iss:9`, `build-macos-cn.sh:399` | **HTTP 更新服务器** — Inno Setup 和 macOS 独立构建使用 `http://47.98.123.45`（未加密），而 Tauri/NSIS 使用 `https://dl.openclawcn.com` |
| 3.2 | `sidecar.rs:32-53` | **弱令牌生成** — 使用 `DefaultHasher` + 系统时间 + PID 生成认证令牌，本地进程可预测，应使用 CSPRNG |
| 3.3 | `main.rs:20-42` | **网关令牌通过 URL hash 注入** — 令牌可能出现在 DevTools 历史、崩溃报告中 |
| 3.4 | `collect-and-deploy.sh:34-37` | **硬编码内网 IP 和用户名** — 暴露内部网络拓扑 |

### HIGH

| # | 文件:行 | 问题描述 |
|---|---------|---------|
| 3.5 | `setup.iss:6`, `tauri.conf.json:4`, `Cargo.toml:3` | **版本不一致** — Inno Setup `2026.2.0`, Cargo.toml `0.1.0`，且 Inno Setup 版本需手动编辑 |
| 3.6 | 多文件 | **更新服务器 URL 不一致** — 三条构建路径使用不同的更新端点 |
| 3.7 | `sidecar.rs:318-321` | **`is_sidecar_running()` 不检查进程存活** — 仅检查 `Option<Child>` 是否为 Some，崩溃后的进程无法重启 |
| 3.8 | `tauri.conf.json:54` | **CSP 允许 `unsafe-eval` 和 `unsafe-inline`** — 完全破坏 XSS 防护 |
| 3.9 | `main.rs:219-223` | **Sidecar 清理仅在窗口 Destroyed 事件触发** — 崩溃/Task Manager 终止时不会清理 |
| 3.10 | `tauri.conf.json:10` | **`frontendDist` 路径可能错误** — 指向 `dist/control-ui`，但 UI 构建输出可能在 `ui/dist/` |

### MEDIUM

| # | 文件:行 | 问题描述 |
|---|---------|---------|
| 3.11 | `build-macos-cn.sh:228`, `tauri.conf.json:35` | macOS 最低版本不一致 — 独立构建 12.0 vs Tauri 13.0 |
| 3.12 | `build.ps1:19-50` | Windows 构建脚本不检查 Node.js |
| 3.13 | `setup.iss:53`, `setup-build-temp.iss:53` | Skills 源目录不一致 — `skills\*` vs `skills-merged\*` |
| 3.14 | `build-macos-cn.sh:344-350` | macOS CN 构建排除 extensions 的 node_modules 但不安装 |
| 3.15 | 多文件 | `npm install --ignore-scripts` 可能破坏原生模块（better-sqlite3 等）|
| 3.16 | `setup.iss:51`, `setup-build-temp.iss:51` | Inno Setup 硬编码 `E:\clawdbuild\test-prod-deps\node_modules\*` |
| 3.17 | `setup-build-temp.iss:83-89` | 额外硬编码 `E:\clawdbuild\full-tools\` 路径 |
| 3.18 | `tauri.conf.json:37-38` | Windows 无代码签名 — SmartScreen 警告 |
| 3.19 | `tauri.conf.json:34-39` | macOS Tauri 构建无代码签名 — Gatekeeper 阻止 |
| 3.20 | `hooks.nsh:42,54,66` | NSIS `ExecWait` 使用注册表值执行命令，可能被恶意利用 |
| 3.21 | `build-macos-cn.sh:443` | 删除 node_modules 中的 LICENSE 文件 — 可能违反开源许可证 |
| 3.22 | `build-macos-cn.sh:435` | `npm install` 失败被 `|| true` 静默忽略 |
| 3.23 | `build.ps1:126` | ASCII 编码写入批处理文件可能损坏 Unicode 路径 |
| 3.24 | `build.sh:94` | `$TAURI_ARGS` 未引用，依赖 word splitting |
| 3.25 | `collect-and-deploy.sh:86,98` | SCP 后无完整性验证 |

### LOW

| # | 文件:行 | 问题描述 |
|---|---------|---------|
| 3.26 | `main.rs:219-223` | 窗口关闭不最小化到托盘 |
| 3.27 | `verify-bytecode.mjs:29` | ROOT 路径解析错误 — `cn/scripts/` 而非项目根目录，永远找不到文件 |
| 3.28 | `prepare-resources.ps1:155-188` | 回退路径上 `$deployDir` 清理可能被跳过 |
| 3.29 | `tauri.conf.json:5`, `build-macos-cn.sh:71` | Bundle ID 不一致 — `com.clawdbot.cn.desktop` vs `cn.openclawcn.mac` |
| 3.30 | `setup.iss:12`, `setup-build-temp.iss:12` | AppId 使用占位符 GUID — 可能与其他产品冲突 |
| 3.31 | `platform/windows.rs:12-14` | 日志写入可执行目录可能失败（Program Files 只读）|
| 3.32 | `platform/windows.rs:17-19` | `NODE_PATH` 设置错误 — 指向 Node 二进制目录而非 node_modules |
| 3.33 | `build-macos-cn.sh:434` | 使用系统 npm 但捆绑 Node.js，版本可能不兼容 |
| 3.34 | `setup.iss:271-296` | `install.json` 路径不一致 — Inno Setup 写 `{app}\` vs NSIS 写 `resources\` |

### 跨平台问题

项目存在 **三条并行且已发散的构建路径**：

| 特性 | Inno Setup | Tauri NSIS | macOS Standalone |
|------|-----------|------------|------------------|
| 更新服务器 | `http://47.98.123.45` | `https://dl.openclawcn.com` | `http://47.98.123.45` |
| install.json | `{app}\install.json` | `$INSTDIR\resources\install.json` | `$APP_ROOT/install.json` |
| Node.js 来源 | `scripts\windows\node-portable\` | Tauri resources | nodejs.org 下载 |
| 代码签名 | 无 | 无 | Ad-hoc 或真实签名 |
| 磁盘空间检查 | 1GB | 500MB | 无 |

---

## 4. 自动更新/平滑升级系统

**审查文件：** `src/infra/installer-updater.ts`, `update-runner.ts`, `update-check.ts`, `update-startup.ts`, `update-content.ts`
**发现问题：30 个**

### CRITICAL

| # | 文件:行 | 问题描述 |
|---|---------|---------|
| 4.1 | `installer-updater.ts:315-353` | **路径遍历漏洞** — `applyDelta` 直接使用 delta.json 中的 `entry.path` 构造文件路径，无验证 `../../etc/passwd` 等遍历。影响添加(317)、修改(333)、删除(347)三种操作 |
| 4.2 | `installer-updater.ts:91-288` | **无签名验证** — 完全依赖同一服务器提供的 SHA256 校验和，自引用验证。服务器被入侵即可推送恶意更新 |
| 4.3 | `installer-updater.ts:184-198` | **Delta 包跳过 SHA256 验证** — `if (mode === "full" && latest.fullSha256)` 条件排除了 delta 包的完整性检查 |

### HIGH

| # | 文件:行 | 问题描述 |
|---|---------|---------|
| 4.4 | `installer-updater.ts:126-288` | **无并发更新锁** — gateway handler 和 CLI 可同时触发更新，竞争 `.update-temp` 和 `.update-backup` 目录 |
| 4.5 | `installer-updater.ts:362-401` | **不完整的回滚** — `applyFull` 中 `rmrf(dest)` 和 `copyDir` 之间崩溃导致损坏状态，回滚失败被静默吞噬 |
| 4.6 | `installer-updater.ts:185` | **`fullSha256` 为空时跳过验证** — 被入侵的服务器可省略此字段绕过校验 |
| 4.7 | `installer-updater.ts:497-522` | **TOCTOU 竞态** — `detectInstallKind` 的文件存在性检查与实际使用之间可能状态变化 |

### MEDIUM

| # | 文件:行 | 问题描述 |
|---|---------|---------|
| 4.8 | `update-check.ts:357-373`, `installer-updater.ts:680-690` | 版本比较不处理预发布标签 — `1.2.3-beta` 和 `1.2.3` 被视为相等 |
| 4.9 | `installer-updater.ts:459-487` | 依赖安装失败被静默忽略 — `catch {}` |
| 4.10 | `update.ts:112-115` | 即使更新失败也调度重启 — `result.status === "error"` 时仍触发 |
| 4.11 | `update-runner.ts:584-623` | Steps 数组无限增长 — 最多 640KB 序列化到响应 |
| 4.12 | `update-runner.ts:559-638` | 崩溃时临时目录不清理 |
| 4.13 | `update-runner.ts:653-680` | `git rebase` 无安全防护 — abort 失败时仓库处于不一致状态 |
| 4.14 | `installer-updater.ts:599-621` | Windows 上 `tar` 路径硬编码 Git 安装路径 |
| 4.15 | `update-content.ts:89-101` | 硬编码中文字符串，忽略 locale 参数 |

### LOW（15 个，摘要）

- 重复的 `readPackageVersion` 实现（3 个文件）
- `fetchWithTimeout` 无法区分超时和用户取消
- `registryArg` 字符串拆分脆弱
- `totalSteps` 计数器在条件步骤后不准确
- Git 命令串行执行可并行化
- 无磁盘空间检查
- 时钟回退可影响检查间隔
- Spinner 未在 finally 块中停止
- 重启定时器不可取消
- 变量遮蔽
- `verifyChecksums` 仅检查 `dist/` 下文件
- `copyDir` 不保留权限和符号链接
- `downloadFile` 重定向后 Content-Length 可能不准确
- `resolveUpdateServerUrl` 无更新服务器时无提示
- abort durationMs 硬编码为 0

---

## 5. Skills 系统和 MCP 集成

**审查文件：** `src/mcp/`, `src/dispatch/`, `src/gateway/server-methods/mcp-methods.ts`, `skills-batch.ts`
**发现问题：30 个**

### CRITICAL

| # | 文件:行 | 问题描述 |
|---|---------|---------|
| 5.1 | `on-demand-loader.ts:38-43` | **SSE 白名单包含 localhost** — 生产环境允许连接 `localhost` 和 `127.0.0.1`，通过受污染的市场索引可触发 SSRF |
| 5.2 | `mcp-client.ts:59-67` | **configEnv 覆盖安全允许列表** — `Object.assign(env, configEnv)` 允许注入 `LD_PRELOAD`、`NODE_OPTIONS` 等危险环境变量 |
| 5.3 | `mcp-methods.ts:319-381` | **`mcp.servers.add` 无命令验证** — 接受任意 `command` 和 `args`，可执行 `/bin/bash -c "malicious"` |

### HIGH

| # | 文件:行 | 问题描述 |
|---|---------|---------|
| 5.4 | `mcp-methods.ts:344-345` | args 数组无消毒 — `--eval`、`--require` 等参数可用于注入 |
| 5.5 | `marketplace/db.ts:37-44` | **忙等待自旋锁** — CPU 100% 阻塞事件循环最多 1 秒 |
| 5.6 | `on-demand-loader.ts:269-393` | `_activeLoads` 计数器竞态 — batch 绕过并发限制 |
| 5.7 | `on-demand-loader.ts:336-365` | addServer 和工具可用性之间的时序间隙 |

### MEDIUM

| # | 文件:行 | 问题描述 |
|---|---------|---------|
| 5.8 | `tool-bridge.ts:111-116` | MCP 工具执行时无输入 Schema 验证 |
| 5.9 | `tool-bridge.ts:37-46` | 下划线分隔符在工具名解析中有歧义 — `my_server_query` 解析为 `serverId="my"` |
| 5.10 | `registry.ts:15` | `loadFromConfig` 清除所有动态添加的服务器 |
| 5.11 | `mcp-methods.ts:103-130` | SSRF 绕过 — 未处理 IPv6-mapped IPv4 和十进制 IP |
| 5.12 | `clawdbot-tools.ts:198-206` | MCP 工具间无去重 — 同名工具互相覆盖 |
| 5.13 | `mcp-methods.ts:771-783` | 服务器启动失败仍持久化到配置 |
| 5.14 | `skills-batch.ts:241-252` | Skill 名称无消毒 |
| 5.15 | `tool-discovery.ts:127-131` | 错误日志泄露用户提示内容 |

### LOW（15 个，摘要）

- Schema 回退到空 Object 时无警告
- 健康检查定时器未 unref
- 市场索引缓存非并发安全
- 初始化失败无退避
- removeServer 不调用 unregister（内存泄漏）
- DDL 使用 prepare().run() 而非 exec()
- SKILL.md 元数据 Schema 不一致
- 配置文件非原子写入
- 工具发现和选择器错误被静默吞噬
- MCP callTool 超时 60s 不可配置
- 关闭与进行中工具调用的竞态
- 已知泄露令牌 `clawdbotCN778` 明文比较
- 大数组 spread 可能触发 Node 参数限制
- 工具列表刷新失败无重试
- listTools() 作为健康检查开销大

---

## 6. Embedding 和智能搜索推荐系统

**审查文件：** `src/memory/`, `src/dispatch/tool-index.ts`, `tool-discovery.ts`, `src/mcp/marketplace/`, `extensions/memory-lancedb/`
**发现问题：34 个**

### CRITICAL

| # | 文件:行 | 问题描述 |
|---|---------|---------|
| 6.1 | `hybrid.ts:81-84` | **BM25 分数全部截断为 1.0** — `Math.max(0, rank)` 将负数 BM25 值（好的匹配）截断为 0，`1/(1+0)=1.0`。所有关键词匹配获得相同完美分数，完全消除 BM25 排名差异。**修复：**使用 `Math.abs(rank)` |
| 6.2 | `tool-discovery.ts:118-124` | **Tool Discovery 从不传递 queryVec** — `hybridSearch` 的 `queryVec` 参数永远为空，导致向量搜索完全未使用。整个向量搜索基础设施（嵌入客户端、vec 表、向量化）全部空转 |

### HIGH

| # | 文件:行 | 问题描述 |
|---|---------|---------|
| 6.3 | `internal.ts:279-298` | **维度不匹配时静默截断** — `cosineSimilarity()` 使用 `Math.min(a.length, b.length)` 截断长向量，产生数学错误的相似度分数 |
| 6.4 | `manager-embedding-ops.ts:749`, `manager-search.ts:117` | **回退路径加载 10K chunks 为 JSON** — 每个 1536 维嵌入约 20KB JSON，最多 200MB 内存 |
| 6.5 | `manager-embedding-ops.ts:148-174` | **嵌入缓存无上限** — `maxEntries` 默认 `undefined`，缓存无限增长 |
| 6.6 | `manager.ts:41`, `search-manager.ts:12` | **全局单例缓存无 TTL 或大小限制** — 每个 `MemoryIndexManager` 持有 SQLite 连接、文件观察器和定时器 |

### MEDIUM

| # | 文件:行 | 问题描述 |
|---|---------|---------|
| 6.7 | `manager-embedding-ops.ts:74-114` | 嵌入缓存读取时不验证维度 — `dims` 列存储但从不检查 |
| 6.8 | `embeddings-voyage.ts:10` | 默认模型 `voyage-4-large` 不在令牌限制查找表中 |
| 6.9 | `tool-index.ts:172-200` | FTS5 trigram 回退到 unicode61 丢失 CJK 支持 |
| 6.10 | `tool-index.ts:910-924` | `safeExec` 静默忽略所有 SQL 错误 |
| 6.11 | `tool-index.ts:86-90` | 单例 DB 连接非线程安全 |
| 6.12 | `marketplace/db.ts:37-48` | 忙等待自旋锁（同 5.5）|
| 6.13 | `marketplace/db.ts:215-216` | `JSON.parse` 无错误处理 |
| 6.14 | `hybrid.ts:78` | 内存搜索 FTS 查询使用 AND 连接 vs 工具发现用 OR — 不一致 |

### LOW（20 个，摘要）

- `sanitizeAndNormalizeEmbedding` 零向量无警告
- 嵌入提供者无速率限制
- `computeProviderKey` 排除 API Key（不同账户共享缓存）
- UTF-8 字节估算作为 Token 代理导致 CJK 过度分块
- Sync 去重竞态窗口
- 本地嵌入批处理无单项超时
- AI 增强器 5 分钟超时无全局断路器
- Skill Hints 正则替换可能破坏 XML 标签内的匹配
- 搜索分层使用 `updatedAt`（索引时间而非内容时间）
- LanceDB L2 距离到相似度转换不精确
- LanceDB 自动捕获无跨周期去重
- LanceDB 删除使用字符串插值（虽有 UUID 验证）
- `shouldCapture` 规则对非英语内容过于宽泛
- 混合合并未归一化分数组件
- `console.debug/warn` 而非结构化日志
- FTS 搜索消毒不完整
- a2ui 为无源码映射的压缩包
- Skills/MCP 市场 `parseJsonSafe` 错误处理不一致
- 空 catch 块静默吞噬索引错误
- 时间分层中 null updatedAt 始终通过

---

## 7. Chat UI 和交互层

**审查文件：** `ui/src/ui/chat/`, `ui/src/ui/app-gateway.ts`, `app-render.ts`, `storage.ts`, `navigation.ts`, `ui/vite.config.ts`, `ui/src/styles/`
**发现问题：34 个**

### HIGH

| # | 文件:行 | 问题描述 |
|---|---------|---------|
| 7.1 | `app-gateway.ts:278-281` | **Exec 审批定时器泄露** — 重连时旧连接的 `setTimeout` 继续运行，修改新连接的 `execApprovalQueue` |
| 7.2 | `storage.ts:147` | **`isSameOrigin` HTTPS 端口回退错误** — 使用 `"80"` 而非 `"443"` 作为默认端口 |
| 7.3 | `storage.ts:128-137` | **URL 中的 Token 未清理** — 令牌保留在地址栏、浏览器历史、Referrer header 中 |
| 7.4 | `grouped-render.ts:341` | **`aria-hidden="true"` 在等待指示器上** — 屏幕阅读器用户看不到等待状态和错误信息 |
| 7.5 | `grouped-render.ts`（14+ 处）| **14+ 个硬编码中文字符串绕过 i18n** — "思考中"、"正在组织回复"、"已复制" 等，英文用户将看到中文 |

### MEDIUM

| # | 文件:行 | 问题描述 |
|---|---------|---------|
| 7.6 | `storage.ts:149` | `isSameOrigin` 解析失败返回 `true` — 应返回 `false`（安全默认）|
| 7.7 | `app-gateway.ts:187-192` | 事件间隔仅显示错误，不自动恢复 |
| 7.8 | `agents-panels-status-files.ts:295` | 硬编码 "Yes"/"No" 未使用 i18n |
| 7.9 | `components.css:107-116` | `.status-list div` 选择器过于宽泛 — 应使用 `> div` |
| 7.10 | `components.css:229-233` | 泛型 `.label` 类名 — 全局冲突 |
| 7.11 | `agents.css:317-319` | `nth-last-child(-n+3)` 边框移除假设 3 列布局 |
| 7.12 | `vite.config.ts:28` | 生产构建启用 Source Maps — 暴露完整源代码 |
| 7.13 | `grouped-render.ts:633-636` | 复制按钮 setTimeout 未存储/清理 — 快速点击时重叠 |
| 7.14 | `grouped-render.ts:33-47` | `isSilentReplyText` 过于激进 — `endsWith("NO_REPLY")` 可能隐藏合法内容 |
| 7.15 | `grouped-render.ts:568` | 图片灯箱仅响应 click — 无键盘支持 |
| 7.16 | `grouped-render.ts:602` | 思考部分切换不可键盘访问 — `<div @click>` 而非 `<button>` |
| 7.17 | 多处 | 交互元素缺少 `aria-label` |
| 7.18 | `app-gateway.ts:149-152` | 未声明属性的不安全类型转换 |
| 7.19 | `agents.css:665-679` | 响应式断点边框级联脆弱 |
| 7.20 | `app-render.ts:439,449,502` | 硬编码中文品牌/营销字符串 |

### LOW（14 个，摘要）

- FIFO 缓存无 LRU 重排序
- `handleAvatarError` 绕过 Lit 生命周期
- `navGroupsCollapsed` 内部值未验证
- `detectFirstRunSetup` 与用户导航竞态
- `handleUpgradeClick` 无防抖
- 多个并发令牌刷新
- `markdownStringCache` 大消息内存
- 硬编码 "You"
- 协议相关 URL 可通过 `isValidImageUrl`
- 非原子 docs localStorage 操作
- Dev server 绑定所有接口
- "docs" tab 未在 TAB_GROUPS 中
- 硬编码 `#6b7280` 颜色
- `isSameOrigin` 对 HTTPS 非标准端口逻辑错误

---

## 8. 多模型配置系统

**审查文件：** `src/gateway/server-methods/model-config.ts`, `src/config/provider-capability-mapping.ts`, `zod-schema.ts`, `ui/src/ui/views/model-config.ts`, `controllers/model-config.ts`
**发现问题：39 个**

### CRITICAL

| # | 文件:行 | 问题描述 |
|---|---------|---------|
| 8.1 | `model-config.ts:247`, `model-config.ts:329` | **API Key 明文传输和存储** — 无输入消毒，通过 WebSocket 传输，直接写入配置文件 |
| 8.2 | `model-config.ts:412-460` | **无认证检查** — `MODEL_CONFIG_HANDLERS` 不验证客户端是否已认证，任何 WebSocket 连接可调用 |
| 8.3 | `model-config.ts:292-351` | **读-改-写竞态** — 并发请求可互相覆盖配置更改 |
| 8.4 | `model-config.ts:42` | `loadConfig()` 是同步的但用 `await` 调用 — 误导性 async 声明 |

### HIGH

| # | 文件:行 | 问题描述 |
|---|---------|---------|
| 8.5 | `zod-schema.core.ts:41` | **Zod Schema 缺少 `"video"`** — ModelDefinition input 数组只有 `text/image`，但代码生成 `video`，配置加载时 Zod 验证将失败 |
| 8.6 | `zod-schema.ts:726-738` | `modelCapability` 缺少 `.strict()` — 允许额外属性 |
| 8.7 | `model-config.ts:304-311` | **`detectProviderModels` 对非 CN_PROVIDERS 的提供商失败** — `openai-compatible` 无 CN_PROVIDERS 条目，始终返回错误 |
| 8.8 | `model-config.ts:268-270` | **无实际 API Key 验证** — TODO 未实现，无效密钥被静默接受并保存 |
| 8.9 | `zod-schema.ts:635-644`, `types.openclaw.ts:103-110` | Zod 和 TypeScript 类型不同步 — `toolSelector` 和 `dagExecutor` 仅在 Zod 中 |
| 8.10 | `types.openclaw.ts:112-117` | Capability 键类型为 `string` 而非联合类型 — 无效键可存储 |

### MEDIUM

| # | 文件:行 | 问题描述 |
|---|---------|---------|
| 8.11 | `model-config.ts (view):623-630` | 浅拷贝 `_host()` 模式对嵌套对象修改不触发更新 |
| 8.12 | `model-config.ts (controller):369-373` | `setTimeout` 2 秒后关闭模态框 — 使用过期的 host 快照 |
| 8.13 | `model-config.ts (view):633-643` | 非活跃 Capability 卡片点击无响应 — cursor: pointer 但无操作 |
| 8.14 | `model-config.ts (view):42-46` | embedding 能力在 UI 中完全隐藏 — 用户无法配置 |
| 8.15 | `provider-capability-mapping.ts:9-14` | 缺少 `audio` 能力类型 |
| 8.16 | `model-config.ts:395-401` | Provider 列表忽略 group 排序 |
| 8.17 | `model-config.ts:174-182` | 排序对相等元素不稳定 |

### LOW（22 个，摘要）

- Provider 在 mapping 但不在 CN_PROVIDERS
- 无配置迁移
- switchCapabilityModel 成功路径未测试
- detectProviderModels 未断言 writeConfigFile
- 集成测试非确定性断言（`expect(true).toBe(true)`）
- capabilitiesToInput 丢失 embedding 信息
- 所有模型硬编码零成本
- API Key 输入用 `type="text"` 而非 `type="password"`
- Capability 名称映射前后端重复
- ProviderGroups 在 UI 中未使用（死代码）
- 控制器 Capability 类型未从后端导入
- 错误消息暴露内部细节
- autoEnabled 返回可能过期数据
- 提供商重配置时旧 Capability 指向未验证
- 默认 contextWindow/maxTokens 对 embedding/图像生成模型无意义
- 缺少 ModelScope、百度 ERNIE 等 CN 提供商
- 模型数据硬编码会过期
- 无自定义/动态提供商注册
- 单模型单能力分配
- 无能力依赖验证
- `toolDiscovery` Schema 在 Zod 中但不在 TypeScript 类型
- ProviderGroup expanded 状态不持久化

---

## 9. 扩展系统（WeChat/DingTalk/Feishu/QQ/WeCom）

**审查文件：** `extensions/openclawwechat/`, `dingtalk/`, `feishu/`, `qqbot/`, `wecom/`
**发现问题：42 个**

### CRITICAL

| # | 文件:行 | 问题描述 |
|---|---------|---------|
| 9.1 | `qqbot/webhook.js:96-106` | **QQ Bot Webhook 返回空 Ed25519 签名** — `signature: ""` 导致 HTTP 回调验证失败，Bot 无法接收消息 |
| 9.2 | `dingtalk/webhook.js:28-51` | **DingTalk 签名验证可选** — 未配置 `signSecret` 时任何请求都被接受 |
| 9.3 | `qqbot/webhook.js:57-81` | **QQ Bot 签名验证可选** — 未配置 `publicKey` 时无验证 |
| 9.4 | `openclawwechat/media-handler.js:36-44` | **路径遍历** — `resolveMediaPath` 未验证路径在 workspace 内，`../../etc/passwd` 可读取任意文件 |
| 9.5 | `dingtalk/media-upload.js:32-41` | **路径遍历** — `toLocalPath` 接受任意协议前缀转为本地路径，可上传系统文件到 DingTalk |
| 9.6 | `wecom/webhook.js:272-280` | **XML CDATA 注入** — `content` 包含 `]]>` 时破坏 XML 结构 |

### HIGH

| # | 文件:行 | 问题描述 |
|---|---------|---------|
| 9.7 | `dingtalk/webhook.js:10-16`, `feishu/webhook.js:20-26`, `qqbot/webhook.js:36-42` | **无请求体大小限制** — 可发送超大 POST 体导致内存耗尽（WeCom 正确限制 1MB）|
| 9.8 | `qqbot/channel.js:229-235` | **QQ Bot onMessage 永不处理消息** — 回调仅更新时间戳，整个入站消息处理为空操作 |
| 9.9 | `dingtalk/stream-client.js:217-222` | **错误详情泄露给用户** — 原始错误（含堆栈跟踪、内部 URL）直接发送到钉钉聊天 |
| 9.10 | `dingtalk/api.js:1-20` | 全局单例 Token 缓存 — 多应用共享进程时返回错误 Token |
| 9.11 | `qqbot/api.js:3-34` | 同上（QQ Bot）|
| 9.12 | `dingtalk/webhook.js:39` | 时间戳重放窗口 1 小时 — 应限制为 5 分钟 |
| 9.13 | `feishu/webhook.js:68-73` | Feishu 验证令牌未配置时全部绕过 |
| 9.14 | 多处 | API Key/Access Token 在 URL 中（WeChat/WeCom/DingTalk）|

### MEDIUM

| # | 文件:行 | 问题描述 |
|---|---------|---------|
| 9.15 | `anti-detection.js:98-112` | 速率限制是全局的而非按用户 — `openid` 参数被忽略 |
| 9.16 | `anti-detection.js` | 反检测服务定义但从未使用 |
| 9.17 | `message-injector.js:152` | 输入指示器只有 "start" 无 "stop" |
| 9.18 | `wecom/channel.js:24-34` | `checkBotMentioned` 匹配任何 @ — 邮箱地址也会触发 |
| 9.19 | 所有扩展 | 无消息去重 — Feishu 文档明确警告可能重复投递 |
| 9.20 | `polling.js:65-120` | 并发轮询消息处理无背压机制 |
| 9.21 | `dingtalk/channel.js:14,53-63` | Session Webhook 缓存无限增长（懒清除）|
| 9.22 | `polling.js:124-135` | markProcessed 响应状态未检查 |
| 9.23 | `stream-client.js:83-88` | SSE 流 JSON 解析错误静默吞噬 |
| 9.24 | 多处 | 日志注入 — 用户消息内容未消毒直接写入日志 |

### LOW（14 个，摘要）

- 不一致的 readBody 实现（4 处）
- 不一致的运行时单例模式（5 个扩展重复）
- 不一致的生命周期管理 — QQ Bot 用 cleanup 模式 vs 其他用 abortSignal
- 不一致的 replyOptions
- 无 Token 刷新重试
- DingTalk 双 Token 缓存不同步
- 硬编码 DingTalk AI Card 模板 ID
- WeChat 配置 Schema 不强制 API Key 格式
- pollIntervalMs 无上限
- Feishu index.js 混淆 — 安全审计困难
- WeChat stopAccount 不停止轮询
- 反检测记录在无回复时永不清理
- DingTalk Session Manager 清理定时器永不停止
- 轮询定时器在错误时可能泄露

---

## 10. Agent 工具和桌面控制

**审查文件：** `src/agents/tools/desktop-control.ts`, `open-app.ts`, `wechat-*.ts`, `wecom-*.ts`, `openclaw-tools.ts`, `clawdbot-tools.ts`
**发现问题：34 个**

### CRITICAL

| # | 文件:行 | 问题描述 |
|---|---------|---------|
| 10.1 | `desktop-control.ts:544-546` | **PowerShell 通配符注入** — `$Window` 在 `-like` 模式中未转义，含 `[]*?` 的窗口标题可注入通配符 |

### HIGH

| # | 文件:行 | 问题描述 |
|---|---------|---------|
| 10.2 | `desktop-control.ts:935-992` | **桌面控制无限制** — 可发送 `Alt+F4`、`Win+R`、在终端输入命令等，无操作白名单或确认 |
| 10.3 | `open-app.ts:717-736` | **可启动危险系统可执行文件** — NON_APP_EXES 黑名单缺少 `regedit`、`netsh`、`sc`、`rundll32`、`certutil` 等 |
| 10.4 | `desktop-control.ts:462-473` | **剪贴板污染** — clipboard 粘贴模式修改系统剪贴板后不恢复 |
| 10.5 | 所有 WeChat/WeCom 工具 | **无互斥锁** — 并发调用竞争窗口焦点、在错误窗口输入、截取错误状态 |
| 10.6 | `clawdbot-tools.ts:87-92` | **桌面工具不尊重 sandboxed 标志** — 沙箱化 Agent 仍获得桌面控制权限 |
| 10.7 | `wechat-read.ts:205-232` | **API Key 直接从 models.json 读取** — 绕过认证基础设施 |

### MEDIUM

| # | 文件:行 | 问题描述 |
|---|---------|---------|
| 10.8 | `desktop-control.ts:697-698` | 点击坐标无边界验证 |
| 10.9 | `desktop-control.ts:749` | 输入文本无长度限制 — 超长文本可导致 PowerShell 内存耗尽 |
| 10.10 | `wechat-read.ts:348,358` | 临时截图文件未清理 |
| 10.11 | `wecom-helpers.ts:138-153` | `screenshotToFile` 临时文件泄露 |
| 10.12 | `wechat-send.ts:148-151` | 搜索联系人后不验证是否选中正确联系人 |
| 10.13 | `wechat-check.ts:63-79` | `runHelper` 返回值未检查 — 错误静默忽略 |
| 10.14 | `wecom-read.ts:143-146` | 不检查平台 — 非 Windows 上仍创建工具 |
| 10.15 | `desktop-control.ts:217-224` | DPI 感知使用旧 API — 多显示器不同 DPI 时坐标错误 |
| 10.16 | `desktop-control.ts:370-381` | 截图使用 CopyFromScreen — 重叠窗口内容会被捕获 |
| 10.17 | `wecom-helpers.ts:300-323` | Vision 缓存无大小限制 |
| 10.18 | `wecom-helpers.ts:555-556` | Reply tracker 永不清理 |
| 10.19 | `wecom-handoff.ts:37-51` | 文件读写 TOCTOU 竞态 |
| 10.20 | `wechat-check.ts:48-57`, `wecom-helpers.ts:55-105` | 硬编码像素偏移 — DPI/主题/更新变化时失效 |
| 10.21 | `open-app.ts:728-729` | URL 参数无协议验证 — 可传 `javascript:` 或 `file:///` |
| 10.22 | `desktop-control.ts:165,629` | `-ExecutionPolicy Bypass` 覆盖系统级策略 |
| 10.23 | 工具超时 | 不一致 — screenshot 15s, click 5s, list_windows 8s，无明确原因 |
| 10.24 | `wechat-send.ts:195` | 消息全文包含在工具结果 details — 可能被日志记录 |
| 10.25 | `wechat-read.ts:263-265` | API 错误响应可能包含认证信息 |

### LOW（8 个，摘要）

- `scroll_pages` 文档说 max 5 但代码允许 10
- `wechat_read` count 参数未在执行函数中 clamp
- 旧版本 Helper 脚本不清理
- `execFileSync` 超时不保证子进程被杀
- `open_app` 不支持 Linux
- 截图 base64 可达 60MB/次调用
- WeChat 工具重复代码（7 个函数 × 3 个文件）
- `clawdbot-tools.ts` 和 `openclaw-tools.ts` 几乎相同

---

## 11. 优先修复建议

### 立即修复（CRITICAL — 安全）

1. **轮换并移除 `ci/config.json` 中的凭证** — 将 Gitee token 和 webhook secret 移到环境变量
2. **修复 Delta 更新路径遍历** — `installer-updater.ts:315` 添加路径验证：
   ```typescript
   const resolved = path.resolve(root, entry.path);
   if (!resolved.startsWith(path.resolve(root) + path.sep)) {
     throw new Error(`Path traversal detected: ${entry.path}`);
   }
   ```
3. **MCP servers.add 命令白名单** — 限制 `command` 为 `npx`/`uvx`/`node`/`python` 等安全命令
4. **修复 QQ Bot 空签名** — 实现 Ed25519 签名计算
5. **修复 BM25 分数截断** — `hybrid.ts:83` 改为 `Math.abs(rank)`
6. **Tool Discovery 传递查询向量** — 在 `discoverTools` 中嵌入查询并传递 `queryVec`

### 短期修复（HIGH — 1-2 周）

7. **HTTPS 更新服务器** — 将所有 `http://47.98.123.45` 替换为 `https://dl.openclawcn.com`
8. **实现更新签名验证** — 嵌入公钥，验证 `latest.json` 签名
9. **添加并发更新锁** — 使用 lockfile 防止多个更新同时执行
10. **MCP configEnv 安全过滤** — 阻止 `LD_PRELOAD`、`NODE_OPTIONS` 等危险变量
11. **Webhook 认证强制化** — 未配置密钥时拒绝请求而非静默跳过
12. **桌面工具互斥锁** — 全局锁序列化所有桌面操作
13. **扩展 open_app 黑名单** — 添加 `regedit`、`netsh`、`rundll32` 等
14. **API Key 输入改用 `type="password"`**
15. **Zod Schema 添加 `"video"`** — `zod-schema.core.ts:41`

### 中期修复（MEDIUM — 1 个月）

16. 统一三条构建路径为单一 Tauri 管道
17. 实现代码签名（Windows + macOS）
18. 添加 i18n 支持到所有硬编码中文字符串
19. 修复 `isSameOrigin` 端口逻辑
20. URL Token 提取后清理
21. 嵌入缓存添加 maxEntries 默认值
22. 扩展 Webhook 添加请求体大小限制
23. 实现消息去重
24. 修复 QQ Bot onMessage 实际处理消息
25. 桌面工具尊重 sandboxed 标志

### 长期改进（LOW — 持续）

- 统一 WeChat 工具辅助函数到共享模块
- 合并 clawdbot-tools.ts 和 openclaw-tools.ts
- 使用 UIAutomation API 替代硬编码像素偏移
- 实现动态提供商注册
- 添加 audio 能力类型
- 周期性清理过期缓存和临时文件
- 结构化日志替代 console.debug/warn

---

*报告生成：2026-02-19 by 10-Agent Deep Review System*
