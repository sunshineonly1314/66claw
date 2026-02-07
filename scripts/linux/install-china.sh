#!/usr/bin/env bash
# ================================================================
# Clawdbot 中国区一键安装脚本
#
# 国内用户直接使用:
#   curl -fsSL https://gitee.com/tecbinai/clawdbot-releases/raw/main/install.sh | bash
#
# 等价于:
#   curl -fsSL https://get.tecbinai.com/linux | bash -s -- --mirror china
#
# 特点:
#   - 使用 Gitee 镜像下载，速度快
#   - 使用 npmmirror 作为 npm 源
#   - 全中文提示
# ================================================================

set -euo pipefail

# 代理到主安装脚本，自动加 --mirror china
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -f "$SCRIPT_DIR/install-online.sh" ]]; then
  # 本地调用
  exec bash "$SCRIPT_DIR/install-online.sh" --mirror china "$@"
else
  # 在线调用 (被 pipe 进来的)
  TEMP_SCRIPT=$(mktemp /tmp/clawdbot-install-XXXXXXXX.sh)
  curl -fsSL "https://gitee.com/tecbinai/clawdbot-releases/raw/main/install-online.sh" -o "$TEMP_SCRIPT"
  exec bash "$TEMP_SCRIPT" --mirror china "$@"
fi
