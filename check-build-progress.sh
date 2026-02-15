#!/bin/bash
# 快速检查 macOS 打包进度

echo "════════════════════════════════════════════════════════════════"
echo "  OpenClawCN 打包进度检查"
echo "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "════════════════════════════════════════════════════════════════"
echo ""

# 1. 检查打包进程是否在运行
echo "【1】检查打包进程..."
if pgrep -f "build-macos-cn.sh" > /dev/null; then
    echo "  ✓ 打包脚本正在运行"
    echo "  进程ID: $(pgrep -f build-macos-cn.sh)"
    echo "  运行时长: $(ps -p $(pgrep -f build-macos-cn.sh) -o etime= | tr -d ' ')"
else
    echo "  ✗ 打包脚本未运行（可能已完成或未启动）"
fi
echo ""

# 2. 检查构建日志
echo "【2】最新构建日志..."
if [ -f /tmp/openclawcn-build.log ]; then
    echo "  最后 10 行日志:"
    tail -10 /tmp/openclawcn-build.log | sed 's/^/    /'
else
    echo "  ✗ 未找到日志文件"
fi
echo ""

# 3. 检查构建产物
echo "【3】检查构建产物..."

# 查找项目目录
PROJECT_DIRS=(
    "$HOME/openclawcn-cn"
    "$HOME/clawd-cn"
    "$(pwd)"
)

PROJECT_DIR=""
for dir in "${PROJECT_DIRS[@]}"; do
    if [ -d "$dir/build" ]; then
        PROJECT_DIR="$dir"
        break
    fi
done

if [ -n "$PROJECT_DIR" ]; then
    echo "  项目目录: $PROJECT_DIR"

    # 检查中间产物
    if [ -d "$PROJECT_DIR/build/output/staging" ]; then
        STAGING_SIZE=$(du -sh "$PROJECT_DIR/build/output/staging" 2>/dev/null | cut -f1)
        echo "  → staging 目录: $STAGING_SIZE"
    fi

    # 检查 DMG
    DMG_COUNT=$(find "$PROJECT_DIR/build/output" -name "*.dmg" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$DMG_COUNT" -gt 0 ]; then
        echo "  ✓ 找到 $DMG_COUNT 个 DMG 文件:"
        find "$PROJECT_DIR/build/output" -name "*.dmg" -exec ls -lh {} \; | awk '{print "    " $9 " (" $5 ")"}'
    else
        echo "  ✗ 尚未生成 DMG"
    fi
else
    echo "  ✗ 未找到项目目录"
fi
echo ""

# 4. 检查桌面 DMG
echo "【4】检查桌面..."
DESKTOP_DMG=$(ls -1 "$HOME/Desktop"/OpenClawCN*.dmg 2>/dev/null)
if [ -n "$DESKTOP_DMG" ]; then
    echo "  ✓ 桌面已有 DMG:"
    ls -lh "$DESKTOP_DMG" | awk '{print "    " $9 " (" $5 ")"}'
else
    echo "  ✗ 桌面尚未有 DMG"
fi
echo ""

# 5. 系统资源使用
echo "【5】系统资源..."
echo "  CPU 使用: $(top -l 1 | grep "CPU usage" | awk '{print $3, $5}' || echo "N/A")"
echo "  内存使用: $(top -l 1 | grep PhysMem | awk '{print $2, $6}' || echo "N/A")"
echo "  磁盘空间: $(df -h . | tail -1 | awk '{print "可用 " $4 " / 总计 " $2}')"
echo ""

# 6. 估计进度
echo "【6】进度估计..."
if [ -f /tmp/openclawcn-build.log ]; then
    # 检查关键阶段标记
    if grep -q "创建 DMG" /tmp/openclawcn-build.log; then
        echo "  ▓▓▓▓▓▓▓▓▓░ 90% - 正在创建 DMG"
    elif grep -q "代码签名" /tmp/openclawcn-build.log; then
        echo "  ▓▓▓▓▓▓▓▓░░ 80% - 正在签名"
    elif grep -q "清理优化" /tmp/openclawcn-build.log; then
        echo "  ▓▓▓▓▓▓▓░░░ 70% - 正在清理"
    elif grep -q "验证完整性" /tmp/openclawcn-build.log; then
        echo "  ▓▓▓▓▓▓░░░░ 60% - 正在验证"
    elif grep -q "并行复制内容" /tmp/openclawcn-build.log; then
        echo "  ▓▓▓▓░░░░░░ 40% - 正在复制文件"
    elif grep -q "并行编译" /tmp/openclawcn-build.log; then
        echo "  ▓▓░░░░░░░░ 20% - 正在编译"
    elif grep -q "前置检查" /tmp/openclawcn-build.log; then
        echo "  ▓░░░░░░░░░ 10% - 正在初始化"
    else
        echo "  ░░░░░░░░░░  0% - 准备中"
    fi
fi
echo ""

echo "════════════════════════════════════════════════════════════════"
echo "提示: 每 30 秒执行一次此脚本查看进度："
echo "  watch -n 30 ./check-build-progress.sh"
echo "════════════════════════════════════════════════════════════════"
