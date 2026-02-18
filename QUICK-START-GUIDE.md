# 微信自动化客服快速开始指南

> 🎯 **目标**: 5分钟内启动一个安全、防检测的微信自动回复客服
>
> 🛡️ **防护**: 集成10项防抓包 + 8项防检测机制

---

## 📋 前置要求

### 1. 软件环境

| 软件 | 版本 | 获取链接 |
|------|------|----------|
| Node.js | ≥ 18.0 | https://nodejs.org/ |
| 微信 | 最新版 | 手机端正常使用即可 |

### 2. 申请 API Key

#### ClawChat API (微信桥接服务)

1. 微信搜索小程序 **"ClawChat"**
2. 进入小程序 → 点击右上角"设置"
3. 找到"API密钥" → 点击"生成新密钥"
4. 复制密钥 (格式: `cc_xxx:xxxxxxxx`)

#### 通义千问 API (AI模型)

1. 访问 https://dashscope.console.aliyun.com/apiKey
2. 登录阿里云账号 (支持淘宝账号登录)
3. 点击"创建新的API-KEY"
4. 复制密钥 (格式: `sk-xxxxxxxx`)

---

## 🚀 快速启动 (Windows)

### 方法一: 一键启动 (推荐)

```batch
# 1. 下载项目
git clone https://github.com/anthropics/clawdbot.git
cd clawdbot

# 2. 双击运行启动脚本
quick-start-wechat-advanced.bat
```

脚本会自动:
- ✅ 检查 Node.js 环境
- ✅ 创建配置文件
- ✅ 引导填写 API Key
- ✅ 安装依赖
- ✅ 运行测试
- ✅ 启动服务

### 方法二: 手动启动

#### 步骤1: 安装依赖

```bash
npm install
```

#### 步骤2: 配置文件

复制配置模板:

```bash
copy test-wechat-safe.json5 %USERPROFILE%\.openclawcn\config.json5
```

编辑配置文件 (打开 `%USERPROFILE%\.openclawcn\config.json5`):

```json5
{
  plugins: {
    entries: {
      openclawwechat: {
        config: {
          // 填入你的 ClawChat API Key
          apiKey: "cc_xxx:xxxxxxxx",  // ← 替换这里
        }
      }
    }
  },

  models: {
    providers: {
      "qwen-dashscope": {
        // 填入你的通义千问 API Key
        apiKey: "sk-xxxxxxxx",  // ← 替换这里
      }
    }
  }
}
```

#### 步骤3: 运行测试

```bash
# 测试1: 高级防抓包
node advanced-anti-sniffing.mjs

# 测试2: 防检测机制
node test-wechat-anti-detection.mjs
```

#### 步骤4: 启动服务

```bash
# 开发模式
npx tsx src/gateway/server.ts

# 或构建后运行
npm run build
node dist/gateway/server.js
```

---

## 🧪 测试验证

### 1. 服务启动检查

启动后应看到:

```
🌐 OpenClawCN Gateway 已启动
   地址: http://localhost:18789
   防护: ✅ 防检测 + ✅ 防抓包
```

### 2. 微信消息测试

用**另一个微信号**给你的客服号发消息:

| 测试场景 | 发送内容 | 期望结果 |
|---------|---------|----------|
| 基础回复 | "你好" | 2-8秒后收到回复 |
| 黑名单拦截 | "测试一下" | 不会回复 (包含"测试") |
| 限流测试 | 连发10条 | 前30条正常，超过后不回 |
| 夜间静默 | 00:00-07:00发送 | 不会回复 |

### 3. 防护验证

#### 观察回复延迟

```
消息1 → 等待 3.2秒 → 回复  ✅ 随机
消息2 → 等待 5.7秒 → 回复  ✅ 随机
消息3 → 等待 2.9秒 → 回复  ✅ 随机
```

如果延迟固定 (如都是3秒), 则防护未生效!

#### 检查日志

查看 `%USERPROFILE%\.openclawcn\logs\gateway.log`:

```
[防抓包] User-Agent: Chrome 120  ← 应该每次不同
[防抓包] Request-ID: 50335c58-... ← 应该每次不同
[防检测] 延迟: 3245ms ← 应该在 2000-8000ms 之间
[限流] 本小时回复: 12/30 ← 不应超过30
```

---

## 🔧 配置调优

### 防检测参数

```json5
antiDetection: {
  // 回复延迟 (秒)
  replyDelayMin: 2,      // ⚙️ 调整: 最少等待时间
  replyDelayMax: 8,      // ⚙️ 调整: 最多等待时间

  // 限流设置
  maxRepliesPerHour: 30,  // ⚙️ 调整: 每小时最多回复数
  maxRepliesPerDay: 100,  // ⚙️ 调整: 每天最多回复数

  // 黑名单关键词
  blacklistKeywords: [
    "测试",           // ⚙️ 添加: 不想回复的关键词
    "机器人",
  ],

  // 白名单用户 (留空=回复所有人)
  whitelistUsers: [],    // ⚙️ 添加: 只回复特定用户
}
```

