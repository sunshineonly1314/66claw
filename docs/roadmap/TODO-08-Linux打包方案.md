# TODO-08: Linux 打包完整方案

> 状态：**方案已完成** | 优先级：**高** | 负责人：待定
> 创建日期：2026-02-07

---

## 一、方案概述

### 目标
为 OpenClawCN 建立完整的 Linux 打包、分发和安装体系，面向小白用户，实现：
- **一键安装**：用户只需一行命令即可完成安装
- **Web 配置**：通过浏览器完成所有配置（无需命令行操作）
- **22 线程并行构建**：开发侧高效构建所有 Linux 格式包
- **多格式支持**：tar.gz / DEB / RPM / 一键脚本

### 核心理念
```
用户端: 一行命令安装 → 浏览器配置 → 开始使用
开发端: 一行命令 → 22线程并行 → 输出所有格式
```

---

## 二、架构设计

### 2.1 打包格式矩阵

| 格式 | 目标用户 | 适用发行版 | 安装方式 | 包含Node.js |
|------|----------|-----------|----------|-------------|
| **独立版 tar.gz** (x64) | 小白用户 | 全部 | 解压即用 | ✅ |
| **独立版 tar.gz** (arm64) | 小白用户 | 全部 ARM | 解压即用 | ✅ |
| **便携版 tar.gz** | 开发者 | 全部 | 需装Node | ❌ |
| **DEB 包** (amd64) | Ubuntu/Debian 用户 | Ubuntu/Debian | dpkg -i | ✅ |
| **DEB 包** (arm64) | ARM Ubuntu用户 | Ubuntu ARM | dpkg -i | ✅ |
| **RPM 包** (x86_64) | CentOS/Fedora 用户 | RHEL/Fedora | rpm -i | ✅ |
| **RPM 包** (aarch64) | ARM RHEL用户 | RHEL ARM | rpm -i | ✅ |
| **一键在线安装** | 所有小白 | 全部 | curl \| bash | ✅ (自动下载) |

### 2.2 并行构建架构

```
┌─────────────────────────────────────────────────┐
│                Phase 1: 串行构建                  │
│                                                   │
│   pnpm build → pnpm ui:build → npm install       │
│   (编译TS)     (构建UI)       (生产依赖)          │
│                     ↓                             │
│              共享产物 (.common/)                   │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│           Phase 2: 并行构建 (22线程)              │
│                                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ standalone│ │ standalone│ │ portable │         │
│  │   x64    │ │  arm64   │ │          │         │
│  └──────────┘ └──────────┘ └──────────┘         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ deb-x64  │ │ deb-arm64│ │ rpm-x64  │         │
│  └──────────┘ └──────────┘ └──────────┘         │
│  ┌──────────┐ ┌──────────┐                       │
│  │ rpm-arm64│ │ appimage │                       │
│  └──────────┘ └──────────┘                       │
│                                                   │
│  ← GNU parallel 或 内置 bash 后台进程并行 →       │
└─────────────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│           Phase 3: 汇总报告                       │
│                                                   │
│  列出所有产物 + 大小 + 耗时统计                    │
└─────────────────────────────────────────────────┘
```

### 2.3 用户安装流程

```
用户视角 (小白用户):

  步骤1: 复制一行命令，粘贴到终端执行
  ──────────────────────────────────────────
  curl -fsSL https://get.tecbinai.com/linux | bash

  步骤2: 自动完成
  ──────────────────────────────────────────
  ✓ 检测系统架构
  ✓ 下载安装包
  ✓ 解压到 ~/openclawcn
  ✓ 启动服务
  ✓ 打开浏览器

  步骤3: 浏览器中配置
  ──────────────────────────────────────────
  访问: http://localhost:18789/setup
  
  ┌──────────────────────────────────────┐
  │         OpenClawCN 配置向导             │
  │                                       │
  │  第1步: 选择 AI 模型                   │
  │    □ OpenAI (GPT-4)                   │
  │    □ Anthropic (Claude)               │
  │    □ DeepSeek                         │
  │    □ SiliconFlow                      │
  │    [输入 API Key] [验证]              │
  │                                       │
  │  第2步: 设置工作目录                   │
  │    [/home/user/openclawcn-workspace]    │
  │                                       │
  │  第3步: 安全设置                       │
  │    ○ 标准模式 (推荐)                  │
  │    ○ 信任模式                         │
  │                                       │
  │  第4步: 消息渠道 (可选)               │
  │    □ 飞书  □ 钉钉  □ 企业微信         │
  │                                       │
  │           [完成配置]                   │
  └──────────────────────────────────────┘
```

