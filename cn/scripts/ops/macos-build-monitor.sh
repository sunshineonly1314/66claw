#!/bin/bash
# ════════════════════════════════════════════════════════════════
# OpenClawCN macOS 远程打包监控脚本
# ════════════════════════════════════════════════════════════════
set -e

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# 日志函数
log_step() {
    echo -e "\n${CYAN}[$(date '+%H:%M:%S')]${NC} ${WHITE}$1${NC}"
}

log_ok() {
    echo -e "${GREEN}  ✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}  ⚠${NC} $1"
}

log_error() {
    echo -e "${RED}  ✗${NC} $1"
}

log_info() {
    echo -e "${BLUE}  →${NC} $1"
}

# 错误处理
error_exit() {
    log_error "$1"
    echo ""
    echo -e "${RED}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  构建失败！查看上方错误信息${NC}"
    echo -e "${RED}════════════════════════════════════════════════════════════════${NC}"
    exit 1
}

# 开始
echo -e "${WHITE}"
echo "════════════════════════════════════════════════════════════════"
echo "  OpenClawCN macOS 自动化打包脚本 v1.0"
echo "  开始时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "════════════════════════════════════════════════════════════════"
echo -e "${NC}"

# ════════════════════════════════════════════════════════════════
# 步骤 0: 环境检查
# ════════════════════════════════════════════════════════════════
log_step "[0/6] 环境检查"

# 检查系统
if [ "$(uname)" != "Darwin" ]; then
    error_exit "此脚本仅支持 macOS"
fi
log_ok "系统: macOS $(sw_vers -productVersion)"

# 检查必要工具
for tool in git node pnpm; do
    if ! command -v $tool &> /dev/null; then
        error_exit "缺少工具: $tool"
    fi
    VERSION=$($tool --version 2>&1 | head -1)
    log_ok "$tool: $VERSION"
done

# 检查磁盘空间
FREE_GB=$(df -g . | tail -1 | awk '{print $4}')
if [ "$FREE_GB" -lt 5 ]; then
    log_warn "磁盘空间不足: ${FREE_GB}GB (建议 5GB+)"
else
    log_ok "磁盘空间: ${FREE_GB}GB"
fi

# ════════════════════════════════════════════════════════════════
# 步骤 1: 定位项目目录
# ════════════════════════════════════════════════════════════════
log_step "[1/6] 定位项目目录"

# 尝试多个常见位置
POSSIBLE_PATHS=(
    "$HOME/openclawcn-cn"
    "$HOME/clawd-cn"
    "$HOME/Projects/openclawcn-cn"
    "$HOME/Desktop/openclawcn-cn"
    "$(pwd)"
)

PROJECT_DIR=""
for path in "${POSSIBLE_PATHS[@]}"; do
    if [ -d "$path/.git" ] && [ -f "$path/build/scripts/build-macos-cn.sh" ]; then
        PROJECT_DIR="$path"
        break
    fi
done

if [ -z "$PROJECT_DIR" ]; then
    log_warn "未找到项目目录，请手动输入:"
    read -p "项目路径: " PROJECT_DIR
    if [ ! -d "$PROJECT_DIR" ]; then
        error_exit "目录不存在: $PROJECT_DIR"
    fi
fi

cd "$PROJECT_DIR"
log_ok "项目目录: $PROJECT_DIR"

# ════════════════════════════════════════════════════════════════
# 步骤 2: 拉取最新代码
# ════════════════════════════════════════════════════════════════
log_step "[2/6] 拉取最新代码"

log_info "当前分支: $(git branch --show-current)"
log_info "当前提交: $(git rev-parse --short HEAD)"

# 检查是否有未提交的更改
if ! git diff-index --quiet HEAD --; then
    log_warn "检测到未提交的更改"
    git status --short
    read -p "是否继续？(y/n): " confirm
    if [ "$confirm" != "y" ]; then
        error_exit "用户取消操作"
    fi
fi

log_info "正在拉取..."
if git pull origin master; then
    LATEST_COMMIT=$(git rev-parse --short HEAD)
    log_ok "代码已更新到: $LATEST_COMMIT"

    # 显示最新提交信息
    log_info "最新提交:"
    git log -1 --oneline --decorate
else
    error_exit "拉取代码失败"
fi

# ════════════════════════════════════════════════════════════════
# 步骤 3: 验证模板修复
# ════════════════════════════════════════════════════════════════
log_step "[3/6] 验证模板修复"

BUILD_SCRIPT="build/scripts/build-macos-cn.sh"

if grep -q "docs-cn/reference" "$BUILD_SCRIPT"; then
    log_ok "✅ 中文模板修复已应用"

    # 显示具体的修复行
    log_info "修复详情:"
    grep -n "docs-cn/reference" "$BUILD_SCRIPT" | head -1

    # 验证中文模板文件存在
    TEMPLATE_DIR="docs-cn/reference/templates"
    if [ -d "$TEMPLATE_DIR" ]; then
        TEMPLATE_COUNT=$(find "$TEMPLATE_DIR" -name "*.md" | wc -l | tr -d ' ')
        log_ok "中文模板文件数量: $TEMPLATE_COUNT"
    else
        error_exit "中文模板目录不存在: $TEMPLATE_DIR"
    fi
