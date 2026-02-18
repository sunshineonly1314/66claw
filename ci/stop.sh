#!/usr/bin/env bash
###############################################################################
# 停止 CI/CD Webhook 服务器
###############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$SCRIPT_DIR/webhook-server.pid"

# 检查 PID 文件
if [ ! -f "$PID_FILE" ]; then
  echo "❌ Webhook server is not running (no PID file found)"
  exit 1
fi

PID=$(cat "$PID_FILE")

# 检查进程是否存在
if ! ps -p "$PID" > /dev/null 2>&1; then
  echo "⚠️  Process $PID is not running, removing stale PID file"
  rm -f "$PID_FILE"
  exit 0
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🛑 Stopping CI/CD Webhook Server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   PID: $PID"
echo ""

# 优雅停止
echo "Sending SIGTERM..."
kill -TERM "$PID"

# 等待进程退出
for i in {1..10}; do
  if ! ps -p "$PID" > /dev/null 2>&1; then
    echo "✅ Webhook server stopped successfully"
    rm -f "$PID_FILE"
    exit 0
  fi
  sleep 1
done

# 强制停止
echo "⚠️  Process still running, sending SIGKILL..."
kill -KILL "$PID" 2>/dev/null || true
rm -f "$PID_FILE"

echo "✅ Webhook server stopped (forcefully)"
