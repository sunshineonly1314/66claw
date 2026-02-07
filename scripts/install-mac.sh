#!/bin/bash
# ============================================================================
# Clawdbot macOS 一键安装脚本
# ============================================================================
# 用法: curl -fsSL https://clawd.bot/install-mac.sh | bash
# 国内: curl -fsSL https://download.clawd.bot/install-mac.sh | bash
#
# 功能：
#   - 自动检测系统架构（arm64/x64）
#   - 下载离线安装包
#   - 自动处理 Gatekeeper
#   - 自动启动服务
#   - 自动打开配置页面
#
# 参考 Windows 离线安装脚本的健壮性设计
# ============================================================================

set -e

# ============================================================================
# 配置
# ============================================================================
VERSION="${CLAWDBOT_VERSION:-latest}"
MIRROR="${CLAWDBOT_MIRROR:-default}"  # default, cn
PORT=18789
MAX_WAIT=60
INSTALL_DIR="/Applications"
APP_NAME="Clawdbot.app"
CONFIG_DIR="$HOME/.clawdbot"
CONFIG_FILE="$CONFIG_DIR/clawdbot.json"
LOG_DIR="$CONFIG_DIR/logs"
LOG_FILE="$LOG_DIR/install.log"

# 下载源
DOWNLOAD_BASE_DEFAULT="https://download.clawd.bot"
DOWNLOAD_BASE_CN="https://download.clawd.bot"  # TODO: 替换为国内CDN

# ============================================================================
# 统一错误码（与 Windows ErrorCodes.ps1 对应）
# ============================================================================
ERROR_SUCCESS=0
ERROR_GENERAL=1
ERROR_USER_CANCELLED=2
ERROR_UNKNOWN=9

ERROR_ARCH_NOT_SUPPORTED=43
ERROR_DISK_SPACE_LOW=40
ERROR_PERMISSION_DENIED=41

ERROR_DOWNLOAD_FAILED=33
ERROR_MIRROR_UNAVAILABLE=34

ERROR_GATEWAY_START_FAILED=20
ERROR_GATEWAY_TIMEOUT=21
ERROR_PORT_IN_USE=30
ERROR_HTTP_SERVICE_UNAVAILABLE=35

ERROR_FILE_NOT_FOUND=62
ERROR_INSTALL_INCOMPLETE=51

# 错误描述
declare -A ERROR_MESSAGES=(
    [0]="成功"
    [1]="一般错误"
    [2]="用户取消"
    [9]="未知错误"
    [20]="Gateway 启动失败"
    [21]="Gateway 启动超时"
    [30]="端口被占用"
    [33]="下载失败"
    [34]="镜像不可用"
    [35]="HTTP 服务不响应"
    [40]="磁盘空间不足"
    [41]="权限不足"
    [43]="系统架构不支持"
    [51]="安装不完整"
    [62]="文件不存在"
)

# ============================================================================
# 颜色定义
# ============================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ============================================================================
# 日志函数
# ============================================================================
init_logging() {
    mkdir -p "$LOG_DIR"
    echo "========== Clawdbot 安装日志 ==========" > "$LOG_FILE"
    echo "安装时间: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
    echo "系统: $(uname -s) $(uname -r)" >> "$LOG_FILE"
    echo "架构: $(uname -m)" >> "$LOG_FILE"
    echo "用户: $USER" >> "$LOG_FILE"
    echo "========================================" >> "$LOG_FILE"
}

log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

log_info() { log "INFO" "$1"; }
log_ok() { log "OK" "$1"; }
log_warn() { log "WARN" "$1"; }
log_error() { log "ERROR" "$1"; }
log_debug() { log "DEBUG" "$1"; }

# ============================================================================
# 输出函数
# ============================================================================
print_banner() {
    echo ""
    echo -e "${CYAN}  ╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}  ║                                                                ║${NC}"
    echo -e "${CYAN}  ║              ${BOLD}Clawdbot macOS 一键安装器${NC}${CYAN}                        ║${NC}"
    echo -e "${CYAN}  ║                                                                ║${NC}"
    echo -e "${CYAN}  ╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    local step="$1"
    local total="$2"
    local message="$3"
    echo -e "  ${CYAN}[$step/$total]${NC} $message"
    log_info "[$step/$total] $message"
}

