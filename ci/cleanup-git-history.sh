#!/usr/bin/env bash
###############################################################################
# Git 仓库历史清理脚本
# 删除大文件并压缩仓库
###############################################################################

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧹 清理 Git 仓库历史"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cd "$(dirname "$0")/.."

echo "📊 清理前仓库大小:"
du -sh .git

echo ""
echo "🗑️  删除大文件历史记录..."

# 删除特定的大文件
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch build/pkg/win-x64/clawdbot.exe assets/60ad649637d6797ad09120d309408d4c.png' \
  --prune-empty --tag-name-filter cat -- --all 2>&1 | grep -v "is not a valid attribute" || true

echo ""
echo "🧹 清理引用..."
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo ""
echo "📊 清理后仓库大小:"
du -sh .git

echo ""
echo "✅ Git 历史清理完成!"
echo ""
echo "⚠️  下一步: 需要强制推送到 Gitee"
echo "    git push gitee master --force"
