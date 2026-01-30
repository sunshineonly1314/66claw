#!/bin/bash
# =============================================================================
# Clawdbot Linux 安装脚本示例
# 
# 此文件是 install.sh 的参考示例，实际安装脚本位于:
# https://github.com/clawdbot/clawd.bot/blob/main/public/install.sh
#
# 使用方法:
#   curl -fsSL https://clawd.bot/install.sh | bash
# =============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║         Clawdbot 安装程序                 ║"
echo "  ╚═══════════════════════════════════════════╝"
echo -e "${NC}"

# 检测系统
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "linux"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "macos"
    else
        echo "unknown"
    fi
}

OS=$(detect_os)
echo -e "${BLUE}检测到系统: ${OS}${NC}"

# 检查 Node.js
check_node() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -ge 22 ]; then
            echo -e "${GREEN}✓ Node.js $(node -v) 已安装${NC}"
            return 0
        fi
    fi
    echo -e "${YELLOW}⚠ 需要 Node.js 22+${NC}"
    return 1
}

# 安装 Clawdbot
install_clawdbot() {
    echo -e "${BLUE}正在安装 Clawdbot...${NC}"
    
    # 使用 npm 全局安装
    if command -v pnpm &> /dev/null; then
        pnpm install -g clawdbot@latest
    elif command -v npm &> /dev/null; then
        npm install -g clawdbot@latest
    else
        echo -e "${RED}✗ 未找到 npm 或 pnpm${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Clawdbot 安装完成${NC}"
}

# 初始化配置
init_config() {
    echo -e "${BLUE}正在初始化配置...${NC}"
    clawdbot setup
    echo -e "${GREEN}✓ 配置初始化完成${NC}"
}

# 主流程
main() {
    # 检查 Node.js
    if ! check_node; then
        echo -e "${RED}请先安装 Node.js 22+${NC}"
        echo "  推荐使用 nvm: https://github.com/nvm-sh/nvm"
        exit 1
    fi
    
    # 安装 Clawdbot
    install_clawdbot
    
    # 初始化配置
    init_config
    
    # 显示完成信息
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  ✓ 安装完成 / Installation complete${NC}"
    echo ""
    echo -e "  ${YELLOW}运行以下命令启动配置向导：${NC}"
    echo -e "  ${YELLOW}Run the following command to start setup:${NC}"
    echo ""
    echo -e "    ${BLUE}clawdbot setup --start${NC}"
    echo ""
    echo -e "  然后在浏览器中打开显示的 URL 完成配置"
    echo -e "  Then open the displayed URL in your browser"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

main "$@"