print_ok() {
    echo -e "        ${GREEN}[OK]${NC} $1"
    log_ok "$1"
}

print_warn() {
    echo -e "        ${YELLOW}[!]${NC} $1"
    log_warn "$1"
}

print_error() {
    echo -e "        ${RED}[错误]${NC} $1"
    log_error "$1"
}

print_debug() {
    if [ "${DEBUG:-0}" = "1" ]; then
        echo -e "        ${GRAY}[DEBUG]${NC} $1"
    fi
    log_debug "$1"
}

# ============================================================================
# 错误处理
# ============================================================================
exit_with_error() {
    local code="$1"
    local detail="${2:-}"
    local message="${ERROR_MESSAGES[$code]:-未知错误}"
    
    echo ""
    echo -e "  ${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "  ${RED}║                         错误                                   ║${NC}"
    echo -e "  ${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${YELLOW}错误代码:${NC} $code"
    echo -e "  ${YELLOW}错误描述:${NC} $message"
    if [ -n "$detail" ]; then
        echo -e "  ${GRAY}详细信息:${NC} $detail"
    fi
    echo ""
    echo -e "  ${CYAN}日志文件:${NC} $LOG_FILE"
    echo -e "  ${CYAN}请截图此信息并联系技术支持${NC}"
    echo ""
    
    log_error "退出: 代码=$code, 描述=$message, 详情=$detail"
    exit "$code"
}

# ============================================================================
# 系统检测
# ============================================================================
detect_architecture() {
    local arch=$(uname -m)
    case "$arch" in
        x86_64)
            ARCH="x64"
            ;;
        arm64|aarch64)
            ARCH="arm64"
            ;;
        *)
            exit_with_error $ERROR_ARCH_NOT_SUPPORTED "不支持的架构: $arch"
            ;;
    esac
    print_debug "检测到架构: $ARCH"
}

detect_macos_version() {
    if [ "$(uname -s)" != "Darwin" ]; then
        exit_with_error $ERROR_GENERAL "此脚本仅支持 macOS"
    fi
    
    MACOS_VERSION=$(sw_vers -productVersion)
    MACOS_MAJOR=$(echo "$MACOS_VERSION" | cut -d. -f1)
    
    if [ "$MACOS_MAJOR" -lt 12 ]; then
        print_warn "macOS 版本较低 ($MACOS_VERSION)，建议升级到 macOS 12+"
    fi
    
    print_debug "macOS 版本: $MACOS_VERSION"
}

check_disk_space() {
    # 检查 /Applications 所在磁盘空间
    local available_gb=$(df -g /Applications 2>/dev/null | awk 'NR==2 {print $4}')
    
    if [ -n "$available_gb" ] && [ "$available_gb" -lt 1 ]; then
        exit_with_error $ERROR_DISK_SPACE_LOW "磁盘空间不足，需要至少 1GB 可用空间"
    fi
    
    print_debug "可用磁盘空间: ${available_gb}GB"
}

check_existing_installation() {
    if [ -d "$INSTALL_DIR/$APP_NAME" ]; then
        print_warn "检测到已安装的 Clawdbot"
        echo ""
        echo -e "  ${YELLOW}是否覆盖安装？${NC}"
        echo -e "    ${GRAY}[Y] 覆盖安装  [N] 取消${NC}"
        echo ""
        read -p "  请输入 Y 或 N: " choice
        
        if [ "$choice" != "Y" ] && [ "$choice" != "y" ]; then
            echo ""
            echo -e "  ${CYAN}安装已取消${NC}"
            exit $ERROR_USER_CANCELLED
        fi
        
        # 停止现有服务
        stop_existing_gateway
    fi
}

