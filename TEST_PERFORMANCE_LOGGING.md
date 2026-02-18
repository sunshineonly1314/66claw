# 性能日志测试指南

## 当前状态

✅ **性能追踪代码已编译并集成到系统中**

我已经验证:
- 性能追踪代码已成功编译到 `dist/gateway-cli-*.js`
- 代码包含 `startPerfTrace`, `recordPerfMeasurement`, `completePerfTrace` 等关键函数
- 服务上次运行时间: 2026-02-17 23:55 (根据日志)

## 测试步骤

### 方法 1: 通过 Web UI 测试 (推荐)

1. **启动服务** (如果未运行):
   ```bash
   cd d:/codeknowledge/clawdbot-main/clawdbot-main
   pnpm start
   ```

2. **打开 Web UI**:
   - 浏览器访问: `http://localhost:9339` (或配置的端口)

3. **发送测试消息**:
   - 在聊天框输入任意消息,例如: "你好"
   - 点击发送

4. **查看性能日志**:
   ```bash
   # 实时查看日志
   tail -f .gateway.log | grep -E "(perf-tracker|DEBUG-CHAT)"

   # 或者查看最近的性能日志
   grep "perf-tracker" .gateway.log | tail -50
   ```

### 方法 2: 通过 CLI 测试

1. **启动 gateway** (如果未运行):
   ```bash
   pnpm gateway
   ```

2. **在另一个终端发送消息**:
   ```bash
   # 使用 gateway RPC 发送消息
   curl -X POST http://localhost:9339/rpc \
     -H "Content-Type: application/json" \
     -d '{
       "method": "chat.send",
       "params": {
         "sessionKey": "test-session",
         "message": "测试性能追踪",
         "idempotencyKey": "test-'$(date +%s)'"
       }
     }'
   ```

3. **查看日志**:
   ```bash
   tail -100 .gateway.log | grep perf-tracker
   ```

## 预期输出

### 实时性能日志

应该看到类似这样的输出:

```
[perf-tracker] [a1b2c3d4] request_received: +0.50ms (total: 0.50ms)
[perf-tracker] [a1b2c3d4] agent_session_load: +5.23ms (total: 5.73ms)
[perf-tracker] [a1b2c3d4] dispatch_start: +0.15ms (total: 5.88ms)
[perf-tracker] [a1b2c3d4] dispatch_intent_classify: +12.45ms (total: 18.33ms)
[perf-tracker] [a1b2c3d4] agent_run_start: +8.67ms (total: 29.10ms)
[perf-tracker] [a1b2c3d4] agent_context_build: +15.32ms (total: 44.42ms)
[perf-tracker] [a1b2c3d4] agent_api_call_start: +1.20ms (total: 45.62ms) [{"provider":"anthropic","model":"claude-sonnet-4.5"}]
[perf-tracker] [a1b2c3d4] agent_run_complete: +1850.45ms (total: 1896.07ms)
[perf-tracker] [a1b2c3d4] agent_response_process: +3.21ms (total: 1899.28ms)
[perf-tracker] [a1b2c3d4] response_sent: +0.80ms (total: 1900.08ms)
```

### 性能总结报告

消息处理完成后,应该看到详细的性能总结:

```
========== Performance Trace Summary [a1b2c3d4] ==========
Total Time: 1900.08ms
Session: test-session

Phase Breakdown:
  agent         :  1874.64ms (98.7%)
  dispatch      :    14.70ms (0.8%)
  request       :     0.50ms (0.0%)

Slow Phases (>10ms):
  dispatch_intent_classify        :    12.45ms
  agent_context_build             :    15.32ms
  agent_run_complete              :  1850.45ms
==========================================================
```

## 如果看不到性能日志

### 检查清单

1. ✅ **服务是否正在运行?**
   ```bash
   ps aux | grep node | grep -v grep
   ```

2. ✅ **日志级别是否正确?**
   - 检查配置文件中的 `logLevel` 是否为 `info` 或 `debug`
   - 或设置环境变量: `export LOG_LEVEL=info`

3. ✅ **是否有实际的聊天请求?**
   - 确认已发送测试消息
   - 检查 `.gateway.log` 中是否有新的日志条目

4. ✅ **日志文件位置是否正确?**
   ```bash
   ls -lah .gateway.log
   ```

### 调试命令

```bash
# 查看最近1分钟的所有日志
tail -100 .gateway.log

# 查看是否有 DEBUG-CHAT 调试日志
grep "DEBUG-CHAT" .gateway.log | tail -20

# 查看是否有任何错误
grep -i "error\|warn" .gateway.log | tail -20

# 实时监控所有日志
tail -f .gateway.log
```

## 性能问题诊断

如果看到性能总结报告,可以根据以下规则快速诊断:

### 🐢 整体慢 (总耗时 >3秒)

查看 `agent_run_complete` 阶段:
- **如果占比 >95%**: LLM API 响应慢
  - 解决: 换更快的模型或检查网络

查看 `dispatch_intent_classify` 阶段:
- **如果耗时 >100ms**: 意图分类 LLM 慢
  - 解决: 在 `config/dispatch.json5` 中禁用或改用规则

查看 `agent_context_build` 阶段:
- **如果耗时 >200ms**: 会话历史太长
  - 解决: 启用 prompt caching 或 compaction

### 🐢 /new 新建窗口慢

查看 `agent_session_load` 阶段:
- **如果耗时 >100ms**: 会话初始化慢
  - 解决: 检查文件系统,重建工具索引

## 下一步

1. ✅ 运行测试,查看性能日志
2. ✅ 根据性能报告定位瓶颈
3. ✅ 参考 [PERFORMANCE_DEBUG_README.md](PERFORMANCE_DEBUG_README.md) 进行优化
4. ✅ 查看完整文档: [docs/performance-tracking.md](docs/performance-tracking.md)

---

**祝测试顺利!** 🚀

如有问题,请检查上述诊断步骤或查看完整文档。
