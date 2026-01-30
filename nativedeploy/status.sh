#!/bin/bash
# Clawdbot 服务状态检查脚本

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info() { echo -e "${CYAN}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

# 加载环境变量
if [ -f "$SCRIPT_DIR/.env" ]; then
    set -a
    source "$SCRIPT_DIR/.env"
    set +a
fi

GATEWAY_PORT="${CLAWDBOT_GATEWAY_PORT:-18789}"
PID_FILE="$SCRIPT_DIR/.gateway.pid"

echo ""
echo "========== Clawdbot 服务状态 =========="
echo ""

# 检查 PID 文件
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        success "Gateway 运行中 (PID: $PID)"
        
        # 显示进程信息
        ps -p "$PID" -o pid,user,%cpu,%mem,etime,command --no-headers 2>/dev/null || true
    else
        warn "Gateway 未运行 (PID 文件存在但进程已终止)"
    fi
else
    error "Gateway 未运行"
fi

echo ""

# 检查端口
info "端口状态:"
if command -v ss &> /dev/null; then
    ss -tlnp 2>/dev/null | grep -E ":$GATEWAY_PORT |:18790 " || echo "  端口未监听"
elif command -v netstat &> /dev/null; then
    netstat -tlnp 2>/dev/null | grep -E ":$GATEWAY_PORT |:18790 " || echo "  端口未监听"
fi

echo ""

# 显示网络地址
info "访问地址:"
echo "  Gateway: http://localhost:$GATEWAY_PORT"

WSL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -n "$WSL_IP" ]; then
    echo "  WSL IP:  http://$WSL_IP:$GATEWAY_PORT"
fi

echo ""

# 检查日志
LOG_FILE="$SCRIPT_DIR/logs/gateway.log"
if [ -f "$LOG_FILE" ]; then
    info "最近日志 (最后 10 行):"
    tail -10 "$LOG_FILE" 2>/dev/null | sed 's/^/  /'
else
    info "日志文件不存在: $LOG_FILE"
fi

echo ""
echo "======================================="