# ============================================================================
# 端口检测（参考 Windows Test-PortInUse）
# ============================================================================
check_port() {
    local port_info=$(lsof -i :$PORT -P -n 2>/dev/null | grep LISTEN)
    
    if [ -n "$port_info" ]; then
        local pid=$(echo "$port_info" | awk '{print $2}' | head -1)
        local process_name=$(echo "$port_info" | awk '{print $1}' | head -1)
        local cmdline=$(ps -p "$pid" -o command= 2>/dev/null || echo "unknown")
        
        # 检查是否是 Clawdbot Gateway
        if echo "$cmdline" | grep -q "gateway"; then
            print_warn "Clawdbot Gateway 已在运行 (PID: $pid)"
            echo ""
            echo -e "  ${YELLOW}是否重启服务？${NC}"
            echo -e "    ${GRAY}[Y] 重启服务  [N] 保持现状并退出${NC}"
            echo ""
            read -p "  请输入 Y 或 N: " choice
            
            if [ "$choice" = "Y" ] || [ "$choice" = "y" ]; then
                print_warn "正在停止旧进程..."
                kill -9 "$pid" 2>/dev/null || true
                sleep 2
                print_ok "旧进程已停止"
            else
                echo ""
                echo -e "  ${CYAN}Gateway 已在运行，无需重新安装${NC}"
                echo -e "  ${CYAN}访问地址: http://localhost:$PORT/${NC}"
                exit $ERROR_SUCCESS
            fi
        else
            print_error "端口 $PORT 被其他程序占用: $process_name (PID: $pid)"
            echo ""
            echo -e "  ${YELLOW}是否结束该进程？${NC}"
            echo -e "    ${GRAY}[Y] 结束进程并继续  [N] 退出${NC}"
            echo ""
            read -p "  请输入 Y 或 N: " choice
            
            if [ "$choice" = "Y" ] || [ "$choice" = "y" ]; then
                print_warn "正在结束进程 $process_name..."
                kill -9 "$pid" 2>/dev/null || true
                sleep 2
                print_ok "进程已结束"
            else
                exit_with_error $ERROR_PORT_IN_USE "端口 $PORT 被 $process_name 占用"
            fi
        fi
    fi
    
    print_debug "端口 $PORT 可用"
}

stop_existing_gateway() {
    # 停止所有 Clawdbot 相关进程
    pkill -9 -f "Clawdbot" 2>/dev/null || true
    pkill -9 -f "clawdbot.*gateway" 2>/dev/null || true
    
    # 清理锁文件（参考 Windows）
    local lock_file="$CONFIG_DIR/gateway.lock"
    if [ -f "$lock_file" ]; then
        print_warn "发现锁文件，正在清理..."
        rm -f "$lock_file"
        log_info "已清理锁文件: $lock_file"
    fi
    
    sleep 2
}

# ============================================================================
# 下载安装
# ============================================================================
select_mirror() {
    if [ "$MIRROR" = "cn" ]; then
        DOWNLOAD_BASE="$DOWNLOAD_BASE_CN"
    else
        DOWNLOAD_BASE="$DOWNLOAD_BASE_DEFAULT"
    fi
    print_debug "使用下载源: $DOWNLOAD_BASE"
}

download_with_retry() {
    local url="$1"
    local output="$2"
    local max_retries=3
    local retry=0
    
    while [ $retry -lt $max_retries ]; do
        if curl -fSL --progress-bar "$url" -o "$output" 2>&1; then
            return 0
        fi
        
        retry=$((retry + 1))
        print_warn "下载失败，正在重试 ($retry/$max_retries)..."
        sleep 2
    done
    
    return 1
}

download_and_install() {
    local download_url="$DOWNLOAD_BASE/releases/$VERSION/Clawdbot-$ARCH.tar.gz"
    local temp_file="/tmp/clawdbot-$$.tar.gz"
    
    print_debug "下载地址: $download_url"
    
    echo ""
    echo -e "  ${YELLOW}正在下载安装包，请稍候...${NC}"
    echo ""
    
    if ! download_with_retry "$download_url" "$temp_file"; then
        # 尝试备用镜像
        if [ "$MIRROR" != "cn" ]; then
            print_warn "主下载源失败，尝试国内镜像..."
            DOWNLOAD_BASE="$DOWNLOAD_BASE_CN"
            download_url="$DOWNLOAD_BASE/releases/$VERSION/Clawdbot-$ARCH.tar.gz"
            
            if ! download_with_retry "$download_url" "$temp_file"; then
                exit_with_error $ERROR_DOWNLOAD_FAILED "下载失败，请检查网络连接"
            fi
        else
            exit_with_error $ERROR_DOWNLOAD_FAILED "下载失败，请检查网络连接"
        fi
    fi
    
    print_ok "下载完成"
    
    # 解压安装
    print_debug "解压到: $INSTALL_DIR"
    
    # 先删除旧版本
    if [ -d "$INSTALL_DIR/$APP_NAME" ]; then
        rm -rf "$INSTALL_DIR/$APP_NAME"
    fi
    
    # 解压
    if ! tar -xzf "$temp_file" -C "$INSTALL_DIR" 2>&1; then
        exit_with_error $ERROR_INSTALL_INCOMPLETE "解压失败"
    fi
    
    # 清理临时文件
    rm -f "$temp_file"
    
    print_ok "解压完成"
}

