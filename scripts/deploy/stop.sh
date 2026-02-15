#!/bin/bash
# OpenClawCN 服务停止脚本

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

PID_FILE="$SCRIPT_DIR/.gateway.pid"

info "停止 OpenClawCN Gateway..."

# 通过 PID 文件停止
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        info "停止进程 PID: $PID"
        kill "$PID" 2>/dev/null || true
        
        # 等待进程退出
        for i in {1..10}; do
            if ! kill -0 "$PID" 2>/dev/null; then
                break
            fi
            sleep 0.5
        done
        
        # 强制终止
        if kill -0 "$PID" 2>/dev/null; then
            warn "进程未响应，强制终止..."
            kill -9 "$PID" 2>/dev/null || true
        fi
    fi
    rm -f "$PID_FILE"
fi

# 查找并终止所有相关进程
PIDS=$(pgrep -f "node.*dist/index.js.*gateway" 2>/dev/null || true)
if [ -n "$PIDS" ]; then
    info "发现额外的 Gateway 进程: $PIDS"
    echo "$PIDS" | xargs kill 2>/dev/null || true
    sleep 1
    # 强制终止残留进程
    PIDS=$(pgrep -f "node.*dist/index.js.*gateway" 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        echo "$PIDS" | xargs kill -9 2>/dev/null || true
    fi
fi

success "Gateway 已停止"
