# 🚀 OpenClawCN 性能调试快速指南

## 📋 问题

聊天交互慢?新建窗口慢?让我们快速找出瓶颈!

## ✅ 已实现的性能追踪系统

我们已经为你添加了完整的性能追踪系统,能够精确测量聊天流程每个阶段的耗时。

## 🎯 快速开始

### 1. 启动服务并查看日志

```bash
# 启动服务 (如果未启动)
pnpm start

# 或者查看现有日志
tail -f logs/openclaw.log | grep perf-tracker
```

### 2. 发送一条测试消息

通过 UI 或命令行发送任意聊天消息。

### 3. 查看性能输出

日志中会自动显示详细的性能追踪信息:

```
[perf-tracker] [a1b2c3d4] request_received: +0.50ms (total: 0.50ms)
[perf-tracker] [a1b2c3d4] agent_session_load: +5.23ms (total: 5.73ms)
[perf-tracker] [a1b2c3d4] dispatch_start: +0.15ms (total: 5.88ms)
[perf-tracker] [a1b2c3d4] agent_run_start: +8.67ms (total: 29.10ms)
[perf-tracker] [a1b2c3d4] agent_api_call_start: +1.20ms (total: 45.62ms)
[perf-tracker] [a1b2c3d4] agent_run_complete: +1850.45ms (total: 1896.07ms)

========== Performance Trace Summary [a1b2c3d4] ==========
Total Time: 1900.08ms
Session: main-123456

Phase Breakdown:
  agent         :  1874.64ms (98.7%)  ← 主要耗时在这里!
  dispatch      :    14.70ms (0.8%)
  request       :     0.50ms (0.0%)

Slow Phases (>10ms):
  agent_run_complete              :  1850.45ms  ← 这是瓶颈!
==========================================================
```

## 🔍 快速诊断

### 场景 1: `agent_run_complete` 耗时长 (>1000ms)

**原因**: LLM API 响应慢

**解决方案**:
1. 检查网络连接
2. 切换更快的模型 (如 claude-haiku-4.5)
3. 检查 API key 配额

### 场景 2: `dispatch_intent_classify` 耗时长 (>50ms)

**原因**: 意图分类使用了 LLM,每次请求都要调用

**解决方案**:
在 `config/dispatch.json5` 中禁用 LLM 分类:
```json5
{
  "settings": {
    "enabled": false  // 暂时禁用 dispatch 系统
  }
}
```

### 场景 3: `agent_context_build` 耗时长 (>100ms)

**原因**: 会话历史太长,构建上下文慢

**解决方案**:
在配置中启用 prompt caching 或减小上下文窗口。

### 场景 4: `/new` 新建窗口慢

**原因**: 会话初始化或工具索引查询慢

**解决方案**:
```bash
# 重建工具索引
pnpm build:tool-index
```

## 📚 完整文档

- **详细使用文档**: [docs/performance-tracking.md](docs/performance-tracking.md)
- **实现总结**: [docs/PERF_DEBUG_SUMMARY.md](docs/PERF_DEBUG_SUMMARY.md)

## 🛠️ 追踪阶段说明

| 阶段 | 说明 | 正常耗时 |
|------|------|----------|
| `request_received` | 网关接收请求 | <1ms |
| `agent_session_load` | 会话加载 | <10ms |
| `dispatch_start` | 分发引擎启动 | <1ms |
| `dispatch_intent_classify` | 意图分类 | <20ms (规则) / <100ms (LLM) |
| `agent_run_start` | Agent 启动 | <10ms |
| `agent_context_build` | 上下文构建 | <50ms |
| `agent_api_call_start` | API 调用开始 | <2ms |
| `agent_run_complete` | API 调用完成 | 200-2000ms (取决于模型) |
| `agent_response_process` | 响应处理 | <5ms |
| `response_sent` | 响应发送 | <1ms |

## ⚡ 性能优化建议

### 短期 (立即可做)
1. ✅ 使用更快的模型 (haiku 代替 sonnet)
2. ✅ 禁用 dispatch 系统 (如果不需要)
3. ✅ 减小上下文窗口大小

### 中期 (配置优化)
1. ✅ 启用 prompt caching
2. ✅ 配置合理的 session compaction 策略
3. ✅ 使用本地 LLM (如果适用)

### 长期 (架构优化)
1. 🔄 实现请求队列和并发控制
2. 🔄 添加响应缓存
3. 🔄 优化工具加载机制

## 🆘 需要帮助?

如果性能问题持续存在:

1. **收集日志**: 复制完整的性能追踪输出
2. **检查配置**: 确认 config.json5 中的模型和提供商设置
3. **检查网络**: 使用 `curl` 测试 API 端点连通性
4. **提交 Issue**: 到 GitHub Issues 附上性能日志

---

**祝你调试顺利! 🎉**

如有问题请查看完整文档: [docs/performance-tracking.md](docs/performance-tracking.md)
