#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# OpenClawCN macOS 一键安装脚本
# 用法: curl -fsSL https://oss.openclawcn.cn/install.sh | bash
#
# 通过 curl 管道执行的文件不带隔离属性 → 完全绕过 Gatekeeper
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

# ── 清理钩子 ──
cleanup() {
    rm -rf "${TEMP_DIR:-}" 2>/dev/null || true
    # 如果 DMG 还挂载着, 卸载
    [ -n "${MOUNT_POINT:-}" ] && hdiutil detach "$MOUNT_POINT" -quiet 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ── 颜色 ──
R='\033[0;31m'; G='\033[0;32m'; Y='\033[1;33m'; B='\033[0;34m'; C='\033[0;36m'; W='\033[1;37m'; NC='\033[0m'
ok()   { echo -e "  ${G}✓${NC} $*"; }
warn() { echo -e "  ${Y}⚠${NC} $*"; }
fail() { echo -e "  ${R}✗${NC} $*"; exit 1; }
step() { echo -e "\n${C}[$1/$TOTAL]${NC} ${W}$2${NC}"; }

TOTAL=6
VERSION="1.1.6"
INSTALL_DIR="/Applications/OpenClawCN.app"
STATE_DIR="$HOME/Library/Application Support/OpenClawCN"
LOG_DIR="$HOME/Library/Logs/OpenClawCN"
CACHE_DIR="$HOME/Library/Caches/OpenClawCN"
PORT=18789
MOUNT_POINT=""

# DMG 下载源 (按优先级)
CDN_MIRRORS=(
    "https://oss.openclawcn.cn/macos/releases"
    "https://cos.openclawcn.cn/macos/releases"
)
INTL_MIRRORS=(
    "https://github.com/openclawcn/releases/download/v${VERSION}"
)

echo ""
echo -e "${W}  OpenClawCN macOS 安装程序${NC}"
echo -e "${W}  ═══════════════════════${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════
# STEP 1: 系统检测
# ═══════════════════════════════════════════════════════════════
step 1 "检测系统环境"

# macOS 版本
MACOS_VER=$(sw_vers -productVersion)
MAJOR_VER=$(echo "$MACOS_VER" | cut -d. -f1)
[ "$MAJOR_VER" -ge 12 ] || fail "需要 macOS 12 Monterey 或更高 (当前: $MACOS_VER)"

# 架构
HW_ARCH=$(uname -m)
case "$HW_ARCH" in
    arm64) ARCH_LABEL="Apple Silicon" ;;
    x86_64) ARCH_LABEL="Intel" ;;
    *) fail "不支持的架构: $HW_ARCH" ;;
esac

# 磁盘
FREE_MB=$(df -m /Applications 2>/dev/null | tail -1 | awk '{print $4}')
[ "${FREE_MB:-0}" -gt 500 ] || fail "磁盘空间不足 (需要 500MB, 可用 ${FREE_MB}MB)"

# 写入权限检查
if ! touch /Applications/.openclawcn-write-test 2>/dev/null; then
    fail "/Applications 目录无写入权限。请尝试:\n  sudo bash -c \"\$(curl -fsSL https://oss.openclawcn.cn/install.sh)\""
fi
rm -f /Applications/.openclawcn-write-test 2>/dev/null || true

ok "macOS $MACOS_VER / $ARCH_LABEL / 可用 ${FREE_MB}MB"

# ═══════════════════════════════════════════════════════════════
# STEP 2: 网络检测
# ═══════════════════════════════════════════════════════════════
step 2 "检测网络环境"

