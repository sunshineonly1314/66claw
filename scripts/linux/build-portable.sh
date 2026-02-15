#!/usr/bin/env bash
# OpenClawCN Linux Portable Builder
# 创建便携版安装包（需要用户自行安装 Node.js）
#
# 用法:
#   ./build-portable.sh
#
# 输出:
#   build/linux/openclawcn-linux-portable.tar.gz

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUTPUT_DIR="${OUTPUT_DIR:-$ROOT_DIR/build/linux}"

echo ""
echo "================================================"
echo " OpenClawCN Linux Portable Builder"
echo "================================================"
echo ""

# 创建输出目录
PORTABLE_DIR="$OUTPUT_DIR/openclawcn-portable"
if [[ -d "$PORTABLE_DIR" ]]; then
  echo "清理旧构建..."
  rm -rf "$PORTABLE_DIR"
fi
mkdir -p "$PORTABLE_DIR"

# 检查 dist 目录
if [[ ! -d "$ROOT_DIR/dist" ]]; then
  echo "错误: dist 目录不存在，请先运行 pnpm build" >&2
  exit 1
fi

# 复制 dist
echo "复制 dist..."
cp -r "$ROOT_DIR/dist" "$PORTABLE_DIR/dist"

# 处理 package.json
echo "处理 package.json..."
node -e "
const pkg = require('$ROOT_DIR/package.json');
delete pkg.scripts.postinstall;
console.log(JSON.stringify(pkg, null, 2));
" > "$PORTABLE_DIR/package.json"

# 创建安装脚本
echo "创建 install.sh..."
cat > "$PORTABLE_DIR/install.sh" << 'SCRIPT'
#!/usr/bin/env bash
# OpenClawCN 安装脚本
set -e

echo ""
echo "================================================"
echo " OpenClawCN 安装程序"
echo "================================================"
echo ""

# 检查 Node.js
echo "检查 Node.js..."
if ! command -v node &> /dev/null; then
  echo ""
  echo "[错误] 未检测到 Node.js"
  echo "请先安装 Node.js 22+: https://nodejs.org/"
  echo ""
  echo "或使用以下命令安装:"
  echo "  # Ubuntu/Debian"
  echo "  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
  echo "  sudo apt-get install -y nodejs"
  echo ""
  echo "  # Fedora/RHEL"
  echo "  curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -"
  echo "  sudo dnf install -y nodejs"
  echo ""
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
echo "检测到 Node.js v$(node -v)"

if [[ "$NODE_VERSION" -lt 22 ]]; then
  echo ""
  echo "[警告] Node.js 版本过低，推荐使用 Node.js 22+"
  echo ""
fi

echo ""
echo "正在安装依赖（首次运行需要几分钟）..."
echo ""

npm install --omit=dev

echo ""
echo "================================================"
echo " 安装完成！"
echo "================================================"
echo ""
echo "运行方式:"
echo "  ./start.sh   - 启动服务"
echo "  ./setup.sh   - 启动并打开配置向导"
echo ""
SCRIPT
chmod +x "$PORTABLE_DIR/install.sh"

# 创建启动脚本
cat > "$PORTABLE_DIR/start.sh" << 'SCRIPT'
#!/usr/bin/env bash
set -e

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

exec node dist/entry.js gateway run --port 18789 "$@"
SCRIPT
chmod +x "$PORTABLE_DIR/start.sh"

cat > "$PORTABLE_DIR/setup.sh" << 'SCRIPT'
#!/usr/bin/env bash
set -e

echo ""
echo "================================================"
echo " OpenClawCN 配置向导"
echo "================================================"
echo ""

# 尝试打开浏览器
if command -v xdg-open &> /dev/null; then
  (sleep 2 && xdg-open "http://localhost:18789/setup") &
elif command -v open &> /dev/null; then
  (sleep 2 && open "http://localhost:18789/setup") &
else
  echo " 请在浏览器中访问: http://localhost:18789/setup"
fi

exec node dist/entry.js gateway run --port 18789 "$@"
SCRIPT
chmod +x "$PORTABLE_DIR/setup.sh"

# 创建 README
cat > "$PORTABLE_DIR/README.md" << 'README'
# OpenClawCN 便携版 (Linux)

## 安装步骤

1. 确保已安装 Node.js 22+ (https://nodejs.org/)
2. 运行 `./install.sh` 安装依赖
3. 运行 `./setup.sh` 启动配置向导

## 启动方式

| 脚本 | 说明 |
|------|------|
| `install.sh` | 安装依赖（仅首次需要） |
| `setup.sh` | 启动并打开配置向导 |
| `start.sh` | 直接启动服务 |

## 访问地址

- 控制台: http://localhost:18789/
- 配置向导: http://localhost:18789/setup

## Skills 仓库

https://gitee.com/tecbinai/skills

## 技术支持

https://www.tecbinai.com/
README

# 创建压缩包
echo ""
echo "创建压缩包..."
TARBALL_NAME="openclawcn-linux-portable.tar.gz"
TARBALL_PATH="$OUTPUT_DIR/$TARBALL_NAME"
cd "$OUTPUT_DIR"
tar -czf "$TARBALL_NAME" openclawcn-portable

TARBALL_SIZE=$(du -sm "$TARBALL_PATH" | cut -f1)

echo ""
echo "================================================"
echo " 构建完成!"
echo "================================================"
echo ""
echo "便携版目录: $PORTABLE_DIR"
echo "压缩包:     $TARBALL_PATH"
echo "压缩包大小: ${TARBALL_SIZE}MB"
echo ""
