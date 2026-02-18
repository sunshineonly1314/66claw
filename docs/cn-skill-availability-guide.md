# Skills 中国可用性指南

## 📊 概览

本指南提供了 OpenClawCN 项目中所有 Skills（包括 MCP Servers 和内置 Extensions）的中国可用性分析。

### 统计数据

- **总计 Skills**: 9,569 个
- **✅ 中国可用**: 7,696 个 (80.4%)
- **🌐 需要外网**: 1,668 个 (17.4%)
- **❓ 待确认**: 205 个 (2.1%)
- **🖥️ 平台限制**: 131 个

### 分类分布

| 分类 | 数量 | 说明 |
|------|------|------|
| other | 4,033 | 其他类型 |
| ai | 1,503 | AI 相关服务 |
| development | 1,440 | 开发工具 |
| search | 919 | 搜索引擎 |
| network | 800 | 网络工具 |
| filesystem | 453 | 文件系统 |
| database | 355 | 数据库 |
| extension | 34 | 内置扩展 |

---

## 🔍 快速查询工具

我们提供了便捷的命令行查询工具，可以快速检索 Skills 的可用性信息。

### 安装和使用

```bash
# 1. 查看统计摘要
pnpm tsx scripts/query-skill-availability.ts

# 2. 列出所有中国可用的 Skills
pnpm tsx scripts/query-skill-availability.ts --available

# 3. 列出需要外网的 Skills
pnpm tsx scripts/query-skill-availability.ts --vpn

# 4. 列出 macOS 专属的 Skills
pnpm tsx scripts/query-skill-availability.ts --macos

# 5. 搜索关键词
pnpm tsx scripts/query-skill-availability.ts --search map
pnpm tsx scripts/query-skill-availability.ts --search 阿里云

# 6. 按分类查询
pnpm tsx scripts/query-skill-availability.ts --category ai
pnpm tsx scripts/query-skill-availability.ts --category search

# 7. 查询特定 Skill 详情
pnpm tsx scripts/query-skill-availability.ts --id extension:feishu
pnpm tsx scripts/query-skill-availability.ts --id @amap-amap-maps
```

### 查询输出示例

```bash
$ pnpm tsx scripts/query-skill-availability.ts --id extension:feishu

✅ Loaded 9569 skills from dictionary

📦 Skill 详情:

ID: extension:feishu
名称: feishu (feishu)
类型: extension
分类: extension
描述: 内置 feishu 扩展

🌏 中国可用性:
  状态: ✅ available
  置信度: 100.0%
  原因:
    - 国内服务,完全可用

🖥️  平台支持:
  支持: linux, darwin, win32

📊 元数据:
  来源: extension
  版本: internal
  工具数: 0
```

---

## 🇨🇳 中国友好的 Skills 推荐

### 办公协作

| Skill ID | 名称 | 说明 |
|----------|------|------|
| `extension:feishu` | 飞书 | 字节跳动办公套件，完全可用 |
| `extension:dingtalk` | 钉钉 | 阿里巴巴办公平台，完全可用 |
| `extension:wecom` | 企业微信 | 腾讯企业办公，完全可用 |
| `extension:openclawwechat` | 微信个人号 | WeChat 个人账号集成 |
| `extension:qqbot` | QQ 机器人 | 腾讯 QQ 机器人接口 |

### 地图服务

| Skill ID | 名称 | 说明 |
|----------|------|------|
| `@amap-amap-maps` | 高德地图 | 国内领先地图服务 |
| `@baidu-maps-mcp` | 百度地图 | 百度地图 API |
| `slcatwujian-bing-cn-mcp-server` | 必应搜索中文 | 必应搜索，国内可用 |

### AI 服务（国内）

| Skill ID | 名称 | 说明 |
|----------|------|------|
| `qwen-portal-auth` | 通义千问 | 阿里云 AI 大模型 |
| `minimax-portal-auth` | MiniMax | 国产 AI 模型 |
| `dashscope-*` | 灵积平台 | 阿里云 AI 服务 |

### 支付服务

| Skill ID | 名称 | 说明 |
|----------|------|------|
| `Alipay-alipay-subscription` | 支付宝订阅 | 支付宝支付接口 |
| WeChat Pay 相关 | 微信支付 | 腾讯支付服务 |

### 文档管理

| Skill ID | 名称 | 说明 |
|----------|------|------|
| `dingtalk-DingTalk-Docs` | 钉钉文档 | 钉钉云端办公文档 |
| 飞书文档相关 | 飞书 Docs | 字节跳动云文档 |

