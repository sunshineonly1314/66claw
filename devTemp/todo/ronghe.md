# Clawdbot 中国版上游融合需求文档

> 生成日期: 2026-01-30
> 上游仓库: https://github.com/openclaw/openclaw
> 上游版本: 2026.1.29 (stable)
> 本地版本: 2026.1.25 (unreleased)
> 目标市场: 中国大陆用户

---

## 产品背景

### 我们的差异化定位
| 维度 | 上游 (OpenClaw) | 我们 (Clawdbot CN) |
|------|-----------------|-------------------|
| 主要渠道 | Telegram, Discord, WhatsApp, Slack | **飞书、钉钉、企业微信** |
| 大模型 | Anthropic, OpenAI | **通义千问、DeepSeek、智谱、豆包** |
| 平台 | macOS 为主 | **Windows 为主** |
| 网络环境 | 全球直连 | **中国大陆网络** |
| 品牌 | openclaw | **保持 clawdbot** |

### 融合原则
1. **核心框架修复**: 必须合并 (Gateway、Agent、安全性)
2. **国外渠道**: 低优先级 (Telegram/Discord 在中国需 VPN)
3. **国内渠道**: 参考架构，确保兼容性
4. **Windows 相关**: 高优先级

---

## 一、🔴 紧急合并 (必须)

> 这些修复影响核心稳定性和安全性，无论用户使用什么渠道都会受影响

### 1.1 Gateway 稳定性修复

| PR | 问题 | 影响 | 建议 |
|----|------|------|------|
| #2980 | transient 网络错误导致 Gateway 崩溃 | **所有用户** - Gateway 随机崩溃 | ⚡ 立即合并 |
| #2451 | AbortError 未处理导致 crash | **所有用户** - 请求中断时崩溃 | ⚡ 立即合并 |
| #2483 | Session lock 进程终止后未释放 | **所有用户** - 锁残留阻塞 | ⚡ 立即合并 |
| #2871 | 图片 >5MB 无限重试 | **所有用户** - 资源耗尽 | ⚡ 立即合并 |

### 1.2 Windows 专项修复

| PR | 问题 | 影响 | 建议 |
|----|------|------|------|
| #3750 | XML escaping 用 `<>` 导致 NTFS 报错 | Windows 测试失败 | ⚡ 立即合并 |
| #2403 | Windows ACL 审计测试失败 | Windows 安全检查 | ⚡ 立即合并 |
| #1760 | Windows 平台标签未正确识别 | Node shell 选择错误 | ⚡ 立即合并 |
| - | fileURLToPath Windows 兼容性 | 路径解析问题 | ⚡ 立即合并 |

### 1.3 安全加固

| PR | 问题 | 影响 | 建议 |
|----|------|------|------|
| #4001 | SSH target handling 安全漏洞 | 远程访问安全 | ⚡ 立即合并 |
| - | DNS pinning 防 rebinding | URL fetch 安全 | ⚡ 立即合并 |

### 1.4 Agent 核心修复

| PR | 问题 | 影响 | 建议 |
|----|------|------|------|
| #2740 | inline models 未继承 baseUrl/api | **国产模型配置失效** | ⚡ 立即合并 |
| #2576 | auto provider 未应用 modelDefault | 模型切换异常 | ⚡ 立即合并 |
| #2143 | 冷却中的 provider 未跳过 | failover 效率低 | ⚡ 立即合并 |
| #2318 | memory.md 未纳入 bootstrap | 记忆功能不完整 | ⚡ 立即合并 |

---

## 二、🟡 建议合并 (重要)

> 这些修复提升产品质量，建议在版本迭代中合并

### 2.1 CLI/UI 通用修复

| PR | 问题 | 中国用户影响 | 建议 |
|----|------|-------------|------|
| #3682 | Chat session dropdown 刷新问题 | Control UI 体验 | 建议合并 |
| #2950 | 聊天输入框自动扩展 | 输入体验 | 建议合并 |
| #3272 | plugins 初始化顺序错误 | 插件加载失败 | 建议合并 |
| #2490 | 版本化 Node 识别 (node-22) | Node 兼容性 | 建议合并 |
| #2212 | 全局 help/version 加载 config | CLI 启动慢 | 建议合并 |
| #2808 | CLI compile cache (10% 提速) | 启动性能 | 建议合并 |

### 2.2 Media 处理修复

