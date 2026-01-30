# ClawbotCN 安装向导流程文档

## 概述

安装向导是一个 6 步骤的 Web 配置界面，帮助用户完成 ClawbotCN 的初始配置。

### 访问地址
- **URL**: `http://<host>:<port>/setup`
- **触发条件**: 首次安装或配置未完成时自动跳转

### 流程总览

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Step 1  │───▶│ Step 2  │───▶│ Step 3  │───▶│ Step 4  │───▶│ Step 5  │───▶│ Step 6  │
│ AI服务  │    │ 安全设置 │    │ 工作目录 │    │ 指挥渠道 │    │ 产品验证 │    │ 完成重启 │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
```

---

## 平台与版本检测

### 支持的平台与版本

| 平台 | 版本 | 沙盒类型 | 隔离级别 | 说明 |
|------|------|---------|---------|------|
| **macOS** | Lite | 软沙盒 | ⭐⭐⭐ | 目录隔离 + 命令过滤 |
| **Windows** | Lite | 轻量沙盒 | ⭐⭐⭐ | 目录隔离 + 权限限制 |
| **Windows** | Pro | Docker 沙盒 | ⭐⭐⭐⭐⭐ | 容器级完整隔离 |
| **Linux** | Lite | 轻量沙盒 | ⭐⭐⭐ | chroot + AppArmor |
| **Linux** | Pro | Docker 沙盒 | ⭐⭐⭐⭐⭐ | 容器级完整隔离 |

### 平台检测 API

**获取平台信息**:
```
GET /api/setup/state

Response:
{
  "ok": true,
  "data": {
    "step": 1,
    "completed": false,
    "region": "cn",
    "platform": {
      "os": "win32",           // "darwin" | "win32" | "linux"
      "arch": "x64",           // "x64" | "arm64"
      "variant": "lite",       // "lite" | "pro"
      "sandboxType": "soft",   // "soft" | "docker"
      "osVersion": "10.0.22631"
    }
  }
}
```

### 平台信息在 UI 中的展示

页面顶部显示当前平台信息：
```
┌─────────────────────────────────────────────────────────────┐
│  🖥️ 当前环境: Windows Lite 版                               │
│  沙盒类型: 轻量沙盒（目录隔离 + 命令过滤）                    │
└─────────────────────────────────────────────────────────────┘

-- 或 --

┌─────────────────────────────────────────────────────────────┐
│  🖥️ 当前环境: Windows Pro 版                                │
│  沙盒类型: Docker 容器沙盒（完整系统隔离）                    │
└─────────────────────────────────────────────────────────────┘

-- 或 --

┌─────────────────────────────────────────────────────────────┐
│  🍎 当前环境: macOS Lite 版                                  │
│  沙盒类型: 软沙盒（目录隔离 + 命令过滤）                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 1: 选择 AI 服务

### 页面内容
- **标题**: 第一步：选择 AI 服务
- **描述**: 选择你要使用的 AI 平台，或者注册一个新账号

### UI 元素
1. **推荐提示框**: "💡 新用户推荐：阿里云百炼（免费送 100 万 Token）"
2. **AI 平台列表** (可选择一个):
   | 平台 | ID | 描述 | 标记 |
   |------|-----|------|------|
   | 阿里云百炼 | `aliyun-bailian` | 阿里云 AI 平台，支持通义系列模型 | 推荐 |
   | 硅基流动 | `siliconflow` | 国产 AI 聚合平台，支持多种模型 | - |
   | DeepSeek | `deepseek` | DeepSeek 官方 API，高性价比 | - |
   | 智谱 AI | `glm` | 智谱清言，支持 GLM 系列模型 | - |
   | 火山引擎 | `volcengine-ark` | 字节跳动云平台，支持豆包模型 | - |
   | 腾讯混元 | `tencent-hunyuan` | 腾讯云 AI 平台 | - |
   | MiniMax | `minimax` | MiniMax 官方 API | - |

3. **开通链接**: 阿里云百炼开通链接（带推广收益）
4. **API Key 输入框**: 选择平台后显示，用于输入对应平台的 API Key

### 用户操作
1. 选择一个 AI 平台
2. 输入该平台的 API Key
3. 点击「下一步」

### API 调用
```
POST /api/setup/configure-provider
Content-Type: application/json

{
  "provider": "aliyun-bailian",
  "apiKey": "sk-xxxxxxxxxxxxxxxx"
}
```

### 配置保存
```json
{
  "providers": {
    "<provider-id>": {
      "apiKey": "sk-xxx"
    }
  },
  "largeModelProvider": "<provider-id>",
  "smallModelProvider": "<provider-id>"
}
```

---

