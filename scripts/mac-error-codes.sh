#!/bin/bash
# ============================================================================
# Clawdbot macOS 统一错误码定义
# ============================================================================
# 与 Windows ErrorCodes.ps1 保持一致
#
# 用法:
#   source mac-error-codes.sh
#   exit $ERROR_GATEWAY_TIMEOUT
# ============================================================================

# 成功
export ERROR_SUCCESS=0

# 一般错误 (1-9)
export ERROR_GENERAL=1
export ERROR_USER_CANCELLED=2
export ERROR_UNKNOWN=9

# WSL 相关错误 (10-19) - macOS 不适用，保留编号兼容性
# export ERROR_WSL_NOT_INSTALLED=10
# export ERROR_WSL_DISTRO_NOT_FOUND=11
# export ERROR_WSL_START_FAILED=12
# export ERROR_WSL_VERSION_TOO_OLD=13
# export ERROR_WSL_KERNEL_UPDATE_REQUIRED=14
# export ERROR_WSL_VIRTUALIZATION_DISABLED=15

# Gateway 相关错误 (20-29)
export ERROR_GATEWAY_START_FAILED=20
export ERROR_GATEWAY_TIMEOUT=21
export ERROR_GATEWAY_CRASHED=22
export ERROR_GATEWAY_CONFIG_ERROR=23

# 网络相关错误 (30-39)
export ERROR_PORT_IN_USE=30
export ERROR_PORT_FORWARD_FAILED=31
export ERROR_NETWORK_UNREACHABLE=32
export ERROR_DOWNLOAD_FAILED=33
export ERROR_MIRROR_UNAVAILABLE=34
export ERROR_HTTP_SERVICE_UNAVAILABLE=35

# 系统相关错误 (40-49)
export ERROR_DISK_SPACE_LOW=40
export ERROR_PERMISSION_DENIED=41
export ERROR_MACOS_VERSION_TOO_OLD=42
export ERROR_ARCH_NOT_SUPPORTED=43
export ERROR_GATEKEEPER_BLOCKED=44

# 安装相关错误 (50-59)
export ERROR_INSTALL_TIMEOUT=50
export ERROR_INSTALL_INCOMPLETE=51
export ERROR_DEPENDENCY_MISSING=52
export ERROR_CONFIG_CORRUPTED=53

# 运行时错误 (60-69)
export ERROR_RUNTIME=60
export ERROR_OUT_OF_MEMORY=61
export ERROR_FILE_NOT_FOUND=62

# ============================================================================
# 错误描述
# ============================================================================
declare -A ERROR_MESSAGES=(
    [0]="成功"
    [1]="一般错误"
    [2]="用户取消"
    [9]="未知错误"
    
    [20]="Gateway 启动失败"
    [21]="Gateway 启动超时"
    [22]="Gateway 异常退出"
    [23]="Gateway 配置错误"
    
    [30]="端口被占用"
    [31]="端口转发配置失败"
    [32]="网络不可达"
    [33]="下载失败"
    [34]="镜像不可用"
    [35]="HTTP 服务不响应"
    
    [40]="磁盘空间不足"
    [41]="权限不足"
    [42]="macOS 版本过低"
    [43]="系统架构不支持"
    [44]="被 Gatekeeper 拦截"
    
    [50]="安装超时"
    [51]="安装不完整"
    [52]="缺少依赖"
    [53]="配置文件损坏"
    
    [60]="运行时错误"
    [61]="内存不足"
    [62]="文件不存在"
)

# ============================================================================
# 获取错误描述
# ============================================================================
get_error_message() {
    local code=$1
    echo "${ERROR_MESSAGES[$code]:-未知错误 (代码: $code)}"
}

# ============================================================================
# 记录错误并退出
# ============================================================================
exit_with_error() {
    local code=$1
    local detail="${2:-}"
    local message=$(get_error_message $code)
    
    echo ""
    echo -e "\033[0;31m  ╔════════════════════════════════════════════════════════════════╗\033[0m"
    echo -e "\033[0;31m  ║                         错误                                   ║\033[0m"
    echo -e "\033[0;31m  ╚════════════════════════════════════════════════════════════════╝\033[0m"
    echo ""
    echo -e "  \033[0;33m错误代码:\033[0m $code"
    echo -e "  \033[0;33m错误描述:\033[0m $message"
    if [ -n "$detail" ]; then
        echo -e "  \033[0;90m详细信息:\033[0m $detail"
    fi
    echo ""
    echo -e "  \033[0;36m请截图此信息并联系技术支持\033[0m"
    echo ""
    
    exit $code
}
