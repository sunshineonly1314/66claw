#!/usr/bin/env bash
# ================================================================
# Clawdbot Linux 全平台并行打包脚本
# 使用 GNU parallel / xargs 实现最多 22 线程并行构建
#
# 用法:
#   ./build-all-parallel.sh [选项]
#
# 选项:
#   --jobs N           并行线程数 (默认: 22)
#   --targets TARGETS  构建目标，逗号分隔 (默认: all)
#                      可选: standalone-x64, standalone-arm64,
#                            portable, deb-x64, deb-arm64,
#                            rpm-x64, rpm-arm64, docker, appimage-x64
#   --skip-build       跳过 pnpm build (已有 dist/)
#   --mirror china     使用中国镜像源
#   --output DIR       输出目录 (默认: build/linux-release)
#   --clean            清理旧构建产物
#   -h, --help         显示帮助
#
# 示例:
#   # 全量并行构建 (22线程)
#   ./build-all-parallel.sh
#
#   # 只构建独立版 + DEB
#   ./build-all-parallel.sh --targets standalone-x64,deb-x64
#
#   # 使用中国镜像，8线程
#   ./build-all-parallel.sh --mirror china --jobs 8
# ================================================================

set -euo pipefail

# ─── 颜色定义 ─────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ─── 基础路径 ─────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# ─── 默认配置 ─────────────────────────────────────────────────
MAX_JOBS=22
TARGETS="all"
SKIP_BUILD=false
MIRROR=""
OUTPUT_DIR="${OUTPUT_DIR:-$ROOT_DIR/build/linux-release}"
CLEAN=false
NODE_VERSION="22.13.1"
START_TIME=$(date +%s)

# ─── 所有可用构建目标 ──────────────────────────────────────────
ALL_TARGETS=(
  "standalone-x64"
  "standalone-arm64"
  "portable"
  "deb-x64"
  "deb-arm64"
  "rpm-x64"
  "rpm-arm64"
  "appimage-x64"
)

# ─── 帮助信息 ─────────────────────────────────────────────────
show_help() {
  echo ""
  echo -e "${BOLD}Clawdbot Linux 全平台并行打包工具${NC}"
  echo ""
  echo "用法: $0 [选项]"
  echo ""
  echo "选项:"
  echo "  --jobs N           并行线程数 (默认: 22)"
  echo "  --targets TARGETS  构建目标，逗号分隔 (默认: all)"
  echo "  --skip-build       跳过 pnpm build"
  echo "  --mirror china     使用中国镜像源"
  echo "  --output DIR       输出目录"
  echo "  --clean            清理旧构建"
  echo "  -h, --help         显示帮助"
  echo ""
  echo "可用目标:"
  for t in "${ALL_TARGETS[@]}"; do
    echo "  - $t"
  done
  echo ""
  echo "示例:"
  echo "  $0                              # 全量22线程并行构建"
  echo "  $0 --targets standalone-x64     # 只构建 x64 独立版"
  echo "  $0 --mirror china --jobs 8      # 中国镜像，8线程"
  echo ""
}

# ─── 解析参数 ─────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --jobs)     MAX_JOBS="$2";    shift 2 ;;
    --targets)  TARGETS="$2";     shift 2 ;;
    --skip-build) SKIP_BUILD=true; shift ;;
    --mirror)   MIRROR="$2";      shift 2 ;;
    --output)   OUTPUT_DIR="$2";  shift 2 ;;
    --clean)    CLEAN=true;       shift ;;
    --node-version) NODE_VERSION="$2"; shift 2 ;;
    -h|--help)  show_help; exit 0 ;;
    *)          echo -e "${RED}未知参数: $1${NC}" >&2; show_help; exit 1 ;;
  esac
done

# ─── 解析构建目标 ─────────────────────────────────────────────
if [[ "$TARGETS" == "all" ]]; then
  BUILD_TARGETS=("${ALL_TARGETS[@]}")
else
  IFS=',' read -ra BUILD_TARGETS <<< "$TARGETS"
fi

# ─── 日志函数 ─────────────────────────────────────────────────
log_info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[OK]${NC} $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*"; }
log_step()    { echo -e "${CYAN}[STEP]${NC} ${BOLD}$*${NC}"; }

# ─── Banner ───────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     Clawdbot Linux 全平台并行打包系统           ║${NC}"
echo -e "${BOLD}║     Parallel Build System (max ${MAX_JOBS} threads)       ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  版本:       $(node -e 'console.log(require("./package.json").version)' 2>/dev/null || echo 'unknown')"
echo -e "  并行线程:   ${BOLD}${MAX_JOBS}${NC}"
echo -e "  构建目标:   ${BOLD}${BUILD_TARGETS[*]}${NC}"
echo -e "  输出目录:   ${OUTPUT_DIR}"
echo -e "  中国镜像:   ${MIRROR:-否}"
echo ""

# ─── 环境检查 ─────────────────────────────────────────────────
log_step "Phase 0: 环境检查"