## Step 2: 安全设置

### 页面内容
- **标题**: 第二步：安全设置
- **描述**: 选择 AI 助手的权限级别

### UI 元素

1. **什么是沙盒？（折叠说明，默认展开）**:
   ```
   💡 什么是「沙盒」？
   
   简单说：沙盒就像给 AI 画了个「活动范围」，它只能在这个范围里干活。
   超出范围的文件和操作，AI 碰不到，也改不了。
   ```

2. **风险提示框（橙色警告）**:
   ```
   ⚠️ 重要提示：请认真阅读
   
   AI 助手存在「提示词注入」风险 —— 恶意网页或文档可能诱导 AI 执行
   危险操作，例如：读取你的密码文件、发送敏感信息、删除重要数据。
   
   👉 强烈建议：使用一台独立设备部署 ClawbotCN，与重要数据物理隔离。
   
   如果必须在工作电脑上使用，请选择「智能保护」模式，并确保工作目录
   不包含敏感文件。
   ```

3. **免责声明（小字灰色）**:
   ```
   * ClawbotCN 提供沙盒保护机制，但无法完全杜绝 AI 误操作风险。
     使用本软件即表示您已了解并接受相关风险，因使用不当造成的
     数据丢失或安全问题，开发者不承担责任。
   ```

4. **安全模式选择**:

   | 模式 | ID | 描述 | 配置值 | 推荐场景 |
   |------|-----|------|--------|----------|
   | 🛡️ **完全保护** | `full` | 所有操作都在沙盒中，最安全 | `sandbox.mode: "all"` | 共享电脑、有敏感数据 |
   | 🔒 **智能保护**（推荐） | `standard` | 主对话正常，后台任务受限 | `sandbox.mode: "non-main"` | 工作电脑、日常使用 |
   | ⚡ **关闭保护** | `trust` | 解锁全部能力，风险自担 | `sandbox.mode: "off"` | 独立设备、懂行高手 |

5. **选项详细说明（卡片式）**:

   ```
   ┌─────────────────────────────────────────────────────────────┐
   │  🛡️ 完全保护                                                │
   │  ─────────                                                  │
   │  AI 的所有操作都在「沙盒」中进行，无法访问沙盒外的文件。     │
   │  最安全，但某些需要系统权限的功能可能受限。                 │
   │                                                             │
   │  适合：电脑上有重要文件、多人共用设备                       │
   └─────────────────────────────────────────────────────────────┘
   
   ┌─────────────────────────────────────────────────────────────┐
   │  🔒 智能保护（推荐）                                  ⭐默认 │
   │  ─────────                                                  │
   │  你直接对话时，AI 有正常权限；后台执行的任务自动受沙盒限制。 │
   │  兼顾使用体验和安全性。                                     │
   │                                                             │
   │  适合：日常工作电脑、需要 AI 协助处理文件                   │
   └─────────────────────────────────────────────────────────────┘
   
   ┌─────────────────────────────────────────────────────────────┐
   │  ⚡ 关闭保护                                    👨‍💻 懂行专用 │
   │  ─────────                                                  │
   │  AI 拥有完整系统权限，解锁全部能力，探索更多可能性。        │
   │                                                             │
   │  ⚠️ 务必了解风险：AI 可能误删文件、执行危险命令。           │
   │  选择此模式 = 你已充分理解并愿意承担一切后果。              │
   │                                                             │
   │  适合：独立设备、已备份数据、懂技术能自己兜底的高手         │
   └─────────────────────────────────────────────────────────────┘
   ```

6. **快速决策指引**:
   ```
   📋 不知道选哪个？看这里：
   
   • 这是我的主力工作电脑     → 选「智能保护」
   • 电脑上有公司/客户数据   → 选「完全保护」
   • 独立设备 + 我懂技术      → 可选「关闭保护」解锁全部能力
   ```

7. **平台相关提示**（根据检测到的平台动态显示）:

   **macOS 版本**:
   ```
   ℹ️ 当前版本: macOS Lite（软沙盒）
   
   macOS 版本使用软沙盒保护，通过目录隔离和命令过滤提供基本安全保障。
   软沙盒无法像 Docker 那样完全隔离系统，如需更高安全级别，
   建议在虚拟机或专用设备上运行。
   ```
   
   **Windows/Linux Lite 版本**:
   ```
   ℹ️ 当前版本: Windows Lite（轻量沙盒）
   
   Lite 版本使用轻量沙盒保护，通过目录限制和命令过滤提供基本安全保障。
   如需更高安全级别，可考虑安装 Pro 版本（Docker 沙盒）。
   ```
   
   **Windows/Linux Pro 版本**:
   ```
   ✅ 当前版本: Windows Pro（Docker 沙盒）
   
   Pro 版本使用 Docker 容器沙盒，提供完整的文件系统、进程和网络隔离。
   这是最高安全级别的保护方案。
   ```

