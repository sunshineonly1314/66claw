#!/usr/bin/env bash
###############################################################################
# 手动触发构建脚本
# 用于测试或手动触发本地 CI/CD 构建
###############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 显示帮助
show_help() {
  cat <<EOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 ClawdbotCN 本地 CI/CD 手动构建触发器
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

用法: $0 [选项]

选项:
  -p, --platform <platform>   指定构建平台 (windows/macos/all)
  -v, --version <version>     指定版本号 (例如: 2026.2.18)
  -m, --mode <mode>           Windows 构建模式 (standard/full)
  -a, --arch <arch>           macOS 架构 (universal/arm64/x64)
  -y, --yes                   自动确认，不提示
  -h, --help                  显示帮助信息

示例:
  # 构建所有平台
  $0 --platform all --version 2026.2.18

  # 只构建 Windows (标准模式)
  $0 --platform windows --mode standard

  # 只构建 macOS (Universal 二进制)
  $0 --platform macos --arch universal

  # 构建 Windows 完整版
  $0 --platform windows --mode full --version 2026.2.18-beta

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
}

# 默认参数
PLATFORM="all"
VERSION=""
WIN_MODE="standard"
MAC_ARCH="universal"
AUTO_YES=false

# 解析命令行参数
while [[ $# -gt 0 ]]; do
  case $1 in
    -p|--platform)
      PLATFORM="$2"
      shift 2
      ;;
    -v|--version)
      VERSION="$2"
      shift 2
      ;;
    -m|--mode)
      WIN_MODE="$2"
      shift 2
      ;;
    -a|--arch)
      MAC_ARCH="$2"
      shift 2
      ;;
    -y|--yes)
      AUTO_YES=true
      shift
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      echo -e "${RED}❌ Unknown option: $1${NC}"
      show_help
      exit 1
      ;;
  esac
done

# 验证平台
if [[ ! "$PLATFORM" =~ ^(windows|macos|all)$ ]]; then
  echo -e "${RED}❌ Invalid platform: $PLATFORM${NC}"
  echo "   Valid options: windows, macos, all"
  exit 1
fi

