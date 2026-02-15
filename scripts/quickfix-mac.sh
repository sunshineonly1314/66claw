#!/bin/bash
# ============================================================================
# OpenClawCN macOS 快速修复工具
# ============================================================================
# 自动尝试修复最常见的问题，无需用户了解技术细节
#
# 用法: ./quickfix-mac.sh
#
# 参考 Windows QuickFix.ps1
# ============================================================================

set -e

# ============================================================================
# 配置
# ============================================================================
PORT=18789
APP_PATH="/Applications/OpenClawCN.app"
CONFIG_DIR="$HOME/.openclawcn"
LOG_DIR="$CONFIG_DIR/logs"
LOG_FILE="$LOG_DIR/quickfix.log"
MAX_WAIT=30

# ============================================================================
# 颜色定义
# ============================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m'

# ============================================================================
# 日志
# ============================================================================
init_log() {
    mkdir -p "$LOG_DIR"
    echo "========== 快速修复开始 $(date '+%Y-%m-%d %H:%M:%S') ==========" > "$LOG_FILE"
}

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# ============================================================================
# 输出函数
# ============================================================================
print_banner() {
    clear
    echo ""
    echo -e "${CYAN}  ╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}  ║                                                                ║${NC}"
    echo -e "${CYAN}  ║              OpenClawCN 快速修复工具                             ║${NC}"
    echo -e "${CYAN}  ║                                                                ║${NC}"
    echo -e "${CYAN}  ╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${YELLOW}此工具将自动尝试修复常见问题，请稍候...${NC}"
    echo ""
}

print_step() {
    local step="$1"
    local total="$2"
    local message="$3"
    echo -e "  ${CYAN}[$step/$total]${NC} $message"
    log "Step $step: $message"
}

print_ok() {
    echo -e "    ${GREEN}✓${NC} $1"
    log "[OK] $1"
}

print_warn() {
    echo -e "    ${YELLOW}⚠${NC} $1"
    log "[WARN] $1"
}

print_error() {
    echo -e "    ${RED}✗${NC} $1"
    log "[ERROR] $1"
}

# ============================================================================
# 修复结果跟踪
# ============================================================================
declare -a FIX_RESULTS
declare -a FIX_NAMES

add_result() {
    local name="$1"
    local success="$2"
    FIX_NAMES+=("$name")
    FIX_RESULTS+=("$success")
}

# ============================================================================
# Step 1: 停止所有 Gateway 进程
# ============================================================================
step_stop_gateway() {
    print_step 1 6 "停止现有 Gateway 进程..."
    
    local stopped=false
    
    # 停止 OpenClawCN App
    if pgrep -q "OpenClawCN"; then
        pkill -9 "OpenClawCN" 2>/dev/null || true
        stopped=true
    fi
    
    # 停止 Gateway 进程
    if pgrep -f "gateway" > /dev/null 2>&1; then
        pkill -9 -f "node.*gateway" 2>/dev/null || true
        stopped=true
    fi
    
    # 停止占用端口的进程
    local port_pid=$(lsof -ti :$PORT 2>/dev/null)
    if [ -n "$port_pid" ]; then
        kill -9 $port_pid 2>/dev/null || true
        stopped=true
    fi
    
    sleep 2
    
    if [ "$stopped" = true ]; then
        print_ok "Gateway 进程已停止"
    else
        print_ok "无运行中的 Gateway 进程"
    fi
    
    add_result "停止 Gateway" "true"
}

# ============================================================================
# Step 2: 清理锁文件和缓存
# ============================================================================
step_cleanup() {
    print_step 2 6 "清理锁文件和缓存..."
    
    local cleaned=false
    
    # 清理锁文件
    if [ -f "$CONFIG_DIR/gateway.lock" ]; then
        rm -f "$CONFIG_DIR/gateway.lock"
        print_ok "已清理 gateway.lock"
        cleaned=true
    fi
    
    # 清理旧的日志文件（保留最近的）
    if [ -d "$LOG_DIR" ]; then
        find "$LOG_DIR" -name "*.log" -mtime +7 -delete 2>/dev/null || true
    fi
    
    # 清理临时文件
    rm -f /tmp/openclawcn-* 2>/dev/null || true
    
    if [ "$cleaned" = true ]; then
        print_ok "清理完成"
    else
        print_ok "无需清理"
    fi
    
    add_result "清理缓存" "true"
}

# ============================================================================
# Step 3: 修复 Gatekeeper 问题
# ============================================================================
step_fix_gatekeeper() {
    print_step 3 6 "修复 Gatekeeper 限制..."
    
    if [ ! -d "$APP_PATH" ]; then
        print_warn "OpenClawCN.app 未安装"
        add_result "Gatekeeper" "false"
        return
    fi
    
    # 检查隔离属性
    local quarantine=$(xattr -l "$APP_PATH" 2>/dev/null | grep -c "com.apple.quarantine" || echo "0")
    
    if [ "$quarantine" -gt 0 ]; then
        if xattr -cr "$APP_PATH" 2>/dev/null; then
            print_ok "已移除 Gatekeeper 隔离属性"
        else
            print_warn "无法移除隔离属性（可能需要管理员权限）"
            add_result "Gatekeeper" "false"
            return
        fi
    else
        print_ok "Gatekeeper 限制已清除"
    fi
    
    add_result "Gatekeeper" "true"
}

