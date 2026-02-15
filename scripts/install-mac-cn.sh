#!/bin/bash
# ============================================================================
# OpenClawCN macOS 一键安装脚本（国内镜像版）
# ============================================================================
# 用法: curl -fsSL https://download.openclawcn.com/install-mac.sh | bash
#
# 自动使用国内镜像，加速下载
# ============================================================================

# 设置国内镜像
export OPENCLAWCN_MIRROR="cn"

# 调用主安装脚本
SCRIPT_URL="https://raw.githubusercontent.com/openclawcn/openclawcn/main/scripts/install-mac.sh"
SCRIPT_URL_CN="https://gitee.com/openclawcn/openclawcn/raw/main/scripts/install-mac.sh"

# 尝试从国内源下载脚本
if curl -fsSL --connect-timeout 5 "$SCRIPT_URL_CN" 2>/dev/null | bash; then
    exit 0
fi

# 回退到 GitHub
curl -fsSL "$SCRIPT_URL" | bash
