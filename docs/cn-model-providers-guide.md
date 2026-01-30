# ClawdbotCN 国产模型服务商配置指南

> **更新日期**：2026-01-30

---

## 1. 智谱 GLM

| 项目 | 内容 |
|-----|------|
| **API 地址** | `https://open.bigmodel.cn/api/paas/v4` |
| **输入方式** | API Key（格式：`xxx.xxx` 两段式，中间有点） |
| **获取地址** | https://open.bigmodel.cn |

### 支持模型

| 模型 ID | 价格 | 说明 |
|--------|------|------|
| `glm-4-flash-250414` | 🆓 免费 | 永久免费，速度快 |
| `glm-4-flashx-250414` | ¥0.1/百万tokens | 极速版，低延迟 |
| `glm-4-air-250414` | ¥0.5/百万tokens | 性价比高 |
| `glm-4-plus` | ¥5/百万tokens | 最强性能 |
| `glm-4v-plus` | ¥5/百万tokens | 支持图像理解 |
| `codegeex-4` | ¥0.5/百万tokens | 代码生成专用 |

### 性价比推荐

- ⭐ **入门首选**：`glm-4-flash-250414`（免费）
- 💰 **日常使用**：`glm-4-air-250414`（¥0.5，效果接近 Plus）
- 🚀 **复杂任务**：`glm-4-plus`

---

## 2. 通义千问（阿里云）

| 项目 | 内容 |
|-----|------|
| **API 地址** | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| **输入方式** | API Key（格式：`sk-xxx`） |
| **获取地址** | https://dashscope.console.aliyun.com |

### 支持模型

| 模型 ID | 输入价格 | 输出价格 | 说明 |
|--------|---------|---------|------|
| `qwen-turbo-latest` | ¥0.3/百万 | ¥0.6/百万 | 最便宜，1M超长上下文 |
| `qwen-plus-latest` | ¥0.8/百万 | ¥2/百万 | 131K上下文，均衡性能 |
| `qwen-max-latest` | ¥11.2/百万 | ¥44.8/百万 | 最强性能，超越 DeepSeek V3 |
| `qwen-long` | ¥0.5/百万 | ¥0.5/百万 | 超长文档处理，10M上下文 |
| `qwen-vl-max-latest` | ¥20/百万 | ¥20/百万 | 视觉理解 |
| `qwen-coder-plus-latest` | ¥2/百万 | ¥6/百万 | 代码生成专用 |

### 性价比推荐

- 💰 **日常首选**：`qwen-plus-latest`（性价比最高）
- 💵 **省钱之选**：`qwen-turbo-latest`（最便宜）
- 🚀 **最强性能**：`qwen-max-latest`（贵但强）
- 📄 **长文档**：`qwen-long`（10M上下文）

---

## 3. DeepSeek

| 项目 | 内容 |
|-----|------|
| **API 地址** | `https://api.deepseek.com` |
| **输入方式** | API Key（格式：`sk-xxx`） |
| **获取地址** | https://platform.deepseek.com |

### 支持模型

| 模型 ID | 输入价格 | 输出价格 | 说明 |
|--------|---------|---------|------|
| `deepseek-chat` | ¥2/百万 | ¥8/百万 | 通用对话，已合并 Coder（V3.2） |
| `deepseek-reasoner` | ¥4/百万 | ¥16/百万 | 深度推理模型（R1） |

### 性价比推荐

- ⭐ **强烈推荐**：`deepseek-chat`（性价比之王，日常必备）
- 🧠 **复杂推理**：`deepseek-reasoner`（需要深度思考时使用）

**注意**：`deepseek-coder` 已合并到 `deepseek-chat`，无需单独选择

---

## 4. 硅基流动（SiliconFlow）

| 项目 | 内容 |
|-----|------|
| **API 地址** | `https://api.siliconflow.cn/v1` |
| **输入方式** | API Key（格式：`sk-xxx`） |
| **获取地址** | https://cloud.siliconflow.cn |

### 支持模型

| 模型 ID | 价格 | 说明 |
|--------|------|------|
| `Qwen/Qwen2-7B-Instruct` | 🆓 免费 | 通义千问开源版 |
| `THUDM/glm-4-9b-chat` | 🆓 免费 | 智谱 GLM 开源版 |
| `internlm/internlm2_5-7b-chat` | 🆓 免费 | 书生浦语 |
| `deepseek-ai/DeepSeek-V3` | ¥1.33/百万 | DeepSeek V3 |
| `Pro/deepseek-ai/DeepSeek-R1` | ¥4/百万(入) ¥16/百万(出) | DeepSeek R1 Pro版 |
| `Qwen/Qwen2-72B-Instruct` | ¥4.13/百万 | Qwen2 最强开源版 |

### 性价比推荐

- 🆓 **免费入门**：`Qwen/Qwen2-7B-Instruct`（免费且效果不错）
- 💰 **付费首选**：`deepseek-ai/DeepSeek-V3`（便宜且强）

