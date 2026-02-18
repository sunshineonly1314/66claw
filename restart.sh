#!/usr/bin/env bash
# ============================================================================
# restart.sh — 一键重编译 + 重启 Gateway & Tauri 桌面应用
#
# Usage:  bash restart.sh          (全量：后端编译 + Gateway + Tauri 桌面)
#         bash restart.sh --ui     (仅重启 Tauri 桌面应用)
#         bash restart.sh --gw     (仅重编译后端 + 重启 Gateway)
# ============================================================================

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

GATEWAY_PORT=18789
UI_PORT=5173
TAURI_DIR="$REPO_DIR/apps/desktop"

# ── 颜色 ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERR]${NC}   $*"; }

# ── 杀占用端口的进程 ──
kill_port() {
  local port=$1
  local label=$2
  local pids
  pids=$(powershell -NoProfile -Command \
    "Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique" 2>/dev/null | tr -d '\r' | grep -E '^[0-9]+$' || true)

  if [ -z "$pids" ]; then
    info "$label 端口 $port 空闲"
    return
  fi

  for pid in $pids; do
    if [ "$pid" -eq 0 ] 2>/dev/null; then continue; fi
    warn "$label 端口 $port 被 PID $pid 占用，正在杀死..."
    taskkill //F //PID "$pid" >/dev/null 2>&1 || true
  done
  ok "$label 端口 $port 已释放"
}

# ── 杀掉所有 Tauri/ClawdbotCN 进程 ──
kill_tauri() {
  local killed=false
  # 杀 Tauri 桌面窗口进程
  for name in ClawdbotCN clawdbot-cn clawdbot_cn; do
    if taskkill //F //IM "${name}.exe" >/dev/null 2>&1; then
      warn "已杀死 ${name}.exe"
      killed=true
    fi
  done
  # 杀 cargo/tauri dev 子进程
  local tauri_pids
  tauri_pids=$(powershell -NoProfile -Command \
    "Get-Process -Name '*tauri*','*cargo*' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id" 2>/dev/null | tr -d '\r' | grep -E '^[0-9]+$' || true)
  for pid in $tauri_pids; do
    taskkill //F //PID "$pid" >/dev/null 2>&1 || true
    warn "已杀死 Tauri/Cargo 进程 PID $pid"
    killed=true
  done
  if [ "$killed" = false ]; then
    info "无 Tauri 进程需要清理"
  fi
}

# ── 清理 Gateway lock 文件 ──
clean_gateway_locks() {
  local tmp_dir
  tmp_dir="$(powershell -NoProfile -Command '[System.IO.Path]::GetTempPath()' 2>/dev/null | tr -d '\r')"
  local lock_dir="${tmp_dir}openclawcn"
  if [ -d "$lock_dir" ]; then
    rm -f "$lock_dir"/gateway.*.lock "$lock_dir"/gateway.*.heartbeat 2>/dev/null || true
    info "已清理 Gateway lock 文件"
  fi
}

# ── 后端编译 ──
build_backend() {
  info "========== 后端编译 (tsdown) =========="
  npx tsdown 2>&1 | tail -3
  ok "后端编译完成"
}

# ── 重启 Gateway ──
restart_gateway() {
  info "========== 重启 Gateway =========="
  kill_port $GATEWAY_PORT "Gateway"
  clean_gateway_locks
  sleep 1

  info "启动 Gateway..."
  node dist/entry.js gateway >"$REPO_DIR/.gateway.log" 2>&1 &
  local gw_pid=$!

  # 等待 Gateway ready
  local attempts=0
  while [ $attempts -lt 20 ]; do
    if grep -q "ready" "$REPO_DIR/.gateway.log" 2>/dev/null; then
      ok "Gateway 已启动 (PID $gw_pid, 端口 $GATEWAY_PORT)"
      return 0
    fi
    sleep 0.5
    attempts=$((attempts + 1))
  done

  warn "Gateway 启动超时，查看日志: $REPO_DIR/.gateway.log"
  tail -5 "$REPO_DIR/.gateway.log" 2>/dev/null || true
}

# ── 重启 Tauri 桌面应用 (tauri dev) ──
restart_tauri() {
  info "========== 重启 Tauri 桌面应用 =========="

  # 1. 杀掉旧的 Tauri 进程
  kill_tauri

  # 2. 杀掉 Vite dev server（Tauri dev 会自己启动一个）
  kill_port $UI_PORT "Vite"
  sleep 1

  # 3. 启动 tauri dev
  info "启动 Tauri dev（首次编译 Rust 可能需要几分钟）..."
  cd "$TAURI_DIR"
  pnpm tauri dev >"$REPO_DIR/.tauri-dev.log" 2>&1 &
  local tauri_pid=$!
  cd "$REPO_DIR"

  # 等待 Tauri 窗口启动（检测 Vite ready + Rust 编译完成）
  local attempts=0
  while [ $attempts -lt 120 ]; do
    # Tauri 窗口启动的标志：Vite ready + 有 ClawdbotCN 进程
    if grep -qi "ready\|running\|listening" "$REPO_DIR/.tauri-dev.log" 2>/dev/null; then
      ok "Tauri 桌面应用已启动 (PID $tauri_pid)"
      return 0
    fi
    # 检查进程是否还活着
    if ! kill -0 "$tauri_pid" 2>/dev/null; then
      err "Tauri 进程意外退出"
      tail -10 "$REPO_DIR/.tauri-dev.log" 2>/dev/null || true
      return 1
    fi
    sleep 1
    attempts=$((attempts + 1))
    # 每 15 秒打印一次进度
    if [ $((attempts % 15)) -eq 0 ]; then
      info "等待 Tauri 编译中... (${attempts}s)"
    fi
  done

  warn "Tauri 启动超时（可能 Rust 编译较慢），进程仍在运行 (PID $tauri_pid)"
  warn "查看日志: $REPO_DIR/.tauri-dev.log"
  tail -5 "$REPO_DIR/.tauri-dev.log" 2>/dev/null || true
}

# ── 主流程 ──
MODE="${1:-all}"

echo ""
info "============================================"
info "  OpenClawCN 一键重编译 & 重启"
info "============================================"
echo ""

case "$MODE" in
  --ui)
    restart_tauri
    ;;
  --gw)
    build_backend
    restart_gateway
    ;;
  *)
    build_backend
    restart_gateway
    restart_tauri
    ;;
esac

echo ""
ok "============================================"
ok "  全部完成!"
ok "  Gateway:  ws://127.0.0.1:$GATEWAY_PORT"
ok "  Tauri:    桌面应用窗口"
ok "============================================"
echo ""