---

## 三、已实现的文件清单

### 3.1 构建脚本 (`scripts/linux/`)

| 文件 | 说明 | 行数 |
|------|------|------|
| `build-all-parallel.sh` | **主脚本** - 22线程并行构建所有格式 | ~550 |
| `build-standalone.sh` | 独立版构建 (含 Node.js) | ~365 |
| `build-portable.sh` | 便携版构建 | ~200 |
| `build-deb.sh` | DEB 包构建 (Ubuntu/Debian) | ~210 |
| `build-rpm.sh` | RPM 包构建 (CentOS/Fedora) | ~180 |
| `install-online.sh` | 一键在线安装脚本 | ~250 |
| `install-china.sh` | 中国区一键安装 (Gitee 镜像) | ~25 |
| `README.md` | Linux 打包文档 | ~200 |

### 3.2 每个包内生成的运行时脚本

| 脚本 | 说明 | 小白友好度 |
|------|------|------------|
| `setup.sh` | **首次使用** - 生成配置、启动服务、打开浏览器 | ⭐⭐⭐ |
| `start.sh` | 前台启动 (显示日志) | ⭐⭐ |
| `start-daemon.sh` | 后台启动 (带健康检查) | ⭐⭐ |
| `stop.sh` | 停止服务 (支持优雅/强制) | ⭐⭐⭐ |
| `restart.sh` | 重启服务 | ⭐⭐⭐ |
| `status.sh` | 状态检查 (进程+健康+端口) | ⭐⭐⭐ |
| `logs.sh` | 查看日志 (支持 `-f` 实时跟踪) | ⭐⭐⭐ |
| `install-service.sh` | 安装 systemd 服务 (开机自启) | ⭐⭐ |
| `uninstall.sh` | 完全卸载 (保留配置) | ⭐⭐⭐ |

### 3.3 package.json 新增命令

```json
{
  "linux:all":       "全量22线程并行构建",
  "linux:all:china": "全量构建 (中国镜像)",
  "linux:deb":       "单独构建 DEB 包",
  "linux:rpm":       "单独构建 RPM 包",
  "linux:quick":     "快速构建 (x64 独立版+便携版)"
}
```

---

## 四、专家审核意见

> 以下是以顶级 Linux 打包专家视角的审核意见和改进建议。

### 4.1 ✅ 方案优点

1. **两阶段构建策略正确** - 串行共享 + 并行打包，避免重复编译
2. **小白友好** - 一键安装脚本、Web 配置向导，不需要命令行配置
3. **多格式覆盖** - tar.gz / DEB / RPM 覆盖主流 Linux 发行版
4. **中国镜像支持** - 国内用户体验好
5. **systemd 集成** - 用户级服务，无需 root 权限
6. **健康检查** - 启动后自动验证服务可用性
7. **日志管理** - 统一日志目录，支持实时跟踪
8. **安全加固** - systemd 中使用 NoNewPrivileges、ProtectSystem

### 4.2 ⚠️ 需要改进的地方

#### P0 (必须修复)

| # | 问题 | 改进建议 | 状态 |
|---|------|----------|------|
| 1 | **DEB/RPM 包 chmod 777 日志目录** | 改为 `chmod 755` + 正确的 owner/group | 🔴 待修复 |
| 2 | **一键安装脚本缺少校验** | 添加 SHA256 校验和验证下载完整性 | 🔴 待修复 |
| 3 | **RPM spec 缺少 %dir 标记** | 添加 `%dir /opt/openclawcn` 确保目录归属 | 🔴 待修复 |

#### P1 (建议改进)

