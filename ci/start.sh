#!/usr/bin/env bash
###############################################################################
# 启动 CI/CD Webhook 服务器
###############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PID_FILE="$SCRIPT_DIR/webhook-server.pid"
LOG_FILE="$SCRIPT_DIR/logs/webhook-server.log"

# 检查是否已经在运行
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if ps -p "$PID" > /dev/null 2>&1; then
    echo "❌ Webhook server is already running (PID: $PID)"
    exit 1
  else
    echo "⚠️  Removing stale PID file"
    rm -f "$PID_FILE"
  fi
fi

# 检查依赖
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# 创建日志目录
mkdir -p logs

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Starting CI/CD Webhook Server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 启动服务器
nohup node webhook-server.js >> "$LOG_FILE" 2>&1 &
PID=$!

# 保存 PID
echo $PID > "$PID_FILE"

# 等待启动
sleep 2

# 检查是否成功启动
if ps -p "$PID" > /dev/null 2>&1; then
  PORT=$(node -p "require('./config.json').webhook.port")
  echo "✅ Webhook server started successfully!"
  echo ""
  echo "   PID:          $PID"
  echo "   Port:         $PORT"
  echo "   Log file:     $LOG_FILE"
  echo "   Status page:  http://localhost:$PORT/status"
  echo "   Health check: http://localhost:$PORT/health"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "💡 Useful commands:"
  echo "   View logs:    tail -f $LOG_FILE"
  echo "   Stop server:  bash stop.sh"
  echo ""
else
  echo "❌ Failed to start webhook server"
  rm -f "$PID_FILE"
  exit 1
fi