check_tool() {
  local tool="$1"
  local required="${2:-true}"
  if command -v "$tool" &>/dev/null; then
    log_success "$tool: $(command -v "$tool")"
    return 0
  else
    if [[ "$required" == "true" ]]; then
      log_error "$tool 未安装，请先安装"
      return 1
    else
      log_warn "$tool 未安装 (可选)"
      return 1
    fi
  fi
}

check_tool "node" true
check_tool "npm" true
check_tool "tar" true
check_tool "curl" true

# 检查可选工具
HAS_PARALLEL=false
HAS_DPKG=false
HAS_RPM=false
HAS_DOCKER=false
HAS_FAKEROOT=false

check_tool "parallel" false && HAS_PARALLEL=true || true
check_tool "dpkg-deb" false && HAS_DPKG=true || true
check_tool "rpmbuild" false && HAS_RPM=true || true
check_tool "docker" false && HAS_DOCKER=true || true
check_tool "fakeroot" false && HAS_FAKEROOT=true || true

# Node 版本检查
NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_MAJOR" -lt 22 ]]; then
  log_error "Node.js 版本过低: $(node -v)，需要 22+"
  exit 1
fi
log_success "Node.js: $(node -v)"

echo ""

# ─── 中国镜像配置 ─────────────────────────────────────────────
if [[ "$MIRROR" == "china" ]]; then
  log_info "配置中国镜像源..."
  export NPM_CONFIG_REGISTRY="https://registry.npmmirror.com"
  export NODE_MIRROR="https://npmmirror.com/mirrors/node/"
  NODE_DOWNLOAD_BASE="https://npmmirror.com/mirrors/node/v${NODE_VERSION}"
  log_success "已切换到中国镜像"
else
  NODE_DOWNLOAD_BASE="https://nodejs.org/dist/v${NODE_VERSION}"
fi

# ─── 清理 ─────────────────────────────────────────────────────
if [[ "$CLEAN" == true ]]; then
  log_step "清理旧构建产物..."
  rm -rf "$OUTPUT_DIR"
  log_success "已清理: $OUTPUT_DIR"
fi

mkdir -p "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR/logs"

# ─── Phase 1: 公共构建（串行）──────────────────────────────────
log_step "Phase 1: 公共构建 (串行)"

COMMON_DIR="$OUTPUT_DIR/.common"
mkdir -p "$COMMON_DIR"

# 1.1 TypeScript 编译
if [[ "$SKIP_BUILD" == false ]]; then
  log_info "正在编译 TypeScript..."
  cd "$ROOT_DIR"
  pnpm build 2>&1 | tail -5
  log_success "TypeScript 编译完成"

  # 1.2 构建 UI
  if [[ -d "$ROOT_DIR/ui" ]]; then
    log_info "正在构建 UI..."
    pnpm ui:build 2>&1 | tail -5
    log_success "UI 构建完成"
  fi
else
  log_warn "跳过 pnpm build (--skip-build)"
fi

# 1.3 检查 dist 目录
if [[ ! -d "$ROOT_DIR/dist" ]]; then
  log_error "dist 目录不存在，请先运行 pnpm build"
  exit 1
fi

# 1.4 准备通用产物 (共享)
log_info "准备通用构建产物..."

# 复制 dist
if [[ ! -d "$COMMON_DIR/dist" ]] || [[ "$SKIP_BUILD" == false ]]; then
  rm -rf "$COMMON_DIR/dist"
  cp -r "$ROOT_DIR/dist" "$COMMON_DIR/dist"
fi

# 生成精简的 package.json
node -e "
const pkg = require('$ROOT_DIR/package.json');
pkg.scripts = { start: 'node dist/entry.js gateway run' };
delete pkg.devDependencies;
delete pkg.optionalDependencies;
console.log(JSON.stringify(pkg, null, 2));
" > "$COMMON_DIR/package.json"

# 复制必要文件
for f in README.md CHANGELOG.md LICENSE; do
  [[ -f "$ROOT_DIR/$f" ]] && cp "$ROOT_DIR/$f" "$COMMON_DIR/" || true
done

# 复制 extensions
if [[ -d "$ROOT_DIR/extensions" ]]; then
  rm -rf "$COMMON_DIR/extensions"
  cp -r "$ROOT_DIR/extensions" "$COMMON_DIR/extensions"
fi

# 复制 skills
if [[ -d "$ROOT_DIR/skills" ]]; then
  rm -rf "$COMMON_DIR/skills"
  cp -r "$ROOT_DIR/skills" "$COMMON_DIR/skills"
fi

# 复制 patches
if [[ -d "$ROOT_DIR/patches" ]]; then
  rm -rf "$COMMON_DIR/patches"
  cp -r "$ROOT_DIR/patches" "$COMMON_DIR/patches"
fi

# 安装生产依赖到共享目录
if [[ ! -d "$COMMON_DIR/node_modules" ]]; then
  log_info "安装生产依赖 (首次)..."
  cd "$COMMON_DIR"
  npm install --omit=dev --ignore-scripts 2>&1 | tail -10
  log_success "依赖安装完成"
