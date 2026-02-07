#!/bin/bash
# ========================================
# 检查 GitHub Release 文件名格式
# 用于确认 tools_config.json 中的 assetPattern
# ========================================

echo "========================================"
echo "  检查 13 个工具的 Release 文件名格式"
echo "========================================"
echo ""

# 工具列表
repos=(
    "steipete/ordercli"
    "steipete/peekaboo"
    "steipete/remindctl"
    "antoniorodr/memo"
    "steipete/imsg"
    "steipete/camsnap"
    "steipete/gifgrep"
    "steipete/wacli"
    "steipete/sag"
    "steipete/songsee"
    "steipete/gogcli"
    "steipete/spogo"
    "steipete/summarize"
)

# 检查 jq 是否安装
if ! command -v jq &> /dev/null; then
    echo "❌ 需要安装 jq: sudo apt install jq 或 brew install jq"
    exit 1
fi

# 检查每个仓库
for repo in "${repos[@]}"; do
    name=$(basename "$repo")
    echo "=== $repo ==="
    
    # 获取 Release 信息
    response=$(curl -s "https://api.github.com/repos/$repo/releases/latest")
    
    # 检查是否有 Release
    if echo "$response" | jq -e '.message' &>/dev/null; then
        message=$(echo "$response" | jq -r '.message')
        echo "  ⚠️ 无 Release 或错误: $message"
        echo ""
        continue
    fi
    
    # 显示版本和文件
    tag=$(echo "$response" | jq -r '.tag_name')
    echo "  版本: $tag"
    echo "  文件列表:"
    echo "$response" | jq -r '.assets[].name' | while read -r asset; do
        echo "    - $asset"
    done
    echo ""
done

echo "========================================"
echo "  检查完成"
echo ""
echo "请根据上面的实际文件名，更新 tools_config.json 中的:"
echo "  - assetPattern: 文件名模式"
echo "  - platformMapping: 平台名映射"
echo "========================================"
