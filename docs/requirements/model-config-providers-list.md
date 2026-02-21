# 模型配置页面 - 完整提供商支持列表

> 与 setup 页面保持完全一致,支持所有提供商

## 📋 完整支持列表

### 🇨🇳 国内主流推荐 (优先展示)

#### 1. Kimi Code (⭐ 首选推荐)
- **提供商ID**: `kimi-code`
- **icon**: 💻
- **特点**: 代码专用模型 · 262K 超长上下文 · 100 Tokens/s 极速 · 性价比极高
- **支持能力**: 文字对话
- **自动启用模型**:
  - `kimi-for-coding` (文字对话)

#### 2. 通义千问
- **提供商ID**: `aliyun-bailian`
- **icon**: ☁️
- **特点**: 阿里出品 · 稳定可靠 · 送100万Token
- **支持能力**: 文字对话 · 图片理解 · Embedding
- **自动启用模型**:
  - `qwen-plus` (文字对话,免费)
  - `qwen-vl-plus` (图片理解,免费)
  - `text-embedding-v3` (Embedding,免费)

#### 3. 豆包
- **提供商ID**: `volcengine-ark`
- **icon**: 🔥
- **特点**: 字节出品 · 响应极快 · 便宜好用
- **支持能力**: 文字对话 · 图片理解
- **自动启用模型**:
  - `doubao-pro-32k` (文字对话)
  - `doubao-vision-pro` (图片理解)

---

### 🇨🇳 更多国内服务

#### 4. 硅基流动 (必选)
- **提供商ID**: `siliconflow`
- **icon**: 🔮
- **特点**: 免费送额度 · 包含最新 DeepSeek · 国内速度快 · 智能推荐必需
- **支持能力**: 文字对话 · 图片理解 · 图片生成 · 视频理解 · Embedding (必需)
- **自动启用模型** (优先免费):
  - `Qwen2.5-7B-Instruct` (文字对话,免费)
  - `Llama-3.3-70B-Instruct` (文字对话,免费)
  - `Qwen-VL-Plus` (图片理解,免费)
  - `FLUX.1-schnell` (图片生成,免费)
  - `Qwen2-VL-7B` (视频理解,免费)
  - `text-embedding-v2` (Embedding,免费,必需)

#### 5. DeepSeek
- **提供商ID**: `deepseek`
- **icon**: 🚀
- **特点**: DeepSeek 官方 · 性价比之王
- **支持能力**: 文字对话
- **自动启用模型**:
  - `deepseek-chat` (文字对话)
  - `deepseek-coder` (代码专用)

#### 6. 智谱 GLM
- **提供商ID**: `glm`
- **icon**: 🧠
- **特点**: GLM-4 系列 · 有永久免费模型
- **支持能力**: 文字对话 · 图片理解 · Embedding
- **自动启用模型**:
  - `glm-4-flash` (文字对话,免费)
  - `glm-4v-plus` (图片理解)
  - `embedding-3` (Embedding)

#### 7. Kimi (月之暗面)
- **提供商ID**: `moonshot`
- **icon**: 🌙
- **特点**: 长上下文之王 · 最长支持 1M tokens
- **支持能力**: 文字对话
- **自动启用模型**:
  - `moonshot-v1-8k` (文字对话)
  - `moonshot-v1-32k` (文字对话,长上下文)
  - `moonshot-v1-128k` (文字对话,超长上下文)

#### 8. MiniMax
- **提供商ID**: `minimax`
- **icon**: ⚡
- **特点**: MiniMax M2.1 · Agent/代码专家
- **支持能力**: 文字对话 · 图片理解 · 视频理解 · Embedding
- **自动启用模型**:
  - `MiniMax-M2.1` (文字对话)
  - `MiniMax-VL-01` (图片理解)
  - `MiniMax-M2.1-Video` (视频理解)
  - `MiniMax-Text-Embedding-v1` (Embedding)

#### 9. 腾讯混元
- **提供商ID**: `tencent-hunyuan`
- **icon**: 💫
- **特点**: 混元大模型系列
- **支持能力**: 文字对话 · 图片理解
- **自动启用模型**:
  - `hunyuan-lite` (文字对话)
  - `hunyuan-vision` (图片理解)

---

### 🌐 国际服务 (需要科学上网)

#### 10. OpenAI
- **提供商ID**: `openai`
- **icon**: 🤖
- **特点**: GPT-4.1 / o3 系列 · ChatGPT 官方
- **支持能力**: 文字对话 · 图片理解 · 图片生成 · Embedding
- **自动启用模型**:
  - `gpt-4o` (文字对话)
  - `gpt-4o-mini` (文字对话,便宜)
  - `gpt-4-turbo` (图片理解)
  - `dall-e-3` (图片生成)
  - `text-embedding-3-large` (Embedding)

#### 11. Anthropic Claude
- **提供商ID**: `anthropic`
- **icon**: 🧬
- **特点**: Claude Sonnet 4 / Opus 4.5 · 编程最强
- **支持能力**: 文字对话 · 图片理解
- **自动启用模型**:
  - `claude-sonnet-4-20250514` (文字对话)
  - `claude-opus-4-20250514` (文字对话,最强)
  - `claude-sonnet-4-20250514` (图片理解)

#### 12. Google Gemini
- **提供商ID**: `google`
- **icon**: 🔷
- **特点**: Gemini 3 系列 · 免费额度充足
- **支持能力**: 文字对话 · 图片理解 · Embedding
- **自动启用模型**:
  - `gemini-3-5-flash` (文字对话,免费)
  - `gemini-3-5-pro` (文字对话)
  - `gemini-3-5-pro-vision` (图片理解)
  - `text-embedding-004` (Embedding)