fi

log_success "通用产物准备完成"
echo ""

# ─── Phase 2: 并行构建 ─────────────────────────────────────────
log_step "Phase 2: 并行构建 (${#BUILD_TARGETS[@]} 个目标, 最多 ${MAX_JOBS} 线程)"
echo ""

# 构建任务日志目录
LOGS_DIR="$OUTPUT_DIR/logs"

# ─── 单个构建任务函数 ──────────────────────────────────────────

build_standalone() {
  local arch="$1"
  local target_dir="$OUTPUT_DIR/standalone-${arch}"
  local log_file="$LOGS_DIR/standalone-${arch}.log"
  local node_arch="$arch"

  {
    echo "[$(date '+%H:%M:%S')] 开始构建: standalone-${arch}"

    rm -rf "$target_dir"
    mkdir -p "$target_dir/clawdbot"

    # 下载 Node.js
    local node_tarball="node-v${NODE_VERSION}-linux-${node_arch}.tar.xz"
    local node_url="${NODE_DOWNLOAD_BASE}/node-v${NODE_VERSION}-linux-${node_arch}.tar.xz"
    local node_cache="$OUTPUT_DIR/.cache/${node_tarball}"
    mkdir -p "$OUTPUT_DIR/.cache"

    if [[ ! -f "$node_cache" ]]; then
      echo "  下载 Node.js v${NODE_VERSION} (${arch})..."
      curl -fsSL "$node_url" -o "$node_cache"
    fi

    echo "  解压 Node.js..."
    local temp_dir="$target_dir/temp-node"
    mkdir -p "$temp_dir"
    tar -xJf "$node_cache" -C "$temp_dir"
    mv "$temp_dir"/node-* "$target_dir/clawdbot/node"
    rm -rf "$temp_dir"

    # 复制通用产物
    echo "  复制产物..."
    cp -r "$COMMON_DIR/dist" "$target_dir/clawdbot/dist"
    cp "$COMMON_DIR/package.json" "$target_dir/clawdbot/"
    cp -r "$COMMON_DIR/node_modules" "$target_dir/clawdbot/node_modules"

    [[ -d "$COMMON_DIR/extensions" ]] && cp -r "$COMMON_DIR/extensions" "$target_dir/clawdbot/"
    [[ -d "$COMMON_DIR/skills" ]] && cp -r "$COMMON_DIR/skills" "$target_dir/clawdbot/"

    for f in README.md CHANGELOG.md LICENSE; do
      [[ -f "$COMMON_DIR/$f" ]] && cp "$COMMON_DIR/$f" "$target_dir/clawdbot/"
    done

    # 生成运行时脚本
    generate_runtime_scripts "$target_dir/clawdbot" "standalone"

    # 打包
    echo "  创建压缩包..."
    cd "$target_dir"
    tar -czf "$OUTPUT_DIR/clawdbot-linux-${arch}-standalone.tar.gz" clawdbot

    local size
    size=$(du -sm "$OUTPUT_DIR/clawdbot-linux-${arch}-standalone.tar.gz" | cut -f1)
    echo "[$(date '+%H:%M:%S')] 完成: standalone-${arch} (${size}MB)"
  } > "$log_file" 2>&1

  echo -e "  ${GREEN}✓${NC} standalone-${arch} 完成 ($(du -sm "$OUTPUT_DIR/clawdbot-linux-${arch}-standalone.tar.gz" | cut -f1)MB)"
}

build_portable() {
  local log_file="$LOGS_DIR/portable.log"
  local target_dir="$OUTPUT_DIR/portable"

  {
    echo "[$(date '+%H:%M:%S')] 开始构建: portable"

    rm -rf "$target_dir"
    mkdir -p "$target_dir/clawdbot"

    # 复制产物 (无 node_modules，用户自行安装)
    cp -r "$COMMON_DIR/dist" "$target_dir/clawdbot/dist"
    cp "$COMMON_DIR/package.json" "$target_dir/clawdbot/"
    [[ -d "$COMMON_DIR/extensions" ]] && cp -r "$COMMON_DIR/extensions" "$target_dir/clawdbot/"
    [[ -d "$COMMON_DIR/skills" ]] && cp -r "$COMMON_DIR/skills" "$target_dir/clawdbot/"

    for f in README.md CHANGELOG.md LICENSE; do
      [[ -f "$COMMON_DIR/$f" ]] && cp "$COMMON_DIR/$f" "$target_dir/clawdbot/"
    done

    # 生成运行时脚本
    generate_runtime_scripts "$target_dir/clawdbot" "portable"

    # 生成安装脚本
    generate_install_script "$target_dir/clawdbot"

    # 打包
    cd "$target_dir"
    tar -czf "$OUTPUT_DIR/clawdbot-linux-portable.tar.gz" clawdbot

    local size
    size=$(du -sm "$OUTPUT_DIR/clawdbot-linux-portable.tar.gz" | cut -f1)
    echo "[$(date '+%H:%M:%S')] 完成: portable (${size}MB)"
  } > "$log_file" 2>&1

  echo -e "  ${GREEN}✓${NC} portable 完成 ($(du -sm "$OUTPUT_DIR/clawdbot-linux-portable.tar.gz" | cut -f1)MB)"
}

