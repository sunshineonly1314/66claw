# 个人微信渠道配置指南

让你的个人微信号变身 AI 助手 — 别人给你发微信，AI 自动回复。

**你需要的东西：**
- 一个微信号（你自己的就行）
- OpenClawCN 已安装并能运行

**你不需要：**
- 不需要公网 IP / 服务器
- 不需要企业微信 / 企业认证
- 不需要翻墙 / VPN

**整个过程大约 5 分钟。**

> **什么是「终端」？** 本指南中有些步骤需要在电脑上输入命令。输入命令的地方叫「终端」（也叫命令行、命令提示符）。打开方法：
> - **Windows**：按键盘上的 `Win + R`，在弹出的窗口里输入 `cmd`，按回车键
> - **Mac**：按 `Command + 空格`，输入 `Terminal`，按回车键
> - **Linux**：按 `Ctrl + Alt + T`
>
> 打开后会出现一个黑色（或白色）的窗口，在里面输入命令后按**回车键**就会执行。

---

## 它是怎么工作的？

```
别人发微信给你 → ClawChat 把消息转给 AI → AI 想好回复 → 通过微信自动回复对方
```

ClawChat 是一个桥接服务。你把微信号绑定到 ClawChat 后，别人发给你的微信消息会被 ClawChat 转发给 OpenClawCN 的 AI，AI 处理完后把回复通过微信发回给对方。

你的微信号照常使用，不影响你自己收发消息。

---

## 开始配置

### 步骤 1：打开 ClawChat 小程序

1. 打开你的微信
2. 点击顶部的**搜索栏**（放大镜图标）
3. 输入「**ClawChat**」，搜索
4. 在搜索结果中找到 ClawChat **小程序**，点击进入
5. 如果是第一次使用，会弹出**微信授权**页面，点击「允许」即可完成注册

> 不需要填写任何信息，微信授权就是注册。

### 步骤 2：绑定你的微信号

1. 进入 ClawChat 小程序后，页面会引导你绑定微信号
2. 按照页面提示**扫码绑定**
3. 等待页面显示**绑定成功**

**这一步做完后，别人发给你的微信消息就会被 ClawChat 接收到了。**

> **说明：** 绑定的就是你现在用的这个微信号。绑定后你的微信正常使用，消息只是额外被 ClawChat 转发一份给 AI 处理。

### 步骤 3：生成 API Key（连接密钥）

API Key 是 OpenClawCN 连接 ClawChat 的"通行证"。

1. 在 ClawChat 小程序里，点击底部导航栏的「**我的**」
2. 找到「**APIKey 管理**」，点进去
3. 点击「**生成 APIKey**」按钮
4. 页面会显示一串字符，这就是你的 API Key
5. **长按这串字符，选择「复制」**

**API Key 长什么样：**

```
12345:abcdef1234567890
^^^^^ ^^^^^^^^^^^^^^^^
bot_id    secret
```

- 中间有一个**冒号** `:`，这是正常的格式
- 复制的时候**一定要完整复制**，包括冒号和后面的部分
- **不要告诉别人你的 API Key**，它等同于密码

### 步骤 4：把 API Key 填到 OpenClawCN 里

现在你手上有了 API Key，需要告诉 OpenClawCN 用它来连接 ClawChat。

三种方式任选其一：

#### 方式 A：命令行向导（推荐新手）

打开终端（不知道怎么打开？看本页最上面的说明），输入下面这行命令，然后按**回车键**：

```bash
openclawcn setup
```

屏幕上会出现一个配置向导，选择「**个人微信 (WeChat Personal)**」，按提示粘贴你的 API Key 就行。

#### 方式 B：网页管理界面

1. 先启动网关：打开终端，输入 `openclawcn gateway run`，按回车
2. 打开浏览器（Chrome、Edge 等都行），在地址栏输入 `http://localhost:18789`，按回车
3. 点击顶部的「**渠道**」标签
4. 找到「**微信 (个人号)**」卡片，点击展开
5. 展开「**个人微信配置教程**」，按教程操作
6. 在下面的配置表单里粘贴 API Key
7. 点击保存

#### 方式 C：直接改配置文件

编辑 `~/.openclawcn/config.json5`：

```json5
{
  plugins: {
    enabled: [
      "openclawwechat",  // 加上这一行
    ],
    entries: {
      openclawwechat: {
        enabled: true,
        config: {
          apiKey: "把你的API Key粘贴到这里",  // 替换引号里的内容
        },
      },
    },
  },
}
```

### 步骤 5：启动网关，测试一下！

1. 打开终端，输入下面的命令，按**回车键**启动网关：

   ```bash
   openclawcn gateway run
   ```

   如果看到类似 `Gateway started` 或端口监听的提示，说明启动成功了。**这个终端窗口不要关闭**，网关需要一直运行。

2. 拿出**另一个微信号**（朋友的、家人的、或者你的小号），给你绑定的微信号发一条消息，比如：

   > 你好

3. 等待大约 **2 秒**

4. 如果对方收到了 AI 的自动回复 — **恭喜，配置成功！**

---

## 没收到回复？按顺序排查

