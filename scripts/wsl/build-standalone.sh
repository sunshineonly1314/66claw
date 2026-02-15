#!/usr/bin/env bash
# OpenClawCN WSL Standalone Builder
# 创建专为 WSL 环境优化的完整独立安装包
#
# 特点:
#   - 使用 wslview 在 Windows 浏览器中打开页面
#   - 支持 Windows/WSL 路径互操作
#   - 优化的 WSL 环境检测
#
# 用法:
#   ./build-standalone.sh [--arch arm64|x64] [--node-version 22.13.1]
#
# 输出:
#   build/wsl-standalone/openclawcn-wsl-{arch}-standalone.tar.gz

set -euo pipefail

# 默认配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUTPUT_DIR="${OUTPUT_DIR:-$ROOT_DIR/build/wsl-standalone}"
NODE_VERSION="${NODE_VERSION:-22.13.1}"
ARCH="${ARCH:-$(uname -m)}"

# 架构映射
case "$ARCH" in
  x86_64|amd64|x64)
    ARCH="x64"
    NODE_ARCH="x64"
    ;;
  aarch64|arm64)
    ARCH="arm64"
    NODE_ARCH="arm64"
    ;;
  *)
    echo "错误: 不支持的架构: $ARCH" >&2
    exit 1
    ;;
esac

# 解析命令行参数
while [[ $# -gt 0 ]]; do
  case $1 in
    --arch)
      ARCH="$2"
      case "$ARCH" in
        x64) NODE_ARCH="x64" ;;
        arm64) NODE_ARCH="arm64" ;;
        *) echo "错误: 不支持的架构: $ARCH" >&2; exit 1 ;;
      esac
      shift 2
      ;;
    --node-version)
      NODE_VERSION="$2"
      shift 2
      ;;
    --output)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    -h|--help)
      echo "用法: $0 [选项]"
      echo ""
      echo "选项:"
      echo "  --arch arm64|x64       目标架构 (默认: 当前系统架构)"
      echo "  --node-version VERSION Node.js 版本 (默认: $NODE_VERSION)"
      echo "  --output DIR           输出目录 (默认: build/wsl-standalone)"
      echo "  -h, --help             显示帮助"
      exit 0
      ;;
    *)
      echo "未知参数: $1" >&2
      exit 1
      ;;
  esac
done

echo ""
echo "================================================"
echo " OpenClawCN WSL Standalone Builder"
echo " (专为 WSL 环境优化，包含 Node.js)"
echo "================================================"
echo ""
echo "配置:"
echo "  架构:       $ARCH"
echo "  Node.js:    v$NODE_VERSION"
echo "  输出目录:   $OUTPUT_DIR"
echo ""

# 创建输出目录
STANDALONE_DIR="$OUTPUT_DIR/openclawcn"
if [[ -d "$STANDALONE_DIR" ]]; then
  echo "清理旧构建..."
  rm -rf "$STANDALONE_DIR"
fi
mkdir -p "$STANDALONE_DIR"

# 下载 Node.js
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz"
NODE_TARBALL="node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz"
NODE_EXTRACT_DIR="node-v${NODE_VERSION}-linux-${NODE_ARCH}"
NODE_CACHE="$OUTPUT_DIR/$NODE_TARBALL"

if [[ ! -f "$NODE_CACHE" ]]; then
  echo "下载 Node.js v$NODE_VERSION..."
  echo "URL: $NODE_URL"
  curl -fsSL "$NODE_URL" -o "$NODE_CACHE"
  echo "下载完成!"
else
  echo "使用缓存的 Node.js: $NODE_CACHE"
fi

# 解压 Node.js
echo "解压 Node.js..."
TEMP_EXTRACT="$OUTPUT_DIR/temp-node"
rm -rf "$TEMP_EXTRACT"
mkdir -p "$TEMP_EXTRACT"
tar -xJf "$NODE_CACHE" -C "$TEMP_EXTRACT"
mv "$TEMP_EXTRACT/$NODE_EXTRACT_DIR" "$STANDALONE_DIR/node"
rm -rf "$TEMP_EXTRACT"
echo "Node.js 已解压到: $STANDALONE_DIR/node"