build_deb() {
  local arch="$1"
  local log_file="$LOGS_DIR/deb-${arch}.log"

  if [[ "$HAS_DPKG" == false ]]; then
    echo -e "  ${YELLOW}⊘${NC} deb-${arch} 跳过 (dpkg-deb 未安装)"
    return 0
  fi

  {
    echo "[$(date '+%H:%M:%S')] 开始构建: deb-${arch}"
    bash "$SCRIPT_DIR/build-deb.sh" --arch "$arch" --output "$OUTPUT_DIR" \
      --common-dir "$COMMON_DIR" --node-version "$NODE_VERSION" \
      ${MIRROR:+--mirror "$MIRROR"}
    echo "[$(date '+%H:%M:%S')] 完成: deb-${arch}"
  } > "$log_file" 2>&1

  local deb_file
  deb_file=$(ls "$OUTPUT_DIR"/clawdbot*"${arch}"*.deb 2>/dev/null | head -1)
  if [[ -n "$deb_file" ]]; then
    echo -e "  ${GREEN}✓${NC} deb-${arch} 完成 ($(du -sm "$deb_file" | cut -f1)MB)"
  else
    echo -e "  ${RED}✗${NC} deb-${arch} 失败 (查看 $log_file)"
  fi
}

build_rpm() {
  local arch="$1"
  local log_file="$LOGS_DIR/rpm-${arch}.log"

  if [[ "$HAS_RPM" == false ]]; then
    echo -e "  ${YELLOW}⊘${NC} rpm-${arch} 跳过 (rpmbuild 未安装)"
    return 0
  fi

  {
    echo "[$(date '+%H:%M:%S')] 开始构建: rpm-${arch}"
    bash "$SCRIPT_DIR/build-rpm.sh" --arch "$arch" --output "$OUTPUT_DIR" \
      --common-dir "$COMMON_DIR" --node-version "$NODE_VERSION" \
      ${MIRROR:+--mirror "$MIRROR"}
    echo "[$(date '+%H:%M:%S')] 完成: rpm-${arch}"
  } > "$log_file" 2>&1

  local rpm_file
  rpm_file=$(ls "$OUTPUT_DIR"/clawdbot*"${arch}"*.rpm 2>/dev/null | head -1)
  if [[ -n "$rpm_file" ]]; then
    echo -e "  ${GREEN}✓${NC} rpm-${arch} 完成 ($(du -sm "$rpm_file" | cut -f1)MB)"
  else
    echo -e "  ${RED}✗${NC} rpm-${arch} 失败 (查看 $log_file)"
  fi
}

build_appimage() {
  local arch="$1"
  local log_file="$LOGS_DIR/appimage-${arch}.log"

  {
    echo "[$(date '+%H:%M:%S')] 开始构建: appimage-${arch}"
    # AppImage 目前作为预留，后续实现
    echo "AppImage 构建暂未实现"
    echo "[$(date '+%H:%M:%S')] 跳过: appimage-${arch}"
  } > "$log_file" 2>&1

  echo -e "  ${YELLOW}⊘${NC} appimage-${arch} 跳过 (待实现)"
}

# ─── 生成运行时脚本 ────────────────────────────────────────────

