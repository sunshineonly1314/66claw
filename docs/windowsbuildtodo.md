# Windows 构建 - 国内镜像优化方案

> 更新时间: 2026-02-02 16:00

## 核心问题

**国内用户无法访问 GitHub**，安装过程中需要下载的工具全部失败。

---

## 需要从 GitHub 下载的包

| 包名 | 用途 | 类型 | 大小 | 国内替代方案 |
|------|------|------|------|-------------|
| **uv** | Python 包管理器 | 二进制 + 脚本 | ~15-20MB | ✅ `pip install uv` (PyPI 镜像有) |
| **fnm** | Node.js 版本管理器 | 二进制 + 脚本 | ~5-8MB | ⚠️ 打包二进制 / 使用系统 Node |
| **Homebrew** | macOS 包管理器 | 安装脚本 | N/A | 仅 macOS，中国有镜像 |

### uv 详情

- **作用**: 安装 Python 包（比 pip 快 10-100 倍）
- **使用场景**: 安装 Python 类技能的依赖（如 PDF工具、Whisper 等）
- **官网**: https://github.com/astral-sh/uv
- **国内方案**: `pip install uv -i https://pypi.tuna.tsinghua.edu.cn/simple` ✅ 已实现

### fnm 详情

- **作用**: Node.js 版本管理器
- **使用场景**: 安装 Node.js 类技能的依赖
- **官网**: https://github.com/Schniz/fnm
- **国内方案**: 
  1. Windows 原生版已预打包 Node.js，无需 fnm
  2. Linux/macOS: 考虑打包二进制到 ClawdSkillsProxy

---

## 已完成的国内镜像配置

### 1. Windows 原生离线版 (2026-02-02)

| 组件 | 镜像源 | 状态 |
|------|--------|------|
| npm | npmmirror.com | ✅ 129ms |
| Node.js | npmmirror.com/mirrors/node | ✅ 199ms |
| Skills | ClawdSkillsProxy (121.43.61.90) | ✅ 410ms |
| node_modules | 预打包到安装包 | ✅ ~387MB |

### 2. 启动脚本更新

所有启动脚本已添加环境变量：
```batch
set "OPENCLAWCN_REGION=cn"
```

这会自动启用：
- npm 使用国内镜像
- Skills 从 ClawdSkillsProxy 下载
- uv 通过 pip 安装（使用 PyPI 镜像）

### 3. uv 安装逻辑更新 (`src/agents/skills-install.ts`)

**Windows 安装顺序**:
1. ✅ `pip install uv` (使用清华/阿里云 PyPI 镜像) - **最可靠**
2. ⚠️ `winget install astral-sh.uv`
3. ❌ PowerShell 脚本 (GitHub 代理不稳定)

**Linux 安装顺序**:
1. ✅ `pip install uv` (使用 PyPI 镜像) - **最可靠**
2. ❌ curl 脚本 (GitHub 代理不稳定)

**macOS 安装顺序**:
1. ✅ `brew install uv` - 可靠

---

## GitHub 代理状态 (2026-02-02 测试)

| 镜像 | 状态 | 说明 |
|------|------|------|
| ghproxy.cn | ⚠️ 不稳定 | 首页 302，代理文件可能 404 |
| gh.con.sh | ❌ 暂停服务 | 重定向到 /suspent.txt |
| gh.ddlc.top | ❌ 404 | 代理失败 |
| ghps.cc | ❌ 超时 | 已失效 |
| mirror.ghproxy.com | ❌ 超时 | |
| ghproxy.net | ❌ 403 | 被封禁 |
| fastgit.org | ❌ 关闭 | 显示 Goodbye 页面 |
| jsdelivr | ❌ 超时 | |

**结论**: GitHub 代理全部不可靠，必须使用替代方案。

---

## 国内包管理镜像 (全部可用)

| 镜像 | 状态 | 响应时间 | 用途 |
|------|------|---------|------|
| **中科大 PyPI** | ✅ | 66ms | pip/uv |
| **阿里云 PyPI** | ✅ | 80ms | pip/uv |
| **淘宝 npm** | ✅ | 82ms | npm |
| 字节跳动 Rust | ✅ | 137ms | cargo |
| 清华 PyPI | ✅ | 155ms | pip/uv |
| 七牛云 Go | ✅ | 195ms | go get |

---

## Windows 原生离线版打包流程

### 打包脚本

```powershell
# 使用国内镜像打包
.\scripts\windows\build-offline-cn.ps1 -Version "2026.2.2"

# 跳过构建（已构建时）
.\scripts\windows\build-offline-cn.ps1 -Version "2026.2.2" -SkipBuild -SkipNodeModules
```

### 打包文件清单

