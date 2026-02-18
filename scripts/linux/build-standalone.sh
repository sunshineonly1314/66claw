#!/usr/bin/env bash
# OpenClawCN Linux Standalone Builder
# 创建包含 Node.js 的完整独立安装包
#
# 用法:
#   ./build-standalone.sh [--arch arm64|x64] [--node-version 22.14.0]
#
# 输出:
#   build/linux-standalone/openclawcn-linux-{arch}-standalone.tar.gz

set -euo pipefail

# 默认配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUTPUT_DIR="${OUTPUT_DIR:-$ROOT_DIR/build/linux-standalone}"
NODE_VERSION="${NODE_VERSION:-22.14.0}"
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
      echo "  --output DIR           输出目录 (默认: build/linux-standalone)"
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
echo " OpenClawCN Linux Standalone Builder"
echo " (包含 Node.js，无需用户安装)"
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

# 创建启动脚本
echo "创建启动脚本..."

cat > "$STANDALONE_DIR/start.sh" << 'SCRIPT'
#!/usr/bin/env bash
# OpenClawCN Gateway 启动脚本
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$SCRIPT_DIR/node/bin:$PATH"

echo ""
echo "================================================"
echo " OpenClawCN Gateway"
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

cat > "$STANDALONE_DIR/setup.sh" << 'SCRIPT'
#!/usr/bin/env bash
# OpenClawCN 配置向导
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$SCRIPT_DIR/node/bin:$PATH"

echo ""
echo "================================================"
echo " OpenClawCN 配置向导"
echo "================================================"
echo ""
echo " 正在启动服务并打开配置页面..."
echo ""

# 尝试打开浏览器
if command -v xdg-open &> /dev/null; then
  (sleep 2 && xdg-open "http://localhost:18789/setup") &
elif command -v open &> /dev/null; then
  (sleep 2 && open "http://localhost:18789/setup") &
else
  echo " 请在浏览器中访问: http://localhost:18789/setup"
fi

exec "$SCRIPT_DIR/node/bin/node" "$SCRIPT_DIR/dist/entry.js" gateway run --port 18789 "$@"
SCRIPT
chmod +x "$STANDALONE_DIR/setup.sh"

# 创建后台启动脚本
cat > "$STANDALONE_DIR/start-daemon.sh" << 'SCRIPT'
#!/usr/bin/env bash
# OpenClawCN Gateway 后台启动脚本
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

# 创建 systemd service 文件
cat > "$STANDALONE_DIR/openclawcn.service" << SYSTEMD
[Unit]
Description=OpenClawCN AI Gateway
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

# 创建 README
cat > "$STANDALONE_DIR/README.md" << 'README'
# OpenClawCN 独立版 (Linux)

本安装包已包含所有必需组件（包括 Node.js），解压即可使用！

## 快速开始

1. 解压到任意目录
2. 运行 `./setup.sh` 启动配置向导
3. 在浏览器中完成配置

## 文件说明

| 文件 | 说明 |
|------|------|
| `setup.sh` | 启动服务并打开配置向导 |
| `start.sh` | 启动服务（前台，显示日志） |
| `start-daemon.sh` | 后台启动服务 |
| `stop.sh` | 停止后台服务 |
| `openclawcn.service` | systemd 服务文件 |

## 访问地址

- 控制台: http://localhost:18789/
- 配置向导: http://localhost:18789/setup

## 配置为系统服务 (可选)

```bash
# 复制 service 文件
mkdir -p ~/.config/systemd/user/
cp openclawcn.service ~/.config/systemd/user/

# 编辑 service 文件，将 %h/openclawcn 替换为实际安装路径

# 启用并启动服务
systemctl --user daemon-reload
systemctl --user enable openclawcn
systemctl --user start openclawcn

# 查看状态
systemctl --user status openclawcn
```

## Skills 仓库

https://gitee.com/tecbinai/skills

## 技术支持

https://www.tecbinai.com/
README

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
TARBALL_NAME="openclawcn-linux-${ARCH}-standalone.tar.gz"
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
echo ""
