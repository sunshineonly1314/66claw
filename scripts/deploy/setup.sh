#!/bin/bash
# OpenClawCN WSL 环境安装脚本
# 在 WSL Ubuntu 中运行

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
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

info "OpenClawCN WSL 安装脚本"
info "安装目录: $SCRIPT_DIR"

# ========== 检查 Node.js 版本 ==========
info "检查 Node.js..."
if ! command -v node &> /dev/null; then
    warn "Node.js 未安装，正在安装..."
    
    # 安装 Node.js 22.x
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
    error "需要 Node.js 22 或更高版本，当前版本: $(node -v)"
fi
success "Node.js 版本: $(node -v)"

# ========== 检查/安装 pnpm ==========
info "检查 pnpm..."
if ! command -v pnpm &> /dev/null; then
    info "安装 pnpm..."
    sudo npm install -g pnpm
fi
success "pnpm 版本: $(pnpm -v)"

# ========== 安装项目依赖 ==========
info "安装项目依赖..."
pnpm install --frozen-lockfile --prod
success "依赖安装完成"

# ========== 创建配置目录 ==========
CONFIG_DIR="$HOME/.openclawcn"
info "创建配置目录: $CONFIG_DIR"
mkdir -p "$CONFIG_DIR"
mkdir -p "$CONFIG_DIR/credentials"
mkdir -p "$CONFIG_DIR/sessions"

# ========== 创建环境配置文件 ==========
ENV_FILE="$SCRIPT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    info "创建环境配置文件..."
    cat > "$ENV_FILE" << 'EOF'
# OpenClawCN 环境配置
# 请根据需要修改以下配置

# Gateway 配置
OPENCLAWCN_GATEWAY_PORT=18789
OPENCLAWCN_BRIDGE_PORT=18790
OPENCLAWCN_GATEWAY_BIND=lan

# Gateway Token (可选，用于 API 认证)
# OPENCLAWCN_GATEWAY_TOKEN=your-token-here

# Claude AI 配置 (可选)
# CLAUDE_AI_SESSION_KEY=your-session-key
# CLAUDE_WEB_SESSION_KEY=your-web-session-key
# CLAUDE_WEB_COOKIE=your-web-cookie

# 配置目录
OPENCLAWCN_CONFIG_DIR=$HOME/.openclawcn
OPENCLAWCN_WORKSPACE_DIR=$HOME/clawd
EOF
    success "环境配置文件已创建: $ENV_FILE"
    warn "请根据需要编辑 $ENV_FILE 配置文件"
else
    info "环境配置文件已存在"
fi

# ========== 创建工作目录 ==========
WORKSPACE_DIR="$HOME/clawd"
info "创建工作目录: $WORKSPACE_DIR"
mkdir -p "$WORKSPACE_DIR"

# ========== 设置脚本权限 ==========
info "设置脚本权限..."
chmod +x "$SCRIPT_DIR/start.sh"
chmod +x "$SCRIPT_DIR/stop.sh"
chmod +x "$SCRIPT_DIR/status.sh"

# ========== 创建 systemd 用户服务 (可选) ==========
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
if [ -d "/run/systemd/system" ]; then
    info "创建 systemd 用户服务..."
    mkdir -p "$SYSTEMD_USER_DIR"
    
    cat > "$SYSTEMD_USER_DIR/openclawcn-gateway.service" << EOF
[Unit]
Description=OpenClawCN Gateway Service
After=network.target

[Service]
Type=simple
WorkingDirectory=$SCRIPT_DIR
EnvironmentFile=$SCRIPT_DIR/.env
ExecStart=/usr/bin/node dist/index.js gateway --bind lan --port 18789
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF

    systemctl --user daemon-reload 2>/dev/null || true
    success "systemd 服务已创建"
    info "启用服务: systemctl --user enable openclawcn-gateway"
    info "启动服务: systemctl --user start openclawcn-gateway"
else
    info "systemd 不可用，跳过服务创建"
fi

success "========================================="
success "OpenClawCN 安装完成!"
success "========================================="
echo ""
info "快速启动:"
info "  启动服务: ./start.sh"
info "  停止服务: ./stop.sh"
info "  查看状态: ./status.sh"
echo ""
info "访问地址 (Windows):"
info "  Gateway: http://localhost:18789"
info "  Bridge:  http://localhost:18790"
echo ""
info "配置文件: $SCRIPT_DIR/.env"
info "日志文件: $SCRIPT_DIR/logs/gateway.log"
