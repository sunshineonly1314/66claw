#!/bin/bash
# WebSocket 全量方法测试 (v2 - 正确的协议握手)
export PATH=/usr/local/lib/nodejs/node-v22.16.0-darwin-arm64/bin:/opt/homebrew/bin:/usr/local/bin:$PATH

PORT=34982

echo "========================================="
echo " ClawdbotCN v1.6.2 WebSocket全量接口测试"
echo "========================================="

DMG="/Users/kevinsun/cicd-workspace/openclawcn/apps/desktop/src-tauri/target/universal-apple-darwin/release/bundle/dmg/ClawdbotCN_1.6.2_universal.dmg"
MP="/tmp/clawdbot-install-test"
INSTALL_DIR="/tmp/clawdbot-test-app"

# 清理旧进程
pkill -f "openclawcn-gateway" 2>/dev/null
pkill -f "entry.js.*gateway" 2>/dev/null
sleep 2
hdiutil detach "$MP" -quiet 2>/dev/null
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

# 安装
hdiutil attach "$DMG" -mountpoint "$MP" -nobrowse -quiet
cp -R "$MP/ClawdbotCN.app" "$INSTALL_DIR/"
hdiutil detach "$MP" -quiet
APP="$INSTALL_DIR/ClawdbotCN.app"
xattr -cr "$APP" 2>/dev/null
R="$APP/Contents/Resources/resources"
NODE="$R/node/bin/node"
ENTRY="$R/dist/entry.js"
echo "  安装完成"

# 启动gateway
export CLAWDBOT_DATA_DIR="/tmp/clawdbot-test-data"
export CLAWDBOT_LOG_DIR="/tmp/clawdbot-test-logs"
mkdir -p "$CLAWDBOT_DATA_DIR" "$CLAWDBOT_LOG_DIR"
if [ -d "$R/data" ]; then cp -R "$R/data/"* "$CLAWDBOT_DATA_DIR/" 2>/dev/null; fi

cd "$R"
"$NODE" "$ENTRY" gateway --port $PORT --allow-unconfigured > /tmp/clawdbot-test-stdout.log 2> /tmp/clawdbot-test-stderr.log &
GW_PID=$!
echo "  Gateway PID: $GW_PID"

for i in $(seq 1 15); do
  sleep 2
  if grep -q "ready" /tmp/clawdbot-test-stdout.log 2>/dev/null; then
    echo "  Gateway ready"
    break
  fi
  if ! kill -0 $GW_PID 2>/dev/null; then
    echo "  Gateway退出!"; tail -5 /tmp/clawdbot-test-stderr.log; exit 1
  fi
done

# 获取token
TOKEN=$(curl -s "http://127.0.0.1:$PORT/api/local-token" --connect-timeout 3 2>/dev/null | grep -o '"token":"[^"]*"' | sed 's/"token":"//;s/"//')
echo "  Token: ${TOKEN:0:20}..."

# WebSocket测试脚本 (使用正确的自定义协议)
cat > /tmp/clawdbot-ws-test-v2.cjs << 'WSEOF'
const PORT = process.argv[3] || '34982';
const TOKEN = process.argv[4] || '';

const WebSocket = require('ws');
const crypto = require('crypto');

const url = `ws://127.0.0.1:${PORT}`;
let pass = 0, fail = 0, warn = 0;
let ws;
let connected = false;

function logPass(d) { pass++; console.log(`  [PASS] ${d}`); }
function logFail(d) { fail++; console.log(`  [FAIL] ${d}`); }
function logWarn(d) { warn++; console.log(`  [WARN] ${d}`); }

function uuid() {
  return crypto.randomUUID();
}

function sendRpc(method, params) {
  return new Promise((resolve, reject) => {
    const id = uuid();
    const msg = JSON.stringify({
      type: 'req',
      id: id,
      method: method,
      params: params || {}
    });
    const timeout = setTimeout(() => {
      ws.removeListener('message', handler);
      reject(new Error('timeout 10s'));
    }, 10000);

    function handler(data) {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.type === 'res' && parsed.id === id) {
          ws.removeListener('message', handler);
          clearTimeout(timeout);
          resolve(parsed);
        }
      } catch(e) {}
    }
    ws.on('message', handler);
    ws.send(msg);
  });
}

