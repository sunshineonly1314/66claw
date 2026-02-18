# PRD: OpenClawCN AIoT 统一调度方案

> Status: **Research Complete** | Date: 2026-02-18 | Priority: P1

---

## 一、背景与目标

OpenClawCN 作为个人 AI 助手，AIoT 场景是必备能力。当前架构已具备 MCP 多平台接入、Dispatch 语义路由、Skill 场景编排等骨架能力，但缺少关键的**知识存储层**，导致 Agent 每次会话都从零开始，无法成为真正的智能中枢。

**目标**：一个 OpenClawCN 实例统一调度所有 AIoT 场景下的产品。

---

## 二、当前能力盘点（已具备）

| 能力 | 实现 | AIoT 适用性 |
|------|------|-------------|
| 多 MCP 并行 | `MCP_MAX_SERVERS=20`，命名空间 `mcp_{serverId}_{tool}` | 同时连接小米+涂鸦+HA 等 20 个平台 |
| 工具自动发现 | `tool-discovery.ts` FTS5+向量混合搜索，12k+ 工具 <10ms | "关灯" → 自动匹配 `mcp_homeassistant_light.turn_off` |
| 意图分发引擎 | `dispatch/engine.ts` 16 步分类 + 通配符展开 | `mcp_miot-mcp_*` 匹配所有小米设备工具 |
| Cron 定时调度 | `cron/service/timer.ts` + 独立 Agent 会话 | "每天晚上10点关灯" |
| 多层安全 | Tool Policy → Hook → Allowlist → UI 审批(120s) | 危险命令需用户确认 |
| Skill 编排 | SKILL.md 文件 + LLM 知识注入 | "回家模式" "离家模式" 等场景 |
| 并行工具调用 | 单轮多 tool_use | 一句话同时控制多个设备 |
| 熔断器+自动重启 | 3次失败 → 熔断，指数退避 5~40min | MCP 崩溃自动恢复 |

### 本地 MCP 库中可用的 AIoT 服务器（42 个）

从 `data/mcp-index.json`（9535 个 MCP 服务器）中筛选出 42 个 AIoT 相关服务器，覆盖 9 个类别：

| 类别 | 数量 | 典型服务器 |
|------|------|-----------|
| Home Assistant | 6 | homeassistant, hass-mcp, ha-mcp |
| 小米/米家 | 3 | xiaomi-miot-mcp, miot-mcp, mihome |
| 涂鸦 Tuya | 3 | tuya-mcp, tuyacloud, tinytuya-mcp |
| Apple HomeKit | 2 | homekit-mcp, apple-home |
| MQTT/IoT 协议 | 5 | mqtt-mcp, mosquitto, iot-gateway |
| 传感器/数据 | 8 | sensor-data, weather-station, air-quality |
| 硬件控制 | 6 | raspberry-pi, arduino, esp32 |
| 语音/音箱 | 4 | alexa-mcp, google-home, sonos |
| 安防/摄像头 | 5 | camera-mcp, doorbell, motion-detect |

### 三层协作架构

```
MCP = 连接层（"连接到设备"）
Tool = 执行层（"执行操作"）
Skill = 编排层（"告诉 AI 如何编排"）
```

---

## 三、五大技术瓶颈

### 瓶颈 1：上下文窗口工具容量极限

- `DEFAULT_CONTEXT_TOKENS = 200,000`
- 每个工具 schema 消耗 500~2000 tokens
- 甜蜜区：50~80 个工具；200+ 工具 schema 直接耗尽上下文
- **当前无动态工具过滤** — 所有已加载 MCP 的工具全量注入

**解决方案**：动态工具加载（Tool-on-Demand）
- 修改 `clawdbot-tools.ts` 的 `createOpenClawCNTools()` 添加 `toolFilter` 参数
- 配合 `dispatch/engine.ts` 的 `mcpToolHints` 做动态裁剪
- 现有 `applyToolHints()` 已支持工具重排序，扩展为过滤能力
- 预估：3~5 天

### 瓶颈 2：实时事件响应能力不足

- Cron 最小粒度 `MAX_TIMER_DELAY_MS = 60_000`（60秒）
- WebSocket ~10ms 但仅前端推送，不触发 Agent
- **无 Pub/Sub 订阅协议** — 烟雾报警等需 <1s 响应

**解决方案**：事件总线 + 响应式 Agent 触发
- 复用 `server-broadcast.ts` 的 Redis Pub/Sub
- 复用 `cron/isolated-agent/run.ts` 的独立会话逻辑
- 复用 Heartbeat coalescing（250ms）做事件聚合
- 预估：7~10 天

### 瓶颈 3：并发设备控制吞吐量

