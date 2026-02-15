#!/bin/bash
# ============================================================================
# OpenClawCN macOS 诊断信息收集器
# ============================================================================
# 一键收集所有诊断信息，方便用户反馈问题
#
# 用法: ./diagnose-mac.sh
# 输出: 桌面上的 openclawcn-diagnostics-{日期}.txt
#
# 参考 Windows CollectDiagnostics.ps1
# ============================================================================

set -e

# ============================================================================
# 配置
# ============================================================================
TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
OUTPUT_FILE="$HOME/Desktop/openclawcn-diagnostics-$TIMESTAMP.txt"
CONFIG_DIR="$HOME/.openclawcn"
APP_PATH="/Applications/OpenClawCN.app"
PORT=18789

# ============================================================================
# 颜色定义
# ============================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================================================
# 输出函数
# ============================================================================
print_banner() {
    echo ""
    echo -e "${CYAN}  ╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}  ║                                                                ║${NC}"
    echo -e "${CYAN}  ║              OpenClawCN 诊断信息收集器                           ║${NC}"
    echo -e "${CYAN}  ║                                                                ║${NC}"
    echo -e "${CYAN}  ╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${YELLOW}正在收集诊断信息，请稍候...${NC}"
    echo ""
}

write_section() {
    echo "" >> "$OUTPUT_FILE"
    echo "=== $1 ===" >> "$OUTPUT_FILE"
}

write_line() {
    echo "$1" >> "$OUTPUT_FILE"
}

# ============================================================================
# 初始化
# ============================================================================
init_output() {
    echo "OpenClawCN macOS 诊断报告" > "$OUTPUT_FILE"
    echo "生成时间: $(date '+%Y-%m-%d %H:%M:%S')" >> "$OUTPUT_FILE"
    echo "======================================================================" >> "$OUTPUT_FILE"
}

# ============================================================================
# 1. 系统信息
# ============================================================================
collect_system_info() {
    echo -e "  [1/8] 收集系统信息..."
    
    write_section "系统信息"
    write_line "操作系统: $(sw_vers -productName) $(sw_vers -productVersion)"
    write_line "构建号: $(sw_vers -buildVersion)"
    write_line "架构: $(uname -m)"
    write_line "处理器: $(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo 'Unknown')"
    write_line "内核: $(uname -r)"
    write_line "计算机名: $(scutil --get ComputerName 2>/dev/null || hostname)"
    write_line "用户名: $USER"
    write_line "HOME: $HOME"
    
    # 内存
    local mem_total=$(sysctl -n hw.memsize 2>/dev/null)
    if [ -n "$mem_total" ]; then
        local mem_gb=$((mem_total / 1024 / 1024 / 1024))
        write_line "内存: ${mem_gb} GB"
    fi
    
    # Rosetta 状态（Apple Silicon）
    if [ "$(uname -m)" = "arm64" ]; then
        if pgrep -q oahd 2>/dev/null; then
            write_line "Rosetta 2: 已安装"
        else
            write_line "Rosetta 2: 未安装"
        fi
    fi
}

# ============================================================================
# 2. 磁盘空间
# ============================================================================
collect_disk_info() {
    echo -e "  [2/8] 检查磁盘空间..."
    
    write_section "磁盘空间"
    df -h / /Applications 2>/dev/null | while read line; do
        write_line "$line"
    done
    
    # 检查配置目录大小
    if [ -d "$CONFIG_DIR" ]; then
        local config_size=$(du -sh "$CONFIG_DIR" 2>/dev/null | cut -f1)
        write_line "配置目录 ($CONFIG_DIR): $config_size"
    fi
}

