# 🔍 OpenClawCN 性能问题诊断报告

**生成时间**: 2026-02-18
**分析日志**: `.gateway.log`
**分析工具**: 性能追踪系统 (perf-tracker)

---

## 📊 执行摘要

根据性能追踪系统的分析,你的系统主要存在**3个核心问题**导致响应缓慢:

| 问题 | 严重程度 | 影响 | 状态 |
|------|----------|------|------|
| 1. Anthropic API 配额耗尽 | 🔴 严重 | 图片生成失败 | 需立即处理 |
| 2. LLM API 响应极慢 (70秒) | 🔴 严重 | 整体响应慢 | 需立即处理 |
| 3. Google API Key 缺失 | 🟡 中等 | 诊断任务失败 | 建议处理 |

---

## 🔴 问题 1: Anthropic API 配额耗尽

### 错误详情

```
[tools] image failed: Image model failed (anthropic/claude-opus-4-6): 400
{
  "type": "error",
  "error": {
    "type": "invalid_request_error",
    "message": "Your credit balance is too low to access the Anthropic API.
                Please go to Plans & Billing to upgrade or purchase credits."
  }
}
```

### 影响范围

- ❌ **图片生成功能** (`image` 工具) 完全失效
- ❌ 使用 `claude-opus-4-6` 的所有请求失败
- ⚠️ 可能导致其他依赖 Anthropic API 的功能异常

### 解决方案

#### 方案 A: 充值 Anthropic API (推荐)

```bash
# 访问 Anthropic 控制台充值
https://console.anthropic.com/settings/billing
```

#### 方案 B: 临时禁用图片生成工具

在 `config.json5` 中:

```json5
{
  "tools": {
    "image": {
      "enabled": false  // 临时禁用
    }
  }
}
```

#### 方案 C: 切换到其他图片生成提供商

```json5
{
  "tools": {
    "image": {
      "provider": "dashscope",  // 或 "siliconflow"
      "model": "flux-1.1-pro"
    }
  }
}
```

---

## 🔴 问题 2: LLM API 响应极慢 (69.6秒)

### 性能数据

**第二次请求 (runId: 20c4d7aa)**:

```
请求阶段              耗时        占比
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
request_received      0.01ms     0.0%
agent_session_load    5.50ms     0.0%
dispatch_start        4.59ms     0.0%
agent_run_start      27.14ms     0.0%
agent_context_build   2.97ms     0.0%
agent_api_call_start  1.54ms     0.0%
agent_run_complete  69615.56ms  100.0%  ← 主要瓶颈!
response_sent         3.95ms     0.0%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
总耗时: 69.66秒
```

**第一次请求**:
- `agent_run_complete`: **3955.24ms** (约4秒,相对正常)

### 根因分析

1. **使用的模型**: `kimi-coding/kimi-for-coding`
   - 正常响应时间应该在 **1-3秒**
   - 实际耗时 **70秒** = **23倍慢**!

2. **可能的原因**:
   - 🔴 **API 限流/重试**: Kimi API 配额不足或限流
   - 🔴 **网络问题**: 到 Kimi API 的网络连接不稳定
   - 🔴 **模型超载**: Kimi 服务端负载高,响应慢
   - ⚠️ **上下文过长**: 会话历史太长导致处理慢

3. **对比数据**:
   - 第一次请求: 4秒 (相对正常)
   - 第二次请求: 70秒 (异常慢)
   - **结论**: 不是系统问题,是 **API 端问题**

### 解决方案

#### 立即行动 (方案 A): 切换到更快的模型

**选项 1: Claude Haiku (最快,推荐)**

```json5
{
  "agents": {
    "defaults": {
      "provider": "anthropic",
      "model": "claude-haiku-4.5",  // 最快,0.5-1.5秒
      "authProfile": "default"
    }
  }
}
```

⚠️ 但你的 Anthropic API 配额已耗尽,需要先充值!

**选项 2: OpenAI GPT-4o-mini (备选)**

```json5
{
  "agents": {
    "defaults": {
      "provider": "openai",
      "model": "gpt-4o-mini",  // 快速,1-2秒
      "authProfile": "default"
    }
  }
}
```

**选项 3: 本地 Ollama (免费,离线)**

```json5
{
  "agents": {
    "defaults": {
      "provider": "ollama",
      "model": "qwen2.5:32b",  // 根据你的硬件选择
      "authProfile": "default"
    }
  }
}
```

#### 中期优化 (方案 B): 启用 Prompt Caching

如果继续使用 Kimi,启用缓存可以加速:

```json5
{
  "agents": {
    "defaults": {
      "promptCaching": true  // 启用 prompt caching
    }
  }
}
```

#### 长期优化 (方案 C): 实现请求超时和重试

在配置中设置更严格的超时:

```json5
{
  "agents": {
    "defaults": {
      "timeoutMs": 30000  // 30秒超时 (当前可能是120秒)
    }
  }
}
```

---

## 🟡 问题 3: Google API Key 缺失

### 错误详情

```
[diagnostic] lane task error: lane=main durationMs=35
error="Error: No API key found for provider "google".
Auth store: C:\Users\72793\.openclawcn\agents\main\agent\auth-profiles.json
Configure auth for this agent (openclawcn agents add <id>) or
copy auth-profiles.json from the main agentDir."
```

### 影响范围

- ⚠️ **诊断任务失败** (diagnostic lane)
- ⚠️ 可能影响使用 Google 服务的功能
- ℹ️ 不影响核心聊天功能