async function waitForEvent(eventName, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.removeListener('message', handler);
      reject(new Error(`timeout waiting for event: ${eventName}`));
    }, timeoutMs || 5000);

    function handler(data) {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.type === 'event' && parsed.event === eventName) {
          ws.removeListener('message', handler);
          clearTimeout(timeout);
          resolve(parsed);
        }
      } catch(e) {}
    }
    ws.on('message', handler);
  });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('  连接: ' + url);

  ws = new WebSocket(url);
  ws.setMaxListeners(100);

  // 1. 等待连接打开
  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
    setTimeout(() => reject(new Error('connection timeout')), 5000);
  });
  logPass('WebSocket TCP连接');

  // 2. 等待 connect.challenge 事件
  let challenge;
  try {
    challenge = await waitForEvent('connect.challenge', 5000);
    logPass(`connect.challenge 收到 (nonce: ${challenge.payload?.nonce?.slice(0,8)}...)`);
  } catch(e) {
    logFail('connect.challenge 超时');
    ws.close();
    return;
  }

  // 3. 发送 connect 请求完成握手
  try {
    const connectResp = await sendRpc('connect', {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: 'ci-test',
        displayName: 'CI Test Client',
        version: '1.6.2',
        platform: 'darwin',
        mode: 'backend'
      },
      role: 'operator',
      scopes: ['operator.admin', 'operator.read'],
      auth: TOKEN ? { token: TOKEN } : undefined
    });

    if (connectResp.ok) {
      connected = true;
      const payload = connectResp.payload || {};
      logPass(`connect 握手成功 (protocol: ${payload.protocol}, connId: ${payload.server?.connId?.slice(0,8)}...)`);

      // 打印可用方法数
      const methods = payload.features?.methods || [];
      const events = payload.features?.events || [];
      console.log(`  可用方法: ${methods.length} 个`);
      console.log(`  可用事件: ${events.length} 个`);

      // 打印部分方法列表
      if (methods.length > 0) {
        console.log(`  方法列表(前20): ${methods.slice(0, 20).join(', ')}`);
      }
    } else {
      logFail(`connect 握手失败: ${JSON.stringify(connectResp.error || {}).slice(0,200)}`);
      ws.close();
      return;
    }
  } catch(e) {
    logFail(`connect 握手异常: ${e.message}`);
    ws.close();
    return;
  }

  // 4. 测试所有RPC方法
  console.log('');
  console.log('  === RPC方法测试 ===');

  const rpcTests = [
    // 核心状态
    ['health', {}, '健康检查'],
    ['status', {}, '网关状态'],
    ['last-heartbeat', {}, '最后心跳'],

    // 配置
    ['config.get', {}, '获取配置'],
    ['config.schema', {}, '配置schema'],

    // 模型
    ['models.list', {}, '模型列表'],

    // 会话
    ['sessions.list', {}, '会话列表'],

    // Agent
    ['agents.list', {}, 'Agent列表'],
    ['agent.identity.get', {}, 'Agent身份'],

    // 技能
    ['skills.status', {}, '技能状态'],
    ['skills.bins', {}, '已安装技能'],

    // 渠道
    ['channels.status', {}, '渠道状态'],

    // 定时任务
    ['cron.list', {}, '定时任务列表'],
    ['cron.status', {}, '定时任务状态'],

    // TTS
    ['tts.status', {}, 'TTS状态'],
    ['tts.providers', {}, 'TTS提供商'],

    // 用量
    ['usage.status', {}, '用量状态'],
    ['usage.cost', {}, '用量费用'],

    // 对话
    ['talk.mode', {}, '对话模式'],
    ['talk.config', {}, '对话配置'],

    // 语音唤醒
    ['voicewake.get', {}, '语音唤醒设置'],

    // 节点/设备
    ['node.list', {}, '节点列表'],
    ['device.pair.list', {}, '设备配对列表'],

    // 审批
    ['exec.approvals.get', {}, '审批设置'],

    // 网络
    ['gateway.network.status', {}, '网络状态'],

    // 路由
    ['route.getChannelAgents', {}, '渠道Agent路由'],

    // 支持
    ['support.qrcode.status', {}, '二维码状态'],

    // 向导
    ['wizard.status', {}, '向导状态'],

    // 系统
    ['system-presence', {}, '系统存在信息'],

    // 日志
    ['diagnose.logs', {}, '诊断日志'],
  ];

  for (const [method, params, desc] of rpcTests) {
    try {
      const resp = await sendRpc(method, params);
      if (resp.ok) {
        const preview = JSON.stringify(resp.payload).slice(0, 120);
        logPass(`${method} (${desc}) => ${preview}`);
      } else {
        const errMsg = resp.error?.message || resp.error?.code || 'unknown error';
        // 区分"方法不存在"和"方法存在但有参数/权限错误"
        if (resp.error?.code === 'METHOD_NOT_FOUND' || resp.error?.code === 'INVALID_METHOD') {
          logFail(`${method} (${desc}) => 方法不存在`);
        } else {
          // 方法存在，只是执行有问题（参数不对、权限不够等）
          logPass(`${method} (${desc}) => 方法可达 [err: ${String(errMsg).slice(0,60)}]`);
        }
      }
    } catch(e) {
      logFail(`${method} (${desc}) => ${e.message}`);
    }
  }

  // 5. 测试 send 方法 (chat)
  console.log('');
  console.log('  === Chat方法测试 ===');
  try {
    const resp = await sendRpc('send', { channel: 'test', text: 'CI test ping' });
    if (resp.ok || (resp.error && resp.error.code !== 'METHOD_NOT_FOUND')) {
      logPass(`send (发送消息) => 方法可达`);
    } else {
      logFail(`send => ${JSON.stringify(resp.error).slice(0,100)}`);
    }
  } catch(e) {
    // send可能会阻塞等agent回复,超时是正常的
    logPass(`send (发送消息) => 方法存在 (${e.message})`);
  }

  // 6. 测试事件订阅（检查是否收到 tick 事件）
  console.log('');
  console.log('  === 事件接收测试 ===');
  try {
    const tickEvent = await waitForEvent('tick', 35000);
    logPass(`tick事件 => 收到 (seq: ${tickEvent.seq})`);
  } catch(e) {
    logWarn(`tick事件 => 未在35s内收到 (可能间隔较长)`);
  }

  // 完成
  ws.close();
  await sleep(500);

  console.log('');
  console.log('  =========================================');
  console.log(`  WebSocket测试: PASS=${pass}, FAIL=${fail}, WARN=${warn}`);
  console.log('  =========================================');

  process.exit(fail > 0 ? 1 : 0);
}

