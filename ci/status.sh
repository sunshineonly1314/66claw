#!/usr/bin/env bash
###############################################################################
# 查看 CI/CD Webhook 服务器状态
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/webhook-server.pid"
CONFIG_FILE="$SCRIPT_DIR/config.json"

# Convert path for Windows if needed
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
  CONFIG_FILE_WIN=$(cygpath -w "$CONFIG_FILE" 2>/dev/null || echo "$CONFIG_FILE")
else
  CONFIG_FILE_WIN="$CONFIG_FILE"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 CI/CD Webhook Server Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 检查服务器状态
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if ps -p "$PID" > /dev/null 2>&1; then
    UPTIME=$(ps -p "$PID" -o etime= | tr -d ' ')
    echo "✅ Server Status:  RUNNING"
    echo "   PID:           $PID"
    echo "   Uptime:        $UPTIME"
  else
    echo "❌ Server Status:  STOPPED (stale PID file)"
  fi
else
  echo "❌ Server Status:  STOPPED"
fi

echo ""

# 显示配置
if [ -f "$CONFIG_FILE" ]; then
  PORT=$(node -p "require('$CONFIG_FILE_WIN').webhook.port" 2>/dev/null || echo "8888")
  WIN_HOST=$(node -p "require('$CONFIG_FILE_WIN').builders.windows.host" 2>/dev/null || echo "192.168.0.103")
  WIN_USER=$(node -p "require('$CONFIG_FILE_WIN').builders.windows.user" 2>/dev/null || echo "SunBin")
  MAC_HOST=$(node -p "require('$CONFIG_FILE_WIN').builders.macos.host" 2>/dev/null || echo "192.168.0.107")
  MAC_USER=$(node -p "require('$CONFIG_FILE_WIN').builders.macos.user" 2>/dev/null || echo "kevinsun")

  echo "🔧 Configuration:"
  echo "   Webhook Port:  $PORT"
  echo "   Windows:       $WIN_USER@$WIN_HOST"
  echo "   macOS:         $MAC_USER@$MAC_HOST"
fi

echo ""

# SSH 连接测试
echo "🔌 SSH Connections:"
if ssh -o ConnectTimeout=2 -o BatchMode=yes $WIN_USER@$WIN_HOST "exit" 2>/dev/null; then
  echo "   Windows:       ✅ Connected"
else
  echo "   Windows:       ❌ Not reachable"
fi

if ssh -o ConnectTimeout=2 -o BatchMode=yes $MAC_USER@$MAC_HOST "exit" 2>/dev/null; then
  echo "   macOS:         ✅ Connected"
else
  echo "   macOS:         ❌ Not reachable"
fi

echo ""

# 最近的日志
echo "📋 Recent Logs:"
if [ -f "$SCRIPT_DIR/logs/webhook-server.log" ]; then
  tail -5 "$SCRIPT_DIR/logs/webhook-server.log" | sed 's/^/   /'
else
  echo "   No logs available"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