### 用户操作
1. 阅读风险提示
2. 选择安全模式（默认选中「智能保护」）
3. 点击「下一步」

### API 调用
```
POST /api/setup/configure-security
Content-Type: application/json

{
  "mode": "standard",
  "trustedDirs": []
}
```

### 配置保存
```json
{
  "agents": {
    "defaults": {
      "sandbox": {
        "mode": "non-main"  // full -> "all", standard -> "non-main", trust -> "off"
      }
    }
  }
}
```

### 模式映射
| 前端模式 | 后端配置 | 说明 |
|----------|----------|------|
| `full` | `"all"` | 完全保护：所有会话启用沙盒 |
| `standard` | `"non-main"` | 智能保护：非主会话启用沙盒（推荐） |
| `trust` | `"off"` | 关闭保护：无沙盒限制 |

---

## Step 3: 设置隔离工作目录

### 页面内容
- **标题**: 第三步：设置隔离工作目录
- **描述**: 指定 ClawbotCN 可以操控的文件夹范围

### UI 元素
1. **警告提示框**:
   ```
   ⚠️ 安全提示：请选择 ClawbotCN 专门的可控制的工作文件夹，
   不要选择「文档」或「桌面」，以管控可能发生的风险。
   ```

2. **版本提示**（根据平台动态显示）:

   **Lite 版（软沙盒/轻量沙盒）**:
   ```
   ℹ️ 当前版本: Lite（轻量沙盒）
   工作目录和信任目录将通过路径白名单实现保护，AI 只能访问这些目录。
   ```
   
   **Pro 版（Docker 沙盒）**:
   ```
   ℹ️ 当前版本: Pro（Docker 沙盒）
   工作目录和信任目录将作为 Docker 卷挂载到容器中，提供完整隔离。
   ```

3. **主工作目录**:
   - 输入框（只读）
   - 「浏览...」按钮 → 打开文件夹选择器
   - **默认值**（按平台）:
     - Windows: `D:\Clawdbot\workspace`
     - Linux: `/opt/clawdbot/workspace`
     - macOS: `~/.clawbotcn/workspace`

4. **提示信息**:
   ```
   💡 此设置在「完全保护」和「智能保护」模式下生效。
   当前已选择：智能保护
   ```

5. **额外信任目录**（仅保护模式显示）:
   ```
   ┌─────────────────────────────────────────┐
   │  额外信任目录（可选）                     │
   ├─────────────────────────────────────────┤
   │  📁 D:\apps                    [移除]   │
   │  📁 D:\tools                   [移除]   │
   ├─────────────────────────────────────────┤
   │  [➕ 添加额外信任目录]                    │
   └─────────────────────────────────────────┘
   
   💡 信任目录内的文件，AI 可以读写操作。
   ```

### 用户操作
1. 点击「浏览...」选择主工作目录（保护模式下必选）
2. （可选）点击「添加额外信任目录」添加更多目录
3. 点击「下一步」

### API 调用

**浏览目录**:
```
POST /api/setup/browse-directory
Content-Type: application/json

{
  "path": "D:\\"
}

Response:
{
  "ok": true,
  "data": {
    "current": "D:\\",
    "parent": null,
    "directories": ["apps", "tools", "workspace"]
  }
}
```

**验证路径**:
```
POST /api/setup/validate-path
Content-Type: application/json

{
  "path": "D:\\workspace"
}

Response:
{
  "ok": true,
  "data": {
    "valid": true,
    "exists": true,
    "isDirectory": true,
    "readable": true
  }
}
```

**保存工作目录**:
```
POST /api/setup/configure-workspace
Content-Type: application/json

{
  "workspace": "D:\\clawdbot-workspace"
}
```

**保存安全设置（含信任目录）**:
```
POST /api/setup/configure-security
Content-Type: application/json

{
  "mode": "standard",
  "trustedDirs": ["D:\\apps", "D:\\tools"]
}
```

### 配置保存（按版本区分）

#### Lite 版配置（软沙盒/轻量沙盒）

```json
{
  "agents": {
    "defaults": {
      "workspace": "D:\\clawdbot-workspace",
      "sandbox": {
        "mode": "non-main",
        "allowedPaths": [
          "D:\\clawdbot-workspace",
          "D:\\apps",
          "D:\\tools"
        ]
      }
    }
  }
}
```

#### Pro 版配置（Docker 沙盒）