# 检查 dist 目录
if [[ ! -d "$ROOT_DIR/dist" ]]; then
  echo "错误: dist 目录不存在，请先运行 pnpm build" >&2
  exit 1
fi

# 复制 dist
echo "复制 dist..."
cp -r "$ROOT_DIR/dist" "$STANDALONE_DIR/dist"

# 处理 package.json (移除 devDependencies 和 postinstall)
echo "处理 package.json..."
node -e "
const pkg = require('$ROOT_DIR/package.json');
pkg.scripts = { start: 'node dist/entry.js gateway run' };
delete pkg.devDependencies;
delete pkg.optionalDependencies;
console.log(JSON.stringify(pkg, null, 2));
" > "$STANDALONE_DIR/package.json"

# 安装生产依赖
echo "安装依赖 (可能需要几分钟)..."
export PATH="$STANDALONE_DIR/node/bin:$PATH"
cd "$STANDALONE_DIR"
"$STANDALONE_DIR/node/bin/npm" install --omit=dev --ignore-scripts 2>&1 | tail -20
echo "依赖安装完成."

# 创建 WSL 专用启动脚本
echo "创建 WSL 专用启动脚本..."

cat > "$STANDALONE_DIR/start.sh" << 'SCRIPT'
#!/usr/bin/env bash
# OpenClawCN Gateway 启动脚本 (WSL 版)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$SCRIPT_DIR/node/bin:$PATH"

echo ""
echo "================================================"
echo " OpenClawCN Gateway (WSL)"
echo "================================================"
echo ""
echo " 启动中..."
echo " 访问地址: http://localhost:18789"
echo " 配置向导: http://localhost:18789/setup"
echo ""
echo " 按 Ctrl+C 停止服务"
echo ""

exec "$SCRIPT_DIR/node/bin/node" "$SCRIPT_DIR/dist/entry.js" gateway run --port 18789 "$@"
SCRIPT
chmod +x "$STANDALONE_DIR/start.sh"

# 创建 WSL 专用 setup 脚本 (使用 wslview)
cat > "$STANDALONE_DIR/setup.sh" << 'SCRIPT'
#!/usr/bin/env bash
# OpenClawCN 配置向导 (WSL 版)
# 自动使用 Windows 浏览器打开配置页面
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$SCRIPT_DIR/node/bin:$PATH"

echo ""
echo "================================================"
echo " OpenClawCN 配置向导 (WSL)"
echo "================================================"
echo ""
echo " 正在启动服务并打开 Windows 浏览器..."
echo ""

# WSL 环境下优先使用 wslview 打开 Windows 浏览器
open_browser() {
  local url="$1"
  
  # 方法1: wslview (wslu 工具包)
  if command -v wslview &> /dev/null; then
    echo " 使用 wslview 打开浏览器..."
    wslview "$url" &
    return 0
  fi
  
  # 方法2: 直接调用 Windows 的 cmd.exe
  if command -v cmd.exe &> /dev/null; then
    echo " 使用 Windows cmd.exe 打开浏览器..."
    cmd.exe /c start "" "$url" &
    return 0
  fi
  
  # 方法3: 通过 PowerShell
  if command -v powershell.exe &> /dev/null; then
    echo " 使用 PowerShell 打开浏览器..."
    powershell.exe -Command "Start-Process '$url'" &
    return 0
  fi
  
  # 方法4: explorer.exe
  if command -v explorer.exe &> /dev/null; then
    echo " 使用 explorer.exe 打开浏览器..."
    explorer.exe "$url" &
    return 0
  fi
  
  echo " [提示] 无法自动打开浏览器"
  echo " 请手动在 Windows 浏览器中访问: $url"
  return 1
}

# 延迟打开浏览器，等待服务启动
(sleep 3 && open_browser "http://localhost:18789/setup") &

exec "$SCRIPT_DIR/node/bin/node" "$SCRIPT_DIR/dist/entry.js" gateway run --port 18789 "$@"
SCRIPT
chmod +x "$STANDALONE_DIR/setup.sh"

# 创建后台启动脚本
cat > "$STANDALONE_DIR/start-daemon.sh" << 'SCRIPT'
#!/usr/bin/env bash
# OpenClawCN Gateway 后台启动脚本 (WSL 版)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$SCRIPT_DIR/node/bin:$PATH"