# ============================================================================
# 3. OpenClawCN 安装状态
# ============================================================================
collect_installation_info() {
    echo -e "  [3/8] 检查安装状态..."
    
    write_section "OpenClawCN 安装状态"
    
    # 检查 App
    if [ -d "$APP_PATH" ]; then
        write_line "OpenClawCN.app: 已安装"
        write_line "App 路径: $APP_PATH"
        
        # 版本信息
        local info_plist="$APP_PATH/Contents/Info.plist"
        if [ -f "$info_plist" ]; then
            local version=$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$info_plist" 2>/dev/null || echo "Unknown")
            local build=$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$info_plist" 2>/dev/null || echo "Unknown")
            write_line "版本: $version (Build $build)"
        fi
        
        # 签名状态
        local codesign_result=$(codesign -dv "$APP_PATH" 2>&1)
        if echo "$codesign_result" | grep -q "Authority"; then
            write_line "代码签名: 已签名"
            echo "$codesign_result" | grep "Authority" | head -3 >> "$OUTPUT_FILE"
        else
            write_line "代码签名: 未签名或 Ad-hoc"
        fi
        
        # 隔离属性
        local quarantine=$(xattr -l "$APP_PATH" 2>/dev/null | grep -c "com.apple.quarantine" || echo "0")
        if [ "$quarantine" -gt 0 ]; then
            write_line "Gatekeeper 隔离: 存在（可能导致首次启动被拦截）"
        else
            write_line "Gatekeeper 隔离: 已清除"
        fi
    else
        write_line "OpenClawCN.app: 未安装"
    fi
    
    # 检查配置文件
    write_line ""
    write_line "--- 配置文件 ---"
    if [ -f "$CONFIG_DIR/openclawcn.json" ]; then
        write_line "配置文件: 存在"
        # 不输出敏感信息（Token）
        write_line "配置内容（已脱敏）:"
        cat "$CONFIG_DIR/openclawcn.json" 2>/dev/null | sed 's/"token"[[:space:]]*:[[:space:]]*"[^"]*"/"token": "***REDACTED***"/g' >> "$OUTPUT_FILE"
    else
        write_line "配置文件: 不存在"
    fi
    
    # 检查内置 CLI
    local cli_path="$APP_PATH/Contents/Resources/openclawcn-cli"
    if [ -d "$cli_path" ]; then
        write_line ""
        write_line "内置 CLI: 存在"
        if [ -f "$cli_path/dist/entry.js" ]; then
            write_line "  entry.js: 存在"
        else
            write_line "  entry.js: 不存在 ⚠️"
        fi
        if [ -d "$cli_path/node_modules" ]; then
            local modules_count=$(ls -1 "$cli_path/node_modules" 2>/dev/null | wc -l | tr -d ' ')
            write_line "  node_modules: $modules_count 个包"
        else
            write_line "  node_modules: 不存在 ⚠️"
        fi
    else
        write_line ""
        write_line "内置 CLI: 不存在"
    fi
    
    # 检查内置 Node.js
    local node_path="$APP_PATH/Contents/Resources/node/bin/node"
    if [ -f "$node_path" ]; then
        local node_version=$("$node_path" --version 2>/dev/null || echo "Unknown")
        write_line "内置 Node.js: $node_version"
    else
        write_line "内置 Node.js: 不存在"
    fi
}

# ============================================================================
# 4. 进程状态
# ============================================================================
collect_process_info() {
    echo -e "  [4/8] 检查进程状态..."
    
    write_section "进程状态"
    
    # OpenClawCN 进程
    write_line "--- OpenClawCN 进程 ---"
    local openclawcn_procs=$(pgrep -l -f "OpenClawCN|openclawcn" 2>/dev/null || echo "无")
    write_line "$openclawcn_procs"
    
    # Node.js 进程
    write_line ""
    write_line "--- Node.js 进程 ---"
    local node_procs=$(pgrep -l node 2>/dev/null || echo "无")
    write_line "$node_procs"
    
    # Gateway 相关
    write_line ""
    write_line "--- Gateway 相关进程 ---"
    ps aux 2>/dev/null | grep -E "gateway|entry.js" | grep -v grep >> "$OUTPUT_FILE" || write_line "无"
}

# ============================================================================
# 5. 网络端口
# ============================================================================
collect_network_info() {
    echo -e "  [5/8] 检查网络端口..."
    
    write_section "网络端口 $PORT"
    
    # 检查端口监听
    local port_info=$(lsof -i :$PORT -P -n 2>/dev/null | head -10)
    if [ -n "$port_info" ]; then
        write_line "端口 $PORT 状态:"
        echo "$port_info" >> "$OUTPUT_FILE"
    else
        write_line "端口 $PORT: 未监听"
    fi
    
    # 检查防火墙状态
    write_line ""
    write_line "--- 防火墙状态 ---"
    local fw_status=$(/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null || echo "Unknown")
    write_line "防火墙: $fw_status"
}

# ============================================================================
# 6. HTTP 服务测试
# ============================================================================
collect_http_test() {
    echo -e "  [6/8] 测试 HTTP 服务..."
    
    write_section "HTTP 服务测试"
    
    local test_urls=("http://localhost:$PORT/" "http://127.0.0.1:$PORT/")
    
    for url in "${test_urls[@]}"; do
        local result=$(curl -s --connect-timeout 5 -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "Failed")
        if [ "$result" = "200" ]; then
            write_line "$url : 成功 (状态码: $result)"
        else
            write_line "$url : 失败 ($result)"
        fi
    done
}

