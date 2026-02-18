#!/bin/bash
# 按目录批量清理 Git 历史中的构建产物

echo "=== 开始清理 Git 历史（按目录删除）==="
echo "开始时间: $(date '+%Y-%m-%d %H:%M:%S')"

# 要删除的目录和文件模式列表
PATHS_TO_REMOVE=(
    # 构建输出目录
    "build/"
    "dist/"

    # Rust/Tauri 构建目录
    "apps/desktop/src-tauri/target/"
    "apps/macos/Package.resolved"
    "scripts/windows/tauri-src/target/"
    "**/target/"

    # Node.js 相关
    "node_modules/"
    "extensions/*/node_modules/"
    "scripts/windows/node-portable/"
    "tools/"

    # 缓存目录
    ".cache/"
    ".serena/"

    # 备份文件
    "*.bak"

    # 大文件
    "build/pkg/win-x64/clawdbot.exe"
    "assets/60ad649637d6797ad09120d309408d4c.png"

    # CN pipeline 输出
    "cn/skills-mirror/"
    "cn/skills-qc/output*/"
    "cn/skills-publish/output*/"

    # 数据目录
    "data/"

    # Rust 编译产物
    "*.rlib"
    "*.rmeta"
    "*.lib"

    # Windows 构建产物
    "*.exe"
    "*.dmg"
    "*.app"
    "*.AppImage"
    "*.deb"
    "*.rpm"
    "*.tgz"

    # 打包产物
    "arm64-pkg/"
)

# 构建 git rm 命令
RM_COMMAND=""
for path in "${PATHS_TO_REMOVE[@]}"; do
    if [ -n "$RM_COMMAND" ]; then
        RM_COMMAND="$RM_COMMAND && "
    fi
    RM_COMMAND="${RM_COMMAND}git rm -rf --cached --ignore-unmatch '$path'"
done

echo "将删除以下路径模式:"
printf '%s\n' "${PATHS_TO_REMOVE[@]}" | sed 's/^/  - /'
echo ""
echo "执行 filter-branch..."

# 执行 filter-branch
git filter-branch --force --index-filter "$RM_COMMAND" \
    --prune-empty --tag-name-filter cat -- --all

echo ""
echo "=== Filter-branch 完成 ==="
echo "完成时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
echo "下一步:"
echo "1. 清理引用: git for-each-ref --format='delete %(refname)' refs/original | git update-ref --stdin"
echo "2. 过期 reflog: git reflog expire --expire=now --all"
echo "3. 垃圾回收: git gc --aggressive --prune=now"
echo "4. 检查大小: du -sh .git"
