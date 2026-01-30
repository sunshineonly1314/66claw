#!/usr/bin/env bash
# Clawdbot WSL Portable Builder
# 创建专为 WSL 环境优化的便携版安装包（需要用户自行安装 Node.js）
#
# 特点:
#   - 使用 wslview 在 Windows 浏览器中打开页面
#   - 支持 Windows/WSL 路径互操作
#   - 轻量级，无需包含 Node.js
#
# 用法:
#   ./build-portable.sh
#
# 输出:
#   build/wsl/clawdbot-wsl-portable.tar.gz

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
OUTPUT_DIR="${OUTPUT_DIR:-$ROOT_DIR/build/wsl}"

echo ""
echo "================================================"
echo " Clawdbot WSL Portable Builder"
echo " (专为 WSL 环境优化)"
echo "================================================"
echo ""

# 创建输出目录
PORTABLE_DIR="$OUTPUT_DIR/clawdbot-portable"
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
# Clawdbot 安装脚本 (WSL 版)
set -e

echo ""
echo "================================================"
echo " Clawdbot 安装程序 (WSL)"
echo "================================================"
echo ""

# 检查是否在 WSL 环境
check_wsl() {
  if [[ -n "${WSL_INTEROP:-}" ]] || [[ -n "${WSL_DISTRO_NAME:-}" ]] || [[ -n "${WSLENV:-}" ]]; then
    return 0
  fi
  if [[ -f /proc/sys/kernel/osrelease ]]; then
    if grep -qi microsoft /proc/sys/kernel/osrelease 2>/dev/null; then
      return 0
    fi
  fi
  return 1
}

if check_wsl; then
  echo "[√] 检测到 WSL 环境: ${WSL_DISTRO_NAME:-WSL}"
else
  echo "[!] 警告: 未检测到 WSL 环境"
  echo "    此版本专为 WSL 优化，建议使用 Linux 原生版本"
  echo ""
fi

# 检查 Node.js
echo "检查 Node.js..."
if ! command -v node &> /dev/null; then
  echo ""
  echo "[错误] 未检测到 Node.js"
  echo "请先安装 Node.js 22+:"
  echo ""
  echo "  # 方法1: 使用 nvm (推荐)"
  echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"
  echo "  source ~/.bashrc"
  echo "  nvm install 22"
  echo ""
  echo "  # 方法2: 使用 apt (Ubuntu/Debian)"
  echo "  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
  echo "  sudo apt-get install -y nodejs"
  echo ""
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
echo "[√] 检测到 Node.js $(node -v)"

if [[ "$NODE_VERSION" -lt 22 ]]; then
  echo ""
  echo "[!] 警告: Node.js 版本过低，推荐使用 Node.js 22+"
  echo ""
fi

# 检查 wslview
echo "检查 wslview..."
if command -v wslview &> /dev/null; then
  echo "[√] wslview 已安装 (可自动打开 Windows 浏览器)"
else
  echo "[!] 提示: 安装 wslu 可启用自动打开 Windows 浏览器功能"
  echo "    sudo apt install wslu"
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
echo "  ./setup.sh   - 启动并在 Windows 浏览器中打开配置向导"
echo "  ./start.sh   - 直接启动服务"
echo ""
SCRIPT
chmod +x "$PORTABLE_DIR/install.sh"

# 创建启动脚本
cat > "$PORTABLE_DIR/start.sh" << 'SCRIPT'
#!/usr/bin/env bash
# Clawdbot Gateway 启动脚本 (WSL 版)
set -e

echo ""
echo "================================================"
echo " Clawdbot Gateway (WSL)"
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

# 创建 WSL 专用 setup 脚本
cat > "$PORTABLE_DIR/setup.sh" << 'SCRIPT'
#!/usr/bin/env bash
# Clawdbot 配置向导 (WSL 版)
# 自动使用 Windows 浏览器打开配置页面
set -e

echo ""
echo "================================================"
echo " Clawdbot 配置向导 (WSL)"
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

exec node dist/entry.js gateway run --port 18789 "$@"
SCRIPT
chmod +x "$PORTABLE_DIR/setup.sh"

# 创建后台启动脚本
cat > "$PORTABLE_DIR/start-daemon.sh" << 'SCRIPT'
#!/usr/bin/env bash
# Clawdbot Gateway 后台启动脚本 (WSL 版)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/logs/gateway.log"
PID_FILE="$SCRIPT_DIR/clawdbot.pid"