| PR | 问题 | 影响 | 建议 |
|----|------|------|------|
| #3628 | text attachment MIME 分类错误 | 文件识别 | 建议合并 |
| #3316 | audio/video MIME 映射缺失 | 媒体处理 | 建议合并 |
| #4118 | 代码块内 reasoning tags 丢失 | 推理输出 | 建议合并 |

### 2.3 TTS 修复

| PR | 问题 | 中国用户影响 | 建议 |
|----|------|-------------|------|
| #3341 | TTS baseUrl 未运行时读取 | **国产 TTS 配置** | 建议合并 |

---

## 三、🟢 折中选择 (可选)

> 这些功能与中国用户关系不大，或需要针对性调整

### 3.1 Telegram 修复 (低优先级)

| PR | 上游修复 | 中国用户决策 |
|----|----------|-------------|
| #4578 | HTML 嵌套修复 | ⏸️ 暂缓 - 中国用 Telegram 需 VPN |
| #4533 | react action 数字 ID | ⏸️ 暂缓 |
| #4456 | proxy dispatcher | ⚠️ 考虑合并 - 代理场景可能有用 |
| #2905 | video_note 支持 | ⏸️ 暂缓 |
| #2731 | DM thread sessions | ⏸️ 暂缓 |

**建议**: 这些修复可在 v2.0 规划中统一考虑，不影响中国主流用户。

### 3.2 Discord 修复 (低优先级)

| PR | 上游修复 | 中国用户决策 |
|----|----------|-------------|
| #3131 | username 查找 | ⏸️ 暂缓 - Discord 在中国无法直连 |
| #2649 | outbound user ID | ⏸️ 暂缓 |

### 3.3 新模型支持 (评估后决定)

| 模型 | 上游支持 | 中国用户决策 |
|------|----------|-------------|
| Xiaomi MiMo | #3454 | ✅ 考虑合并 - 国产模型 |
| Kimi K2.5 | #4407 | ✅ 考虑合并 - 国产模型 |
| Venice claude-opus-45 | - | ⏸️ 暂缓 - Venice 需科学上网 |

### 3.4 品牌重塑 (不跟进)

| 上游变更 | 我们的决策 | 原因 |
|---------|-----------|------|
| clawdbot → openclaw | ❌ 不跟进 | 保持品牌独立性，中国用户已熟悉 clawdbot |
| docs.clawd.bot → docs.openclaw.ai | ❌ 不跟进 | 使用自有文档域名 |
| macOS Bundle ID 变更 | ❌ 不跟进 | Windows 为主，影响小 |

### 3.5 认证模式变更 (谨慎评估)

| 上游变更 | 风险评估 | 建议 |
|---------|---------|------|
| 移除 auth mode "none" | 可能影响本地开发体验 | ⚠️ 延迟合并，先评估用户反馈 |
| 强制 token/password | 增加配置复杂度 | ⚠️ 可考虑保留 loopback 无认证 |

---

## 四、中国特色功能保护

> 合并时需确保不破坏以下本地化功能

### 4.1 国产渠道插件
- ✅ `extensions/feishu` - 飞书
- ✅ `extensions/dingtalk` - 钉钉
- ✅ `extensions/wecom` - 企业微信
- ✅ `extensions/qwen-portal-auth` - 通义千问认证

### 4.2 国产大模型配置
- ✅ `config.china.example.json5` - 中国配置示例
- ✅ 通义千问 (DashScope)
- ✅ 豆包 (火山引擎)
- ✅ DeepSeek
- ✅ 智谱 GLM

### 4.3 Windows 安装包
- ✅ `buildout/windows/ClawdbotCN-Setup-*.exe`
- ✅ `buildout/windows/Clawdbot-Lite-Setup-*.exe`

### 4.4 中文文档
- ✅ `docs-cn/` 目录
- ✅ `docs/china-localization.md`

---

## 五、融合执行计划

### 阶段 1: 紧急修复 (本周)
```
优先级: P0
范围: Gateway 稳定性 + Windows 兼容性 + 安全加固
预计工时: 2-3 天
```

**Cherry-pick 列表**:
1. Gateway 网络错误处理 (4 个 commits)
2. Windows 兼容性修复 (4 个 commits)
3. SSH 安全加固 (1 个 commit)
4. Agent 模型配置修复 (3 个 commits)

### 阶段 2: 质量提升 (下周)
```
优先级: P1
范围: CLI/UI + Media + TTS
预计工时: 3-4 天
```

### 阶段 3: 可选功能 (版本规划)
```
优先级: P2
范围: 新模型支持 + 国外渠道 (如需要)
预计工时: 按需
```

