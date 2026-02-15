# Linux 打包脚本

本目录包含 OpenClawCN Linux 版本的完整打包系统。

## 快速开始

```bash
# 全量并行构建 (22线程，构建所有格式)
pnpm linux:all

# 国内用户 (使用中国镜像)
pnpm linux:all:china

# 快速构建 (只构建 x64 独立版 + 便携版)
pnpm linux:quick

# 只构建特定格式
pnpm linux:standalone    # 独立版 (含 Node.js)
pnpm linux:portable      # 便携版 (需用户安装 Node)
pnpm linux:deb           # DEB 包 (Ubuntu/Debian)
pnpm linux:rpm           # RPM 包 (CentOS/Fedora)
```

## 脚本说明

### 构建脚本

| 脚本 | 说明 | 输出 |
|------|------|------|
| `build-all-parallel.sh` | **主脚本** - 22线程并行构建所有格式 | 所有格式 |
| `build-standalone.sh` | 独立版（包含 Node.js） | `.tar.gz` |
| `build-portable.sh` | 便携版（需用户安装 Node） | `.tar.gz` |
| `build-deb.sh` | DEB 包（Ubuntu/Debian） | `.deb` |
| `build-rpm.sh` | RPM 包（CentOS/Fedora） | `.rpm` |

### 安装脚本 (给用户的)

| 脚本 | 说明 |
|------|------|
| `install-online.sh` | 一键在线安装（自动下载+安装+启动） |
| `install-china.sh` | 中国区一键安装（使用 Gitee 镜像） |

## 并行构建详情

`build-all-parallel.sh` 采用两阶段构建策略：

### Phase 1 (串行) - 公共构建
1. TypeScript 编译 (`pnpm build`)
2. UI 构建 (`pnpm ui:build`)
3. 生产依赖安装 (`npm install --omit=dev`)
4. 通用产物准备

### Phase 2 (并行) - 多目标打包
使用最多 22 个线程同时构建以下目标：

| 目标 | 架构 | 格式 | 依赖工具 |
|------|------|------|----------|
| standalone-x64 | x86_64 | tar.gz | curl, tar |
| standalone-arm64 | aarch64 | tar.gz | curl, tar |
| portable | 通用 | tar.gz | tar |
| deb-x64 | amd64 | .deb | dpkg-deb |
| deb-arm64 | arm64 | .deb | dpkg-deb |
| rpm-x64 | x86_64 | .rpm | rpmbuild |
| rpm-arm64 | aarch64 | .rpm | rpmbuild |
| appimage-x64 | x86_64 | .AppImage | (待实现) |

### 参数

```bash
./build-all-parallel.sh \
  --jobs 22 \                    # 并行线程数
  --targets standalone-x64,deb-x64 \  # 构建目标
  --mirror china \               # 中国镜像
  --output ./my-output \         # 输出目录
  --skip-build \                 # 跳过 pnpm build
  --clean                        # 清理旧产物
```

## 前置条件

### 必须
- Node.js 22+
- pnpm
- curl / wget
- tar

### 可选 (按需)
- `dpkg-deb` + `fakeroot` — 构建 DEB 包
- `rpmbuild` — 构建 RPM 包
- `docker` — 构建 Docker 镜像
- `parallel` — GNU parallel (加速并行，非必须)

### 安装构建依赖

```bash
# Ubuntu/Debian
sudo apt install dpkg-dev fakeroot

# CentOS/Fedora
sudo dnf install rpm-build

# 安装 GNU parallel (可选，加速并行)
sudo apt install parallel    # Debian
sudo dnf install parallel    # Fedora
```

## 输出目录

```
build/linux-release/
├── openclawcn-linux-x64-standalone.tar.gz     # 独立版 x64
├── openclawcn-linux-arm64-standalone.tar.gz   # 独立版 arm64
├── openclawcn-linux-portable.tar.gz           # 便携版
├── openclawcn_2026.2.0_amd64.deb             # DEB x64
├── openclawcn_2026.2.0_arm64.deb             # DEB arm64
├── openclawcn-2026.2.0-1.x86_64.rpm          # RPM x64
├── openclawcn-2026.2.0-1.aarch64.rpm         # RPM arm64
├── .cache/                                  # Node.js 下载缓存
├── .common/                                 # 共享构建产物
└── logs/                                    # 构建日志
```

## 包大小参考

| 格式 | 解压后 | 压缩后 |
|------|--------|--------|
| 独立版 (x64) | ~200MB | ~80MB |
| 独立版 (arm64) | ~200MB | ~80MB |
| 便携版 | ~50MB | ~20MB |
| DEB (x64) | ~200MB | ~80MB |
| RPM (x64) | ~200MB | ~80MB |

## 用户安装方式

### 方式1: 一键安装 (推荐小白)
```bash
# 国际
curl -fsSL https://get.tecbinai.com/linux | bash

# 国内
curl -fsSL https://gitee.com/tecbinai/openclawcn-releases/raw/main/install.sh | bash
```

### 方式2: 独立版 (手动下载)
```bash
tar -xzf openclawcn-linux-x64-standalone.tar.gz
cd openclawcn
./setup.sh
```

### 方式3: DEB 包 (Ubuntu/Debian)
```bash
sudo dpkg -i openclawcn_*.deb
openclawcn gateway run
# 浏览器打开: http://localhost:18789/setup
```

### 方式4: RPM 包 (CentOS/Fedora)
```bash
sudo rpm -i openclawcn-*.rpm
openclawcn gateway run
# 浏览器打开: http://localhost:18789/setup
```

## Web 配置向导

所有安装方式启动后都通过浏览器配置:

1. 启动服务 → 自动打开浏览器
2. 访问 `http://localhost:18789/setup`
3. 按向导依次配置:
   - AI 模型 API Key
   - 工作目录
   - 安全模式
   - 消息渠道 (可选)
4. 完成！访问 `http://localhost:18789` 使用