# ============================================================================
# 7. 日志文件
# ============================================================================
collect_logs() {
    echo -e "  [7/8] 收集日志文件..."
    
    write_section "日志文件"
    
    # OpenClawCN 日志
    local log_files=(
        "$CONFIG_DIR/logs/install.log:安装日志"
        "$CONFIG_DIR/logs/gateway.log:Gateway 日志"
        "$CONFIG_DIR/logs/startup.log:启动日志"
    )
    
    for log_entry in "${log_files[@]}"; do
        local log_path="${log_entry%%:*}"
        local log_name="${log_entry##*:}"
        
        if [ -f "$log_path" ]; then
            local size=$(ls -lh "$log_path" 2>/dev/null | awk '{print $5}')
            write_line ""
            write_line "--- $log_name ($log_path, $size) ---"
            write_line "最后 50 行:"
            tail -50 "$log_path" 2>/dev/null >> "$OUTPUT_FILE" || write_line "无法读取"
        else
            write_line ""
            write_line "--- $log_name: 文件不存在 ---"
        fi
    done
    
    # 系统日志（OpenClawCN 相关）
    write_line ""
    write_line "--- 系统日志 (最近 1 小时) ---"
    log show --predicate 'subsystem CONTAINS "openclawcn" OR process CONTAINS "OpenClawCN"' --last 1h 2>/dev/null | tail -100 >> "$OUTPUT_FILE" || write_line "无法获取系统日志"
}

# ============================================================================
# 8. 权限和安全
# ============================================================================
collect_security_info() {
    echo -e "  [8/8] 检查权限和安全..."
    
    write_section "权限和安全"
    
    # TCC 权限状态（需要数据库访问权限）
    write_line "--- TCC 权限 (可能需要手动检查) ---"
    write_line "请在 系统偏好设置 → 安全性与隐私 → 隐私 中检查以下权限:"
    write_line "  - 辅助功能 (Accessibility)"
    write_line "  - 屏幕录制 (Screen Recording)"
    write_line "  - 完全磁盘访问 (Full Disk Access)"
    
    # Gatekeeper 设置
    write_line ""
    write_line "--- Gatekeeper 设置 ---"
    local gk_status=$(spctl --status 2>/dev/null || echo "Unknown")
    write_line "Gatekeeper: $gk_status"
    
    # SIP 状态
    write_line ""
    write_line "--- SIP 状态 ---"
    local sip_status=$(csrutil status 2>/dev/null || echo "Unknown")
    write_line "$sip_status"
    
    # 安全软件检测
    write_line ""
    write_line "--- 安全软件检测 ---"
    local security_apps=(
        "360:360安全卫士"
        "Tencent Lemon:腾讯柠檬"
        "CleanMyMac:CleanMyMac"
        "Little Snitch:Little Snitch"
        "Malwarebytes:Malwarebytes"
    )
    
    for app_entry in "${security_apps[@]}"; do
        local app_name="${app_entry%%:*}"
        local app_display="${app_entry##*:}"
        
        if ls /Applications 2>/dev/null | grep -qi "$app_name"; then
            write_line "  - $app_display: 已安装"
        fi
    done
}

# ============================================================================
# 主流程
# ============================================================================
main() {
    print_banner
    
    init_output
    
    collect_system_info
    collect_disk_info
    collect_installation_info
    collect_process_info
    collect_network_info
    collect_http_test
    collect_logs
    collect_security_info
    
    # 完成
    echo "" >> "$OUTPUT_FILE"
    echo "======================================================================" >> "$OUTPUT_FILE"
    echo "诊断报告生成完成" >> "$OUTPUT_FILE"
    echo "如需技术支持，请将此文件发送给支持人员" >> "$OUTPUT_FILE"
    
    echo ""
    echo -e "  ${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${GREEN}✓ 诊断信息收集完成！${NC}"
    echo ""
    echo -e "  文件已保存到:"
    echo -e "    ${CYAN}$OUTPUT_FILE${NC}"
    echo ""
    echo -e "  ${YELLOW}请将此文件发送给技术支持人员${NC}"
    echo ""
    echo -e "  ${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    # 打开文件所在目录
    read -p "  是否打开文件所在目录？(Y/n) " choice
    if [ "$choice" != "n" ] && [ "$choice" != "N" ]; then
        open -R "$OUTPUT_FILE"
    fi
}

# 运行
main