- LLM API 并发 = 5（`resource-guard.ts`）— **第一瓶颈**
- Agent 主会话并发 = 4，子 Agent = 8
- MCP 工具调用每个会话内串行

**解决方案**：批量操作工具 + 设备组抽象
- 方案 A：`batch_device_control` 工具，一次调用传数组（2~3 天）
- 方案 B：设备组抽象 "客厅照明" = [灯1,灯2,灯3]（3~5 天）
- 方案 C：Skill 预编排 "回家模式"（零开发，Skill 已就绪）

### 瓶颈 4：设备状态持久化缺失（核心缺失）

- **无内置设备状态存储** — Agent 不知道"灯是开还是关"
- MCP 服务器状态全 in-memory，重启即丢
- Session Context 仅 20 轮、30 分钟过期

**解决方案**：三层知识存储（见下文 Knowledge Store 设计）

### 瓶颈 5：离线场景

- 断网后 LLM API 不可用 → Agent 瘫痪
- 本地 LAN 设备仍在线但无法控制
- 优先级低（大部分用户有稳定网络）

---

## 四、核心设计：Knowledge Store（知识存储层）

### 问题本质

之前的设计是"手脚"（能做什么），缺的是"大脑"（知道什么）。有手脚没大脑 = 每次从零开始的机器人。

需要的不是"一个记忆层"，而是**三层知识存储**：

