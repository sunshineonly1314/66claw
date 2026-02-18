#!/usr/bin/env bash
# ============================================================================
# ClawdbotCN 本地 CI/CD 自动配置脚本
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

# ============================================================================
# 步骤 1: 检查依赖
# ============================================================================
check_dependencies() {
    log_info "检查系统依赖..."

    local missing=()

    if ! command -v node &>/dev/null; then
        missing+=("node")
    fi

    if ! command -v pnpm &>/dev/null; then
        missing+=("pnpm")
    fi

    if ! command -v ssh &>/dev/null; then
        missing+=("ssh")
    fi

    if ! command -v git &>/dev/null; then
        missing+=("git")
    fi

    if [ ${#missing[@]} -gt 0 ]; then
        log_error "缺少依赖: ${missing[*]}"
        log_info "请先安装缺失的工具"
        exit 1
    fi

    log_success "依赖检查通过"
}

# ============================================================================
# 步骤 2: 生成 SSH 密钥
# ============================================================================
setup_ssh_keys() {
    log_info "配置 SSH 密钥..."

    local ssh_dir="$HOME/.ssh"
    local key_file="$ssh_dir/id_ed25519_cicd"

    mkdir -p "$ssh_dir"
    chmod 700 "$ssh_dir"

    if [ ! -f "$key_file" ]; then
        log_info "生成新的 SSH 密钥..."
        ssh-keygen -t ed25519 -f "$key_file" -N "" -C "cicd@clawdbot"
        log_success "SSH 密钥已生成: $key_file"
    else
        log_warn "SSH 密钥已存在: $key_file"
    fi

    echo ""
    log_info "公钥内容（需要复制到目标机器）:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    cat "$key_file.pub"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

# ============================================================================
# 步骤 3: 配置 SSH 免密登录
# ============================================================================
setup_passwordless_ssh() {
    log_info "配置 SSH 免密登录..."

    # 读取配置
    local windows_host=$(jq -r '.builders.windows.host' "$SCRIPT_DIR/config.json")
    local windows_user=$(jq -r '.builders.windows.user' "$SCRIPT_DIR/config.json")
    local macos_host=$(jq -r '.builders.macos.host' "$SCRIPT_DIR/config.json")
    local macos_user=$(jq -r '.builders.macos.user' "$SCRIPT_DIR/config.json")

    local key_file="$HOME/.ssh/id_ed25519_cicd"

    echo ""
    log_info "请按照以下步骤手动配置免密登录:"
    echo ""
    echo "1️⃣  Windows 笔记本 ($windows_host):"
    echo "   ─────────────────────────────────────────────────────────────"
    echo "   ssh-copy-id -i $key_file.pub $windows_user@$windows_host"
    echo ""
    echo "   或手动复制公钥到 Windows:"
    echo "   C:\\Users\\$windows_user\\.ssh\\authorized_keys"
    echo ""
    echo "2️⃣  Mac Mini ($macos_host):"
    echo "   ─────────────────────────────────────────────────────────────"
    echo "   ssh-copy-id -i $key_file.pub $macos_user@$macos_host"
    echo ""

    read -p "已完成配置？ (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_warn "跳过免密登录配置"
        return
    fi

    # 测试连接
    log_info "测试 SSH 连接..."

    if ssh -i "$key_file" -o ConnectTimeout=5 "$windows_user@$windows_host" "echo Windows OK" 2>/dev/null; then
        log_success "Windows 连接成功"
    else
        log_warn "Windows 连接失败，请检查配置"
    fi

    if ssh -i "$key_file" -o ConnectTimeout=5 "$macos_user@$macos_host" "echo Mac OK" 2>/dev/null; then
        log_success "Mac 连接成功"
    else
        log_warn "Mac 连接失败，请检查配置"
    fi
}

# ============================================================================
# 步骤 4: 创建目录结构
# ============================================================================
setup_directories() {
    log_info "创建目录结构..."

    cd "$SCRIPT_DIR"

    mkdir -p logs
    mkdir -p artifacts/windows
    mkdir -p artifacts/macos
    mkdir -p tmp

    log_success "目录创建完成"
}

# ============================================================================
# 步骤 5: 安装 Node.js 依赖
# ============================================================================
install_dependencies() {
    log_info "安装 Node.js 依赖..."

    cd "$SCRIPT_DIR"

    if [ ! -f "package.json" ]; then
        log_info "初始化 npm 项目..."
        npm init -y

        # 安装依赖
        npm install express body-parser winston
    fi

    log_success "依赖安装完成"
}

# ============================================================================
# 步骤 6: 配置 Gitee Webhook
# ============================================================================
setup_gitee_webhook() {
    log_info "配置 Gitee Webhook..."

    local webhook_port=$(jq -r '.webhook.port' "$SCRIPT_DIR/config.json")
    local webhook_secret=$(jq -r '.webhook.secret' "$SCRIPT_DIR/config.json")

    echo ""
    log_info "Gitee Webhook 配置信息:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "1. 登录 Gitee → 仓库 → 管理 → WebHooks"
    echo "2. 添加 WebHook:"
    echo "   URL: http://YOUR_PUBLIC_IP:$webhook_port/webhook"
    echo "   密码: $webhook_secret"
    echo "   事件: Push, Tag Push"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    if [ "$webhook_secret" = "CHANGE_THIS_SECRET" ]; then
        log_warn "请修改 config.json 中的 webhook.secret！"
        log_info "建议使用: openssl rand -hex 32"
    fi
}

# ============================================================================
# 步骤 7: 生成启动脚本
# ============================================================================
generate_start_script() {
    log_info "生成启动脚本..."

    cat > "$SCRIPT_DIR/start.sh" << 'EOF'
#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 启动 ClawdbotCN CI/CD Webhook 服务..."

cd "$SCRIPT_DIR"

# 检查是否已在运行
if [ -f "tmp/webhook.pid" ]; then
    PID=$(cat tmp/webhook.pid)
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "⚠️  服务已在运行 (PID: $PID)"
        exit 1
    fi
fi

# 启动服务
node webhook-server.js > logs/webhook.log 2>&1 &
PID=$!

echo "$PID" > tmp/webhook.pid
echo "✅ 服务已启动 (PID: $PID)"
echo "📋 日志文件: logs/webhook.log"
echo "🔍 查看日志: tail -f logs/webhook.log"
EOF

    cat > "$SCRIPT_DIR/stop.sh" << 'EOF'
#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🛑 停止 Webhook 服务..."

cd "$SCRIPT_DIR"

if [ ! -f "tmp/webhook.pid" ]; then
    echo "⚠️  服务未运行"
    exit 1
fi

PID=$(cat tmp/webhook.pid)

if ps -p "$PID" > /dev/null 2>&1; then
    kill "$PID"
    rm tmp/webhook.pid
    echo "✅ 服务已停止"
else
    echo "⚠️  进程不存在 (PID: $PID)"
    rm tmp/webhook.pid
fi
EOF

    chmod +x "$SCRIPT_DIR/start.sh"
    chmod +x "$SCRIPT_DIR/stop.sh"

    log_success "启动脚本已生成"
}

# ============================================================================
# 主流程
# ============================================================================
main() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║  ClawdbotCN 本地 CI/CD 自动化配置向导                         ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo ""

    check_dependencies
    setup_directories
    setup_ssh_keys
    setup_passwordless_ssh
    install_dependencies
    generate_start_script
    setup_gitee_webhook

    echo ""
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║  ✅ 配置完成！                                                 ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo ""
    log_info "后续步骤:"
    echo "  1. 修改 ci/config.json 配置文件（用户名、密码等）"
    echo "  2. 配置 Gitee Webhook"
    echo "  3. 启动服务: cd ci && ./start.sh"
    echo "  4. 查看日志: tail -f ci/logs/webhook.log"
    echo ""
}

main "$@"
