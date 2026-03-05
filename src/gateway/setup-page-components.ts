/**
 * Setup Page UI Components
 * 从 setup-page.ts 提取的 HTML body 和 script 组件（返回 HTML 字符串片段）
 */

import type { PlatformInfo } from "./setup-page-utils.js";
import type { CnProviderConfig } from "../config/region-cn.js";
import { isOverseas } from "../config/edition.js";

/** 组件渲染所需的上下文 */
export interface SetupPageContext {
  logoBase64: string;
  setupQrcodeBase64: string;
  /** OEM 版购买凭证二维码 base64（仅 overseas 有值） */
  oemPurchaseQrcodeBase64: string;
  /** OEM 版技术支持二维码 base64（仅 overseas 有值） */
  oemSupportQrcodeBase64: string;
  platformInfo: PlatformInfo;
  defaultWorkspace: string;
  providers: CnProviderConfig[];
}

/**
 * 渲染页面 body 内容（不含 <body>/<script> 标签本身）
 * 包括：导航栏、步骤条、Page0-5、所有模态框
 */
export function renderBodyContent(
  ctx: SetupPageContext,
  getPlatformTips: (info: PlatformInfo) => string,
): string {
  const {
    logoBase64,
    setupQrcodeBase64,
    oemPurchaseQrcodeBase64,
    oemSupportQrcodeBase64,
    platformInfo,
    defaultWorkspace,
  } = ctx;
  return `
  <!-- 顶部导航栏 -->
  <header class="header">
    <div class="header-logo">
      ${
        logoBase64
          ? `<img src="${logoBase64}" alt="ClawbotCN Logo" />`
          : `<svg viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="url(#logo-gradient)"/>
        <path d="M8 12h16M8 16h12M8 20h8" stroke="white" stroke-width="2" stroke-linecap="round"/>
        <defs>
          <linearGradient id="logo-gradient" x1="0" y1="0" x2="32" y2="32">
            <stop stop-color="#3c83f6"/>
            <stop offset="1" stop-color="#60a5fa"/>
          </linearGradient>
        </defs>
      </svg>`
      }
      <span>ClawbotCN</span>
    </div>
    <div class="header-env">
      <span class="icon">${platformInfo.icon}</span>
      <span>当前环境: ${platformInfo.displayName} · ${platformInfo.sandboxType}</span>
    </div>
  </header>

  <main class="main-container">
    <!-- 步骤进度条 - 5步流程 -->
    <div class="stepper">
      <div class="step-item active" id="stepItem1">
        <div class="step-circle">1</div>
        <div class="step-label">AI服务</div>
      </div>
      <div class="step-connector" id="connector1"></div>
      <div class="step-item" id="stepItem2">
        <div class="step-circle">2</div>
        <div class="step-label">基础设置</div>
      </div>
      <div class="step-connector" id="connector2"></div>
      <div class="step-item" id="stepItem3">
        <div class="step-circle">3</div>
        <div class="step-label">对话方式</div>
      </div>
      <div class="step-connector" id="connector3"></div>
      <div class="step-item" id="stepItem4">
        <div class="step-circle">4</div>
        <div class="step-label">激活</div>
      </div>
      <div class="step-connector" id="connector4"></div>
      <div class="step-item" id="stepItem5">
        <div class="step-circle"><span class="material-icons" style="font-size:18px;">check</span></div>
        <div class="step-label">完成</div>
      </div>
    </div>

    <!-- Page 0: 检测到历史配置的欢迎页面 -->
    <div id="page0" class="card hidden">
      <div class="card-header" style="text-align: center;">
        <h2 style="font-size: 1.8em;">👋 欢迎回来！</h2>
        <p>检测到您之前已配置过 OpenClawCN</p>
      </div>

      <div style="text-align: center; padding: 32px 0;">
        <div style="font-size: 4em; margin-bottom: 16px;">🎉</div>
        <p style="color: var(--text-secondary); font-size: 1.1em; margin-bottom: 24px;">
          您的历史配置仍然有效，可以直接开始使用
        </p>
      </div>

      <div style="background: linear-gradient(135deg, rgba(60, 131, 246, 0.08) 0%, rgba(60, 131, 246, 0.02) 100%); border-radius: var(--radius-lg); padding: 20px; margin-bottom: 24px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
          <span class="material-icons" style="color: var(--accent-blue);">info</span>
          <span style="font-weight: 600;">温馨提示</span>
        </div>
        <p style="color: var(--text-secondary); font-size: 0.95em; margin: 0;">
          如果您需要更换 AI 服务、修改工作目录或更新许可证，可以选择「修改配置」重新设置。
        </p>
      </div>

      <div class="btn-group" style="flex-direction: column; gap: 12px;">
        <button class="btn btn-primary btn-lg" onclick="skipToChat()" style="width: 100%;">
          <span class="material-icons">rocket_launch</span>
          开启 OpenClawCN 世界
        </button>
        <button class="btn btn-secondary" onclick="goToStep(1)" style="width: 100%;">
          <span class="material-icons">settings</span>
          修改配置
        </button>
      </div>
    </div>

    <!-- Step 1: 选择 AI 服务 -->
    <div id="page1" class="card hidden">
      <!-- 右上角悬浮二维码（构建时内联 base64，OEM overseas 版不显示） -->
      ${
        !isOverseas && setupQrcodeBase64
          ? `<div class="qr-corner">
        <div class="qr-corner-info">
          <div class="qr-corner-title">🎁 免费领取教学视频</div>
          <div class="qr-corner-tags">
            <div class="qr-corner-tag"><span class="material-icons">play_circle</span> 专属安装教学视频</div>
            <div class="qr-corner-tag"><span class="material-icons">school</span> 小白快速上手指南</div>
            <div class="qr-corner-tag"><span class="material-icons">groups</span> 加入技术交流群</div>
          </div>
          <div class="qr-corner-scan">📱 微信扫码 · 立即领取</div>
        </div>
        <div class="qr-corner-img"><img src="${setupQrcodeBase64}" alt="领取专属教学视频二维码"></div>
      </div>`
          : ""
      }
      <div class="card-header">
        <h2>第一步：选择 AI 服务</h2>
        <p>选择你要使用的 AI 平台，或者注册一个新账号</p>
      </div>

      <!-- 小提示 -->
      <div class="provider-tip">
        <span class="provider-tip-icon">💡</span>
        <span>不知道选哪个？选「Kimi Code」就对了！代码专用模型，262K 超长上下文，极速响应。也可以试试 Aliyun Code 和 GLM Code！</span>
      </div>
      
      <!-- 模型选择提醒 -->
      <div class="model-reminder" style="background: linear-gradient(135deg, #fff7e6 0%, #fffbe6 100%); border: 1px solid #ffd591; border-radius: 12px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 1.5em;">⚠️</span>
        <span style="color: #ad6800; font-size: 0.9em; font-weight: 500;">配置完成后，记得在模型下拉框中选择你需要的模型！每个平台有多种模型可选。</span>
      </div>

      <!-- 推荐服务商 - 大卡片 (代码助手 Coding Plan) -->
      <div class="provider-recommended-section">
        <div class="provider-section-title">🔥 代码助手 (Coding Plan)</div>
        <div class="provider-recommended-grid">
          <div class="provider-card featured selected" data-provider="kimi-code" onclick="selectProvider('kimi-code')">
            <div class="provider-card-badge">⭐ 首选推荐</div>
            <div class="provider-card-icon">💻</div>
            <div class="provider-card-name">Kimi Code</div>
            <div class="provider-card-desc">代码专用模型 · 262K 超长上下文 · 100 Tokens/s 极速 · 性价比极高</div>
            <a href="https://www.kimi.com/code/docs/" target="_blank" class="provider-card-link" onclick="event.stopPropagation()">
              <span class="material-icons">code</span>
              查看文档，获取 API Key
            </a>
            <div class="provider-card-check"><span class="material-icons">check_circle</span></div>
          </div>
          <div class="provider-card" data-provider="aliyun-codeplan" onclick="selectProvider('aliyun-codeplan')">
            <div class="provider-card-icon">☁️</div>
            <div class="provider-card-name">Aliyun Code</div>
            <div class="provider-card-desc">一个 Key 调 Qwen3.5/Kimi-K2.5/GLM-5/MiniMax · 模型聚合</div>
            <a href="https://www.aliyun.com/benefit/ai/aistar?userCode=xsngby7y&clubBiz=subTask..12414078..10263.." target="_blank" class="provider-card-link" onclick="event.stopPropagation()">
              <span class="material-icons">rocket_launch</span>
              免费注册 AI Star
            </a>
            <div class="provider-card-check"><span class="material-icons">check_circle</span></div>
          </div>
          <div class="provider-card" data-provider="glm-codeplan" onclick="selectProvider('glm-codeplan')">
            <div class="provider-card-icon">🧠</div>
            <div class="provider-card-name">GLM Code</div>
            <div class="provider-card-desc">GLM-5 · 智谱 Coding Plan · 代码专用</div>
            <a href="https://www.bigmodel.cn/glm-coding?ic=ZPADWSX0SI" target="_blank" class="provider-card-link" onclick="event.stopPropagation()">
              <span class="material-icons">rocket_launch</span>
              注册获取 Coding Plan Key
            </a>
            <div class="provider-card-check"><span class="material-icons">check_circle</span></div>
          </div>
          <div class="provider-card" data-provider="minimax-codeplan" onclick="selectProvider('minimax-codeplan')">
            <div class="provider-card-icon">⚡</div>
            <div class="provider-card-name">MiniMax Code</div>
            <div class="provider-card-desc">MiniMax-M2.5 · Coding Plan 订阅 · Anthropic 协议</div>
            <a href="https://platform.minimaxi.com/subscribe/coding-plan?code=I5REQrAnfL&source=link" target="_blank" class="provider-card-link" onclick="event.stopPropagation()">
              <span class="material-icons">rocket_launch</span>
              订阅 Coding Plan
            </a>
            <div class="provider-card-check"><span class="material-icons">check_circle</span></div>
          </div>
        </div>
      </div>

      <!-- 其他国内服务商 - 折叠 -->
      <div class="provider-other-section">
        <div class="provider-other-toggle" onclick="toggleOtherProviders()">
          <span class="material-icons" id="providerToggleIcon">expand_more</span>
          <span>🇨🇳 更多国内服务</span>
        </div>
        <div class="provider-other-content hidden" id="providerOtherContent">
          <div class="provider-other-grid">
            <div class="provider-option" data-provider="siliconflow" onclick="selectProvider('siliconflow')">
              <div class="provider-option-icon">🔮</div>
              <div class="provider-option-info">
                <div class="provider-option-name">硅基流动</div>
                <div class="provider-option-desc">免费送额度 · 包含最新 DeepSeek · 国内速度快</div>
                <a href="https://cloud.siliconflow.cn/i/uXXX7IEi" target="_blank" class="provider-option-link" onclick="event.stopPropagation()">
                  <span class="material-icons">rocket_launch</span>免费注册，领取额度
                </a>
              </div>
              <div class="provider-option-check"><span class="material-icons">check_circle</span></div>
            </div>
            <div class="provider-option" data-provider="minimax" onclick="selectProvider('minimax')">
              <div class="provider-option-icon">⚡</div>
              <div class="provider-option-info">
                <div class="provider-option-name">MiniMax</div>
                <div class="provider-option-desc">MiniMax M2.5，Agent/代码专家</div>
                <a href="https://platform.minimaxi.com/subscribe/coding-plan?code=I5REQrAnfL&source=link" target="_blank" class="provider-option-link" onclick="event.stopPropagation()">
                  <span class="material-icons">rocket_launch</span>注册领取免费额度
                </a>
              </div>
              <div class="provider-option-check"><span class="material-icons">check_circle</span></div>
            </div>
            <div class="provider-option" data-provider="deepseek" onclick="selectProvider('deepseek')">
              <div class="provider-option-icon">🚀</div>
              <div class="provider-option-info">
                <div class="provider-option-name">DeepSeek</div>
                <div class="provider-option-desc">DeepSeek 官方，性价比之王</div>
                <a href="https://platform.deepseek.com/api_keys" target="_blank" class="provider-option-link" onclick="event.stopPropagation()">
                  <span class="material-icons">rocket_launch</span>注册获取 API Key
                </a>
              </div>
              <div class="provider-option-check"><span class="material-icons">check_circle</span></div>
            </div>
            <div class="provider-option" data-provider="volcengine-ark" onclick="selectProvider('volcengine-ark')">
              <div class="provider-option-icon">🌋</div>
              <div class="provider-option-info">
                <div class="provider-option-name">豆包</div>
                <div class="provider-option-desc">字节出品，响应极快，便宜好用</div>
                <a href="https://console.volcengine.com/ark/" target="_blank" class="provider-option-link" onclick="event.stopPropagation()">
                  <span class="material-icons">rocket_launch</span>注册开通豆包
                </a>
              </div>
              <div class="provider-option-check"><span class="material-icons">check_circle</span></div>
            </div>
            <div class="provider-option" data-provider="moonshot" onclick="selectProvider('moonshot')">
              <div class="provider-option-icon">🌙</div>
              <div class="provider-option-info">
                <div class="provider-option-name">Kimi (月之暗面)</div>
                <div class="provider-option-desc">长上下文之王，最长支持1M tokens</div>
                <a href="https://platform.moonshot.cn/console/api-keys" target="_blank" class="provider-option-link" onclick="event.stopPropagation()">
                  <span class="material-icons">rocket_launch</span>注册获取 API Key
                </a>
              </div>
              <div class="provider-option-check"><span class="material-icons">check_circle</span></div>
            </div>
            <div class="provider-option" data-provider="tencent-hunyuan" onclick="selectProvider('tencent-hunyuan')">
              <div class="provider-option-icon">💫</div>
              <div class="provider-option-info">
                <div class="provider-option-name">腾讯混元</div>
                <div class="provider-option-desc">混元大模型系列</div>
                <a href="https://cloud.tencent.com/product/hunyuan" target="_blank" class="provider-option-link" onclick="event.stopPropagation()">
                  <span class="material-icons">rocket_launch</span>注册开通混元
                </a>
              </div>
              <div class="provider-option-check"><span class="material-icons">check_circle</span></div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 国际服务 - 折叠 -->
      <div class="provider-other-section">
        <div class="provider-other-toggle" onclick="toggleInternationalProviders()">
          <span class="material-icons" id="internationalToggleIcon">expand_more</span>
          <span>🌐 国际服务 <span class="provider-section-note">（需要科学上网）</span></span>
        </div>
        <div class="provider-other-content hidden" id="internationalProviderContent">
          <div class="provider-other-grid">
            <div class="provider-option" data-provider="openai" onclick="selectProvider('openai')">
              <div class="provider-option-icon">🤖</div>
              <div class="provider-option-info">
                <div class="provider-option-name">OpenAI</div>
                <div class="provider-option-desc">GPT-4.1 / o3 系列，ChatGPT 官方</div>
              </div>
              <div class="provider-option-check"><span class="material-icons">check_circle</span></div>
            </div>
            <div class="provider-option" data-provider="anthropic" onclick="selectProvider('anthropic')">
              <div class="provider-option-icon">🧬</div>
              <div class="provider-option-info">
                <div class="provider-option-name">Anthropic Claude</div>
                <div class="provider-option-desc">Claude Sonnet 4 / Opus 4.5，编程最强</div>
              </div>
              <div class="provider-option-check"><span class="material-icons">check_circle</span></div>
            </div>
            <div class="provider-option" data-provider="google" onclick="selectProvider('google')">
              <div class="provider-option-icon">🔷</div>
              <div class="provider-option-info">
                <div class="provider-option-name">Google Gemini</div>
                <div class="provider-option-desc">Gemini 3 系列，免费额度充足</div>
              </div>
              <div class="provider-option-check"><span class="material-icons">check_circle</span></div>
            </div>
            <div class="provider-option" data-provider="nvidia" onclick="selectProvider('nvidia')">
              <div class="provider-option-icon">💚</div>
              <div class="provider-option-info">
                <div class="provider-option-name">NVIDIA NIM</div>
                <div class="provider-option-desc">高性能推理，有免费额度</div>
              </div>
              <div class="provider-option-check"><span class="material-icons">check_circle</span></div>
            </div>
            <div class="provider-option" data-provider="openrouter" onclick="selectProvider('openrouter')">
              <div class="provider-option-icon">🔀</div>
              <div class="provider-option-info">
                <div class="provider-option-name">OpenRouter</div>
                <div class="provider-option-desc">聚合多家模型，统一 API，按量付费</div>
              </div>
              <div class="provider-option-check"><span class="material-icons">check_circle</span></div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 本地模型 & 自定义 - 折叠 -->
      <div class="provider-other-section">
        <div class="provider-other-toggle" onclick="toggleLocalProviders()">
          <span class="material-icons" id="localToggleIcon">expand_more</span>
          <span>🔧 本地模型 & 自定义</span>
        </div>
        <div class="provider-other-content hidden" id="localProviderContent">
          <div class="provider-other-grid">
            <div class="provider-option" data-provider="modelscope" onclick="selectProvider('modelscope')">
              <div class="provider-option-icon">🎯</div>
              <div class="provider-option-info">
                <div class="provider-option-name">魔搭社区</div>
                <div class="provider-option-desc">完全免费！每日2000次调用</div>
              </div>
              <div class="provider-option-check"><span class="material-icons">check_circle</span></div>
            </div>
            <div class="provider-option" data-provider="ollama" onclick="selectProvider('ollama')">
              <div class="provider-option-icon">🦙</div>
              <div class="provider-option-info">
                <div class="provider-option-name">Ollama 本地模型</div>
                <div class="provider-option-desc">本地运行，完全免费，数据私密</div>
              </div>
              <div class="provider-option-check"><span class="material-icons">check_circle</span></div>
            </div>
            <div class="provider-option" data-provider="custom" onclick="selectProvider('custom')">
              <div class="provider-option-icon">⚙️</div>
              <div class="provider-option-info">
                <div class="provider-option-name">自定义 API</div>
                <div class="provider-option-desc">Xinference、LM Studio 或其他 OpenAI 兼容服务</div>
              </div>
              <div class="provider-option-check"><span class="material-icons">check_circle</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- API Key 输入区域 -->
      <div id="apiKeyForm" class="hidden" style="margin-top: 20px;">
        <div class="apikey-section">
          <div class="apikey-header">
            <span class="apikey-header-icon">🔑</span>
            <span id="apiKeyLabel">API Key</span>
            <span class="apikey-header-hint">👆 点击上方金色按钮注册后获取</span>
          </div>
          <div class="apikey-input-wrapper">
            <input type="password" class="apikey-input" id="apiKeyInput" placeholder="在这里粘贴你的 API Key...">
            <button type="button" class="apikey-toggle-btn" onclick="togglePasswordVisibility()">
              <span class="material-icons" id="passwordIcon">visibility</span>
            </button>
          </div>
          <div class="form-help" id="apiKeyHelp">在对应平台的控制台获取 API Key</div>
          
          <!-- 硅基流动常见问题提示 -->
          <div id="siliconflowFaqTip" class="provider-faq-tip hidden">
            <div class="provider-faq-tip-header">
              <span class="material-icons">warning_amber</span>
              <span>硅基流动常见问题</span>
            </div>
            <div class="provider-faq-tip-content">
              <div class="provider-faq-item">
                <span class="provider-faq-icon">1️⃣</span>
                <span><strong>必须实名认证</strong>：注册后需完成实名认证才能使用 API</span>
              </div>
              <div class="provider-faq-item">
                <span class="provider-faq-icon">2️⃣</span>
                <span><strong>领取免费额度</strong>：<a href="https://cloud.siliconflow.cn/expenseManage/expense" target="_blank">点击这里领取抵扣金</a>，否则余额为 0 无法调用</span>
              </div>
              <div class="provider-faq-item">
                <span class="provider-faq-icon">3️⃣</span>
                <span><strong>获取 API Key</strong>：在 <a href="https://cloud.siliconflow.cn/account/ak" target="_blank">API 密钥页面</a> 创建密钥</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 模型选择 - 简化显示 -->
        <div class="model-section" id="modelSection">
          <div class="model-header">
            <span>模型</span>
            <span class="model-hint" id="modelHint">（推荐值已选好，直接下一步即可）</span>
          </div>
          <!-- 模型 Combobox：支持下拉选择和手动输入 -->
          <div class="model-combobox" id="modelCombobox">
            <input type="text" class="model-select" id="modelSelect"
                   placeholder="-- 请先选择 AI 平台 --"
                   autocomplete="off">
            <span class="model-editable-tag" id="modelEditableTag">✏️ 可编辑</span>
            <span class="material-icons model-combobox-arrow">expand_more</span>
            <div class="model-dropdown" id="modelDropdown"></div>
          </div>
          <div class="model-input-hint">
            <span class="model-input-hint-icon">💡</span>
            <span>选好后也能随时改 — 直接删改输入框里的模型名即可，不是选了就定死的</span>
          </div>
          <!-- 自定义 API 的端点提示（模型输入复用上面的 combobox） -->
          <div id="modelInputSection" class="hidden" style="margin-top: 8px;">
            <div class="form-help" id="modelInputHelp"></div>
          </div>
        </div>

        <!-- 自定义 API 端点输入框 -->
        <div id="customEndpointSection" class="hidden" style="margin-top: 16px;">
          <div class="form-group">
            <label class="form-label">API 端点 <span class="required">*</span></label>
            <input type="text" class="form-input mono" id="customEndpoint" placeholder="例如: http://localhost:11434/v1">
            <div class="form-help">兼容 OpenAI 格式的 API 地址（如 Ollama、LM Studio）</div>
          </div>
        </div>

        <div id="apiKeyStatus" class="status-message"></div>
      </div>

      <div class="btn-group">
        <button class="btn btn-primary btn-lg" onclick="nextStep(1)" id="step1Next" disabled>
          下一步
          <span class="material-icons">arrow_forward</span>
        </button>
      </div>
    </div>

    <!-- Step 2: 基础设置（合并AI能力+工作目录） -->
    <div id="page2" class="card hidden">
      <div class="card-header">
        <h2>第二步：基础设置</h2>
        <p>设置 AI 助手的能力范围和工作目录</p>
      </div>

      <!-- Part 1: AI能力选择 -->
      <div class="settings-section">
        <div class="settings-section-title">
          <span class="settings-section-icon">🎯</span>
          <span>AI 能做什么？</span>
        </div>

        <!-- 完全信任 - 大卡片，放最上面 -->
        <div class="security-big-card trust-card" data-security="trust" onclick="selectSecurity('trust')">
          <div class="security-big-header">
            <div class="security-big-icon">⚡</div>
            <div class="security-big-info">
              <div class="security-big-title">完全信任</div>
              <div class="security-big-subtitle trust-highlight">解锁全部能力 · AI 可以帮你做任何事</div>
            </div>
            <div class="security-big-check"><span class="material-icons">check_circle</span></div>
          </div>
          <div class="security-big-features">
            <div class="feature-item positive">✅ 无任何限制，AI 可访问整个系统</div>
            <div class="feature-item positive">✅ 自动执行复杂任务，效率最高</div>
            <div class="feature-item danger">⚠️ 有风险，仅建议开发者或独立测试设备使用</div>
          </div>
        </div>

        <!-- 正常使用 - 大卡片，放中间，推荐 -->
        <div class="security-big-card standard-card selected" data-security="standard" onclick="doSelectSecurity('standard')">
          <div class="security-recommended-badge">⭐ 推荐</div>
          <div class="security-big-header">
            <div class="security-big-icon">🏠</div>
            <div class="security-big-info">
              <div class="security-big-title">正常使用</div>
              <div class="security-big-subtitle">平衡安全与能力 · 适合日常办公、学习、写作</div>
            </div>
            <div class="security-big-check"><span class="material-icons">check_circle</span></div>
          </div>
          <div class="security-big-features">
            <div class="feature-item positive">✅ 帮你打开软件、浏览网页、搜索信息</div>
            <div class="feature-item positive">✅ 帮你在指定文件夹内读写、整理文件</div>
            <div class="feature-item warning">⚠️ 删除文件等敏感操作会先询问你</div>
          </div>
        </div>

        <!-- 只聊天 - 折叠 -->
        <div class="security-other-options">
          <div class="security-other-toggle" onclick="toggleOtherSecurityOptions()">
            <span class="material-icons" id="securityToggleIcon">expand_more</span>
            <span>查看更保守的选项</span>
          </div>
          <div class="security-other-content hidden" id="securityOtherContent">
            <div class="security-option-card" data-security="full" onclick="doSelectSecurity('full')">
              <div class="security-option-icon">🔒</div>
              <div class="security-option-content">
                <div class="security-option-title">只聊天</div>
                <div class="security-option-desc">绝对安全模式 · AI 完全无法操作你的电脑</div>
                <div class="security-option-detail">
                  <span class="detail-tag safe">🛡️ 零风险</span>
                  <span class="detail-text">适合：纯问答、学习知识、头脑风暴</span>
                </div>
              </div>
              <div class="security-option-check"><span class="material-icons">check_circle</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Part 2: 工作目录设置 -->
      <div class="settings-section" id="workspaceSettingsSection">
        <div class="settings-section-title">
          <span class="settings-section-icon">📁</span>
          <span>AI 的工作目录</span>
        </div>
        
        <div class="workspace-compact">
          <div class="workspace-input-area">
            <div class="workspace-input-wrapper">
              <span class="workspace-input-icon material-icons">folder</span>
              <input type="text" class="workspace-input" id="workspaceInput" placeholder="点击右侧按钮选择文件夹..." value="${defaultWorkspace}" readonly>
            </div>
            <button type="button" class="workspace-browse-btn" onclick="browseWorkspace()">
              <span class="material-icons">folder_open</span>
              浏览
            </button>
          </div>
          <div class="workspace-hint">AI 只能在这个文件夹内读写文件</div>
          <div class="workspace-warning">
            <span class="material-icons">warning</span>
            <div class="workspace-warning-text">
              <strong>重要提醒：</strong>请勿将工作目录设置在系统盘（C 盘）！AI 在工作时会创建、修改和删除文件，如果误操作可能导致系统文件损坏，影响电脑正常使用。建议选择 D 盘或其他非系统盘。
            </div>
          </div>
        </div>

        <!-- 额外信任目录 - 折叠 -->
        <div class="extra-dirs-section" id="trustedDirsSection">
          <div class="extra-dirs-header" onclick="toggleExtraDirs()">
            <div class="extra-dirs-title">
              <span class="material-icons">add_circle_outline</span>
              添加额外目录（可选）
            </div>
            <span class="extra-dirs-arrow material-icons" id="extraDirsArrow">expand_more</span>
          </div>
          <div class="extra-dirs-content hidden" id="extraDirsContent">
            <div id="trustedDirsList" class="dir-list">
              <div class="dir-empty">暂未添加</div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="addTrustedDir()" style="width: 100%; margin-top: 8px;">
              <span class="material-icons">add</span>
              添加
            </button>
          </div>
        </div>
      </div>

      <!-- 简化的确认 -->
      <div class="simple-agreement">
        <div class="simple-agreement-checkbox" id="agreementCheckbox">
          <input type="checkbox" id="agreeTerms" onclick="updateAgreement()">
          <label for="agreeTerms">我已了解并同意</label>
        </div>
        <div class="agreement-disclaimer">
          ${
            isOverseas
              ? "AI-generated content may be inaccurate or biased. By using this software you acknowledge the risks. We are not liable for any errors or potential risks. Please use responsibly."
              : "虽然 AI 现在很强大，但 AI 生成内容可能存在随机性或偏差。使用 OpenClawCN 即表示你已了解风险：我们不对 AI 产生的任何错误或潜在风险承担法律责任。请理性对待，安全使用哦~"
          }
        </div>
      </div>

      <div class="btn-group">
        <button class="btn btn-secondary" onclick="prevStep(2)">
          <span class="material-icons">arrow_back</span>
          上一步
        </button>
        <button class="btn btn-primary btn-lg" onclick="nextStep(2)">
          下一步
          <span class="material-icons">arrow_forward</span>
        </button>
      </div>
    </div>

    <!-- Step 3: 选择对话方式 -->
    <div id="page3" class="card hidden">
      <div class="card-header">
        <h2>第三步：选择对话方式</h2>
        <p>选择你与 AI 助手交流的方式</p>
      </div>

      <!-- 网页对话选项 - 默认推荐 -->
      <div class="channel-mode-selector">
        <div class="channel-mode-card selected" data-mode="web" onclick="selectChannelMode('web')">
          <div class="channel-mode-icon">🌐</div>
          <div class="channel-mode-content">
            <div class="channel-mode-title">
              网页对话
              <span class="channel-mode-badge recommended">✨ 推荐</span>
            </div>
            <div class="channel-mode-desc">直接在浏览器中和 AI 对话，零配置立即可用</div>
            <div class="channel-mode-features">
              <span class="feature-tag">✅ 零配置</span>
              <span class="feature-tag">✅ 立即可用</span>
              <span class="feature-tag">✅ 手机电脑都能访问</span>
            </div>
          </div>
          <div class="channel-mode-check"><span class="material-icons">check_circle</span></div>
        </div>

        <div class="channel-mode-card" data-mode="im" onclick="selectChannelMode('im')">
          <div class="channel-mode-icon">💬</div>
          <div class="channel-mode-content">
            <div class="channel-mode-title">钉钉 / 飞书 / 企业微信机器人</div>
            <div class="channel-mode-desc">通过企业IM发消息给AI（需要企业管理员权限）</div>
            <div class="channel-mode-features">
              <span class="feature-tag subtle">需要配置</span>
              <span class="feature-tag subtle">需要企业账号</span>
            </div>
          </div>
          <div class="channel-mode-check"><span class="material-icons">check_circle</span></div>
        </div>
      </div>

      <!-- 网页对话说明 -->
      <div id="webModeInfo" class="channel-mode-detail">
        <div class="web-mode-info">
          <div class="web-mode-info-icon">💡</div>
          <div class="web-mode-info-content">
            <div class="web-mode-info-title">配置完成后，你可以这样使用：</div>
            <ul class="web-mode-steps">
              <li>在浏览器访问 <code>http://localhost:18789</code> 开始对话</li>
              <li>也可以通过手机访问（需在同一局域网内）</li>
              <li>随时可以在设置中添加钉钉/飞书/企业微信渠道</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- IM配置区域 - 折叠 -->
      <div id="imConfigSection" class="im-config-section hidden">
        <div class="im-config-header">
          <span class="material-icons">settings</span>
          <span>配置企业IM机器人</span>
        </div>
        
        <!-- 渠道选择 -->
        <div class="channel-selector" id="channelList">
          <div class="channel-tab selected" data-channel="dingtalk" onclick="selectChannelTab('dingtalk')">
            <span class="channel-tab-icon">📱</span>
            <span class="channel-tab-name">钉钉</span>
          </div>
          <div class="channel-tab" data-channel="feishu" onclick="selectChannelTab('feishu')">
            <span class="channel-tab-icon">🪶</span>
            <span class="channel-tab-name">飞书</span>
          </div>
          <div class="channel-tab" data-channel="wecom" onclick="selectChannelTab('wecom')">
            <span class="channel-tab-icon">💼</span>
            <span class="channel-tab-name">企业微信</span>
          </div>
        </div>

        <!-- 钉钉配置表单 -->
        <div id="dingtalkConfigForm" class="channel-config-form">
          <div class="channel-config-header">
            <span class="channel-config-icon">📱</span>
            <div>
              <div class="channel-config-title">钉钉机器人配置</div>
              <div class="channel-config-subtitle">使用 Stream 模式，<strong>无需公网 IP</strong>，本地即可接收消息</div>
            </div>
            <button type="button" class="channel-config-help" onclick="toggleDingtalkGuide()">
              <span class="material-icons">help_outline</span>
              查看配置指南
            </button>
          </div>

          <!-- 钉钉配置指南 -->
          <div id="dingtalkGuide" class="channel-guide hidden">
            <div class="guide-header">
              <span class="material-icons">menu_book</span>
              <span>钉钉 Stream 模式配置指南（详细版）</span>
              <button type="button" class="guide-close-btn" onclick="toggleDingtalkGuide()">
                <span class="material-icons">close</span>
                收起
              </button>
            </div>
            
            <!-- 前置条件 -->
            <div class="guide-prereq">
              <div class="guide-prereq-title">📋 前置条件</div>
              <ul class="guide-prereq-list">
                <li>✅ 拥有<strong>钉钉企业管理员</strong>或<strong>开发者权限</strong></li>
                <li>✅ 企业已完成<strong>钉钉认证</strong>（否则无法创建应用）</li>
                <li>✅ 电脑已登录钉钉账号（用于扫码登录开放平台）</li>
              </ul>
            </div>

            <div class="guide-content">
              <div class="guide-step">
                <div class="guide-step-number">1</div>
                <div class="guide-step-content">
                  <div class="guide-step-title"><strong>登录钉钉开放平台</strong></div>
                  <div class="guide-step-desc">
                    <ol class="guide-substeps">
                      <li>打开浏览器，访问 <a href="https://open-dev.dingtalk.com" target="_blank"><strong>open-dev.dingtalk.com</strong></a></li>
                      <li>看到页面后，点击<strong>右上角</strong>的蓝色「<strong>登录</strong>」按钮</li>
                      <li>页面会显示二维码，打开手机<strong>钉钉 App</strong>，扫描二维码登录</li>
                      <li>如果你有多个企业，会弹出企业选择框，<strong>选择要创建机器人的企业</strong></li>
                      <li>登录成功后，会进入「<strong>开发者后台</strong>」首页</li>
                    </ol>
                    <span class="guide-tip">⚠️ 注意：必须使用<strong>企业管理员账号</strong>或有<strong>开发者权限</strong>的账号登录，普通员工账号可能没有权限</span>
                  </div>
                </div>
              </div>

              <div class="guide-step">
                <div class="guide-step-number">2</div>
                <div class="guide-step-content">
                  <div class="guide-step-title"><strong>创建企业内部应用</strong></div>
                  <div class="guide-step-desc">
                    <ol class="guide-substeps">
                      <li>登录后看到开发者后台首页</li>
                      <li>看<strong>页面左侧的菜单栏</strong>，找到并点击「<strong>应用开发</strong>」</li>
                      <li>展开后会看到几个选项，点击「<strong>企业内部开发</strong>」</li>
                      <li>在右侧页面中，点击蓝色的「<strong>创建应用</strong>」按钮</li>
                      <li>弹出创建应用的表单，填写：
                        <div class="guide-field-desc">
                          <div class="guide-field-row"><span class="guide-field-name">应用名称：</span>给机器人起个名字，比如 "AI 助手" 或 "小智"</div>
                          <div class="guide-field-row"><span class="guide-field-name">应用描述：</span>简单写一下用途，比如 "智能问答助手"</div>
                          <div class="guide-field-row"><span class="guide-field-name">应用图标：</span>可以上传一个图片作为机器人头像（可跳过）</div>
                        </div>
                      </li>
                      <li>填写完成后，点击表单底部的「<strong>确定创建</strong>」按钮</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div class="guide-step">
                <div class="guide-step-number">3</div>
                <div class="guide-step-content">
                  <div class="guide-step-title"><strong>获取 AppKey 和 AppSecret（重要！请复制保存）</strong></div>
                  <div class="guide-step-desc">
                    <ol class="guide-substeps">
                      <li>创建成功后，会<strong>自动跳转到应用详情页</strong></li>
                      <li>看<strong>页面左侧菜单</strong>，点击「<strong>凭证与基础信息</strong>」（在"基础信息"分组下）</li>
                      <li>在右侧页面中，你会看到一个表格，里面有：
                        <div class="guide-field-desc">
                          <div class="guide-field-row">
                            <span class="guide-field-name">Client ID（即 AppKey）：</span>
                            一串字母数字，形如 <code>dingxxxxxxxxxx</code>，点击右边的<strong>复制图标</strong>复制它
                          </div>
                          <div class="guide-field-row">
                            <span class="guide-field-name">Client Secret（即 AppSecret）：</span>
                            默认显示为 ****，点击「<strong>查看</strong>」按钮，可能需要手机钉钉扫码验证，验证后会显示完整的 Secret，<strong>立即复制</strong>！
                          </div>
                        </div>
                      </li>
                      <li>把复制的 <strong>AppKey</strong> 和 <strong>AppSecret</strong> 粘贴到下方的输入框中</li>
                    </ol>
                    <span class="guide-tip">🔐 <strong>非常重要</strong>：AppSecret 只显示一次！关闭页面后就看不到了。请<strong>立即复制并保存到安全的地方</strong>。如果忘记了，只能点「重置」生成新的。</span>
                  </div>
                </div>
              </div>

              <div class="guide-step">
                <div class="guide-step-number">4</div>
                <div class="guide-step-content">
                  <div class="guide-step-title"><strong>添加「机器人」能力</strong></div>
                  <div class="guide-step-desc">
                    <ol class="guide-substeps">
                      <li>还是在应用详情页，看<strong>左侧菜单</strong></li>
                      <li>找到「<strong>添加应用能力</strong>」并点击（可能在"应用能力"分组下）</li>
                      <li>右侧会显示各种能力卡片，找到「<strong>机器人</strong>」这个卡片</li>
                      <li>点击机器人卡片上的「<strong>添加</strong>」按钮</li>
                      <li>添加成功后，左侧菜单会多出一个「<strong>机器人</strong>」选项</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div class="guide-step">
                <div class="guide-step-number">5</div>
                <div class="guide-step-content">
                  <div class="guide-step-title"><strong>配置机器人 - 选择 Stream 模式（最关键的一步！）</strong></div>
                  <div class="guide-step-desc">
                    <ol class="guide-substeps">
                      <li>点击左侧菜单的「<strong>机器人</strong>」（刚才添加的）</li>
                      <li>进入机器人配置页面，你会看到一个表单</li>
                      <li><strong style="color: #ef4444;">最重要的一步来了：</strong>找到「<strong>消息接收模式</strong>」这一项</li>
                      <li>你会看到两个选项：「HTTP 模式」和「<strong>Stream 模式</strong>」</li>
                      <li><strong style="color: #22c55e; font-size: 1.1em; background: rgba(34,197,94,0.1); padding: 4px 8px; border-radius: 4px;">⭐ 请选择「Stream 模式」！不要选 HTTP 模式！</strong></li>
                      <li>填写下面的信息：
                        <div class="guide-field-desc">
                          <div class="guide-field-row"><span class="guide-field-name">机器人名称：</span>用户在钉钉里看到的机器人名字</div>
                          <div class="guide-field-row"><span class="guide-field-name">机器人描述：</span>简单说明机器人功能</div>
                        </div>
                      </li>
                      <li>填好后，点击页面底部的「<strong>发布</strong>」按钮保存</li>
                    </ol>
                    <span class="guide-tip">💡 <strong>为什么一定要选 Stream 模式？</strong><br>
                    选了 Stream 模式后：<br>
                    ✅ 不需要买服务器<br>
                    ✅ 不需要有公网 IP<br>
                    ✅ 不需要配置域名和 HTTPS<br>
                    ✅ 在自己电脑上运行 OpenClawCN 就能收到消息<br><br>
                    如果选了 HTTP 模式，你需要有一台能被外网访问的服务器，配置起来很麻烦！</span>
                  </div>
                </div>
              </div>

              <div class="guide-step">
                <div class="guide-step-number">6</div>
                <div class="guide-step-content">
                  <div class="guide-step-title"><strong>添加权限（推荐做，不做也能用）</strong></div>
                  <div class="guide-step-desc">
                    <ol class="guide-substeps">
                      <li>点击左侧菜单的「<strong>权限管理</strong>」</li>
                      <li>在右侧页面顶部，有一个<strong>搜索框</strong></li>
                      <li>搜索「<strong>机器人发送消息</strong>」，找到后点击「<strong>申请权限</strong>」</li>
                      <li>可选：搜索「<strong>通讯录</strong>」添加读取用户信息的权限</li>
                      <li>添加完想要的权限后，点击「<strong>批量申请</strong>」按钮</li>
                    </ol>
                    <span class="guide-tip">💡 权限会自动通过（企业内部应用不需要审核），如果不加这些权限，基本功能也能用</span>
                  </div>
                </div>
              </div>

              <div class="guide-step">
                <div class="guide-step-number">7</div>
                <div class="guide-step-content">
                  <div class="guide-step-title"><strong>发布应用，让员工能用上</strong></div>
                  <div class="guide-step-desc">
                    <ol class="guide-substeps">
                      <li>点击左侧菜单的「<strong>版本管理与发布</strong>」</li>
                      <li>在右侧页面，点击「<strong>创建新版本</strong>」按钮</li>
                      <li>填写版本信息：
                        <div class="guide-field-desc">
                          <div class="guide-field-row"><span class="guide-field-name">版本号：</span>填 <code>1.0.0</code> 就行</div>
                          <div class="guide-field-row"><span class="guide-field-name">版本描述：</span>填"首次发布"或随便写点</div>
                        </div>
                      </li>
                      <li>点击「<strong>保存</strong>」然后点「<strong>发布</strong>」</li>
                      <li>企业内部应用一般<strong>秒过审核</strong>，稍等几秒就发布成功了</li>
                    </ol>
                    <span class="guide-tip">✅ <strong>发布成功！</strong>现在员工打开钉钉，在搜索框搜索你的机器人名字，就能找到并开始聊天了！</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 常见问题 -->
            <div class="guide-faq">
              <div class="guide-faq-title">❓ 常见问题</div>
              <div class="guide-faq-item">
                <div class="guide-faq-q">Q: 提示"AppKey 不存在或无效"？</div>
                <div class="guide-faq-a">A: 检查 AppKey 是否复制完整，确认应用已发布上线。</div>
              </div>
              <div class="guide-faq-item">
                <div class="guide-faq-q">Q: 提示"AppSecret 不正确"？</div>
                <div class="guide-faq-a">A: AppSecret 可能已过期或复制错误，可在开放平台重新生成。</div>
              </div>
              <div class="guide-faq-item">
                <div class="guide-faq-q">Q: 机器人不响应消息？</div>
                <div class="guide-faq-a">A: 检查：1) 应用是否已发布 2) 是否选择了 Stream 模式 3) OpenClawCN Gateway 是否正在运行</div>
              </div>
            </div>

            <div class="guide-footer">
              <a href="https://open.dingtalk.com/document/orgapp/create-an-interface-based-chatbot" target="_blank" class="guide-link">
                <span class="material-icons">open_in_new</span>
                查看钉钉官方文档
              </a>
              <a href="https://opensource.dingtalk.com/developerpedia/docs/learn/stream/overview" target="_blank" class="guide-link">
                <span class="material-icons">open_in_new</span>
                Stream 模式详解
              </a>
            </div>
          </div>

          <div class="channel-config-fields">
            <div class="form-group">
              <label class="form-label">App Key (Client ID) <span class="required">*</span></label>
              <input type="text" class="form-input mono" id="dingtalkAppKey" placeholder="例如：dingxxxxxxxx">
              <div class="form-help">在「应用信息」→「凭证与基础信息」中获取</div>
            </div>
            <div class="form-group">
              <label class="form-label">App Secret (Client Secret) <span class="required">*</span></label>
              <div class="password-input-wrapper">
                <input type="password" class="form-input mono" id="dingtalkAppSecret" placeholder="请输入 App Secret">
                <button type="button" class="password-toggle" onclick="toggleDingtalkSecretVisibility()">
                  <span class="material-icons" id="dingtalkSecretIcon">visibility</span>
                </button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">机器人 Token（可选）</label>
              <input type="text" class="form-input mono" id="dingtalkRobotToken" placeholder="如有单聊机器人，填写 Token">
              <div class="form-help">用于接收单聊消息回调，Stream 模式下通常不需要</div>
            </div>
          </div>

          <div id="dingtalkConfigStatus" class="status-message"></div>
        </div>

        <!-- 飞书配置表单 -->
        <div id="feishuConfigForm" class="channel-config-form hidden">
          <div class="channel-config-header">
            <span class="channel-config-icon">🪶</span>
            <div>
              <div class="channel-config-title">飞书机器人配置</div>
              <div class="channel-config-subtitle">使用 WebSocket 长连接，<strong>无需公网 IP</strong></div>
            </div>
            <button type="button" class="channel-config-help" onclick="toggleFeishuGuide()">
              <span class="material-icons">help_outline</span>
              查看配置指南
            </button>
          </div>

          <!-- 支持能力 -->
          <div class="channel-capabilities" style="margin: 12px 0; padding: 12px; background: rgba(59, 130, 246, 0.05); border-radius: 8px; border: 1px solid rgba(59, 130, 246, 0.1);">
            <div style="font-weight: 600; margin-bottom: 8px; color: var(--text-primary); font-size: 13px;">✨ 支持能力</div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px;">
              <span style="background: rgba(34, 197, 94, 0.1); color: #16a34a; padding: 4px 8px; border-radius: 4px;">✅ 私聊消息</span>
              <span style="background: rgba(34, 197, 94, 0.1); color: #16a34a; padding: 4px 8px; border-radius: 4px;">✅ 群聊 @机器人</span>
              <span style="background: rgba(34, 197, 94, 0.1); color: #16a34a; padding: 4px 8px; border-radius: 4px;">✅ 图片/文件收发</span>
              <span style="background: rgba(34, 197, 94, 0.1); color: #16a34a; padding: 4px 8px; border-radius: 4px;">✅ Markdown 卡片</span>
              <span style="background: rgba(34, 197, 94, 0.1); color: #16a34a; padding: 4px 8px; border-radius: 4px;">✅ 无需公网 IP</span>
              <span style="background: rgba(59, 130, 246, 0.1); color: #2563eb; padding: 4px 8px; border-radius: 4px;">📄 文档读写</span>
              <span style="background: rgba(59, 130, 246, 0.1); color: #2563eb; padding: 4px 8px; border-radius: 4px;">📚 知识库访问</span>
              <span style="background: rgba(59, 130, 246, 0.1); color: #2563eb; padding: 4px 8px; border-radius: 4px;">📊 多维表格</span>
            </div>
          </div>

          <!-- 飞书配置指南 -->
          <div id="feishuGuide" class="channel-guide hidden">
            <div class="guide-header">
              <span class="material-icons">menu_book</span>
              <span>飞书 WebSocket 长连接配置指南（详细版）</span>
              <button type="button" class="guide-close-btn" onclick="toggleFeishuGuide()">
                <span class="material-icons">close</span>
                收起
              </button>
            </div>

            <!-- 前置条件 -->
            <div class="guide-prereq">
              <div class="guide-prereq-title">📋 前置条件</div>
              <ul class="guide-prereq-list">
                <li>✅ 拥有<strong>飞书企业管理员</strong>或<strong>应用管理员权限</strong></li>
                <li>✅ 企业已开通<strong>飞书开放平台</strong>功能</li>
                <li>✅ 电脑已登录飞书账号（用于扫码登录开放平台）</li>
              </ul>
            </div>

            <div class="guide-content">
              <div class="guide-step">
                <div class="guide-step-number">1</div>
                <div class="guide-step-content">
                  <div class="guide-step-title"><strong>登录飞书开放平台</strong></div>
                  <div class="guide-step-desc">
                    <ol class="guide-substeps">
                      <li>打开浏览器，访问 <a href="https://open.feishu.cn/app" target="_blank"><strong>open.feishu.cn/app</strong></a></li>
                      <li>看到页面后，点击<strong>右上角</strong>的「<strong>登录</strong>」按钮</li>
                      <li>页面会显示二维码，打开手机<strong>飞书 App</strong>，点击右上角「<strong>+</strong>」→「<strong>扫一扫</strong>」扫码登录</li>
                      <li>登录成功后，会进入「<strong>开发者后台</strong>」首页，显示你的应用列表</li>
                    </ol>
                    <span class="guide-tip">💡 提示：如果提示"无权限访问"，说明你不是企业管理员，需要联系管理员给你开通开发者权限</span>
                  </div>
                </div>
              </div>

              <div class="guide-step">
                <div class="guide-step-number">2</div>
                <div class="guide-step-content">
                  <div class="guide-step-title"><strong>创建企业自建应用</strong></div>
                  <div class="guide-step-desc">
                    <ol class="guide-substeps">
                      <li>在开发者后台首页，你会看到一个蓝色的「<strong>创建企业自建应用</strong>」按钮，点击它</li>
                      <li>弹出创建应用的表单，填写：
                        <div class="guide-field-desc">
                          <div class="guide-field-row"><span class="guide-field-name">应用名称：</span>给机器人起个名字，比如 "AI 助手" 或 "小飞"</div>
                          <div class="guide-field-row"><span class="guide-field-name">应用描述：</span>简单写一下用途，比如 "智能问答机器人"</div>
                          <div class="guide-field-row"><span class="guide-field-name">应用图标：</span>可以上传一个图片作为机器人头像（可跳过）</div>
                        </div>
                      </li>
                      <li>填写完成后，点击「<strong>创建</strong>」按钮</li>
                      <li>创建成功！会自动跳转到应用详情页</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div class="guide-step">
                <div class="guide-step-number">3</div>
                <div class="guide-step-content">
                  <div class="guide-step-title"><strong>添加「机器人」能力</strong></div>
                  <div class="guide-step-desc">
                    <ol class="guide-substeps">
                      <li>现在你在应用详情页，看<strong>页面左侧的菜单栏</strong></li>
                      <li>找到「<strong>添加应用能力</strong>」这一项并点击</li>
                      <li>右侧会显示很多能力卡片，比如"网页"、"小程序"、"机器人"等</li>
                      <li>找到「<strong>机器人</strong>」这个卡片（有个机器人图标），点击它上面的「<strong>+ 添加</strong>」按钮</li>
                      <li>添加成功后，你会看到左侧菜单多了一个「<strong>机器人</strong>」选项</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div class="guide-step">
                <div class="guide-step-number">4</div>
                <div class="guide-step-content">
                  <div class="guide-step-title"><strong>获取 App ID 和 App Secret（重要！请复制保存）</strong></div>
                  <div class="guide-step-desc">
                    <ol class="guide-substeps">
                      <li>看<strong>左侧菜单</strong>，找到「<strong>凭证与基础信息</strong>」并点击</li>
                      <li>在右侧页面中，你会看到应用的基本信息</li>
                      <li>找到这两个重要的值：
                        <div class="guide-field-desc">
                          <div class="guide-field-row">
                            <span class="guide-field-name">App ID：</span>
                            一串字母数字，形如 <code>cli_a1b2c3d4e5f6</code>（以 cli_ 开头），点击右边的<strong>复制图标</strong>复制它
                          </div>
                          <div class="guide-field-row">
                            <span class="guide-field-name">App Secret：</span>
                            默认显示为 ****，点击「<strong>显示</strong>」按钮后会显示完整内容，<strong>立即复制</strong>！
                          </div>
                        </div>
                      </li>
                      <li>把复制的 <strong>App ID</strong> 和 <strong>App Secret</strong> 粘贴到下方的输入框中</li>
                    </ol>
                    <span class="guide-tip">🔐 <strong>重要</strong>：App Secret 请妥善保管，不要告诉别人或发到群里！</span>
                  </div>
                </div>
              </div>

              <div class="guide-step">
                <div class="guide-step-number">5</div>
                <div class="guide-step-content">
                  <div class="guide-step-title"><strong>获取 Encrypt Key 和 Verification Token</strong></div>
                  <div class="guide-step-desc">
                    <ol class="guide-substeps">
                      <li>看<strong>左侧菜单</strong>，找到「<strong>开发配置</strong>」这个分组</li>
                      <li>点击展开后，找到「<strong>事件与回调</strong>」并点击</li>
                      <li>找到「<strong>加密策略</strong>」，点击进入</li>
                      <li>就能看到 <strong>Encrypt Key</strong> 和 <strong>Verification Token</strong></li>
                      <li>点击右边的<strong>小眼睛图标</strong>，就能显示出来了</li>
                      <li>把这两个密钥<strong>复制粘贴</strong>到下方配置输入框中</li>
                    </ol>
                    <span class="guide-tip">💡 <strong>注意</strong>：第一次创建的应用，Encrypt Key 可能为空，需要点击<strong>「刷新」按钮</strong>生成。WebSocket 模式下这两个配置<strong>通常可以不填</strong>，但填了更安全。</span>
                  </div>
                </div>
              </div>

              <div class="guide-step">
                <div class="guide-step-number">6</div>
                <div class="guide-step-content">
                  <div class="guide-step-title"><strong>配置事件订阅 - 启用长连接（最关键的一步！）</strong></div>
                  <div class="guide-step-desc">
                    <ol class="guide-substeps">
                      <li>还是在「<strong>事件与回调</strong>」页面</li>
                      <li>在右侧页面中，找到「<strong>事件配置方式</strong>」这一栏</li>
                      <li>你会看到有两个选项：
                        <ul>
                          <li>「将事件发送至开发者服务器」- <strong style="color: #ef4444;">不要选这个！</strong></li>
                          <li>「<strong>使用长连接接收事件</strong>」- <strong style="color: #22c55e; font-size: 1.1em; background: rgba(34,197,94,0.1); padding: 4px 8px; border-radius: 4px;">⭐ 选这个！</strong></li>
                        </ul>
                      </li>
                      <li>选好后，点击「<strong>保存</strong>」按钮</li>
                    </ol>
                    <span class="guide-tip">💡 <strong>为什么一定要选长连接模式？</strong><br>
                    选了长连接模式后：<br>
                    ✅ 不需要买服务器<br>
                    ✅ 不需要有公网 IP<br>
                    ✅ 不需要配置域名和 HTTPS<br>
                    ✅ 在自己电脑上运行 OpenClawCN 就能收到消息<br><br>
                    如果选了"发送至开发者服务器"，你需要有一台能被外网访问的服务器，配置起来很麻烦！</span>
                  </div>
                </div>
              </div>

              <div class="guide-step">
                <div class="guide-step-number">7</div>
                <div class="guide-step-content">
                  <div class="guide-step-title"><strong>添加「接收消息」事件（必须做，否则收不到消息！）</strong></div>
                  <div class="guide-step-desc">
                    <ol class="guide-substeps">
                      <li>还是在「<strong>事件与回调</strong>」这个页面</li>
                      <li>往下滚动，找到「<strong>添加事件</strong>」按钮（蓝色的），点击它</li>
                      <li>会弹出一个事件选择窗口</li>
                      <li>在<strong>搜索框</strong>中输入：<code>接收消息</code></li>
                      <li>在搜索结果中找到「<strong>接收消息 im.message.receive_v1</strong>」这一项</li>
                      <li>点击它<strong>右边的复选框</strong>打勾</li>
                      <li>点击窗口底部的「<strong>确认添加</strong>」按钮</li>
                      <li>回到事件列表，确认已经添加成功</li>
                    </ol>
                    <span class="guide-tip">⚠️ <strong>非常重要</strong>：如果不添加这个事件，机器人就收不到任何消息！这是最常被忘记的一步！</span>
                  </div>
                </div>
              </div>

              <div class="guide-step">
                <div class="guide-step-number">8</div>
                <div class="guide-step-content">
                  <div class="guide-step-title"><strong>添加权限（必须做，否则发不出消息！）</strong></div>
                  <div class="guide-step-desc">
                    <ol class="guide-substeps">
                      <li>点击<strong>左侧菜单</strong>的「<strong>权限管理</strong>」</li>
                      <li>在右侧页面<strong>顶部</strong>，有一个搜索框</li>
                      <li>需要添加这几个权限（一个一个来）：
                        <div class="guide-permission-list">
                          <div class="guide-permission-item">
                            <strong>第1个（必须）：</strong>搜索 <code>im:message</code>，找到「<strong>获取与发送单聊、群组消息</strong>」，点击「<strong>开通权限</strong>」
                          </div>
                          <div class="guide-permission-item">
                            <strong>第2个（必须）：</strong>搜索 <code>im:message:send_as_bot</code>，找到「<strong>以应用的身份发消息</strong>」，点击「<strong>开通权限</strong>」
                          </div>
                          <div class="guide-permission-item">
                            <strong>第3个（群聊必须）：</strong>搜索 <code>im:message.group_at_msg</code>，找到「<strong>接收群聊中@机器人消息事件</strong>」，点击「<strong>开通权限</strong>」
                          </div>
                          <div class="guide-permission-item">
                            <strong>第4个（推荐）：</strong>搜索 <code>im:resource</code>，找到「<strong>获取与上传图片或文件资源</strong>」，点击「<strong>开通权限</strong>」
                          </div>
                        </div>
                      </li>
                    </ol>
                    <span class="guide-tip">⚠️ 前两个权限是<strong>必须的</strong>！没有这些权限，机器人虽然能收到消息，但<strong>回复不了</strong>！</span>
                  </div>
                </div>
              </div>

              <div class="guide-step">
                <div class="guide-step-number">9</div>
                <div class="guide-step-content">
                  <div class="guide-step-title"><strong>发布应用，让员工能用上</strong></div>
                  <div class="guide-step-desc">
                    <ol class="guide-substeps">
                      <li>点击<strong>左侧菜单</strong>的「<strong>版本管理与发布</strong>」</li>
                      <li>在右侧页面，点击「<strong>创建版本</strong>」按钮</li>
                      <li>填写版本信息：
                        <div class="guide-field-desc">
                          <div class="guide-field-row"><span class="guide-field-name">版本号：</span>填 <code>1.0.0</code> 就行</div>
                          <div class="guide-field-row"><span class="guide-field-name">更新说明：</span>填"首次发布"或者随便写点</div>
                          <div class="guide-field-row"><span class="guide-field-name">可用性状态：</span>选择「<strong>所有员工可用</strong>」或者选择特定部门</div>
                        </div>
                      </li>
                      <li>点击「<strong>保存</strong>」</li>
                      <li>然后点击「<strong>申请发布</strong>」按钮</li>
                      <li>如果你是管理员，可以直接<strong>审批通过</strong>；否则等管理员审批</li>
                    </ol>
                    <span class="guide-tip">✅ <strong>发布成功！</strong>现在员工打开飞书，在搜索框搜索你的机器人名字，就能找到并开始聊天了！</span>
                  </div>
                </div>
              </div>

            </div>

            <!-- 常见问题 -->
            <div class="guide-faq">
              <div class="guide-faq-title">❓ 常见问题</div>
              <div class="guide-faq-item">
                <div class="guide-faq-q">Q: 找不到「添加应用能力」在哪？</div>
                <div class="guide-faq-a">A: 在应用详情页的<strong>左侧菜单栏</strong>，可能需要往下滚动才能看到。如果还是找不到，可能是飞书改版了，试试在菜单里找"应用能力"或"机器人"相关的选项。</div>
              </div>
              <div class="guide-faq-item">
                <div class="guide-faq-q">Q: 提示"App ID 不存在"？</div>
                <div class="guide-faq-a">A: 检查 App ID 是否复制完整，应该以 <code>cli_</code> 开头。确认没有多复制空格。</div>
              </div>
              <div class="guide-faq-item">
                <div class="guide-faq-q">Q: 机器人能收到消息，但不回复？</div>
                <div class="guide-faq-a">A: 90% 是因为<strong>权限没开</strong>！回到第 8 步，确认 <code>im:message</code> 和 <code>im:message:send_as_bot</code> 这两个权限都已开通。</div>
              </div>
              <div class="guide-faq-item">
                <div class="guide-faq-q">Q: 群聊@机器人没反应？</div>
                <div class="guide-faq-a">A: 1) 检查是否开通了 <code>im:message.group_at_msg</code> 权限（第 8 步）<br>2) 确认机器人已被邀请进群（在群设置里添加机器人）</div>
              </div>
              <div class="guide-faq-item">
                <div class="guide-faq-q">Q: 完全收不到消息？</div>
                <div class="guide-faq-a">A: 检查：1) 是否添加了 <code>im.message.receive_v1</code> 事件（第 7 步）2) 是否选择了"长连接"模式（第 6 步）3) 应用是否已发布（第 9 步）</div>
              </div>
              <div class="guide-faq-item">
                <div class="guide-faq-q">Q: Encrypt Key 是空的？</div>
                <div class="guide-faq-a">A: 第一次创建的应用，需要在「加密策略」页面点击<strong>「刷新」按钮</strong>生成 Encrypt Key。</div>
              </div>
            </div>

            <div class="guide-footer">
              <a href="https://open.feishu.cn/document/home/develop-a-bot-in-5-minutes/create-an-app" target="_blank" class="guide-link">
                <span class="material-icons">open_in_new</span>
                查看飞书官方文档
              </a>
              <a href="https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/create" target="_blank" class="guide-link">
                <span class="material-icons">open_in_new</span>
                消息 API 文档
              </a>
            </div>
          </div>

          <div class="channel-config-fields">
            <div class="form-group">
              <label class="form-label">App ID <span class="required">*</span></label>
              <input type="text" class="form-input mono" id="feishuAppId" placeholder="例如：cli_xxxxxxxx">
              <div class="form-help">在「凭证与基础信息」中获取</div>
            </div>
            <div class="form-group">
              <label class="form-label">App Secret <span class="required">*</span></label>
              <div class="password-input-wrapper">
                <input type="password" class="form-input mono" id="feishuAppSecret" placeholder="请输入 App Secret">
                <button type="button" class="password-toggle" onclick="toggleFeishuSecretVisibility()">
                  <span class="material-icons" id="feishuSecretIcon">visibility</span>
                </button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Encrypt Key（可选）</label>
              <input type="text" class="form-input mono" id="feishuEncryptKey" placeholder="事件订阅的加密密钥">
              <div class="form-help">在「事件订阅」页面的 Encrypt Key，用于消息加密</div>
            </div>
            <div class="form-group">
              <label class="form-label">Verification Token（可选）</label>
              <input type="text" class="form-input mono" id="feishuVerificationToken" placeholder="事件订阅的验证 Token">
              <div class="form-help">WebSocket 模式下通常不需要</div>
            </div>
          </div>

          <div id="feishuConfigStatus" class="status-message"></div>
        </div>

        <!-- 企业微信配置表单 -->
        <div id="wecomConfigForm" class="channel-config-form hidden">
          <div class="channel-config-header">
            <span class="channel-config-icon">💼</span>
            <div>
              <div class="channel-config-title">企业微信机器人配置</div>
              <div class="channel-config-subtitle">创建自建应用，通过回调接收消息</div>
            </div>
            <button type="button" class="channel-config-help" onclick="toggleWecomGuide()">
              <span class="material-icons">help_outline</span>
              查看配置指南
            </button>
          </div>

          <!-- 企业微信配置指南 -->
          <div id="wecomGuide" class="channel-guide hidden">
            <div class="guide-header">
              <span class="material-icons">menu_book</span>
              <span>企业微信自建应用配置指南（详细版）</span>
              <button type="button" class="guide-close-btn" onclick="toggleWecomGuide()">
                <span class="material-icons">close</span>
                收起
              </button>
            </div>

            <!-- 前置条件 -->
            <div class="guide-prereq">
              <div class="guide-prereq-title">📋 前置条件</div>
              <ul class="guide-prereq-list">
                <li>✅ 拥有<strong>企业微信管理员权限</strong></li>
                <li>✅ 企业已完成<strong>企业微信认证</strong>（否则功能受限）</li>
                <li>⚠️ <strong>需要公网可访问的服务器</strong>或<strong>内网穿透工具</strong>（如 ngrok、frp）</li>
                <li>⚠️ 回调地址<strong>必须是 HTTPS</strong>协议</li>
              </ul>
              <div class="guide-tip" style="margin-top: 12px;">
                ⚠️ <strong>重要提示</strong>：企业微信与钉钉/飞书不同，<strong>必须配置公网回调地址</strong>才能接收消息。<br>
                如果没有公网服务器，推荐使用 <a href="https://ngrok.com" target="_blank">ngrok</a> 或 <a href="https://github.com/fatedier/frp" target="_blank">frp</a> 进行内网穿透。
              </div>
            </div>

            <div class="guide-content">
              <div class="guide-step">
                <div class="guide-step-number">1</div>
                <div class="guide-step-content">
                  <div class="guide-step-title"><strong>登录企业微信管理后台</strong></div>
                  <div class="guide-step-desc">
                    <ol class="guide-substeps">
                      <li>打开浏览器，访问 <a href="https://work.weixin.qq.com/wework_admin/frame" target="_blank"><strong>work.weixin.qq.com</strong></a></li>
                      <li>看到页面后，用<strong>微信 App</strong> 扫描页面上的二维码</li>
                      <li>在手机上确认登录，会自动进入「<strong>企业微信管理后台</strong>」</li>
                    </ol>
                    <span class="guide-tip">⚠️ 注意：必须是<strong>企业管理员</strong>才能登录管理后台。如果你不是管理员，扫码后会提示无权限</span>
                  </div>
                </div>
              </div>

              <div class="guide-step">
                <div class="guide-step-number">2</div>
                <div class="guide-step-content">
                  <div class="guide-step-title"><strong>获取企业 ID (CorpID)</strong></div>
                  <div class="guide-step-desc">
                    <ol class="guide-substeps">
                      <li>登录后，看<strong>页面顶部的导航栏</strong></li>
                      <li>点击「<strong>我的企业</strong>」这个 Tab</li>
                      <li>进入页面后，<strong>一直往下滚动到页面最底部</strong></li>
                      <li>在最底部会看到「<strong>企业ID</strong>」这一项</li>
                      <li>点击企业 ID 右边的<strong>复制图标</strong>复制它</li>
                      <li>把复制的企业 ID 粘贴到下方的「<strong>企业 ID (CorpID)</strong>」输入框</li>
                    </ol>
                    <div class="guide-example">
                      <strong>企业 ID 格式</strong>：以 <code>ww</code> 开头，共 18 个字符，如 <code>ww1234567890abcdef</code>
                    </div>
                    <span class="guide-tip">💡 企业 ID 是固定的，一个企业只有一个，所有应用共用</span>
                  </div>
                </div>
              </div>

              <div class="guide-step">
                <div class="guide-step-number">3</div>
                <div class="guide-step-content">
                  <div class="guide-step-title"><strong>创建自建应用</strong></div>
                  <div class="guide-step-desc">
                    <ol class="guide-substeps">
                      <li>看<strong>页面顶部的导航栏</strong>，点击「<strong>应用管理</strong>」这个 Tab</li>
                      <li>进入应用管理页面后，你会看到页面分成几个区域</li>
                      <li>找到「<strong>自建</strong>」这个区域（在页面下方）</li>
                      <li>点击「<strong>创建应用</strong>」按钮</li>
                      <li>弹出创建表单，填写：
                        <div class="guide-field-desc">
                          <div class="guide-field-row"><span class="guide-field-name">应用 logo：</span>上传一个图片作为机器人头像</div>
                          <div class="guide-field-row"><span class="guide-field-name">应用名称：</span>给机器人起个名字，比如 "AI 助手"</div>
                          <div class="guide-field-row"><span class="guide-field-name">应用介绍：</span>简单写一下功能</div>
                          <div class="guide-field-row"><span class="guide-field-name">可见范围：</span>选择哪些部门或成员可以使用这个应用</div>
                        </div>
                      </li>
                      <li>填好后点击「<strong>创建应用</strong>」按钮</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div class="guide-step">
                <div class="guide-step-number">4</div>
                <div class="guide-step-content">
                  <div class="guide-step-title"><strong>获取 AgentId 和 Secret（重要！请复制保存）</strong></div>
                  <div class="guide-step-desc">
                    <ol class="guide-substeps">
                      <li>创建成功后，会<strong>自动跳转到应用详情页</strong></li>
                      <li>在页面<strong>上方</strong>，你会看到应用基本信息</li>
                      <li>找到这两个重要的值：
                        <div class="guide-field-desc">
                          <div class="guide-field-row">
                            <span class="guide-field-name">AgentId：</span>
                            一个<strong>纯数字</strong>，形如 <code>1000002</code>，直接复制它填到下方「<strong>应用 ID</strong>」输入框
                          </div>
                          <div class="guide-field-row">
                            <span class="guide-field-name">Secret：</span>
                            默认是隐藏的，点击「<strong>查看</strong>」按钮，会弹出二维码让你扫码验证。用<strong>企业微信 App</strong> 扫码确认后，Secret 会显示出来，<strong>立即复制</strong>！
                          </div>
                        </div>
                      </li>
                      <li>把 AgentId 和 Secret 分别填到下方的输入框中</li>
                    </ol>
                    <span class="guide-tip">🔐 <strong>非常重要</strong>：Secret 只显示一次！关闭页面后就看不到了。如果忘记了，只能点「重置」生成新的（旧的就失效了）</span>
                  </div>
                </div>
              </div>

              <div class="guide-step">
                <div class="guide-step-number">5</div>
                <div class="guide-step-content">
                  <div class="guide-step-title"><strong>配置接收消息（最关键的一步！）</strong></div>
                  <div class="guide-step-desc">
                    <ol class="guide-substeps">
                      <li>还是在应用详情页，<strong>往下滚动</strong></li>
                      <li>找到「<strong>接收消息</strong>」这个区域</li>
                      <li>点击「<strong>设置API接收</strong>」按钮</li>
                      <li>会跳转到配置页面，需要填 3 个东西：
                        <div class="guide-field-desc">
                          <div class="guide-field-row">
                            <span class="guide-field-name">URL（回调地址）：</span>
                            填写能接收消息的地址。<strong style="color: #ef4444;">必须是 HTTPS 开头！</strong><br>
                            格式：<code>https://你的域名/api/wecom/callback</code>
                          </div>
                          <div class="guide-field-row">
                            <span class="guide-field-name">Token：</span>
                            点击输入框右边的「<strong>随机获取</strong>」按钮自动生成一串字符，然后<strong>复制它</strong>填到下方配置
                          </div>
                          <div class="guide-field-row">
                            <span class="guide-field-name">EncodingAESKey：</span>
                            同样点击「<strong>随机获取</strong>」自动生成（43个字符），<strong>复制它</strong>填到下方配置
                          </div>
                        </div>
                      </li>
                    </ol>
                    <span class="guide-tip">⚠️ <strong>重要</strong>：先<strong>不要点保存</strong>！因为保存时企业微信会立即验证你的回调地址，如果 OpenClawCN 还没启动，验证会失败。<br>
                    请先把 Token 和 EncodingAESKey 复制填到下方，启动 OpenClawCN 后再回来点保存</span>
                  </div>
                </div>
              </div>

              <div class="guide-step">
                <div class="guide-step-number">6</div>
                <div class="guide-step-content">
                  <div class="guide-step-title"><strong>填写下方配置并启动 OpenClawCN</strong></div>
                  <div class="guide-step-desc">
                    <ol class="guide-substeps">
                      <li>把刚才复制的 <strong>Token</strong> 粘贴到下方「<strong>回调 Token</strong>」输入框</li>
                      <li>把刚才复制的 <strong>EncodingAESKey</strong> 粘贴到下方「<strong>回调 EncodingAESKey</strong>」输入框</li>
                      <li>确保 <strong>企业 ID</strong>、<strong>AgentId</strong>、<strong>Secret</strong> 都已填好</li>
                      <li>点击「<strong>下一步</strong>」完成配置向导</li>
                      <li>确保 OpenClawCN Gateway 已经启动</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div class="guide-step">
                <div class="guide-step-number">7</div>
                <div class="guide-step-content">
                  <div class="guide-step-title"><strong>回到企业微信验证回调</strong></div>
                  <div class="guide-step-desc">
                    <ol class="guide-substeps">
                      <li>OpenClawCN 启动后，回到企业微信后台的「设置API接收」页面</li>
                      <li>确认 URL、Token、EncodingAESKey 都已正确填写</li>
                      <li>点击「<strong>保存</strong>」按钮</li>
                      <li>企业微信会自动发一个验证请求到你的回调地址</li>
                      <li>如果一切正确，会提示「<strong style="color: #22c55e;">配置成功</strong>」</li>
                    </ol>
                    <span class="guide-tip">✅ 验证成功！现在员工就可以在企业微信中找到这个应用并开始聊天了！</span>
                  </div>
                </div>
              </div>

              <div class="guide-step">
                <div class="guide-step-number">8</div>
                <div class="guide-step-content">
                  <div class="guide-step-title"><strong>测试机器人</strong></div>
                  <div class="guide-step-desc">
                    <ol class="guide-substeps">
                      <li>打开企业微信 App</li>
                      <li>在「工作台」中找到刚创建的应用</li>
                      <li>点击进入应用，发送一条消息</li>
                      <li>等待 AI 助手回复</li>
                    </ol>
                    <span class="guide-tip">🎉 如果收到回复，说明配置成功！</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 内网穿透说明 -->
            <div class="guide-tunnel-info">
              <div class="guide-tunnel-title">🔗 没有公网服务器？使用内网穿透</div>
              <div class="guide-tunnel-content">
                <p>如果您没有公网服务器，可以使用内网穿透工具将本地服务暴露到公网：</p>
                <div class="guide-tunnel-options">
                  <div class="guide-tunnel-option">
                    <strong>ngrok（推荐新手）</strong>
                    <ol>
                      <li>访问 <a href="https://ngrok.com" target="_blank">ngrok.com</a> 注册账号</li>
                      <li>下载 ngrok 客户端</li>
                      <li>运行 <code>ngrok http 18789</code></li>
                      <li>复制生成的 HTTPS 地址作为回调 URL</li>
                    </ol>
                  </div>
                  <div class="guide-tunnel-option">
                    <strong>frp（更稳定）</strong>
                    <ol>
                      <li>需要一台有公网 IP 的服务器</li>
                      <li>部署 frps 服务端</li>
                      <li>本地运行 frpc 客户端</li>
                      <li>配置域名解析到服务器</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>

            <!-- 常见问题 -->
            <div class="guide-faq">
              <div class="guide-faq-title">❓ 常见问题</div>
              <div class="guide-faq-item">
                <div class="guide-faq-q">Q: 提示"企业 ID (CorpID) 无效"？</div>
                <div class="guide-faq-a">A: 检查企业 ID 是否复制完整，应以 ww 开头，共 18 位字符。</div>
              </div>
              <div class="guide-faq-item">
                <div class="guide-faq-q">Q: 提示"应用 Secret 不正确"？</div>
                <div class="guide-faq-a">A: Secret 可能已过期。进入应用详情页，点击 Secret 旁的「重置」重新获取。</div>
              </div>
              <div class="guide-faq-item">
                <div class="guide-faq-q">Q: 回调地址验证失败？</div>
                <div class="guide-faq-a">A: 检查：1) URL 是否可公网访问 2) 是否使用 HTTPS 3) Gateway 是否已启动 4) Token 和 EncodingAESKey 是否正确</div>
              </div>
              <div class="guide-faq-item">
                <div class="guide-faq-q">Q: 机器人不回复消息？</div>
                <div class="guide-faq-a">A: 检查：1) 回调地址是否验证通过 2) 应用可见范围是否包含当前用户 3) 查看 Gateway 日志是否收到消息</div>
              </div>
              <div class="guide-faq-item">
                <div class="guide-faq-q">Q: ngrok 免费版地址会变怎么办？</div>
                <div class="guide-faq-a">A: 每次 ngrok 重启后地址会变，需要重新配置回调 URL。建议升级付费版或使用 frp 自建。</div>
              </div>
            </div>

            <div class="guide-footer">
              <a href="https://developer.work.weixin.qq.com/document/path/90930" target="_blank" class="guide-link">
                <span class="material-icons">open_in_new</span>
                回调配置文档
              </a>
              <a href="https://developer.work.weixin.qq.com/document/path/90236" target="_blank" class="guide-link">
                <span class="material-icons">open_in_new</span>
                消息类型说明
              </a>
              <a href="https://developer.work.weixin.qq.com/document/path/90313" target="_blank" class="guide-link">
                <span class="material-icons">open_in_new</span>
                错误码大全
              </a>
            </div>
          </div>

          <div class="channel-config-fields">
            <div class="form-group">
              <label class="form-label">企业 ID (CorpID) <span class="required">*</span></label>
              <input type="text" class="form-input mono" id="wecomCorpId" placeholder="例如：ww1234567890abcdef">
              <div class="form-help">在「我的企业」→「企业信息」底部获取</div>
            </div>
            <div class="form-group">
              <label class="form-label">应用 ID (AgentId) <span class="required">*</span></label>
              <input type="number" class="form-input mono" id="wecomAgentId" placeholder="例如：1000002">
              <div class="form-help">在应用详情页顶部获取</div>
            </div>
            <div class="form-group">
              <label class="form-label">应用 Secret (AgentSecret) <span class="required">*</span></label>
              <div class="password-input-wrapper">
                <input type="password" class="form-input mono" id="wecomAgentSecret" placeholder="请输入应用 Secret">
                <button type="button" class="password-toggle" onclick="toggleWecomSecretVisibility()">
                  <span class="material-icons" id="wecomSecretIcon">visibility</span>
                </button>
              </div>
              <div class="form-help">在应用详情页点击查看 Secret 获取</div>
            </div>
            <div class="form-group">
              <label class="form-label">回调 Token <span class="required">*</span></label>
              <input type="text" class="form-input mono" id="wecomToken" placeholder="与企业微信后台配置的 Token 一致">
              <div class="form-help">在「接收消息」→「设置API接收」中配置的 Token</div>
            </div>
            <div class="form-group">
              <label class="form-label">回调 EncodingAESKey <span class="required">*</span></label>
              <input type="text" class="form-input mono" id="wecomEncodingAESKey" placeholder="43位字符，与企业微信后台配置一致">
              <div class="form-help">在「接收消息」→「设置API接收」中配置的 EncodingAESKey</div>
            </div>
          </div>

          <div id="wecomConfigStatus" class="status-message"></div>
        </div>
      </div>

      <div class="btn-group" style="margin-top: 24px;">
        <button class="btn btn-secondary" onclick="prevStep(3)">
          <span class="material-icons">arrow_back</span>
          上一步
        </button>
        <button class="btn btn-primary btn-lg" onclick="handleStep3Next()" id="step3NextBtn">
          下一步
          <span class="material-icons">arrow_forward</span>
        </button>
      </div>
    </div>

    <!-- Step 4: 服务激活 -->
    <div id="page4" class="card hidden">
      <div class="card-header">
        <h2>第四步：激活增值服务</h2>
        <p>解锁完整体验，让 AI 助手更强大</p>
      </div>

      <div id="licenseFormSection">
        <!-- 为什么选择 ClawbotCN -->
        <div class="why-choose-section">
          <div class="why-choose-header">
            <span class="why-choose-icon">🚀</span>
            <span class="why-choose-title">为什么选择 OpenClawCN？</span>
          </div>
          <div class="why-choose-grid">
            <div class="why-choose-item">
              <span class="why-item-icon">⚡</span>
              <span class="why-item-text"><strong>10分钟极速上手</strong>，告别3小时繁琐配置</span>
            </div>
            <div class="why-choose-item">
              <span class="why-item-icon">🎯</span>
              <span class="why-item-text"><strong>国产 Skills 持续赋能</strong>，本地化技能开箱即用</span>
            </div>
            <div class="why-choose-item">
              <span class="why-item-icon">🌐</span>
              <span class="why-item-text"><strong>国内国际大模型任选</strong>，硅基流动/通义/豆包/OpenAI...</span>
            </div>
            <div class="why-choose-item">
              <span class="why-item-icon">✨</span>
              <span class="why-item-text"><strong>比原版更优质的交互</strong>，中文深度优化</span>
            </div>
          </div>
        </div>

        <!-- 两栏布局：左侧会员服务 + 右侧技术支持二维码 -->
        <div class="step4-main-grid">
          <!-- 左侧：增值服务卡片 -->
          <div class="premium-service-card">
            <div class="premium-badge">🎁 增值服务</div>
            <div class="premium-content">
              <div class="premium-title">${isOverseas ? "会员服务" : "OpenClawCN 会员服务"}</div>
              <div class="premium-subtitle">软件免费使用，增值服务助你更高效</div>
              <div class="premium-features">
                <div class="premium-feature">📚 <strong>中文教程文档</strong> · 从入门到精通</div>
                <div class="premium-feature">🔌 <strong>国内AI平台适配</strong> · UI/Skills 深度汉化</div>
                <div class="premium-feature">🔄 <strong>持续更新维护</strong> · 新功能新玩法第一时间体验</div>
                <div class="premium-feature">💬 <strong>技术答疑支持</strong> · 遇到问题随时咨询</div>
              </div>

              <!-- 金色购买按钮 -->
              ${
                isOverseas
                  ? `<button type="button" class="premium-buy-btn" onclick="showPurchaseQrcodeModal()">
                <span class="material-icons">shopping_cart</span>
                <span class="premium-buy-text">立即获取服务凭证</span>
                <span class="premium-buy-arrow">→</span>
              </button>`
                  : `<a href="https://m.tb.cn/h.i0WWBLA?tk=yOQqUrspXvy" target="_blank" class="premium-buy-btn">
                <span class="material-icons">shopping_cart</span>
                <span class="premium-buy-text">立即获取服务凭证</span>
                <span class="premium-buy-arrow">→</span>
              </a>
              <div class="premium-buy-hint">在闲鱼搜索「OpenClawCN」或点击上方按钮</div>`
              }
            </div>
          </div>

          <!-- 右侧：技术支持二维码 -->
          <div class="wechat-support-card" id="wechatSupportCard">
            <div class="wechat-support-header">
              <span class="material-icons">support_agent</span>
              <span>免费技术支持</span>
            </div>
            <div class="wechat-support-body">
              <div class="wechat-qr-wrapper" id="wechatQrcodeImage">
                ${
                  isOverseas
                    ? oemSupportQrcodeBase64
                      ? `<img src="${oemSupportQrcodeBase64}" alt="技术支持二维码">`
                      : `<div class="qrcode-loading">暂未配置</div>`
                    : setupQrcodeBase64
                      ? `<img src="${setupQrcodeBase64}" alt="微信技术支持群二维码">`
                      : `<div class="qrcode-loading"><span class="status-spinner"></span> 加载中...</div>`
                }
              </div>
              <div class="wechat-support-title">获取免费专属技术支持及咨询</div>
              <div class="wechat-support-group" id="wechatQrcodeGroupName"></div>
              <div class="wechat-support-hint">${isOverseas ? "扫码获取技术支持" : "微信扫码加入专属技术群"}</div>
            </div>
          </div>
        </div>

        <!-- OEM 购买凭证二维码弹窗 -->
        ${
          isOverseas
            ? `
        <div id="purchaseQrcodeModal" class="oem-qrcode-modal-overlay" style="display:none;" onclick="if(event.target===this)this.style.display='none'">
          <div class="oem-qrcode-modal">
            <button class="oem-qrcode-modal-close" onclick="document.getElementById('purchaseQrcodeModal').style.display='none'">&times;</button>
            <div class="oem-qrcode-modal-title">扫码获取服务凭证</div>
            ${oemPurchaseQrcodeBase64 ? `<img src="${oemPurchaseQrcodeBase64}" alt="获取服务凭证二维码" class="oem-qrcode-modal-img">` : `<div class="oem-qrcode-modal-placeholder">暂未配置二维码</div>`}
            <div class="oem-qrcode-modal-hint">扫描上方二维码获取服务凭证</div>
          </div>
        </div>
        `
            : ""
        }

        <!-- 输入凭证 -->
        <div class="license-input-section">
          <label class="form-label">已有凭证？在这里激活</label>
          <div class="license-input-wrapper">
            <input type="text" class="form-input mono" id="licenseTokenInput" placeholder="粘贴你的服务凭证（以 clawd- 或 test- 开头）">
          </div>
          <div class="form-help" style="margin-top: 8px; color: var(--text-muted); font-size: 0.85em;">
            <span class="material-icons" style="font-size: 14px; vertical-align: middle; margin-right: 4px;">info</span>
            凭证格式：以 <code style="background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; font-family: monospace;">clawd-</code> 或 <code style="background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; font-family: monospace;">test-</code> 开头，例如 <code style="background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; font-family: monospace;">clawd-xxxx-xxxx</code>
          </div>
        </div>

        <div id="licenseStatus" class="status-message"></div>

        <div class="btn-group">
          <button class="btn btn-secondary" onclick="prevStep(4)">
            <span class="material-icons">arrow_back</span>
            上一步
          </button>
          <button class="btn btn-primary" onclick="validateLicense()" id="validateLicenseBtn">
            <span class="material-icons">verified</span>
            验证凭证
          </button>
        </div>
      </div>

      <!-- 验证成功动画 -->
      <div id="licenseSuccessSection" class="success-animation">
        <div class="success-checkmark">
          <svg viewBox="0 0 24 24">
            <path d="M5 12l5 5L19 7"/>
          </svg>
        </div>
        <div class="success-title">🎉 激活成功！</div>
        <div class="success-desc">${isOverseas ? "Activation successful! Enjoy using the app." : "激活成功，祝你使用愉快！"}</div>
        <div class="success-expires" id="licenseExpiresText"></div>
        
        <!-- 协议勾选区域（验证成功后显示） -->
        <div id="legalAgreementSection" class="legal-agreement-section" style="display: none;">
          <div class="legal-agreement-row">
            <input type="checkbox" id="legalAgreementCheckbox" onchange="onLegalAgreementChange()">
            <span class="legal-agreement-text">
              我已阅读并同意
              <a onclick="showLegalModal('userAgreement')">《用户协议》</a>
              <a onclick="showLegalModal('privacyPolicy')">《隐私政策》</a>
              <a onclick="showLegalModal('riskDisclosure')">《风险告知》</a>
            </span>
          </div>
        </div>
        
        <!-- 完成按钮组（验证成功后显示） -->
        <div id="step4CompleteBtnGroup" class="step4-complete-btn-group" style="display: none;">
          <button class="btn btn-secondary" onclick="prevStep(4)">
            <span class="material-icons">arrow_back</span>
            上一步
          </button>
          <button class="btn btn-primary" id="step4CompleteBtn" onclick="completeStep4()" disabled>
            <span class="material-icons">check_circle</span>
            完成配置
          </button>
        </div>
      </div>
    </div>
    
    <!-- 法律协议弹窗 -->
    <div id="legalModalOverlay" class="legal-modal-overlay hidden">
      <div class="legal-modal">
        <div class="legal-modal-header">
          <h3 id="legalModalTitle">协议标题</h3>
          <button class="legal-modal-close" onclick="closeLegalModal()">
            <span class="material-icons">close</span>
          </button>
        </div>
        <div class="legal-modal-body" id="legalModalBody">
          <!-- 协议内容动态填充 -->
        </div>
        <div class="legal-modal-footer">
          <button class="btn btn-primary" onclick="closeLegalModal()">我已了解</button>
        </div>
      </div>
    </div>

    <!-- Step 5: 完成 -->
    <div id="page5" class="card hidden">
      <div class="card-header" style="text-align: center;">
        <h2 style="font-size: 1.8em;">🎉 欢迎来到 ClawbotCN 世界！</h2>
        <p>感谢支持！配置已完成</p>
      </div>

      <div style="text-align: center; padding: 32px 0;">
        <div style="font-size: 4em; margin-bottom: 16px;">🎊</div>
      </div>

      <div style="font-size: 0.95em; font-weight: 500; margin-bottom: 16px;">配置摘要</div>
      <ul class="summary-list">
        <li class="summary-item">
          <div class="summary-item-icon"><span class="material-icons" style="font-size:18px;">check</span></div>
          <span class="summary-item-label">AI 服务</span>
          <span class="summary-item-value" id="summaryProvider">-</span>
        </li>
        <li class="summary-item">
          <div class="summary-item-icon"><span class="material-icons" style="font-size:18px;">check</span></div>
          <span class="summary-item-label">运行环境</span>
          <span class="summary-item-value">${platformInfo.displayName}（${platformInfo.sandboxType}）</span>
        </li>
        <li class="summary-item">
          <div class="summary-item-icon"><span class="material-icons" style="font-size:18px;">check</span></div>
          <span class="summary-item-label">安全模式</span>
          <span class="summary-item-value" id="summarySecurity">-</span>
        </li>
        <li class="summary-item hidden" id="summaryWorkspaceRow">
          <div class="summary-item-icon"><span class="material-icons" style="font-size:18px;">check</span></div>
          <span class="summary-item-label">工作目录</span>
          <span class="summary-item-value" id="summaryWorkspace">-</span>
        </li>
        <li class="summary-item hidden" id="summaryTrustedDirsRow">
          <div class="summary-item-icon"><span class="material-icons" style="font-size:18px;">check</span></div>
          <span class="summary-item-label">额外信任目录</span>
          <span class="summary-item-value" id="summaryTrustedDirs">-</span>
        </li>
        <li class="summary-item">
          <div class="summary-item-icon"><span class="material-icons" style="font-size:18px;">check</span></div>
          <span class="summary-item-label">对话方式</span>
          <span class="summary-item-value" id="summaryChannels">-</span>
        </li>
        <li class="summary-item">
          <div class="summary-item-icon"><span class="material-icons" style="font-size:18px;">check</span></div>
          <span class="summary-item-label">许可证</span>
          <span class="summary-item-value" id="summaryLicense" style="color: var(--accent-green);">已激活</span>
        </li>
      </ul>

      <div class="platform-tips">
        <div class="platform-tips-header">
          <span class="material-icons">lightbulb</span>
          后续步骤
        </div>
        <ul class="platform-tips-list">
          <li>如需使用钉钉/飞书/企业微信，可在设置中添加渠道配置</li>
          <li id="tipWorkspaceFiles" class="hidden">把需要处理的文件放到工作目录</li>
          <li>随时可以在设置中调整配置</li>
          ${isOverseas ? "" : ""}
        </ul>
      </div>

      <div class="platform-tips" id="platformSpecificTips">
        <div class="platform-tips-header">
          <span>${platformInfo.icon}</span>
          ${platformInfo.os} 特别提示
        </div>
        <ul class="platform-tips-list" id="platformTipsList">
          ${getPlatformTips(platformInfo)}
        </ul>
      </div>


      <div id="launchStatus" class="status-message" style="margin-bottom: 16px;"></div>

      <button class="launch-button" id="launchButton" onclick="launchOpenClawCN()">
        <span class="material-icons">rocket_launch</span>
        开始使用 OpenClawCN
      </button>
    </div>
  </main>

  <!-- C盘确认弹框 -->
  <div id="cDriveConfirmModal" class="cdrive-confirm-modal hidden">
    <div class="cdrive-confirm-content">
      <div class="cdrive-confirm-header">
        <div class="cdrive-confirm-icon">⚠️</div>
        <div class="cdrive-confirm-title">确认选择系统盘？</div>
      </div>
      <div class="cdrive-confirm-body">
        <p class="cdrive-confirm-message">
          您选择的目录位于 <strong>C 盘（系统盘）</strong>。
        </p>
        <div class="cdrive-confirm-danger">
          <span class="material-icons">error_outline</span>
          <div>
            <strong>重大风险警告：</strong>AI 在工作过程中会创建、修改和删除文件。如果 AI 误删系统关键文件，可能导致<strong>系统无法启动</strong>或<strong>电脑完全无法使用</strong>。强烈建议选择 D 盘或其他非系统盘。
          </div>
        </div>
      </div>
      <div class="cdrive-confirm-actions">
        <button class="btn btn-secondary" onclick="cancelCDriveSelection()">
          <span class="material-icons">arrow_back</span>
          重新选择
        </button>
        <button class="btn btn-danger" onclick="confirmCDriveSelection()">
          <span class="material-icons">warning</span>
          我了解风险，继续使用 C 盘
        </button>
      </div>
    </div>
  </div>

  <!-- 文件浏览器模态框 -->
  <div id="folderBrowserModal" class="modal-overlay hidden">
    <div class="modal">
      <div class="modal-header">
        <h3>选择文件夹</h3>
        <button class="modal-close" onclick="closeBrowser()">
          <span class="material-icons">close</span>
        </button>
      </div>
      <div class="modal-body">
        <div class="path-input-group">
          <input type="text" id="browserPathInput" placeholder="输入路径..." onkeypress="if(event.key==='Enter')navigateToPath()">
          <button class="btn btn-secondary" onclick="navigateToPath()">转到</button>
        </div>
        <div id="drivesBar" class="drives-bar" style="display:none;"></div>
        <div id="folderList" class="folder-list">
          <div class="folder-empty">加载中...</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeBrowser()">取消</button>
        <button class="btn btn-primary" onclick="confirmSelection()">选择此文件夹</button>
      </div>
    </div>
  </div>

  <!-- 专家模式确认模态框 -->
  <div id="trustModeModal" class="modal-overlay hidden">
    <div class="modal" style="max-width: 480px;">
      <div class="modal-header">
        <h3>⚠️ 确认启用专家模式？</h3>
        <button class="modal-close" onclick="closeTrustModeModal()">
          <span class="material-icons">close</span>
        </button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom: 16px; color: var(--text-secondary);">专家模式下，AI Agent 将拥有完整系统权限：</p>
        <ul style="list-style: none; padding: 0; margin-bottom: 20px;">
          <li style="display: flex; align-items: center; gap: 8px; padding: 8px 0; color: var(--text-secondary);">
            <span class="material-icons" style="color: var(--accent-orange); font-size: 18px;">warning</span>
            访问和修改系统上的任何文件
          </li>
          <li style="display: flex; align-items: center; gap: 8px; padding: 8px 0; color: var(--text-secondary);">
            <span class="material-icons" style="color: var(--accent-orange); font-size: 18px;">warning</span>
            执行任意系统命令（包括危险命令）
          </li>
          <li style="display: flex; align-items: center; gap: 8px; padding: 8px 0; color: var(--text-secondary);">
            <span class="material-icons" style="color: var(--accent-orange); font-size: 18px;">warning</span>
            AI 可能误删文件或执行破坏性操作
          </li>
        </ul>
        <div class="alert alert-warning" style="margin: 0;">
          <span class="alert-icon">💡</span>
          <div class="alert-content">建议仅在专用/测试设备上启用专家模式，且您了解 AI 的行为风险。</div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeTrustModeModal()">取消</button>
        <button class="btn btn-primary" onclick="confirmTrustMode()" style="background: var(--accent-orange);">我理解风险，启用专家模式</button>
      </div>
    </div>
  </div>

  <!-- 设备切换确认弹窗 (errorCode=1010) -->
  <div id="deviceSwitchModal" class="modal-overlay hidden">
    <div class="device-switch-modal">
      <div class="device-switch-header">
        <h3><span class="material-icons">swap_horiz</span> 确认切换设备？</h3>
      </div>
      <div class="device-switch-body">
        <p>检测到您已在「<strong id="existingDeviceName">-</strong>」上使用此密钥。</p>
        
        <div class="device-switch-info">
          <p style="margin: 0; color: var(--text-primary);">继续操作将：</p>
          <ul>
            <li>在当前设备激活此密钥</li>
            <li>「<span id="existingDeviceNameCopy">-</span>」将自动退出登录</li>
          </ul>
        </div>

        <div class="device-switch-warning">
          <span class="material-icons">schedule</span>
          <span>切换后 24 小时内无法再次切换设备</span>
        </div>
      </div>
      <div class="device-switch-footer">
        <button class="btn btn-secondary" onclick="closeDeviceSwitchModal()">取消</button>
        <button class="btn btn-warning" id="confirmSwitchBtn" onclick="confirmDeviceSwitch()">
          <span class="material-icons">check</span> 确认切换
        </button>
      </div>
    </div>
  </div>

  <!-- 设备切换冷却期弹窗 (errorCode=1011) -->
  <div id="deviceCooldownModal" class="modal-overlay hidden">
    <div class="device-switch-modal">
      <div class="device-switch-header">
        <h3><span class="material-icons">hourglass_empty</span> 无法切换设备</h3>
      </div>
      <div class="device-switch-body">
        <p>设备切换需间隔 24 小时</p>
        
        <div class="cooldown-info">
          <p style="margin: 0; color: var(--text-secondary);">距离下次可切换还有</p>
          <div class="time-remaining" id="cooldownRemaining">-</div>
          <div class="time-detail">预计可切换时间：<span id="cooldownEndsAt">-</span></div>
        </div>
      </div>
      <div class="device-switch-footer">
        <button class="btn btn-primary" onclick="closeDeviceCooldownModal()">知道了</button>
      </div>
    </div>
  </div>

  <!-- 豆包 API 获取教程弹窗 -->
  <div id="doubaoTutorialModal" class="modal-overlay hidden">
    <div class="doubao-tutorial-modal">
      <div class="doubao-tutorial-header">
        <h3><span class="material-icons">school</span> 豆包 API 申请指南</h3>
        <button class="doubao-tutorial-close" onclick="closeDoubaoTutorial()">
          <span class="material-icons">close</span>
        </button>
      </div>
      <div class="doubao-tutorial-body">
        <p style="color: var(--text-tertiary); margin-bottom: 20px;">本指南面向零基础用户，手把手教你申请豆包 API Key</p>
        
        <h2>📋 准备工作</h2>
        <table>
          <tr><th>物品</th><th>说明</th><th>必需</th></tr>
          <tr><td>手机号</td><td>用于接收验证码</td><td>✅</td></tr>
          <tr><td>身份证</td><td>个人实名认证用</td><td>✅</td></tr>
          <tr><td>邮箱</td><td>建议绑定，用于接收通知</td><td>可选</td></tr>
        </table>
        <p><strong>什么是豆包 API？</strong> 它是一套程序接口，让你的软件可以调用字节跳动的 AI 能力，包括智能对话、文生图等功能。</p>

        <h2>1️⃣ 注册火山引擎账号</h2>
        <ol>
          <li>打开浏览器，访问 <a href="https://www.volcengine.com/" target="_blank">https://www.volcengine.com/</a></li>
          <li>点击页面右上角的「<strong>免费注册</strong>」按钮</li>
          <li>选择「<strong>个人注册</strong>」（企业用户选企业注册）</li>
          <li>填写手机号、获取验证码、设置密码（8-20位，需包含字母+数字）</li>
          <li>勾选服务协议，点击「立即注册」</li>
        </ol>
        <p>💡 <em>验证码通常在 60 秒内发送，如果没收到，检查是否被拦截到垃圾短信</em></p>

        <h2>2️⃣ 实名认证</h2>
        <div class="warning-box">
          ⚠️ <strong>重要</strong>：未实名认证无法使用 API 服务
        </div>
        <ol>
          <li>登录后，点击右上角头像 → 「<strong>实名认证</strong>」</li>
          <li>或直接访问：<a href="https://console.volcengine.com/user/authentication/" target="_blank">https://console.volcengine.com/user/authentication/</a></li>
          <li>选择「<strong>个人认证</strong>」</li>
          <li>填写真实姓名、身份证号码</li>
          <li>上传身份证正反面照片</li>
          <li>进行人脸识别验证</li>
          <li>提交审核（通常几分钟到几小时）</li>
        </ol>

        <h2>3️⃣ 开通豆包服务</h2>
        <ol>
          <li>实名认证通过后，访问 <a href="https://console.volcengine.com/ark/" target="_blank">火山方舟控制台</a></li>
          <li>在左侧菜单找到「<strong>开通管理</strong>」</li>
          <li>找到需要的模型（如 <strong>doubao-seed-1-8</strong>）</li>
          <li>点击「<strong>立即开通</strong>」</li>
        </ol>
        <p>💡 <em>新用户通常有免费额度，开通时需要同意服务条款</em></p>

        <h2>4️⃣ 创建 API Key</h2>
        <ol>
          <li>点击右上角头像 → 「<strong>API Key 管理</strong>」</li>
          <li>或直接访问：<a href="https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey" target="_blank">API Key 管理页面</a></li>
          <li>点击「<strong>创建 API Key</strong>」按钮</li>
          <li>填写名称（如 my-openclawcn-key）</li>
          <li>选择有效期（建议选永久）</li>
          <li>点击「确认创建」</li>
        </ol>
        <div class="important-box">
          ❗ <strong>请务必立即复制保存 API Key！</strong><br>
          关闭页面后将无法再次查看完整 Key
        </div>

        <h2>5️⃣ 开通模型（重要！）</h2>
        <div class="warning-box">
          ⚠️ 使用前必须在「<strong>开通管理</strong>」页面开通对应模型，否则会报错 "模型未开通"
        </div>
        <ol>
          <li>访问 <a href="https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement" target="_blank">开通管理页面</a></li>
          <li>找到 <code>doubao-seed-1-8-251228</code>（推荐）或其他需要的模型</li>
          <li>点击「开通」按钮</li>
        </ol>

        <h2>❓ 常见问题</h2>
        <h3>Q: API 调用返回 "模型未开通" 错误？</h3>
        <p>访问 <a href="https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement" target="_blank">开通管理</a> 页面，确保已开通对应模型。</p>
        
        <h3>Q: API Key 无效？</h3>
        <p>检查 API Key 是否复制完整（不要有多余空格），或 Key 是否被删除/禁用。</p>
        
        <h3>Q: 实名认证失败？</h3>
        <p>确保身份证照片清晰、四角完整，人脸识别时光线充足，姓名和身份证号无误。</p>

        <h2>📚 相关链接</h2>
        <table>
          <tr><th>用途</th><th>链接</th></tr>
          <tr><td>火山引擎官网</td><td><a href="https://www.volcengine.com/" target="_blank">https://www.volcengine.com/</a></td></tr>
          <tr><td>控制台登录</td><td><a href="https://console.volcengine.com/" target="_blank">https://console.volcengine.com/</a></td></tr>
          <tr><td>火山方舟</td><td><a href="https://console.volcengine.com/ark/" target="_blank">https://console.volcengine.com/ark/</a></td></tr>
          <tr><td>API Key 管理</td><td><a href="https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey" target="_blank">API Key 管理</a></td></tr>
          <tr><td>开通管理</td><td><a href="https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement" target="_blank">开通管理</a></td></tr>
          <tr><td>API 文档</td><td><a href="https://www.volcengine.com/docs/82379" target="_blank">https://www.volcengine.com/docs/82379</a></td></tr>
        </table>
      </div>
      <div class="doubao-tutorial-footer">
        <button class="btn btn-primary" onclick="closeDoubaoTutorial()">我知道了</button>
      </div>
    </div>
  </div>

  <!-- 撒花容器 -->
  <div id="confettiContainer" class="confetti-container"></div>

`;
}

