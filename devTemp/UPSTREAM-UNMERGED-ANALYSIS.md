# OpenClaw 上游未合并内容深度分析报告

> 调研日期：2026-02-12
> 分析人：Claude Opus 4.6
> 目标：为中国小白用户（无外网）提供完整的上游融合方案

---

## 一、全局概况

| 维度 | 数据 |
|------|------|
| 上游未合并 commit 数 | **4103** 条 |
| 其中 feat（新功能） | **438** 条 |
| 其中 fix（修复） | **1515** 条 |
| 差异文件数 | **7294** 个文件 |
| 代码变更量 | +372,803 / -701,395 行 |
| 已完成合并批次 | v2 Batch 1-7（28 项已合并，12 项跳过，17 项延期） |

**结论**：上游与 CN 版差异巨大，不适合直接 `git merge`。必须继续采用 **选择性 cherry-pick + 手动移植** 策略。

---

## 二、上游未合并内容分类（按优先级排序）

### P0 - 必须合并（安全 + 核心稳定性）

| 编号 | 上游提交 | 说明 | CN 现状 | 建议 |
|------|---------|------|---------|------|
| **S-01** | `fix: Gateway canvas host bypasses auth` | Gateway 画布未授权访问漏洞 | CN 未修 | **立即移植** |
| **S-02** | `fix(gateway): require auth for canvas host and a2ui assets (#9518)` | 画布/A2UI 资源鉴权 | CN 未修 | **立即移植** |
| **S-03** | `fix(auto-reply): prevent sender spoofing in group prompts` | 群聊发送者伪造防护 | CN Batch 7 部分覆盖 | **评估增量** |
| **S-04** | `fix: enforce Discord agent component DM auth (#11254)` | Discord 组件 DM 鉴权 | CN 已有 exec-approvals 修复 | **评估是否覆盖** |
| **S-05** | `refactor(security,config): split oversized files (#13182)` | 安全/配置文件拆分 | CN 文件未拆 | **中期移植** |
| **S-06** | `fix(auth): strip line breaks from pasted keys` | API Key 换行符修复 | CN 已有 normalize-secret-input | **确认覆盖** |
| **S-07** | `(fix): enforce embedding model token limit to prevent overflow` | 嵌入模型 token 溢出 | CN 未修 | **立即移植** |

### P1 - 强烈推荐（功能增强）

| 编号 | 上游提交 | 说明 | CN 价值 |
|------|---------|------|---------|
| **F-01** | `feat(gateway): stream thinking events (#10568)` | Gateway WebSocket 流式思考 + 工具事件 | 提升用户体验，Web UI 实时感知 |
| **F-02** | `feat(onboard): add custom/local API configuration flow (#11106)` | 自定义/本地 API 配置向导 | **CN 核心需求** - 国产模型配置 |
| **F-03** | `feat(hooks): add agentId support to webhook mappings (#13672)` | Webhook 映射 agentId 支持 | 多 Agent 场景 |
| **F-04** | `Heartbeat: inject cron-style current time into prompts (#13733)` | 心跳注入时间到 prompt | 定时任务感知 |
| **F-05** | `feat: add zai/glm-4.6v image understanding (#10267)` | 智谱 GLM 图像理解 | **CN 直接适用** |
| **F-06** | `feat(onboard): custom/local API config` + `Onboard: rename to Custom Provider` | 自定义 Provider 入口 | 降低国产模型配置门槛 |
| **F-07** | `feat: adding support for Together ai provider (#10304)` | Together AI 支持 | 有 Kimi-K2.5 模型 |
| **F-08** | `feat: add cloudflare ai gateway provider` | Cloudflare AI 网关 | 国内可用 CF 节点 |
| **F-09** | `feat(memory): native Voyage AI support (#7078)` | Voyage 嵌入模型原生支持 | 增强记忆系统 |
| **F-10** | `Config: migrate legacy top-level memorySearch` | memorySearch 配置迁移 | 配置规范化 |

### P1 - 通道/平台修复