# 显示构建信息
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🚀 手动触发构建${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Platform:      ${YELLOW}$PLATFORM${NC}"
echo -e "  Version:       ${YELLOW}${VERSION:-auto}${NC}"
echo -e "  Windows Mode:  ${YELLOW}$WIN_MODE${NC}"
echo -e "  macOS Arch:    ${YELLOW}$MAC_ARCH${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 确认
if [ "$AUTO_YES" = false ]; then
  read -p "确认开始构建? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⏹️  Build cancelled${NC}"
    exit 0
  fi
else
  echo -e "${GREEN}✅ Auto-confirmed, starting build...${NC}"
  echo ""
fi

# 记录日志
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 执行构建
if [[ "$PLATFORM" == "all" ]]; then
  # ── 双平台并行构建 ──
  # Windows 和 macOS SSH 到不同机器，完全独立，可安全并行。
  # 构建阶段并行，OSS 上传阶段串行（OSS 无法并发上传同一版本）。

  # ── 预确定版本号 ──
  # 并行模式下必须在启动构建前确定版本号，否则两个 builder 同时 auto bump 会产生竞态。
  # 通过 --version 传入后，两个 builder 都会跳过 auto bump。
  if [ -z "$VERSION" ]; then
    echo -e "${YELLOW}📌 Pre-determining version (avoid parallel bump race)...${NC}"
    # 读取当前 package.json 版本并 patch +1
    CURRENT_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "")
    if [ -n "$CURRENT_VERSION" ]; then
      # Simple patch bump: 1.1.23 → 1.1.24
      IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
      PATCH=$((PATCH + 1))
      VERSION="${MAJOR}.${MINOR}.${PATCH}"
      echo -e "  Current: $CURRENT_VERSION → Next: ${GREEN}$VERSION${NC}"
    else
      echo -e "${YELLOW}  WARNING: Cannot read package.json, letting builders auto-bump${NC}"
    fi
  fi

  echo ""
  echo -e "${GREEN}🚀 双平台并行构建模式${NC}"
  echo ""

  LOG_WIN="$LOG_DIR/build-windows-$TIMESTAMP.log"
  LOG_MAC="$LOG_DIR/build-macos-$TIMESTAMP.log"

  echo -e "${GREEN}🪟 Starting Windows build (parallel)...${NC}"
  bash "$SCRIPT_DIR/build-windows.sh" "$VERSION" "$WIN_MODE" --skip-deploy > "$LOG_WIN" 2>&1 &
  WIN_PID=$!

  echo -e "${GREEN}🍎 Starting macOS build (parallel)...${NC}"
  bash "$SCRIPT_DIR/build-macos.sh" --version "$VERSION" --arch "$MAC_ARCH" --skip-deploy > "$LOG_MAC" 2>&1 &
  MAC_PID=$!

  echo -e "  Windows PID: $WIN_PID  Log: $LOG_WIN"
  echo -e "  macOS   PID: $MAC_PID  Log: $LOG_MAC"
  echo ""

  # 等待两个构建完成
  # NOTE: 必须用 set +e，否则 set -e 下 wait 遇到非零退出会直接终止脚本
  set +e
  wait $WIN_PID
  WIN_EXIT=$?
  wait $MAC_PID
  MAC_EXIT=$?
  set -e

  # 报告构建结果
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "  Build Results:"
  if [ $WIN_EXIT -eq 0 ]; then
    echo -e "  Windows: ${GREEN}SUCCESS${NC}"
  else
    echo -e "  Windows: ${RED}FAILED (exit $WIN_EXIT)${NC}"
    echo -e "  ${YELLOW}Last 20 lines of Windows log:${NC}"
    tail -20 "$LOG_WIN" 2>/dev/null
  fi
  if [ $MAC_EXIT -eq 0 ]; then
    echo -e "  macOS:   ${GREEN}SUCCESS${NC}"
  else
    echo -e "  macOS:   ${RED}FAILED (exit $MAC_EXIT)${NC}"
    echo -e "  ${YELLOW}Last 20 lines of macOS log:${NC}"
    tail -20 "$LOG_MAC" 2>/dev/null
  fi
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  # 如果任一构建失败，退出
  if [ $WIN_EXIT -ne 0 ] || [ $MAC_EXIT -ne 0 ]; then
    echo -e "${RED}❌ One or more builds failed. Skipping deploy.${NC}"
    exit 1
  fi

  # ── OSS 上传阶段：串行执行（避免并发上传冲突） ──
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}📤 Release Deploy (sequential upload)${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  DEPLOY_LOG_WIN="$LOG_DIR/deploy-windows-$TIMESTAMP.log"
  DEPLOY_LOG_MAC="$LOG_DIR/deploy-macos-$TIMESTAMP.log"

  echo -e "${GREEN}🪟 Deploying Windows...${NC}"
  if bash "$SCRIPT_DIR/build-windows.sh" "$VERSION" "$WIN_MODE" --deploy-only 2>&1 | tee "$DEPLOY_LOG_WIN"; then
    echo -e "${GREEN}✅ Windows deploy completed!${NC}"
  else
    echo -e "${RED}❌ Windows deploy failed! Check log: $DEPLOY_LOG_WIN${NC}"
  fi

  echo -e "${GREEN}🍎 Deploying macOS...${NC}"
  if bash "$SCRIPT_DIR/build-macos.sh" --version "$VERSION" --arch "$MAC_ARCH" --deploy-only 2>&1 | tee "$DEPLOY_LOG_MAC"; then
    echo -e "${GREEN}✅ macOS deploy completed!${NC}"
  else
    echo -e "${RED}❌ macOS deploy failed! Check log: $DEPLOY_LOG_MAC${NC}"
  fi

else
  # ── 单平台构建（保持原有逻辑） ──
  if [[ "$PLATFORM" == "windows" ]]; then
    echo ""
    echo -e "${GREEN}🪟 Starting Windows build...${NC}"
    LOG_FILE="$LOG_DIR/build-windows-$TIMESTAMP.log"

    if bash "$SCRIPT_DIR/build-windows.sh" "$VERSION" "$WIN_MODE" 2>&1 | tee "$LOG_FILE"; then
      echo -e "${GREEN}✅ Windows build completed!${NC}"
    else
      echo -e "${RED}❌ Windows build failed! Check log: $LOG_FILE${NC}"
      exit 1
    fi
  fi

  if [[ "$PLATFORM" == "macos" ]]; then
    echo ""
    echo -e "${GREEN}🍎 Starting macOS build...${NC}"
    LOG_FILE="$LOG_DIR/build-macos-$TIMESTAMP.log"

    if bash "$SCRIPT_DIR/build-macos.sh" --version "$VERSION" --arch "$MAC_ARCH" 2>&1 | tee "$LOG_FILE"; then
      echo -e "${GREEN}✅ macOS build completed!${NC}"
    else
      echo -e "${RED}❌ macOS build failed! Check log: $LOG_FILE${NC}"
      exit 1
    fi
  fi
fi

# 构建完成
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ All builds completed successfully!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}📦 Artifacts location:${NC}"
echo -e "  Windows: $SCRIPT_DIR/artifacts/windows/"
echo -e "  macOS:   $SCRIPT_DIR/artifacts/macos/"
echo ""
echo -e "${YELLOW}📄 Build logs:${NC}"
ls -lht "$LOG_DIR" | head -5
echo ""
