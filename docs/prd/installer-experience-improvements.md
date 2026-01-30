# 用户首次体验优化（安装 → 配置 → 验证）

> **创建日期**：2026-01-31  
> **来源**：竞品分析 - https://github.com/miaoxworld/ClawdBotInstaller  
> **分析视角**：产品经理 + 技术负责人 + UI/UX 交互设计  
> **关联文档**：[frontnewtodo.md](../frontnewtodo.md) — Web 向导页面深度优化

---

## 〇、用户旅程全景图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         用户首次使用完整旅程                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ① 下载安装        ② 配置向导           ③ 验证成功        ④ 日常使用      │
│   ┌─────────┐      ┌─────────────┐      ┌──────────┐      ┌──────────┐    │
│   │ 一键脚本 │ ───▶ │ /setup 6步  │ ───▶ │ 测试连接  │ ───▶ │ 开始对话  │    │
│   │ EXE安装  │      │  Web 向导   │      │ 确认可用  │      │          │    │
│   └─────────┘      └─────────────┘      └──────────┘      └──────────┘    │
│        │                  │                  │                             │
│        ▼                  ▼                  ▼                             │
│   ┌─────────┐      ┌─────────────┐      ┌──────────┐                      │
│   │ 本文档   │      │frontnewtodo│      │ 本文档    │                      │
│   │ P2~P4   │      │   覆盖     │      │ P0~P1    │                      │
│   └─────────┘      └─────────────┘      └──────────┘                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**体验目标**：用户从下载到「能正常对话」，全程 < 10 分钟，无需外部帮助。

---

## 一、核心差距总结（对标 ClawdBotInstaller）

| 维度 | ClawdBotInstaller ✅ | 我们现状 | 差距评级 |
|------|---------------------|---------|---------|
| 安装后下一步 | 明确告知「改配置用 config-menu」 | Web 向导存在，但安装脚本没说清楚 | 🟡 中 |
| 安装后验证 | 自动跑一次 API 测试，失败可重试 | 无，用户装完不知道能不能用 | 🔴 高 |
| 按厂商配置步骤 | 每个 AI/渠道都有「第一步…第二步」 | 文档偏技术，缺小白级分步指南 | 🔴 高 |
| 安全提示 | 安装开头有明确警告 | 无 | 🟡 中 |
| TTY 处理 | `curl|bash` 时正确从 /dev/tty 读输入 | 需确认是否已处理 | 🟡 待验证 |
| 独立配置入口 | `config-menu.sh` 可单独运行 | 依赖 `/setup` 或 `clawdbot onboard` | 🟢 低（已有替代） |

---

## 二、待办事项（按优先级排序）

### 🔴 P0：安装后 API 验证

**现状问题**：用户安装完成后，不知道配置是否正确、能否正常连接 AI 服务。

**ClawdBotInstaller 做法**：
```bash
# 配置完 API 后立即测试
clawdbot agent --local --to "+1234567890" --message "回复 OK"
# 失败可重试或重新配置
```

**改进方案**：

| 选项 | 实现方式 | 工作量 | 推荐 |
|------|---------|--------|-----|
| A | install.sh 完成后可选运行 `clawdbot health` 或 `clawdbot doctor` | 小 | ✅ |
| B | `/setup` 完成页增加「测试连接」按钮 | 中 | ✅ |
| C | 安装脚本结束前自动调一次 API 测试 | 中 | |

**建议**：同时做 A + B
- install.sh 结尾增加提示：`echo "运行 'clawdbot health' 验证配置"`
- `/setup` 完成页增加「测试 AI 连接」按钮，调用 `/api/health` 或简单对话测试

**落地位置**：
- `clawd.bot/public/install.sh`
- `src/gateway/setup-page.ts` Step 6 完成页

---

### 🔴 P1：按厂商/渠道的中文分步指南

**现状问题**：文档偏技术向，缺少「小白级」的分步骤说明。

**ClawdBotInstaller 做法**（以 Telegram 为例）：
```markdown
配置步骤:
1. 在 Telegram 中搜索 @BotFather
2. 发送 /newbot 创建新机器人
3. 按提示设置名称，获取 Bot Token
4. 搜索 @userinfobot 获取你的 User ID
5. 在配置菜单中输入以上信息
```

**改进方案**：

在 `docs/download-guide.md` 或独立文件中，为以下内容补充「第一步…第二步…」格式：

| 类型 | 需补充内容 |
|------|-----------|
| **AI 服务** | 硅基流动、通义千问、豆包、DeepSeek、Claude、OpenAI（含自定义 API 地址） |
| **消息渠道** | 钉钉、飞书、企业微信、Telegram、Discord |
| **自定义 API** | 如何填写 Base URL，什么是「自定义 Provider」 |