| 编号 | 上游提交 | 说明 | CN 价值 |
|------|---------|------|---------|
| **CH-01** | `feat: IRC — add first-class channel support` | IRC 频道支持 | 新通道，可选 |
| **CH-02** | `Fix matrix media attachments (#12967)` | Matrix 媒体附件修复 | 如用 Matrix 则必要 |
| **CH-03** | `feat(matrix): add thread session isolation (#8241)` | Matrix 线程会话隔离 | 如用 Matrix 则重要 |
| **CH-04** | `discord: auto-create thread for Forum/Media (#12380)` | Discord 论坛自动建线程 | 社区运营场景 |
| **CH-05** | Telegram 系列修复（8+ 提交） | quote 解析、命令截断、DM allowFrom 等 | Telegram 用户必要 |
| **CH-06** | `feat(feishu): sync community contributions (#12662)` | 飞书社区版同步（10 个提交） | **CN 核心** - 需与本地 18 文件对比 |
| **CH-07** | `fix: preserve original filename for WhatsApp docs (#12691)` | WhatsApp 文档原始文件名保留 | WhatsApp 用户 |

### P2 - 基础设施改进

| 编号 | 上游提交 | 说明 | CN 价值 |
|------|---------|------|---------|
| **I-01** | `feat: ClawDock - shell docker helpers (#12817)` | Docker 开发辅助脚本 | 降低 Docker 门槛 |
| **I-02** | `Docker: include A2UI sources for bundle (#13114)` | Docker 镜像含 A2UI | Web UI 完整性 |
| **I-03** | `Gateway/Plugins: device pairing + phone control (#11755)` | 设备配对 + 手机控制 | 未来移动端 |
| **I-04** | `Gateway: eager-init QMD backend on startup` | QMD 预初始化 | 启动性能 |
| **I-05** | `fix(gateway): use LAN IP for WebSocket/probe URLs (#11448)` | 局域网 WebSocket 地址 | 内网部署场景 |
| **I-06** | `feat(gateway): add agents.create/update/delete methods (#11045)` | Agent CRUD API | 管理后台功能 |

### P3 - 可延期项

| 类别 | 数量 | 说明 |
|------|------|------|
| CI/CD 改进 | ~30 | GitHub Actions 优化、stale 自动化、Docker Release 等 |
| 文档更新 | ~50 | CONTRIBUTING、SECURITY、CHANGELOG 等 |
| 代码整理 | ~20 | 重命名、去重、格式化等 |
| Revert 提交 | 3 | credits 相关 revert，无需关注 |
| macOS 专属 | ~10 | SwiftUI、TestFlight 等 |

---

## 三、中国用户"无外网"镜像下载方案

### 3.1 已建成基础设施

| 设施 | 状态 | 地址 |
|------|------|------|
| NPM 镜像 | ✅ 运行中 | `registry.npmmirror.com` (已配 .npmrc) |
| 阿里云二进制服务器 | ⚠️ 部分部署 | `121.43.61.90` (signal-cli 已部署) |
| obplugins.cn 反代 | ✅ 运行中 | 阿里云→香港透传 |
| Gitee 仓库镜像 | ✅ 运行中 | `gitee.com/tecbinai/clawd-cn` |
| 阿里云盘离线包 | ✅ 已有 | download-guide-web.md 中记录 |

### 3.2 完整镜像下载方案设计

#### 方案 A：全量离线包（推荐小白用户）

```
clawdbotCN-offline-v2026.2.x/
├── clawdbotCN-source.tar.gz          # 源码包（不含 node_modules）
├── node_modules_cache.tar.gz          # pnpm store 缓存快照
├── binaries/                          # 预编译二进制
│   ├── windows-x64/
│   │   ├── signal-cli-0.13.x.zip
│   │   ├── ffmpeg-7.x.zip
│   │   ├── sherpa-onnx-x.x.zip
│   │   ├── gh-2.x.zip
│   │   └── uv-0.x.zip
│   ├── linux-x64/
│   │   └── ... (同上)
│   └── darwin-universal/
│       └── ... (同上)
├── docker/
│   ├── clawdbot-gateway-latest.tar    # docker save 的镜像
│   └── docker-compose.china.yml       # 中国专用 compose
├── models/                            # 可选：本地模型
│   └── README.md                      # 国产模型 API 配置指南
├── INSTALL-OFFLINE.md                 # 离线安装指南
└── verify.sh / verify.ps1             # SHA256 校验脚本
```

