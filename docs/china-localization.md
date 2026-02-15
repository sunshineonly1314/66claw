# OpenClawCN 中国本地化指南

本文档介绍如何配置 OpenClawCN 以支持国产大模型和企业 IM 渠道（飞书/钉钉）。

## 概述

本次改造包含以下内容：

1. **国产大模型支持** - 通义千问、豆包、DeepSeek、智谱 GLM
2. **企业 IM 渠道** - 飞书、钉钉插件骨架
3. **UI 国际化** - 支持中英文切换

---

## 一、国产大模型配置

### 1.1 支持的模型

| 厂商 | Provider ID | 模型列表 | API 申请 |
|------|-------------|----------|----------|
| 阿里云通义千问 | `qwen-dashscope` | qwen-max, qwen-plus, qwen-turbo, qwen-vl-max, qwen-coder-plus | [DashScope 控制台](https://dashscope.console.aliyun.com/) |
| 字节跳动豆包 | `doubao` | 需要创建推理接入点 | [火山引擎控制台](https://console.volcengine.com/ark) |
| DeepSeek | `deepseek` | deepseek-chat, deepseek-coder, deepseek-reasoner | [DeepSeek 平台](https://platform.deepseek.com/) |
| 智谱 AI | `glm` | glm-4-plus, glm-4, glm-4-flash, glm-4v-plus, codegeex-4 | [智谱开放平台](https://open.bigmodel.cn/) |

### 1.2 配置方式

#### 方式一：环境变量（推荐）

设置以下环境变量，系统会自动发现并加载对应的模型：

```bash
# 通义千问
export DASHSCOPE_API_KEY="your-api-key"

# 豆包
export DOUBAO_API_KEY="your-api-key"
# 或
export ARK_API_KEY="your-api-key"

# DeepSeek
export DEEPSEEK_API_KEY="your-api-key"

# 智谱 GLM
export ZHIPU_API_KEY="your-api-key"
# 或
export GLM_API_KEY="your-api-key"
```

#### 方式二：配置文件

在 `~/.openclawcn/config.json5` 中添加配置：

```json5
{
  models: {
    providers: {
      "qwen-dashscope": {
        baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        apiKey: "YOUR_API_KEY",
        api: "openai-completions",
        models: [
          { id: "qwen-max", name: "通义千问 Max", input: ["text"], contextWindow: 32000 }
        ]
      }
    }
  }
}
```

完整配置示例见：[config.china.example.json5](/config.china.example.json5)

### 1.3 豆包特殊说明

豆包（火山引擎）需要先在控制台创建**推理接入点**：

1. 登录 [火山引擎控制台](https://console.volcengine.com/ark)
2. 进入「模型推理」→「推理接入点」
3. 创建接入点，选择需要的模型
4. 获取接入点 ID（格式如 `ep-20240xxx-xxxxx`）
5. 在配置中使用接入点 ID 作为模型 ID

---

## 二、飞书/钉钉渠道

### 2.1 插件位置

- 飞书: `extensions/feishu/`
- 钉钉: `extensions/dingtalk/`

### 2.2 飞书配置

#### 2.2.1 创建飞书应用

1. 登录 [飞书开放平台](https://open.feishu.cn/)
2. 创建企业自建应用
3. 获取 App ID 和 App Secret
4. 配置机器人能力
5. 配置事件订阅：
   - 订阅「接收消息」事件
   - 获取 Verification Token
   - 配置回调地址

#### 2.2.2 配置示例

```json5
{
  channels: {
    feishu: {
      enabled: true,
      app: {
        appId: "cli_xxxxxx",
        appSecret: "xxxxxx",
        verificationToken: "xxxxxx",
      },
      webhookPort: 3001,
      webhookPath: "/feishu/webhook",
      dmPolicy: "pairing",
      groupPolicy: "allowlist",
    }
  }
}
```

#### 2.2.3 待实现功能 (TODO)

飞书插件骨架已创建，以下功能需要实现：

- [ ] `getFeishuAccessToken()` - 获取访问令牌
- [ ] `sendFeishuMessage()` - 发送消息
- [ ] `probeFeishu()` - 连接探测
- [ ] `monitorFeishuProvider()` - Webhook 服务器

相关文件：`extensions/feishu/src/channel.ts`

### 2.3 钉钉配置

#### 2.3.1 创建钉钉应用

1. 登录 [钉钉开放平台](https://open-dev.dingtalk.com/)
2. 创建企业内部应用
3. 获取 AppKey 和 AppSecret
4. 配置机器人
5. 配置消息接收地址

#### 2.3.2 配置示例

```json5
{
  channels: {
    dingtalk: {
      enabled: true,
      app: {
        appKey: "dingxxxxxx",
        appSecret: "xxxxxx",
      },
      webhookPort: 3002,
      webhookPath: "/dingtalk/webhook",
      dmPolicy: "pairing",
      groupPolicy: "allowlist",
    }
  }
}
```

#### 2.3.3 待实现功能 (TODO)

钉钉插件骨架已创建，以下功能需要实现：

- [ ] `getDingtalkAccessToken()` - 获取访问令牌
- [ ] `sendDingtalkMessage()` - 发送消息
- [ ] `probeDingtalk()` - 连接探测
- [ ] `monitorDingtalkProvider()` - Webhook 服务器

相关文件：`extensions/dingtalk/src/channel.ts`

---

## 三、UI 国际化

### 3.1 使用方式

UI 支持中英文切换，系统会自动检测浏览器语言。

#### 手动切换语言

```typescript
import { setLocale } from './i18n/index.js';

// 切换到中文
setLocale('zh-CN');

// 切换到英文
setLocale('en');
```

#### 获取翻译文本

```typescript
import { t } from './i18n/index.js';

// 简单翻译
const title = t('nav.chat'); // "对话" 或 "Chat"

// 带参数的翻译
const msg = t('chat.queueCount', { count: 5 }); // "队列中有 5 条"
```

### 3.2 翻译文件

- 英文: `ui/src/ui/i18n/locales/en.ts`
- 中文: `ui/src/ui/i18n/locales/zh-CN.ts`

### 3.3 添加新翻译

1. 在 `en.ts` 中添加新的翻译键值
2. 在 `zh-CN.ts` 中添加对应的中文翻译
3. 在代码中使用 `t('your.key')` 调用

---

## 四、快速开始

### 4.1 安装依赖

```bash
pnpm install
```

### 4.2 配置

1. 复制示例配置：
   ```bash
   cp config.china.example.json5 ~/.openclawcn/config.json5
   ```

2. 编辑配置文件，填入你的 API Key

### 4.3 启用插件

```bash
openclawcn plugins enable feishu
openclawcn plugins enable dingtalk
```

### 4.4 启动网关

```bash
openclawcn gateway run
```

### 4.5 访问 UI

打开浏览器访问 `http://127.0.0.1:18789`

---

## 五、文件清单

### 5.1 新增文件

```
# 国产模型支持
src/agents/models-config.providers.ts  # 修改：添加国产模型配置

# 飞书插件
extensions/feishu/
├── openclawcn.plugin.json
├── package.json
├── index.ts
└── src/
    ├── channel.ts
    ├── runtime.ts
    └── types.ts

# 钉钉插件
extensions/dingtalk/
├── openclawcn.plugin.json
├── package.json
├── index.ts
└── src/
    ├── channel.ts
    ├── runtime.ts
    └── types.ts

# UI 国际化
ui/src/ui/i18n/
├── index.ts
└── locales/
    ├── en.ts
    └── zh-CN.ts

ui/src/ui/navigation.ts  # 修改：添加翻译支持

# 配置示例
config.china.example.json5

# 文档
docs/china-localization.md
```

### 5.2 修改文件

| 文件 | 修改内容 |
|------|----------|
| `src/agents/models-config.providers.ts` | 添加国产模型 Provider 配置和自动发现 |
| `ui/src/ui/navigation.ts` | 导入 i18n 并使用翻译函数 |

---

## 六、后续工作

### 6.1 飞书/钉钉实现

需要实现的核心功能：

1. **Token 管理** - 获取和刷新 Access Token
2. **消息发送** - 支持文本、图片、文件、卡片消息
3. **Webhook 接收** - HTTP 服务器监听回调
4. **消息解析** - 处理各种消息类型
5. **签名验证** - 确保消息来源安全

### 6.2 UI 翻译完善

当前已翻译的组件：
- 导航栏 (navigation.ts)
- 翻译文件包含约 200 条翻译

待翻译的组件：
- 概览页 (overview.ts)
- 聊天页 (chat.ts)
- 渠道页 (channels.ts)
- 会话页 (sessions.ts)
- 其他视图组件

### 6.3 测试

- [ ] 国产模型 API 连通性测试
- [ ] 飞书 Webhook 接收测试
- [ ] 钉钉 Webhook 接收测试
- [ ] UI 中英文切换测试

---

## 七、参考链接

### 模型 API 文档

- [通义千问 API](https://help.aliyun.com/zh/model-studio/developer-reference/compatibility-of-openai-with-dashscope)
- [豆包 API](https://www.volcengine.com/docs/82379/1298454)
- [DeepSeek API](https://platform.deepseek.com/api-docs/)
- [智谱 GLM API](https://open.bigmodel.cn/dev/api/normal-model/glm-4)

### 渠道开发文档

- [飞书开放平台](https://open.feishu.cn/document/)
- [钉钉开放平台](https://open.dingtalk.com/document/)
