# ClawdbotCN 支持的大模型完整列表

> 最后更新：2025年2月  
> 💡 **提示**：选择模型时，请根据你的使用场景和预算选择合适的模型！

---

## 📌 模型排序说明

本文档中每个提供商的模型按以下顺序排列：

1. **⭐ 推荐（性价比最高）** - 适合日常使用，花小钱办大事
2. **🧠 最强（顶级能力）** - 复杂任务首选，效果最好
3. **💰 便宜/免费** - 预算有限或入门体验
4. **其他模型** - 特殊用途

> 🔧 **自定义模型**：如果你需要的模型不在列表中，可以直接输入模型ID！  
> 各厂商会不断更新模型，我们的列表可能不是最新的，支持手动输入任意模型名称。

---

## 目录

1. [国内云服务 - 推荐](#一国内云服务---推荐)
2. [国内云服务 - 更多选择](#二国内云服务---更多选择)
3. [国际服务（需科学上网）](#三国际服务需科学上网)
4. [本地模型 & 自定义](#四本地模型--自定义)
5. [官网链接汇总](#五官网链接汇总)

---

## 一、国内云服务 - 推荐

### 1. 硅基流动 SiliconFlow

| 字段 | 值 |
|------|-----|
| **ID** | `siliconflow` |
| **官网** | https://siliconflow.cn |
| **控制台** | https://cloud.siliconflow.cn |
| **API Key 获取** | https://cloud.siliconflow.cn/account/ak |
| **文档** | https://docs.siliconflow.cn |
| **API 端点** | `https://api.siliconflow.cn/v1` |
| **API 类型** | OpenAI 兼容 |
| **环境变量** | `SILICONFLOW_API_KEY` |
| **特点** | 聚合100+模型，有免费额度，新手首选 |

#### 模型列表

| 模型 ID | 名称 | 描述 | 上下文 | 价格 | 推荐 |
|---------|------|------|--------|------|------|
| `deepseek-ai/DeepSeek-V3.2` | DeepSeek V3.2 | **性价比之王！671B参数，日常首选** | 160K | 按量计费 | ⭐ 推荐 |
| `Pro/deepseek-ai/DeepSeek-R1` | DeepSeek R1 (Pro) | 顶级推理能力，复杂问题 | 64K | ¥4/百万tok | 🧠 最强 |
| `Qwen/Qwen3-8B` | Qwen3 8B | 最新 Qwen3 系列，免费 | 128K | 🆓 免费 | 💰 免费 |
| `THUDM/glm-4-9b-chat` | GLM-4 9B | 智谱免费模型 | 128K | 🆓 免费 | 💰 免费 |
| `internlm/internlm2_5-7b-chat` | InternLM2.5 7B | 书生浦语，免费 | 32K | 🆓 免费 | 💰 免费 |
| `Qwen/Qwen2-7B-Instruct` | Qwen2 7B | 入门模型，免费 | 32K | 🆓 免费 | |
| `deepseek-ai/DeepSeek-V3.1-Terminus` | DeepSeek V3.1 Terminus | 混合智能体，代码/搜索增强 | 128K | 按量计费 | |
| `deepseek-ai/DeepSeek-R1` | DeepSeek R1 | 推理模型，对标 OpenAI o1 | 64K | 按量计费 | |
| `Qwen/Qwen3-14B` | Qwen3 14B | Qwen3 中等规格 | 128K | 按量计费 | |
| `Qwen/Qwen3-32B` | Qwen3 32B | Qwen3 大规格 | 128K | 按量计费 | |
| `Qwen/Qwen2.5-72B-Instruct` | Qwen2.5 72B | 通义千问最强开源 | 128K | 按量计费 | |
| `Qwen/Qwen2.5-32B-Instruct` | Qwen2.5 32B | 通义千问大规格 | 128K | 按量计费 | |
| `Qwen/Qwen2.5-Coder-32B-Instruct` | Qwen2.5 Coder 32B | 代码生成专用 | 128K | 按量计费 | |
| `THUDM/GLM-4.7` | GLM-4.7 | 智谱旗舰，355B参数 | 200K | 按量计费 | |
| `THUDM/GLM-4.7-FlashX` | GLM-4.7 FlashX | 智谱轻量高速版 | 200K | 按量计费 | |
| `Kimi/Kimi-K2.5` | Kimi K2.5 | 1T参数，多模态智能体 | 256K | 按量计费 | |
| `internlm/internlm2_5-20b-chat` | InternLM2.5 20B | 书生浦语大规格 | 32K | 按量计费 | |
| `01-ai/Yi-1.5-34B-Chat` | Yi 1.5 34B | 零一万物 | 32K | 按量计费 | |
| `meta-llama/Meta-Llama-3.1-405B-Instruct` | Llama 3.1 405B | Meta 最大模型 | 128K | 按量计费 | |
| `meta-llama/Meta-Llama-3.1-70B-Instruct` | Llama 3.1 70B | Meta 大规格 | 128K | 按量计费 | |
| `mistralai/Mixtral-8x22B-Instruct-v0.1` | Mixtral 8x22B | Mistral MoE | 64K | 按量计费 | |

> 🔧 **自定义模型**：支持手动输入任意模型ID！硅基流动聚合100+模型，具体可用模型请查看 [硅基流动模型列表](https://siliconflow.cn/models)

---

### 2. 通义千问（阿里云百炼）

| 字段 | 值 |
|------|-----|
| **ID** | `aliyun-bailian` |
| **官网** | https://tongyi.aliyun.com |
| **控制台** | https://bailian.console.aliyun.com |
| **API Key 获取** | https://bailian.console.aliyun.com/#/api-key |
| **文档** | https://help.aliyun.com/zh/model-studio |
| **API 端点** | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| **API 类型** | OpenAI 兼容 |
| **环境变量** | `DASHSCOPE_API_KEY` |
| **特点** | 阿里云出品，新用户送100万Token |

#### 模型列表

| 模型 ID | 名称 | 描述 | 上下文 | 价格 | 推荐 |
|---------|------|------|--------|------|------|
| `qwen-plus-latest` | Qwen-Plus | **性价比最高！日常首选** | 1M | ¥0.8/百万tok(输入) ¥2/百万tok(输出) | ⭐ 推荐 |
| `qwen-max-latest` | Qwen-Max | 顶级能力，复杂任务首选 | 262K | ¥20/百万tok(输入) ¥60/百万tok(输出) | 🧠 最强 |
| `qwen-turbo-latest` | Qwen-Turbo | 极速推理，简单任务 | 1M | ¥0.3/百万tok(输入) ¥0.6/百万tok(输出) | 💰 便宜 |
| `qwen3-235b-instruct` | Qwen3-235B | Qwen3旗舰版 | 128K | 按量计费 | |
| `qwen3-72b-instruct` | Qwen3-72B | Qwen3 大规格 | 128K | 按量计费 | |
| `qwen3-32b-instruct` | Qwen3-32B | Qwen3 中规格 | 128K | 按量计费 | |
| `qwen3-14b-instruct` | Qwen3-14B | Qwen3 小规格 | 128K | 按量计费 | |
| `qwen3-8b-instruct` | Qwen3-8B | Qwen3 入门规格 | 128K | 按量计费 | |
| `qwen-coder-plus-latest` | Qwen-Coder Plus | 代码专用，工具调用强 | 1M | ¥2/百万tok(输入) ¥6/百万tok(输出) | |
| `qwen-coder-turbo-latest` | Qwen-Coder Turbo | 代码轻量版 | 1M | ¥0.5/百万tok(输入) ¥1.5/百万tok(输出) | |
| `qwen-long` | Qwen-Long | 超长文档处理 | 10M | ¥0.5/百万tok | |
| `qwen-vl-max-latest` | Qwen-VL-Max | 视觉理解，图像分析 | 32K | ¥20/百万tok | |
| `qwen-vl-plus` | Qwen-VL-Plus | 视觉理解，性价比版 | 32K | ¥8/百万tok | |
| `qwen-audio-turbo` | Qwen-Audio-Turbo | 语音理解 | 32K | 按量计费 | |

> 🔧 **自定义模型**：支持手动输入模型ID，如 `qwen-xxx-latest`，具体可用模型请查看[阿里云模型列表](https://help.aliyun.com/zh/model-studio/getting-started/models)

---

### 3. 豆包（火山引擎）

| 字段 | 值 |
|------|-----|
| **ID** | `volcengine-ark` |
| **官网** | https://www.volcengine.com/product/doubao |
| **控制台** | https://console.volcengine.com/ark |
| **API Key 获取** | https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey |
| **模型开通** | https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement |
| **文档** | https://www.volcengine.com/docs/82379 |
| **API 端点** | `https://ark.cn-beijing.volces.com/api/v3` |
| **API 类型** | OpenAI 兼容 |
| **环境变量** | `ARK_API_KEY` |
| **特点** | 字节出品，便宜好用，新用户送50万Token |
| **⚠️ 注意** | 使用前必须在控制台「开通管理」页面开通对应模型！ |

#### 模型列表

| 模型 ID | 名称 | 描述 | 上下文 | 价格 | 推荐 |
|---------|------|------|--------|------|------|
| `doubao-seed-1-8-latest` | 豆包 1.8 | **性价比超高！最新版本** | 128K | ¥0.4/百万tok(输入) ¥1.6/百万tok(输出) | ⭐ 推荐 |
| `doubao-seed-1-6-latest` | 豆包 1.6 | 256K长上下文，多模态 | 256K | ¥0.8/百万tok(输入) ¥2/百万tok(输出) | 🧠 长文档 |
| `doubao-seed-1-6-lite` | 豆包 1.6 Lite | 高性价比轻量版 | 128K | ¥0.4/百万tok(输入) ¥1.6/百万tok(输出) | 💰 便宜 |
| `doubao-seed-1-6-flash` | 豆包 1.6 Flash | 小尺寸、低延时 | 32K | ¥0.2/百万tok(输入) ¥0.8/百万tok(输出) | 💰 最便宜 |
| `doubao-seed-1-8-251228` | 豆包 1.8 (固定版本) | 1.8 固定版本 | 128K | ¥0.4/百万tok(输入) ¥1.6/百万tok(输出) | |
| `doubao-seed-1-6-251015` | 豆包 1.6 (固定版本) | 1.6 固定版本 | 256K | ¥0.8/百万tok(输入) ¥2/百万tok(输出) | |
| `doubao-vision-latest` | 豆包视觉理解 | 多模态理解和推理 | 32K | 按量计费 | |
| `doubao-video-latest` | 豆包视频生成 | 1080P高清视频生成 | - | 按量计费 | |
| `doubao-embedding` | 豆包向量化 | 文本向量化 | 4K | 按量计费 | |

> 🔧 **自定义模型**：支持手动输入模型ID！具体可用模型请查看 [火山引擎模型列表](https://www.volcengine.com/docs/82379/1554712)  
> ⚠️ **重要**：使用前必须在控制台「开通管理」页面开通对应模型！

---

## 二、国内云服务 - 更多选择

### 4. DeepSeek（官方）

| 字段 | 值 |
|------|-----|
| **ID** | `deepseek` |
| **官网** | https://www.deepseek.com |
| **控制台** | https://platform.deepseek.com |
| **API Key 获取** | https://platform.deepseek.com/api_keys |
| **文档** | https://api-docs.deepseek.com |
| **API 端点** | `https://api.deepseek.com` |
| **API 类型** | OpenAI 兼容 |
| **环境变量** | `DEEPSEEK_API_KEY` |
| **特点** | 性价比之王，编程能力顶尖 |

#### 模型列表

| 模型 ID | 名称 | 描述 | 上下文 | 价格 | 推荐 |
|---------|------|------|--------|------|------|
| `deepseek-chat` | DeepSeek V3.2 | **性价比之王！日常首选** | 131K | ¥2/百万tok(输入) ¥8/百万tok(输出) | ⭐ 推荐 |
| `deepseek-reasoner` | DeepSeek R1 | 顶级推理，复杂数学/代码 | 64K | ¥4/百万tok(输入) ¥16/百万tok(输出) | 🧠 最强 |
| `deepseek-v3.2-exp` | DeepSeek V3.2 Exp | 实验版本 | 131K | 按量计费 | |
| `deepseek-v3.1` | DeepSeek V3.1 | 混合推理架构 | 128K | 按量计费 | |
| `deepseek-r1-0528` | DeepSeek R1-0528 | R1 升级版 | 64K | 按量计费 | |

> 🔧 **自定义模型**：支持手动输入模型ID！具体可用模型请查看 [DeepSeek 模型列表](https://api-docs.deepseek.com/zh-cn/)

---

### 5. 智谱 GLM

| 字段 | 值 |
|------|-----|
| **ID** | `glm` |
| **官网** | https://www.zhipuai.cn |
| **控制台** | https://open.bigmodel.cn |
| **API Key 获取** | https://open.bigmodel.cn/usercenter/apikeys |
| **文档** | https://docs.bigmodel.cn |
| **API 端点** | `https://open.bigmodel.cn/api/paas/v4` |
| **API 类型** | OpenAI 兼容 |
| **环境变量** | `ZHIPU_API_KEY` |
| **特点** | 有永久免费模型，Agent能力强 |

#### 模型列表

| 模型 ID | 名称 | 描述 | 上下文 | 价格 | 推荐 |
|---------|------|------|--------|------|------|
| `glm-4.5-air` | GLM-4.5 Air | **性价比之王！日常首选** | 128K | ¥0.5/百万tok | ⭐ 推荐 |
| `glm-4.7` | GLM-4.7 | 顶级能力，Agent/代码增强 | 200K | ¥15/百万tok(输入) ¥15/百万tok(输出) | 🧠 最强 |
| `glm-4.5-flash` | GLM-4.5 Flash | **永久免费！**速度快 | 128K | 🆓 免费 | 💰 免费 |
| `glm-4.5-airx` | GLM-4.5 AirX | Air 加速版 | 128K | ¥1/百万tok | 💰 便宜 |
| `codegeex-4` | CodeGeeX-4 | 代码生成专用 | 128K | ¥0.5/百万tok | 💰 便宜 |
| `glm-4.7-flashx` | GLM-4.7 FlashX | 4.7轻量高速版 | 200K | ¥5/百万tok(输入) ¥5/百万tok(输出) | |
| `glm-4.5-plus` | GLM-4.5 Plus | 最强性能 | 128K | ¥5/百万tok | |
| `glm-4.5-x` | GLM-4.5 X | 扩展版本 | 128K | ¥3/百万tok | |
| `glm-4.5` | GLM-4.5 | 稳定版本 | 128K | ¥5/百万tok | |
| `glm-4.6` | GLM-4.6 | 上一代旗舰 | 128K | ¥10/百万tok | |
| `glm-4.6v` | GLM-4.6V | 视觉理解版 | 128K | ¥10/百万tok | |
| `glm-4v-plus` | GLM-4V Plus | 视觉理解 | 8K | ¥5/百万tok | |

> 🔧 **自定义模型**：支持手动输入模型ID！具体可用模型请查看 [智谱AI模型列表](https://docs.bigmodel.cn/cn/guide/models)

---

### 6. 月之暗面 Kimi（新增）

| 字段 | 值 |
|------|-----|
| **ID** | `moonshot` |
| **官网** | https://www.moonshot.cn |
| **控制台** | https://platform.moonshot.cn |
| **API Key 获取** | https://platform.moonshot.cn/console/api-keys |
| **文档** | https://platform.moonshot.cn/docs |
| **API 端点** | `https://api.moonshot.cn/v1` |
| **API 类型** | OpenAI 兼容 |
| **环境变量** | `MOONSHOT_API_KEY` |
| **特点** | 长上下文之王，最长支持1M tokens，擅长文档理解 |

#### 模型列表

| 模型 ID | 名称 | 描述 | 上下文 | 价格 | 推荐 |
|---------|------|------|--------|------|------|
| `kimi-latest` | Kimi Latest | **性价比高！日常首选** | 128K | ¥2/百万tok(输入) ¥10/百万tok(输出) | ⭐ 推荐 |
| `kimi-k2` | Kimi K2 | 顶级能力，万亿参数 MoE | 128K | ¥4/百万tok(输入) ¥16/百万tok(输出) | 🧠 最强 |
| `moonshot-v1-8k` | Kimi 8K | 快速响应，便宜 | 8K | ¥2/百万tok(输入) ¥10/百万tok(输出) | 💰 便宜 |
| `moonshot-v1-32k` | Kimi 32K | 中等长度文档 | 32K | ¥5/百万tok(输入) ¥20/百万tok(输出) | |
| `moonshot-v1-128k` | Kimi 128K | 长文档处理 | 128K | ¥10/百万tok(输入) ¥30/百万tok(输出) | |
| `moonshot-v1-1m` | Kimi 1M | **超长上下文！整本书** | 1M | 按需定价 | 🧠 长文档 |
| `kimi-k1.5` | Kimi K1.5 | 推理模型 | 128K | 按量计费 | |
| `kimi-k2-thinking` | Kimi K2 Thinking | 思维链推理 | 128K | 按量计费 | |

> 🔧 **自定义模型**：支持手动输入模型ID！具体可用模型请查看 [Kimi 模型列表](https://platform.moonshot.cn/docs/intro#主要模型)

---

### 7. MiniMax

| 字段 | 值 |
|------|-----|
| **ID** | `minimax` |
| **官网** | https://www.minimaxi.com |
| **控制台** | https://platform.minimaxi.com |
| **API Key 获取** | https://platform.minimaxi.com/user-center/basic-information/interface-key |
| **文档** | https://platform.minimaxi.com/docs |
| **API 端点** | `https://api.minimaxi.com/anthropic` |
| **API 类型** | Anthropic 兼容 |
| **环境变量** | `MINIMAX_API_KEY` |
| **特点** | Agent工作流专家，代码能力超越 Claude Sonnet 4.5 |

#### 模型列表

| 模型 ID | 名称 | 描述 | 上下文 | 价格 | 推荐 |
|---------|------|------|--------|------|------|
| `MiniMax-M2.1` | MiniMax M2.1 | **Agent/代码专家！多语言编程** | 200K | ¥2.1/百万tok(输入) ¥8.4/百万tok(输出) | ⭐ 推荐 |
| `MiniMax-M2.1-lightning` | M2.1 Lightning | 极速版，延迟更低 | 200K | ¥2.1/百万tok(输入) ¥16.8/百万tok(输出) | 💰 低延迟 |

> 🔧 **自定义模型**：支持手动输入模型ID！具体可用模型请查看 [MiniMax 模型列表](https://platform.minimaxi.com/docs/guides/quickstart)

---

### 8. 腾讯混元

| 字段 | 值 |
|------|-----|
| **ID** | `tencent-hunyuan` |
| **官网** | https://hunyuan.tencent.com |
| **控制台** | https://console.cloud.tencent.com/hunyuan |
| **API Key 获取** | https://console.cloud.tencent.com/cam/capi |
| **文档** | https://cloud.tencent.com/document/product/1729 |
| **API 端点** | `https://hunyuan.tencentcloudapi.com` |
| **API 类型** | 腾讯云签名认证 |
| **环境变量** | `HUNYUAN_SECRET_ID` / `HUNYUAN_SECRET_KEY` |
| **特点** | 腾讯出品，新用户送30万Token |

#### 模型列表

| 模型 ID | 名称 | 描述 | 上下文 | 价格 | 推荐 |
|---------|------|------|--------|------|------|
| `hunyuan-2.0-instruct-20251111` | 混元 2.0 Instruct | **日常首选！指令遵循强** | 128K(输入) 16K(输出) | 按量计费 | ⭐ 推荐 |
| `hunyuan-2.0-thinking-20251109` | 混元 2.0 Think | 顶级推理，复杂任务 | 128K(输入) 64K(输出) | 按量计费 | 🧠 最强 |
| `hunyuan-lite` | 混元 Lite | **有免费额度！**轻量快速 | 250K(输入) 6K(输出) | 🆓 免费额度 | 💰 免费 |
| `hunyuan-turbos-latest` | 混元 TurboS | 极速版 | 32K(输入) 16K(输出) | 按量计费 | 💰 便宜 |
| `hunyuan-t1-latest` | 混元 T1 | 推理模型 | 32K(输入) 64K(输出) | 按量计费 | |
| `hunyuan-a13b` | 混元 A13B | 混合推理模型 | 224K(输入) 32K(输出) | 按量计费 | |
| `hunyuan-translation` | 混元翻译 | 33种语言互译 | 4K | 按量计费 | |
| `hunyuan-large-role-latest` | 混元角色对话 | AI数字分身、角色扮演 | 32K | 按量计费 | |

> 🔧 **自定义模型**：支持手动输入模型ID！具体可用模型请查看 [腾讯混元模型列表](https://cloud.tencent.com/document/product/1729/104753)

---

## 三、国际服务（需科学上网）

> ⚠️ **注意**：以下服务需要科学上网才能访问

### 9. OpenAI

| 字段 | 值 |
|------|-----|
| **ID** | `openai` |
| **官网** | https://openai.com |
| **控制台** | https://platform.openai.com |
| **API Key 获取** | https://platform.openai.com/api-keys |
| **文档** | https://platform.openai.com/docs |
| **API 端点** | `https://api.openai.com/v1` |
| **API 类型** | OpenAI 原生 |
| **环境变量** | `OPENAI_API_KEY` |
| **特点** | ChatGPT 官方，行业标杆 |

#### 模型列表

| 模型 ID | 名称 | 描述 | 上下文 | 价格 | 推荐 |
|---------|------|------|--------|------|------|
| `gpt-4.1-mini` | GPT-4.1 Mini | **性价比最高！超越4o** | 1M | $0.4/百万tok(输入) $1.6/百万tok(输出) | ⭐ 推荐 |
| `gpt-4.1` | GPT-4.1 | 顶级能力，最高性能 | 1M | $2/百万tok(输入) $8/百万tok(输出) | 🧠 最强 |
| `gpt-4.1-nano` | GPT-4.1 Nano | 最快最便宜 | 1M | $0.1/百万tok(输入) $0.4/百万tok(输出) | 💰 便宜 |
| `gpt-4o-mini` | GPT-4o Mini | 轻量快速 | 128K | $0.15/百万tok(输入) $0.6/百万tok(输出) | 💰 便宜 |
| `o3` | o3 | 推理最强，数学+30%，代码+25% | 200K | 按量计费 | 🧠 推理 |
| `o3-pro` | o3-pro | o3 增强版 | 200K | 按量计费 | |
| `o4-mini` | o4-mini | 高速推理，AIME 99.5% | 128K | 按量计费 | |
| `o4-mini-high` | o4-mini-high | o4-mini 高精度版 | 128K | 按量计费 | |
| `gpt-4o` | GPT-4o | 多模态，视觉+语音 | 128K | $2.5/百万tok(输入) $10/百万tok(输出) | |
| `gpt-4-turbo` | GPT-4 Turbo | 稳定版 | 128K | $10/百万tok(输入) $30/百万tok(输出) | |

> 🔧 **自定义模型**：支持手动输入模型ID！具体可用模型请查看 [OpenAI 模型列表](https://platform.openai.com/docs/models)

---

### 10. Anthropic Claude

| 字段 | 值 |
|------|-----|
| **ID** | `anthropic` |
| **官网** | https://www.anthropic.com |
| **控制台** | https://console.anthropic.com |
| **API Key 获取** | https://console.anthropic.com/settings/keys |
| **文档** | https://docs.anthropic.com |
| **API 端点** | `https://api.anthropic.com/v1` |
| **API 类型** | Anthropic Messages |
| **环境变量** | `ANTHROPIC_API_KEY` |
| **特点** | 编程能力最强，SWE-bench 冠军 |

#### 模型列表

| 模型 ID | 名称 | 描述 | 上下文 | 价格 | 推荐 |
|---------|------|------|--------|------|------|
| `claude-sonnet-4-20250514` | Claude Sonnet 4 | **性价比最高！编程能力强** | 200K | $3/百万tok(输入) $15/百万tok(输出) | ⭐ 推荐 |
| `claude-opus-4.5-20251124` | Claude Opus 4.5 | 顶级能力，最智能前沿 | 500K-1M | 按量计费 | 🧠 最强 |
| `claude-3-5-haiku-20241022` | Claude 3.5 Haiku | 轻量快速，便宜 | 200K | $0.25/百万tok(输入) $1.25/百万tok(输出) | 💰 便宜 |
| `claude-opus-4-20250514` | Claude Opus 4 | 500K-1M上下文 | 500K-1M | $15/百万tok(输入) $75/百万tok(输出) | |
| `claude-3-5-sonnet-20241022` | Claude 3.5 Sonnet | 稳定版本 | 200K | $3/百万tok(输入) $15/百万tok(输出) | |
| `claude-3-opus-20240229` | Claude 3 Opus | 上一代旗舰 | 200K | $15/百万tok(输入) $75/百万tok(输出) | |

> 🔧 **自定义模型**：支持手动输入模型ID！具体可用模型请查看 [Claude 模型列表](https://docs.anthropic.com/en/docs/about-claude/models)

---

### 11. Google Gemini

| 字段 | 值 |
|------|-----|
| **ID** | `google` |
| **官网** | https://ai.google.dev |
| **控制台** | https://aistudio.google.com |
| **API Key 获取** | https://aistudio.google.com/apikey |
| **文档** | https://ai.google.dev/gemini-api/docs |
| **API 端点** | `https://generativelanguage.googleapis.com/v1beta` |
| **API 类型** | Google Generative AI |
| **环境变量** | `GOOGLE_API_KEY` |
| **特点** | 免费额度充足，多模态能力强 |

#### 模型列表

| 模型 ID | 名称 | 描述 | 上下文 | 价格 | 推荐 |
|---------|------|------|--------|------|------|
| `gemini-3-flash` | Gemini 3 Flash | **免费+性价比！快速高效** | 1M | 🆓 免费额度 | ⭐ 推荐 |
| `gemini-3-pro` | Gemini 3 Pro | 顶级能力，多模态推理 | 1M | 🆓 免费额度 | 🧠 最强 |
| `gemini-2.5-flash-lite` | Gemini 2.5 Flash Lite | 最快最便宜 | 1M | 🆓 免费额度 | 💰 免费 |
| `gemini-2.5-flash` | Gemini 2.5 Flash | 多模态均衡 | 1M | 🆓 免费额度 | 💰 免费 |
| `gemini-3-pro-image-preview` | Gemini 3 Pro Image | 图像生成与理解 | 1M | 🆓 免费额度 | |
| `gemini-2.5-pro` | Gemini 2.5 Pro | 思维推理，LMArena第一 | 1M | 🆓 免费额度 | |
| `gemini-2.0-flash` | Gemini 2.0 Flash | 稳定版本 | 1M | 🆓 免费额度 | |
| `gemini-1.5-pro` | Gemini 1.5 Pro | 上一代Pro | 2M | 🆓 免费额度 | |
| `gemini-1.5-flash` | Gemini 1.5 Flash | 上一代Flash | 1M | 🆓 免费额度 | |

> 🔧 **自定义模型**：支持手动输入模型ID！具体可用模型请查看 [Gemini 模型列表](https://ai.google.dev/gemini-api/docs/models)

---

### 12. NVIDIA NIM

| 字段 | 值 |
|------|-----|
| **ID** | `nvidia` |
| **官网** | https://build.nvidia.com |
| **控制台** | https://build.nvidia.com |
| **API Key 获取** | https://build.nvidia.com/settings |
| **文档** | https://docs.api.nvidia.com |
| **API 端点** | `https://integrate.api.nvidia.com/v1` |
| **API 类型** | OpenAI 兼容 |
| **环境变量** | `NVIDIA_API_KEY` |
| **特点** | 高性能推理，有免费额度 |

#### 模型列表

| 模型 ID | 名称 | 描述 | 上下文 | 价格 | 推荐 |
|---------|------|------|--------|------|------|
| `nvidia/llama-3.3-nemotron-super-49b-v1` | Nemotron Super 49B | **免费！高性能推理** | 128K | 🆓 免费额度 | ⭐ 推荐 |
| `deepseek-ai/deepseek-r1` | DeepSeek R1 | 深度推理模型 | 64K | 🆓 免费额度 | 🧠 推理 |
| `nvidia/nemotron-3-nano-30b` | Nemotron 3 Nano 30B | 100万上下文 MoE | 1M | 🆓 免费额度 | 💰 免费 |
| `meta/llama-3.1-405b-instruct` | Llama 3.1 405B | Meta 最大模型 | 128K | 🆓 免费额度 | |
| `meta/llama-3.1-70b-instruct` | Llama 3.1 70B | Meta 大规格 | 128K | 🆓 免费额度 | |
| `google/gemma-2-27b-it` | Gemma 2 27B | Google 开源模型 | 8K | 🆓 免费额度 | |
| `mistralai/mixtral-8x22b-instruct-v0.1` | Mixtral 8x22B | Mistral MoE | 64K | 🆓 免费额度 | |

> 🔧 **自定义模型**：支持手动输入模型ID！具体可用模型请查看 [NVIDIA NIM 模型列表](https://build.nvidia.com/explore/discover)

---

## 四、本地模型 & 自定义

### 13. Ollama 本地模型

| 字段 | 值 |
|------|-----|
| **ID** | `ollama` |
| **官网** | https://ollama.com |
| **下载** | https://ollama.com/download |
| **模型库** | https://ollama.com/library |
| **文档** | https://github.com/ollama/ollama |
| **API 端点** | `http://localhost:11434/v1` |
| **API 类型** | OpenAI 兼容 |
| **环境变量** | `OLLAMA_API_KEY`（本地无需） |
| **特点** | 本地运行，完全免费，数据私密 |

#### 模型列表

| 模型 ID | 名称 | 描述 | 大小 | 推荐 |
|---------|------|------|------|------|
| `qwen3:8b` | Qwen3 8B | **性价比高！中文强** | ~5GB | ⭐ 推荐 |
| `qwen3:14b` | Qwen3 14B | 更强性能 | ~9GB | 🧠 更强 |
| `llama3.2:3b` | Llama 3.2 3B | 轻量版，内存小 | ~2GB | 💰 轻量 |
| `phi3:latest` | Phi-3 | 微软小模型，2G内存可用 | ~2.3GB | 💰 轻量 |
| `qwen3:32b` | Qwen3 32B | Qwen3 大规格 | ~20GB | |
| `qwen3:72b` | Qwen3 72B | Qwen3 最大 | ~45GB | |
| `qwen2.5:7b` | Qwen2.5 7B | 稳定版本 | ~4.4GB | |
| `qwen2.5:14b` | Qwen2.5 14B | 更强性能 | ~9GB | |
| `qwen2.5:32b` | Qwen2.5 32B | 大规格 | ~20GB | |
| `qwen2.5-coder:7b` | Qwen2.5 Coder 7B | 代码专用 | ~4.4GB | |
| `qwen2.5-coder:32b` | Qwen2.5 Coder 32B | 代码大规格 | ~20GB | |
| `llama4:latest` | Llama 4 | Meta最新 | 按规格 | |
| `llama3.2:latest` | Llama 3.2 | 稳定版 | ~2GB | |
| `llama3.1:8b` | Llama 3.1 8B | 中等规格 | ~4.7GB | |
| `llama3.1:70b` | Llama 3.1 70B | 大规格 | ~40GB | |
| `deepseek-r1:7b` | DeepSeek R1 7B | 推理模型 | ~4.7GB | |
| `deepseek-r1:14b` | DeepSeek R1 14B | 推理中规格 | ~9GB | |
| `deepseek-r1:32b` | DeepSeek R1 32B | 推理大规格 | ~20GB | |
| `deepseek-coder:6.7b` | DeepSeek Coder 6.7B | 代码专用 | ~4GB | |
| `gemma2:9b` | Gemma 2 9B | Google开源 | ~5.4GB | |
| `gemma2:27b` | Gemma 2 27B | Google大规格 | ~16GB | |
| `mistral:latest` | Mistral | 高效开源 | ~4.1GB | |
| `mixtral:8x7b` | Mixtral 8x7B | MoE模型 | ~26GB | |
| `codellama:7b` | CodeLlama 7B | Meta代码模型 | ~3.8GB | |

> 🔧 **自定义模型**：支持手动输入任意模型ID！运行 `ollama pull 模型名` 下载后即可使用，具体可用模型请查看 [Ollama 模型库](https://ollama.com/library)

---

### 14. 魔搭社区 ModelScope（新增）

| 字段 | 值 |
|------|-----|
| **ID** | `modelscope` |
| **官网** | https://www.modelscope.cn |
| **控制台** | https://modelscope.cn/my/myaccesstoken |
| **文档** | https://modelscope.cn/docs |
| **API 端点** | `https://api-inference.modelscope.cn/v1` |
| **API 类型** | OpenAI 兼容 |
| **环境变量** | `MODELSCOPE_API_KEY` |
| **特点** | 阿里开源平台，免费推理API，每日2000次调用 |

#### 模型列表

| 模型 ID | 名称 | 描述 | 上下文 | 价格 | 推荐 |
|---------|------|------|--------|------|------|
| `Qwen/Qwen3-72B-Instruct` | Qwen3 72B | **免费！最新最强** | 128K | 🆓 免费(2000次/天) | ⭐ 推荐 |
| `Qwen/Qwen2.5-Coder-32B-Instruct` | Qwen2.5 Coder 32B | 代码专用 | 128K | 🆓 免费(2000次/天) | 🧠 代码 |
| `deepseek-ai/DeepSeek-V3` | DeepSeek V3 | 性价比之王 | 64K | 🆓 免费(2000次/天) | 💰 免费 |
| `Qwen/Qwen3-32B-Instruct` | Qwen3 32B | Qwen3中规格 | 128K | 🆓 免费(2000次/天) | |
| `Qwen/Qwen3-14B-Instruct` | Qwen3 14B | Qwen3小规格 | 128K | 🆓 免费(2000次/天) | |
| `Qwen/Qwen2.5-72B-Instruct` | Qwen2.5 72B | 通义千问最强开源 | 128K | 🆓 免费(2000次/天) | |
| `Qwen/Qwen2.5-14B-Instruct` | Qwen2.5 14B | 均衡性能 | 128K | 🆓 免费(2000次/天) | |
| `THUDM/glm-4-9b-chat` | GLM-4 9B | 智谱开源 | 128K | 🆓 免费(2000次/天) | |

> 🔧 **自定义模型**：支持手动输入任意模型ID！魔搭社区有大量开源模型，具体可用模型请查看 [魔搭社区模型库](https://modelscope.cn/models)

---

### 15. Xinference 本地部署

| 字段 | 值 |
|------|-----|
| **ID** | `xinference` |
| **官网** | https://github.com/xorbitsai/inference |
| **文档** | https://inference.readthedocs.io |
| **API 端点** | `http://localhost:9997/v1`（默认） |
| **API 类型** | OpenAI 兼容 |
| **环境变量** | `XINFERENCE_API_KEY`（可选） |
| **特点** | 阿里开源分布式推理框架，支持多种模型 |

#### 支持的模型（动态发现）

- 支持运行时从 Xinference 服务自动发现已部署模型
- 常见模型：qwen3、qwen2.5、llama4、llama3、chatglm4、deepseek、mistral 等
- 支持 GGML/GGUF 格式模型

> 🔧 **自定义模型**：在 Xinference 中部署任意模型后，直接输入模型名称即可使用！

---

### 16. LM Studio 本地部署

| 字段 | 值 |
|------|-----|
| **ID** | `lmstudio` |
| **官网** | https://lmstudio.ai |
| **下载** | https://lmstudio.ai/download |
| **文档** | https://lmstudio.ai/docs |
| **API 端点** | `http://localhost:1234/v1`（默认） |
| **API 类型** | OpenAI 兼容 |
| **环境变量** | `LMSTUDIO_API_KEY`（本地无需，填 lm-studio 即可） |
| **特点** | GUI友好，Windows/Mac支持好，GGUF格式 |

#### 支持的模型

- 支持 Hugging Face 上的 GGUF 格式模型
- 可在应用内直接下载模型
- 常见模型：Qwen、Llama、Mistral、DeepSeek、Gemma 等

> 🔧 **自定义模型**：在 LM Studio 中下载任意模型后，直接输入模型名称即可使用！

---

### 17. 自定义 OpenAI 兼容 API

| 字段 | 值 |
|------|-----|
| **ID** | `custom-openai` |
| **API 端点** | 自定义 |
| **API 类型** | OpenAI 兼容 |
| **特点** | 支持任意兼容 OpenAI API 格式的服务 |

适用于：
- 公司内部私有模型服务
- vLLM 部署的模型
- 第三方代理服务
- 其他 OpenAI 兼容服务

> 🔧 **自定义模型**：输入你的 API 端点和模型名称即可！模型名称由你的服务提供。

---

### 18. 自定义 Anthropic 兼容 API

| 字段 | 值 |
|------|-----|
| **ID** | `custom-anthropic` |
| **API 端点** | 自定义 |
| **API 类型** | Anthropic Messages |
| **特点** | 支持任意兼容 Anthropic Messages API 格式的服务 |

适用于：
- MiniMax M2.1（原生 Anthropic 兼容）
- AWS Bedrock Claude
- 其他 Anthropic 兼容服务

> 🔧 **自定义模型**：输入你的 API 端点和模型名称即可！模型名称由你的服务提供。

---

## 五、官网链接汇总

| 提供商 | 官网 | 控制台/注册 | API Key 获取 | 文档 |
|--------|------|------------|--------------|------|
| **硅基流动** | https://siliconflow.cn | https://cloud.siliconflow.cn | https://cloud.siliconflow.cn/account/ak | https://docs.siliconflow.cn |
| **通义千问** | https://tongyi.aliyun.com | https://bailian.console.aliyun.com | https://bailian.console.aliyun.com/#/api-key | https://help.aliyun.com/zh/model-studio |
| **豆包** | https://www.volcengine.com/product/doubao | https://console.volcengine.com/ark | https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey | https://www.volcengine.com/docs/82379 |
| **DeepSeek** | https://www.deepseek.com | https://platform.deepseek.com | https://platform.deepseek.com/api_keys | https://api-docs.deepseek.com |
| **智谱 GLM** | https://www.zhipuai.cn | https://open.bigmodel.cn | https://open.bigmodel.cn/usercenter/apikeys | https://docs.bigmodel.cn |
| **月之暗面 Kimi** | https://www.moonshot.cn | https://platform.moonshot.cn | https://platform.moonshot.cn/console/api-keys | https://platform.moonshot.cn/docs |
| **MiniMax** | https://www.minimaxi.com | https://platform.minimaxi.com | https://platform.minimaxi.com/user-center/basic-information/interface-key | https://platform.minimaxi.com/docs |
| **腾讯混元** | https://hunyuan.tencent.com | https://console.cloud.tencent.com/hunyuan | https://console.cloud.tencent.com/cam/capi | https://cloud.tencent.com/document/product/1729 |
| **OpenAI** | https://openai.com | https://platform.openai.com | https://platform.openai.com/api-keys | https://platform.openai.com/docs |
| **Anthropic** | https://www.anthropic.com | https://console.anthropic.com | https://console.anthropic.com/settings/keys | https://docs.anthropic.com |
| **Google Gemini** | https://ai.google.dev | https://aistudio.google.com | https://aistudio.google.com/apikey | https://ai.google.dev/gemini-api/docs |
| **NVIDIA NIM** | https://build.nvidia.com | https://build.nvidia.com | https://build.nvidia.com/settings | https://docs.api.nvidia.com |
| **Ollama** | https://ollama.com | - | - | https://github.com/ollama/ollama |
| **魔搭社区** | https://www.modelscope.cn | https://modelscope.cn | https://modelscope.cn/my/myaccesstoken | https://modelscope.cn/docs |
| **Xinference** | https://github.com/xorbitsai/inference | - | - | https://inference.readthedocs.io |
| **LM Studio** | https://lmstudio.ai | - | - | https://lmstudio.ai/docs |

---

## 图例说明

| 图标 | 含义 |
|------|------|
| ⭐ 推荐 | **性价比最高**！该分类下的首选模型（通常是 Plus 级别） |
| 🧠 最强 | 顶级能力，复杂任务首选（通常是 Max 级别） |
| 🧠 推理 | 擅长复杂推理的模型（R1、o3 等） |
| 💰 便宜/免费 | 预算有限的好选择 |

---

## 💡 选择建议（小白必看）

### 按场景推荐

| 场景 | 推荐模型 | 说明 |
|------|----------|------|
| **日常使用** | Qwen-Plus、DeepSeek V3.2、豆包 1.8 | 性价比之王，99%的任务都够用 |
| **新手入门** | 硅基流动免费模型（Qwen3 8B、GLM-4 9B） | 完全免费，体验AI |
| **编程开发** | DeepSeek V3.2、MiniMax M2.1、Claude Sonnet 4 | 代码能力强 |
| **复杂推理** | DeepSeek R1、Claude Opus 4.5、o3 | 数学/逻辑/代码难题 |
| **长文档处理** | Kimi（1M上下文）、Qwen-Long | 整本书也能读 |
| **本地隐私** | Ollama + Qwen3 或 Llama 系列 | 数据不出本机 |
| **完全免费** | GLM-4.5 Flash、Gemini、魔搭社区 | 永久免费或大量免费额度 |

### 模型等级说明

- **Plus 级别**（性价比最高）：适合日常 90% 的任务，价格便宜，响应快
- **Max 级别**（顶级能力）：复杂任务首选，效果最好但更贵
- **Mini/Lite 级别**（便宜快速）：简单任务、预算有限时使用
- **推理模型**（R1/o3等）：数学、代码、逻辑难题专用

> ⚠️ **重要提示**：如果模型列表中没有你需要的模型，可以直接手动输入模型ID！各厂商会不断更新模型，我们的列表可能不是最新的。