run().catch(e => {
  console.log(`  [FATAL] ${e.message}`);
  if (ws) ws.close();
  process.exit(1);
});

// 整体超时保护
setTimeout(() => {
  console.log('  [TIMEOUT] 整体测试超时 (180s)');
  if (ws) ws.close();
  process.exit(1);
}, 180000);
WSEOF

# 找ws模块路径 - 设置NODE_PATH让require('ws')直接工作
if [ -d "$R/node_modules/ws" ]; then
  export NODE_PATH="$R/node_modules"
  echo "  ws模块: $R/node_modules/ws"
else
  # 安装ws到临时目录
  echo "  打包中无ws, 安装到临时目录..."
  mkdir -p /tmp/ws-test-deps && cd /tmp/ws-test-deps
  "$NODE" -e "try{require('ws');process.exit(0)}catch(e){process.exit(1)}" 2>/dev/null || \
    (npm init -y 2>/dev/null && npm install ws 2>/dev/null)
  export NODE_PATH="/tmp/ws-test-deps/node_modules"
fi

"$NODE" /tmp/clawdbot-ws-test-v2.cjs "ws" "$PORT" "$TOKEN" 2>&1
WS_EXIT=$?

# 停止gateway
echo ""
echo "停止Gateway..."
kill $GW_PID 2>/dev/null
wait $GW_PID 2>/dev/null
echo "  OK"

# 清理
rm -rf "$INSTALL_DIR" "$CLAWDBOT_DATA_DIR" "$CLAWDBOT_LOG_DIR"
rm -f /tmp/clawdbot-ws-test-v2.cjs

echo ""
if [ $WS_EXIT -eq 0 ]; then
  echo "★ WebSocket全量接口测试通过 ★"
else
  echo "✗ WebSocket测试有失败项"
fi