```json
{
  "agents": {
    "defaults": {
      "workspace": "D:\\clawdbot-workspace",
      "sandbox": {
        "mode": "non-main",
        "docker": {
          "binds": [
            "D:\\clawdbot-workspace:/workspace:rw",
            "D:\\apps:/trusted/apps:rw",
            "D:\\tools:/trusted/tools:rw"
          ]
        }
      }
    }
  }
}
```

### 信任目录格式（按版本区分）

#### Lite 版（路径白名单）
```
直接使用原始路径，无需转换：
["D:\\apps", "D:\\tools", "/home/user/data"]
```

#### Pro 版（Docker 绑定）
```
<主机路径>:<容器路径>:rw

示例：
D:\apps → D:\apps:/trusted/apps:rw
/home/user/data → /home/user/data:/trusted/data:rw
```

### 平台默认工作目录

| 平台 | 默认工作目录 |
|------|-------------|
| **Windows** | `D:\Clawdbot\workspace` |
| **Linux** | `/opt/clawdbot/workspace` |
| **macOS** | `~/.clawbotcn/workspace` |

---

## Step 4: 配置指挥渠道

### 页面内容
- **标题**: 第四步：配置指挥渠道
- **描述**: 选择你想要连接的聊天应用，让 AI 助手可以通过这些渠道接收指令

### UI 元素
1. **信息提示**:
   ```
   💡 指挥渠道是你与 AI 助手沟通的方式。
   配置后，你可以通过钉钉或飞书向 AI 发送消息。
   ```

2. **渠道列表**（可多选）:
   | 渠道 | ID | 描述 | 状态 |
   |------|-----|------|------|
   | 📱 钉钉 | `dingtalk` | 通过钉钉机器人与 AI 助手对话 | 可用 |
   | 🪶 飞书 | `feishu` | 通过飞书机器人与 AI 助手对话 | 可用 |
   | 💼 企业微信 | `wecom` | 通过企业微信自建应用对话 | 暂不支持（灰色禁用） |

3. **选择提示**:
   ```
   📋 已选择 2 个指挥渠道。完成向导后，请前往「渠道」页面完成详细配置。
   ```

### 用户操作
1. 选择要配置的渠道（可多选）
2. 点击「下一步」或「跳过，稍后配置」

### API 调用
```
POST /api/setup/configure-channels
Content-Type: application/json

{
  "channels": ["dingtalk", "feishu"]
}
```

### 配置保存
```json
{
  "channels": {
    "dingtalk": { "enabled": true },
    "feishu": { "enabled": true }
  }
}
```

---

## Step 5: ClawbotCN 产品验证

### 页面内容
- **标题**: 第五步：ClawbotCN 产品验证
- **描述**: 激活你的 ClawbotCN 许可证

### UI 元素
1. **信息提示**:
   ```
   💡 ClawbotCN 是一款付费产品，需要购买许可证才能使用完整功能。
   ```

2. **购买引导卡片**:
   ```
   ┌─────────────────────────────────────────┐
   │              🛒                         │
   │         获取许可证                       │
   │                                         │
   │  前往闲鱼搜索「ClawbotCN」购买许可证     │
   │                                         │
   │        [🔗 前往购买]                     │
   └─────────────────────────────────────────┘
   ```

3. **Token 输入框**:
   - Label: "输入许可证 Token"
   - Placeholder: "请输入购买后获得的 Token..."

4. **验证状态**:
   - 验证中: "⏳ 正在验证许可证，请稍候..."（金色）
   - 成功: "🎉 验证成功！感谢支持 ClawbotCN！有效期至：2026年12月31日"（绿色）
   - 失败: "验证失败: 秘钥不存在，请检查输入是否正确"（红色）

### 用户操作
1. 点击「前往购买」链接购买许可证
2. 输入获得的 Token
3. 点击「验证许可证」
4. 验证成功后自动进入下一步

### API 调用
```
POST /api/setup/validate-license
Content-Type: application/json

{
  "token": "clawd-1706500000000-a1b2c3d4"
}
```

### 外部 API（Tecbinai）
```
POST https://www.tecbinai.com/api/api/verify-key
Content-Type: application/json

Request:
{
  "key": "clawd-1706500000000-a1b2c3d4"
}

Response (成功):
{
  "code": 200,
  "message": "success",
  "data": {
    "valid": true,
    "status": "active",
    "expiresAt": "2026-12-31T23:59:59",
    "message": "秘钥有效"
  }
}

Response (失败):
{
  "code": 200,
  "message": "success",
  "data": {
    "valid": false,
    "status": null,
    "expiresAt": null,
    "message": "秘钥不存在，请检查输入是否正确"
  }
}
```