# ============================================================================
# Gatekeeper 处理（macOS 特有）
# ============================================================================
handle_gatekeeper() {
    print_debug "处理 Gatekeeper 限制..."
    
    # 移除隔离属性
    if ! xattr -cr "$INSTALL_DIR/$APP_NAME" 2>/dev/null; then
        print_warn "无法移除隔离属性，首次启动可能需要手动确认"
        echo ""
        echo -e "  ${YELLOW}提示: 如果首次打开被拦截:${NC}"
        echo -e "    ${GRAY}1. 右键点击 Clawdbot.app${NC}"
        echo -e "    ${GRAY}2. 选择「打开」${NC}"
        echo -e "    ${GRAY}3. 在弹出的对话框中点击「打开」${NC}"
        echo ""
    else
        print_ok "Gatekeeper 限制已移除"
    fi
}

# ============================================================================
# 配置文件（参考 Windows StartClawdbot.ps1）
# ============================================================================
generate_random_token() {
    # 生成 24 字节的随机 Token（与 Windows 一致）
    openssl rand -base64 24 | tr '+/' '-_' | tr -d '='
}

setup_config() {
    # 创建配置目录
    if [ ! -d "$CONFIG_DIR" ]; then
        mkdir -p "$CONFIG_DIR"
        print_debug "已创建配置目录: $CONFIG_DIR"
    fi
    
    # 创建日志目录
    mkdir -p "$LOG_DIR"
    
    # 创建或更新配置文件
    if [ ! -f "$CONFIG_FILE" ]; then
        local token=$(generate_random_token)
        cat > "$CONFIG_FILE" << EOF
{
  "gateway": {
    "mode": "local",
    "bind": "loopback",
    "port": $PORT,
    "auth": {
      "token": "$token"
    }
  }
}
EOF
        print_ok "已创建配置文件 (含自动生成的 Token)"
        log_info "Token: $token"
    else
        # 检查配置文件是否有 Token
        if ! grep -q '"token"' "$CONFIG_FILE" 2>/dev/null; then
            # 添加 Token（简单处理，实际应该用 jq）
            local token=$(generate_random_token)
            print_warn "配置文件缺少 Token，请手动添加"
            log_info "建议添加的 Token: $token"
        else
            print_ok "配置文件已存在"
        fi
    fi
}

# ============================================================================
# 启动服务
# ============================================================================
start_gateway() {
    print_debug "启动 Clawdbot..."
    
    # 打开应用（macOS 会自动处理 Gateway 启动）
    open "$INSTALL_DIR/$APP_NAME"
    
    print_ok "Clawdbot 启动命令已发送"
}

wait_for_gateway() {
    local waited=0
    local spinner=('|' '/' '-' '\')
    
    echo ""
    echo -e "  ${YELLOW}提示: 首次启动可能需要 30-60 秒，请耐心等待...${NC}"
    echo ""
    
    while [ $waited -lt $MAX_WAIT ]; do
        sleep 2
        waited=$((waited + 2))
        
        # HTTP 健康检查（不只是端口监听）
        if curl -s --connect-timeout 2 "http://localhost:$PORT/" > /dev/null 2>&1; then
            echo ""
            print_ok "服务已就绪 (耗时 ${waited} 秒)"
            return 0
        fi
        
        # 显示进度
        local spin_idx=$((waited / 2 % 4))
        printf "\r        等待中 ${spinner[$spin_idx]} (${waited}秒)    "
    done
    
    echo ""
    return 1
}

# ============================================================================
# 获取 Token 并打开浏览器
# ============================================================================
open_setup_page() {
    local token=""
    
    # 尝试从配置文件读取 Token
    if [ -f "$CONFIG_FILE" ]; then
        token=$(grep -o '"token"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" 2>/dev/null | sed 's/.*"\([^"]*\)"$/\1/')
    fi
    
    local url="http://localhost:$PORT/setup"
    if [ -n "$token" ]; then
        # URL 编码 Token
        local encoded_token=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$token'))" 2>/dev/null || echo "$token")
        url="http://localhost:$PORT/setup?token=$encoded_token"
    fi
    
    print_debug "打开浏览器: $url"
    open "$url"
    
    print_ok "浏览器已打开"
}