| # | 问题 | 改进建议 | 状态 |
|---|------|----------|------|
| 4 | **缺少日志轮转** | 添加 logrotate 配置 (`/etc/logrotate.d/openclawcn`) | 🟡 待实现 |
| 5 | **DEB 缺少依赖声明** | 添加 `Depends: libc6 (>= 2.17)` 等基础依赖 | 🟡 待实现 |
| 6 | **缺少 man page** | 生成 `openclawcn(1)` man page | 🟡 可选 |
| 7 | **缺少 bash 补全** | 生成 bash/zsh 自动补全脚本 | 🟡 可选 |
| 8 | **缺少签名验证** | DEB 使用 GPG 签名，RPM 使用 GPG-KEY | 🟡 待实现 |
| 9 | **AppImage 未实现** | 使用 appimagetool 构建 AppImage | 🟡 待实现 |
| 10 | **缺少健康检查超时配置** | systemd 中添加 WatchdogSec | 🟡 待实现 |

#### P2 (锦上添花)

| # | 问题 | 改进建议 | 状态 |
|---|------|----------|------|
| 11 | **缺少 APT/YUM 仓库** | 建立自有包仓库，用户可 `apt install openclawcn` | 🔵 未来 |
| 12 | **缺少 Snap/Flatpak** | 增加 Snap Store / Flathub 分发 | 🔵 未来 |
| 13 | **缺少自动更新** | 添加 `openclawcn update` 自更新机制 | 🔵 未来 |
| 14 | **缺少 SELinux 策略** | RHEL 系统需要 SELinux 策略文件 | 🔵 未来 |
| 15 | **缺少 Docker Compose 一键部署** | 添加 Linux 专用 Docker Compose 模板 | 🔵 未来 |

### 4.3 安全审核

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 最小权限原则 | ✅ | 使用用户级 systemd 服务，无需 root |
| 进程隔离 | ✅ | NoNewPrivileges=true |
| 文件系统保护 | ✅ | ProtectSystem=strict |
| 网络绑定 | ✅ | 默认 loopback，不暴露到外网 |
| Token 认证 | ✅ | 自动生成随机 token |
| 下载完整性 | ⚠️ | 缺少 SHA256 校验（P0 #2） |
| 包签名 | ⚠️ | 缺少 GPG 签名（P1 #8） |
| curl-pipe-bash | ⚠️ | 业界标准做法但需文档说明风险 |

---

## 五、开发操作手册

### 5.1 构建全部 Linux 包

```bash
# 确保已安装构建依赖
# Ubuntu: sudo apt install dpkg-dev fakeroot rpm
# Fedora: sudo dnf install dpkg rpm-build

# 全量并行构建
pnpm linux:all

# 国内开发者
pnpm linux:all:china

# 快速构建 (只出 x64 独立版 + 便携版)
pnpm linux:quick

# 自定义构建
bash scripts/linux/build-all-parallel.sh \
  --jobs 22 \
  --targets standalone-x64,deb-x64 \
  --mirror china \
  --clean
```

### 5.2 构建产物目录

```
build/linux-release/
├── openclawcn-linux-x64-standalone.tar.gz   ← 推荐给用户
├── openclawcn-linux-arm64-standalone.tar.gz
├── openclawcn-linux-portable.tar.gz
├── openclawcn_2026.2.0_amd64.deb
├── openclawcn_2026.2.0_arm64.deb
├── openclawcn-2026.2.0-1.x86_64.rpm
├── openclawcn-2026.2.0-1.aarch64.rpm
├── .cache/          (Node.js 下载缓存，加速重复构建)
├── .common/         (共享构建产物)
└── logs/            (每个目标的构建日志)
```

### 5.3 发布流程

1. **构建**: `pnpm linux:all --clean`
2. **测试**: 在干净的 Ubuntu/CentOS VM 中测试安装
3. **上传**: 
   - GitHub Release: 上传所有 tar.gz / deb / rpm
   - Gitee Release: 镜像上传 (国内)
4. **更新安装脚本**: 确保 `install-online.sh` 的下载 URL 指向最新版本

### 5.4 测试清单