### Layer 0: Conversation Memory（已有）
- SQLite + 向量嵌入 + FTS5 + Time-Tiering
- MEMORY.md + memory/*.md + sessions/

### Layer 1: Execution Memory（执行记忆）— 新增

**解决**: "上次调用什么工具？成功了吗？花了多久？"

```sql
CREATE TABLE tool_executions (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  timestamp INTEGER,
  tool_name TEXT,              -- "mcp_homeassistant_light.turn_on"
  mcp_server_id TEXT,
  input_params TEXT,           -- JSON
  output_summary TEXT,         -- 摘要（非全量）
  status TEXT,                 -- "ok" | "error" | "timeout" | "retry_ok"
  latency_ms INTEGER,
  error_message TEXT,
  device_id TEXT,
  value_snapshot TEXT           -- "AQI=75" / "temp=28.5"
);
```

**接入点**：`tool-bridge.ts` 的 `bridgeMCPTools()` 中拦截写入，零侵入。

### Layer 2: World State（世界状态）— 新增

**解决**: "灯是开还是关？空调多少度？"

```sql
CREATE TABLE device_state (
  device_id TEXT PRIMARY KEY,
  platform TEXT,
  device_type TEXT,
  display_name TEXT,
  room TEXT,
  state_json TEXT,             -- {"on": true, "brightness": 80}
  last_command TEXT,
  last_command_by TEXT,        -- "user" | "cron:job_123" | "skill:离家模式"
  updated_at INTEGER,
  source TEXT                  -- "poll" | "event" | "command_result"
);
```

**三路写入**：
1. 命令结果反写（最及时）
2. Cron 定时轮询 2~5 分钟（兜底）
3. 事件推送（未来）

**上下文注入**：system-prompt.ts 中注入设备状态摘要，~500 tokens/20设备。

### Layer 3: Pattern Memory（模式记忆）— 新增

**解决**: "用户的习惯是什么？能不能自动编排？"

```sql
CREATE TABLE behavior_patterns (
  id TEXT PRIMARY KEY,
  pattern_type TEXT,           -- "time_routine" | "scene_trigger" | "preference"
  description TEXT,
  confidence REAL,
  occurrences INTEGER,
  first_seen INTEGER,
  last_seen INTEGER,
  related_devices TEXT,        -- JSON
  related_actions TEXT,        -- JSON
  suggested_automation TEXT,
  user_acknowledged BOOLEAN,
  auto_created_job_id TEXT
);
```

**模式发现**：Cron 每日分析 tool_executions 最近 30 天数据，按时间窗口聚类，>= 3 次 → 写入。

**主动建议**：Agent 检查 confidence > 0.7 的未确认模式，提议创建 Cron/Skill。

---

## 五、系统集成全景

```
用户输入
  │
  ▼
Dispatch Engine ←── Pattern Memory（历史意图）
  │
  ▼
Agent (LLM) ←── World State（设备状态）
            ←── Execution Memory（调用经验）
            ←── Conversation Memory（对话记忆）[已有]
  │
  ▼
MCP Bridge ──→ Execution Memory（写入记录）
tool-bridge ──→ World State（更新状态）
  │
  ▼
MCP Servers (HA/小米/涂鸦)

Cron (每日) ──→ Pattern Memory（分析行为模式）
模式发现引擎 ←── Execution Memory（读取历史）
```

---

## 六、实施路线图

### Phase 0: Knowledge Store 基础设施（1~2 周）— 最高优先级
- [ ] SQLite 三表创建（tool_executions / device_state / behavior_patterns）
- [ ] tool-bridge.ts 增加 Execution Memory 写入钩子
- [ ] 设备状态上下文注入到 system-prompt.ts
- [ ] 新增 Agent 工具：device_state_query / execution_history

### Phase 1: 基础可用（2~3 周）
- [ ] 批量控制工具 + 动态工具过滤
- [ ] World State 命令结果反写 + Cron 轮询同步
- [ ] MCP 接入配置（小米 + HA + 涂鸦）

### Phase 2: 智能自动化（2~3 周）
- [ ] Pattern Memory 模式发现引擎（Cron 每日分析）
- [ ] Agent 主动建议流程（"要不要自动化？"）
- [ ] Skill 自动生成（Pattern → SKILL.md）

### Phase 3: 实时响应（3~4 周）
- [ ] 事件总线 + World State 实时更新
- [ ] 告警自动处置 + 基于 World State 的决策

### Phase 4: 高级能力（可选）
- [ ] 离线规则引擎
- [ ] 设备学习 — 基于历史行为自动推荐
- [ ] 能耗优化 — 结合电价/天气智能调度

---

## 七、量化评估矩阵

| 维度 | 当前 | 目标 | 差距 | 难度 |
|------|------|------|------|------|
| 平台接入 | 20 MCP 并行 | 5~10 主流平台 | 已满足 | — |
| 工具容量 | 50~80（全量加载） | 100~300（全屋设备） | 需动态过滤 | 中 |
| 实时响应 | 60s Cron 最小粒度 | <1s 传感器事件 | 需事件总线 | 高 |
| 并发控制 | 5 LLM + 串行工具 | 50+ 设备批量 | 需批量工具 | 低 |
| 状态持久化 | 无 | 跨会话设备状态 | 需 Knowledge Store | 中 |
| 安全防护 | 多层审批 + 熔断 | AIoT 防护 | 已满足 | — |
| 离线降级 | 熔断 + 重启 | 本地基础控制 | 可选增强 | 高 |
| 场景编排 | Skill 已就绪 | 模式编排 | 零开发 | — |

---

## 八、中国 AIoT 生态分析

| 平台 | 协议 | MCP 可用性 | 接入方式 |
|------|------|-----------|---------|
| 小米/米家 | MIoT-Spec-V2 | 有 miot-mcp | 直连（局域网 mDNS） |
| 涂鸦 Tuya | Cloud API + tinytuya | 有 tuya-mcp | 云端 API + 局域网 |
| Home Assistant | REST/WebSocket API | 有 6 个 MCP | 本地网关（推荐） |
| 华为 HiLink | 封闭 | 无 | 需通过 HA 桥接 |
| 天猫精灵 | 封闭 | 无 | 需通过 HA 桥接 |

**推荐组合**：
- 基础：HomeAssistant MCP（覆盖大部分设备）
- 进阶：HA + 小米 MIoT MCP（直连低延迟）
- 完整：HA + 小米 + 涂鸦（三平台全覆盖）

---

## 九、关键技术数据（代码级调研）

| 参数 | 值 | 来源文件 |
|------|------|---------|
| MCP_MAX_SERVERS | 20 | src/mcp/types.ts |
| MCP_MAX_RESULT_BYTES | 65,536 (64KB) | src/mcp/types.ts |
| MCP_CALL_TIMEOUT_MS | 60,000 | src/mcp/types.ts |
| DEFAULT_CONTEXT_TOKENS | 200,000 | src/config/ |
| LLM API 并发 | 5 | src/dispatch/resource-guard.ts |
| Agent 主会话并发 | 4 | src/config/agent-limits.ts |
| 子 Agent 并发 | 8 | src/config/agent-limits.ts |
| Cron 最小粒度 | 60s | src/cron/service/timer.ts |
| Heartbeat 聚合窗口 | 250ms | src/infra/heartbeat-wake.ts |
| WebSocket 广播延迟 | ~10ms | src/gateway/server-broadcast.ts |
| 执行审批超时 | 120s | src/gateway/node-invoke-system-run-approval.ts |
| 熔断阈值 | 3 次失败 | src/mcp/runtime-manager.ts |
| Session Context 窗口 | 20 轮 / 30 分钟 | src/dispatch/session-context.ts |
| Memory 搜索上限 | 6 条 / 4000 chars | src/memory/manager.ts |
| Tool Discovery 返回 | 50 条 / <10ms | src/dispatch/tool-discovery.ts |