### 错误消息
| Tecbinai 返回 | 用户看到 |
|---------------|----------|
| 秘钥有效 | ✅ 验证成功！感谢支持 ClawbotCN！ |
| 秘钥不存在，请检查输入是否正确 | ❌ 验证失败: 秘钥不存在... |
| 秘钥已过期 | ❌ 验证失败: 秘钥已过期 |
| 秘钥已被撤销 | ❌ 验证失败: 秘钥已被撤销 |

### 配置保存
```json
{
  "license": {
    "key": "clawd-1706500000000-a1b2c3d4",
    "status": "active",
    "expiresAt": "2026-12-31T23:59:59",
    "validatedAt": "2026-01-29T10:30:00.000Z"
  }
}
```

### 开发模式
- 环境变量 `NODE_ENV=development` 或 `CLAWDBOT_DEV=1` 时
- 如果 Tecbinai 服务不可用，允许跳过验证
- 配置中 `status` 设为 `"dev"`

---

## Step 6: 完成重启

### 页面内容
- **标题**: 🎉 欢迎来到 ClawbotCN 世界！
- **描述**: 感谢支持！配置已完成

### UI 元素
1. **成功动画**: 🎊 大图标

2. **配置摘要**:
   ```
   配置摘要
   • ✅ AI 服务：阿里云百炼
   • ✅ 运行环境：Windows Lite（轻量沙盒）
   • ✅ 安全模式：智能保护
   • ✅ 工作目录：D:\clawdbot-workspace
   • ✅ 额外信任目录：2 个目录
   • ✅ 指挥渠道：钉钉、飞书
   • ✅ 许可证：已激活 (有效期至 2026年12月31日)
   ```

3. **后续步骤**（根据平台动态显示）:

   **通用步骤**:
   ```
   💡 后续步骤：
   • 前往「指挥渠道」页面完成钉钉/飞书的详细配置
   • 把需要处理的文件放到工作目录
   • 随时可以在设置中调整配置
   • Skills 仓库: gitee.com/tecbinai/skills
   ```

   **macOS 额外提示**:
   ```
   🍎 macOS 用户注意：
   • 如遇到「无法验证开发者」提示，请在终端执行：
     xattr -cr /Applications/ClawbotCN
   • 工作目录位于: ~/.clawbotcn/workspace
   • 配置文件位于: ~/.clawbotcn/config/
   ```

   **Windows Lite 额外提示**:
   ```
   🪟 Windows 用户提示：
   • 工作目录位于: D:\Clawdbot\workspace
   • 配置文件位于: D:\Clawdbot\config\
   • 可通过开始菜单或桌面快捷方式启动
   ```

   **Windows Pro 额外提示**:
   ```
   🪟 Windows Pro 用户提示：
   • 请确保 Docker Desktop 正在运行
   • 首次启动可能需要拉取沙盒镜像（约 80MB）
   • 工作目录位于: D:\Clawdbot\workspace
   • 如遇 Docker 问题，可在设置中临时切换到轻量沙盒模式
   ```

   **Linux 额外提示**:
   ```
   🐧 Linux 用户提示：
   • 启动服务: sudo systemctl start clawdbot
   • 开机自启: sudo systemctl enable clawdbot
   • 查看日志: journalctl -u clawdbot -f
   • 工作目录位于: /opt/clawdbot/workspace
   • 配置文件位于: /opt/clawdbot/config/
   ```

   **Linux Pro 额外提示**:
   ```
   🐧 Linux Pro 用户提示：
   • 请确保 Docker 服务正在运行: systemctl status docker
   • 启动 Clawdbot: sudo systemctl start clawdbot
   • 开机自启: sudo systemctl enable clawdbot
   • 查看日志: journalctl -u clawdbot -f
   • 工作目录位于: /opt/clawdbot/workspace
   ```

4. **重启按钮**:
   ```
   [🚀 点击重启，进入你的 ClawbotCN 世界]
   ```

5. **重启状态**:
   - 重启中: "⏳ 正在保存配置并重启 Gateway..."
   - 恢复中: "重启中，等待服务恢复... (5s)"
   - 成功: "✓ 重启成功！正在跳转..."

### 用户操作
1. 查看配置摘要
2. 点击「点击重启，进入你的 ClawbotCN 世界」
3. 等待重启完成，自动跳转到主页面 `/`

### API 调用

**完成设置**:
```
POST /api/setup/complete
```

**触发重启**:
```
POST /api/setup/restart
```

**检查恢复状态**（轮询）:
```
GET /api/setup/state

Response:
{
  "ok": true,
  "data": {
    "step": 6,
    "completed": true,
    "region": "cn",
    "platform": {
      "os": "win32",
      "variant": "lite"
    }
  }
}
```

