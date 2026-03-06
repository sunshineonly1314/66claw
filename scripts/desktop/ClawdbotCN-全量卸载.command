#!/bin/bash
#
# macOS 双击运行的全量卸载入口
# 在 Finder 中双击此 .command 文件即可运行
#

# 切换到脚本所在目录
cd "$(dirname "$0")"

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║         ClawdbotCN 全量卸载工具 (Full Uninstall)         ║"
echo "╠═══════════════════════════════════════════════════════════╣"
echo "║                                                           ║"
echo "║  此工具将彻底清除 ClawdbotCN 的所有安装痕迹：            ║"
echo "║    - /Applications 下的 App Bundle                        ║"
echo "║    - 用户数据、配置文件、会话记录                         ║"
echo "║    - ~/Library 下的缓存、日志、偏好设置                   ║"
echo "║    - launchd 服务                                         ║"
echo "║    - 临时文件                                             ║"
echo "║                                                           ║"
echo "║  清除后下次安装将是全新环境，无历史残留。                 ║"
echo "║                                                           ║"
echo "║  !! 警告: 操作不可恢复！请确认后再继续。                  ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

echo "请选择操作："
echo ""
echo "  [1] 全量卸载 - 删除所有数据（全新环境）"
echo "  [2] 普通卸载 - 保留用户数据（保留配置/会话）"
echo "  [3] 预览模式 - 只看不删，先确认会删什么"
echo "  [4] 取消退出"
echo ""

printf "请输入选项 (1/2/3/4): "
read -r choice

case "$choice" in
    1)
        echo ""
        echo "即将执行全量卸载..."
        echo ""
        bash ./full-uninstall.sh
        ;;
    2)
        echo ""
        echo "即将执行普通卸载（保留用户数据）..."
        echo ""
        bash ./full-uninstall.sh --keep-data
        ;;
    3)
        echo ""
        echo "正在预览将要删除的内容..."
        echo ""
        bash ./full-uninstall.sh --dry-run --force
        ;;
    4)
        echo ""
        echo "已取消。"
        ;;
    *)
        echo "无效选项。"
        ;;
esac

echo ""
echo "────────────────────────────────────────────────────────────"
echo "按 Enter 键关闭窗口..."
read -r