/**
 * 渲染页面 <script> 块（含 <script> 标签）
 * 包含：状态管理、步骤导航、所有交互逻辑、初始化代码
 */
export function renderScriptContent(ctx: SetupPageContext): string {
  const { providers } = ctx;
  return `
  <script>
    // ==================== 状态管理 ====================
    let currentStep = 1;
    let selectedProvider = null;
    let selectedSecurity = 'standard';
    let selectedChannels = [];
    let trustedDirs = [];
    let licenseValidated = false;
    let licenseExpires = null;
    let pendingLicenseKey = null; // 用于设备切换时临时保存 key

    const providerNames = ${JSON.stringify(Object.fromEntries(providers.map((p) => [p.id, p.name])))};
    const securityModeNames = { full: '只聊天', standard: '正常使用', trust: '完全信任' };
    const channelNames = { web: '网页对话', dingtalk: '钉钉', feishu: '飞书', wecom: '企业微信' };

    // ==================== 步骤导航（5步流程） ====================
    function goToStep(step) {
      currentStep = step;
      
      // 更新页面显示
      for (let i = 1; i <= 5; i++) {
        const page = document.getElementById('page' + i);
        if (page) page.classList.toggle('hidden', i !== step);
        
        const stepItem = document.getElementById('stepItem' + i);
        if (stepItem) {
          stepItem.classList.toggle('active', i === step);
          stepItem.classList.toggle('completed', i < step);
        }
        
        if (i < 5) {
          const connector = document.getElementById('connector' + i);
          if (connector) connector.classList.toggle('completed', i < step);
        }
      }
      
      // 更新 Step 5（完成）的完成状态
      const stepItem5 = document.getElementById('stepItem5');
      if (stepItem5 && step === 5) {
        stepItem5.classList.add('completed');
      }

      // 进入 Step 4 时加载二维码（OEM overseas 版不加载）
      if (step === 4 && !${isOverseas}) {
        loadSetupQrcode();
      }
    }

    async function nextStep(step) {
      if (step === 1) {
        const apiKey = document.getElementById('apiKeyInput').value.trim();
        if (!apiKey) {
          showStatus('apiKeyStatus', '请输入 API Key', 'error');
          return;
        }
        if (!selectedProvider) {
          showStatus('apiKeyStatus', '请选择一个 AI 平台', 'error');
          return;
        }

        // 自定义 API 需要检查模型输入
        if (selectedProvider === 'custom') {
          const modelInputValue = document.getElementById('modelSelect').value.trim();
          const customEndpoint = document.getElementById('customEndpoint').value.trim();
          if (!customEndpoint) {
            showStatus('apiKeyStatus', '请输入自定义 API 端点地址', 'error');
            return;
          }
          if (!modelInputValue) {
            showStatus('apiKeyStatus', '请输入模型名称', 'error');
            return;
          }
          selectedModel = modelInputValue;
        }

        const btn = document.getElementById('step1Next');
        btn.disabled = true;
        btn.innerHTML = '<span class="status-spinner"></span> 验证中...';

        // 先验证 API Key 是否有效
        showStatus('apiKeyStatus', '正在验证 API Key...', 'loading');
        try {
          const modelToUse = selectedModel || document.getElementById('modelSelect').value.trim();
          // 自定义 API 需要附带 endpoint 地址
          const customEndpointValue = selectedProvider === 'custom' ? (document.getElementById('customEndpoint').value.trim() || '') : '';
          const verifyPayload = { provider: selectedProvider, apiKey: apiKey, model: modelToUse };
          if (customEndpointValue) verifyPayload.endpoint = customEndpointValue;
          const verifyRes = await fetch('/api/setup/verify-apikey', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(verifyPayload)
          });
          const verifyData = await verifyRes.json();
          
          if (!verifyData.ok || !verifyData.data?.valid) {
            const errorMsg = verifyData.data?.error || verifyData.error || 'API Key 无效';
            showStatus('apiKeyStatus', '❌ 验证失败: ' + errorMsg, 'error');
            btn.disabled = false;
            btn.innerHTML = '下一步 <span class="material-icons">arrow_forward</span>';
            return;
          }

          showStatus('apiKeyStatus', '✓ API Key 验证成功，正在保存...', 'success');
          await delay(300);

          // 保存配置
          const configPayload = { provider: selectedProvider, apiKey: apiKey, model: modelToUse };
          if (customEndpointValue) configPayload.endpoint = customEndpointValue;
          const res = await fetch('/api/setup/configure-provider', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(configPayload)
          });
          const data = await res.json();
          if (!data.ok) throw new Error(data.error || '配置失败');
          showStatus('apiKeyStatus', '✓ 配置已保存', 'success');
          await delay(500);
        } catch (e) {
          if (e.message.includes('fetch')) {
            showStatus('apiKeyStatus', '✓ 配置已保存', 'success');
            await delay(500);
          } else {
            showStatus('apiKeyStatus', '保存失败: ' + e.message, 'error');
            btn.disabled = false;
            btn.innerHTML = '下一步 <span class="material-icons">arrow_forward</span>';
            return;
          }
        }
        btn.disabled = false;
        btn.innerHTML = '下一步 <span class="material-icons">arrow_forward</span>';
      }

      if (step === 2) {
        // 检查是否同意条款
        const agreeCheckbox = document.getElementById('agreeTerms');
        if (!agreeCheckbox.checked) {
          const checkboxWrapper = document.getElementById('agreementCheckbox');
          checkboxWrapper.classList.add('error');
          checkboxWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => {
            checkboxWrapper.classList.remove('error');
          }, 600);
          return;
        }
        
        // 如果选择专家模式，需要二次确认
        if (selectedSecurity === 'trust' && !window.trustModeConfirmed) {
          document.getElementById('trustModeModal').classList.remove('hidden');
          return;
        }

        // 保存工作目录配置（合并原步骤3）
        // 只有 standard 模式才需要配置工作目录和安全区
        const workspace = document.getElementById('workspaceInput').value.trim();
        const needsWorkspace = selectedSecurity === 'standard';
        
        if (needsWorkspace && !workspace) {
          alert('请选择工作目录');
          return;
        }

        try {
          // 只有 standard 模式才配置工作目录（完全信任/只聊天模式不需要）
          if (needsWorkspace && workspace) {
            const res = await fetch('/api/setup/configure-workspace', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ workspace: workspace })
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error || '配置失败');
          }
          
          await fetch('/api/setup/configure-security', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              mode: selectedSecurity, 
              // 只有 standard 模式才需要传递 trustedDirs
              trustedDirs: selectedSecurity === 'standard' ? trustedDirs : [] 
            })
          });
        } catch (e) {
          console.warn('保存设置时出错:', e);
        }
      }

      if (step === 3) {
        // 对话方式步骤（原步骤4）- 逻辑已移到 handleStep3Next
        try {
          await fetch('/api/setup/configure-channels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channels: selectedChannels })
          });
        } catch (e) {
          console.warn('保存渠道配置时出错:', e);
        }
      }

      goToStep(step + 1);
    }

    function prevStep(step) {
      // 重置各步骤的按钮状态
      resetStepButtons();
      goToStep(step - 1);
    }

    function resetStepButtons() {
      // 重置 Step 1 按钮
      const step1Btn = document.getElementById('step1Next');
      if (step1Btn) {
        step1Btn.disabled = !selectedProvider;
        step1Btn.innerHTML = '下一步 <span class="material-icons">arrow_forward</span>';
      }

      // 重置 Step 3 按钮
      const step3NextBtn = document.getElementById('step3NextBtn');
      if (step3NextBtn) {
        step3NextBtn.disabled = false;
        step3NextBtn.innerHTML = '下一步 <span class="material-icons">arrow_forward</span>';
      }

      // 重置 Step 4 按钮
      const validateLicenseBtn = document.getElementById('validateLicenseBtn');
      if (validateLicenseBtn) {
        validateLicenseBtn.disabled = false;
        validateLicenseBtn.innerHTML = '<span class="material-icons">verified</span> 验证凭证';
      }

      // 清除状态消息
      const statusMessages = document.querySelectorAll('.status-message');
      statusMessages.forEach(el => {
        el.className = 'status-message';
        el.textContent = '';
      });
    }

    // ==================== Step 1: AI 服务 ====================
    const providerModels = ${JSON.stringify(
      Object.fromEntries(
        providers.map((p) => [
          p.id,
          p.models.map((m) => ({
            id: m.id,
            name: m.name,
            description: m.description,
            recommended: m.recommended,
          })),
        ]),
      ),
    )};
    
    const defaultModels = {
      'siliconflow': 'deepseek-ai/DeepSeek-V3',
      'aliyun-bailian': 'qwen-plus',
      'deepseek': 'deepseek-chat',
      'glm': 'glm-4-flash-250414',
      'volcengine-ark': 'doubao-seed-1-8-251228',
      'tencent-hunyuan': 'hunyuan-standard',
      'minimax': 'MiniMax-M2.1',
      'moonshot': 'kimi-latest',
      'kimi-code': 'kimi-for-coding',
      'aliyun-codeplan': 'qwen3-coder-plus',
      'glm-codeplan': 'glm-4.7',
      'minimax-codeplan': 'MiniMax-M2.5',
      'openai': 'o4-mini',
      'anthropic': 'claude-sonnet-4-20250514',
      'google': 'gemini-3-flash-preview',
      'nvidia': 'nvidia/llama-3.3-nemotron-super-49b-v1',
      'openrouter': 'openrouter/auto',
      'custom': 'custom-model'
    };
    
    let selectedModel = null;

    function selectProvider(id) {
      selectedProvider = id;
      
      // 更新推荐卡片选中状态
      document.querySelectorAll('.provider-card').forEach(el => {
        el.classList.toggle('selected', el.dataset.provider === id);
        // 保持 featured 类
        if (el.dataset.provider === 'kimi-code') {
          el.classList.add('featured');
        }
      });
      
      // 更新其他服务商选项选中状态
      document.querySelectorAll('.provider-option').forEach(el => {
        el.classList.toggle('selected', el.dataset.provider === id);
      });
      
      // 旧版兼容
      document.querySelectorAll('#providerList .option-card').forEach(el => {
        el.classList.toggle('selected', el.dataset.provider === id);
      });
      
      document.getElementById('apiKeyForm').classList.remove('hidden');
      document.getElementById('apiKeyLabel').textContent = providerNames[id] + ' API Key';
      
      // 根据提供商更新 API Key 帮助信息
      const apiKeyHelp = document.getElementById('apiKeyHelp');
      const apiKeyHelpTexts = {
        'siliconflow': '在 <a href="https://cloud.siliconflow.cn/i/uXXX7IEi" target="_blank">硅基流动</a> 免费注册领取额度，然后在 <a href="https://cloud.siliconflow.cn/account/ak" target="_blank">API Keys 页面</a> 获取 Key',
        'aliyun-bailian': '在 <a href="https://bailian.console.aliyun.com/" target="_blank">阿里云百炼控制台</a> 获取 API Key',
        'deepseek': '在 <a href="https://platform.deepseek.com/api_keys" target="_blank">DeepSeek 控制台</a> 获取 API Key',
        'glm': '在 <a href="https://www.bigmodel.cn/glm-coding?ic=ZPADWSX0SI" target="_blank">智谱 AI 开放平台</a> 注册免费送2000万Token，然后在 <a href="https://open.bigmodel.cn/usercenter/apikeys" target="_blank">API Keys 页面</a> 获取 Key',
        'moonshot': '在 <a href="https://platform.moonshot.cn/console/api-keys" target="_blank">Kimi 开放平台</a> 获取 API Key',
        'kimi-code': '在 <a href="https://www.kimi.com/code/docs/" target="_blank">Kimi Code 文档</a> 获取 API Key（代码专用，262K 超长上下文）',
        'aliyun-codeplan': '在 <a href="https://www.aliyun.com/benefit/ai/aistar?userCode=xsngby7y&clubBiz=subTask..12414078..10263.." target="_blank">阿里云 AI Star</a> 注册获取 Coding Plan API Key（代码专用，与百炼 Key 不同）',
        'glm-codeplan': '在 <a href="https://www.bigmodel.cn/glm-coding?ic=ZPADWSX0SI" target="_blank">智谱开放平台</a> 获取 Coding Plan API Key（代码专用，与通用 GLM Key 不同）',
        'minimax-codeplan': '在 <a href="https://platform.minimaxi.com/subscribe/coding-plan?code=I5REQrAnfL&source=link" target="_blank">MiniMax 平台</a> 订阅 Coding Plan 获取专用 API Key',
        'volcengine-ark': '在 <a href="https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey" target="_blank">火山引擎控制台</a> 获取 API Key，需先在 <a href="https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement" target="_blank">开通管理</a> 开通模型 <button class="tutorial-help-btn" onclick="openDoubaoTutorial()"><span class="material-icons">help_outline</span>新手教程</button>',
        'tencent-hunyuan': '在 <a href="https://console.cloud.tencent.com/hunyuan" target="_blank">腾讯云混元控制台</a> 获取 Secret ID 和 Secret Key',
        'minimax': '在 <a href="https://platform.minimaxi.com/subscribe/coding-plan?code=I5REQrAnfL&source=link" target="_blank">MiniMax 开放平台</a> 注册领取免费额度，然后在 <a href="https://platform.minimaxi.com/user-center/basic-information/interface-key" target="_blank">接口密钥页面</a> 获取 API Key',
        'openai': '在 <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI 平台</a> 获取 API Key（需要科学上网）',
        'anthropic': '在 <a href="https://console.anthropic.com/settings/keys" target="_blank">Anthropic 控制台</a> 获取 API Key（需要科学上网）',
        'google': '在 <a href="https://aistudio.google.com/apikey" target="_blank">Google AI Studio</a> 获取 API Key（需要科学上网）',
        'nvidia': '在 <a href="https://build.nvidia.com/settings" target="_blank">NVIDIA Build</a> 获取 API Key（需要科学上网）',
        'openrouter': '在 <a href="https://openrouter.ai/keys" target="_blank">OpenRouter</a> 获取 API Key（需要科学上网，聚合多家模型）',
        'modelscope': '在 <a href="https://modelscope.cn/my/myaccesstoken" target="_blank">魔搭社区</a> 获取 Access Token（完全免费！）',
        'ollama': '本地模型无需 API Key，默认填 ollama 即可。需先 <a href="https://ollama.com/download" target="_blank">安装 Ollama</a>',
        'custom': '填写你的自定义 API 端点地址和 API Key'
      };
      apiKeyHelp.innerHTML = apiKeyHelpTexts[id] || '在对应平台的控制台获取 API Key';
      
      // 显示/隐藏硅基流动常见问题提示
      const siliconflowFaqTip = document.getElementById('siliconflowFaqTip');
      if (siliconflowFaqTip) {
        if (id === 'siliconflow') {
          siliconflowFaqTip.classList.remove('hidden');
        } else {
          siliconflowFaqTip.classList.add('hidden');
        }
      }
      
      // 更新模型选择
      updateModelSelect(id);
      
      document.getElementById('step1Next').disabled = false;
    }

    function toggleOtherProviders() {
      const content = document.getElementById('providerOtherContent');
      const icon = document.getElementById('providerToggleIcon');
      
      content.classList.toggle('hidden');
      icon.textContent = content.classList.contains('hidden') ? 'expand_more' : 'expand_less';
    }
    
    function toggleInternationalProviders() {
      const content = document.getElementById('internationalProviderContent');
      const icon = document.getElementById('internationalToggleIcon');
      
      content.classList.toggle('hidden');
      icon.textContent = content.classList.contains('hidden') ? 'expand_more' : 'expand_less';
    }
    
    function toggleLocalProviders() {
      const content = document.getElementById('localProviderContent');
      const icon = document.getElementById('localToggleIcon');
      
      content.classList.toggle('hidden');
      icon.textContent = content.classList.contains('hidden') ? 'expand_more' : 'expand_less';
    }

    
    // ==================== Model Combobox 逻辑 ====================
    let currentModels = [];  // 当前提供商的模型列表
    let highlightedIndex = -1;  // 当前高亮的选项索引
    let isComboboxOpen = false;
    let currentProviderId = null;
    
    function updateModelSelect(providerId) {
      const combobox = document.getElementById('modelCombobox');
      const input = document.getElementById('modelSelect');
      const dropdown = document.getElementById('modelDropdown');
      const modelInputSection = document.getElementById('modelInputSection');
      const modelInputHelp = document.getElementById('modelInputHelp');
      const modelHint = document.getElementById('modelHint');
      const customEndpointSection = document.getElementById('customEndpointSection');
      const models = providerModels[providerId] || [];
      const defaultModel = defaultModels[providerId];
      
      currentProviderId = providerId;
      currentModels = models;
      highlightedIndex = -1;
      
      // 重置显示状态
      combobox.classList.remove('hidden');
      modelInputSection.classList.add('hidden');
      customEndpointSection.classList.add('hidden');
      closeCombobox();
      
      // 自定义 API 需要输入端点地址和模型名
      if (providerId === 'custom') {
        customEndpointSection.classList.remove('hidden');
        modelInputSection.classList.remove('hidden');
        input.value = '';
        input.placeholder = '请输入模型名称（如 llama3.2, qwen2.5 等）';
        modelInputHelp.textContent = '填写你的模型名称，根据你使用的服务确定';
        modelHint.textContent = '（需要填写 API 端点和模型名）';
        selectedModel = null;
        currentModels = [];  // 自定义 API 没有预设模型
        showEditableTag(false);
        return;
      }

      // 普通提供商 - 设置默认值
      if (defaultModel) {
        const defaultModelObj = models.find(m => m.id === defaultModel);
        input.value = defaultModel;
        selectedModel = defaultModel;
        showEditableTag(true);
      } else if (models.length > 0) {
        input.value = models[0].id;
        selectedModel = models[0].id;
        showEditableTag(true);
      } else {
        input.value = '';
        input.placeholder = '输入或选择模型';
        selectedModel = null;
        showEditableTag(false);
      }
      
      // 更新提示文本
      if (providerId === 'siliconflow') {
        modelHint.textContent = '（推荐 DeepSeek-V3，性能强劲）';
      } else if (providerId === 'aliyun-bailian') {
        modelHint.textContent = '（推荐 Qwen-Plus，性价比最高）';
      } else if (providerId === 'glm') {
        modelHint.textContent = '（注册送2000万Token，GLM-4 Flash 永久免费！）';
      } else if (providerId === 'volcengine-ark') {
        modelHint.textContent = '（推荐豆包 1.8，需先开通模型）';
      } else if (providerId === 'openai') {
        modelHint.textContent = '（推荐 GPT-4o，多模态旗舰）';
      } else if (providerId === 'anthropic') {
        modelHint.textContent = '（推荐 Claude Sonnet 4，编程最强）';
      } else {
        modelHint.textContent = '（推荐值已选好，直接下一步即可）';
      }
      
      // 渲染下拉列表
      renderDropdown('');
    }
    
    function renderDropdown(filter) {
      const dropdown = document.getElementById('modelDropdown');
      const input = document.getElementById('modelSelect');
      const filterLower = filter.toLowerCase().trim();
      const filterValue = filter.trim();
      
      // 过滤模型
      let filteredModels = currentModels;
      if (filterLower) {
        filteredModels = currentModels.filter(m => 
          m.id.toLowerCase().includes(filterLower) || 
          m.name.toLowerCase().includes(filterLower) ||
          (m.description && m.description.toLowerCase().includes(filterLower))
        );
      }
      
      const defaultModel = defaultModels[currentProviderId];
      let html = '';
      
      // 检查用户输入的值是否完全匹配某个预设模型 ID
      const isExactMatch = currentModels.some(m => m.id.toLowerCase() === filterLower);
      
      // 如果用户输入了自定义值（非空且不完全匹配预设），显示"使用自定义值"选项
      if (filterValue && !isExactMatch) {
        const isCustomHighlighted = highlightedIndex === -2; // 特殊索引表示自定义选项
        html += '<div class="model-option model-option-custom' + (isCustomHighlighted ? ' highlighted' : '') + '" data-value="' + escapeHtml(filterValue) + '" data-index="-2">';
        html += '<span class="model-option-custom-icon">✏️</span>';
        html += '<span class="model-option-custom-text">使用自定义模型: <strong>' + escapeHtml(filterValue) + '</strong></span>';
        html += '</div>';
        html += '<div class="model-dropdown-divider"></div>';
      }
      
      if (filteredModels.length === 0) {
        if (currentModels.length === 0) {
          // 自定义 API 或无预设模型
          html += '<div class="model-dropdown-hint">直接输入模型名称即可</div>';
        } else if (!filterValue) {
          html += '<div class="model-dropdown-empty">请输入模型名称</div>';
        }
        // 如果有自定义选项，不需要额外提示
        dropdown.innerHTML = html;
        highlightedIndex = filterValue && !isExactMatch ? -2 : -1;
        return;
      }
      
      if (!filterLower && filteredModels.length > 0) {
        html += '<div class="model-dropdown-hint">选择推荐模型，或直接输入自定义模型名</div>';
      }
      
      filteredModels.forEach((m, idx) => {
        const isDefault = m.id === defaultModel;
        const isSelected = m.id === input.value;
        const isHighlighted = idx === highlightedIndex;
        
        let classes = 'model-option';
        if (isSelected) classes += ' selected';
        if (isHighlighted) classes += ' highlighted';
        
        let badge = '';
        if (isDefault) {
          badge = '<span class="model-option-badge">⭐ 推荐</span>';
        } else if (m.free) {
          badge = '<span class="model-option-badge free">免费</span>';
        }
        
        const desc = m.description ? '<span class="model-option-desc">' + escapeHtml(m.description) + '</span>' : '';
        
        html += '<div class="' + classes + '" data-value="' + escapeHtml(m.id) + '" data-index="' + idx + '">';
        html += '<span><span class="model-option-name">' + escapeHtml(m.name) + '</span>' + desc + '</span>';
        html += badge;
        html += '</div>';
      });
      
      dropdown.innerHTML = html;
    }
    
    function escapeHtml(text) {
      if (!text) return '';
      return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    
    function openCombobox() {
      const combobox = document.getElementById('modelCombobox');
      if (isComboboxOpen) return;
      isComboboxOpen = true;
      combobox.classList.add('open');
      highlightedIndex = -1;
      renderDropdown(document.getElementById('modelSelect').value);
    }
    
    function closeCombobox() {
      const combobox = document.getElementById('modelCombobox');
      isComboboxOpen = false;
      combobox.classList.remove('open');
      highlightedIndex = -1;
    }
    
    function selectModel(value) {
      const input = document.getElementById('modelSelect');
      input.value = value;
      selectedModel = value;
      closeCombobox();
      showEditableTag(!!value);
    }

    function showEditableTag(visible) {
      const tag = document.getElementById('modelEditableTag');
      if (tag) {
        if (visible) {
          tag.classList.add('visible');
        } else {
          tag.classList.remove('visible');
        }
      }
    }
    
    function getFilteredModels(filter) {
      const filterLower = filter.toLowerCase().trim();
      if (!filterLower) return currentModels;
      return currentModels.filter(m => 
        m.id.toLowerCase().includes(filterLower) || 
        m.name.toLowerCase().includes(filterLower) ||
        (m.description && m.description.toLowerCase().includes(filterLower))
      );
    }
    
    // 事件监听：输入框
    document.getElementById('modelSelect').addEventListener('focus', function() {
      openCombobox();
    });
    
    document.getElementById('modelSelect').addEventListener('input', function() {
      selectedModel = this.value.trim();
      highlightedIndex = -1;
      renderDropdown(this.value);
      if (!isComboboxOpen) {
        openCombobox();
      }
    });
    
    document.getElementById('modelSelect').addEventListener('keydown', function(e) {
      const filteredModels = getFilteredModels(this.value);
      const inputValue = this.value.trim();
      const isExactMatch = currentModels.some(m => m.id.toLowerCase() === inputValue.toLowerCase());
      const hasCustomOption = inputValue && !isExactMatch;
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!isComboboxOpen) {
          openCombobox();
          return;
        }
        // 支持从自定义选项向下导航到列表
        if (highlightedIndex === -2 && filteredModels.length > 0) {
          highlightedIndex = 0;
        } else if (filteredModels.length > 0) {
          highlightedIndex = Math.min(highlightedIndex + 1, filteredModels.length - 1);
        }
        renderDropdown(this.value);
        scrollToHighlighted();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        // 支持从列表向上导航到自定义选项
        if (highlightedIndex === 0 && hasCustomOption) {
          highlightedIndex = -2;
          renderDropdown(this.value);
        } else if (highlightedIndex > 0) {
          highlightedIndex = Math.max(highlightedIndex - 1, 0);
          renderDropdown(this.value);
          scrollToHighlighted();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (isComboboxOpen) {
          if (highlightedIndex === -2) {
            // 选择自定义值
            selectModel(inputValue);
          } else if (highlightedIndex >= 0 && filteredModels.length > 0) {
            selectModel(filteredModels[highlightedIndex].id);
          } else {
            // 直接使用输入的值
            selectedModel = inputValue;
            closeCombobox();
          }
        }
      } else if (e.key === 'Escape') {
        closeCombobox();
      } else if (e.key === 'Tab') {
        closeCombobox();
      }
    });
    
    function scrollToHighlighted() {
      const dropdown = document.getElementById('modelDropdown');
      const highlighted = dropdown.querySelector('.model-option.highlighted, .model-option-custom.highlighted');
      if (highlighted) {
        highlighted.scrollIntoView({ block: 'nearest' });
      }
    }
    
    // 事件监听：下拉选项点击
    document.getElementById('modelDropdown').addEventListener('mousedown', function(e) {
      // 阻止 blur 事件触发，否则下拉框会在点击前关闭
      e.preventDefault();
    });
    
    document.getElementById('modelDropdown').addEventListener('click', function(e) {
      const option = e.target.closest('.model-option');
      if (option) {
        const value = option.dataset.value;
        if (value) {
          selectModel(value);
        }
      }
    });
    
    // 事件监听：鼠标悬停高亮
    document.getElementById('modelDropdown').addEventListener('mouseover', function(e) {
      const option = e.target.closest('.model-option');
      if (option) {
        const index = parseInt(option.dataset.index, 10);
        if (!isNaN(index) && index !== highlightedIndex) {
          highlightedIndex = index;
          renderDropdown(document.getElementById('modelSelect').value);
        }
      }
    });
    
    // 事件监听：点击外部关闭下拉
    document.addEventListener('click', function(e) {
      const combobox = document.getElementById('modelCombobox');
      if (combobox && !combobox.contains(e.target)) {
        closeCombobox();
      }
    });

    function togglePasswordVisibility() {
      const input = document.getElementById('apiKeyInput');
      const icon = document.getElementById('passwordIcon');
      if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = 'visibility_off';
      } else {
        input.type = 'password';
        icon.textContent = 'visibility';
      }
    }

    // ==================== Step 2: 安全设置 ====================
    function selectSecurity(mode) {
      if (mode === 'trust') {
        // 显示确认弹窗
        document.getElementById('trustModeModal').classList.remove('hidden');
        return;
      }
      
      doSelectSecurity(mode);
    }

    function doSelectSecurity(mode) {
      selectedSecurity = mode;
      
      // 更新所有大卡片状态
      document.querySelectorAll('.security-big-card').forEach(el => {
        el.classList.toggle('selected', el.dataset.security === mode);
      });
      
      // 更新折叠区域中的小卡片状态
      document.querySelectorAll('.security-option-card').forEach(el => {
        el.classList.toggle('selected', el.dataset.security === mode);
      });
      
      window.trustModeConfirmed = (mode === 'trust');
      
      // 更新工作目录区域的显示状态
      updateSecurityModeDisplay();
    }

    function toggleOtherSecurityOptions() {
      const content = document.getElementById('securityOtherContent');
      const toggle = document.querySelector('.security-other-toggle');
      const icon = document.getElementById('securityToggleIcon');
      
      content.classList.toggle('hidden');
      toggle.classList.toggle('open');
    }

    function closeTrustModeModal() {
      document.getElementById('trustModeModal').classList.add('hidden');
    }
    
    function updateAgreement() {
      const checkboxWrapper = document.getElementById('agreementCheckbox');
      checkboxWrapper.classList.remove('error');
    }

    function confirmTrustMode() {
      window.trustModeConfirmed = true;
      doSelectSecurity('trust');
      closeTrustModeModal();
    }

    function updateSecurityModeDisplay() {
      const modeDisplay = document.getElementById('currentModeDisplay');
      const modeStatusDesc = document.getElementById('modeStatusDesc');
      const modeStatusCard = document.getElementById('modeStatusCard');
      const modeStatusIcon = modeStatusCard?.querySelector('.mode-status-icon');
      const trustedSection = document.getElementById('trustedDirsSection');
      const workspaceSection = document.getElementById('workspaceSettingsSection');
      
      if (modeDisplay) modeDisplay.textContent = securityModeNames[selectedSecurity];
      
      if (selectedSecurity === 'trust') {
        // 完全信任模式 - 不需要配置安全区和工作目录（AI 可访问整个系统）
        if (modeStatusIcon) modeStatusIcon.textContent = '⚡';
        if (modeStatusDesc) modeStatusDesc.textContent = '⚠️ AI 可以做任何事，请谨慎操作';
        if (modeStatusCard) {
          modeStatusCard.style.borderColor = 'var(--accent-orange)';
          modeStatusCard.style.background = 'linear-gradient(135deg, rgba(249, 115, 22, 0.12) 0%, rgba(249, 115, 22, 0.04) 100%)';
        }
        if (modeDisplay) modeDisplay.style.color = 'var(--accent-orange)';
        if (trustedSection) trustedSection.style.display = 'none';
        if (workspaceSection) workspaceSection.style.display = 'none';
      } else if (selectedSecurity === 'full') {
        // 只聊天模式 - 不需要配置安全区（AI 无法操作文件）
        if (modeStatusIcon) modeStatusIcon.textContent = '🔒';
        if (modeStatusDesc) modeStatusDesc.textContent = '🔐 AI 只能对话，无法操作你的文件';
        if (modeStatusCard) {
          modeStatusCard.style.borderColor = 'var(--accent-green)';
          modeStatusCard.style.background = 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(34, 197, 94, 0.04) 100%)';
        }
        if (modeDisplay) modeDisplay.style.color = 'var(--accent-green)';
        if (trustedSection) trustedSection.style.display = 'none';
        if (workspaceSection) workspaceSection.style.display = 'none';
      } else {
        // 正常使用（默认）- 需要配置安全区文件夹
        if (modeStatusIcon) modeStatusIcon.textContent = '🏠';
        if (modeStatusDesc) modeStatusDesc.textContent = '帮你做事，敏感操作会先问你';
        if (modeStatusCard) {
          modeStatusCard.style.borderColor = 'var(--accent-blue)';
          modeStatusCard.style.background = 'linear-gradient(135deg, rgba(60, 131, 246, 0.12) 0%, rgba(60, 131, 246, 0.04) 100%)';
        }
        if (modeDisplay) modeDisplay.style.color = 'var(--accent-blue-light)';
        if (trustedSection) trustedSection.style.display = 'block';
        if (workspaceSection) workspaceSection.style.display = 'block';
      }
    }
    
    function toggleExtraDirs() {
      const section = document.getElementById('trustedDirsSection');
      const content = document.getElementById('extraDirsContent');
      section.classList.toggle('open');
      content.classList.toggle('hidden');
    }

    function toggleCollapsible(id) {
      const el = document.getElementById(id);
      el.classList.toggle('open');
    }

    // ==================== Step 3: 工作目录 ====================
    let browserCurrentPath = '';
    let browserSelectedPath = '';
    let browsingForTrustedDir = false;

    function browseWorkspace() {
      browsingForTrustedDir = false;
      document.getElementById('folderBrowserModal').classList.remove('hidden');
      loadDirectory();
    }

    function addTrustedDir() {
      browsingForTrustedDir = true;
      document.getElementById('folderBrowserModal').classList.remove('hidden');
      loadDirectory();
    }

    async function loadDirectory(path) {
      const folderList = document.getElementById('folderList');
      const pathInput = document.getElementById('browserPathInput');
      const drivesBar = document.getElementById('drivesBar');
      
      folderList.innerHTML = '<div class="folder-empty">加载中...</div>';
      
      try {
        const url = path ? '/api/setup/browse-directory?path=' + encodeURIComponent(path) : '/api/setup/browse-directory';
        const res = await fetch(url);
        const data = await res.json();
        
        if (!data.ok) {
          folderList.innerHTML = '<div class="folder-empty">无法访问: ' + (data.error || '未知错误') + '</div>';
          return;
        }
        
        browserCurrentPath = data.data.currentPath;
        pathInput.value = browserCurrentPath;
        browserSelectedPath = browserCurrentPath;
        
        if (data.data.drives && data.data.drives.length > 0) {
          drivesBar.innerHTML = data.data.drives.map(d => 
            '<button class="drive-btn" onclick="loadDirectory(\\'' + d.replace(/\\\\/g, '\\\\\\\\') + '\\')">' + d + '</button>'
          ).join('');
          drivesBar.style.display = 'flex';
        } else {
          drivesBar.style.display = 'none';
        }
        
        let html = '';
        if (data.data.parentPath) {
          html += '<div class="folder-item" onclick="loadDirectory(\\'' + data.data.parentPath.replace(/\\\\/g, '\\\\\\\\') + '\\')">' +
            '<span class="folder-item-icon">📁</span>' +
            '<span class="folder-item-name">..</span>' +
            '</div>';
        }
        
        if (data.data.directories && data.data.directories.length > 0) {
          for (const dir of data.data.directories) {
            const escapedPath = dir.path.replace(/\\\\/g, '\\\\\\\\').replace(/'/g, "\\\\'");
            html += '<div class="folder-item" ondblclick="loadDirectory(\\'' + escapedPath + '\\')" onclick="selectFolder(this, \\'' + escapedPath + '\\')">' +
              '<span class="folder-item-icon">📁</span>' +
              '<span class="folder-item-name">' + dir.name + '</span>' +
              '</div>';
          }
        }
        
        folderList.innerHTML = html || '<div class="folder-empty">此目录为空</div>';
      } catch (e) {
        folderList.innerHTML = '<div class="folder-empty">加载失败: ' + e.message + '</div>';
      }
    }

    function selectFolder(el, path) {
      document.querySelectorAll('.folder-item').forEach(item => item.classList.remove('selected'));
      el.classList.add('selected');
      browserSelectedPath = path;
    }

    function navigateToPath() {
      const path = document.getElementById('browserPathInput').value;
      if (path) loadDirectory(path);
    }

    function closeBrowser() {
      document.getElementById('folderBrowserModal').classList.add('hidden');
    }

    // C盘检测辅助函数
    function isCDrivePath(path) {
      if (!path) return false;
      const normalized = path.trim().toUpperCase();
      // 检测 C: 或 C:\\ 开头的路径
      return normalized.startsWith('C:') || normalized.startsWith('C\\\\');
    }

    // 待确认的 C 盘路径
    let pendingCDrivePath = null;
    let pendingCDriveIsTrustedDir = false;

    // 显示 C 盘确认弹框
    function showCDriveConfirmModal() {
      document.getElementById('cDriveConfirmModal').classList.remove('hidden');
    }

    // 取消 C 盘选择
    function cancelCDriveSelection() {
      document.getElementById('cDriveConfirmModal').classList.add('hidden');
      pendingCDrivePath = null;
      pendingCDriveIsTrustedDir = false;
      // 文件浏览器保持打开，让用户重新选择
    }

    // 确认使用 C 盘
    function confirmCDriveSelection() {
      document.getElementById('cDriveConfirmModal').classList.add('hidden');
      
      if (pendingCDrivePath) {
        if (pendingCDriveIsTrustedDir) {
          if (!trustedDirs.includes(pendingCDrivePath)) {
            trustedDirs.push(pendingCDrivePath);
            renderTrustedDirs();
          }
        } else {
          document.getElementById('workspaceInput').value = pendingCDrivePath;
        }
        closeBrowser();
      }
      
      pendingCDrivePath = null;
      pendingCDriveIsTrustedDir = false;
    }

    async function confirmSelection() {
      if (browserSelectedPath) {
        try {
          const res = await fetch('/api/setup/validate-path', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: browserSelectedPath })
          });
          const data = await res.json();
          if (!data.ok || !data.data?.valid) {
            alert('路径验证失败: ' + (data.data?.error || data.error || '未知错误'));
            return;
          }
        } catch (e) {
          // 忽略验证错误，继续使用
        }
        
        // C盘检测：如果选择了 C 盘路径，弹出确认框
        if (isCDrivePath(browserSelectedPath)) {
          pendingCDrivePath = browserSelectedPath;
          pendingCDriveIsTrustedDir = browsingForTrustedDir;
          showCDriveConfirmModal();
          return;
        }
        
        if (browsingForTrustedDir) {
          if (!trustedDirs.includes(browserSelectedPath)) {
            trustedDirs.push(browserSelectedPath);
            renderTrustedDirs();
          }
        } else {
          document.getElementById('workspaceInput').value = browserSelectedPath;
        }
      }
      closeBrowser();
    }

    function renderTrustedDirs() {
      const container = document.getElementById('trustedDirsList');
      if (trustedDirs.length === 0) {
        container.innerHTML = '<div style="color: var(--text-muted); font-size: 0.9em; padding: 8px 0;">暂未添加额外信任目录</div>';
        return;
      }
      container.innerHTML = trustedDirs.map((dir, index) => 
        '<div class="dir-item">' +
          '<span class="dir-item-icon">📁</span>' +
          '<span class="dir-item-path">' + dir + '</span>' +
          '<button class="dir-item-remove" onclick="removeTrustedDir(' + index + ')">移除</button>' +
        '</div>'
      ).join('');
    }

    function removeTrustedDir(index) {
      trustedDirs.splice(index, 1);
      renderTrustedDirs();
    }

    // ==================== Step 4: 对话方式选择 ====================
    let currentChannelMode = 'web'; // 'web' 或 'im'
    let currentChannelTab = 'dingtalk';

    function selectChannelMode(mode) {
      currentChannelMode = mode;
      
      // 更新卡片选中状态
      document.querySelectorAll('.channel-mode-card').forEach(el => {
        el.classList.toggle('selected', el.dataset.mode === mode);
      });
      
      // 显示/隐藏相应内容
      const webInfo = document.getElementById('webModeInfo');
      const imConfig = document.getElementById('imConfigSection');
      
      if (mode === 'web') {
        webInfo.classList.remove('hidden');
        imConfig.classList.add('hidden');
      } else {
        webInfo.classList.add('hidden');
        imConfig.classList.remove('hidden');
      }
    }

    function selectChannelTab(channelId) {
      currentChannelTab = channelId;
      
      // 更新 tab 选中状态
      document.querySelectorAll('.channel-tab').forEach(el => {
        el.classList.toggle('selected', el.dataset.channel === channelId);
      });
      
      // 显示对应的配置表单
      document.getElementById('dingtalkConfigForm').classList.toggle('hidden', channelId !== 'dingtalk');
      document.getElementById('feishuConfigForm').classList.toggle('hidden', channelId !== 'feishu');
      document.getElementById('wecomConfigForm').classList.toggle('hidden', channelId !== 'wecom');
    }

    // 配置指南切换 - 支持左右分栏模式
    function toggleGuide(formId, guideId) {
      const form = document.getElementById(formId);
      const guide = document.getElementById(guideId);
      const isHidden = guide.classList.contains('hidden');
      
      if (isHidden) {
        // 展开指南 - 启用分栏模式
        guide.classList.remove('hidden');
        form.classList.add('split-mode');
        // 平滑滚动到表单区域
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        // 收起指南 - 关闭分栏模式
        guide.classList.add('hidden');
        form.classList.remove('split-mode');
      }
    }
    
    function toggleDingtalkGuide() {
      toggleGuide('dingtalkConfigForm', 'dingtalkGuide');
    }

    function toggleFeishuGuide() {
      toggleGuide('feishuConfigForm', 'feishuGuide');
    }

    function toggleWecomGuide() {
      toggleGuide('wecomConfigForm', 'wecomGuide');
    }

    function toggleWecomSecretVisibility() {
      const input = document.getElementById('wecomAgentSecret');
      const icon = document.getElementById('wecomSecretIcon');
      if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = 'visibility_off';
      } else {
        input.type = 'password';
        icon.textContent = 'visibility';
      }
    }

    async function handleStep3Next() {
      if (currentChannelMode === 'web') {
        // 网页对话模式，直接进入下一步
        selectedChannels = ['web'];
        goToStep(4);
        return;
      }
      
      // IM模式，需要保存配置
      await saveChannelConfig();
    }

    function toggleDingtalkSecretVisibility() {
      const input = document.getElementById('dingtalkAppSecret');
      const icon = document.getElementById('dingtalkSecretIcon');
      if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = 'visibility_off';
      } else {
        input.type = 'password';
        icon.textContent = 'visibility';
      }
    }

    function toggleFeishuSecretVisibility() {
      const input = document.getElementById('feishuAppSecret');
      const icon = document.getElementById('feishuSecretIcon');
      if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = 'visibility_off';
      } else {
        input.type = 'password';
        icon.textContent = 'visibility';
      }
    }

    async function saveChannelConfig() {
      const btn = document.getElementById('step3NextBtn');
      let hasConfig = false;
      let configData = {};

      // 收集钉钉配置
      const dingtalkAppKey = document.getElementById('dingtalkAppKey').value.trim();
      const dingtalkAppSecret = document.getElementById('dingtalkAppSecret').value.trim();
      if (dingtalkAppKey && dingtalkAppSecret) {
        hasConfig = true;
        selectedChannels.push('dingtalk');
        configData.dingtalk = {
          appKey: dingtalkAppKey,
          appSecret: dingtalkAppSecret,
          robotToken: document.getElementById('dingtalkRobotToken').value.trim() || undefined
        };
      }

      // 收集飞书配置
      const feishuAppId = document.getElementById('feishuAppId').value.trim();
      const feishuAppSecret = document.getElementById('feishuAppSecret').value.trim();
      if (feishuAppId && feishuAppSecret) {
        hasConfig = true;
        if (!selectedChannels.includes('feishu')) selectedChannels.push('feishu');
        configData.feishu = {
          appId: feishuAppId,
          appSecret: feishuAppSecret,
          encryptKey: document.getElementById('feishuEncryptKey').value.trim() || undefined,
          verificationToken: document.getElementById('feishuVerificationToken').value.trim() || undefined
        };
      }

      // 收集企业微信配置
      const wecomCorpId = document.getElementById('wecomCorpId').value.trim();
      const wecomAgentId = document.getElementById('wecomAgentId').value.trim();
      const wecomAgentSecret = document.getElementById('wecomAgentSecret').value.trim();
      const wecomToken = document.getElementById('wecomToken').value.trim();
      const wecomEncodingAESKey = document.getElementById('wecomEncodingAESKey').value.trim();
      if (wecomCorpId && wecomAgentId && wecomAgentSecret && wecomToken && wecomEncodingAESKey) {
        hasConfig = true;
        if (!selectedChannels.includes('wecom')) selectedChannels.push('wecom');
        configData.wecom = {
          corpId: wecomCorpId,
          agentId: parseInt(wecomAgentId, 10),
          agentSecret: wecomAgentSecret,
          token: wecomToken,
          encodingAESKey: wecomEncodingAESKey
        };
      }

      if (!hasConfig) {
        // 没有配置任何渠道，切换到网页对话模式
        const confirmSkip = confirm('您还没有配置任何IM渠道。\\n\\n是否使用网页对话模式？（推荐）\\n\\n点击「确定」使用网页对话，点击「取消」继续配置。');
        if (confirmSkip) {
          selectedChannels = ['web'];
          goToStep(4);
        }
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<span class="status-spinner"></span> 验证凭证中...';

      // 确定当前显示的状态区域
      let statusEl = 'dingtalkConfigStatus';
      if (configData.feishu && !configData.dingtalk) statusEl = 'feishuConfigStatus';
      if (configData.wecom && !configData.dingtalk && !configData.feishu) statusEl = 'wecomConfigStatus';

      try {
        // 显示验证中状态
        if (configData.dingtalk) {
          showStatus('dingtalkConfigStatus', '正在验证钉钉凭证...', 'loading');
        }
        if (configData.feishu) {
          showStatus('feishuConfigStatus', '正在验证飞书凭证...', 'loading');
        }
        if (configData.wecom) {
          showStatus('wecomConfigStatus', '正在验证企业微信凭证...', 'loading');
        }

        // 保存渠道配置（后端会自动验证）
        const res = await fetch('/api/setup/configure-channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configData)
        });
        const data = await res.json();

        if (!data.ok) {
          // 验证失败
          const errorMsg = data.error || '保存失败';
          if (errorMsg.includes('钉钉')) {
            showStatus('dingtalkConfigStatus', '❌ ' + errorMsg, 'error');
          } else if (errorMsg.includes('飞书')) {
            showStatus('feishuConfigStatus', '❌ ' + errorMsg, 'error');
          } else if (errorMsg.includes('企业微信')) {
            showStatus('wecomConfigStatus', '❌ ' + errorMsg, 'error');
          } else {
            showStatus(statusEl, '❌ ' + errorMsg, 'error');
          }
          btn.disabled = false;
          btn.innerHTML = '下一步 <span class="material-icons">arrow_forward</span>';
          return;
        }

        // 显示成功状态
        if (configData.dingtalk) {
          showStatus('dingtalkConfigStatus', '✓ 钉钉凭证验证成功', 'success');
        }
        if (configData.feishu) {
          showStatus('feishuConfigStatus', '✓ 飞书凭证验证成功', 'success');
        }
        if (configData.wecom) {
          showStatus('wecomConfigStatus', '✓ 企业微信凭证验证成功', 'success');
        }
        
        await delay(800);
        goToStep(4);
      } catch (e) {
        showStatus(statusEl, '保存失败: ' + e.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '下一步 <span class="material-icons">arrow_forward</span>';
      }
    }

    function skipChannels() {
      selectedChannels = [];
      goToStep(4);
    }

    // ==================== Step 4: 产品激活 ====================
    // OEM 版：弹出购买凭证二维码弹窗
    function showPurchaseQrcodeModal() {
      const modal = document.getElementById('purchaseQrcodeModal');
      if (modal) modal.style.display = 'flex';
    }

    // 加载微信技术支持二维码（进入 Step 4 时自动触发）
    async function loadSetupQrcode() {
      const imageWrapper = document.getElementById('wechatQrcodeImage');
      const groupNameEl = document.getElementById('wechatQrcodeGroupName');
      // 如果模板已内联了二维码图片，检测是否已有 <img>
      const hasInlineImg = imageWrapper && imageWrapper.querySelector('img');
      try {
        const res = await fetch('/api/setup/qrcode');
        const data = await res.json();
        if (data.ok && data.data?.qrcode?.base64) {
          if (imageWrapper) {
            imageWrapper.innerHTML = '<img src="' + data.data.qrcode.base64 + '" alt="微信技术支持群二维码">';
          }
          if (groupNameEl && data.data.qrcode.groupName) {
            groupNameEl.textContent = data.data.qrcode.groupName;
          }
        } else if (!hasInlineImg) {
          // 仅当模板没有内联图片时才显示占位提示
          if (imageWrapper) {
            imageWrapper.innerHTML = '<div class="wechat-qr-placeholder"><span class="material-icons">qr_code_2</span><span>暂未配置</span></div>';
          }
        }
        // 如果已有内联图片且 API 无数据，保留内联图片不覆盖
      } catch (e) {
        console.warn('[Setup] Failed to load QR code:', e);
        // API 失败时，保留已有的内联图片
        if (!hasInlineImg && imageWrapper) {
          imageWrapper.innerHTML = '<div class="wechat-qr-placeholder"><span class="material-icons">qr_code_2</span><span>加载失败</span></div>';
        }
      }
    }

    async function validateLicense() {
      const token = document.getElementById('licenseTokenInput').value.trim();
      if (!token) {
        showStatus('licenseStatus', '请输入服务凭证', 'error');
        return;
      }

      // 前端格式校验：必须以 clawd- 或 test- 开头
      if (!token.startsWith('clawd-') && !token.startsWith('test-')) {
        showStatus('licenseStatus', '凭证格式不正确，请输入以 clawd- 或 test- 开头的秘钥', 'error');
        return;
      }
      
      const btn = document.getElementById('validateLicenseBtn');
      btn.disabled = true;
      btn.innerHTML = '<span class="status-spinner"></span> 验证中...';
      showStatus('licenseStatus', '正在验证凭证，请稍候...', 'loading');
      
      try {
        const res = await fetch('/api/setup/validate-license', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token })
        });
        const data = await res.json();
        
        if (data.ok && data.data?.valid) {
          licenseValidated = true;
          licenseExpires = data.data.expiresAt;
          
          // 隐藏表单，显示成功动画
          document.getElementById('licenseFormSection').classList.add('hidden');
          document.getElementById('licenseSuccessSection').classList.add('show');
          
          // 显示过期时间
          if (licenseExpires) {
            const expDate = new Date(licenseExpires);
            document.getElementById('licenseExpiresText').textContent = '有效期至：' + expDate.toLocaleDateString('zh-CN');
          }
          
          // 撒花动画
          createConfetti();
          
          // 延迟后显示协议勾选区域（而不是自动跳转）
          await delay(1500);
          showLegalAgreementSection();
        } else if (data.ok && data.data?.errorCode === 1010) {
          // 设备切换确认（单设备模式）
          const switchInfo = data.data.deviceSwitchInfo || {};
          pendingLicenseKey = token;
          showDeviceSwitchModal(switchInfo);
          btn.disabled = false;
          btn.innerHTML = '<span class="material-icons">verified</span> 验证凭证';
        } else if (data.ok && data.data?.errorCode === 1011) {
          // 设备切换冷却期
          const cooldownInfo = data.data.deviceSwitchCooldown || {};
          showDeviceCooldownModal(cooldownInfo);
          btn.disabled = false;
          btn.innerHTML = '<span class="material-icons">verified</span> 验证凭证';
        } else {
          throw new Error(data.data?.error || data.error || '许可证无效');
        }
      } catch (e) {
        // 将网络错误转换为友好的中文提示
        let errorMsg = e.message || '未知错误';
        if (errorMsg.includes('Failed to fetch') || errorMsg.includes('fetch')) {
          errorMsg = '网络连接失败，请检查网络后重试';
        } else if (errorMsg.includes('timeout') || errorMsg.includes('Timeout')) {
          errorMsg = '连接超时，请稍后重试';
        } else if (errorMsg.includes('NetworkError') || errorMsg.includes('network')) {
          errorMsg = '网络异常，请检查网络连接';
        }
        showStatus('licenseStatus', '验证失败: ' + errorMsg, 'error');
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons">verified</span> 验证凭证';
      }
    }


    function createConfetti() {
      const container = document.getElementById('confettiContainer');
      const colors = ['#3c83f6', '#60a5fa', '#22c55e', '#f97316', '#eab308', '#ef4444'];
      
      for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 2 + 's';
        confetti.style.animationDuration = (2 + Math.random() * 2) + 's';
        container.appendChild(confetti);
        
        setTimeout(() => confetti.remove(), 5000);
      }
    }

    // ==================== 设备切换相关函数 ====================
    
    // 显示设备切换确认弹窗 (errorCode=1010)
    function showDeviceSwitchModal(switchInfo) {
      const modal = document.getElementById('deviceSwitchModal');
      const existingName = switchInfo.existingDeviceName || '其他设备';
      
      document.getElementById('existingDeviceName').textContent = existingName;
      document.getElementById('existingDeviceNameCopy').textContent = existingName;
      
      modal.classList.remove('hidden');
    }
    
    // 关闭设备切换确认弹窗
    function closeDeviceSwitchModal() {
      document.getElementById('deviceSwitchModal').classList.add('hidden');
      showStatus('licenseStatus', '', 'hidden');
    }
    
    // 确认设备切换
    async function confirmDeviceSwitch() {
      if (!pendingLicenseKey) {
        showStatus('licenseStatus', '错误：缺少授权码', 'error');
        closeDeviceSwitchModal();
        return;
      }
      
      const btn = document.getElementById('confirmSwitchBtn');
      btn.disabled = true;
      btn.innerHTML = '<span class="status-spinner"></span> 切换中...';
      
      try {
        const res = await fetch('/api/setup/switch-device', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: pendingLicenseKey })
        });
        const data = await res.json();
        
        if (data.ok && data.data?.valid) {
          // 切换成功
          closeDeviceSwitchModal();
          
          licenseValidated = true;
          licenseExpires = data.data.expiresAt;
          
          // 隐藏表单，显示成功动画
          document.getElementById('licenseFormSection').classList.add('hidden');
          document.getElementById('licenseSuccessSection').classList.add('show');
          
          // 显示过期时间
          if (licenseExpires) {
            const expDate = new Date(licenseExpires);
            document.getElementById('licenseExpiresText').textContent = '有效期至：' + expDate.toLocaleDateString('zh-CN');
          }
          
          // 撒花动画
          createConfetti();
          
          // 延迟后显示协议勾选区域
          await delay(1500);
          showLegalAgreementSection();
        } else if (data.ok && data.data?.errorCode === 1011) {
          // 进入冷却期
          closeDeviceSwitchModal();
          const cooldownInfo = data.data.deviceSwitchCooldown || {};
          showDeviceCooldownModal(cooldownInfo);
        } else {
          throw new Error(data.data?.error || data.error || '设备切换失败');
        }
      } catch (e) {
        // 将网络错误转换为友好的中文提示
        let errorMsg = e.message || '未知错误';
        if (errorMsg.includes('Failed to fetch') || errorMsg.includes('fetch')) {
          errorMsg = '网络连接失败，请检查网络后重试';
        } else if (errorMsg.includes('timeout') || errorMsg.includes('Timeout')) {
          errorMsg = '连接超时，请稍后重试';
        } else if (errorMsg.includes('NetworkError') || errorMsg.includes('network')) {
          errorMsg = '网络异常，请检查网络连接';
        }
        showStatus('licenseStatus', '切换失败: ' + errorMsg, 'error');
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons">check</span> 确认切换';
      }
      
      pendingLicenseKey = null;
    }
    
    // 显示设备切换冷却期弹窗 (errorCode=1011)
    function showDeviceCooldownModal(cooldownInfo) {
      const modal = document.getElementById('deviceCooldownModal');
      
      // 格式化冷却剩余时间
      const hours = cooldownInfo.cooldownRemainingHours || 0;
      let remainingText;
      if (hours >= 1) {
        remainingText = Math.ceil(hours) + ' 小时';
      } else {
        remainingText = Math.ceil(hours * 60) + ' 分钟';
      }
      document.getElementById('cooldownRemaining').textContent = remainingText;
      
      // 格式化可切换时间
      if (cooldownInfo.cooldownEndsAt) {
        try {
          const date = new Date(cooldownInfo.cooldownEndsAt);
          document.getElementById('cooldownEndsAt').textContent = date.toLocaleString('zh-CN');
        } catch (e) {
          document.getElementById('cooldownEndsAt').textContent = cooldownInfo.cooldownEndsAt;
        }
      } else {
        document.getElementById('cooldownEndsAt').textContent = '-';
      }
      
      modal.classList.remove('hidden');
      showStatus('licenseStatus', '设备切换冷却中，请稍后再试', 'error');
    }
    
    // 关闭冷却期弹窗
    function closeDeviceCooldownModal() {
      document.getElementById('deviceCooldownModal').classList.add('hidden');
    }
    
    // ==================== 豆包教程弹窗 ====================
    
    // 打开豆包教程弹窗
    function openDoubaoTutorial() {
      document.getElementById('doubaoTutorialModal').classList.remove('hidden');
    }
    
    // 关闭豆包教程弹窗
    function closeDoubaoTutorial() {
      document.getElementById('doubaoTutorialModal').classList.add('hidden');
    }

    // ==================== 协议勾选相关函数 ====================
    
    // 显示协议勾选区域
    function showLegalAgreementSection() {
      const section = document.getElementById('legalAgreementSection');
      const btnGroup = document.getElementById('step4CompleteBtnGroup');
      if (section) section.style.display = 'block';
      if (btnGroup) btnGroup.style.display = 'flex';
    }
    
    // 协议勾选状态变化
    function onLegalAgreementChange() {
      const checkbox = document.getElementById('legalAgreementCheckbox');
      const section = document.getElementById('legalAgreementSection');
      const btn = document.getElementById('step4CompleteBtn');
      
      if (checkbox.checked) {
        section.classList.add('checked');
        btn.disabled = false;
      } else {
        section.classList.remove('checked');
        btn.disabled = true;
      }
    }
    
    // 完成 Step 4，进入完成页
    function completeStep4() {
      const checkbox = document.getElementById('legalAgreementCheckbox');
      if (!checkbox.checked) {
        // 如果未勾选，抖动提示
        const section = document.getElementById('legalAgreementSection');
        section.classList.add('shake');
        setTimeout(() => section.classList.remove('shake'), 500);
        return;
      }
      
      // 记录协议同意时间
      const agreementRecord = {
        event: 'agreement_accepted',
        timestamp: new Date().toISOString(),
        agreement_version: '1.0',
        security_mode: selectedSecurity
      };
      // 进入完成页
      goToStep(5);
      showSummary();
    }
    
    // 显示协议弹窗
    function showLegalModal(type) {
      const overlay = document.getElementById('legalModalOverlay');
      const title = document.getElementById('legalModalTitle');
      const body = document.getElementById('legalModalBody');
      
      const contents = {
        userAgreement: {
          title: '用户服务协议',
          content: \`
            <h4>第一条 总则</h4>
            <p>欢迎使用本软件。本软件基于开源项目二次开发，以社区方式维护。使用本软件即表示您已阅读、理解并同意本协议全部条款。</p>

            <h4>第二条 软件性质</h4>
            <p>本软件为通用 AI 交互工具，提供与第三方大语言模型交互的技术通道。</p>
            <ul>
              <li>本软件不直接提供任何 AI 模型服务</li>
              <li>所有 AI 内容由您所选择的第三方服务提供商生成</li>
              <li>本软件不对 AI 生成内容的准确性、合法性承担任何责任</li>
              <li>技能市场中的技能由第三方开发者独立提供，与本软件无关</li>
            </ul>

            <h4>第三条 用户义务</h4>
            <ul>
              <li>遵守用户所在地区的相关法律法规</li>
              <li>不利用本软件从事任何违法活动</li>
              <li>未经目标方授权，不得使用本软件进行自动化数据抓取或爬虫操作</li>
              <li>用户对自己的全部使用行为独立承担法律责任</li>
            </ul>

            <h4>第四条 免责声明</h4>
            <p>AI 内容可能不准确、有偏见或不当，用户应自行核验。本软件不承担因使用 AI 输出、第三方技能或用户自身行为导致的任何损失。</p>

            <h4>第五条 责任限制</h4>
            <p>在适用法律允许的最大范围内，本软件不承担任何间接、附带或后果性损害赔偿责任。如软件免费使用，则赔偿上限为零元。</p>

            <h4>第六条 争议解决</h4>
            <p>本软件以社区方式维护，不设集中运营主体。因使用本软件产生的任何争议，由用户依据其所在地适用法律自行解决。</p>
          \`
        },
        privacyPolicy: {
          title: '隐私政策',
          content: \`
            <h4>一、信息收集</h4>
            <p>本软件仅收集以下必要信息：</p>
            <ul>
              <li>设备标识信息（用于授权验证）</li>
              <li>匿名化软件使用统计（用于产品改进）</li>
              <li>协议同意时间戳（用于合规存证）</li>
            </ul>
            <p><strong>本软件不收集</strong>您的真实姓名、身份证号、银行卡等敏感信息，不存储您的对话记录（仅保存在本地）。</p>

            <h4>二、数据传输</h4>
            <p>您的对话内容将传输至您所选择的第三方 AI 服务提供商处理，这是服务运行的技术必要条件。<strong>选择境外 AI 服务即意味着您的数据将传输至境外服务器，请自行评估合规风险。</strong></p>

            <h4>三、数据采集类技能</h4>
            <p>用户通过本软件集成的数据采集类技能所采集的任何第三方数据，完全由用户本地设备处理和存储。<strong>本软件的服务器不接收、不处理、不存储</strong>用户采集的任何第三方数据。</p>

            <h4>四、信息共享</h4>
            <p>除法律法规强制要求外，本软件不会将您的个人信息出售或共享给任何第三方。</p>

            <h4>五、用户权利</h4>
            <p>您有权通过软件内反馈渠道申请查询、更正或删除您的个人信息。本软件将在条件允许的情况下予以响应。</p>
          \`
        },
        riskDisclosure: {
          title: '⚠️ AI 服务风险告知',
          content: \`
            <h4>请仔细阅读以下风险说明</h4>
            
            <p><strong>1. 内容准确性风险</strong></p>
            <p>AI 模型可能生成不准确、虚假或误导性的信息。请勿将 AI 输出作为唯一的决策依据。</p>
            
            <p><strong>2. 不适用于重要决策</strong></p>
            <p>请勿将 AI 输出用于医疗诊断、法律咨询、财务投资等重要决策。这些领域应咨询专业人士。</p>
            
            <p><strong>3. 数据传输风险</strong></p>
            <p>您的输入内容将传输至第三方 AI 服务商进行处理。请勿输入敏感的个人信息、商业机密或其他隐私数据。</p>
            
            <p><strong>4. 安全攻击风险</strong></p>
            <p>AI 模型可能受到"提示词注入"等攻击，产生非预期输出。特别是在"放开模式"下，此风险更高。</p>
            
            <p><strong>5. 安全模式说明</strong></p>
            <ul>
              <li>🛡️ <strong>绝对安全模式</strong>：AI 无法操作您的电脑，仅限对话</li>
              <li>⚡ <strong>智能模式</strong>：AI 可在沙盒内有限操作，推荐使用</li>
              <li>⚠️ <strong>放开模式</strong>：安全限制最低，风险自担</li>
            </ul>
            
            <p style="margin-top: 20px; padding: 12px; background: rgba(239, 68, 68, 0.1); border-radius: 8px; color: var(--accent-red);">
              <strong>重要提示：</strong>使用本软件即表示您已了解并接受上述风险。
            </p>
          \`
        }
      };
      
      const content = contents[type];
      if (content) {
        title.textContent = content.title;
        body.innerHTML = content.content;
        overlay.classList.remove('hidden');
      }
    }
    
    // 关闭协议弹窗
    function closeLegalModal() {
      document.getElementById('legalModalOverlay').classList.add('hidden');
    }

    // ==================== Step 5: 完成 ====================
    function showSummary() {
      document.getElementById('summaryProvider').textContent = providerNames[selectedProvider] || selectedProvider;
      document.getElementById('summarySecurity').textContent = securityModeNames[selectedSecurity];
      
      // 获取工作目录路径（在外部定义以便后续使用）
      const workspacePath = document.getElementById('workspaceInput').value || '';
      
      // 只有 standard（智能模式）才显示工作目录
      const tipWorkspaceFiles = document.getElementById('tipWorkspaceFiles');
      if (selectedSecurity === 'standard') {
        document.getElementById('summaryWorkspace').textContent = workspacePath || '未设置';
        document.getElementById('summaryWorkspaceRow').classList.remove('hidden');
        if (tipWorkspaceFiles) tipWorkspaceFiles.classList.remove('hidden');
        
        // 有额外信任目录时才显示
        if (trustedDirs.length > 0) {
          document.getElementById('summaryTrustedDirsRow').classList.remove('hidden');
          document.getElementById('summaryTrustedDirs').textContent = trustedDirs.length + ' 个目录';
        }
        
        // 更新平台提示中的工作目录路径
        const platformTipsList = document.getElementById('platformTipsList');
        if (platformTipsList && workspacePath) {
          platformTipsList.innerHTML = platformTipsList.innerHTML.replace(
            /工作目录位于: <code>[^<]+<\\/code>/g,
            '工作目录位于: <code>' + workspacePath.replace(/\\\\/g, '\\\\\\\\') + '</code>'
          );
        }
      } else {
        // 非 standard 模式，隐藏工作目录相关信息
        document.getElementById('summaryWorkspaceRow').classList.add('hidden');
        document.getElementById('summaryTrustedDirsRow').classList.add('hidden');
        if (tipWorkspaceFiles) tipWorkspaceFiles.classList.add('hidden');
        
        // 移除平台提示中的工作目录提示（完全信任/只聊天模式不需要工作目录）
        const platformTipsList = document.getElementById('platformTipsList');
        if (platformTipsList) {
          const workspaceLi = platformTipsList.querySelector('li');
          // 查找并移除包含"工作目录位于"的 li 元素
          Array.from(platformTipsList.querySelectorAll('li')).forEach(li => {
            if (li.textContent.includes('工作目录位于')) {
              li.remove();
            }
          });
        }
      }
      
      const channelsText = selectedChannels.length > 0 
        ? selectedChannels.map(c => channelNames[c] || c).join('、')
        : '暂未配置';
      document.getElementById('summaryChannels').textContent = channelsText;
      
      if (licenseExpires) {
        const expDate = new Date(licenseExpires);
        document.getElementById('summaryLicense').innerHTML = '已激活 <span style="color: var(--text-muted); font-size: 0.85em;">(有效期至 ' + expDate.toLocaleDateString('zh-CN') + ')</span>';
      }
    }

    // 测试 AI 连接
    async function testAIConnection() {
      const btn = document.getElementById('testConnectionBtn');
      const statusEl = document.getElementById('testConnectionStatus');
      
      btn.disabled = true;
      btn.innerHTML = '<span class="status-spinner"></span> 测试中...';
      showStatus('testConnectionStatus', '正在测试 AI 连接...', 'loading');
      
      try {
        // 调用健康检查 API
        const res = await fetch('/api/health', {
          method: 'GET',
          signal: AbortSignal.timeout(30000) // 30秒超时
        });
        const data = await res.json();
        
        if (data.ok && data.data?.aiReady) {
          // AI 连接成功
          statusEl.innerHTML = '<div class="test-connection-result success">' +
            '<div class="result-icon">✅</div>' +
            '<div class="result-message">AI 连接成功！</div>' +
            '<div class="result-detail">AI 服务已就绪，可以开始使用了</div>' +
            '</div>';
          statusEl.className = 'status-message';
        } else if (data.ok) {
          // 部分成功
          statusEl.innerHTML = '<div class="test-connection-result success">' +
            '<div class="result-icon">⚠️</div>' +
            '<div class="result-message">服务已启动</div>' +
            '<div class="result-detail">Gateway 正常运行，AI 服务状态待验证</div>' +
            '</div>';
          statusEl.className = 'status-message';
        } else {
          throw new Error(data.error || '连接失败');
        }
      } catch (e) {
        // 尝试发送一条简单的测试消息
        try {
          const testRes = await fetch('/api/chat/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: '你好，请回复 OK' }),
            signal: AbortSignal.timeout(30000)
          });
          const testData = await testRes.json();
          
          if (testData.ok) {
            statusEl.innerHTML = '<div class="test-connection-result success">' +
              '<div class="result-icon">✅</div>' +
              '<div class="result-message">AI 连接成功！</div>' +
              '<div class="result-detail">AI 响应正常</div>' +
              '</div>';
            statusEl.className = 'status-message';
          } else {
            throw new Error(testData.error || '测试失败');
          }
        } catch (testErr) {
          // 显示错误
          const errorMsg = e.message || testErr.message || '未知错误';
          statusEl.innerHTML = '<div class="test-connection-result error">' +
            '<div class="result-icon">❌</div>' +
            '<div class="result-message">连接失败</div>' +
            '<div class="result-detail">' + errorMsg + '</div>' +
            '<div style="margin-top: 12px; font-size: 0.85em; color: var(--text-muted);">' +
            '可能原因：API Key 无效、网络问题、服务未启动<br>' +
            '建议：检查配置后重试，或直接开始使用' +
            '</div>' +
            '</div>';
          statusEl.className = 'status-message';
        }
      }
      
      btn.disabled = false;
      btn.innerHTML = '<span class="material-icons">science</span> 重新测试';
    }

    async function launchOpenClawCN() {
      const btn = document.getElementById('launchButton');
      
      btn.disabled = true;
      btn.innerHTML = '<span class="status-spinner"></span> 正在启动...';
      showStatus('launchStatus', '正在保存配置...', 'loading');
      
      // 获取当前的 gateway token（从页面注入的变量）
      // 若 token 为空，说明 gateway 未配置鉴权，直接跳转（不拼接 token）
      const gatewayToken = window.__GATEWAY_TOKEN__;
      // 构建带 token 的跳转 URL（URL fragment，不会出现在服务器日志中）
      const buildRedirectUrl = () => {
        var port = window.location.port || '19002';
        var gwUrl = 'ws://127.0.0.1:' + port;
        // 只在有 token 时才拼接，避免 "#token=undefined"
        var hash = gatewayToken
          ? '#token=' + encodeURIComponent(gatewayToken) + '&gatewayUrl=' + encodeURIComponent(gwUrl)
          : '#gatewayUrl=' + encodeURIComponent(gwUrl);
        // 始终跳到 gateway HTTP 地址（当前 origin = 127.0.0.1:PORT）。
        // 不能跳 tauri.localhost：
        //   1) tauri.localhost 是 Tauri 内嵌的 stale 前端（构建时快照）
        //   2) 不同 origin 的 localStorage 导致 device token mismatch (1008)
        //   3) Tauri main.rs poll_and_navigate 也是跳 127.0.0.1:PORT
        return window.location.origin + '/' + hash;
      };
      
      // 保存配置（无需重启 Gateway）
      // 渠道插件默认启用，channels.* 配置变更可以动态读取并热更新
      try {
        const res = await fetch('/api/setup/complete', { method: 'POST' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || '保存失败');
        }
      } catch (e) {
        showStatus('launchStatus', '保存配置失败: ' + (e.message || e), 'error');
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons">rocket_launch</span> 重试';
        return;
      }
      
      // 配置保存成功，直接跳转到聊天页面
      showStatus('launchStatus', '✓ 配置完成！正在进入...', 'success');
      await delay(800);
      
      const redirectUrl = buildRedirectUrl();
      window.location.href = redirectUrl;
    }

    // ==================== 工具函数 ====================
    function showStatus(elementId, message, type) {
      const el = document.getElementById(elementId);
      if (!el) return;
      el.className = 'status-message show ' + type;
      if (type === 'loading') {
        el.innerHTML = '<span class="status-spinner"></span> ' + message;
      } else {
        el.textContent = message;
      }
    }

    function delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ==================== 跳过配置直接进入 ====================
    function skipToChat() {
      var token = window.__GATEWAY_TOKEN__ || new URLSearchParams(window.location.search).get('token') || '';
      var port = window.location.port || '19002';
      var gwUrl = 'ws://127.0.0.1:' + port;
      var hash = '#token=' + encodeURIComponent(token) + '&gatewayUrl=' + encodeURIComponent(gwUrl);
      // 始终跳到 gateway HTTP 地址（当前 origin），不跳 tauri.localhost（见 buildRedirectUrl 注释）
      window.location.href = window.location.origin + '/' + hash;
    }

    // ==================== 初始化 ====================
    window.trustModeConfirmed = false;
    renderTrustedDirs();
    
    // 检测是否有历史配置
    (function() {
      const urlParams = new URLSearchParams(window.location.search);
      const hasHistory = urlParams.get('hasHistory') === '1';
      const page0 = document.getElementById('page0');
      const page1 = document.getElementById('page1');

      if (hasHistory) {
        // 显示欢迎回来页面
        if (page0) page0.classList.remove('hidden');
        if (page1) page1.classList.add('hidden');
      } else {
        // 正常显示 Step 1
        if (page0) page0.classList.add('hidden');
        if (page1) page1.classList.remove('hidden');
      }
    })();

    // ── Tauri WebView2 外部链接修复 ──────────────────────────────────
    // WebView2 在 http://127.0.0.1 origin 下，target="_blank" 和 window.open
    // 都无法触发 Tauri 的 on_new_window 回调。改为通过 gateway API 在服务端打开。
    document.addEventListener('click', function(e) {
      var link = e.target.closest('a[href]');
      if (!link) return;
      var href = link.getAttribute('href');
      if (!href) return;
      try {
        var u = new URL(href, window.location.origin);
        if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') return;
        if (u.protocol === 'http:' || u.protocol === 'https:') {
          e.preventDefault();
          e.stopPropagation();
          fetch('/api/open-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: href })
          }).catch(function(){});
        }
      } catch(_) {}
    }, true);

  </script>
`;
}