NET_MODE="cn"
CN_MS=$(curl -s -o /dev/null -w "%{time_total}" --connect-timeout 3 https://registry.npmmirror.com 2>/dev/null || echo "999")
INTL_MS=$(curl -s -o /dev/null -w "%{time_total}" --connect-timeout 3 https://registry.npmjs.org 2>/dev/null || echo "999")

if awk "BEGIN{exit(!($INTL_MS < 5 && $INTL_MS < $CN_MS))}"; then
    NET_MODE="international"
    MIRRORS=("${INTL_MIRRORS[@]}" "${CDN_MIRRORS[@]}")
    ok "国际网络 (延迟: ${INTL_MS}s)"
else
    MIRRORS=("${CDN_MIRRORS[@]}" "${INTL_MIRRORS[@]}")
    if awk "BEGIN{exit(!($CN_MS < 5))}"; then
        ok "国内网络, 使用 CN 镜像 (延迟: ${CN_MS}s)"
    else
        warn "网络较慢, 下载可能需要较长时间"
    fi
fi

# ═══════════════════════════════════════════════════════════════
# STEP 3: 下载 DMG
# ═══════════════════════════════════════════════════════════════
step 3 "下载安装包"

DMG_NAME="OpenClawCN-macOS-v${VERSION}-universal.dmg"
TEMP_DIR=$(mktemp -d)
DMG_PATH="$TEMP_DIR/$DMG_NAME"
DOWNLOADED=false

for mirror in "${MIRRORS[@]}"; do
    URL="${mirror}/${DMG_NAME}"
    echo "  尝试: ${mirror}..."

    if curl -fL --connect-timeout 15 --max-time 600 \
        --progress-bar -o "$DMG_PATH" "$URL" 2>&1; then
        # 验证文件 (DMG 至少 50MB)
        FSIZE=$(stat -f%z "$DMG_PATH" 2>/dev/null || echo 0)
        if [ "$FSIZE" -gt 52428800 ]; then
            DOWNLOADED=true
            ok "下载完成 ($(echo "scale=1; $FSIZE/1048576" | bc 2>/dev/null || echo "?")MB)"
            break
        fi
        warn "文件不完整 (${FSIZE} bytes), 尝试下一个..."
        rm -f "$DMG_PATH"
    else
        warn "下载失败, 尝试下一个..."
    fi
done

$DOWNLOADED || fail "所有镜像下载失败。请检查网络后重试。"

# ═══════════════════════════════════════════════════════════════
# STEP 4: 安装
# ═══════════════════════════════════════════════════════════════
step 4 "安装应用"

# 先卸载 LaunchAgent (如果存在)
LAUNCH_AGENT_LABEL="cn.openclawcn.gateway"
LAUNCH_AGENT_PLIST="$HOME/Library/LaunchAgents/${LAUNCH_AGENT_LABEL}.plist"
if launchctl list "$LAUNCH_AGENT_LABEL" >/dev/null 2>&1; then
    launchctl bootout "gui/$(id -u)/$LAUNCH_AGENT_LABEL" 2>/dev/null || \
        launchctl unload "$LAUNCH_AGENT_PLIST" 2>/dev/null || true
    ok "已卸载旧 LaunchAgent"
    sleep 1
fi

# 清理旧 PID 文件中的残留进程
PID_FILE="$STATE_DIR/gateway.pid"
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE" 2>/dev/null || echo "")
    if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
        warn "正在停止旧进程 (PID: $OLD_PID)..."
        kill "$OLD_PID" 2>/dev/null || true
        sleep 2
    fi
    rm -f "$PID_FILE"
fi

# 停止已有实例 (端口检测)
if lsof -i ":$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    warn "检测到已运行的实例, 正在停止..."
    # 先尝试优雅关闭
    curl -s -X POST "http://localhost:$PORT/api/shutdown" 2>/dev/null || true
    sleep 2
    # 强制杀死 (精确匹配 entry.js gateway, 避免误杀其他进程)
    pkill -f "node.*dist/entry.js.*gateway" 2>/dev/null || true
    sleep 1
    # 确认端口已释放
    if lsof -i ":$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
        STUCK_PID=$(lsof -t -i ":$PORT" -sTCP:LISTEN 2>/dev/null | head -1)
        kill -9 "$STUCK_PID" 2>/dev/null || true
        sleep 1
    fi
fi

# 备份旧版本
if [ -d "$INSTALL_DIR" ]; then
    BACKUP="${INSTALL_DIR}.backup.$(date +%Y%m%d%H%M%S)"
    warn "检测到旧版本, 备份到: $(basename "$BACKUP")"
    if ! mv "$INSTALL_DIR" "$BACKUP"; then
        warn "备份失败 (应用可能正在被 Finder 使用), 尝试强制替换..."
        rm -rf "$INSTALL_DIR" || fail "无法删除旧版本。请手动关闭 OpenClawCN 后重试。"
    fi
fi

# 挂载 DMG → 复制 .app → 卸载 DMG
MOUNT_INFO=$(hdiutil attach "$DMG_PATH" -nobrowse 2>&1)
MOUNT_POINT=$(echo "$MOUNT_INFO" | tail -1 | awk '{$1=$2=""; print $0}' | sed 's/^ *//')

if [ -z "$MOUNT_POINT" ] || [ ! -d "$MOUNT_POINT" ]; then
    # 如果挂载失败, 尝试从 /Volumes 找
    MOUNT_POINT=$(ls -d /Volumes/OpenClawCN* 2>/dev/null | head -1)
fi

if [ -z "$MOUNT_POINT" ] || [ ! -d "$MOUNT_POINT/OpenClawCN.app" ]; then
    fail "DMG 挂载失败或内容异常"
fi

# 复制 (通过 curl 安装的不带隔离属性!)
if ! cp -R "$MOUNT_POINT/OpenClawCN.app" /Applications/; then
    fail "复制 OpenClawCN.app 到 /Applications 失败。请检查磁盘空间和权限。"
fi
hdiutil detach "$MOUNT_POINT" -quiet 2>/dev/null || true
MOUNT_POINT=""  # 已卸载, 清空变量防止 trap 重复卸载

# 移除隔离属性 (curl 安装通常不带, 但以防万一)
xattr -cr "$INSTALL_DIR" 2>/dev/null || true

# 设置权限
chmod +x "$INSTALL_DIR/Contents/MacOS/OpenClawCN"
chmod +x "$INSTALL_DIR/Contents/Resources/node/bin/node" 2>/dev/null || true
find "$INSTALL_DIR/Contents/Resources/tools" -type f -exec chmod +x {} \; 2>/dev/null || true

# Apple Silicon: ad-hoc 签名 (仅在没有真实证书签名时)
if [ "$HW_ARCH" = "arm64" ]; then
    # 检查 node 是否已有 Developer ID 签名 (避免覆盖)
    if codesign -dv "$INSTALL_DIR/Contents/Resources/node/bin/node" 2>&1 | grep -q "Authority=Developer ID"; then
        ok "检测到 Developer ID 签名, 跳过 ad-hoc 签名"
    else
        codesign --sign - --force "$INSTALL_DIR/Contents/Resources/node/bin/node" 2>/dev/null || true
        find "$INSTALL_DIR/Contents/Resources/tools" -type f -perm /111 -exec codesign --sign - --force {} \; 2>/dev/null || true
        find "$INSTALL_DIR/Contents/Resources/gateway/node_modules" -name "*.node" -exec codesign --sign - --force {} \; 2>/dev/null || true
    fi
fi

# 创建数据目录
mkdir -p "$STATE_DIR/config" "$STATE_DIR/data" "$STATE_DIR/tools" "$STATE_DIR/credentials"
mkdir -p "$LOG_DIR"
mkdir -p "$CACHE_DIR"

# 迁移旧配置
LEGACY="$HOME/.openclawcn"
if [ -d "$LEGACY" ] && [ ! -f "$STATE_DIR/.migrated" ]; then
    [ -f "$LEGACY/openclawcn.json" ] && [ ! -f "$STATE_DIR/config/openclawcn.json" ] && \
        cp "$LEGACY/openclawcn.json" "$STATE_DIR/config/" 2>/dev/null || true
    # 凭据迁移
    [ -d "$LEGACY/credentials" ] && \
        cp -R "$LEGACY/credentials/"* "$STATE_DIR/credentials/" 2>/dev/null || true
    touch "$STATE_DIR/.migrated"
    ok "已从 ~/.openclawcn 迁移配置"
fi

# 写入网络配置
cat > "$STATE_DIR/config/network-profile.json" << NETJSON
{
    "detectedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "networkMode": "$NET_MODE",
    "installedVia": "curl-script",
    "version": "$VERSION"
}
NETJSON

# 清理 3 天前的备份
find /Applications -maxdepth 1 -name "OpenClawCN.app.backup.*" -mtime +3 -exec rm -rf {} \; 2>/dev/null || true

ok "安装到 $INSTALL_DIR"

# ═══════════════════════════════════════════════════════════════
# STEP 5: 启动 Gateway
# ═══════════════════════════════════════════════════════════════
step 5 "启动 Gateway 服务"

NODE_BIN="$INSTALL_DIR/Contents/Resources/node/bin/node"
GATEWAY_DIR="$INSTALL_DIR/Contents/Resources/gateway"
TOOLS_DIR="$INSTALL_DIR/Contents/Resources/tools"

export PATH="$(dirname "$NODE_BIN"):$TOOLS_DIR:$PATH"
export OPENCLAWCN_BUNDLED_SKILLS_DIR="$GATEWAY_DIR/skills"
export OPENCLAWCN_BUNDLED_TOOLS_DIR="$TOOLS_DIR"
export OPENCLAWCN_BUNDLED_PLUGINS_DIR="$GATEWAY_DIR/extensions"
export OPENCLAWCN_STATE_DIR="$STATE_DIR"
export OPENCLAWCN_GATEWAY_TOKEN="openclawcn2026"
export OPENCLAWCN_REGION=cn
export NODE_ENV=production

# 清理残留锁文件
rm -f "$STATE_DIR/gateway.lock" 2>/dev/null || true
rm -f "$HOME/.openclawcn/gateway.lock" 2>/dev/null || true
rm -f /tmp/openclawcn-"$(id -u)"/gateway.*.lock 2>/dev/null || true
rm -f /tmp/openclawcn-"$(id -u)"/gateway.*.heartbeat 2>/dev/null || true

# 后台启动
cd "$GATEWAY_DIR"
nohup "$NODE_BIN" dist/entry.js gateway run --port "$PORT" --allow-unconfigured \
    >> "$LOG_DIR/gateway.log" 2>> "$LOG_DIR/gateway-error.log" &
GW_PID=$!

# 保存 PID 文件
echo "$GW_PID" > "$STATE_DIR/gateway.pid"

# 等待启动 (最多 20 秒)
WAITED=0
while [ $WAITED -lt 20 ]; do
    # 检查进程是否还活着
    if ! kill -0 "$GW_PID" 2>/dev/null; then
        warn "Gateway 进程异常退出。查看日志: $LOG_DIR/gateway-error.log"
        break
    fi
    if curl -s "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
        ok "Gateway 已在端口 $PORT 启动 (PID: $GW_PID)"
        break
    fi
    sleep 1
    WAITED=$((WAITED + 1))
done

if [ $WAITED -ge 20 ]; then
    warn "Gateway 启动较慢, 请稍后访问 http://localhost:$PORT"
fi

# ═══════════════════════════════════════════════════════════════
# STEP 6: 打开浏览器
# ═══════════════════════════════════════════════════════════════
step 6 "打开配置页面"

# 检测是首次还是已配置
CONFIG_FILE="$STATE_DIR/config/openclawcn.json"
if [ -f "$CONFIG_FILE" ] && grep -q '"providers"' "$CONFIG_FILE" 2>/dev/null; then
    TARGET="http://localhost:$PORT/"
else
    TARGET="http://localhost:$PORT/setup"
fi

sleep 1
open "$TARGET" 2>/dev/null || true
ok "浏览器已打开: $TARGET"

# ═══════════════════════════════════════════════════════════════
# 完成
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${G}  ✓ 安装完成!${NC}"
echo ""
echo "  以后使用方法:"
echo "    • 在启动台(Launchpad)找到 OpenClawCN, 双击启动"
echo "    • 或在终端运行: open /Applications/OpenClawCN.app"
echo ""
echo "  配置页面: http://localhost:$PORT"
echo "  日志位置: $LOG_DIR/"
echo ""
echo "  停止 Gateway:"
echo "    launchctl unload ~/Library/LaunchAgents/cn.openclawcn.gateway.plist 2>/dev/null"
echo "    kill \$(cat ~/Library/Application\\ Support/OpenClawCN/gateway.pid) 2>/dev/null"
echo ""
echo "  卸载方法:"
echo "    bash /Applications/OpenClawCN.app/Contents/Resources/uninstall.sh"
echo "    # 完全清除 (含配置数据):"
echo "    bash /Applications/OpenClawCN.app/Contents/Resources/uninstall.sh --all"
echo ""