mkdir -p "$SCRIPT_DIR/logs"

if [[ -f "$PID_FILE" ]]; then
  OLD_PID=$(cat "$PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Clawdbot 已在运行 (PID: $OLD_PID)"
    exit 1
  fi
fi

echo "启动 Clawdbot Gateway (后台模式)..."
nohup node "$SCRIPT_DIR/dist/entry.js" gateway run --port 18789 > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"
echo "Clawdbot 已启动 (PID: $(cat "$PID_FILE"))"
echo "日志文件: $LOG_FILE"
echo "访问地址: http://localhost:18789"
echo ""
echo "[WSL 提示] 你也可以从 Windows 浏览器直接访问此地址"
SCRIPT
chmod +x "$PORTABLE_DIR/start-daemon.sh"

# 创建停止脚本
cat > "$PORTABLE_DIR/stop.sh" << 'SCRIPT'
#!/usr/bin/env bash
# 停止 Clawdbot Gateway
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/clawdbot.pid"

if [[ ! -f "$PID_FILE" ]]; then
  echo "Clawdbot 未在运行"
  exit 0
fi

PID=$(cat "$PID_FILE")
if kill -0 "$PID" 2>/dev/null; then
  echo "停止 Clawdbot (PID: $PID)..."
  kill "$PID"
  rm -f "$PID_FILE"
  echo "已停止"
else
  echo "Clawdbot 未在运行 (清理旧 PID 文件)"
  rm -f "$PID_FILE"
fi
SCRIPT
chmod +x "$PORTABLE_DIR/stop.sh"

# 创建 Windows 快捷方式生成脚本
cat > "$PORTABLE_DIR/create-windows-shortcut.sh" << 'SCRIPT'
#!/usr/bin/env bash
# 在 Windows 桌面创建 Clawdbot 快捷方式
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
cat > "$WIN_DESKTOP/Clawdbot.bat" << EOF
@echo off
wsl -e bash -c "cd '$WSL_PATH' && ./setup.sh"
EOF

echo ""
echo "快捷方式已创建: $WIN_DESKTOP/Clawdbot.bat"
echo "双击即可启动 Clawdbot!"
SCRIPT
chmod +x "$PORTABLE_DIR/create-windows-shortcut.sh"

# 创建 README
cat > "$PORTABLE_DIR/README.md" << 'README'
# Clawdbot 便携版 (WSL)

专为 Windows Subsystem for Linux (WSL) 环境优化的轻量版本！

## 安装步骤

1. 确保已安装 Node.js 22+ (见下方说明)
2. 运行 `./install.sh` 安装依赖
3. 运行 `./setup.sh` 启动配置向导

## 安装 Node.js (WSL)

```bash
# 推荐: 使用 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 22
```

## 文件说明

| 文件 | 说明 |
|------|------|
| `install.sh` | 安装依赖（仅首次需要） |
| `setup.sh` | 启动并在 Windows 浏览器中打开配置向导 |
| `start.sh` | 直接启动服务 |
| `start-daemon.sh` | 后台启动服务 |
| `stop.sh` | 停止后台服务 |
| `create-windows-shortcut.sh` | 在 Windows 桌面创建快捷方式 |

## 访问地址

- 控制台: http://localhost:18789/
- 配置向导: http://localhost:18789/setup

> WSL 中运行的服务可以直接从 Windows 浏览器访问 localhost！

## WSL 特有功能

### 自动打开 Windows 浏览器

建议安装 wslu 工具包以启用自动打开 Windows 浏览器功能：

```bash
# Ubuntu/Debian
sudo apt install wslu
```

### 创建 Windows 桌面快捷方式

```bash
./create-windows-shortcut.sh
```

## Skills 仓库

https://gitee.com/tecbinai/skills

## 技术支持

https://www.tecbinai.com/
README

# 创建压缩包
echo ""
echo "创建压缩包..."
TARBALL_NAME="clawdbot-wsl-portable.tar.gz"
TARBALL_PATH="$OUTPUT_DIR/$TARBALL_NAME"
cd "$OUTPUT_DIR"
tar -czf "$TARBALL_NAME" clawdbot-portable

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