| 文件 | 用途 |
|------|------|
| `scripts/windows/setup.iss` | Inno Setup 配置 |
| `scripts/windows/post-install-source.txt` | 安装后脚本 (UTF-8) |
| `scripts/windows/post-install.bat` | 安装后脚本 (GBK) |
| `scripts/windows/start-gateway.bat` | Gateway 启动脚本 |
| `scripts/windows/convert-encoding.ps1` | GBK 编码转换工具 |
| `scripts/windows/build-offline-cn.ps1` | 国内镜像打包脚本 |

### 输出

```
E:\clawdbuild\OpenClawCN-Setup-2026.2.2-x64.exe (~105MB)
```

---

## 待完成工作

### 1. fnm 国内替代方案 ✅ 已解决

**已实现**: Linux 优先使用系统包管理器安装 Node.js，避免依赖 GitHub

**安装顺序** (`src/agents/skills-install.ts`):
1. ✅ `apt-get install nodejs npm` (Debian/Ubuntu)
2. ✅ `dnf/yum install nodejs npm` (RHEL/CentOS/Fedora)  
3. ✅ `pacman -S nodejs npm` (Arch Linux)
4. ⚠️ fnm (GitHub 代理，最后备选)

**优势**:
- 系统包管理器在国内都可用，无需 GitHub
- 大多数 Linux 用户已有包管理器
- fnm 作为最后备选，仅在前三种方法都失败时使用

### 2. ClawdSkillsProxy 二进制托管 ⚠️ 需要后端支持

> **详细需求文档**: [docs/nativebao.md](./nativebao.md)

**问题**: GitHub 代理全部不可靠（404/暂停），以下工具无法通过代理下载：
- Signal CLI (github.com/AsamK/signal-cli)
- 能力包 (oss.openclawcn.cn 无法访问)

**解决方案**: 在 ClawdSkillsProxy 上自建镜像

**前端代码已就绪**，等待后端实现以下接口：

| 接口 | 用途 | 优先级 |
|------|------|--------|
| `GET /api/binaries/signal-cli/latest` | Signal CLI 版本信息 | P0 |
| `GET /api/binaries/signal-cli/{ver}/{file}` | Signal CLI 下载 | P0 |
| `GET /api/capabilities/{file}` | 能力包下载 | P1 |

**认证**: `Authorization: Bearer clawdskills_secret_token_2024`

### 3. Skills 依赖预检测

在安装 Skill 之前检测依赖是否可用，避免安装过程中失败：
- Python 类 Skill: 检测 pip/uv
- Node.js 类 Skill: 检测 node/npm

### 4. 更新文档

- [ ] 更新用户文档，说明国内用户无需 VPN
- [ ] 添加 FAQ: "为什么我无法安装某些技能？"

---

## 国内镜像源汇总

### 包管理器镜像

| 类型 | 主镜像 | 备用1 | 备用2 |
|------|--------|-------|-------|
| npm | 淘宝 npmmirror.com | 腾讯云 | 华为云 |
| pip | 清华 tuna | 阿里云 | 中科大 |
| Go | 七牛云 goproxy.cn | 阿里云 | goproxy.io |
| Rust | 字节跳动 rsproxy.cn | 中科大 | 清华 |

### 二进制下载镜像

| 类型 | 主镜像 | 备用 | 状态 |
|------|--------|------|------|
| Node.js | 淘宝 npmmirror | 淘宝 CDN | ✅ |
| Python | 淘宝 npmmirror | 淘宝 CDN | ✅ |
| uv | PyPI (pip install) | - | ✅ |
| fnm | 系统包管理器 | GitHub 代理 | ⚠️ |
| Signal CLI | ClawdSkillsProxy | GitHub 代理 | ⚠️ 需后端 |

---

## 相关文件

- `src/config/cn-mirrors.ts` - 国内镜像配置
- `src/agents/skills-install.ts` - 技能安装逻辑 (uv/fnm)
- `src/agents/skills/clawdskillsproxy-registry.ts` - Skills 下载
- `scripts/windows/` - Windows 打包脚本
- `build/installer/scripts/` - 安装器脚本

---

## 更新日志

### 2026-02-02 (晚间更新)

**v2026.2.14 - 运维日志系统增强**:
- ✅ **日志分级**：DEBUG / INFO / WARN / ERROR
- ✅ **日志轮转**：单文件 5MB 上限，保留最近 5 个备份
- ✅ **自动清理**：删除 7 天以上的旧日志
- ✅ **启动信息**：版本、路径、系统信息、内存
- ✅ **每小时报告**：Gateway 状态、内存、重启次数、错误数
- ✅ **用户操作日志**：记录开始/停止/重启/诊断等操作
- ✅ **独立错误日志**：所有 ERROR 同时写入 `error.log`
- ✅ **日志查看工具**：`view-logs.bat` 菜单式日志查看和导出

