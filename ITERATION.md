# ClawdbotCN 功能迭代日志

> 记录每日功能开发和 Bug 修复，用于迭代上线说明

---

## 2026-02-06 (周四)

### Bug 修复
- **修复 "Unknown model: volcengine-ark/doubao-seed-1-8-251228" 错误** ✅
  - 问题：系统尝试使用豆包（火山引擎）模型但未配置 API key 时报错
  - 根因：`resolveModel` 函数未正确应用 volcengine-ark 的内置后备配置
  - 修复方案：
    - 增强 `resolveModel` 函数的 provider 解析逻辑，支持 provider 别名匹配
    - 确保 volcengine-ark 即使没有显式配置也能使用内置的 `VOLCENGINE_ARK_BUILTIN` 配置
    - 为常见国产模型（豆包、通义千问等）添加友好的错误提示，包含获取 API key 的链接和配置命令
  - 影响范围：免费模型功能、模型回退机制、中国区用户体验
  - 文件修改：
    - `src/agents/pi-embedded-runner/model.ts`：增强 provider 解析和后备机制
    - `src/agents/pi-embedded-runner/run.ts`：添加友好的错误提示

---

## 2026-02-04 (周二)

### 技术调研 - Archestra 项目借鉴点

> 来源: https://github.com/archestra-ai/archestra (企业级 MCP 安全平台)

**P0 高优先级**
- [ ] **LLM Metrics 可观测性** - 请求延迟/Token用量/成本/TTFT/吞吐量
- [ ] **成本统计和限制** - 按团队/Agent/组织的预算控制

**P1 中优先级**
- [ ] **Dual LLM 安全子代理** - 独立 LLM 审核 tool 响应，防 Prompt Injection
- [ ] **动态模型路由优化** - 简单任务自动路由便宜模型，节省 96% 成本

**P2 待研究**
- [ ] **Secrets Manager 增强** - HashiCorp Vault 集成
- [ ] **私有 Skill 注册表** - 版本控制/权限/审批流程

**P3 长期规划**
- [ ] **K8s MCP 运行时** - 容器化 skill 隔离
- [ ] **A2A 协议支持** - 多 Agent 协作

**技术栈参考**
- Fastify (高性能后端)
- Drizzle ORM (轻量 TypeScript ORM)
- OpenTelemetry (分布式追踪)
- Prometheus metrics (prom-client)

### License 短期令牌 API - 联调测试通过 ✅
- **服务端 `/token` 接口联调完成**
  - 请求格式验证通过（licenseKey、deviceId、timestamp、nonce、sign）
  - 响应解析正确（嵌套 JSON 格式兼容）
  - RSA 签名验证通过（60分钟有效期令牌）
- **客户端集成验证**
  - 有效 Key 启动 Gateway：授权验证 + 令牌获取成功
  - 自动续期机制：30分钟间隔，日志可见续期请求
  - 无效 Key 启动：进入受限模式，UI 提示明确
  - 消息发送拦截：`isLicenseValid()` → `UNAUTHORIZED`
- **代码修复**
  - `scripts/test-license-token.ts`：修复双执行、设备ID路径、延迟退出
  - `src/license/token.ts`：兼容嵌套 JSON 响应格式
- **文档更新**
  - `docs/requirements/license-token-api.md` 测试状态更新为已完成

### 新功能
- **每日免费大模型平滑切换** - ClawdbotCN 独家福利
  - 支持蚂蚁百灵、美团 LongCat 每日免费模型
  - 额度用完自动切换，用户无感知
  - 统计今日/累计节省金额
  - 切换 Toast 提示省钱金额
  - Overview 卡片入口
  - 完整管理页面（配置、测试、删除）

- **欢迎发现页面** - 首次进入 Chat 的智能引导
  - 扫描设备可用能力（CLI 工具、渠道、浏览器等）
  - 个性化建议 Prompt
  - 能力状态展示（ready/needs_config/can_install）
  - 工作空间识别（项目类型、语言、主要文件）
  - 跳过/重试/配置入口

- **技能安装审批系统** - 用户授权安装流程
  - 安装请求 Pending 队列
  - Web UI 审批弹窗
  - 安装进度实时反馈
  - 安装成功后自动继续对话

- **意见反馈功能** - 建议/Bug 快速提交
  - 右侧抽屉面板设计
  - 建议/Bug 两种类型
  - 支持截图附件
  - 联系方式（可选）

- **Token 使用量详情页** - 使用统计仪表盘
  - 今日/累计 Token 用量
  - 按天统计折线图
  - 7/14/30 天切换
  - 模型分布统计