else
    error_exit "⚠️ 模板修复未检测到！请检查代码是否正确拉取"
fi

# ════════════════════════════════════════════════════════════════
# 步骤 4: 执行打包
# ════════════════════════════════════════════════════════════════
log_step "[4/6] 开始打包"

log_info "这可能需要 5-15 分钟，请耐心等待..."
log_info "打包脚本: $BUILD_SCRIPT"

BUILD_START=$(date +%s)

# 执行打包并实时显示输出
if ./"$BUILD_SCRIPT" 2>&1 | tee /tmp/openclawcn-build.log; then
    BUILD_END=$(date +%s)
    BUILD_TIME=$((BUILD_END - BUILD_START))
    BUILD_MINUTES=$((BUILD_TIME / 60))
    BUILD_SECONDS=$((BUILD_TIME % 60))

    log_ok "打包完成！耗时: ${BUILD_MINUTES}分${BUILD_SECONDS}秒"
else
    log_error "打包失败！查看日志: /tmp/openclawcn-build.log"
    tail -50 /tmp/openclawcn-build.log
    error_exit "构建进程退出异常"
fi

# ════════════════════════════════════════════════════════════════
# 步骤 5: 查找并移动 DMG
# ════════════════════════════════════════════════════════════════
log_step "[5/6] 查找并移动 DMG 文件"

# 查找 DMG 文件
log_info "搜索 DMG 文件..."
DMG_FILES=$(find build/output -name "OpenClawCN-macOS-*.dmg" -type f 2>/dev/null)
DMG_COUNT=$(echo "$DMG_FILES" | grep -c "dmg" || echo "0")

if [ "$DMG_COUNT" -eq 0 ]; then
    error_exit "未找到 DMG 文件"
elif [ "$DMG_COUNT" -gt 1 ]; then
    log_warn "找到多个 DMG 文件:"
    echo "$DMG_FILES"
    DMG_FILE=$(echo "$DMG_FILES" | head -1)
    log_info "使用最新的: $DMG_FILE"
else
    DMG_FILE="$DMG_FILES"
    log_ok "找到 DMG: $(basename "$DMG_FILE")"
fi

# 获取文件信息
DMG_SIZE=$(du -h "$DMG_FILE" | cut -f1)
log_info "DMG 大小: $DMG_SIZE"

# 验证 DMG
log_info "验证 DMG 完整性..."
if hdiutil verify "$DMG_FILE" &>/dev/null; then
    log_ok "DMG 验证通过"
else
    log_warn "DMG 验证失败（可能仍可使用）"
fi

# 复制到桌面
DESKTOP="$HOME/Desktop"
DMG_NAME=$(basename "$DMG_FILE")
DEST="$DESKTOP/$DMG_NAME"

log_info "复制到桌面: $DEST"
if cp "$DMG_FILE" "$DEST"; then
    log_ok "✅ DMG 已复制到桌面"

    # 显示 SHA256
    if [ -f "${DMG_FILE}.sha256" ]; then
        SHA256=$(cat "${DMG_FILE}.sha256" | cut -d' ' -f1)
        log_info "SHA256: ${SHA256:0:16}..."
    fi
else
    error_exit "复制 DMG 到桌面失败"
fi

# ════════════════════════════════════════════════════════════════
# 步骤 6: 清理源代码（可选）
# ════════════════════════════════════════════════════════════════
log_step "[6/6] 清理源代码"

echo ""
echo -e "${YELLOW}════════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  即将删除源代码目录${NC}"
echo -e "${YELLOW}  路径: $PROJECT_DIR${NC}"
echo -e "${YELLOW}  大小: $(du -sh "$PROJECT_DIR" | cut -f1)${NC}"
echo -e "${YELLOW}════════════════════════════════════════════════════════════════${NC}"
echo ""

read -p "确认删除源代码？(输入 yes 继续): " CONFIRM

if [ "$CONFIRM" = "yes" ]; then
    log_info "正在删除源代码..."
    cd "$HOME"

    if rm -rf "$PROJECT_DIR"; then
        log_ok "✅ 源代码已删除"
    else
        log_error "删除失败（可能需要管理员权限）"
    fi
else
    log_warn "保留源代码目录: $PROJECT_DIR"
fi

# ════════════════════════════════════════════════════════════════
# 完成
# ════════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  🎉 全部完成！${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${WHITE}  DMG 文件位置:${NC} ${CYAN}$DEST${NC}"
echo -e "${WHITE}  文件大小:${NC} ${CYAN}$DMG_SIZE${NC}"
echo -e "${WHITE}  完成时间:${NC} ${CYAN}$(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo ""

# 打开桌面文件夹
read -p "是否打开桌面文件夹？(y/n): " OPEN_FINDER
if [ "$OPEN_FINDER" = "y" ]; then
    open "$DESKTOP"
fi

log_info "完整构建日志已保存到: /tmp/openclawcn-build.log"
