#!/bin/bash
#
# ClawdbotCN / OpenClawCN 全量卸载脚本 (macOS)
#
# 彻底清除所有 ClawdbotCN / OpenClawCN 安装痕迹，包括：
#   1. 停止并杀死所有相关进程
#   2. 卸载 launchd/systemd 服务 (Gateway + Node Service)
#   3. 删除 /Applications 下的 App Bundle
#   4. 删除用户数据目录 (~/.openclawcn 及所有 legacy 目录)
#   5. 删除 ~/Library 下的日志、缓存、Saved Application State、Preferences
#   6. 删除临时文件中的 gateway 锁 + 修复隧道临时文件
#   7. 删除开发/部署目录
#   8. 清理 ~/.ssh/authorized_keys 中的修复密钥残留
#   9. 清理 Unix domain socket 残留
#  10. 清理 Shell Profile 中的自动补全残留 (.zshrc/.bashrc 等)
#
# 运行后等于全新环境，下次安装不会有任何历史残留。
#
# Usage:
#   ./full-uninstall.sh                # 全量卸载（交互确认）
#   ./full-uninstall.sh --force        # 全量卸载（跳过确认）
#   ./full-uninstall.sh --dry-run      # 预览模式
#   ./full-uninstall.sh --keep-data    # 普通卸载（保留用户数据）
#

set -euo pipefail

# ── Parse arguments ──────────────────────────────────────────────────────

DRY_RUN=false
FORCE=false
KEEP_DATA=false

for arg in "$@"; do
    case "$arg" in
        --dry-run)   DRY_RUN=true ;;
        --force)     FORCE=true ;;
        --keep-data) KEEP_DATA=true ;;
        --help|-h)
            echo "Usage: $0 [--dry-run] [--force] [--keep-data]"
            echo ""
            echo "  --dry-run    Preview mode, don't actually delete anything"
            echo "  --force      Skip confirmation prompt"
            echo "  --keep-data  Keep user data (~/.openclawcn), only remove app"
            exit 0
            ;;
        *)
            echo "Unknown option: $arg"
            exit 1
            ;;
    esac
done

# ── Counters ─────────────────────────────────────────────────────────────

REMOVED=0
FAILED=0
SKIPPED=0

# ── Colors ───────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# ── Helpers ──────────────────────────────────────────────────────────────

header() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
}

step() {
    echo ""
    echo -e "${YELLOW}── $1 ──${NC}"
}

remove_safe() {
    local target="$1"
    local label="${2:-$1}"

    if [ -z "$target" ]; then return; fi

    # Resolve to absolute path
    local resolved
    resolved=$(cd "$(dirname "$target")" 2>/dev/null && echo "$(pwd)/$(basename "$target")" || echo "$target")

    # Safety: never delete root, home, or system dirs
    if [ "$resolved" = "/" ] || [ "$resolved" = "$HOME" ]; then
        echo -e "  ${RED}[SKIP] Refusing to delete protected path: $resolved${NC}"
        SKIPPED=$((SKIPPED + 1))
        return
    fi

    local blocked_prefixes=("/etc" "/sys" "/proc" "/dev" "/boot" "/System" "/usr" "/var")
    for bp in "${blocked_prefixes[@]}"; do
        if [[ "$resolved" == "$bp" || "$resolved" == "$bp/"* ]]; then
            echo -e "  ${RED}[SKIP] Refusing to delete system path: $resolved${NC}"
            SKIPPED=$((SKIPPED + 1))
            return
        fi
    done

    if [ ! -e "$target" ] && [ ! -L "$target" ]; then
        echo -e "  ${GRAY}[--] $label  (not found)${NC}"
        return
    fi

    if $DRY_RUN; then
        echo -e "  ${MAGENTA}[DRY] Would remove: $label${NC}"
        echo -e "  ${GRAY}      Path: $target${NC}"
        SKIPPED=$((SKIPPED + 1))
        return
    fi

    if rm -rf "$target" 2>/dev/null; then
        echo -e "  ${GREEN}[OK] Removed: $label${NC}"
        REMOVED=$((REMOVED + 1))
    else
        echo -e "  ${RED}[FAIL] $label${NC}"
        FAILED=$((FAILED + 1))
    fi
}