**特点**：聚合平台，一个 API Key 可用多家模型

---

## 5. 豆包（火山引擎）

| 项目 | 内容 |
|-----|------|
| **API 地址** | `https://ark.cn-beijing.volces.com/api/v3` |
| **输入方式** | API Key + **推理接入点 ID** |
| **获取地址** | https://console.volcengine.com/ark |

### ⚠️ 特殊配置

豆包的模型 ID **不是固定值**！需要用户：
1. 登录火山引擎控制台
2. 创建「推理接入点」，选择模型
3. 获取接入点 ID（格式：`ep-20250130xxxxxx`）
4. 用接入点 ID 作为模型名

### 支持模型

| 模型系列 | 价格 | 说明 |
|---------|------|------|
| 豆包 1.8 | ¥0.8/百万起 | 最新版本 |
| 豆包 1.6 | ¥0.3/百万起 | 稳定版本 |
| 豆包 1.6 Flash | ¥0.075/百万起 | 极速版，最便宜 |
| 豆包 1.6 Lite | ¥0.15/百万起 | 轻量版 |
| 豆包 1.6 Vision | ¥0.8/百万起 | 视觉理解 |

### 性价比推荐

- 💵 **最便宜**：豆包 1.6 Flash（¥0.075/百万）
- 💰 **日常使用**：豆包 1.8（最新版本）

---

## 6. MiniMax

| 项目 | 内容 |
|-----|------|
| **API 地址** | `https://api.minimaxi.com/anthropic` |
| **输入方式** | API Key（很长的 JWT 字符串） |
| **获取地址** | https://platform.minimaxi.com |

### 支持模型

| 模型 ID | 输入价格 | 输出价格 | 说明 |
|--------|---------|---------|------|
| `MiniMax-M2.1` | ¥2.1/百万 | ¥8.4/百万 | 主力模型 |
| `MiniMax-M2.1-lightning` | ¥2.1/百万 | ¥16.8/百万 | 极速版 |
| `MiniMax-M2` | ¥2.1/百万 | ¥8.4/百万 | 上一代 |

### 性价比推荐

- ⭐ **推荐**：`MiniMax-M2.1`（多语言、Agent工作流）

**注意**：`abab6.5s`、`abab6.5` 等旧模型已停用

---

## 7. 腾讯混元

| 项目 | 内容 |
|-----|------|
| **API 地址** | `https://hunyuan.tencentcloudapi.com` |
| **输入方式** | **SecretId + SecretKey**（两个字段！） |
| **获取地址** | https://console.cloud.tencent.com/cam/capi |

### 支持模型

| 模型 ID | 说明 |
|--------|------|
| `hunyuan-pro` | 最强性能 |
| `hunyuan-standard` | 均衡性价比 |
| `hunyuan-lite` | 轻量快速 |

### 性价比推荐

- 💰 **推荐**：`hunyuan-standard`（均衡）

---

## 总结对比

### 输入方式对比

| 厂家 | 输入字段 | 复杂度 |
|-----|---------|--------|
| 智谱 GLM | API Key（两段式） | ⭐ 简单 |
| 通义千问 | API Key | ⭐ 简单 |
| DeepSeek | API Key | ⭐ 简单 |
| 硅基流动 | API Key | ⭐ 简单 |
| MiniMax | API Key（长字符串） | ⭐ 简单 |
| 豆包 | API Key + 接入点ID | ⚠️ 复杂 |
| 腾讯混元 | SecretId + SecretKey | ⚠️ 复杂 |

### 价格对比（从便宜到贵）

| 价格区间 | 厂家 | 模型 |
|---------|------|------|
| 🆓 免费 | 智谱 | glm-4-flash-250414 |
| 🆓 免费 | 硅基流动 | Qwen2-7B, GLM-4-9B |
| ¥0.075 | 豆包 | 1.6 Flash |
| ¥0.1 | 智谱 | glm-4-flashx |
| ¥0.3 | 通义 | qwen-turbo |
| ¥0.5 | 智谱 | glm-4-air |
| ¥0.8 | 通义 | qwen-plus |
| ¥1.33 | 硅基流动 | DeepSeek-V3 |
| ¥2 | DeepSeek | deepseek-chat |
| ¥2.1 | MiniMax | M2.1 |
| ¥5 | 智谱 | glm-4-plus |
| ¥11 | 通义 | qwen-max |

### 最终推荐

| 需求 | 推荐 |
|-----|------|
| 🆓 免费体验 | 智谱 `glm-4-flash-250414` |
| 💰 性价比之王 | DeepSeek `deepseek-chat` |
| 📄 超长文档 | 通义 `qwen-long` |
| 🚀 最强性能 | 通义 `qwen-max-latest` |
| 🧠 深度推理 | DeepSeek `deepseek-reasoner` |

---

*文档生成日期：2026-01-30*
