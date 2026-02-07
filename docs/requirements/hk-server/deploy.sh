#!/bin/bash
# ========================================
# 香港服务器二进制同步 - 一键部署脚本
# ========================================

set -e

echo "========================================"
echo "  Clawdbot Skills 二进制同步部署"
echo "========================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置
INSTALL_DIR="/opt/binaries-sync"
DATA_DIR="/data/binaries"
LOG_DIR="/var/log/binaries-sync"

# 检查是否以 root 运行（部分操作需要）
check_root() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${YELLOW}提示: 部分操作可能需要 sudo 权限${NC}"
    fi
}

# 步骤 1: 检查 Python
check_python() {
    echo "=== 步骤 1: 检查 Python 环境 ==="
    if command -v python3 &> /dev/null; then
        echo -e "${GREEN}✓ Python3 已安装: $(python3 --version)${NC}"
    else
        echo -e "${RED}✗ Python3 未安装${NC}"
        echo "请先安装 Python3:"
        echo "  Ubuntu/Debian: sudo apt install python3 python3-pip"
        echo "  CentOS/RHEL:   sudo yum install python3 python3-pip"
        exit 1
    fi
    echo ""
}

# 步骤 2: 安装依赖
install_deps() {
    echo "=== 步骤 2: 安装 Python 依赖 ==="
    pip3 install --user requests 2>/dev/null || pip3 install requests
    echo -e "${GREEN}✓ requests 已安装${NC}"
    echo ""
}

# 步骤 3: 创建目录
create_dirs() {
    echo "=== 步骤 3: 创建目录 ==="
    
    # 安装目录
    if [ ! -d "$INSTALL_DIR" ]; then
        sudo mkdir -p "$INSTALL_DIR"
        sudo chown $USER:$USER "$INSTALL_DIR"
        echo -e "${GREEN}✓ 创建 $INSTALL_DIR${NC}"
    else
        echo -e "${GREEN}✓ $INSTALL_DIR 已存在${NC}"
    fi
    
    # 数据目录
    if [ ! -d "$DATA_DIR" ]; then
        sudo mkdir -p "$DATA_DIR"
        sudo chown $USER:$USER "$DATA_DIR"
        echo -e "${GREEN}✓ 创建 $DATA_DIR${NC}"
    else
        echo -e "${GREEN}✓ $DATA_DIR 已存在${NC}"
    fi
    
    # 日志目录
    if [ ! -d "$LOG_DIR" ]; then
        sudo mkdir -p "$LOG_DIR"
        sudo chown $USER:$USER "$LOG_DIR"
        echo -e "${GREEN}✓ 创建 $LOG_DIR${NC}"
    else
        echo -e "${GREEN}✓ $LOG_DIR 已存在${NC}"
    fi
    echo ""
}

# 步骤 4: 复制文件
copy_files() {
    echo "=== 步骤 4: 复制脚本文件 ==="
    
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    
    if [ -f "$SCRIPT_DIR/sync_binaries.py" ]; then
        cp "$SCRIPT_DIR/sync_binaries.py" "$INSTALL_DIR/"
        chmod +x "$INSTALL_DIR/sync_binaries.py"
        echo -e "${GREEN}✓ 复制 sync_binaries.py${NC}"
    else
        echo -e "${RED}✗ 找不到 sync_binaries.py${NC}"
        exit 1
    fi
    
    if [ -f "$SCRIPT_DIR/tools_config.json" ]; then
        cp "$SCRIPT_DIR/tools_config.json" "$INSTALL_DIR/"
        echo -e "${GREEN}✓ 复制 tools_config.json${NC}"
    else
        echo -e "${RED}✗ 找不到 tools_config.json${NC}"
        exit 1
    fi
    
    if [ -f "$SCRIPT_DIR/README.md" ]; then
        cp "$SCRIPT_DIR/README.md" "$INSTALL_DIR/"
        echo -e "${GREEN}✓ 复制 README.md${NC}"
    fi
    echo ""
}

# 步骤 5: 测试 GitHub 连接
test_github() {
    echo "=== 步骤 5: 测试 GitHub 连接 ==="
    
    # 测试 API
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://api.github.com)
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓ GitHub API 可访问${NC}"
    else
        echo -e "${RED}✗ GitHub API 不可访问 (HTTP $HTTP_CODE)${NC}"
        exit 1
    fi
    
    # 测试下载速度（简单测试）
    echo "测试 GitHub Release 下载..."
    SPEED=$(curl -L -o /dev/null -w "%{speed_download}" \
        "https://github.com/BurntSushi/ripgrep/releases/download/14.1.0/ripgrep-14.1.0-x86_64-unknown-linux-musl.tar.gz" \
        2>/dev/null | awk '{printf "%.0f", $1/1024}')
    echo -e "${GREEN}✓ 下载速度: ${SPEED} KB/s${NC}"
    echo ""
}

# 步骤 6: 测试同步脚本
test_sync() {
    echo "=== 步骤 6: 测试同步脚本 ==="
    
    cd "$INSTALL_DIR"
    
    # 只检查版本
    echo "运行版本检查..."
    python3 sync_binaries.py --check 2>&1 | head -20
    
    echo ""
    echo -e "${YELLOW}提示: 要运行完整同步，请执行:${NC}"
    echo "  cd $INSTALL_DIR && python3 sync_binaries.py"
    echo ""
}

# 步骤 7: 配置 Cron
setup_cron() {
    echo "=== 步骤 7: 配置定时任务 ==="
    
    CRON_CMD="0 * * * * cd $INSTALL_DIR && python3 sync_binaries.py >> $LOG_DIR/cron.log 2>&1"
    
    # 检查是否已存在
    if crontab -l 2>/dev/null | grep -q "sync_binaries.py"; then
        echo -e "${YELLOW}⚠ Cron 任务已存在，跳过${NC}"
    else
        (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
        echo -e "${GREEN}✓ 已添加每小时同步任务${NC}"
    fi
    
    echo ""
    echo "当前 cron 配置:"
    crontab -l 2>/dev/null | grep sync_binaries || echo "(无)"
    echo ""
}

# 汇总
summary() {
    echo "========================================"
    echo -e "${GREEN}  部署完成！${NC}"
    echo "========================================"
    echo ""
    echo "安装目录: $INSTALL_DIR"
    echo "数据目录: $DATA_DIR"
    echo "日志目录: $LOG_DIR"
    echo ""
    echo "常用命令:"
    echo "  # 查看同步日志"
    echo "  tail -f $LOG_DIR/sync.log"
    echo ""
    echo "  # 手动执行同步"
    echo "  cd $INSTALL_DIR && python3 sync_binaries.py"
    echo ""
    echo "  # 同步单个工具"
    echo "  cd $INSTALL_DIR && python3 sync_binaries.py ordercli"
    echo ""
    echo "  # 强制重新同步"
    echo "  cd $INSTALL_DIR && python3 sync_binaries.py --force"
    echo ""
}

# 主流程
main() {
    check_root
    check_python
    install_deps
    create_dirs
    copy_files
    test_github
    test_sync
    setup_cron
    summary
}

main "$@"