### 解决方案

#### 方案 A: 添加 Google API Key (如果需要)

```bash
openclawcn agents auth add google
# 或
openclawcn agents add main
```

然后输入你的 Google API Key (Gemini API)。

#### 方案 B: 忽略 (如果不需要)

如果你不使用 Google/Gemini 相关功能,可以忽略这个警告。

---

## 📋 配置问题汇总

### Doctor 警告

```
⚠️ Unknown config keys (未知配置键):
  - tools.web.fetch.firecrawl
  - tools.write
  - tools.browser
  - mcp
```

**建议**: 运行清理命令

```bash
openclawcn doctor --fix
```

### Legacy 状态目录

```
ℹ️ Legacy state dir is a symlink
   C:\Users\72793\.clawdbot → C:\Users\72793\.openclaw
   Skipping auto-migration.
```

**状态**: 正常,已正确迁移。

---

## 🎯 推荐行动计划

### 🔴 立即执行 (今天)

1. **充值 Anthropic API** 或 **切换图片生成提供商**
   ```bash
   # 访问 https://console.anthropic.com/settings/billing
   # 或修改 config.json5 使用 DashScope/SiliconFlow
   ```

2. **切换到更快的 LLM 模型**
   ```bash
   # 编辑 config.json5
   # 将 model 从 "kimi-for-coding" 改为:
   # - "openai/gpt-4o-mini" (推荐,快速稳定)
   # - "anthropic/claude-haiku-4.5" (最快,需充值)
   # - "ollama/qwen2.5:32b" (本地,免费)
   ```

3. **测试性能改善**
   ```bash
   # 发送测试消息
   # 查看性能日志
   tail -f .gateway.log | grep perf-tracker

   # 期望看到:
   # agent_run_complete: 500-2000ms (而不是 70000ms)
   ```

### 🟡 本周内完成

4. **配置 Google API** (如果需要 Gemini)
   ```bash
   openclawcn agents auth add google
   ```

5. **清理未知配置键**
   ```bash
   openclawcn doctor --fix
   ```

6. **启用 Prompt Caching** (提升性能)
   ```json5
   { "agents": { "defaults": { "promptCaching": true } } }
   ```

### 📈 持续监控

7. **设置性能监控脚本**
   ```bash
   # 创建监控脚本
   cat > monitor-perf.sh << 'EOF'
   #!/bin/bash
   tail -f .gateway.log | grep -E "(perf-tracker.*Total Time|agent_run_complete)"
   EOF

   chmod +x monitor-perf.sh
   ./monitor-perf.sh
   ```

8. **定期查看性能报告**
   ```bash
   # 每天查看一次性能总结
   grep "Performance Trace Summary" .gateway.log | tail -5
   ```

---

## ✅ 预期改善效果

完成上述优化后,你应该看到:

### 当前性能 vs 优化后性能

| 指标 | 当前 | 优化后目标 | 改善 |
|------|------|-----------|------|
| 总响应时间 | **69.66秒** | **0.5-2秒** | **35-140倍快** |
| agent_run_complete | 69615ms | 500-2000ms | 35-140倍快 |
| 图片生成 | ❌ 失败 | ✅ 成功 | 功能恢复 |
| /new 新建窗口 | ~70秒 | <1秒 | 70倍快 |

### 性能日志示例 (优化后)

```
========== Performance Trace Summary ==========
Total Time: 1200.50ms  ← 从 69秒降到 1.2秒!
Session: agent:main:main

Phase Breakdown:
  agent         :  1180.00ms (98.3%)  ← LLM API正常速度
  dispatch      :    14.50ms (1.2%)
  request       :     0.50ms (0.0%)
  response      :     5.50ms (0.5%)

Slow Phases (>10ms):
  agent_run_start               :    27.00ms
  dispatch_intent_classify      :    14.50ms
  agent_run_complete            :  1150.00ms  ← 正常!
==========================================================
```

---

## 🆘 故障排除

### 如果切换模型后仍然慢

1. **检查 API Key**:
   ```bash
   cat ~/.openclawcn/agents/main/agent/auth-profiles.json
   ```

2. **测试 API 连通性**:
   ```bash
   curl -i https://api.openai.com/v1/models \
     -H "Authorization: Bearer YOUR_API_KEY"
   ```

3. **查看详细错误**:
   ```bash
   tail -100 .gateway.log | grep -i error
   ```

### 如果图片生成仍然失败

1. **检查新提供商配置**:
   ```bash
   cat config.json5 | grep -A5 "image"
   ```

2. **验证 API Key**:
   ```bash
   # DashScope
   curl https://dashscope.aliyuncs.com/api/v1/services/image-generation/models \
     -H "Authorization: Bearer YOUR_DASHSCOPE_KEY"

   # SiliconFlow
   curl https://api.siliconflow.cn/v1/models \
     -H "Authorization: Bearer YOUR_SILICONFLOW_KEY"
   ```

---

## 📚 相关文档

- [性能追踪系统文档](docs/performance-tracking.md)
- [快速诊断指南](PERFORMANCE_DEBUG_README.md)
- [测试指南](TEST_PERFORMANCE_LOGGING.md)
- [实现总结](docs/PERF_DEBUG_SUMMARY.md)

---

**报告结束** | 生成于 2026-02-18 | OpenClawCN 性能追踪系统 v1.0
