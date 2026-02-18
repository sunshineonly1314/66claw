# 🔍 聊天卡顿问题调试指南

## 📋 调试日志已添加位置

### 后端日志（11个关键点）

已在 `src/gateway/server-methods/chat.ts` 添加以下调试日志：

1. **日志1**: `chat.send` 请求开始 - Line ~493
2. **日志2**: 发送 ACK 响应给前端 - Line ~507
3. **日志3**: 开始调用 `dispatchInboundMessage` - Line ~568
4. **日志4**: Agent 运行已启动 - Line ~578
5. **日志5**: `dispatchInboundMessage` 执行完成 - Line ~606
6. **日志6**: 广播 `final` 消息 - Line ~646
7. **日志7**: `dispatchInboundMessage` 捕获到错误 - Line ~670
8. **日志8**: 广播错误消息 - Line ~683
9. **日志9**: `finally` 块执行，清理资源 - Line ~693
10. **日志10**: 外层 `try-catch` 捕获到同步错误 - Line ~697
11. **日志11**: 发送错误响应给前端 - Line ~715

### 前端日志（4个关键点）

已在 `ui/src/ui/controllers/chat.ts` 添加以下调试日志：

1. **前端日志1**: 开始发送 `chat.send` 请求 - Line ~124
2. **前端日志2**: `chat.send` 请求成功响应 - Line ~136
3. **前端日志3**: `chat.send` 请求失败 - Line ~145
4. **前端日志4**: 收到 `chat` 事件 - Line ~193

---

## 🧪 测试步骤

### 步骤1：启动服务（开启详细日志）

```bash
# 设置日志级别为 debug
export LOG_LEVEL=debug

# 启动后端服务
npm run dev

# 或者如果使用 PM2
pm2 restart all && pm2 logs --lines 100
```

### 步骤2：打开浏览器控制台

1. 打开浏览器（Chrome/Edge/Firefox）
2. 按 `F12` 打开开发者工具
3. 切换到 **Console** 标签
4. 清空之前的日志（点击 🚫 图标）

### 步骤3：输入"哈哈"并观察日志

在聊天界面输入 `哈哈` 并发送，然后：

**A. 浏览器控制台（Console）查看：**
```
应该看到：
[DEBUG-CHAT-FRONTEND] Sending chat.send request: {...}
[DEBUG-CHAT-FRONTEND] chat.send request SUCCESS: {...}  ← 如果卡住，这条不会出现
[DEBUG-CHAT-FRONTEND] Received chat event: {...}        ← 如果卡住，这条不会出现
```

**B. 后端日志查看：**
```bash
# 实时查看后端日志
tail -f logs/gateway.log  # 或者你的日志文件路径

# 或者使用 grep 过滤
tail -f logs/gateway.log | grep "DEBUG-CHAT"
```

应该看到：
```
[DEBUG-CHAT] chat.send START: runId=xxx, sessionKey=xxx, message="哈哈"
[DEBUG-CHAT] Sending ACK to client: runId=xxx, status=started
[DEBUG-CHAT] About to call dispatchInboundMessage: runId=xxx, ...
[DEBUG-CHAT] Agent run started: agentRunId=xxx, ...                    ← 如果卡住，这条可能不出现
[DEBUG-CHAT] dispatchInboundMessage COMPLETED: runId=xxx, ...         ← 如果卡住，这条不会出现
[DEBUG-CHAT] Broadcasting chat FINAL: runId=xxx, ...                   ← 如果卡住，这条不会出现
```

---

## 🔍 问题定位矩阵

根据日志输出，定位问题：

| 看到的日志 | 没看到的日志 | 问题定位 | 可能原因 |
|-----------|-------------|---------|---------|
| ✅ 前端日志1 | ❌ 前端日志2 | **WebSocket 请求无响应** | 1. 网络断开<br>2. 后端未启动<br>3. WebSocket 连接失败 |
| ✅ 后端日志1-3 | ❌ 后端日志4 | **Agent 未启动** | 1. API Key 未配置<br>2. License 验证失败<br>3. Agent 初始化错误 |
| ✅ 后端日志1-4 | ❌ 后端日志5 | **Agent 执行阻塞** | 1. API 超时<br>2. 模型不可用<br>3. 网络问题 |
| ✅ 后端日志5 | ❌ 后端日志6 | **广播机制失败** | 1. WebSocket 连接断开<br>2. 广播逻辑错误 |
| ✅ 后端日志7-8 | ❌ 前端日志4 | **前端未收到错误事件** | 1. WebSocket 事件丢失<br>2. runId 不匹配 |
| ✅ 后端日志10-11 | ❌ 任何 | **同步错误被捕获** | 1. 配置错误<br>2. 授权检查失败 |