**模板格式**：
```markdown
### 配置硅基流动

**获取 API Key**：
1. 访问 https://cloud.siliconflow.cn/
2. 注册/登录账号
3. 点击「API密钥」→「创建密钥」
4. 复制密钥备用

**填写配置**：
1. 打开配置向导 `http://localhost:18789/setup`
2. 选择「硅基流动」
3. 粘贴 API Key
4. 模型选择「DeepSeek-V3」（推荐）
5. 点击「下一步」
```

**落地位置**：
- `docs/download-guide.md` 新增「四、各服务配置详解」章节
- 或独立文件 `docs/provider-setup-guides.md`

---

### 🟡 P2：安装脚本安全提示

**现状问题**：安装脚本开头没有安全警告。

**ClawdBotInstaller 做法**：
```bash
echo "⚠️ 警告: ClawdBot 需要完全的计算机权限"
echo "   不建议在主要工作电脑上安装，建议使用专用服务器或虚拟机"
if ! confirm "是否继续安装？"; then
    exit 0
fi
```

**改进方案**：

在 `clawd.bot/public/install.sh` 和 `install.ps1` 开头增加：

```bash
# install.sh
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  安全提示"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Clawdbot 是一个 AI 助手，可能需要以下权限："
echo "  • 执行系统命令"
echo "  • 读写文件"
echo "  • 访问网络"
echo ""
echo "💡 建议在专用服务器或虚拟机上安装"
echo ""
read -p "是否继续安装？[Y/n] " -n 1 -r
# ...
```

**落地位置**：
- `clawd.bot` 仓库的 `public/install.sh`
- `clawd.bot` 仓库的 `public/install.ps1`

---

### 🟡 P3：安装后「下一步」说明

**现状问题**：安装脚本完成后，没有明确告诉用户「配置在哪里改」「怎么验证」。

**ClawdBotInstaller 做法**：
```bash
echo "常用命令:"
echo "  clawdbot gateway start   # 启动服务"
echo "  clawdbot models status   # 查看模型配置"
echo "  clawdbot doctor          # 诊断问题"
echo ""
echo "📝 配置菜单: bash ./config-menu.sh"
echo "📚 官方文档: https://docs.clawd.bot/"
```

**改进方案**：

在 install.sh 结尾输出：

```bash
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 安装完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 配置向导（首次必做）："
echo "   打开浏览器访问 http://localhost:18789/setup"
echo ""
echo "🔧 常用命令："
echo "   clawdbot gateway start   # 启动服务"
echo "   clawdbot gateway status  # 查看状态"
echo "   clawdbot health          # 健康检查"
echo "   clawdbot doctor          # 诊断修复"
echo "   clawdbot onboard         # 重新配置"
echo ""
echo "📚 文档：https://docs.clawd.bot/"
echo ""
```

**落地位置**：
- `clawd.bot` 仓库的 `public/install.sh`
- `clawd.bot` 仓库的 `public/install.ps1`

---

### 🟡 P4：TTY 处理验证

**现状问题**：不确定 `curl ... | bash` 场景下是否正确处理了交互输入。

**ClawdBotInstaller 做法**：
```bash
# TTY 检测
if [ -t 0 ]; then
    TTY_INPUT="/dev/stdin"
else
    TTY_INPUT="/dev/tty"
fi