---

## 🌐 需要外网的 Skills（可通过 VPN 访问）

### 国际办公协作

| Skill ID | 名称 | 说明 | 替代方案 |
|----------|------|------|----------|
| `extension:slack` | Slack | 国际团队协作 | 钉钉、飞书 |
| `extension:discord` | Discord | 游戏社区平台 | QQ、微信群 |
| `extension:telegram` | Telegram | 即时通讯 | 微信、QQ |
| `extension:msteams` | Microsoft Teams | 微软团队协作 | 钉钉、飞书 |
| `extension:notion` | Notion | 知识管理 | 语雀、FlowUs |

### AI 服务（国际）

| Skill ID | 名称 | 说明 | 替代方案 |
|----------|------|------|----------|
| OpenAI 相关 | GPT/DALL-E | OpenAI API | 通义千问、文心一言 |
| Anthropic 相关 | Claude | Anthropic API | 通义千问、文心一言 |
| Google 相关 | Gemini | Google AI | 通义千问、文心一言 |
| Cohere 相关 | Cohere | Cohere API | 百度 ERNIE |

### 云服务

| Skill ID | 名称 | 说明 | 替代方案 |
|----------|------|------|----------|
| AWS 相关 | Amazon Web Services | 亚马逊云 | 阿里云、腾讯云 |
| GCP 相关 | Google Cloud | 谷歌云 | 阿里云、腾讯云 |
| Azure 相关 | Microsoft Azure | 微软云 | Azure 中国、阿里云 |

### 开发工具

| Skill ID | 名称 | 说明 | 替代方案 |
|----------|------|------|----------|
| GitHub 相关 | GitHub | 代码托管 | Gitee、Coding |
| Vercel 相关 | Vercel | 部署平台 | Cloudflare、阿里云 |
| Netlify 相关 | Netlify | 静态托管 | 阿里云 OSS |

---

## 🖥️ 平台限制说明

### macOS 专属 Skills

以下 Skills 仅在 macOS 平台可用：

| Skill ID | 名称 | 说明 |
|----------|------|------|
| `extension:imessage` | iMessage | 苹果 iMessage 集成 |
| `extension:bluebubbles` | BlueBubbles | iMessage 桥接服务 |

**原因**: 依赖 macOS 系统框架（Keychain、AppleScript、CoreData）

### Windows 专属 Skills

部分 Skills 依赖 Windows Registry、Win32 API 等，仅在 Windows 平台可用。

### Linux 专属 Skills

部分 Skills 依赖 systemd、dbus 等 Linux 特有组件。

---

## 📖 API 替换指南

### OpenAI → 国内替代

如果某个 Skill 依赖 OpenAI API，可以通过以下方式替换：

#### 1. 阿里云通义千问 (DashScope)

```json
{
  "model": "qwen-turbo",
  "apiKey": "YOUR_DASHSCOPE_API_KEY",
  "baseURL": "https://dashscope.aliyuncs.com/compatible-mode/v1"
}
```

#### 2. 百度文心一言 (ERNIE)

```json
{
  "model": "ernie-4.0-8k",
  "apiKey": "YOUR_BAIDU_API_KEY",
  "baseURL": "https://aip.baidubce.com/rpc/2.0/ai_custom/v1"
}
```

#### 3. 腾讯混元 (Hunyuan)

```json
{
  "model": "hunyuan-standard",
  "apiKey": "YOUR_TENCENT_API_KEY",
  "baseURL": "https://hunyuan.tencentcloudapi.com"
}
```

### GitHub → Gitee

如果 Skill 依赖 GitHub API：

```bash
# 替换为 Gitee API
https://api.github.com → https://gitee.com/api/v5
```

### Google Maps → 高德地图

```bash
# 替换为高德地图 API
https://maps.googleapis.com → https://restapi.amap.com/v3
```

---

## 🔄 自动化分析流程

本字典表由自动化脚本生成，分析流程如下：

### 1. 数据源

- **MCP Index**: `data/mcp-index.json` (9,535 个 MCP servers)
- **Extensions**: `extensions/*/clawdbot.plugin.json` (34 个内置扩展)

### 2. 检测规则

#### 域名分析
- 检测是否依赖被屏蔽域名（google.com、openai.com 等）
- 检测是否使用国内友好域名（aliyun.com、baidu.com 等）