LOG_FILE="$SCRIPT_DIR/logs/gateway.log"
PID_FILE="$SCRIPT_DIR/openclawcn.pid"

mkdir -p "$SCRIPT_DIR/logs"

if [[ -f "$PID_FILE" ]]; then
  OLD_PID=$(cat "$PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "OpenClawCN 已在运行 (PID: $OLD_PID)"
    exit 1
  fi
fi

echo "启动 OpenClawCN Gateway (后台模式)..."
nohup "$SCRIPT_DIR/node/bin/node" "$SCRIPT_DIR/dist/entry.js" gateway run --port 18789 > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"
echo "OpenClawCN 已启动 (PID: $(cat "$PID_FILE"))"
echo "日志文件: $LOG_FILE"
echo "访问地址: http://localhost:18789"
echo ""
echo "[WSL 提示] 你也可以从 Windows 浏览器直接访问此地址"
SCRIPT
chmod +x "$STANDALONE_DIR/start-daemon.sh"

# 创建停止脚本
cat > "$STANDALONE_DIR/stop.sh" << 'SCRIPT'
#!/usr/bin/env bash
# 停止 OpenClawCN Gateway
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/openclawcn.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "OpenClawCN 未在运行"
  exit 0
fi

PID=$(cat "$PID_FILE")
if kill -0 "$PID" 2>/dev/null; then
  echo "停止 OpenClawCN (PID: $PID)..."
  kill "$PID"
  rm -f "$PID_FILE"
  echo "已停止"
else
  echo "OpenClawCN 未在运行 (清理旧 PID 文件)"
  rm -f "$PID_FILE"
fi
SCRIPT
chmod +x "$STANDALONE_DIR/stop.sh"

# 创建 Windows 快捷方式生成脚本
cat > "$STANDALONE_DIR/create-windows-shortcut.sh" << 'SCRIPT'
#!/usr/bin/env bash
# 在 Windows 桌面创建 OpenClawCN 快捷方式
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 获取 Windows 用户桌面路径
if [[ -n "${USERPROFILE:-}" ]]; then
  WIN_DESKTOP="$USERPROFILE/Desktop"
elif command -v wslpath &> /dev/null; then
  WIN_DESKTOP="$(wslpath "$(cmd.exe /c 'echo %USERPROFILE%' 2>/dev/null | tr -d '\r')")/Desktop"
else
  echo "错误: 无法获取 Windows 桌面路径" >&2
  exit 1
fi

# 获取 WSL 路径对应的 Windows 路径
WSL_PATH="$SCRIPT_DIR"
if command -v wslpath &> /dev/null; then
  WIN_PATH="$(wslpath -w "$WSL_PATH")"
else
  echo "错误: 需要 wslpath 命令" >&2
  exit 1
fi

echo "创建 Windows 桌面快捷方式..."
echo "WSL 路径: $WSL_PATH"
echo "Windows 路径: $WIN_PATH"

# 创建 .bat 文件作为启动器
cat > "$WIN_DESKTOP/OpenClawCN.bat" << EOF
@echo off
wsl -e bash -c "cd '$WSL_PATH' && ./setup.sh"
EOF

echo ""
echo "快捷方式已创建: $WIN_DESKTOP/OpenClawCN.bat"
echo "双击即可启动 OpenClawCN!"
SCRIPT
chmod +x "$STANDALONE_DIR/create-windows-shortcut.sh"

# 创建 README
cat > "$STANDALONE_DIR/README.md" << 'README'
# OpenClawCN 独立版 (WSL)

专为 Windows Subsystem for Linux (WSL) 环境优化的版本！

本安装包已包含所有必需组件（包括 Node.js），解压即可使用！

## 快速开始

1. 解压到 WSL 中的任意目录
2. 运行 `./setup.sh` 启动配置向导
3. 会自动在 Windows 浏览器中打开配置页面

## 文件说明

| 文件 | 说明 |
|------|------|
| `setup.sh` | 启动服务并在 Windows 浏览器中打开配置向导 |
| `start.sh` | 启动服务（前台，显示日志） |
| `start-daemon.sh` | 后台启动服务 |
| `stop.sh` | 停止后台服务 |
| `create-windows-shortcut.sh` | 在 Windows 桌面创建快捷方式 |

## 访问地址

- 控制台: http://localhost:18789/
- 配置向导: http://localhost:18789/setup

> WSL 中运行的服务可以直接从 Windows 浏览器访问 localhost！

## WSL 特有功能

### 自动打开 Windows 浏览器

`setup.sh` 会自动尝试使用以下方式打开 Windows 浏览器：
1. `wslview` (推荐，需安装 wslu)
2. `cmd.exe /c start`
3. `powershell.exe`
4. `explorer.exe`

### 安装 wslu (可选但推荐)

```bash
# Ubuntu/Debian
sudo apt install wslu

# 其他发行版
# https://wslutiliti.es/wslu/install.html
```

### 创建 Windows 桌面快捷方式

```bash
./create-windows-shortcut.sh
```

这会在 Windows 桌面创建一个 `OpenClawCN.bat` 文件，双击即可启动！

## 配置为 systemd 服务 (需 WSL2 + systemd)

首先确保 WSL2 启用了 systemd：

```bash
# 编辑 /etc/wsl.conf
sudo nano /etc/wsl.conf
```

添加以下内容：
```ini
[boot]
systemd=true
```

然后从 PowerShell 重启 WSL：
```powershell
wsl --shutdown
```

配置服务：
```bash
# 复制 service 文件
mkdir -p ~/.config/systemd/user/
cp openclawcn.service ~/.config/systemd/user/

# 编辑路径
nano ~/.config/systemd/user/openclawcn.service

# 启用并启动
systemctl --user daemon-reload
systemctl --user enable openclawcn
systemctl --user start openclawcn
```

## 故障排除

### 无法打开 Windows 浏览器

安装 wslu 工具包：
```bash
sudo apt install wslu
```

### 端口被占用

检查端口占用：
```bash
ss -tlnp | grep 18789
```

### WSL 网络问题

确保 WSL2 网络正常：
```bash
ping -c 1 google.com
```

## Skills 仓库

https://gitee.com/tecbinai/skills

## 技术支持

https://www.tecbinai.com/
README

# 创建 systemd service 文件
cat > "$STANDALONE_DIR/openclawcn.service" << SYSTEMD
[Unit]
Description=OpenClawCN AI Gateway (WSL)
After=network.target

[Service]
Type=simple
User=%i
WorkingDirectory=%h/openclawcn
ExecStart=%h/openclawcn/node/bin/node %h/openclawcn/dist/entry.js gateway run --port 18789
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
SYSTEMD

# 计算大小
echo ""
echo "计算文件大小..."
DIST_SIZE=$(du -sm "$STANDALONE_DIR/dist" | cut -f1)
NODE_SIZE=$(du -sm "$STANDALONE_DIR/node" | cut -f1)
MODULES_SIZE=$(du -sm "$STANDALONE_DIR/node_modules" | cut -f1)
TOTAL_SIZE=$(du -sm "$STANDALONE_DIR" | cut -f1)

echo ""
echo "大小统计:"
echo "  dist:         ${DIST_SIZE}MB"
echo "  node:         ${NODE_SIZE}MB"
echo "  node_modules: ${MODULES_SIZE}MB"
echo "  总计:         ${TOTAL_SIZE}MB"

# 创建压缩包
echo ""
echo "创建压缩包..."
TARBALL_NAME="openclawcn-wsl-${ARCH}-standalone.tar.gz"
TARBALL_PATH="$OUTPUT_DIR/$TARBALL_NAME"
cd "$OUTPUT_DIR"
tar -czf "$TARBALL_NAME" openclawcn

TARBALL_SIZE=$(du -sm "$TARBALL_PATH" | cut -f1)

echo ""
echo "================================================"
echo " 构建完成!"
echo "================================================"
echo ""
echo "独立版目录: $STANDALONE_DIR"
echo "压缩包:     $TARBALL_PATH"
echo "压缩包大小: ${TARBALL_SIZE}MB"
echo ""
echo "用户只需解压并运行 ./setup.sh 即可!"
echo "会自动在 Windows 浏览器中打开配置页面"
echo ""