# 读取时使用
read response < "$TTY_INPUT"
```

**待验证**：
- [ ] 检查 `clawd.bot/public/install.sh` 是否已有类似处理
- [ ] 如果 onboarding 有交互步骤，验证 `curl|bash` 时是否正常

**落地位置**：
- `clawd.bot` 仓库的 `public/install.sh`

---

### 🟢 P5：可选的轻量配置菜单

**现状问题**：我们有 `/setup` Web 向导和 `clawdbot onboard`，但没有纯 Shell 的配置菜单。

**评估**：
- `/setup` Web 向导已足够友好
- `clawdbot onboard` 可完成大部分配置
- 独立 Shell 菜单优先级低

**建议**：
- 暂不实现独立 config-menu.sh
- 在文档中推荐：「事后改配置请访问 `/setup` 或运行 `clawdbot onboard`」
- 如有社区贡献的菜单脚本，可在文档中注明「第三方工具，仅供参考」

---

## 三、实施计划

| 优先级 | 任务 | 负责模块 | 预估工时 | 状态 |
|-------|------|---------|---------|------|
| P0 | 安装后 API 验证提示 | install.sh | 0.5h | ⬜ |
| P0 | /setup 完成页「测试连接」按钮 | setup-page.ts | 2h | ⬜ |
| P1 | 补充 AI 服务分步指南 | download-guide.md | 3h | ⬜ |
| P1 | 补充消息渠道分步指南 | download-guide.md | 2h | ⬜ |
| P2 | 安装脚本安全提示 | install.sh | 0.5h | ⬜ |
| P3 | 安装完成「下一步」说明 | install.sh | 0.5h | ⬜ |
| P4 | TTY 处理验证 | install.sh | 1h | ⬜ |

---

## 四、UI/UX 交互设计视角评估

### 4.1 当前问题

| 问题 | 影响 | 对应改进 |
|------|------|---------|
| **旅程断点**：安装脚本结束后，用户不知道下一步 | 用户迷失，可能放弃 | P3 解决 |
| **缺少「成功反馈」**：配置完没有验证环节 | 用户不确定是否成功 | P0 解决 |
| **信息层级不清**：install.sh 输出纯文本，无视觉引导 | 关键信息被淹没 | 使用分隔线+图标 |
| **两份文档各管一段**：本文档管安装，frontnewtodo 管向导 | 改进时容易遗漏衔接 | 旅程图已补充 |

### 4.2 关键交互衔接点

**衔接点 A：安装脚本 → Web 向导**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 安装完成！
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👉 下一步：打开浏览器访问
   http://localhost:18789/setup
   
   按向导完成 AI 服务配置（约 3 分钟）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**衔接点 B：Web 向导完成 → 验证成功**

```
┌─────────────────────────────────────────────────────────────┐
│  🎉 配置完成！                                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔍 测试 AI 连接                              [按钮]  │   │
│  │                                                      │   │
│  │ 点击验证 API Key 是否正确、能否正常对话             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  测试成功后，点击「开始使用」进入对话界面                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 与 frontnewtodo.md 的分工

| 文档 | 负责阶段 | 核心改进 |
|------|---------|---------|
| **本文档** | ① 安装前后 + ③ 验证 | 安全提示、下一步说明、API 验证 |
| **[frontnewtodo.md](../frontnewtodo.md)** | ② 配置向导 | 术语简化、步骤合并、默认值优化 |

---

## 五、技术实现视角评估

### 5.1 技术可行性

| 任务 | 技术方案 | 风险点 | 复杂度 |
|------|---------|--------|-------|
| P0: API 验证提示 | install.sh 加 echo | 无 | ⭐ |
| P0: 完成页测试按钮 | 调用 `/api/health` 或发送测试消息 | 需设计测试用例 | ⭐⭐ |
| P1: 分步指南 | 纯文档工作 | 无 | ⭐ |
| P2: 安全提示 | install.sh 加 echo + read | TTY 兼容 | ⭐ |
| P4: TTY 处理 | 参考竞品 `/dev/tty` 方案 | 需测试多场景 | ⭐⭐ |

### 5.2 代码改动点

| 文件 | 改动内容 | 行数估计 |
|------|---------|---------|
| `clawd.bot/public/install.sh` | 安全提示 + 完成输出 + TTY 处理 | +50 行 |
| `clawd.bot/public/install.ps1` | 同上 PowerShell 版本 | +40 行 |
| `src/gateway/setup-page.ts` | Step 6 增加「测试连接」按钮 | +100 行 |
| `docs/download-guide.md` | 新增分步指南章节 | +300 行 |

### 5.3 测试验收点

| 场景 | 验证点 |
|------|-------|
| `curl ... \| bash` | 安全提示能正常交互（TTY） |
| `./install.sh` 直接运行 | 同上 |
| Step 6 测试按钮 - 成功 | 显示 ✅ + 「开始使用」按钮高亮 |
| Step 6 测试按钮 - 失败 | 显示错误原因 + 「重新配置」入口 |

---

## 六、不采纳的点

| ClawdBotInstaller 功能 | 不采纳原因 |
|------------------------|-----------|
| 独立 config-menu.sh | `/setup` Web 向导已足够，维护成本高 |
| 在 Shell 里写 JSON 配置 | 逻辑重复，易与 CLI 不同步 |
| ASCII Art Banner | 锦上添花，优先级低 |
| 支持 xAI/智谱/MiniMax 等 | 需评估主仓库是否支持，不宜先在安装器里加 |

---

## 七、参考资料

- **竞品仓库**：https://github.com/miaoxworld/ClawdBotInstaller
- **竞品 install.sh**：https://raw.githubusercontent.com/miaoxworld/ClawdBotInstaller/main/install.sh
- **竞品 config-menu.sh**：https://raw.githubusercontent.com/miaoxworld/ClawdBotInstaller/main/config-menu.sh
- **关联文档**：[frontnewtodo.md](../frontnewtodo.md) — Web 向导页面深度优化

---

*文档创建：2026-01-31*  
*下次评审：完成 P0/P1 后*