generate_runtime_scripts() {
  local dir="$1"
  local mode="$2"  # standalone or portable

  local node_prefix=""
  if [[ "$mode" == "standalone" ]]; then
    node_prefix='SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$SCRIPT_DIR/node/bin:$PATH"'
  fi

  # ── start.sh ──
  cat > "$dir/start.sh" << SCRIPT
#!/usr/bin/env bash
# Clawdbot Gateway 启动脚本
set -e
${node_prefix}

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║       Clawdbot Gateway 正在启动          ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  访问地址:  http://localhost:18789"
echo "  配置向导:  http://localhost:18789/setup"
echo ""
echo "  按 Ctrl+C 停止服务"
echo ""

SCRIPT_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
cd "\$SCRIPT_DIR"
exec node dist/entry.js gateway run --port 18789 --allow-unconfigured "\$@"
SCRIPT
  chmod +x "$dir/start.sh"

  # ── setup.sh (一键启动+配置) ──
  cat > "$dir/setup.sh" << 'SCRIPT'
#!/usr/bin/env bash
# Clawdbot 一键配置向导
# 启动服务并自动打开浏览器配置页面
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 如果是独立版，使用内置 Node
if [[ -d "$SCRIPT_DIR/node/bin" ]]; then
  export PATH="$SCRIPT_DIR/node/bin:$PATH"
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║       Clawdbot 配置向导                  ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# 自动生成 token
CONFIG_DIR="$HOME/.clawdbot"
CONFIG_FILE="$CONFIG_DIR/clawdbot.json"
mkdir -p "$CONFIG_DIR"

if [[ ! -f "$CONFIG_FILE" ]]; then
  TOKEN=$(head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)
  cat > "$CONFIG_FILE" << EOF
{
  "gateway": {
    "mode": "local",
    "bind": "loopback",
    "port": 18789,
    "auth": {
      "token": "$TOKEN"
    }
  }
}
EOF
  echo "  已生成配置文件: $CONFIG_FILE"
else
  TOKEN=$(node -e "try{const c=JSON.parse(require('fs').readFileSync('$CONFIG_FILE','utf8'));console.log(c.gateway?.auth?.token||'')}catch{}" 2>/dev/null || echo "")
fi

SETUP_URL="http://localhost:18789/setup"
if [[ -n "$TOKEN" ]]; then
  SETUP_URL="http://localhost:18789/setup?token=${TOKEN}"
fi

echo "  配置页面: $SETUP_URL"
echo ""

# 等待服务启动后打开浏览器
(
  for i in $(seq 1 30); do
    sleep 1
    if curl -sf http://localhost:18789/api/health > /dev/null 2>&1; then
      echo ""
      echo "  ✓ 服务已启动！正在打开浏览器..."
      echo ""
      # 尝试各种方式打开浏览器
      if command -v xdg-open &>/dev/null; then
        xdg-open "$SETUP_URL" 2>/dev/null
      elif command -v sensible-browser &>/dev/null; then
        sensible-browser "$SETUP_URL" 2>/dev/null
      elif command -v open &>/dev/null; then
        open "$SETUP_URL" 2>/dev/null
      else
        echo ""
        echo "  请手动在浏览器中打开:"
        echo "  $SETUP_URL"
        echo ""
      fi
      break
    fi
  done
) &

exec node dist/entry.js gateway run --port 18789 --allow-unconfigured "$@"
SCRIPT
  chmod +x "$dir/setup.sh"

  # ── start-daemon.sh (后台运行) ──
  cat > "$dir/start-daemon.sh" << 'SCRIPT'
#!/usr/bin/env bash
# Clawdbot Gateway 后台启动脚本
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 如果是独立版，使用内置 Node
if [[ -d "$SCRIPT_DIR/node/bin" ]]; then
  export PATH="$SCRIPT_DIR/node/bin:$PATH"
fi

LOG_DIR="$SCRIPT_DIR/logs"
LOG_FILE="$LOG_DIR/gateway.log"
PID_FILE="$SCRIPT_DIR/clawdbot.pid"

mkdir -p "$LOG_DIR"

# 检查是否已在运行
if [[ -f "$PID_FILE" ]]; then
  OLD_PID=$(cat "$PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Clawdbot 已在运行 (PID: $OLD_PID)"
    echo "如需重启，请先运行 ./stop.sh"
    exit 1
  fi
  rm -f "$PID_FILE"
fi

echo "╔══════════════════════════════════════════╗"
echo "║  Clawdbot Gateway 后台启动               ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# 启动后台进程
nohup node dist/entry.js gateway run --port 18789 --allow-unconfigured >> "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

echo "  PID:      $(cat "$PID_FILE")"
echo "  日志:     $LOG_FILE"
echo "  访问:     http://localhost:18789"
echo "  配置:     http://localhost:18789/setup"
echo ""

# 等待健康检查
echo -n "  等待启动"
for i in $(seq 1 15); do
  sleep 1
  echo -n "."
  if curl -sf http://localhost:18789/api/health > /dev/null 2>&1; then
    echo ""
    echo ""
    echo "  ✓ Clawdbot 已成功启动！"
    echo ""
    exit 0
  fi
done

echo ""
echo ""
echo "  ⚠ 启动超时，请检查日志: $LOG_FILE"
echo ""
SCRIPT
  chmod +x "$dir/start-daemon.sh"

  # ── stop.sh ──
  cat > "$dir/stop.sh" << 'SCRIPT'
#!/usr/bin/env bash
# 停止 Clawdbot Gateway
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/clawdbot.pid"

if [[ ! -f "$PID_FILE" ]]; then
  # 尝试用 pkill 找到进程
  if pgrep -f "clawdbot.*gateway" > /dev/null 2>&1; then
    echo "找到 Clawdbot 进程，正在停止..."
    pkill -f "clawdbot.*gateway" || true
    echo "✓ 已停止"
  else
    echo "Clawdbot 未在运行"
  fi
  exit 0
fi

PID=$(cat "$PID_FILE")
if kill -0 "$PID" 2>/dev/null; then
  echo "停止 Clawdbot (PID: $PID)..."
  kill "$PID"
  # 等待进程退出
  for i in $(seq 1 10); do
    if ! kill -0 "$PID" 2>/dev/null; then
      break
    fi
    sleep 1
  done
  # 强制终止
  if kill -0 "$PID" 2>/dev/null; then
    echo "进程未响应，强制终止..."
    kill -9 "$PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
  echo "✓ 已停止"
else
  echo "Clawdbot 未在运行 (清理旧 PID 文件)"
  rm -f "$PID_FILE"
fi
SCRIPT
  chmod +x "$dir/stop.sh"

  # ── restart.sh ──
  cat > "$dir/restart.sh" << 'SCRIPT'
#!/usr/bin/env bash
# 重启 Clawdbot Gateway
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "正在重启 Clawdbot..."
"$SCRIPT_DIR/stop.sh"
sleep 2
"$SCRIPT_DIR/start-daemon.sh"
SCRIPT
  chmod +x "$dir/restart.sh"

  # ── status.sh ──
  cat > "$dir/status.sh" << 'SCRIPT'
#!/usr/bin/env bash
# Clawdbot 状态检查
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/clawdbot.pid"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║       Clawdbot 状态检查                  ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# 检查进程
if [[ -f "$PID_FILE" ]]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    echo "  状态:   ✓ 运行中 (PID: $PID)"
  else
    echo "  状态:   ✗ 未运行 (PID文件过期)"
    rm -f "$PID_FILE"
  fi
else
  echo "  状态:   ✗ 未运行"
fi

# 健康检查
if curl -sf http://localhost:18789/api/health > /dev/null 2>&1; then
  echo "  健康:   ✓ 服务正常"
  echo "  地址:   http://localhost:18789"
else
  echo "  健康:   ✗ 服务不可达"
fi

# 显示端口占用
echo ""
if command -v ss &>/dev/null; then
  echo "  端口 18789:"
  ss -tlnp 2>/dev/null | grep 18789 | head -3 || echo "  (无)"
elif command -v netstat &>/dev/null; then
  echo "  端口 18789:"
  netstat -tlnp 2>/dev/null | grep 18789 | head -3 || echo "  (无)"
fi

echo ""
SCRIPT
  chmod +x "$dir/status.sh"

  # ── logs.sh ──
  cat > "$dir/logs.sh" << 'SCRIPT'
#!/usr/bin/env bash
# 查看 Clawdbot 日志
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/logs/gateway.log"

if [[ ! -f "$LOG_FILE" ]]; then
  echo "暂无日志文件"
  echo "日志位置: $LOG_FILE"
  exit 0
fi

echo "═══ Clawdbot Gateway 日志 ═══"
echo "文件: $LOG_FILE"
echo ""

if [[ "$1" == "-f" ]] || [[ "$1" == "--follow" ]]; then
  tail -f "$LOG_FILE"
else
  tail -100 "$LOG_FILE"
  echo ""
  echo "(使用 ./logs.sh -f 实时跟踪日志)"
fi
SCRIPT
  chmod +x "$dir/logs.sh"

  # ── install-service.sh (systemd 安装) ──
  cat > "$dir/install-service.sh" << 'SCRIPT'
#!/usr/bin/env bash
# Clawdbot systemd 服务安装脚本
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="clawdbot"
SERVICE_FILE="$HOME/.config/systemd/user/${SERVICE_NAME}.service"

# 如果是独立版，使用内置 Node
NODE_BIN="$(which node 2>/dev/null || echo "")"
if [[ -d "$SCRIPT_DIR/node/bin" ]]; then
  NODE_BIN="$SCRIPT_DIR/node/bin/node"
fi

if [[ -z "$NODE_BIN" ]]; then
  echo "错误: 未找到 Node.js"
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  安装 Clawdbot 为系统服务                ║"
echo "╚══════════════════════════════════════════╝"
echo ""

mkdir -p "$HOME/.config/systemd/user"

cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Clawdbot AI Gateway
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$SCRIPT_DIR
ExecStart=$NODE_BIN $SCRIPT_DIR/dist/entry.js gateway run --port 18789 --allow-unconfigured
ExecReload=/bin/kill -USR1 \$MAINPID
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=HOME=$HOME

# 日志
StandardOutput=append:$SCRIPT_DIR/logs/gateway.log
StandardError=append:$SCRIPT_DIR/logs/gateway-error.log

# 安全限制
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=$HOME/.clawdbot $SCRIPT_DIR/logs

[Install]
WantedBy=default.target
EOF

echo "  服务文件: $SERVICE_FILE"

# 重载并启用
systemctl --user daemon-reload
systemctl --user enable "$SERVICE_NAME"

echo ""
echo "  ✓ 服务已安装！"
echo ""
echo "  常用命令:"
echo "    systemctl --user start clawdbot     # 启动"
echo "    systemctl --user stop clawdbot      # 停止"
echo "    systemctl --user restart clawdbot   # 重启"
echo "    systemctl --user status clawdbot    # 状态"
echo "    journalctl --user -u clawdbot -f    # 日志"
echo ""
echo "  现在启动? (y/n)"
read -r answer
if [[ "$answer" == "y" || "$answer" == "Y" ]]; then
  systemctl --user start "$SERVICE_NAME"
  sleep 2
  systemctl --user status "$SERVICE_NAME" --no-pager || true
fi
echo ""
SCRIPT
  chmod +x "$dir/install-service.sh"

  # ── uninstall.sh ──
  cat > "$dir/uninstall.sh" << 'SCRIPT'
#!/usr/bin/env bash
# Clawdbot 卸载脚本
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="clawdbot"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║       Clawdbot 卸载程序                  ║"
echo "╚══════════════════════════════════════════╝"
echo ""

echo "将卸载以下内容:"
echo "  1. 停止运行中的 Clawdbot"
echo "  2. 移除 systemd 服务 (如果已安装)"
echo "  3. 移除安装目录: $SCRIPT_DIR"
echo ""
echo "  ⚠  配置文件 (~/.clawdbot) 将保留"
echo ""
echo "确认卸载? (输入 yes 确认)"
read -r answer

if [[ "$answer" != "yes" ]]; then
  echo "已取消"
  exit 0
fi

# 1. 停止服务
echo ""
echo "[1/3] 停止服务..."
"$SCRIPT_DIR/stop.sh" 2>/dev/null || true

# 2. 移除 systemd 服务
echo "[2/3] 移除 systemd 服务..."
if [[ -f "$HOME/.config/systemd/user/${SERVICE_NAME}.service" ]]; then
  systemctl --user stop "$SERVICE_NAME" 2>/dev/null || true
  systemctl --user disable "$SERVICE_NAME" 2>/dev/null || true
  rm -f "$HOME/.config/systemd/user/${SERVICE_NAME}.service"
  systemctl --user daemon-reload 2>/dev/null || true
  echo "  已移除 systemd 服务"
else
  echo "  无 systemd 服务"
fi

# 3. 移除安装目录
echo "[3/3] 移除安装目录..."
echo "  删除: $SCRIPT_DIR"
cd /tmp
rm -rf "$SCRIPT_DIR"

echo ""
echo "✓ Clawdbot 已卸载"
echo ""
echo "配置文件保留在: ~/.clawdbot"
echo "如需完全清除: rm -rf ~/.clawdbot"
echo ""
SCRIPT
  chmod +x "$dir/uninstall.sh"

  # ── logrotate 配置 ──
  mkdir -p "$dir/config"
  cat > "$dir/config/clawdbot-logrotate" << 'SCRIPT'
# Clawdbot 日志轮转配置
# 安装: sudo cp config/clawdbot-logrotate /etc/logrotate.d/clawdbot
# 或手动: logrotate -f config/clawdbot-logrotate

$HOME/clawdbot/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    copytruncate
    maxsize 50M
}
SCRIPT

  # ── README.md ──
  local version
  version=$(node -e "console.log(require('$ROOT_DIR/package.json').version)" 2>/dev/null || echo "latest")

  cat > "$dir/README.md" << README
# Clawdbot v${version} (Linux)

个人 AI 助手网关 - 解压即用！

## 快速开始 (3步)

\`\`\`bash
# 1. 解压
tar -xzf clawdbot-linux-*.tar.gz
cd clawdbot

# 2. 启动配置向导
./setup.sh

# 3. 在浏览器中完成配置
#    自动打开: http://localhost:18789/setup
\`\`\`

## 脚本说明

| 脚本 | 说明 |
|------|------|
| \`./setup.sh\` | **首次使用** - 启动并打开配置页面 |
| \`./start.sh\` | 前台启动 (显示日志) |
| \`./start-daemon.sh\` | 后台启动 |
| \`./stop.sh\` | 停止服务 |
| \`./restart.sh\` | 重启服务 |
| \`./status.sh\` | 查看运行状态 |
| \`./logs.sh\` | 查看日志 (\`-f\` 实时跟踪) |
| \`./install-service.sh\` | 安装为系统服务 (开机自启) |
| \`./uninstall.sh\` | 卸载 |

## 访问地址

- 控制台: http://localhost:18789/
- 配置向导: http://localhost:18789/setup

## 配置为系统服务 (可选)

\`\`\`bash
./install-service.sh
\`\`\`

安装后会开机自动启动，无需手动运行。

## 技术支持

https://www.tecbinai.com/
README
}

# ─── 生成便携版安装脚本 ─────────────────────────────────────────

generate_install_script() {
  local dir="$1"

  cat > "$dir/install.sh" << 'SCRIPT'
#!/usr/bin/env bash
# Clawdbot 依赖安装脚本
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║       Clawdbot 安装程序                  ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# 检查 Node.js
echo "检查 Node.js..."
if ! command -v node &>/dev/null; then
  echo ""
  echo "  ✗ 未检测到 Node.js"
  echo ""
  echo "  请先安装 Node.js 22+:"
  echo ""
  echo "  # Ubuntu/Debian:"
  echo "  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
  echo "  sudo apt-get install -y nodejs"
  echo ""
  echo "  # CentOS/RHEL/Fedora:"
  echo "  curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -"
  echo "  sudo dnf install -y nodejs"
  echo ""
  echo "  # 或使用 nvm:"
  echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
  echo "  nvm install 22"
  echo ""
  exit 1
fi

NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
echo "  Node.js: $(node -v)"

if [[ "$NODE_MAJOR" -lt 22 ]]; then
  echo ""
  echo "  ⚠ Node.js 版本过低，需要 22+"
  echo "  当前: $(node -v)"
  echo ""
  echo "  请升级 Node.js: https://nodejs.org/"
  exit 1
fi

echo ""
echo "安装依赖 (可能需要几分钟)..."
echo ""

npm install --omit=dev

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║       ✓ 安装完成！                       ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  下一步: ./setup.sh (启动配置向导)"
echo ""
SCRIPT
  chmod +x "$dir/install.sh"
}

# ─── 导出函数供子进程使用 ──────────────────────────────────────
export -f build_standalone build_portable build_deb build_rpm build_appimage
export -f generate_runtime_scripts generate_install_script
export -f log_info log_success log_warn log_error
export OUTPUT_DIR COMMON_DIR SCRIPT_DIR ROOT_DIR NODE_VERSION NODE_DOWNLOAD_BASE
export MIRROR HAS_DPKG HAS_RPM HAS_DOCKER HAS_FAKEROOT
export RED GREEN YELLOW BLUE CYAN BOLD NC

# ─── 执行并行构建 ─────────────────────────────────────────────

# 创建任务列表
TASK_LIST=()
for target in "${BUILD_TARGETS[@]}"; do
  case "$target" in
    standalone-x64)  TASK_LIST+=("build_standalone x64") ;;
    standalone-arm64) TASK_LIST+=("build_standalone arm64") ;;
    portable)        TASK_LIST+=("build_portable") ;;
    deb-x64)         TASK_LIST+=("build_deb x64") ;;
    deb-arm64)       TASK_LIST+=("build_deb arm64") ;;
    rpm-x64)         TASK_LIST+=("build_rpm x64") ;;
    rpm-arm64)       TASK_LIST+=("build_rpm arm64") ;;
    appimage-x64)    TASK_LIST+=("build_appimage x64") ;;
    *)               log_warn "未知目标: $target" ;;
  esac
done

if [[ ${#TASK_LIST[@]} -eq 0 ]]; then
  log_error "无有效构建目标"
  exit 1
fi

echo "  开始 ${#TASK_LIST[@]} 个构建任务..."
echo ""

# 使用 GNU parallel 或 fallback 到 xargs + bash
if [[ "$HAS_PARALLEL" == true ]] && [[ ${#TASK_LIST[@]} -gt 1 ]]; then
  log_info "使用 GNU parallel ($MAX_JOBS 并行)"
  printf '%s\n' "${TASK_LIST[@]}" | parallel -j "$MAX_JOBS" --halt soon,fail=1 bash -c '{}'
else
  # Fallback: 用后台进程 + wait 实现并行
  log_info "使用内置并行 (最多 $MAX_JOBS 并发)"
  PIDS=()
  for task in "${TASK_LIST[@]}"; do
    # 控制并发数
    while [[ ${#PIDS[@]} -ge $MAX_JOBS ]]; do
      # 等待任意一个完成
      wait -n 2>/dev/null || true
      # 清理已完成的 PID
      NEW_PIDS=()
      for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
          NEW_PIDS+=("$pid")
        fi
      done
      PIDS=("${NEW_PIDS[@]}")
    done

    bash -c "$task" &
    PIDS+=($!)
  done

  # 等待所有任务完成
  FAILED=0
  for pid in "${PIDS[@]}"; do
    if ! wait "$pid"; then
      FAILED=$((FAILED + 1))
    fi
  done

  if [[ $FAILED -gt 0 ]]; then
    log_warn "$FAILED 个任务失败"
  fi
fi

# ─── Phase 3: 汇总报告 ─────────────────────────────────────────
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
MINUTES=$((ELAPSED / 60))
SECONDS=$((ELAPSED % 60))

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║           构建完成! Build Complete!              ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo "  耗时: ${MINUTES}分${SECONDS}秒"
echo ""
echo "  产物列表:"

# 列出所有生成的文件，同时生成 SHA256 校验和
CHECKSUM_FILE="$OUTPUT_DIR/SHA256SUMS"
> "$CHECKSUM_FILE"

for f in "$OUTPUT_DIR"/*.tar.gz "$OUTPUT_DIR"/*.deb "$OUTPUT_DIR"/*.rpm; do
  if [[ -f "$f" ]]; then
    local_size=$(du -sm "$f" | cut -f1)
    echo -e "    ${GREEN}✓${NC} $(basename "$f") (${local_size}MB)"

    # 生成单独的 .sha256 文件和汇总文件
    sha256sum "$f" | sed "s|$OUTPUT_DIR/||" >> "$CHECKSUM_FILE"
    sha256sum "$f" | awk '{print $1 "  " FILENAME}' FILENAME="$(basename "$f")" > "${f}.sha256"
  fi
done

echo ""
echo -e "    ${GREEN}✓${NC} SHA256SUMS (校验和)"

echo ""
echo "  输出目录: $OUTPUT_DIR"
echo "  构建日志: $LOGS_DIR/"
echo ""
echo "  用户使用方式:"
echo "    tar -xzf clawdbot-linux-*.tar.gz"
echo "    cd clawdbot && ./setup.sh"
echo ""