**v2026.2.13 - Gateway 稳定性增强**:
- ✅ 修复 `IsGatewayRunning()` 误判 bug（检查同一行 LISTENING）
- ✅ 修复初始启动线程问题（ThreadPool → Thread + 延迟）
- ✅ **增强 Watchdog 监控**：
  - 记录崩溃详情：退出码、运行时长、最后日志
  - 检测 Gateway 无响应（连续 3 次 15 秒不健康 → 强制重启）
  - 每 5 分钟记录状态：内存使用、重启次数
  - 重启前自动清理锁文件和僵尸进程
- ✅ 退出码解释：识别 OOM、段错误、堆损坏等常见问题

**Gateway 稳定性监控机制**:

| 监控项 | 间隔 | 说明 |
|--------|------|------|
| 健康检查 | 5秒 | HTTP 探测 `localhost:18789/` |
| Watchdog | 15秒 | 检测崩溃并自动重启 |
| 无响应检测 | 45秒 | 连续 3 次不健康 → 强制重启 |
| 频率限制 | 5分钟 | 最多重启 5 次，防止无限循环 |
| 每小时报告 | 1小时 | 内存、重启次数、错误统计 |

**日志文件**:

| 文件 | 说明 |
|------|------|
| `service.log` | 主日志，包含所有级别 |
| `error.log` | 仅错误日志 |
| `gateway-output.log` | Gateway 进程输出 |
| `*.log.1~5` | 轮转备份文件 |

**运维工具**: `view-logs.bat` 提供菜单式操作：
- 查看各类日志
- 实时追踪日志
- 搜索错误关键字
- 导出日志压缩包（用于技术支持）

### 2026-02-02 (下午更新)

**v2026.2.10 - 稳定性修复**:
- ✅ UI 线程不再阻塞（使用 ThreadPool 后台执行）
- ✅ Node.js/entry.js 不存在时显示明确错误提示
- ✅ Gateway 进程退出时立即更新状态（Exited 事件）
- ✅ 重复启动时检查 Gateway 健康状态，不健康弹窗提示
- ✅ 日志写入添加线程安全锁
- ✅ PATH 环境变量包含 Node.js 路径

**v2026.2.9 - .NET 原生服务** (问题 #21):
- ✅ 创建 `OpenClawCNService.exe` (19KB) 替代 PowerShell/VBScript
- ✅ 一个 EXE 集成：托盘图标 + Gateway 管理 + Watchdog
- ✅ `CreateNoWindow = true` 完全隐藏 Node.js 启动窗口
- ✅ 智能等待 Gateway 启动（最多 30 秒）后再打开浏览器
- ✅ 智能判断配置状态：未配置 → /setup，已配置 → /chat
- ✅ 电脑重启后静默启动（不自动打开浏览器）

### 2026-02-02 (上午)

**Windows 离线版**:
- ✅ 修复 Gateway 启动问题 (`--allow-unconfigured`)
- ✅ 所有启动脚本添加 `OPENCLAWCN_REGION=cn`
- ✅ npm 使用国内镜像 (npmmirror.com)
- ✅ Skills 使用 ClawdSkillsProxy (121.43.61.90)
- ✅ 重新打包 v2026.2.2 离线版 (104.55 MB)

**依赖安装 (skills-install.ts)**:
- ✅ uv 通过 pip 安装 (PyPI 镜像)
- ✅ Linux Node.js 优先使用系统包管理器 (apt/yum/pacman)
- ✅ fnm 降级为最后备选方案

**其他修复**:
- ✅ Homebrew 安装使用清华/中科大镜像 (onboard-skills.ts)
- ✅ Signal CLI 多源下载支持 (signal-install.ts)
- ✅ npm 更新检查使用国内镜像 (update-check.ts)
- ✅ 添加 ClawdSkillsProxy 二进制托管配置 (cn-mirrors.ts)

**Signal CLI 国内镜像方案**:
- ✅ 前端代码支持多源下载
- ✅ 下载顺序: ClawdSkillsProxy → GitHub 代理 → GitHub
- ⚠️ 需要后端添加 `/api/binaries/signal-cli` 端点

**镜像测试结果 (2026-02-02)**:
| 镜像 | 状态 | 响应时间 |
|------|------|---------|
| Homebrew (清华) | ✅ | 154ms |
| Homebrew (中科大) | ✅ | 162ms |
| npm (npmmirror) | ✅ | 337ms |
| PyPI (清华) | ✅ | 741ms |
| ClawdSkillsProxy | ✅ | 358ms |
| GitHub Proxy (ghproxy.cn) | ❌ | Signal CLI 404 |