- **代码语法高亮** - highlight.js 按需加载
  - 支持 20+ 常用语言
  - 自动语言检测
  - 行号显示
  - 复制代码按钮

- **功能迭代日志管理** - 开发运维工具
  - `ITERATION.md` 每日功能/Bug 记录
  - Cursor Skill 自动化管理
  - 快速索引表格
  - 上线说明模板

- **免费模型首选选择器** - 用户可选首选模型
  - 空状态页：模型卡片选择（带推荐标记）
  - 已配置页：首选模型单选切换
  - 账号卡片：⭐首选标记 + 设为首选按钮
  - 按优先级排序显示

- **省钱统计增强** - 突出展示节省金额
  - 免费模型页：今日已省 + 累计节省（大字醒目）
  - 概览卡片：省钱数据完整展示（绿色高亮）
  - 省钱提示条：累计节省金额提醒
  - 视觉优化：渐变背景 + 动画效果

### 企业IM扩展
- **钉钉 AI Card 流式响应** - 打字机效果
  - 实时显示生成内容
  - 支持群聊/私聊
  - 卡片转发支持

- **钉钉会话管理器** - 多轮对话状态
  - 会话上下文缓存
  - 超时自动清理

- **飞书 @ 提及处理** - 群聊转发
  - @ 机器人 + @ 用户触发
  - 排除机器人自身
  - 私聊直接 @ 转发

- **QQBot 扩展** - 新渠道接入（骨架）
  - API 基础框架
  - 配置 Schema
  - 运行时接口

### UIUE 优化
- 删除确认弹窗（图标抖动动画）
- 骨架屏加载状态（流光动画）
- 空状态引导页（浮动图标 + CTA按钮）
- 省钱数字飘字动画
- 进度条流光效果
- Toast 滑入滑出 + 倒计时进度条
- 自定义开关滑动动画
- 按钮涟漪点击效果
- 欢迎发现页扫描进度动画
- 技能安装进度条

### 后端
- 中文错误识别（额度不足、余额不足等 10+ 关键词）
- 免费模型调度器（优先级/轮询策略）
- Gateway RPC API（providers/config/account/stats）
- Setup Wizard 集成
- 能力检测 API（detectCapabilities）
- 技能安装审批 RPC（request/decision/progress）
- 意见反馈 API（submit）
- 聊天错误分类（billing/auth/rate_limit/timeout/overloaded/network）

### 安全
- **License RSA 签名验证** - 非对称加密防伪
  - 2048 位 RSA 公钥
  - 服务端时间校验（防重放）
  - 签名格式 `valid|tier|expiresAt|serverTime`

- **反调试检测** - 开发环境保护
  - 调试器检测
  - 定时巡检

- **文件完整性校验** - 代码防篡改
  - 关键文件哈希校验
  - 启动时验证

### 构建
- Windows 全量包构建脚本（离线/在线）
- Inno Setup 打包配置优化

### 测试
- **129 个免费模型后端测试** - 全部通过 ✅
  - Provider 配置测试（31 个）
  - 调度器测试（35 个）
  - 中文计费错误识别（38 个）
  - Gateway API 测试（25 个）
- **AB 结对测试** - 专家 A/B 交叉验证完成
- **测试报告**: `devTemp/todo/free-models-test-report-2026-02-04.md`
- 212+ 个其他自动化测试用例
- 覆盖：error-hints、钉钉 AI Card、会话管理等
- **Gateway 集成验证** - freeModelsHandlers 启用 ✅

---

## 2026-02-03 (周一)

### 新功能
- 待补充

### Bug 修复
- 待补充

---

## 模板

```markdown
## YYYY-MM-DD (周X)

### 新功能
- **功能名称** - 简要说明
  - 子功能点1
  - 子功能点2

### Bug 修复
- 修复 xxx 问题
- 修复 xxx 在 xxx 场景下的异常

### UIUE 优化
- 优化 xxx 交互
- 新增 xxx 动画

### 后端
- xxx 接口新增
- xxx 逻辑优化

### 测试
- 新增 xxx 测试用例
```

---

## 快速索引

| 日期 | 主要功能 | 状态 |
|-----|---------|------|
| 2026-02-04 | 免费模型切换 + 欢迎发现 + 技能审批 + 反馈 + 使用量 + 代码高亮 + 钉钉AICard + 飞书@转发 + RSA签名 | ✅ 完成 |
| 2026-02-03 | - | 待补充 |
