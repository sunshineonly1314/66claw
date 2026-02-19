#!/usr/bin/env bash
###############################################################################
# Gitee SSH 公钥添加助手
# 帮助您快速添加 SSH 公钥到 Gitee
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/config.json"

# Convert path for Windows if needed
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
  CONFIG_FILE_WIN=$(cygpath -w "$CONFIG_FILE" 2>/dev/null || echo "$CONFIG_FILE")
else
  CONFIG_FILE_WIN="$CONFIG_FILE"
fi

# 从 config.json 读取构建机信息（避免硬编码 IP）
WIN_HOST=$(node -p "require('$CONFIG_FILE_WIN').builders.windows.host")
WIN_USER=$(node -p "require('$CONFIG_FILE_WIN').builders.windows.user")
MAC_HOST=$(node -p "require('$CONFIG_FILE_WIN').builders.macos.host")
MAC_USER=$(node -p "require('$CONFIG_FILE_WIN').builders.macos.user")

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Gitee SSH 公钥添加助手"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "需要添加以下 2 个 SSH 公钥到 Gitee："
echo ""

# Windows 公钥
echo "1. Windows 构建机 SSH 公钥"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
WIN_KEY=$(ssh "$WIN_USER@$WIN_HOST" "type %USERPROFILE%\.ssh\id_ed25519.pub" 2>/dev/null)
if [ -n "$WIN_KEY" ]; then
  echo "标题: ClawdbotCN-Windows-CI ($WIN_HOST)"
  echo ""
  echo "公钥:"
  echo "$WIN_KEY"
else
  echo "无法读取 Windows SSH 公钥"
fi
echo ""
echo ""

# macOS 公钥
echo "2. macOS 构建机 SSH 公钥"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
MAC_KEY=$(ssh "$MAC_USER@$MAC_HOST" "cat ~/.ssh/id_ed25519.pub" 2>/dev/null)
if [ -n "$MAC_KEY" ]; then
  echo "标题: ClawdbotCN-macOS-CI ($MAC_HOST)"
  echo ""
  echo "公钥:"
  echo "$MAC_KEY"
else
  echo "无法读取 macOS SSH 公钥"
fi
echo ""
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "操作步骤："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. 正在为您打开 Gitee SSH 公钥管理页面..."
echo "   URL: https://gitee.com/profile/sshkeys"
echo ""
echo "2. 在 Gitee 页面点击【添加公钥】按钮"
echo ""
echo "3. 复制上面的公钥内容，分别添加："
echo ""
echo "   第一个公钥："
echo "   - 标题: ClawdbotCN-Windows-CI ($WIN_HOST)"
echo "   - 公钥: 复制上面 Windows 公钥的完整内容"
echo ""
echo "   第二个公钥："
echo "   - 标题: ClawdbotCN-macOS-CI ($MAC_HOST)"
echo "   - 公钥: 复制上面 macOS 公钥的完整内容"
echo ""
echo "4. 添加完成后，按回车继续验证..."
read -p ""

echo ""
echo "正在测试 SSH 连接..."
echo ""

# 测试 Windows
echo -n "测试 Windows 构建机... "
if ssh "$WIN_USER@$WIN_HOST" "ssh -T git@gitee.com" 2>&1 | grep -q "successfully authenticated"; then
  echo "成功"
else
  echo "失败（请检查公钥是否正确添加）"
fi

# 测试 macOS
echo -n "测试 macOS 构建机... "
if ssh "$MAC_USER@$MAC_HOST" "ssh -T git@gitee.com" 2>&1 | grep -q "successfully authenticated"; then
  echo "成功"
else
  echo "失败（请检查公钥是否正确添加）"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "配置完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "下一步："
echo "  1. 更新 ci/config.json 中的 Gitee 仓库地址"
echo "  2. 运行 'bash start.sh' 启动 Webhook 服务器"
echo ""

# 在 Windows 上打开浏览器
if command -v cmd.exe &> /dev/null; then
  echo "正在打开 Gitee SSH 公钥页面..."
  cmd.exe /c start https://gitee.com/profile/sshkeys 2>/dev/null || true
fi