#### 关键词匹配
- 搜索描述中的服务关键词（AWS、Azure、Stripe 等）
- 识别国内服务名称（阿里云、腾讯云、百度等）

#### 平台限制
- 检测 macOS 特定 API（Keychain、AppleScript）
- 检测 Windows 特定 API（Registry、Win32）
- 检测 Linux 特定组件（systemd、dbus）

### 3. 置信度计算

- **0.9-1.0**: 高置信度，明确可用或不可用
- **0.7-0.9**: 较高置信度，根据关键词推断
- **0.5-0.7**: 中等置信度，需要进一步验证
- **< 0.5**: 低置信度，标记为 unknown

### 4. 生成输出

- `data/skill-availability-dictionary.json` - 完整字典表（7.68 MB）
- `data/skill-verification-needed.json` - 需要人工复核的列表（409 个）

---

## 🛠️ 开发者指南

### 更新字典表

```bash
# 重新运行分析器
pnpm tsx scripts/analyze-skill-availability.ts

# 这将生成/更新以下文件:
# - data/skill-availability-dictionary.json
# - data/skill-verification-needed.json
```

### 数据结构

```typescript
interface SkillAvailability {
  id: string;                    // Skill 唯一标识
  type: "mcp" | "extension";     // 类型
  name: string;                  // 显示名称
  category: string;              // 分类
  availability: {
    china: {
      status: "available" | "vpn-required" | "blocked" | "unknown";
      confidence: number;        // 0.0 - 1.0
      reasons: string[];         // 判断原因
      alternatives: string[];    // 替代方案建议
    };
    platforms: {
      supported: string[];       // 支持的平台
      restrictions: string[];    // 平台限制说明
    };
  };
}
```

### API 使用示例

```typescript
import skillDict from "./data/skill-availability-dictionary.json";

// 查找所有中国可用的 AI Skills
const availableAI = skillDict.skills.filter(
  (s) => s.category === "ai" && s.availability.china.status === "available"
);

console.log(`中国可用的 AI Skills: ${availableAI.length} 个`);
```

---

## 📋 人工复核清单

有 **409 个 Skills** 的置信度 < 0.8，需要人工验证。查看完整列表：

```bash
cat data/skill-verification-needed.json
```

### 复核流程

1. 检查 Skill 的官方文档
2. 验证 API endpoint 是否在中国可访问
3. 测试实际功能是否正常
4. 更新 `skill-availability-dictionary.json` 中的 `manualVerified` 字段

### 贡献方式

如果你验证了某个 Skill 的可用性，欢迎提交 PR：

```json
{
  "id": "example-skill",
  "availability": {
    "china": {
      "status": "available",  // 更新状态
      "confidence": 1.0       // 提升置信度
    }
  },
  "classification": {
    "manualVerified": true,
    "verifiedBy": "your-name",
    "verifiedAt": "2026-02-17T00:00:00.000Z"
  }
}
```

---

## 🎯 最佳实践

### 1. 优先使用国内服务

- ✅ 使用飞书/钉钉替代 Slack
- ✅ 使用高德地图替代 Google Maps
- ✅ 使用通义千问替代 OpenAI

### 2. 配置代理访问国际服务

```bash
# 设置代理环境变量
export HTTP_PROXY=http://127.0.0.1:7890
export HTTPS_PROXY=http://127.0.0.1:7890

# 或在配置文件中指定
{
  "proxy": {
    "enabled": true,
    "http": "http://127.0.0.1:7890",
    "https": "http://127.0.0.1:7890"
  }
}
```

### 3. API Key 管理

- 国内服务的 API Key 通常更容易获取
- 国际服务可能需要信用卡或外币支付
- 建议同时配置国内和国际服务作为备选

### 4. 平台选择

- macOS 用户可使用 iMessage、BlueBubbles 等专属功能
- Windows/Linux 用户优先选择跨平台 Skills
- 检查 Skill 的 `platforms.supported` 字段确保兼容性

---

## 📞 问题反馈

如果你发现字典表中的信息有误，或者有新的 Skill 需要添加，请：

1. 提交 GitHub Issue: https://github.com/your-repo/issues
2. 加入社区讨论: [Discord/Telegram/微信群]
3. 提交 Pull Request 更新字典表

---

## 📄 许可证

本字典表遵循 MIT License 开源协议。

---

**最后更新**: 2026-02-17
**字典版本**: v1.0.0
**总计 Skills**: 9,569 个
**自动化分析置信度**: 95.7%
