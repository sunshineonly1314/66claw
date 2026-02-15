#!/usr/bin/env bash
# ================================================================
# OpenClawCN 一键在线安装脚本
#
# 小白用户只需运行一行命令:
#   curl -fsSL https://get.tecbinai.com/linux | bash
#
# 或使用中国镜像:
#   curl -fsSL https://get.tecbinai.com/linux | bash -s -- --mirror china
#
# 功能:
#   1. 自动检测系统架构 (x64/arm64)
#   2. 下载最新版 OpenClawCN 独立包
#   3. 解压到 ~/openclawcn
#   4. 自动启动配置向导
# ================================================================

set -euo pipefail

# ─── 颜色 ─────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ─── 配置 ─────────────────────────────────────────────────────
INSTALL_DIR="${OPENCLAWCN_INSTALL_DIR:-$HOME/openclawcn}"
MIRROR=""
VERSION="latest"
SKIP_START=false
DOWNLOAD_BASE="https://github.com/openclawcn/openclawcn/releases/latest/download"
CHINA_DOWNLOAD_BASE="https://gitee.com/tecbinai/openclawcn-releases/releases/latest/download"

# ─── 解析参数 ─────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --mirror)
      MIRROR="$2"
      if [[ "$MIRROR" == "china" ]]; then
        DOWNLOAD_BASE="$CHINA_DOWNLOAD_BASE"
      fi
      shift 2
      ;;
    --dir)       INSTALL_DIR="$2"; shift 2 ;;
    --version)   VERSION="$2";     shift 2 ;;
    --skip-start) SKIP_START=true; shift ;;
    -h|--help)
      echo "OpenClawCN Linux 一键安装脚本"
      echo ""
      echo "用法: curl -fsSL https://get.tecbinai.com/linux | bash"
      echo ""
      echo "选项:"
      echo "  --mirror china   使用中国镜像 (推荐国内用户)"
      echo "  --dir PATH       安装目录 (默认: ~/openclawcn)"
      echo "  --skip-start     安装后不启动"
      echo ""
      exit 0
      ;;
    *) shift ;;
  esac
done

# ─── 辅助函数 ─────────────────────────────────────────────────
log_info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[OK]${NC} $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ─── Banner ───────────────────────────────────────────────────
clear 2>/dev/null || true
echo ""
echo -e "${BOLD}"
echo "   ╔══════════════════════════════════════════╗"
echo "   ║                                          ║"
echo "   ║          OpenClawCN 一键安装程序            ║"
echo "   ║          个人 AI 助手网关                 ║"
echo "   ║                                          ║"
echo "   ╚══════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# ─── 系统检测 ─────────────────────────────────────────────────
log_info "检测系统环境..."

# 操作系统
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
if [[ "$OS" != "linux" ]]; then
  log_error "此脚本仅支持 Linux"
  log_error "当前系统: $OS"
  exit 1
fi
log_success "操作系统: Linux"

# 架构
ARCH=$(uname -m)
case "$ARCH" in
  x86_64|amd64)  ARCH="x64" ;;
  aarch64|arm64)  ARCH="arm64" ;;
  *)
    log_error "不支持的架构: $ARCH"
    log_error "OpenClawCN 支持 x64 和 arm64"
    exit 1
    ;;
esac
log_success "系统架构: $ARCH"

# 发行版信息
DISTRO="unknown"
if [[ -f /etc/os-release ]]; then
  DISTRO=$(. /etc/os-release && echo "$PRETTY_NAME")
fi
log_success "发行版: $DISTRO"

# 检查下载工具
DOWNLOADER=""
if command -v curl &>/dev/null; then
  DOWNLOADER="curl"
elif command -v wget &>/dev/null; then
  DOWNLOADER="wget"
else
  log_error "需要 curl 或 wget"
  log_error "安装: sudo apt install curl  或  sudo yum install curl"
  exit 1
fi
log_success "下载工具: $DOWNLOADER"

# 磁盘空间检查
AVAILABLE_MB=$(df -m "$HOME" | tail -1 | awk '{print $4}')
if [[ "$AVAILABLE_MB" -lt 500 ]]; then
  log_warn "磁盘空间不足: ${AVAILABLE_MB}MB (建议 500MB+)"
fi

echo ""

# ─── 安装确认 ─────────────────────────────────────────────────
echo -e "  安装目录: ${BOLD}$INSTALL_DIR${NC}"
echo -e "  下载源:   ${BOLD}${MIRROR:-默认}${NC}"
echo ""

# 检查是否已安装
if [[ -d "$INSTALL_DIR" ]] && [[ -f "$INSTALL_DIR/dist/entry.js" ]]; then
  log_warn "检测到已有安装: $INSTALL_DIR"
  echo ""
  echo -e "  ${YELLOW}是否覆盖安装? (y/N)${NC}"
  read -r -t 30 answer || answer="n"
  if [[ "$answer" != "y" && "$answer" != "Y" ]]; then
    echo "已取消"
    exit 0
  fi
  echo ""
fi

# ─── 下载 ─────────────────────────────────────────────────────
TARBALL_NAME="openclawcn-linux-${ARCH}-standalone.tar.gz"
DOWNLOAD_URL="${DOWNLOAD_BASE}/${TARBALL_NAME}"
TEMP_FILE=$(mktemp "/tmp/openclawcn-XXXXXXXX.tar.gz")

log_info "下载 OpenClawCN..."
echo "  URL: $DOWNLOAD_URL"
echo ""

download_file() {
  local url="$1"
  local output="$2"

  if [[ "$DOWNLOADER" == "curl" ]]; then
    curl -fSL --progress-bar "$url" -o "$output"
  else
    wget --progress=bar:force "$url" -O "$output"
  fi
}