**制作流程**：
```bash
# 1. 在有外网的机器上打包 pnpm store
pnpm store path        # 找到 store 路径
tar czf node_modules_cache.tar.gz $(pnpm store path)

# 2. 导出 Docker 镜像
docker pull clawdbot/gateway:latest
docker save clawdbot/gateway:latest > clawdbot-gateway-latest.tar

# 3. 下载二进制工具
# 按 docs/clawdskillsproxy-new-endpoints-requirement.md 中定义的工具列表

# 4. 打包源码（排除 .git 和 node_modules）
tar czf clawdbotCN-source.tar.gz --exclude='.git' --exclude='node_modules' .

# 5. 计算校验和
sha256sum *.tar.gz *.tar binaries/**/* > SHA256SUMS
```

**安装流程**：
```bash
# 1. 解压源码
tar xzf clawdbotCN-source.tar.gz -C ~/clawdbot

# 2. 恢复 pnpm store（免下载安装）
pnpm store path  # 确认 store 路径
tar xzf node_modules_cache.tar.gz -C /  # 恢复到原始路径
cd ~/clawdbot && pnpm install --offline

# 3. 加载 Docker 镜像（如用 Docker）
docker load < clawdbot-gateway-latest.tar

# 4. 放置二进制工具
cp binaries/windows-x64/* ~/.clawdbot/bin/
```

#### 方案 B：Gitee + 阿里云盘（推荐团队）

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  GitHub 上游     │     │   构建服务器       │     │  国内分发        │
│  (openclaw/      │────▶│   (有外网)        │────▶│                 │
│   openclaw)      │     │                   │     │  Gitee 仓库     │
└─────────────────┘     │  定期 fetch        │     │  阿里云盘       │
                        │  选择性 cherry-pick │     │  阿里云 OSS     │
                        │  pnpm 离线打包      │     │  obplugins.cn   │
                        │  Docker 导出        │     └─────────────────┘
                        └──────────────────┘
```

**自动化同步脚本**：
```bash
#!/bin/bash
# sync-upstream-cn.sh - 在有外网机器上运行

set -euo pipefail

UPSTREAM_REPO="https://github.com/openclaw/openclaw.git"
CN_REPO="https://gitee.com/tecbinai/clawd-cn.git"
WORK_DIR="/data/clawdbot-sync"

# 1. 拉取上游最新
cd "$WORK_DIR"
git fetch upstream
echo "上游新提交数: $(git log --oneline upstream/main --not master | wc -l)"

# 2. 生成待评审列表
git log --oneline upstream/main --not master \
  --format="| %h | %s | %ai |" > /tmp/pending-review.md

# 3. npm 依赖缓存
pnpm install --frozen-lockfile
pnpm store prune
tar czf "/data/releases/node_modules_$(date +%Y%m%d).tar.gz" \
  "$(pnpm store path)"

# 4. Docker 镜像
docker build -t clawdbot/gateway:cn-latest .
docker save clawdbot/gateway:cn-latest | \
  gzip > "/data/releases/docker-cn-$(date +%Y%m%d).tar.gz"

# 5. 推送到 Gitee
git push gitee master

echo "同步完成，文件已生成到 /data/releases/"
```

#### 方案 C：Docker 一键部署（推荐零基础用户）

创建一个专门的 `docker-compose.china.yml`：

```yaml
# docker-compose.china.yml
version: "3.8"
services:
  clawdbot:
    image: clawdbot/gateway:cn-latest
    # 或从本地加载: docker load < clawdbot-gateway-cn.tar
    ports:
      - "${CLAWDBOT_GATEWAY_PORT:-18789}:18789"
    volumes:
      - clawdbot-data:/data
      - clawdbot-workspace:/workspace
    environment:
      # ===== 国产模型配置（选一个即可）=====
      # --- 智谱 GLM（有免费额度）---
      CLAWDBOT_MODEL_PROVIDER: "openai"
      CLAWDBOT_MODEL_ID: "glm-4-flash-250414"
      CLAWDBOT_BASE_URL: "https://open.bigmodel.cn/api/paas/v4"
      CLAWDBOT_API_KEY: "${GLM_API_KEY}"

      # --- 或 DeepSeek ---
      # CLAWDBOT_MODEL_PROVIDER: "openai"
      # CLAWDBOT_MODEL_ID: "deepseek-chat"
      # CLAWDBOT_BASE_URL: "https://api.deepseek.com"
      # CLAWDBOT_API_KEY: "${DEEPSEEK_API_KEY}"

      # --- 或 通义千问 ---
      # CLAWDBOT_MODEL_PROVIDER: "openai"
      # CLAWDBOT_MODEL_ID: "qwen-max"
      # CLAWDBOT_BASE_URL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
      # CLAWDBOT_API_KEY: "${DASHSCOPE_API_KEY}"

      # ===== 企业 IM 渠道（按需配置）=====
      # 飞书
      FEISHU_APP_ID: "${FEISHU_APP_ID:-}"
      FEISHU_APP_SECRET: "${FEISHU_APP_SECRET:-}"
      # 钉钉
      DINGTALK_CLIENT_ID: "${DINGTALK_CLIENT_ID:-}"
      DINGTALK_CLIENT_SECRET: "${DINGTALK_CLIENT_SECRET:-}"

      # ===== Gateway =====
      CLAWDBOT_GATEWAY_TOKEN: "${CLAWDBOT_GATEWAY_TOKEN:-changeme}"
      CLAWDBOT_GATEWAY_BIND: "0.0.0.0"

    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:18789/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  clawdbot-data:
  clawdbot-workspace:
```

---

## 四、NPM 依赖镜像策略

### 4.1 已配置（.npmrc）
```ini
registry=https://registry.npmmirror.com
```

### 4.2 特殊依赖处理

以下依赖含有二进制组件或 GitHub 源码，npmmirror 可能不完整：

| 依赖 | 问题 | 解决方案 |
|------|------|---------|
| `sharp` (0.34.5) | 含 libvips 预编译二进制 | npmmirror 有二进制镜像，配置 `SHARP_DIST_BASE_URL` |
| `@napi-rs/canvas` | NAPI 预编译 | npmmirror 通常支持 |
| `sqlite-vec` (0.1.7-alpha.2) | 含 SQLite 扩展二进制 | 需提前下载 prebuild |
| `chromium-bidi` / `playwright-core` | 需下载 Chromium | 配置 `PLAYWRIGHT_BROWSERS_PATH` + 离线浏览器 |
| `node-llama-cpp` | 需下载 GGUF 模型 | 国内 HuggingFace 镜像(hf-mirror.com) |
| `signal-cli` | Java 二进制 | 已部署到阿里云 121.43.61.90 |
| `proper-lockfile` | 有自定义 patch | pnpm patch 文件在 `patches/` 目录 |

**推荐 .npmrc 完整配置**：
```ini
registry=https://registry.npmmirror.com

# Sharp 二进制镜像
sharp_binary_host=https://npmmirror.com/mirrors/sharp
sharp_libvips_binary_host=https://npmmirror.com/mirrors/sharp-libvips

# Playwright 浏览器（离线模式）
PLAYWRIGHT_BROWSERS_PATH=~/.clawdbot/browsers
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Electron（如需桌面版）
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/