### 重启流程（按平台区分）

**通用流程**:
1. 调用 `/api/setup/complete` 标记向导完成
2. 调用 `/api/setup/restart` 触发重启
3. 每秒轮询 `/api/setup/state` 检查服务恢复
4. 最多等待 30 秒
5. 服务恢复后跳转到 `/`

**平台特定重启机制**:

| 平台 | 重启方式 |
|------|---------|
| **Windows** | 重启 Gateway 进程 |
| **Linux** | 发送 SIGUSR1 信号 / systemctl restart |
| **macOS** | 重启 Gateway 进程 |

---

## 完整 API 参考

### GET 接口

| 接口 | 描述 | 响应 |
|------|------|------|
| `/api/setup/state` | 获取向导状态（含平台信息） | `{ step, completed, region, platform, ... }` |
| `/api/setup/providers` | 获取 AI 平台列表 | `{ providers[], affiliateLinks[], region }` |
| `/api/setup/affiliate-links` | 获取推广链接 | `{ links[] }` |

### POST 接口

| 接口 | 描述 | 请求体 |
|------|------|--------|
| `/api/setup/browse-directory` | 浏览文件夹 | `{ path }` |
| `/api/setup/validate-path` | 验证路径 | `{ path }` |
| `/api/setup/validate-api-key` | 验证 API Key | `{ provider, apiKey }` |
| `/api/setup/configure-provider` | 保存 AI 平台配置 | `{ provider, apiKey, model? }` |
| `/api/setup/configure-workspace` | 保存工作目录 | `{ workspace }` |
| `/api/setup/configure-security` | 保存安全设置 | `{ mode, trustedDirs[] }` |
| `/api/setup/configure-channels` | 保存渠道配置 | `{ channels[] }` |
| `/api/setup/validate-license` | 验证许可证 | `{ token }` |
| `/api/setup/complete` | 标记向导完成 | - |
| `/api/setup/restart` | 重启 Gateway | - |
| `/api/setup/fetch-models` | 获取模型列表 | `{ provider }` |

### 平台信息 API 详情

**GET `/api/setup/state` 完整响应**:
```json
{
  "ok": true,
  "data": {
    "step": 1,
    "completed": false,
    "region": "cn",
    "platform": {
      "os": "win32",            // "darwin" | "win32" | "linux"
      "arch": "x64",            // "x64" | "arm64"
      "variant": "lite",        // "lite" | "pro"
      "sandboxType": "soft",    // "soft" | "docker"
      "osVersion": "10.0.22631",
      "dockerAvailable": false  // Pro 版是否 Docker 可用
    },
    "defaults": {
      "workspace": "C:\\Clawdbot\\workspace",
      "configPath": "C:\\Clawdbot\\config\\settings.json"
    }
  }
}
```

**POST `/api/setup/configure-security` 请求体**:
```json
{
  "mode": "standard",           // "full" | "standard" | "trust"
  "trustedDirs": [
    "D:\\apps",
    "D:\\tools"
  ]
}
```

后端会根据 `platform.variant` 自动选择配置格式：
- **Lite 版**: 生成 `allowedPaths` 数组
- **Pro 版**: 生成 `docker.binds` 数组

---

## 配置文件结构

### 配置文件路径（按平台）

| 平台 | 配置文件路径 |
|------|-------------|
| **Windows** | `D:\Clawdbot\config\settings.json` |
| **Linux** | `/opt/clawdbot/config/settings.json` |
| **macOS** | `~/.clawbotcn/config/settings.json` |

### 用户数据目录（按平台）