# ============================================================================
# 主流程
# ============================================================================
main() {
    local total_steps=8
    
    # 初始化
    init_logging
    print_banner
    
    echo -e "  ${YELLOW}请勿关闭此窗口，正在安装...${NC}"
    echo ""
    
    # Step 1: 检测系统
    print_step 1 $total_steps "检测系统环境..."
    detect_macos_version
    detect_architecture
    check_disk_space
    print_ok "系统环境检测通过"
    
    # Step 2: 检查现有安装
    print_step 2 $total_steps "检查现有安装..."
    check_existing_installation
    print_ok "检查完成"
    
    # Step 3: 检查端口
    print_step 3 $total_steps "检查端口 $PORT..."
    check_port
    print_ok "端口 $PORT 可用"
    
    # Step 4: 下载安装包
    print_step 4 $total_steps "下载安装包..."
    select_mirror
    download_and_install
    
    # Step 5: 处理 Gatekeeper
    print_step 5 $total_steps "配置系统权限..."
    handle_gatekeeper
    
    # Step 6: 配置文件
    print_step 6 $total_steps "设置配置文件..."
    setup_config
    
    # Step 7: 启动服务
    print_step 7 $total_steps "启动 Clawdbot..."
    start_gateway
    
    if ! wait_for_gateway; then
        echo ""
        echo -e "  ${YELLOW}╔════════════════════════════════════════════════════════════════╗${NC}"
        echo -e "  ${YELLOW}║                     服务启动超时                               ║${NC}"
        echo -e "  ${YELLOW}╚════════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo -e "  ${GRAY}可能的原因:${NC}"
        echo -e "    ${GRAY}1. 首次启动需要初始化，请耐心等待${NC}"
        echo -e "    ${GRAY}2. 端口 $PORT 被占用${NC}"
        echo -e "    ${GRAY}3. 系统权限问题${NC}"
        echo ""
        echo -e "  ${CYAN}请稍后手动打开 Clawdbot.app 重试${NC}"
        echo -e "  ${CYAN}日志文件: $LOG_FILE${NC}"
        echo ""
        exit $ERROR_GATEWAY_TIMEOUT
    fi
    
    # Step 8: 打开配置页面
    print_step 8 $total_steps "打开配置页面..."
    open_setup_page
    
    # 完成
    echo ""
    echo -e "  ${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "  ${GREEN}║                     安装完成！                                 ║${NC}"
    echo -e "  ${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  浏览器已打开配置页面，请在浏览器中完成设置。"
    echo ""
    echo -e "  ${CYAN}提示:${NC}"
    echo -e "    ${GRAY}- Clawdbot 正在后台运行（查看菜单栏图标）${NC}"
    echo -e "    ${GRAY}- 可以安全关闭此窗口${NC}"
    echo -e "    ${GRAY}- 如需重新打开控制台，点击菜单栏图标${NC}"
    echo ""
    echo -e "  ${GRAY}日志文件: $LOG_FILE${NC}"
    echo ""
    
    log_info "========== 安装完成 =========="
}

# ============================================================================
# 入口
# ============================================================================

# 处理命令行参数
while [ $# -gt 0 ]; do
    case "$1" in
        --mirror)
            MIRROR="$2"
            shift 2
            ;;
        --version)
            VERSION="$2"
            shift 2
            ;;
        --debug)
            DEBUG=1
            shift
            ;;
        --help|-h)
            echo "Clawdbot macOS 一键安装脚本"
            echo ""
            echo "用法: $0 [选项]"
            echo ""
            echo "选项:"
            echo "  --mirror cn    使用国内镜像"
            echo "  --version VER  指定版本号"
            echo "  --debug        显示调试信息"
            echo "  --help         显示此帮助"
            echo ""
            exit 0
            ;;
        *)
            echo "未知参数: $1"
            exit 1
            ;;
    esac
done

# 运行主程序
main
