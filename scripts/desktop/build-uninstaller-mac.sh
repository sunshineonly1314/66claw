#!/bin/bash
#
# 构建 macOS 全量卸载工具 (.app)
#
# 生成一个 .app 文件夹，用户在 Finder 里双击图标即可运行。
# 产物: build/ClawdbotCN-Uninstaller.app
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/build"
APP_DIR="$BUILD_DIR/ClawdbotCN-Uninstaller.app"

echo "Building ClawdbotCN Uninstaller.app..."

# ── Step 1: Create .app bundle structure ──────────────────────────────────

rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

# ── Step 2: Create Info.plist ─────────────────────────────────────────────

cat > "$APP_DIR/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>uninstaller</string>
    <key>CFBundleIdentifier</key>
    <string>com.clawdbot.cn.uninstaller</string>
    <key>CFBundleName</key>
    <string>ClawdbotCN 全量卸载</string>
    <key>CFBundleDisplayName</key>
    <string>ClawdbotCN 全量卸载工具</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>LSMinimumSystemVersion</key>
    <string>13.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
PLIST

echo "  Created Info.plist"

# ── Step 3: Create the launcher script ────────────────────────────────────
# This is the executable that runs when user double-clicks the .app

cat > "$APP_DIR/Contents/MacOS/uninstaller" << 'LAUNCHER'
#!/bin/bash
#
# ClawdbotCN Uninstaller launcher
# Opens Terminal.app and runs the uninstall script with a menu
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RESOURCES_DIR="$SCRIPT_DIR/../Resources"

# Use osascript to open Terminal with our script
# This gives the user a proper terminal experience with colors
osascript << APPLESCRIPT
tell application "Terminal"
    activate
    set newTab to do script "clear && bash '${RESOURCES_DIR}/run-uninstall.sh'; exit"
    set current settings of newTab to settings set "Basic"
end tell
APPLESCRIPT
LAUNCHER

chmod +x "$APP_DIR/Contents/MacOS/uninstaller"
echo "  Created launcher"

# ── Step 4: Copy the uninstall script into Resources ──────────────────────

cp "$SCRIPT_DIR/full-uninstall.sh" "$APP_DIR/Contents/Resources/full-uninstall.sh"
chmod +x "$APP_DIR/Contents/Resources/full-uninstall.sh"

# Create the menu wrapper script
cat > "$APP_DIR/Contents/Resources/run-uninstall.sh" << 'MENU'
#!/bin/bash
#
# ClawdbotCN 全量卸载 - 交互菜单
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║     ClawdbotCN 全量卸载工具 (Full Uninstall)         ║"
echo "╠═══════════════════════════════════════════════════════╣"
echo "║                                                       ║"
echo "║  此工具将彻底清除 ClawdbotCN 的所有安装痕迹。        ║"
echo "║  清除后下次安装将是全新环境，无历史残留。             ║"
echo "║                                                       ║"
echo "║  [1] 全量卸载 - 删除所有数据（全新环境）             ║"
echo "║  [2] 普通卸载 - 保留用户数据（配置/会话）            ║"
echo "║  [3] 预览模式 - 只看不删，先确认                     ║"
echo "║  [4] 取消退出                                         ║"
echo "║                                                       ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

printf "请输入选项 (1/2/3/4): "
read -r choice

case "$choice" in
    1)
        echo ""
        echo "即将执行全量卸载..."
        echo ""
        bash "$SCRIPT_DIR/full-uninstall.sh"
        ;;
    2)
        echo ""
        echo "即将执行普通卸载（保留用户数据）..."
        echo ""
        bash "$SCRIPT_DIR/full-uninstall.sh" --keep-data
        ;;
    3)
        echo ""
        echo "正在预览将要删除的内容..."
        echo ""
        bash "$SCRIPT_DIR/full-uninstall.sh" --dry-run --force
        ;;
    4|*)
        echo ""
        echo "已取消。"
        ;;
esac

echo ""
echo "──────────────────────────────────────────────────────────"
echo "按 Enter 键关闭窗口..."
read -r
MENU

chmod +x "$APP_DIR/Contents/Resources/run-uninstall.sh"
echo "  Created menu wrapper"

# ── Step 5: Copy icon if available ────────────────────────────────────────

ICON_SRC="$PROJECT_ROOT/apps/desktop/src-tauri/icons/icon.icns"
if [ -f "$ICON_SRC" ]; then
    cp "$ICON_SRC" "$APP_DIR/Contents/Resources/AppIcon.icns"
    echo "  Copied app icon"
else
    echo "  No icon found at $ICON_SRC (app will use default icon)"
fi

# ── Step 6: Summary ──────────────────────────────────────────────────────

echo ""
echo "✓ Built successfully!"
echo "  Output: $APP_DIR"
echo ""
echo "  用户双击 ClawdbotCN-Uninstaller.app 即可运行。"
echo ""

# ── Optional: Create DMG ─────────────────────────────────────────────────

if command -v hdiutil &> /dev/null; then
    DMG_PATH="$BUILD_DIR/ClawdbotCN-Uninstaller.dmg"
    rm -f "$DMG_PATH"

    hdiutil create -volname "ClawdbotCN Uninstaller" \
        -srcfolder "$APP_DIR" \
        -ov -format UDZO \
        "$DMG_PATH" 2>/dev/null

    if [ -f "$DMG_PATH" ]; then
        size=$(du -h "$DMG_PATH" | cut -f1)
        echo "  Also created DMG: $DMG_PATH ($size)"
    fi
fi