---

## 📊 日志分析示例

### 场景1：正常流程

```
✅ [DEBUG-CHAT-FRONTEND] Sending chat.send request: {runId: "abc-123", ...}
✅ [DEBUG-CHAT] chat.send START: runId=abc-123, message="哈哈"
✅ [DEBUG-CHAT] Sending ACK to client: runId=abc-123
✅ [DEBUG-CHAT-FRONTEND] chat.send request SUCCESS: {runId: "abc-123"}
✅ [DEBUG-CHAT] About to call dispatchInboundMessage: runId=abc-123
✅ [DEBUG-CHAT] Agent run started: agentRunId=xyz-789
✅ [DEBUG-CHAT-FRONTEND] Received chat event: {state: "delta", ...}
✅ [DEBUG-CHAT] dispatchInboundMessage COMPLETED: runId=abc-123
✅ [DEBUG-CHAT] Broadcasting chat FINAL: runId=abc-123
✅ [DEBUG-CHAT-FRONTEND] Received chat event: {state: "final", ...}
```

### 场景2：Agent 执行阻塞（最可能）

```
✅ [DEBUG-CHAT-FRONTEND] Sending chat.send request: {runId: "abc-123", ...}
✅ [DEBUG-CHAT] chat.send START: runId=abc-123, message="哈哈"
✅ [DEBUG-CHAT] Sending ACK to client: runId=abc-123
✅ [DEBUG-CHAT-FRONTEND] chat.send request SUCCESS: {runId: "abc-123"}
✅ [DEBUG-CHAT] About to call dispatchInboundMessage: runId=abc-123
✅ [DEBUG-CHAT] Agent run started: agentRunId=xyz-789
❌ 之后无任何日志 → Agent 执行卡住，可能原因：
   - Anthropic API 超时
   - 网络问题
   - API Key 无效
```

### 场景3：License 验证失败

```
✅ [DEBUG-CHAT-FRONTEND] Sending chat.send request: {runId: "abc-123", ...}
✅ [DEBUG-CHAT] chat.send START: runId=abc-123, message="哈哈"
✅ [DEBUG-CHAT] Sending ACK to client: runId=abc-123
✅ [DEBUG-CHAT-FRONTEND] chat.send request SUCCESS: {runId: "abc-123"}
✅ [DEBUG-CHAT] About to call dispatchInboundMessage: runId=abc-123
❌ [DEBUG-CHAT] Agent run started (这条没出现)
✅ [DEBUG-CHAT] dispatchInboundMessage COMPLETED: agentRunStarted=false
✅ [DEBUG-CHAT] Broadcasting chat FINAL: combinedReplyLength=0
→ 没有启动 Agent，可能是授权失败
```

---

## 🛠️ 下一步操作

### 1. 收集完整日志

输入"哈哈"后，收集以下信息：

**A. 浏览器控制台截图**
- 包含所有 `[DEBUG-CHAT-FRONTEND]` 日志

**B. 后端日志**
```bash
# 导出最近 100 行日志
tail -n 100 logs/gateway.log > chat-stuck-backend.log

# 或者只导出 DEBUG-CHAT 相关
grep "DEBUG-CHAT" logs/gateway.log > chat-stuck-debug.log
```

### 2. 检查 WebSocket 连接

**F12 → Network → WS 标签**：
1. 找到 WebSocket 连接
2. 点击 **Messages** 标签
3. 查找 `chat.send` 请求和响应
4. 截图保存

### 3. 检查配置

```bash
# 检查 API Key 是否配置
cat config.json5 | grep -E "anthropic|apiKey|license" | head -10

# 检查环境变量
env | grep -E "ANTHROPIC|API_KEY|LICENSE"
```

---

## 📞 提供调试信息

请提供以下内容：

1. ✅ 浏览器控制台截图（包含所有 DEBUG-CHAT-FRONTEND 日志）
2. ✅ 后端日志文件（chat-stuck-backend.log）
3. ✅ WebSocket 消息截图（F12 → Network → WS → Messages）
4. ✅ 系统配置（隐藏敏感信息）

有了这些信息，我可以精确定位问题根因！

---

## 🔄 如何移除调试日志

测试完成后，可以运行：

```bash
# 回退到之前的版本
git checkout src/gateway/server-methods/chat.ts
git checkout ui/src/ui/controllers/chat.ts

# 或者删除所有包含 DEBUG-CHAT 的行
sed -i '/DEBUG-CHAT/d' src/gateway/server-methods/chat.ts
sed -i '/DEBUG-CHAT/d' ui/src/ui/controllers/chat.ts
```