# ── Banner ───────────────────────────────────────────────────────────────

if $KEEP_DATA; then
    header "ClawdbotCN 普通卸载 (保留用户数据)"
else
    header "ClawdbotCN 全量卸载 (Full Uninstall)"
    echo ""
    echo -e "  ${RED}!! 警告: 此操作将删除所有数据，包括配置文件、会话记录、${NC}"
    echo -e "  ${RED}   Agent 工作区、数据库等。操作不可恢复！${NC}"
fi

if $DRY_RUN; then
    echo ""
    echo -e "  ${MAGENTA}[预览模式] 不会实际删除任何文件${NC}"
fi

# ── Confirmation ─────────────────────────────────────────────────────────

if ! $FORCE && ! $DRY_RUN; then
    echo ""
    printf "确定要继续吗？输入 YES 确认: "
    read -r confirm
    if [ "$confirm" != "YES" ]; then
        echo -e "${YELLOW}已取消。${NC}"
        exit 0
    fi
fi

# ══════════════════════════════════════════════════════════════════════════
# Step 1: Kill all related processes
# ══════════════════════════════════════════════════════════════════════════

step "Step 1: 停止相关进程"

kill_proc() {
    local name="$1"
    local pids
    pids=$(pgrep -x "$name" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        if $DRY_RUN; then
            echo -e "  ${MAGENTA}[DRY] Would kill process: $name (PID: $pids)${NC}"
        else
            kill -9 $pids 2>/dev/null || true
            echo -e "  ${GREEN}[OK] Killed: $name${NC}"
        fi
    else
        echo -e "  ${GRAY}[--] $name not running${NC}"
    fi
}

kill_proc "clawdbot-desktop"
kill_proc "ClawdbotCN"
kill_proc "OpenClawCN"

# Kill node processes from the app bundle
node_pids=$(pgrep -f "ClawdbotCN.*node" 2>/dev/null || pgrep -f "OpenClawCN.*node" 2>/dev/null || true)
if [ -n "$node_pids" ]; then
    if $DRY_RUN; then
        echo -e "  ${MAGENTA}[DRY] Would kill bundled node processes${NC}"
    else
        kill -9 $node_pids 2>/dev/null || true
        echo -e "  ${GREEN}[OK] Killed bundled node processes${NC}"
    fi
fi

# Kill gateway on port 18789
gateway_pid=$(lsof -ti tcp:18789 2>/dev/null || true)
if [ -n "$gateway_pid" ]; then
    if $DRY_RUN; then
        echo -e "  ${MAGENTA}[DRY] Would kill gateway PID $gateway_pid on port 18789${NC}"
    else
        kill -9 $gateway_pid 2>/dev/null || true
        echo -e "  ${GREEN}[OK] Killed gateway PID $gateway_pid on port 18789${NC}"
    fi
else
    echo -e "  ${GRAY}[--] No gateway on port 18789${NC}"
fi

if ! $DRY_RUN; then
    echo -e "  ${GRAY}等待文件句柄释放...${NC}"
    sleep 2
fi

# ══════════════════════════════════════════════════════════════════════════
# Step 2: Unload and remove launchd services
# ══════════════════════════════════════════════════════════════════════════

step "Step 2: 卸载 launchd 服务"

if [ "$(uname)" = "Darwin" ]; then
    LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
    uid=$(id -u)

    # Find all matching plist files
    plist_patterns=("ai.openclawcn" "com.openclawcn" "com.clawdbot")

    for pattern in "${plist_patterns[@]}"; do
        for plist in "$LAUNCH_AGENTS_DIR"/${pattern}*.plist; do
            [ -f "$plist" ] || continue
            label=$(basename "$plist" .plist)

            if $DRY_RUN; then
                echo -e "  ${MAGENTA}[DRY] Would unload & remove: $label${NC}"
            else
                # Unload (bootout) the service
                launchctl bootout "gui/$uid/$label" 2>/dev/null || \
                    launchctl unload "$plist" 2>/dev/null || true
                rm -f "$plist"
                echo -e "  ${GREEN}[OK] Removed launchd service: $label${NC}"
                REMOVED=$((REMOVED + 1))
            fi
        done
    done

    if [ $REMOVED -eq 0 ] 2>/dev/null; then
        echo -e "  ${GRAY}[--] No launchd services found${NC}"
    fi
else
    # Linux: systemd
    systemd_patterns=("openclawcn-gateway" "openclawcn-node" "clawdbot-gateway")
    systemd_dir="$HOME/.config/systemd/user"

    for pattern in "${systemd_patterns[@]}"; do
        for unit in "$systemd_dir"/${pattern}*.service; do
            [ -f "$unit" ] || continue
            unit_name=$(basename "$unit")

            if $DRY_RUN; then
                echo -e "  ${MAGENTA}[DRY] Would stop & remove: $unit_name${NC}"
            else
                systemctl --user stop "$unit_name" 2>/dev/null || true
                systemctl --user disable "$unit_name" 2>/dev/null || true
                rm -f "$unit"
                echo -e "  ${GREEN}[OK] Removed systemd service: $unit_name${NC}"
                REMOVED=$((REMOVED + 1))
            fi
        done
    done

    # Reload systemd if we removed anything
    if ! $DRY_RUN; then
        systemctl --user daemon-reload 2>/dev/null || true
    fi
fi

# ══════════════════════════════════════════════════════════════════════════
# Step 3: Remove application bundle
# ══════════════════════════════════════════════════════════════════════════

step "Step 3: 删除应用程序"

if [ "$(uname)" = "Darwin" ]; then
    app_bundles=(
        "/Applications/ClawdbotCN.app"
        "/Applications/OpenClawCN.app"
        "$HOME/Applications/ClawdbotCN.app"
        "$HOME/Applications/OpenClawCN.app"
    )

    for app in "${app_bundles[@]}"; do
        remove_safe "$app" "应用程序: $app"
    done
else
    echo -e "  ${GRAY}[--] Not macOS, skipping app bundle removal${NC}"
fi

# ══════════════════════════════════════════════════════════════════════════
# Step 4: Remove user data directories (full uninstall only)
# ══════════════════════════════════════════════════════════════════════════

if ! $KEEP_DATA; then
    step "Step 4: 删除用户数据目录"

    # Current + all legacy state directories
    state_dirs=(
        "$HOME/.openclawcn"
        "$HOME/.clawdbotcn"
        "$HOME/.clawdbot"
        "$HOME/.moldbot"
        "$HOME/.moltbot"
    )

    # Also check for profile-suffixed directories: ~/.openclawcn-<profile>
    for pd in "$HOME"/.openclawcn-*; do
        [ -d "$pd" ] && state_dirs+=("$pd")
    done

    for dir in "${state_dirs[@]}"; do
        remove_safe "$dir" "用户数据: $dir"
    done

    # Default agent workspace
    if [ -d "$HOME/clawd" ]; then
        remove_safe "$HOME/clawd" "Agent 工作区: ~/clawd"
    fi
else
    step "Step 4: 用户数据 (已跳过 - keep-data 模式)"
    echo -e "  ${YELLOW}[SKIP] 保留用户数据目录${NC}"
fi

# ══════════════════════════════════════════════════════════════════════════
# Step 5: Remove ~/Library data (macOS only)
# ══════════════════════════════════════════════════════════════════════════

step "Step 5: 清理 ~/Library 数据"

if [ "$(uname)" = "Darwin" ]; then
    # Logs
    remove_safe "$HOME/Library/Logs/ClawdbotCN" "Logs: ~/Library/Logs/ClawdbotCN"
    remove_safe "$HOME/Library/Logs/OpenClawCN" "Logs: ~/Library/Logs/OpenClawCN"

    # Caches (Tauri WebKit cache)
    remove_safe "$HOME/Library/Caches/com.clawdbot.cn.desktop" "Caches: com.clawdbot.cn.desktop"
    remove_safe "$HOME/Library/Caches/com.xiangdong.ai.desktop" "Caches: com.xiangdong.ai.desktop"

    # WebKit data
    remove_safe "$HOME/Library/WebKit/com.clawdbot.cn.desktop" "WebKit: com.clawdbot.cn.desktop"
    remove_safe "$HOME/Library/WebKit/com.xiangdong.ai.desktop" "WebKit: com.xiangdong.ai.desktop"

    # Saved Application State
    remove_safe "$HOME/Library/Saved Application State/com.clawdbot.cn.desktop.savedState" \
        "Saved State: com.clawdbot.cn.desktop"
    remove_safe "$HOME/Library/Saved Application State/com.xiangdong.ai.desktop.savedState" \
        "Saved State: com.xiangdong.ai.desktop"

    # Preferences (plist)
    remove_safe "$HOME/Library/Preferences/com.clawdbot.cn.desktop.plist" \
        "Preferences: com.clawdbot.cn.desktop.plist"
    remove_safe "$HOME/Library/Preferences/com.xiangdong.ai.desktop.plist" \
        "Preferences: com.xiangdong.ai.desktop.plist"

    # Application Support
    remove_safe "$HOME/Library/Application Support/com.clawdbot.cn.desktop" \
        "App Support: com.clawdbot.cn.desktop"
    remove_safe "$HOME/Library/Application Support/com.xiangdong.ai.desktop" \
        "App Support: com.xiangdong.ai.desktop"

    # Group Containers (if any)
    for gc in "$HOME/Library/Group Containers"/*clawdbot*; do
        [ -e "$gc" ] && remove_safe "$gc" "Group Container: $(basename "$gc")"
    done
    for gc in "$HOME/Library/Group Containers"/*openclawcn*; do
        [ -e "$gc" ] && remove_safe "$gc" "Group Container: $(basename "$gc")"
    done
else
    echo -e "  ${GRAY}[--] Not macOS, skipping ~/Library cleanup${NC}"
fi

# ══════════════════════════════════════════════════════════════════════════
# Step 6: Remove temp files (gateway locks)
# ══════════════════════════════════════════════════════════════════════════

step "Step 6: 清理临时文件"

tmpdir="${TMPDIR:-/tmp}"
uid=$(id -u)

# Pattern: /tmp/openclawcn-<uid>/ or /tmp/openclawcn/
for lockdir in "$tmpdir"/openclawcn* "/tmp"/openclawcn*; do
    [ -d "$lockdir" ] && remove_safe "$lockdir" "Gateway 锁: $(basename "$lockdir")"
done

# Repair tunnel temp directory: /tmp/clawdbot-repair
remove_safe "$tmpdir/clawdbot-repair" "修复隧道临时文件: clawdbot-repair"
remove_safe "/tmp/clawdbot-repair" "修复隧道临时文件: /tmp/clawdbot-repair"

# ══════════════════════════════════════════════════════════════════════════
# Step 7: Remove E:/openclawcn (dev directory, if applicable)
# ══════════════════════════════════════════════════════════════════════════

if ! $KEEP_DATA; then
    step "Step 7: 删除开发/部署目录"

    # This is primarily for Windows dev env, but check just in case
    if [ -d "/mnt/e/openclawcn" ]; then
        remove_safe "/mnt/e/openclawcn" "开发/部署目录: /mnt/e/openclawcn"
    elif [ -d "$HOME/openclawcn" ]; then
        remove_safe "$HOME/openclawcn" "开发/部署目录: ~/openclawcn"
    else
        echo -e "  ${GRAY}[--] No dev/deploy directory found${NC}"
    fi
else
    step "Step 7: 开发/部署目录 (已跳过 - keep-data 模式)"
fi

# ══════════════════════════════════════════════════════════════════════════
# Step 8: Clean up SSH authorized_keys (repair assistant residual)
# ══════════════════════════════════════════════════════════════════════════

step "Step 8: 清理 SSH 修复密钥残留"

ssh_auth_keys="$HOME/.ssh/authorized_keys"
if [ -f "$ssh_auth_keys" ]; then
    if grep -q "clawdbot-repair" "$ssh_auth_keys" 2>/dev/null; then
        if $DRY_RUN; then
            echo -e "  ${MAGENTA}[DRY] Would remove clawdbot-repair keys from ~/.ssh/authorized_keys${NC}"
        else
            # Remove lines containing clawdbot-repair
            sed -i.bak '/clawdbot-repair/d' "$ssh_auth_keys" 2>/dev/null || \
                sed -i '' '/clawdbot-repair/d' "$ssh_auth_keys" 2>/dev/null || true
            rm -f "${ssh_auth_keys}.bak" 2>/dev/null || true
            echo -e "  ${GREEN}[OK] Cleaned clawdbot-repair keys from authorized_keys${NC}"
            REMOVED=$((REMOVED + 1))
        fi
    else
        echo -e "  ${GRAY}[--] No clawdbot-repair keys in authorized_keys${NC}"
    fi
else
    echo -e "  ${GRAY}[--] ~/.ssh/authorized_keys not found${NC}"
fi

# ══════════════════════════════════════════════════════════════════════════
# Step 9: Clean up Unix domain sockets
# ══════════════════════════════════════════════════════════════════════════

step "Step 9: 清理 Unix domain socket"

# exec-approvals.sock may be left in state dir (already deleted if state dir was removed)
# But check /tmp as well
for sock in "$tmpdir"/openclawcn*.sock "/tmp"/openclawcn*.sock; do
    [ -e "$sock" ] && remove_safe "$sock" "Socket: $(basename "$sock")"
done

# ══════════════════════════════════════════════════════════════════════════
# Step 10: Clean up shell completion residuals
# ══════════════════════════════════════════════════════════════════════════

step "Step 10: 清理 Shell 自动补全残留"

# The CLI `openclawcn completion --install` appends lines to shell profiles:
#   # OpenClawCN Completion
#   source "~/.openclawcn/completions/openclawcn.zsh"
# The cache files are inside ~/.openclawcn (already deleted), but the
# profile lines remain and will cause "file not found" warnings on every
# new shell.

clean_shell_profile() {
    local profile="$1"
    [ -f "$profile" ] || return

    if grep -q "OpenClawCN Completion\|openclawcn completion\|openclawcn\.zsh\|openclawcn\.bash\|openclawcn\.fish" "$profile" 2>/dev/null; then
        if $DRY_RUN; then
            echo -e "  ${MAGENTA}[DRY] Would clean completion lines from $profile${NC}"
        else
            # Remove the header line and the source line
            sed -i.bak '/# OpenClawCN Completion/d;/openclawcn completion/d;/openclawcn\.zsh/d;/openclawcn\.bash/d;/openclawcn\.fish/d' "$profile" 2>/dev/null || \
                sed -i '' '/# OpenClawCN Completion/d;/openclawcn completion/d;/openclawcn\.zsh/d;/openclawcn\.bash/d;/openclawcn\.fish/d' "$profile" 2>/dev/null || true
            rm -f "${profile}.bak" 2>/dev/null || true
            echo -e "  ${GREEN}[OK] Cleaned completion lines from $profile${NC}"
            REMOVED=$((REMOVED + 1))
        fi
    else
        echo -e "  ${GRAY}[--] No completion lines in $profile${NC}"
    fi
}

clean_shell_profile "$HOME/.zshrc"
clean_shell_profile "$HOME/.bashrc"
clean_shell_profile "$HOME/.bash_profile"
clean_shell_profile "$HOME/.config/fish/config.fish"

# ══════════════════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  完成!${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo ""

if $DRY_RUN; then
    echo -e "  ${MAGENTA}[预览模式] 以上为将要执行的操作，未实际删除任何内容${NC}"
    echo -e "  ${MAGENTA}  移除 --dry-run 参数以实际执行${NC}"
else
    echo -e "  ${GREEN}已删除: $REMOVED 项${NC}"
    if [ $FAILED -gt 0 ]; then
        echo -e "  ${RED}失败:   $FAILED 项 (可能需要 sudo 权限)${NC}"
    fi
    if [ $SKIPPED -gt 0 ]; then
        echo -e "  ${YELLOW}跳过:   $SKIPPED 项${NC}"
    fi

    echo ""
    if $KEEP_DATA; then
        echo -e "  ${YELLOW}用户数据已保留在 ~/.openclawcn，下次安装可恢复配置。${NC}"
    else
        echo -e "  ${GREEN}所有数据已清除，下次安装将是全新环境。${NC}"
    fi
fi

echo ""