| 平台 | 用户数据目录 |
|------|-------------|
| **Windows** | `D:\Clawdbot\` |
| **Linux** | `/opt/clawdbot/` |
| **macOS** | `~/.clawbotcn/` |

### 配置文件示例

#### Lite 版配置（软沙盒/轻量沙盒）

```json
{
  "providers": {
    "aliyun-bailian": {
      "apiKey": "sk-xxxxxxxx"
    }
  },
  "largeModelProvider": "aliyun-bailian",
  "smallModelProvider": "aliyun-bailian",
  
  "agents": {
    "defaults": {
      "workspace": "D:\\clawdbot-workspace",
      "sandbox": {
        "mode": "non-main",
        "allowedPaths": [
          "D:\\clawdbot-workspace",
          "D:\\apps"
        ]
      }
    }
  },
  
  "channels": {
    "dingtalk": { "enabled": true },
    "feishu": { "enabled": true }
  },
  
  "license": {
    "key": "clawd-1706500000000-a1b2c3d4",
    "status": "active",
    "expiresAt": "2026-12-31T23:59:59",
    "validatedAt": "2026-01-29T10:30:00.000Z"
  },
  
  "gateway": {
    "mode": "local"
  },
  
  "setup": {
    "completed": true,
    "completedAt": "2026-01-29T10:35:00.000Z"
  }
}
```

#### Pro 版配置（Docker 沙盒）

```json
{
  "providers": {
    "aliyun-bailian": {
      "apiKey": "sk-xxxxxxxx"
    }
  },
  "largeModelProvider": "aliyun-bailian",
  "smallModelProvider": "aliyun-bailian",
  
  "agents": {
    "defaults": {
      "workspace": "D:\\clawdbot-workspace",
      "sandbox": {
        "mode": "non-main",
        "docker": {
          "image": "clawdbot-sandbox:bookworm-slim",
          "binds": [
            "D:\\clawdbot-workspace:/workspace:rw",
            "D:\\apps:/trusted/apps:rw"
          ]
        }
      }
    }
  },
  
  "channels": {
    "dingtalk": { "enabled": true },
    "feishu": { "enabled": true }
  },
  
  "license": {
    "key": "clawd-1706500000000-a1b2c3d4",
    "status": "active",
    "expiresAt": "2026-12-31T23:59:59",
    "validatedAt": "2026-01-29T10:30:00.000Z"
  },
  
  "gateway": {
    "mode": "local"
  },
  
  "setup": {
    "completed": true,
    "completedAt": "2026-01-29T10:35:00.000Z"
  }
}
```

---

## 前端状态管理

```javascript
// 平台信息（从 /api/setup/state 获取）
let platform = {
  os: 'win32',           // "darwin" | "win32" | "linux"
  arch: 'x64',           // "x64" | "arm64"
  variant: 'lite',       // "lite" | "pro"
  sandboxType: 'soft',   // "soft" | "docker"
  osVersion: '10.0.22631',
  dockerAvailable: false
};

// 全局状态变量
let currentStep = 1;               // 当前步骤 (1-6)
let selectedProvider = null;       // 选中的 AI 平台 ID
let selectedChannels = [];         // 选中的渠道 ID 数组
let selectedSecurity = 'standard'; // 安全模式: "full" | "standard" | "trust"
let trustedDirs = [];              // 额外信任目录列表
let workspace = '';                // 主工作目录

// Window 级别状态
window.browsingForTrustedDir = false;  // 是否正在为信任目录浏览
window.browsingForWorkspace = false;   // 是否正在为工作目录浏览
window.licenseValidated = false;       // 许可证是否已验证
window.licenseExpires = null;          // 许可证过期时间

// 平台相关默认值
const platformDefaults = {
  darwin: {
    workspace: '~/.clawbotcn/workspace',
    configPath: '~/.clawbotcn/config/'
  },
  win32: {
    workspace: 'C:\\Clawdbot\\workspace',
    configPath: 'C:\\Clawdbot\\config\\'
  },
  linux: {
    workspace: '/opt/clawdbot/workspace',
    configPath: '/opt/clawdbot/config/'
  }
};

// 初始化时设置默认工作目录
function initDefaults() {
  const defaults = platformDefaults[platform.os] || platformDefaults.win32;
  workspace = defaults.workspace;
}
```

---

## 流程状态机

```
         ┌──────────────────────────────────────────────────────────┐
         │                       初始状态                           │
         │              检测平台信息 (os/variant)                   │
         └────────────────────────┬─────────────────────────────────┘
                                  │
                                  ▼
         ┌──────────────────────────────────────────────────────────┐
         │  Step 1: 选择 AI 服务                                    │
         │  - 选择平台                                              │
         │  - 输入 API Key                                          │
         │  - 调用 configure-provider                               │
         └────────────────────────┬─────────────────────────────────┘
                                  │ nextStep(1)
                                  ▼
         ┌──────────────────────────────────────────────────────────┐
         │  Step 2: 安全设置                                        │
         │  - 显示平台相关沙盒说明                                   │
         │  - 选择 full/standard/trust (三级模式)                   │
         │  - 调用 configure-security                               │
         └────────────────────────┬─────────────────────────────────┘
                                  │ nextStep(2)
                                  ▼
         ┌──────────────────────────────────────────────────────────┐
         │  Step 3: 设置工作目录                                    │
         │  - 显示版本提示 (Lite/Pro)                               │
         │  - 浏览并选择主工作目录 (按平台默认)                      │
         │  - (可选) 添加额外信任目录                                │
         │  - 调用 configure-workspace                              │
         │  - 调用 configure-security (含 trustedDirs)              │
         │  - 后端按 variant 生成 allowedPaths 或 docker.binds      │
         └────────────────────────┬─────────────────────────────────┘
                                  │ nextStep(3)
                                  ▼
         ┌──────────────────────────────────────────────────────────┐
         │  Step 4: 配置指挥渠道                                    │
         │  - 选择渠道 (可多选/可跳过)                               │
         │  - 调用 configure-channels                               │
         └──────────┬─────────────┴─────────────────────────────────┘
                    │ nextStep(4) 或 skipChannels()
                    ▼
         ┌──────────────────────────────────────────────────────────┐
         │  Step 5: 产品验证                                        │
         │  - 输入许可证 Token                                      │
         │  - 调用 validate-license                                 │
         │  - 验证成功后自动进入 Step 6                              │
         └────────────────────────┬─────────────────────────────────┘
                                  │ validateLicense() 成功
                                  ▼
         ┌──────────────────────────────────────────────────────────┐
         │  Step 6: 完成重启                                        │
         │  - 显示配置摘要 (含平台/版本信息)                         │
         │  - 显示平台特定后续步骤                                   │
         │  - 点击重启按钮                                          │
         │  - 调用 complete                                         │
         │  - 调用 restart (按平台选择重启方式)                      │
         │  - 轮询等待恢复                                          │
         │  - 跳转到主页面 /                                        │
         └──────────────────────────────────────────────────────────┘