# Node 预编译
node_pre_gyp_binary_host=https://npmmirror.com/mirrors/node-pre-gyp
```

---

## 五、上游未合并内容的技术栈兼容性分析

### 5.1 完全兼容（可直接移植）

| 上游功能 | CN 技术栈匹配 | 移植难度 |
|---------|-------------|---------|
| Gateway stream thinking (#10568) | Hono 4.11.4 WebSocket | ⭐ 低 |
| Custom/Local API onboard (#11106) | 已有国产模型配置体系 | ⭐ 低 |
| GLM-4.6v 图像理解 (#10267) | 已配智谱 API | ⭐ 低 |
| Embedding token limit fix (#13455) | 已有 memory 系统 | ⭐ 低 |
| memorySearch config 迁移 | 配置系统兼容 | ⭐ 低 |
| Heartbeat time injection (#13733) | 心跳系统兼容 | ⭐ 低 |
| WebSocket LAN IP (#11448) | 内网部署场景高价值 | ⭐ 低 |
| Telegram 系列修复 | Telegram 通道完整 | ⭐⭐ 中 |

### 5.2 需要适配（有冲突或差异）

| 上游功能 | 冲突点 | 解决方案 |
|---------|--------|---------|
| Feishu 社区同步 (10 commits) | CN 有 18 文件本地实现 vs 上游社区插件 | 逐文件对比，取优 |
| Security/Config 拆分 (#13182) | CN 文件结构不同 | 手动拆分，保留 CN 路径 |
| session maintenance (#13083) | CN 已评估为低 ROI | 仅移植轻量部分 |
| ClawDock Docker helpers (#12817) | CN 有独立 docker remote | 评估是否替换 |
| Together AI provider (#10304) | CN 有自己的 provider 体系 | 集成到 models-config |
| IRC channel | CN 不常用 IRC | 延期 |

### 5.3 不兼容 / 无需移植

| 上游功能 | 原因 |
|---------|------|
| macOS TestFlight auto-response | CN 无 TestFlight |
| CI stale automation | CN 用 Gitee CI |
| Credits/Maintainers 管理 | CN 团队独立 |
| CONTRIBUTING/PR_WORKFLOW docs | CN 有自己的流程 |
| Code size gates CI | CN 构建流程不同 |

---

## 六、推荐的下一步行动计划

### 第一阶段：安全修复（1-2 天）
1. ✅ 移植 S-01/S-02 Gateway canvas auth 漏洞修复
2. ✅ 移植 S-07 embedding token 溢出修复
3. ✅ 评估 S-03 sender spoofing 与 Batch 7 的覆盖关系

### 第二阶段：核心功能（3-5 天）
4. 移植 F-01 Gateway stream thinking
5. 移植 F-02 自定义 Provider onboard 向导
6. 移植 F-05 GLM-4.6v 图像理解
7. 移植 F-09/F-10 Voyage AI + memorySearch 迁移

### 第三阶段：通道修复（3-5 天）
8. Telegram 全量修复包（8+ commits）
9. Feishu 社区 vs 本地版本对比评审
10. Matrix 媒体附件 + 线程隔离

### 第四阶段：基础设施（持续）
11. 完善阿里云二进制服务器（部署 ffmpeg/gh/uv/rclone）
12. Docker 中国专用镜像构建
13. 全量离线包制作与分发

### 第五阶段：离线包制作（每个版本）
14. 自动化打包脚本
15. 阿里云盘 + Gitee Release 分发
16. SHA256 校验 + 安装向导

---

## 七、关键依赖的国内镜像替代方案

| 原始源 | 国内替代 | 用途 |
|--------|---------|------|
| `registry.npmjs.org` | `registry.npmmirror.com` | NPM 包 |
| `github.com` | `gitee.com` / `gh-proxy.com` / `ghfast.top` | 源码 |
| `raw.githubusercontent.com` | `gh-proxy.com` 代理 | GitHub 原始文件 |
| `huggingface.co` | `hf-mirror.com` | 模型文件 |
| `ghcr.io` (Docker) | `dockerhub.icu` / 阿里云 ACR | 容器镜像 |
| `docker.io` | `mirror.ccs.tencentyun.com` | Docker Hub |
| `pypi.org` | `mirrors.ustc.edu.cn/pypi` | Python 包 |
| `proxy.golang.org` | `goproxy.cn` | Go 模块 |
| `brew.sh` | `mirrors.ustc.edu.cn/brew` | Homebrew |
| `dl.google.com/go` | `golang.google.cn/dl` | Go 安装 |
| `nodejs.org` | `npmmirror.com/mirrors/node` | Node.js |

---

## 八、总结

### 核心结论

1. **上游差距大**（4103 commits），但大部分是 CI/文档/Revert，**真正有价值的约 80-100 个功能/修复提交**
2. **7 个安全修复需立即评估**，特别是 Gateway canvas auth 漏洞
3. **中国用户离线方案已有 70% 基础**，核心缺失的是：
   - 全量离线打包脚本（方案 A）
   - 阿里云二进制服务器剩余 5 个工具的部署
   - Docker 中国专用镜像的自动化构建
4. **飞书通道**是最大的合并难点——上游有 10 个社区贡献提交，CN 有 18 文件本地实现，需要逐文件人工对比
5. **国产模型集成**已经很完善（7 个提供商），上游的 `onboard custom provider` 向导可以直接增强 CN 的配置体验

### 给小白用户的话

> 如果你在国内无法访问 GitHub：
> 1. 从 **Gitee** (`gitee.com/tecbinai/clawd-cn`) 获取源码
> 2. 从 **阿里云盘** 下载离线安装包（含所有依赖）
> 3. 使用 **Docker 一键部署**（`docker-compose.china.yml`）
> 4. 模型用 **智谱 GLM**（免费）或 **DeepSeek**（便宜）
> 5. NPM 已自动走 **淘宝镜像**，无需配置