---

## 六、风险提示

### 6.1 合并风险
| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 命名空间冲突 | 中 | 代码冲突 | 手动适配 clawdbot 命名 |
| 配置格式变更 | 低 | 用户迁移 | 保持向后兼容 |
| 测试覆盖不足 | 中 | 回归 bug | 重点测试国产渠道 |

### 6.2 不合并风险
| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 安全漏洞积累 | 高 | 安全事件 | 优先合并安全修复 |
| 技术债增加 | 高 | 维护成本 | 定期同步上游 |

---

## 七、专业建议总结

### 🎯 核心结论

1. **必须立即合并**: Gateway 稳定性、Windows 兼容性、安全修复
2. **建议合并**: CLI/UI、Media、TTS 相关修复
3. **暂缓/不合并**: Telegram/Discord 修复、品牌重塑
4. **评估后决定**: 新国产模型支持 (MiMo、Kimi K2.5)

### 📋 下一步行动

1. [ ] 创建 `feature/upstream-sync-2026.1.29` 分支
2. [ ] 按阶段 1 列表 cherry-pick 紧急修复
3. [ ] 在飞书/钉钉渠道进行回归测试
4. [ ] 更新 CHANGELOG-CN.md
5. [ ] 发布 2026.1.26 补丁版本

---

## 附录 A: 紧急修复 Commit 参考

### Gateway 稳定性 (4 commits)
```
3b879fe52 fix(infra): prevent gateway crashes on transient network errors
3a25a4fa9 fix: keep unhandled rejections safe
14e8acdec fix(agents): release session locks on process termination
b59ea0e3f fix: prevent infinite retry loop for images exceeding 5MB
```

### Windows 兼容性 (4 commits)
```
c20035094 fix: use & instead of <> in XML escaping test for Windows NTFS
a8ad242f8 fix(security): properly test Windows ACL audit for config includes
7253bf398 feat: audit fixes and documentation improvements
d93f8ffc1 fix: use fileURLToPath for Windows compatibility
```

### 安全加固 (2 commits)
```
06289b36d fix(security): harden SSH target handling
b623557a2 fix: harden url fetch dns pinning
```

### Agent 模型配置 (4 commits)
```
6bf2f0eee fix(models): inherit baseUrl and api from provider config
6c451f47f Fix a subtle bug: modelDefault doesn't apply when provider === "auto"
ff42a48b5 Skip cooldowned providers during model failover
2cbc991bf feat(agents): add MEMORY.md to bootstrap files
```

---

## 附录 B: Cherry-pick 操作指南

### 步骤 1: 准备工作
```bash
# 确保 upstream 已配置
git remote add upstream https://github.com/openclaw/openclaw.git
git fetch upstream --tags

# 创建融合分支
git checkout -b feature/upstream-sync-2026.1.29
```

### 步骤 2: Cherry-pick 紧急修复
```bash
# Gateway 稳定性
git cherry-pick 3b879fe52  # prevent gateway crashes
git cherry-pick 3a25a4fa9  # unhandled rejections
git cherry-pick 14e8acdec  # session locks (注意: commit 需要确认)
git cherry-pick b59ea0e3f  # image retry loop

# Windows 兼容性
git cherry-pick c20035094  # NTFS XML escaping
git cherry-pick a8ad242f8  # Windows ACL audit
git cherry-pick d93f8ffc1  # fileURLToPath

# 安全加固
git cherry-pick 06289b36d  # SSH target handling
git cherry-pick b623557a2  # DNS pinning

# Agent 模型配置 (重要: 国产模型需要这些修复)
git cherry-pick 6bf2f0eee  # baseUrl/api inheritance
git cherry-pick 6c451f47f  # modelDefault fix
git cherry-pick ff42a48b5  # provider cooldown
git cherry-pick 2cbc991bf  # MEMORY.md bootstrap
```

### 步骤 3: 处理冲突
```bash
# 如遇冲突，主要注意:
# 1. 保持 "clawdbot" 命名，忽略 "openclaw" 重命名
# 2. 保持 import 路径为 "clawdbot/..."
# 3. 保持配置目录为 ~/.clawdbot

# 冲突解决后
git add .
git cherry-pick --continue
```

### 步骤 4: 测试验证
```bash
# 构建
pnpm build

# 测试 (重点测试国产渠道)
pnpm test

# 手动测试飞书/钉钉
pnpm clawdbot gateway run
```

