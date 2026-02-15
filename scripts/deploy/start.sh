#!/bin/bash
# OpenClawCN 服务启动脚本

set -e

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

# 默认配置
GATEWAY_PORT="${OPENCLAWCN_GATEWAY_PORT:-18789}"
GATEWAY_BIND="${OPENCLAWCN_GATEWAY_BIND:-lan}"

# 创建日志目录
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"

# 检查是否已在运行
PID_FILE="$SCRIPT_DIR/.gateway.pid"
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        warn "Gateway 已在运行 (PID: $OLD_PID)"
        warn "如需重启，请先运行 ./stop.sh"
        exit 1
    else
        rm -f "$PID_FILE"
    fi
fi

# 检查端口是否被占用
if command -v ss &> /dev/null; then
    if ss -tlnp 2>/dev/null | grep -q ":$GATEWAY_PORT "; then
        error "端口 $GATEWAY_PORT 已被占用"
        ss -tlnp 2>/dev/null | grep ":$GATEWAY_PORT " || true
        exit 1
    fi
elif command -v netstat &> /dev/null; then
    if netstat -tlnp 2>/dev/null | grep -q ":$GATEWAY_PORT "; then
        error "端口 $GATEWAY_PORT 已被占用"
        exit 1
    fi
fi

info "启动 OpenClawCN Gateway..."
info "  端口: $GATEWAY_PORT"
info "  绑定: $GATEWAY_BIND"
info "  日志: $LOG_DIR/gateway.log"

# 启动 Gateway
nohup node dist/index.js gateway \
    --bind "$GATEWAY_BIND" \
    --port "$GATEWAY_PORT" \
    > "$LOG_DIR/gateway.log" 2>&1 &

# 保存 PID
GATEWAY_PID=$!
echo "$GATEWAY_PID" > "$PID_FILE"

# 等待启动
sleep 2

# 检查是否成功启动
if kill -0 "$GATEWAY_PID" 2>/dev/null; then
    success "Gateway 启动成功 (PID: $GATEWAY_PID)"
    echo ""
    info "访问地址:"
    info "  Gateway: http://localhost:$GATEWAY_PORT"
    
    # 显示 WSL IP (方便局域网访问)
    WSL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    if [ -n "$WSL_IP" ]; then
        info "  WSL IP:  http://$WSL_IP:$GATEWAY_PORT"
    fi
    
    echo ""
    info "查看日志: tail -f $LOG_DIR/gateway.log"
    info "停止服务: ./stop.sh"
else
    error "Gateway 启动失败"
    error "请查看日志: $LOG_DIR/gateway.log"
    rm -f "$PID_FILE"
    exit 1
fi