### 推荐配置场景

#### 场景1: 个人助理 (低风险)

```json5
{
  replyDelayMin: 2,
  replyDelayMax: 8,
  maxRepliesPerHour: 30,
  maxRepliesPerDay: 100,
}
```

#### 场景2: 小型客服 (中风险)

```json5
{
  replyDelayMin: 3,
  replyDelayMax: 10,
  maxRepliesPerHour: 20,   // ← 更严格
  maxRepliesPerDay: 60,    // ← 更严格
}
```

#### 场景3: 高频客服 (⚠️ 不推荐)

```json5
{
  replyDelayMin: 1,
  replyDelayMax: 5,
  maxRepliesPerHour: 60,   // ⚠️ 风险高
  maxRepliesPerDay: 200,   // ⚠️ 风险高
}
```

---

## 🛡️ 安全建议

### ✅ 推荐做法

1. **小规模测试**: 先测试1周，每天<50条
2. **定期检查**: 每天查看日志，确认无异常
3. **备用方案**: 保持手动回复能力
4. **监控限流**: 观察是否触发限流
5. **调整策略**: 根据实际情况优化参数

### ❌ 避免操作

1. ❌ 不要关闭防检测 (replyDelayMin=0)
2. ❌ 不要关闭限流 (maxRepliesPerHour=999)
3. ❌ 不要全天24小时回复 (删除quietHours)
4. ❌ 不要回复所有消息 (空白名单+空黑名单)
5. ❌ 不要用于营销群发

---

## 🚨 故障排查

### 问题1: 服务启动失败

**现象**: 双击脚本后立即关闭

**解决**:

```bash
# 在命令行运行，查看错误信息
cmd
cd d:\codeknowledge\clawdbot-main\clawdbot-main
quick-start-wechat-advanced.bat
```

常见错误:
- `Node.js 未安装` → 安装 Node.js
- `找不到配置文件` → 检查 config.json5 是否存在
- `API Key 错误` → 检查密钥格式

### 问题2: 收不到回复

**检查清单**:

- [ ] 服务是否正在运行? (窗口未关闭)
- [ ] API Key 是否正确? (检查配置文件)
- [ ] 消息是否被黑名单拦截? (查看日志)
- [ ] 是否超过限流? (查看统计)
- [ ] 是否在夜间静默时段? (00:00-07:00)

**日志检查**:

```bash
# 查看最新日志
type %USERPROFILE%\.openclawcn\logs\gateway.log
```

### 问题3: 回复过快/过慢

**调整延迟**:

编辑 `config.json5`:

```json5
// 回复太快 → 增加延迟
replyDelayMin: 3,  // 2 → 3
replyDelayMax: 12, // 8 → 12

// 回复太慢 → 减少延迟
replyDelayMin: 1,  // 2 → 1
replyDelayMax: 5,  // 8 → 5
```

### 问题4: API 额度不足

**通义千问免费额度**:

- 免费: 100万 tokens/月
- 约等于: 1000-2000条消息
- 超额: 需充值或切换模型

**解决方案**:

1. 切换到免费模型 (qwen-turbo)
2. 减少 maxTokens (500 → 200)
3. 启用更严格限流 (30 → 20/小时)

---

## 📊 监控指标

### 关键指标

定期检查以下数据:

| 指标 | 正常值 | 异常值 | 处理 |
|------|--------|--------|------|
| 回复延迟 | 2-8秒随机 | 固定3秒 | 检查防护 |
| 每小时回复 | <30条 | >50条 | 降低限流 |
| 失败率 | <1% | >10% | 检查API |
| User-Agent种类 | 3-5种 | 1种 | 检查防抓包 |

### 查看统计

```bash
# 查看今日统计
node -e "
const fs = require('fs');
const log = fs.readFileSync(process.env.USERPROFILE + '/.openclawcn/logs/gateway.log', 'utf8');
const replies = log.match(/\[回复\]/g)?.length || 0;
console.log('今日回复:', replies);
"
```

---

## 🎯 下一步

完成快速启动后，可以:

1. 📖 阅读 [ANTI-SNIFFING-GUIDE.md](./ANTI-SNIFFING-GUIDE.md) - 了解防护原理
2. 📖 阅读 [ADVANCED-ANTI-SNIFFING-COMPLETE.md](./ADVANCED-ANTI-SNIFFING-COMPLETE.md) - 高级策略详解
3. 🔧 自定义 System Prompt - 调整客服话术
4. 🔧 接入其他模型 - 如 GPT、Claude
5. 🔧 添加更多渠道 - 如钉钉、飞书

---

## ⚠️ 免责声明

本指南仅供学习和合法安全防护使用。使用者需:

- ✅ 遵守微信用户协议
- ✅ 遵守相关法律法规
- ✅ 自行承担使用风险
- ❌ 不得用于营销群发
- ❌ 不得用于恶意用途

---

**文档版本**: v1.0
**最后更新**: 2026-02-18
**测试状态**: ✅ 已验证

有问题? 查看 [故障排查](#故障排查) 或提交 Issue