### 步骤 5: 更新版本
```bash
# 更新 package.json 版本为 2026.1.26
# 更新 CHANGELOG.md
```

---

## 附录 C: 国产模型配置验证清单

合并后需验证以下配置仍然正常工作：

### 通义千问 (DashScope)
```json5
{
  "models": {
    "providers": {
      "qwen-dashscope": {
        "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "apiKey": "xxx",
        "api": "openai-completions"
      }
    }
  }
}
```

### DeepSeek
```json5
{
  "models": {
    "providers": {
      "deepseek": {
        "baseUrl": "https://api.deepseek.com",
        "apiKey": "xxx",
        "api": "openai-completions"
      }
    }
  }
}
```

### 智谱 GLM
```json5
{
  "models": {
    "providers": {
      "glm": {
        "baseUrl": "https://open.bigmodel.cn/api/paas/v4",
        "apiKey": "xxx",
        "api": "openai-completions"
      }
    }
  }
}
```

**关键验证点**:
- [ ] baseUrl 正确继承到 inline models
- [ ] modelDefault 在 provider="auto" 时生效
- [ ] API Key 环境变量替换正常

---

## 附录 D: 上游 Bug 修复完整分类清单

### 2.1 Telegram 频道修复 (高优先级)

| PR/Commit | 修复内容 | 影响 |
|-----------|----------|------|
| #4578 | 修复 HTML 嵌套问题 (overlapping styles/links) | 消息格式错乱 |
| #4533 | 接受数字类型的 messageId/chatId (react action) | react 功能失败 |
| #4456 | 使用 undici fetch 修复代理 dispatcher | 代理无法工作 |
| #4360 | 作用域 skill commands 到绑定的 agent/bot | 多 bot 命令冲突 |
| #3796 | 避免静默空回复 (追踪 normalization skips) | 用户收不到回复 |
| #3303 | 即使有明确 mention 也检查 mentionPatterns | mention 匹配不生效 |
| #2942 | native command context 包含 AccountId | 多 agent 路由错误 |
| #2905 | 处理 video_note 附件 | 视频笔记无法接收 |
| #2731 | 保持 DM thread sessions (非 forum 群组忽略 thread_id) | session 错乱 |
| #2900 | 支持 quote 回复 (partial message replies) | 新功能 |

### 2.2 Discord 频道修复

| PR/Commit | 修复内容 | 影响 |
|-----------|----------|------|
| #3131 | 恢复 username 目录查找 | target resolution 失败 |
| #2649 | 解析 username 到 user ID (outbound messages) | 发送消息失败 |
| 多个 | 修复 resolveDiscordTarget 参数传递 | 消息路由错误 |

### 2.3 Gateway/安全修复 (高优先级)

| PR/Commit | 修复内容 | 影响 |
|-----------|----------|------|
| #4001 | 加固 SSH target handling | 安全漏洞 |
| #2980 | 防止 transient network errors 导致 gateway 崩溃 | 稳定性 |
| #2871 | 正确处理图片大小错误 (防止无限重试) | 资源耗尽 |
| #2451 | 抑制 AbortError 和网络错误的 unhandled rejections | 稳定性 |
| #2483 | 进程终止时释放 session locks | 锁残留 |
| #2143 | 跳过冷却中的 providers (model failover) | failover 效率 |

### 2.4 UI/Web 修复

| PR/Commit | 修复内容 | 影响 |
|-----------|----------|------|
| #3682 | 改进 chat session dropdown 刷新行为 | UI 体验 |
| #2950 | 聊天输入框自动扩展 (带高度限制) | 输入体验 |
| #3578 | Gateway URL 确认弹窗 | 配置体验 |
| #3635 | 配置输入字段 trim whitespace | 配置错误 |

### 2.5 其他重要修复

| PR/Commit | 修复内容 | 模块 |
|-----------|----------|------|
| #4118 | 保留代码块内的 reasoning tags | Agents |
| #3341 | TTS base URL 运行时读取 (honor config.env) | TTS |
| #3628 | 修复 text attachment MIME 分类错误 | Media |
| #3316 | 添加缺失的 audio/video MIME 类型映射 | Media |
| #2740 | inherit provider baseUrl/api for inline models | Models |
| #2576 | auto provider 模式正确应用 modelDefault | Models |
| #2471 | macOS 发送消息时自动滚动到底部 | macOS App |
| #3272 | 初始化 plugins 在 pairing CLI 注册之前 | CLI |
| #2490 | 识别版本化 Node 可执行文件 (如 node-22) | CLI |
| #2212 | 避免全局 help/version 时加载 config | CLI |
| #2318 | bootstrap memory 时包含 memory.md | Agents |