```

---

## 源代码位置

| 文件 | 描述 |
|------|------|
| `src/gateway/setup-wizard.ts` | 后端 API 处理器 |
| `src/gateway/setup-page.ts` | 前端 HTML/CSS/JS |
| `src/gateway/platform-detect.ts` | 平台检测逻辑 |
| `src/config/region-cn.ts` | 中国区 AI 平台配置 |
| `src/config/sandbox-config.ts` | 沙盒配置生成（Lite/Pro） |
| `src/commands/onboard-auth.ts` | API Key 保存逻辑 |
| `src/infra/restart.ts` | Gateway 重启逻辑 |

---

## 变更日志

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| 1.1.0 | 2026-01-29 | 新增平台检测、三级安全模式、平台特定配置 |
| 1.0.0 | 2026-01-15 | 初始版本 |

---

## 对接注意事项

### 1. 许可证验证集成
- 必须先验证许可证才能进入最终步骤
- 许可证信息保存在配置文件的 `license` 字段
- 可通过读取配置检查许可证状态

### 2. 安全模式对接（三级模式）

| 前端模式 | 后端配置 | 说明 |
|----------|----------|------|
| `full` | `sandbox.mode: "all"` | 完全保护：所有会话启用沙盒 |
| `standard` | `sandbox.mode: "non-main"` | 智能保护：非主会话启用沙盒 |
| `trust` | `sandbox.mode: "off"` | 关闭保护：无沙盒限制 |

### 3. 信任目录对接（按版本区分）

| 版本 | 配置字段 | 格式 |
|------|---------|------|
| **Lite** | `sandbox.allowedPaths` | 路径数组 `["D:\\apps", "D:\\tools"]` |
| **Pro** | `sandbox.docker.binds` | Docker 绑定 `["D:\\apps:/trusted/apps:rw"]` |

后端应根据 `platform.variant` 自动选择配置格式。

### 4. 渠道配置对接
- 向导只标记渠道为 enabled
- 详细配置（Token、Webhook 等）需要在渠道页面完成

### 5. 重启机制（按平台）

| 平台 | 重启方式 | 信号 |
|------|---------|------|
| **Windows** | 进程重启 | - |
| **Linux** | systemctl / SIGUSR1 | SIGUSR1 |
| **macOS** | 进程重启 | - |

- 重启延迟 1 秒
- 前端轮询检查恢复状态，最多 30 秒

### 6. 平台检测
- 启动时自动检测 `os`、`arch`、`variant`
- 根据检测结果动态调整 UI 和配置格式
- `variant` 取决于安装包类型（Lite/Pro）

### 7. 开发模式
- `NODE_ENV=development` 或 `CLAWDBOT_DEV=1`
- 许可证验证失败时允许跳过
- 方便开发调试

### 8. 平台相关 UI 适配

| UI 元素 | 需要平台适配 | 说明 |
|---------|-------------|------|
| 沙盒类型说明 | ✅ | Lite 显示「轻量沙盒」，Pro 显示「Docker 沙盒」 |
| 安全警告 | ✅ | macOS 需额外说明软沙盒限制 |
| 默认工作目录 | ✅ | 按平台填充默认路径 |
| 后续步骤 | ✅ | 显示平台特定命令和路径 |
| 配置摘要 | ✅ | 显示当前平台和版本信息 |