# ============================================================================
# Step 4: 验证/修复配置文件
# ============================================================================
step_fix_config() {
    print_step 4 6 "检查配置文件..."
    
    # 创建配置目录
    if [ ! -d "$CONFIG_DIR" ]; then
        mkdir -p "$CONFIG_DIR"
        print_ok "已创建配置目录"
    fi
    
    # 创建日志目录
    mkdir -p "$LOG_DIR"
    
    # 检查/创建配置文件
    local config_file="$CONFIG_DIR/openclawcn.json"
    
    if [ ! -f "$config_file" ]; then
        # 生成随机 Token
        local token=$(openssl rand -base64 24 | tr '+/' '-_' | tr -d '=')
        
        cat > "$config_file" << EOF
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
        print_ok "已创建配置文件"
    else
        # 验证配置文件格式
        if python3 -c "import json; json.load(open('$config_file'))" 2>/dev/null; then
            print_ok "配置文件有效"
        else
            # 备份损坏的配置
            mv "$config_file" "$config_file.bak.$(date +%s)"
            
            # 创建新配置
            local token=$(openssl rand -base64 24 | tr '+/' '-_' | tr -d '=')
            cat > "$config_file" << EOF
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
            print_warn "配置文件已损坏，已创建新配置"
        fi
    fi
    
    add_result "配置文件" "true"
}

# ============================================================================
# Step 5: 启动 Gateway
# ============================================================================
step_start_gateway() {
    print_step 5 6 "启动 Gateway..."
    
    if [ ! -d "$APP_PATH" ]; then
        print_error "OpenClawCN.app 未安装"
        add_result "启动 Gateway" "false"
        return
    fi
    
    # 启动应用
    open "$APP_PATH"
    
    print_ok "Gateway 启动命令已发送"
    add_result "启动 Gateway" "true"
}

# ============================================================================
# Step 6: 验证服务状态
# ============================================================================
step_verify_service() {
    print_step 6 6 "验证服务状态..."
    
    local waited=0
    local service_ok=false
    
    while [ $waited -lt $MAX_WAIT ]; do
        sleep 2
        waited=$((waited + 2))
        
        # HTTP 健康检查
        if curl -s --connect-timeout 2 "http://localhost:$PORT/" > /dev/null 2>&1; then
            service_ok=true
            break
        fi
        
        echo -e "    等待服务启动... ($waited/$MAX_WAIT 秒)"
    done
    
    if [ "$service_ok" = true ]; then
        print_ok "服务已正常运行！"
        add_result "服务验证" "true"
    else
        print_error "服务启动超时"
        add_result "服务验证" "false"
    fi
}

# ============================================================================
# 结果汇总
# ============================================================================
print_summary() {
    echo ""
    echo -e "  ${CYAN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    local success_count=0
    local total_count=${#FIX_RESULTS[@]}
    
    for result in "${FIX_RESULTS[@]}"; do
        if [ "$result" = "true" ]; then
            success_count=$((success_count + 1))
        fi
    done
    
    # 检查服务是否真正运行
    local service_running=false
    if curl -s --connect-timeout 2 "http://localhost:$PORT/" > /dev/null 2>&1; then
        service_running=true
    fi
    
    if [ "$success_count" -eq "$total_count" ] && [ "$service_running" = true ]; then
        echo -e "  ${GREEN}✓ 修复完成！所有 $total_count 项检查通过${NC}"
        echo ""
        echo -e "  您现在可以正常使用 OpenClawCN 了"
        echo -e "  ${CYAN}访问地址: http://localhost:$PORT/${NC}"
        
        # 打开浏览器
        echo ""
        read -p "  是否打开浏览器？(Y/n) " choice
        if [ "$choice" != "n" ] && [ "$choice" != "N" ]; then
            open "http://localhost:$PORT/setup"
        fi
    elif [ "$service_running" = true ]; then
        echo -e "  ${GREEN}✓ 服务已恢复运行！${NC}"
        echo ""
        echo -e "  ${YELLOW}部分步骤可能有警告，但服务已正常${NC}"
        echo -e "  ${CYAN}访问地址: http://localhost:$PORT/${NC}"
    else
        echo -e "  ${YELLOW}⚠ 部分修复失败 ($success_count/$total_count 成功)${NC}"
        echo ""
        echo -e "  失败的步骤:"
        
        for i in "${!FIX_RESULTS[@]}"; do
            if [ "${FIX_RESULTS[$i]}" = "false" ]; then
                echo -e "    ${RED}- ${FIX_NAMES[$i]}${NC}"
            fi
        done
        
        echo ""
        echo -e "  ${YELLOW}建议:${NC}"
        echo -e "    ${GRAY}1. 运行「诊断信息收集器」获取详细信息${NC}"
        echo -e "    ${GRAY}2. 重启电脑后重试${NC}"
        echo -e "    ${GRAY}3. 联系技术支持${NC}"
    fi
    
    echo ""
    echo -e "  ${CYAN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    log "========== 快速修复完成 ($success_count/$total_count 成功) =========="
}

# ============================================================================
# 主流程
# ============================================================================
main() {
    init_log
    print_banner
    
    step_stop_gateway
    step_cleanup
    step_fix_gatekeeper
    step_fix_config
    step_start_gateway
    step_verify_service
    
    print_summary
    
    read -p "  按回车键退出... "
}

# 运行
main