---

## 三、新功能清单 (可选融合)

### 3.1 模型/提供商

| 功能 | PR | 描述 |
|------|----|----|
| Xiaomi MiMo | #3454 | 支持 xiaomi/mimo-v2-flash 模型 |
| Kimi K2.5 | #4407 | 添加 Kimi K2.5 到 synthetic catalog |
| Venice claude-opus-45 | - | 识别 Venice 风格模型名为 claude-opus-4-5 |

### 3.2 Telegram 增强

| 功能 | PR | 描述 |
|------|----|----|
| Sticker 支持 | #2629, #2650 | sticker 收发 + vision caching |
| Quote 回复 | #2900 | 支持 partial message 引用回复 |
| Silent 消息 | #2382 | 静默发送 (禁用通知) |
| 编辑消息 | #2394 | message(action="edit") 支持 |

### 3.3 路由/配置增强

| 功能 | PR | 描述 |
|------|----|----|
| per-account DM scope | #3095 | 每账户 DM session 隔离 |
| Memory search paths | #3600 | 允许额外路径用于内存索引 |
| Session-memory count | #2681 | 可配置的 session-memory 消息数 |
| Per-sender group tool policies | #1757 | 每发送者群组工具策略 |

### 3.4 性能优化

| 功能 | PR | 描述 |
|------|----|----|
| Compile cache | #2808 | CLI 使用 Node 模块编译缓存 (~10% 提速) |
| Docker UI install | #4584 | 跳过冗余 UI 安装步骤 |

---

## 四、Windows 相关修复

本地项目专注 Windows 支持，以下上游修复与 Windows 兼容性相关：

| PR/Commit | 修复内容 | 重要性 |
|-----------|----------|--------|
| #3750 | XML escaping test 使用 `&` 替代 `<>` (NTFS 兼容) | 高 |
| - | 使用 fileURLToPath 改善 Windows 兼容性 | 中 |
| - | test: honor windows homedir env for legacy config | 中 |
| #1760 | 将 Windows 平台标签视为 Windows (node shell 选择) | 高 |
| #2403 | 正确测试 Windows ACL 审计 (config includes) | 高 |

---

## 五、融合优先级建议

### 🔴 高优先级 (安全/稳定性)
1. Gateway 网络错误处理 (#2980, #2451)
2. SSH target 安全加固 (#4001)
3. Session lock 清理 (#2483)
4. 图片大小错误处理 (#2871)
5. Windows ACL 审计修复 (#2403)

### 🟡 中优先级 (功能性 Bug)
1. Telegram 全部修复 (消息格式、视频笔记、proxy 等)
2. Discord username resolution
3. MIME 类型映射
4. CLI 初始化顺序修复

### 🟢 低优先级 (增强功能)
1. 新模型支持 (MiMo, Kimi K2.5)
2. Telegram 新功能 (sticker, quote, edit)
3. 性能优化 (compile cache)
4. UI 改进

---

## 六、融合步骤建议

### 步骤 1: 创建融合分支
```bash
git checkout -b feature/upstream-merge-2026.1.29
```

### 步骤 2: Cherry-pick 高优先级修复
按优先级选择性合并关键修复，避免品牌重塑带来的冲突。

### 步骤 3: 解决命名冲突
如保持 `clawdbot` 命名：
- 忽略所有 `refactor: rename to openclaw` 相关提交
- 手动移植具体修复代码
- 保持本地配置路径兼容

### 步骤 4: 测试验证
```bash
pnpm test
pnpm build
pnpm lint
```

### 步骤 5: 更新 CHANGELOG
记录融合的修复和功能。

---

## 七、待决问题

1. **品牌策略**: 是否跟进 openclaw 品牌重塑？
2. **认证变更**: 是否强制要求 gateway 认证？
3. **向后兼容**: 如何处理旧配置迁移？
4. **测试覆盖**: 部分修复需要新增测试用例

---

## 八、参考链接

- 上游 CHANGELOG: https://github.com/openclaw/openclaw/blob/main/CHANGELOG.md
- 上游 Releases: https://github.com/openclaw/openclaw/releases
- 文档: https://docs.openclaw.ai

---

*本文档基于上游 commit `da71eaebd` (2026.1.29 stable) 与本地 2026.1.25 版本对比生成*