### 1. ClawChat 绑定是否正常

打开 ClawChat 小程序 → 「我的」页面，看看微信号绑定状态是不是「正常」。

### 2. API Key 是否填对

打开终端，输入下面的命令按回车：

```bash
openclawcn config show
```

屏幕上会输出当前配置，找找看有没有 `openclawwechat` 相关的 `apiKey` 字段。确认格式正确：必须包含冒号 `:`。

### 3. 网关是否在运行

打开终端，输入下面的命令按回车：

```bash
openclawcn gateway status
```

如果显示没有运行，输入 `openclawcn gateway run` 按回车来启动它。

### 4. 开启调试模式看日志

先在配置文件里把 `debug` 改成 `true`（用方式 B 网页界面改最简单，或者直接编辑配置文件）：

```json5
openclawwechat: {
  config: {
    apiKey: "...",
    debug: true,  // 加上这一行
  },
}
```

改完保存后，打开终端，输入下面的命令按回车：

```bash
openclawcn logs --follow
```

终端窗口会开始滚动显示日志。这时候再用微信发一条消息，观察日志里出现什么：
- 看到 `Polling #N: offset=X` → 轮询正常在工作，问题可能在 AI 那边
- 看到 `Polling failed: HTTP 401` → API Key 不对，回 ClawChat 重新复制一次
- 看到 `API error` → ClawChat 服务端出问题了，等一会再试
- 什么都没有 → 插件没启用，检查配置文件的 `enabled` 列表里有没有 `"openclawwechat"`

> 看完日志后，按 `Ctrl + C` 可以退出日志查看。

### 5. 检查网络

打开终端，输入下面的命令按回车：

```bash
curl https://api.clawchat.mifengcdn.com
```

> **Windows 用户**：如果提示找不到 `curl`，可以在浏览器地址栏直接输入 `https://api.clawchat.mifengcdn.com` 访问，看能不能打开。

如果报错或打不开，说明你的电脑连不上 ClawChat 服务器，检查网络和防火墙设置。

---

## 更多配置选项

基本配置只需要 `apiKey` 就够了。下面是高级选项：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `apiKey` | ClawChat API Key（**必填**） | - |
| `pollIntervalMs` | 多久检查一次新消息（毫秒） | `2000`（2 秒） |
| `sessionKey` | 指定用哪个 AI 代理处理消息 | `agent:main:main` |
| `debug` | 开启详细日志（排查问题时用） | `false` |

### 完整配置示例

```json5
{
  plugins: {
    enabled: ["openclawwechat"],
    entries: {
      openclawwechat: {
        enabled: true,
        config: {
          apiKey: "12345:abcdef1234567890",
          pollIntervalMs: 2000,              // 2 秒检查一次
          sessionKey: "agent:main:main",     // 默认 AI 代理
          debug: false,                      // 排查时改 true
        },
      },
    },
  },
}
```

### 调整消息检查频率

默认每 2 秒检查一次新消息。如果觉得回复太慢，可以改成 1 秒：

```json5
pollIntervalMs: 1000
```

如果消息不多、想省资源，可以改成 5 秒：

```json5
pollIntervalMs: 5000
```

### 用不同的 AI 代理

如果你配置了多个 AI 代理（比如翻译代理、编程代理），可以指定微信消息发给哪个：

```json5
sessionKey: "agent:translator:main"  // 发给翻译代理
```

---

## 支持的消息类型

| 类型 | 接收 | 发送 | 说明 |
|------|------|------|------|
| 文本 | Yes | Yes | 长文本自动分段发送 |
| 图片 | Yes | Yes | JPG/PNG/GIF/WebP |
| 视频 | Yes | Yes | 单个文件最大 10MB |
| 文档 | Yes | Yes | PDF/Word/Excel/压缩包 |
| 语音 | Yes | - | 自动转文字后处理 |

---

## 和其他渠道一起用

个人微信可以和飞书、钉钉等渠道同时开着，互不影响：

```json5
{
  plugins: {
    enabled: ["feishu", "dingtalk", "openclawwechat"],
    entries: {
      openclawwechat: {
        enabled: true,
        config: { apiKey: "your-key" },
      },
    },
  },
  channels: {
    feishu: { enabled: true },
    dingtalk: { enabled: true },
  },
}
```

---

## 和其他微信接入方案对比

| 方案 | 要企业认证吗 | 要翻墙吗 | 能用个人号吗 | 部署难度 |
|------|------------|---------|------------|---------|
| **ClawChat 桥接（本方案）** | 不要 | 不要 | 能 | 极简单 |
| 企业微信 (WeCom) | 要 | 不要 | 不能 | 中等 |
| iPad 协议 | 不要 | 看情况 | 能 | 复杂 |
| 桌面微信自动化 | 不要 | 不要 | 能 | 复杂 |

---

## API Key 过期了怎么办

1. 打开 ClawChat 小程序 → 「我的」→ 「APIKey 管理」
2. 点击「生成 APIKey」生成一个新的
3. 复制新的 API Key
4. 替换配置文件里的旧 Key
5. 重启网关：`openclawcn gateway run`