- [ ] Ubuntu 22.04 x64: 独立版安装+启动+Web配置
- [ ] Ubuntu 24.04 x64: DEB 包安装+systemd 服务
- [ ] Debian 12 x64: 独立版安装
- [ ] CentOS 9 x64: RPM 包安装
- [ ] Fedora 40 x64: RPM 包安装
- [ ] Ubuntu 24.04 arm64: 独立版安装 (ARM)
- [ ] Alpine Linux: 便携版安装 (需用户装 Node)
- [ ] 一键安装脚本: 国际+国内镜像
- [ ] 升级测试: 旧版本→新版本，配置保留
- [ ] 卸载测试: 完全清除+配置保留

---

## 六、用户文档 (面向小白)

### 6.1 最简安装 (推荐)

**一行命令搞定:**

```bash
curl -fsSL https://get.tecbinai.com/linux | bash
```

国内用户:
```bash
curl -fsSL https://gitee.com/tecbinai/openclawcn-releases/raw/main/install.sh | bash
```

安装完成后浏览器会自动打开配置页面，按提示操作即可。

### 6.2 手动安装

```bash
# 1. 下载 (选一个适合你系统的)
wget https://github.com/openclawcn/openclawcn/releases/latest/download/openclawcn-linux-x64-standalone.tar.gz

# 2. 解压
tar -xzf openclawcn-linux-x64-standalone.tar.gz
cd openclawcn

# 3. 启动配置
./setup.sh
```

### 6.3 常用操作

```bash
cd ~/openclawcn

./start.sh           # 启动 (前台，能看到日志)
./start-daemon.sh    # 后台启动
./stop.sh            # 停止
./restart.sh         # 重启
./status.sh          # 查看状态
./logs.sh            # 查看日志
./logs.sh -f         # 实时查看日志

# 安装为系统服务 (开机自动启动)
./install-service.sh
```

### 6.4 DEB/RPM 安装

```bash
# Ubuntu/Debian
sudo dpkg -i openclawcn_*.deb
openclawcn gateway run
# 打开浏览器: http://localhost:18789/setup

# CentOS/Fedora
sudo rpm -i openclawcn-*.rpm
openclawcn gateway run
# 打开浏览器: http://localhost:18789/setup
```

### 6.5 卸载

```bash
# 独立版
cd ~/openclawcn && ./uninstall.sh

# DEB 包
sudo dpkg -r openclawcn

# RPM 包
sudo rpm -e openclawcn

# 清除配置 (可选)
rm -rf ~/.openclawcn
```

---

## 七、后续迭代计划

### 近期 (v2026.2.x)
- [ ] 修复 P0 问题 (日志权限、下载校验、RPM dir)
- [ ] 添加 logrotate 配置
- [ ] 添加 DEB 基础依赖声明
- [ ] 在 CI/CD 中集成 Linux 构建
- [ ] 准备 GitHub Release 资产上传脚本

### 中期 (v2026.3.x)
- [ ] 实现 AppImage 格式
- [ ] 添加 GPG 签名
- [ ] 建立 APT/YUM 仓库
- [ ] 添加 bash/zsh 补全
- [ ] 添加 `openclawcn update` 自更新

### 远期
- [ ] Snap Store / Flathub 分发
- [ ] SELinux 策略
- [ ] ARM Docker 镜像
- [ ] 自动化发布流水线 (GitHub Actions)

---

## 八、文件索引

| 文件路径 | 说明 |
|----------|------|
| `scripts/linux/build-all-parallel.sh` | 22线程并行主构建脚本 |
| `scripts/linux/build-standalone.sh` | 独立版构建 |
| `scripts/linux/build-portable.sh` | 便携版构建 |
| `scripts/linux/build-deb.sh` | DEB 包构建 |
| `scripts/linux/build-rpm.sh` | RPM 包构建 |
| `scripts/linux/install-online.sh` | 一键在线安装 |
| `scripts/linux/install-china.sh` | 中国区安装 |
| `scripts/linux/README.md` | Linux 打包文档 |
| `docs/roadmap/TODO-08-Linux打包方案.md` | 本文档 |