if ! download_file "$DOWNLOAD_URL" "$TEMP_FILE"; then
  log_error "下载失败!"
  log_error "请检查网络连接，或尝试使用中国镜像:"
  log_error "  curl -fsSL https://get.tecbinai.com/linux | bash -s -- --mirror china"
  rm -f "$TEMP_FILE"
  exit 1
fi

DOWNLOAD_SIZE=$(du -sm "$TEMP_FILE" | cut -f1)
log_success "下载完成 (${DOWNLOAD_SIZE}MB)"

# 校验文件完整性 (如果有校验和文件)
CHECKSUM_URL="${DOWNLOAD_BASE}/${TARBALL_NAME}.sha256"
TEMP_CHECKSUM=$(mktemp "/tmp/openclawcn-checksum-XXXXXXXX")
if download_file "$CHECKSUM_URL" "$TEMP_CHECKSUM" 2>/dev/null; then
  log_info "验证文件完整性..."
  EXPECTED_HASH=$(cat "$TEMP_CHECKSUM" | awk '{print $1}')
  ACTUAL_HASH=$(sha256sum "$TEMP_FILE" | awk '{print $1}')
  if [[ "$EXPECTED_HASH" == "$ACTUAL_HASH" ]]; then
    log_success "SHA256 校验通过"
  else
    log_error "文件校验失败！可能下载损坏"
    log_error "期望: $EXPECTED_HASH"
    log_error "实际: $ACTUAL_HASH"
    rm -f "$TEMP_FILE" "$TEMP_CHECKSUM"
    exit 1
  fi
else
  log_warn "未找到校验和文件，跳过完整性验证"
fi
rm -f "$TEMP_CHECKSUM"

echo ""

# ─── 解压安装 ─────────────────────────────────────────────────
log_info "安装到: $INSTALL_DIR"

# 备份旧配置
if [[ -d "$INSTALL_DIR" ]]; then
  log_info "备份旧安装..."
  BACKUP_DIR="${INSTALL_DIR}.backup.$(date +%Y%m%d%H%M%S)"
  mv "$INSTALL_DIR" "$BACKUP_DIR"
  log_success "已备份到: $BACKUP_DIR"
fi

# 解压
mkdir -p "$(dirname "$INSTALL_DIR")"
tar -xzf "$TEMP_FILE" -C "$(dirname "$INSTALL_DIR")"

# tar 解压出来的目录可能是 openclawcn，确保路径正确
EXTRACTED_DIR="$(dirname "$INSTALL_DIR")/openclawcn"
if [[ "$EXTRACTED_DIR" != "$INSTALL_DIR" ]] && [[ -d "$EXTRACTED_DIR" ]]; then
  mv "$EXTRACTED_DIR" "$INSTALL_DIR"
fi

# 清理临时文件
rm -f "$TEMP_FILE"

log_success "安装完成!"
echo ""

# ─── 环境配置 ─────────────────────────────────────────────────
log_info "配置环境..."

# 添加到 PATH
SHELL_RC=""
if [[ -f "$HOME/.bashrc" ]]; then
  SHELL_RC="$HOME/.bashrc"
elif [[ -f "$HOME/.zshrc" ]]; then
  SHELL_RC="$HOME/.zshrc"
elif [[ -f "$HOME/.profile" ]]; then
  SHELL_RC="$HOME/.profile"
fi

PATH_LINE="export PATH=\"$INSTALL_DIR:\$PATH\""

if [[ -n "$SHELL_RC" ]]; then
  if ! grep -q "openclawcn" "$SHELL_RC" 2>/dev/null; then
    echo "" >> "$SHELL_RC"
    echo "# OpenClawCN" >> "$SHELL_RC"
    echo "$PATH_LINE" >> "$SHELL_RC"
    log_success "已添加到 PATH ($SHELL_RC)"
  fi
fi

# 确保当前 session 也能用
export PATH="$INSTALL_DIR:$PATH"

echo ""

# ─── 完成 ─────────────────────────────────────────────────────
echo -e "${BOLD}"
echo "   ╔══════════════════════════════════════════╗"
echo "   ║                                          ║"
echo "   ║        ✓ OpenClawCN 安装成功!              ║"
echo "   ║                                          ║"
echo "   ╚══════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo "  安装目录: $INSTALL_DIR"
echo ""
echo -e "  ${BOLD}常用命令:${NC}"
echo "    cd $INSTALL_DIR"
echo "    ./setup.sh           # 首次配置 (启动 + 打开浏览器)"
echo "    ./start.sh           # 前台启动"
echo "    ./start-daemon.sh    # 后台启动"
echo "    ./stop.sh            # 停止"
echo "    ./status.sh          # 查看状态"
echo "    ./install-service.sh # 安装为系统服务 (开机自启)"
echo ""
echo -e "  ${BOLD}配置向导:${NC} http://localhost:18789/setup"
echo -e "  ${BOLD}控制台:${NC}   http://localhost:18789"
echo ""

# ─── 自动启动 ─────────────────────────────────────────────────
if [[ "$SKIP_START" == false ]]; then
  echo ""
  echo -e "  ${CYAN}是否现在启动配置向导? (Y/n)${NC}"
  read -r -t 15 answer || answer="y"

  if [[ "$answer" != "n" && "$answer" != "N" ]]; then
    echo ""
    cd "$INSTALL_DIR"
    exec ./setup.sh
  fi
fi

echo ""
echo "  稍后启动: cd $INSTALL_DIR && ./setup.sh"
echo ""