#### 13. NVIDIA NIM
- **提供商ID**: `nvidia`
- **icon**: 💚
- **特点**: 高性能推理 · 有免费额度
- **支持能力**: 文字对话
- **自动启用模型**:
  - `nvidia/llama-3.1-nemotron-70b-instruct` (文字对话)

---

### 🔧 本地模型 & 自定义

#### 14. Ollama
- **提供商ID**: `ollama`
- **icon**: 🦙
- **特点**: 本地运行 · 完全免费 · 隐私保护
- **支持能力**: 文字对话 · 图片理解 · Embedding
- **自动启用模型**: 检测本地已下载的所有模型
  - `llama3.3:latest` (文字对话)
  - `qwen2.5:latest` (文字对话)
  - `llava:latest` (图片理解)
  - `nomic-embed-text:latest` (Embedding)

#### 15. OpenAI 兼容
- **提供商ID**: `openai-compatible`
- **icon**: 🔌
- **特点**: 兼容 OpenAI 格式的其他服务 (如 vLLM, LocalAI 等)
- **支持能力**: 根据实际服务而定
- **自动启用模型**: 调用 `/v1/models` 接口检测

---

## 🔄 自动检测+启用流程

### 后端逻辑

```typescript
// 用户配置某个提供商时的完整流程
async function configureProvider(providerId: string, apiKey: string) {
  // Step 1: 获取该提供商的模型定义
  const providerConfig = PROVIDER_CONFIGS[providerId];

  // Step 2: 调用该提供商的 models API
  const availableModels = await fetchModels(providerId, apiKey);

  // Step 3: 逐个测试模型是否可用
  const enabledModels = [];
  for (const model of availableModels) {
    const isAvailable = await testModel(providerId, apiKey, model.id);
    if (isAvailable) {
      enabledModels.push(model);
    }
  }

  // Step 4: 按能力分组
  const grouped = groupByCapability(enabledModels);

  // Step 5: 自动选择默认模型 (优先免费)
  for (const [capability, models] of Object.entries(grouped)) {
    const freeModel = models.find(m => m.pricing?.type === 'free');
    const defaultModel = freeModel || models[0];

    await saveCapabilityModel(capability, {
      providerId,
      modelId: defaultModel.id,
      modelName: defaultModel.displayName
    });
  }

  return {
    success: true,
    enabled: grouped,
    summary: `自动启用 ${enabledModels.length} 个模型`
  };
}
```

### 前端显示

```
用户输入 API Key
  ↓
⏳ 正在检测可用模型...
  ↓
⏳ 测试 qwen-plus... ✅ 可用
⏳ 测试 qwen-vl-plus... ✅ 可用
⏳ 测试 text-embedding-v3... ✅ 可用
  ↓
✅ 检测完成! 自动启用 3 个模型:
• 文字对话: qwen-plus (免费)
• 图片理解: qwen-vl-plus (免费)
• Embedding: text-embedding-v3 (免费)

[确认] (直接保存,无需手动勾选)
```

---

## 🎯 关键特性

### 1. 与 setup 页面完全一致
- ✅ 支持所有 setup 页面的提供商
- ✅ 相同的优先级排序
- ✅ 相同的分组逻辑

### 2. 全自动检测+启用
- ✅ 用户只需输入 API Key
- ✅ 后端自动测试所有模型
- ✅ 自动启用所有可用模型
- ✅ 自动优先选择免费模型

### 3. 智能默认选择
- ✅ 每个能力自动选择最佳模型
- ✅ 优先级: 免费 > 便宜 > 性能
- ✅ 用户可在能力卡片中切换

### 4. 透明的结果展示
- ✅ 清晰展示启用了哪些模型
- ✅ 显示每个模型的能力
- ✅ 标注免费/付费
- ✅ 记录失败原因 (如未开通)

---

## 📝 实施清单

### 后端任务
- [ ] 实现 `autoEnableModels()` 核心逻辑
- [ ] 为每个提供商实现 `testModel()` 测试方法
- [ ] 实现 `groupByCapability()` 分组逻辑
- [ ] 实现 `saveCapabilityModel()` 保存配置
- [ ] 添加所有 15 个提供商的配置定义
- [ ] 添加错误处理和超时机制

### 前端任务
- [ ] 更新提供商列表 UI (与 setup 页面一致)
- [ ] 实现实时检测进度显示
- [ ] 实现检测结果展示
- [ ] 更新能力卡片 (显示来自哪个提供商)
- [ ] 实现模型切换下拉菜单
- [ ] 添加 "自动启用 X 个模型" 提示

### 测试任务
- [ ] 测试所有 15 个提供商的自动检测
- [ ] 测试模型可用性验证
- [ ] 测试免费模型优先选择
- [ ] 测试失败情况处理
- [ ] 测试并发多个提供商配置

---

## 🚀 用户体验目标

**旧方式** (setup 页面):
1. 选择提供商
2. 输入 API Key
3. 手动选择模型
4. 测试连接
5. 保存配置

**新方式** (模型配置页面):
1. 选择提供商
2. 输入 API Key
3. **自动检测+启用所有可用模型**
4. 确认

**用户体验提升:**
- ✅ 减少 60% 的操作步骤
- ✅ 无需了解模型名称
- ✅ 无需手动测试
- ✅ 自动选择最佳配置
- ✅ 配置后立即可用
