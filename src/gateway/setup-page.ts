/**
 * Setup Page HTML Generator
 * ClawbotCN 安装向导页面 - 基于 Stitch 设计风格 + PRD 内容
 */

import type { ServerResponse } from "node:http";
import { CN_PROVIDERS } from "../config/region-cn.js";
import { isOverseas } from "../config/edition.js";
import {
  getLogoBase64,
  getSetupQrcodeBase64,
  detectPlatformInfo,
  getDefaultWorkspace,
  getPlatformTips,
} from "./setup-page-utils.js";
import { renderBodyContent, renderScriptContent } from "./setup-page-components.js";
import type { SetupPageContext } from "./setup-page-components.js";

/**
 * 生成 Setup 页面 HTML - 严格按照 PRD 文档
 * @param gatewayToken - 当前 gateway token，用于跳转时携带
 */
export function generateSetupPageHtml(gatewayToken?: string): string {
  const providers = Object.values(CN_PROVIDERS);
  const platformInfo = detectPlatformInfo();
  const defaultWorkspace = getDefaultWorkspace();
  const logoBase64 = getLogoBase64();
  const setupQrcodeBase64 = getSetupQrcodeBase64();
  // 将 token 注入到页面中，供 JavaScript 使用
  // 防止 </script> 注入：将 </ 转义为 <\/ 避免提前关闭 script 标签
  const safeToken = gatewayToken ? JSON.stringify(gatewayToken).replace(/<\//g, "<\\/") : "null";
  const isDesktopMode = process.env.OPENCLAWCN_DESKTOP_MODE === "1";
  const tokenScript = `<script>window.__GATEWAY_TOKEN__ = ${safeToken};window.__DESKTOP_MODE__ = ${isDesktopMode ? "true" : "false"};</script>`;

  const ctx: SetupPageContext = {
    logoBase64,
    setupQrcodeBase64,
    platformInfo,
    defaultWorkspace,
    providers,
  };

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isOverseas ? "AI Assistant Setup" : "ClawbotCN 安装向导"}</title>
  ${tokenScript}
  <link rel="preconnect" href="https://fonts.loli.net">
  <link rel="preconnect" href="https://gstatic.loli.net" crossorigin>
  <link href="https://fonts.loli.net/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://fonts.loli.net/icon?family=Material+Icons" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #0f0f11;
      --bg-secondary: #18181b;
      --bg-tertiary: #1f1f23;
      --bg-elevated: #27272a;
      --bg-hover: #2d2d32;
      --border-default: rgba(255, 255, 255, 0.08);
      --border-subtle: rgba(255, 255, 255, 0.05);
      --border-accent: rgba(60, 131, 246, 0.4);
      --text-primary: #fafafa;
      --text-secondary: #a1a1aa;
      --text-muted: #71717a;
      --accent-blue: #3c83f6;
      --accent-blue-light: #60a5fa;
      --accent-blue-dark: #2563eb;
      --accent-green: #22c55e;
      --accent-green-light: #4ade80;
      --accent-yellow: #eab308;
      --accent-orange: #f97316;
      --accent-red: #ef4444;
      --gradient-blue: linear-gradient(135deg, #3c83f6 0%, #60a5fa 100%);
      --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
      --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
      --shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.5);
      --shadow-glow: 0 0 20px rgba(60, 131, 246, 0.3);
      --radius-sm: 6px;
      --radius-md: 8px;
      --radius-lg: 12px;
      --radius-xl: 16px;
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      --font-mono: 'JetBrains Mono', 'SF Mono', 'Consolas', monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideInRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes checkmark { 0% { stroke-dashoffset: 100; } 100% { stroke-dashoffset: 0; } }
    @keyframes scaleIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @keyframes confetti {
      0% { transform: translateY(0) rotate(0deg); opacity: 1; }
      100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
    }
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    @keyframes shimmer {
      0% { background-position: -200% center; }
      100% { background-position: 200% center; }
    }

    body {
      font-family: var(--font-sans);
      background: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      overflow-x: hidden;
    }

    /* 顶部导航栏 */
    .header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 64px;
      background: rgba(15, 15, 17, 0.8);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border-default);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 32px;
      z-index: 100;
    }
    .header-logo {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 600;
      font-size: 1.1em;
    }
    .header-logo svg,
    .header-logo img {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      object-fit: cover;
    }
    .header-env {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--bg-tertiary);
      padding: 8px 16px;
      border-radius: var(--radius-md);
      font-size: 0.85em;
      color: var(--text-secondary);
    }
    .header-env .icon { font-size: 1.2em; }

    /* 主容器 */
    .main-container {
      max-width: 1100px;
      margin: 0 auto;
      padding: 100px 24px 60px;
      animation: fadeIn 0.4s ease-out;
    }

    /* 步骤进度条 */
    .stepper {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0;
      margin-bottom: 48px;
      padding: 0 20px;
    }
    .step-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
    }
    .step-circle {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--bg-tertiary);
      border: 2px solid var(--border-default);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.9em;
      color: var(--text-muted);
      transition: all 0.3s ease;
      position: relative;
      z-index: 2;
    }
    .step-circle .material-icons { font-size: 18px; }
    .step-item.active .step-circle {
      background: var(--accent-blue);
      border-color: var(--accent-blue);
      color: white;
      box-shadow: var(--shadow-glow);
    }
    .step-item.completed .step-circle {
      background: var(--accent-green);
      border-color: var(--accent-green);
      color: white;
    }
    .step-label {
      margin-top: 8px;
      font-size: 0.75em;
      color: var(--text-muted);
      text-align: center;
      max-width: 80px;
    }
    .step-item.active .step-label { color: var(--accent-blue); font-weight: 500; }
    .step-item.completed .step-label { color: var(--accent-green); }
    .step-connector {
      width: 60px;
      height: 2px;
      background: var(--border-default);
      margin: 0 8px;
      margin-bottom: 28px;
      position: relative;
    }
    .step-connector::after {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      height: 100%;
      width: 0;
      background: var(--accent-green);
      transition: width 0.4s ease;
    }
    .step-connector.completed::after { width: 100%; }

    /* 卡片容器 */
    .card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-xl);
      padding: 32px;
      margin-bottom: 24px;
      animation: fadeInUp 0.4s ease-out;
      position: relative;
    }
    .card-header {
      margin-bottom: 24px;
    }
    .card-header h2 {
      font-size: 1.5em;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--text-primary);
    }
    .card-header p {
      color: var(--text-secondary);
      font-size: 0.95em;
    }

    /* 右上角悬浮二维码卡片 */
    .qr-corner {
      position: absolute;
      top: 20px;
      right: 20px;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 16px;
      border-radius: 14px;
      border: 1.5px solid rgba(255, 185, 15, 0.30);
      background: linear-gradient(135deg, rgba(255, 185, 15, 0.10) 0%, rgba(218, 165, 32, 0.04) 100%);
      backdrop-filter: blur(12px);
      cursor: pointer;
      transition: border-color 0.3s, box-shadow 0.3s, transform 0.3s;
      animation: qrBreathe 3s ease-in-out infinite;
    }
    .qr-corner:hover {
      border-color: rgba(255, 185, 15, 0.70);
      box-shadow: 0 4px 30px rgba(255, 185, 15, 0.20), 0 0 40px rgba(255, 185, 15, 0.08);
      transform: translateY(-2px);
      animation: none;
    }
    @keyframes qrBreathe {
      0%, 100% {
        border-color: rgba(255, 185, 15, 0.25);
        box-shadow: 0 2px 12px rgba(255, 185, 15, 0.06);
      }
      50% {
        border-color: rgba(255, 185, 15, 0.55);
        box-shadow: 0 4px 20px rgba(255, 185, 15, 0.15), 0 0 24px rgba(255, 185, 15, 0.06);
      }
    }
    .qr-corner-info {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .qr-corner-title {
      font-size: 0.88em;
      font-weight: 700;
      color: #F5A623;
      white-space: nowrap;
    }
    .qr-corner-tags {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .qr-corner-tag {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.72em;
      color: var(--text-secondary);
      white-space: nowrap;
    }
    .qr-corner-tag .material-icons {
      font-size: 14px;
      color: #F5A623;
    }
    .qr-corner-scan {
      font-size: 0.68em;
      color: var(--text-muted);
      margin-top: 2px;
    }
    .qr-corner-img {
      width: 120px;
      height: 120px;
      border-radius: 10px;
      overflow: hidden;
      background: transparent;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border: 2px solid rgba(255, 185, 15, 0.40);
      animation: qrImgGlow 3s ease-in-out infinite;
    }
    @keyframes qrImgGlow {
      0%, 100% {
        box-shadow: 0 0 8px rgba(255, 185, 15, 0.10), 0 0 0 rgba(255, 185, 15, 0);
        border-color: rgba(255, 185, 15, 0.35);
      }
      50% {
        box-shadow: 0 0 20px rgba(255, 185, 15, 0.25), 0 0 40px rgba(255, 185, 15, 0.08);
        border-color: rgba(255, 185, 15, 0.70);
      }
    }
    .qr-corner-img img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
      display: block;
      transform: scale(1.30);
    }
    @media (max-width: 700px) {
      .qr-corner { position: static; margin-bottom: 12px; padding: 10px 12px; }
      .qr-corner-img { width: 56px; height: 56px; }
      .qr-corner-title { font-size: 0.8em; }
      .qr-corner-tags { display: none; }
    }

    /* 提示框 */
    .alert {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      border-radius: var(--radius-md);
      margin-bottom: 20px;
      font-size: 0.9em;
    }
    .alert-icon { font-size: 1.2em; flex-shrink: 0; margin-top: 2px; }
    .alert-info {
      background: rgba(60, 131, 246, 0.1);
      border: 1px solid rgba(60, 131, 246, 0.2);
      color: var(--accent-blue-light);
    }
    .alert-warning {
      background: rgba(249, 115, 22, 0.1);
      border: 1px solid rgba(249, 115, 22, 0.2);
      color: var(--accent-orange);
    }
    .alert-success {
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.2);
      color: var(--accent-green);
    }
    .alert-error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      color: var(--accent-red);
    }
    .alert-content { flex: 1; }
    .alert-title { font-weight: 600; margin-bottom: 4px; }

    /* 折叠区域 */
    .collapsible {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      margin-bottom: 20px;
      overflow: hidden;
    }
    .collapsible-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      cursor: pointer;
      transition: background 0.2s ease;
    }
    .collapsible-header:hover { background: var(--bg-hover); }
    .collapsible-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
    }
    .collapsible-arrow {
      transition: transform 0.2s ease;
    }
    .collapsible.open .collapsible-arrow { transform: rotate(180deg); }
    .collapsible-content {
      padding: 0 16px 16px;
      color: var(--text-secondary);
      font-size: 0.9em;
      line-height: 1.7;
    }
    .collapsible:not(.open) .collapsible-content { display: none; }

    /* 选项卡片列表 */
    .option-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .option-card {
      background: var(--bg-tertiary);
      border: 2px solid var(--border-default);
      border-radius: var(--radius-lg);
      padding: 20px;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
    }
    .option-card:hover {
      border-color: var(--border-accent);
      background: var(--bg-hover);
    }
    .option-card.selected {
      border-color: var(--accent-blue);
      background: rgba(60, 131, 246, 0.08);
    }
    .option-card.disabled {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
    }
    .option-card-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    .option-icon {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-md);
      background: var(--bg-elevated);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.3em;
    }
    .option-card.selected .option-icon {
      background: var(--accent-blue);
    }
    .option-title {
      font-weight: 600;
      font-size: 1.05em;
    }
    .option-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: var(--accent-orange);
      color: white;
      padding: 2px 8px;
      border-radius: 20px;
      font-size: 0.7em;
      font-weight: 600;
      text-transform: uppercase;
      margin-left: 8px;
    }
    .option-badge.recommended {
      background: var(--accent-blue);
    }
    .option-badge.expert {
      background: var(--bg-elevated);
      color: var(--text-secondary);
    }
    .option-desc {
      color: var(--text-secondary);
      font-size: 0.9em;
      line-height: 1.6;
    }
    .option-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
      font-size: 0.85em;
      color: var(--text-muted);
    }
    .option-check {
      position: absolute;
      top: 16px;
      right: 16px;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--accent-blue);
      display: none;
      align-items: center;
      justify-content: center;
      color: white;
    }
    .option-card.selected .option-check { display: flex; }

    /* 网格布局的选项卡片 */
    .option-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }
    .option-grid .option-card {
      text-align: center;
      padding: 24px 16px;
    }
    .option-grid .option-icon {
      width: 48px;
      height: 48px;
      margin: 0 auto 12px;
      font-size: 1.5em;
    }
    .option-grid .option-title {
      margin-bottom: 4px;
    }
    .option-grid .option-desc {
      font-size: 0.85em;
    }

    /* ============================================
       Step 1 AI服务选择 - 优化版样式
       ============================================ */
    
    /* 小提示 */
    .provider-tip {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 20px;
      background: linear-gradient(135deg, rgba(60, 131, 246, 0.12) 0%, rgba(60, 131, 246, 0.04) 100%);
      border: 1px solid rgba(60, 131, 246, 0.25);
      border-radius: var(--radius-lg);
      margin-bottom: 24px;
      color: var(--accent-blue-light);
      font-size: 0.95em;
    }
    .provider-tip-icon {
      font-size: 1.3em;
    }

    /* 推荐服务商区域 */
    .provider-recommended-section {
      margin-bottom: 20px;
    }
    .provider-section-title {
      font-size: 0.9em;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 16px;
      letter-spacing: 0.5px;
    }
    .provider-recommended-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }
    @media (max-width: 1100px) {
      .provider-recommended-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    @media (max-width: 600px) {
      .provider-recommended-grid {
        grid-template-columns: 1fr;
      }
    }

    /* 推荐服务商卡片 */
    .provider-card {
      background: var(--bg-tertiary);
      border: 2px solid var(--border-default);
      border-radius: var(--radius-xl);
      padding: 16px;
      cursor: pointer;
      transition: all 0.25s ease;
      position: relative;
      text-align: center;
      display: flex;
      flex-direction: column;
      min-height: 200px;
    }
    .provider-card-desc {
      flex: 1;
    }
    .provider-card:hover {
      border-color: var(--border-accent);
      background: var(--bg-hover);
      transform: translateY(-2px);
    }
    .provider-card.selected {
      border-color: var(--accent-blue);
      background: linear-gradient(135deg, rgba(60, 131, 246, 0.12) 0%, rgba(60, 131, 246, 0.04) 100%);
      box-shadow: 0 0 20px rgba(60, 131, 246, 0.15);
    }
    .provider-card.featured {
      border-color: var(--accent-blue);
    }
    .provider-card-badge {
      position: absolute;
      top: -10px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #3c83f6 0%, #60a5fa 100%);
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.75em;
      font-weight: 600;
      white-space: nowrap;
    }
    .provider-card-icon {
      font-size: 2em;
      margin-bottom: 8px;
    }
    .provider-card-name {
      font-size: 1.05em;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .provider-card-desc {
      font-size: 0.85em;
      color: var(--text-secondary);
      line-height: 1.5;
      margin-bottom: 12px;
    }
    .provider-card-link {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      font-size: 0.85em;
      font-weight: 600;
      color: #1a1a1a;
      text-decoration: none;
      padding: 10px 12px;
      background: linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%);
      border-radius: var(--radius-md);
      transition: all 0.3s ease;
      box-shadow: 0 2px 8px rgba(255, 165, 0, 0.3);
      margin-top: 8px;
    }
    .provider-card-link:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(255, 165, 0, 0.5);
      background: linear-gradient(135deg, #FFE44D 0%, #FFB833 50%, #FFA000 100%);
    }
    .provider-card-link .material-icons {
      font-size: 1.1em;
    }
    .provider-card-check {
      position: absolute;
      top: 12px;
      right: 12px;
      opacity: 0;
      transition: all 0.2s ease;
    }
    .provider-card-check .material-icons {
      font-size: 24px;
      color: var(--accent-blue);
    }
    .provider-card.selected .provider-card-check {
      opacity: 1;
    }

    /* 其他服务商折叠区域 */
    .provider-other-section {
      margin-bottom: 24px;
    }
    .provider-other-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      cursor: pointer;
      color: var(--text-secondary);
      font-size: 0.95em;
      transition: all 0.2s ease;
    }
    .provider-other-toggle:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }
    .provider-other-toggle .material-icons {
      transition: transform 0.2s ease;
    }
    .provider-other-toggle.open .material-icons {
      transform: rotate(180deg);
    }
    .provider-other-content {
      margin-top: 12px;
    }
    .provider-section-subtitle {
      font-size: 0.9em;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .provider-section-note {
      font-weight: 400;
      font-size: 0.85em;
      color: var(--text-muted);
    }
    .provider-other-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    @media (max-width: 600px) {
      .provider-other-grid {
        grid-template-columns: 1fr;
      }
    }
    .provider-option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      background: var(--bg-tertiary);
      border: 2px solid var(--border-default);
      border-radius: var(--radius-lg);
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .provider-option:hover {
      border-color: var(--border-accent);
      background: var(--bg-hover);
    }
    .provider-option.selected {
      border-color: var(--accent-blue);
      background: rgba(60, 131, 246, 0.08);
    }
    .provider-option-icon {
      font-size: 1.5em;
    }
    .provider-option-info {
      flex: 1;
    }
    .provider-option-name {
      font-weight: 600;
      font-size: 0.95em;
    }
    .provider-option-desc {
      font-size: 0.8em;
      color: var(--text-secondary);
      margin-top: 2px;
    }
    .provider-option-check {
      opacity: 0;
      transition: all 0.2s ease;
    }
    .provider-option-check .material-icons {
      font-size: 20px;
      color: var(--accent-blue);
    }
    .provider-option.selected .provider-option-check {
      opacity: 1;
    }
    .provider-option-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.75em;
      font-weight: 600;
      color: #1a1a1a;
      text-decoration: none;
      padding: 4px 10px;
      background: linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%);
      border-radius: 6px;
      transition: all 0.2s ease;
      box-shadow: 0 1px 4px rgba(255, 165, 0, 0.25);
      margin-top: 4px;
      white-space: nowrap;
    }
    .provider-option-link:hover {
      transform: translateY(-1px);
      box-shadow: 0 3px 10px rgba(255, 165, 0, 0.4);
      background: linear-gradient(135deg, #FFE44D 0%, #FFB833 50%, #FFA000 100%);
    }
    .provider-option-link .material-icons {
      font-size: 14px;
    }

    /* API Key 输入区域优化 */
    .apikey-section {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      padding: 20px;
      margin-bottom: 16px;
    }
    .apikey-header {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 600;
      font-size: 1.05em;
      margin-bottom: 12px;
      color: var(--text-primary);
    }
    .apikey-header-icon {
      font-size: 1.2em;
    }
    .apikey-header-hint {
      font-size: 0.8em;
      font-weight: 400;
      color: var(--accent-orange);
      margin-left: auto;
    }
    .apikey-input-wrapper {
      display: flex;
      gap: 8px;
    }
    .apikey-input {
      flex: 1;
      padding: 12px 16px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      font-family: var(--font-mono);
      font-size: 0.95em;
    }
    .apikey-input:focus {
      outline: none;
      border-color: var(--accent-blue);
    }
    .apikey-toggle-btn {
      padding: 12px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .apikey-toggle-btn:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }
    
    /* 服务商常见问题提示 */
    .provider-faq-tip {
      margin-top: 16px;
      background: linear-gradient(135deg, #fff4e5 0%, #fffbf0 100%);
      border: 2px solid #ffb020;
      border-radius: var(--radius-lg);
      padding: 16px;
      animation: faqTipPulse 2s ease-in-out infinite;
    }
    @keyframes faqTipPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(255, 176, 32, 0.4); }
      50% { box-shadow: 0 0 12px 4px rgba(255, 176, 32, 0.2); }
    }
    .provider-faq-tip-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      font-size: 1em;
      color: #d97706;
      margin-bottom: 12px;
    }
    .provider-faq-tip-header .material-icons {
      font-size: 1.4em;
      color: #f59e0b;
    }
    .provider-faq-tip-content {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .provider-faq-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 0.92em;
      color: #92400e;
      line-height: 1.5;
    }
    .provider-faq-icon {
      flex-shrink: 0;
      font-size: 1em;
    }
    .provider-faq-item a {
      color: #2563eb;
      text-decoration: underline;
      font-weight: 500;
    }
    .provider-faq-item a:hover {
      color: #1d4ed8;
    }
    .provider-faq-item strong {
      color: #78350f;
    }
    /* 暗色模式适配 */
    @media (prefers-color-scheme: dark) {
      .provider-faq-tip {
        background: linear-gradient(135deg, #422006 0%, #292524 100%);
        border-color: #d97706;
      }
      .provider-faq-tip-header {
        color: #fbbf24;
      }
      .provider-faq-tip-header .material-icons {
        color: #fbbf24;
      }
      .provider-faq-item {
        color: #fcd34d;
      }
      .provider-faq-item strong {
        color: #fef3c7;
      }
      .provider-faq-item a {
        color: #93c5fd;
      }
      .provider-faq-item a:hover {
        color: #bfdbfe;
      }
    }

    /* 模型选择简化 */
    .model-section {
      margin-top: 16px;
    }
    .model-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      font-weight: 500;
    }
    .model-hint {
      font-size: 0.85em;
      color: var(--text-muted);
      font-weight: 400;
    }
    /* Model Combobox 容器 */
    .model-combobox {
      position: relative;
      width: 100%;
    }
    .model-select {
      width: 100%;
      padding: 12px 16px;
      padding-right: 40px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      font-size: 0.95em;
      cursor: text;
      box-sizing: border-box;
    }
    .model-select:focus {
      outline: none;
      border-color: var(--accent-blue);
    }
    .model-editable-tag {
      position: absolute;
      right: 40px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 12px;
      color: var(--accent-blue);
      background: rgba(59, 130, 246, 0.1);
      padding: 2px 8px;
      border-radius: 4px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s ease;
      white-space: nowrap;
    }
    .model-editable-tag.visible {
      opacity: 1;
    }
    .model-combobox.open .model-editable-tag {
      opacity: 0;
    }
    .model-combobox-arrow {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      color: var(--text-muted);
      font-size: 20px;
      transition: transform 0.2s ease;
    }
    .model-combobox.open .model-combobox-arrow {
      transform: translateY(-50%) rotate(180deg);
    }
    /* 下拉列表 */
    .model-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      max-height: 280px;
      overflow-y: auto;
      background: var(--bg-secondary);
      border: 1px solid var(--accent-blue);
      border-top: none;
      border-radius: 0 0 var(--radius-md) var(--radius-md);
      z-index: 1000;
      display: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    .model-combobox.open .model-dropdown {
      display: block;
    }
    .model-combobox.open .model-select {
      border-radius: var(--radius-md) var(--radius-md) 0 0;
      border-color: var(--accent-blue);
    }
    .model-option {
      padding: 10px 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      border-bottom: 1px solid var(--border-default);
      transition: background 0.15s ease;
    }
    .model-option:last-child {
      border-bottom: none;
    }
    .model-option:hover,
    .model-option.highlighted {
      background: var(--bg-tertiary);
    }
    .model-option.selected {
      background: rgba(59, 130, 246, 0.1);
    }
    .model-option-name {
      font-weight: 500;
      color: var(--text-primary);
    }
    .model-option-desc {
      font-size: 0.85em;
      color: var(--text-muted);
      margin-left: 8px;
    }
    .model-option-badge {
      font-size: 0.75em;
      padding: 2px 8px;
      border-radius: 10px;
      background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);
      color: white;
      font-weight: 500;
      white-space: nowrap;
    }
    .model-option-badge.free {
      background: linear-gradient(135deg, #22c55e 0%, #4ade80 100%);
    }
    .model-dropdown-empty {
      padding: 16px;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.9em;
    }
    .model-dropdown-hint {
      padding: 8px 16px;
      font-size: 0.8em;
      color: var(--text-muted);
      background: var(--bg-tertiary);
      border-bottom: 1px solid var(--border-default);
    }
    /* 自定义模型选项样式 */
    .model-option-custom {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(59, 130, 246, 0.02) 100%);
      border-left: 3px solid var(--accent-blue);
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .model-option-custom:hover,
    .model-option-custom.highlighted {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%);
    }
    .model-option-custom-icon {
      font-size: 1.1em;
    }
    .model-option-custom-text {
      font-size: 0.9em;
      color: var(--text-secondary);
    }
    .model-option-custom-text strong {
      color: var(--accent-blue);
      font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
    }
    .model-dropdown-divider {
      height: 1px;
      background: var(--border-default);
      margin: 0;
    }
    /* 模型输入提示 */
    .model-input-hint {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
      padding: 8px 12px;
      font-size: 12px;
      color: var(--text-muted);
      background: rgba(59, 130, 246, 0.06);
      border-radius: var(--radius-sm);
      border-left: 3px solid var(--accent-blue);
    }
    .model-input-hint-icon {
      font-size: 14px;
    }
    .model-input-hint code {
      background: rgba(0, 0, 0, 0.15);
      padding: 1px 5px;
      border-radius: 3px;
      font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
      font-size: 11px;
      color: var(--accent-blue);
    }
    .provider-grid .option-check {
      top: 12px;
      right: 12px;
      width: 20px;
      height: 20px;
    }

    /* 首选推荐高亮 */
    .option-card.featured {
      border: 2px solid var(--accent-orange);
      background: linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, rgba(249, 115, 22, 0.02) 100%);
      position: relative;
    }
    .option-card.featured::before {
      content: '⭐ 首选推荐';
      position: absolute;
      top: -10px;
      left: 12px;
      background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);
      color: white;
      padding: 2px 10px;
      border-radius: 10px;
      font-size: 0.7em;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(249, 115, 22, 0.4);
    }
    .option-card.featured:hover {
      border-color: var(--accent-orange);
      box-shadow: 0 0 20px rgba(249, 115, 22, 0.3);
    }
    .option-card.featured.selected {
      border-color: var(--accent-orange);
      background: rgba(249, 115, 22, 0.12);
    }

    /* 推荐徽章样式增强 */
    .option-badge.hot {
      background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);
      animation: pulse 2s ease-in-out infinite;
    }
    .option-badge.free {
      background: linear-gradient(135deg, #22c55e 0%, #4ade80 100%);
    }

    /* 推广链接区域增强 */
    .affiliate-section {
      margin-top: 28px;
      padding-top: 24px;
      border-top: 1px solid var(--border-default);
    }
    .affiliate-header {
      font-size: 1.1em;
      font-weight: 600;
      color: var(--accent-orange);
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .affiliate-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 12px;
    }
    .affiliate-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      text-decoration: none;
      color: var(--text-primary);
      transition: all 0.2s ease;
    }
    .affiliate-card:hover {
      border-color: var(--accent-blue);
      background: var(--bg-hover);
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }
    .affiliate-card.featured {
      border: 2px solid var(--accent-orange);
      background: linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(249, 115, 22, 0.02) 100%);
    }
    .affiliate-card.featured:hover {
      border-color: var(--accent-orange);
      box-shadow: 0 4px 20px rgba(249, 115, 22, 0.3);
    }
    .affiliate-icon {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-sm);
      background: rgba(60, 131, 246, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2em;
      flex-shrink: 0;
    }
    .affiliate-card.featured .affiliate-icon {
      background: rgba(249, 115, 22, 0.15);
    }
    .affiliate-info {
      flex: 1;
      min-width: 0;
    }
    .affiliate-name {
      font-weight: 600;
      font-size: 0.95em;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .affiliate-name .badge {
      font-size: 0.65em;
      padding: 2px 6px;
      border-radius: 8px;
      font-weight: 600;
    }
    .affiliate-name .badge.hot {
      background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);
      color: white;
    }
    .affiliate-name .badge.free {
      background: linear-gradient(135deg, #22c55e 0%, #4ade80 100%);
      color: white;
    }
    .affiliate-benefit {
      font-size: 0.8em;
      color: var(--text-muted);
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .affiliate-arrow {
      color: var(--text-muted);
      font-size: 18px;
    }

    /* 模型选择器 */
    .model-select-wrapper {
      position: relative;
    }
    .model-select {
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      background-size: 18px;
      padding-right: 40px;
      cursor: pointer;
    }
    .model-select option {
      background: var(--bg-secondary);
      color: var(--text-primary);
      padding: 12px;
    }
    .model-select option.recommended {
      font-weight: 600;
    }

    /* ============================================
       Step 2 安全设置页面优化样式 - 简化版
       ============================================ */
    
    /* 大卡片通用样式 */
    .security-big-card {
      background: var(--bg-tertiary);
      border: 2px solid var(--border-default);
      border-radius: var(--radius-xl);
      padding: 24px;
      margin-bottom: 16px;
      cursor: pointer;
      transition: all 0.25s ease;
      position: relative;
    }
    .security-big-card:hover {
      border-color: var(--border-accent);
      background: var(--bg-hover);
    }
    .security-big-card.selected {
      border-color: var(--accent-blue);
      background: linear-gradient(135deg, rgba(60, 131, 246, 0.12) 0%, rgba(60, 131, 246, 0.04) 100%);
      box-shadow: 0 0 20px rgba(60, 131, 246, 0.2);
    }
    
    /* 完全信任卡片 - 普通状态和选中状态都用蓝色 */
    .security-big-card.trust-card {
      border-color: var(--border-default);
      background: var(--bg-tertiary);
    }
    .security-big-card.trust-card:hover {
      border-color: var(--border-accent);
      background: var(--bg-hover);
    }
    .security-big-card.trust-card.selected {
      border-color: var(--accent-blue);
      background: linear-gradient(135deg, rgba(60, 131, 246, 0.12) 0%, rgba(60, 131, 246, 0.04) 100%);
      box-shadow: 0 0 20px rgba(60, 131, 246, 0.2);
    }
    
    /* 解锁全部能力 - 文字加粗加红加大 */
    .trust-highlight {
      color: #ef4444 !important;
      font-weight: 700 !important;
      font-size: 1.1em !important;
    }
    
    .security-recommended-badge {
      position: absolute;
      top: -12px;
      left: 20px;
      background: linear-gradient(135deg, #3c83f6 0%, #60a5fa 100%);
      color: white;
      padding: 4px 14px;
      border-radius: 12px;
      font-size: 0.85em;
      font-weight: 600;
    }
    .security-big-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
    }
    .security-big-icon {
      font-size: 2.5em;
    }
    .security-big-info {
      flex: 1;
    }
    .security-big-title {
      font-size: 1.3em;
      font-weight: 600;
      color: var(--text-primary);
    }
    .security-big-subtitle {
      font-size: 0.95em;
      color: var(--text-secondary);
      margin-top: 4px;
    }
    .security-big-check {
      opacity: 0;
      transition: all 0.2s ease;
    }
    .security-big-check .material-icons {
      font-size: 32px;
      color: var(--accent-blue);
    }
    .security-big-card.selected .security-big-check {
      opacity: 1;
    }
    .security-big-features {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-left: 56px;
    }
    .feature-item {
      font-size: 1em;
      line-height: 1.5;
    }
    .feature-item.positive {
      color: var(--accent-green);
    }
    .feature-item.warning {
      color: var(--accent-yellow);
    }
    .feature-item.danger {
      color: #ef4444;
      font-weight: 500;
    }
    
    /* 保留旧样式兼容 */
    .security-recommended-card {
      background: var(--bg-tertiary);
      border: 2px solid var(--border-default);
      border-radius: var(--radius-xl);
      padding: 24px;
      margin-bottom: 20px;
      cursor: pointer;
      transition: all 0.25s ease;
      position: relative;
    }
    .security-recommended-card:hover {
      border-color: var(--border-accent);
      background: var(--bg-hover);
    }
    .security-recommended-card.selected {
      border-color: var(--accent-blue);
      background: linear-gradient(135deg, rgba(60, 131, 246, 0.12) 0%, rgba(60, 131, 246, 0.04) 100%);
      box-shadow: 0 0 20px rgba(60, 131, 246, 0.2);
    }
    .security-recommended-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
    }
    .security-recommended-icon {
      font-size: 2.5em;
    }
    .security-recommended-info {
      flex: 1;
    }
    .security-recommended-title {
      font-size: 1.3em;
      font-weight: 600;
      color: var(--text-primary);
    }
    .security-recommended-subtitle {
      font-size: 0.95em;
      color: var(--text-secondary);
      margin-top: 4px;
    }
    .security-recommended-check {
      opacity: 0;
      transition: all 0.2s ease;
    }
    .security-recommended-check .material-icons {
      font-size: 32px;
      color: var(--accent-blue);
    }
    .security-recommended-card.selected .security-recommended-check {
      opacity: 1;
    }
    .security-recommended-features {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-left: 56px;
    }

    /* 其他选项折叠区域 */
    .security-other-options {
      margin-bottom: 24px;
    }
    .security-other-toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      cursor: pointer;
      color: var(--text-secondary);
      font-size: 0.95em;
      transition: all 0.2s ease;
    }
    .security-other-toggle:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }
    .security-other-toggle .material-icons {
      transition: transform 0.2s ease;
    }
    .security-other-toggle.open .material-icons {
      transform: rotate(180deg);
    }
    .security-other-content {
      margin-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .security-option-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 20px;
      background: var(--bg-tertiary);
      border: 2px solid var(--border-default);
      border-radius: var(--radius-lg);
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .security-option-card:hover {
      border-color: var(--border-accent);
      background: var(--bg-hover);
    }
    .security-option-card.selected {
      border-color: var(--accent-blue);
      background: rgba(60, 131, 246, 0.08);
    }
    .security-option-icon {
      font-size: 1.8em;
    }
    .security-option-content {
      flex: 1;
    }
    .security-option-title {
      font-size: 1.1em;
      font-weight: 600;
      color: var(--text-primary);
    }
    .security-option-desc {
      font-size: 0.9em;
      color: var(--text-secondary);
      margin-top: 4px;
    }
    .security-option-detail {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 8px;
      flex-wrap: wrap;
    }
    .security-option-detail .detail-tag {
      font-size: 0.75em;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
    }
    .security-option-detail .detail-tag.safe {
      background: rgba(34, 197, 94, 0.15);
      color: var(--accent-green);
    }
    .security-option-detail .detail-tag.warn {
      background: rgba(249, 115, 22, 0.15);
      color: var(--accent-orange);
    }
    .security-option-detail .detail-text {
      font-size: 0.8em;
      color: var(--text-muted);
    }
    .security-option-check {
      opacity: 0;
      transition: all 0.2s ease;
    }
    .security-option-check .material-icons {
      font-size: 24px;
      color: var(--accent-blue);
    }
    .security-option-card.selected .security-option-check {
      opacity: 1;
    }

    /* 简化的确认区域 */
    .simple-agreement {
      padding: 16px 20px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      margin-bottom: 24px;
    }
    .simple-agreement-checkbox {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      cursor: pointer;
      user-select: none;
    }
    .simple-agreement-checkbox input[type="checkbox"] {
      width: 20px;
      height: 20px;
      accent-color: var(--accent-blue);
      cursor: pointer;
      margin-top: 2px;
      flex-shrink: 0;
    }
    .simple-agreement-checkbox label {
      font-size: 0.95em;
      font-weight: 500;
      color: var(--text-primary);
      cursor: pointer;
    }
    .agreement-disclaimer {
      font-size: 0.8em;
      color: #ef4444;
      margin-top: 6px;
      line-height: 1.5;
      padding-left: 32px;
    }
    .simple-agreement-checkbox.error {
      animation: shake 0.5s ease-in-out;
    }
    .simple-agreement-checkbox.error label {
      color: var(--accent-red);
    }

    /* 设置区域样式 */
    .settings-section {
      margin-bottom: 24px;
    }
    .settings-section-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 1.05em;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 16px;
    }
    .settings-section-icon {
      font-size: 1.2em;
    }

    /* 工作目录紧凑样式 */
    .workspace-compact {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      padding: 16px;
    }
    .workspace-compact .workspace-input-area {
      display: flex;
      gap: 12px;
      margin-bottom: 8px;
    }
    .workspace-compact .workspace-input-wrapper {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
    }
    .workspace-compact .workspace-input {
      flex: 1;
      background: transparent;
      border: none;
      color: var(--text-primary);
      font-family: var(--font-mono);
      font-size: 0.9em;
      outline: none;
    }
    .workspace-compact .workspace-browse-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 16px;
      background: var(--accent-blue);
      border: none;
      border-radius: var(--radius-md);
      color: white;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .workspace-compact .workspace-browse-btn:hover {
      background: var(--accent-blue-dark);
    }
    .workspace-hint {
      font-size: 0.85em;
      color: var(--text-muted);
    }
    /* C盘警告提示样式 */
    .workspace-warning {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-top: 12px;
      padding: 12px 14px;
      background: rgba(244, 67, 54, 0.08);
      border: 1px solid rgba(244, 67, 54, 0.3);
      border-radius: var(--radius-md);
      font-size: 0.9em;
      color: #f44336;
    }
    .workspace-warning .material-icons {
      font-size: 18px;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .workspace-warning-text {
      line-height: 1.5;
    }
    .workspace-warning-text strong {
      font-weight: 600;
    }
    /* C盘确认弹框样式 */
    .cdrive-confirm-modal {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(4px);
    }
    .cdrive-confirm-content {
      background: var(--bg-primary);
      border-radius: var(--radius-xl);
      padding: 28px;
      max-width: 480px;
      width: 90%;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    }
    .cdrive-confirm-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }
    .cdrive-confirm-icon {
      width: 48px;
      height: 48px;
      background: rgba(244, 67, 54, 0.15);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
    }
    .cdrive-confirm-title {
      font-size: 1.25em;
      font-weight: 600;
      color: var(--text-primary);
    }
    .cdrive-confirm-body {
      margin-bottom: 24px;
    }
    .cdrive-confirm-message {
      color: var(--text-secondary);
      line-height: 1.6;
      margin-bottom: 16px;
    }
    .cdrive-confirm-danger {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 14px;
      background: rgba(244, 67, 54, 0.1);
      border: 1px solid rgba(244, 67, 54, 0.3);
      border-radius: var(--radius-md);
      color: #f44336;
      font-size: 0.95em;
      line-height: 1.5;
    }
    .cdrive-confirm-danger .material-icons {
      font-size: 20px;
      flex-shrink: 0;
    }
    .cdrive-confirm-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }
    .cdrive-confirm-actions .btn {
      min-width: 100px;
    }
    .btn-danger {
      background: #f44336;
      color: white;
    }
    .btn-danger:hover {
      background: #d32f2f;
    }
    .security-card-cons {
      background: rgba(255, 152, 0, 0.1);
      color: #ff9800;
      border: 1px solid rgba(255, 152, 0, 0.2);
    }
    .security-card-cons.danger {
      background: rgba(244, 67, 54, 0.1);
      color: #f44336;
      border: 1px solid rgba(244, 67, 54, 0.2);
    }
    .security-card-warning {
      display: inline-block;
      background: #ff9800;
      color: white;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.75em;
      font-weight: 500;
      margin-left: 4px;
    }
    .security-card-check {
      position: absolute;
      top: 16px;
      right: 16px;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--accent-blue);
      display: none;
      align-items: center;
      justify-content: center;
      color: white;
    }
    .security-card.selected .security-card-check {
      display: flex;
    }

    /* 快速决策简化 */
    .quick-decision {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      padding: 20px 24px;
      margin-bottom: 24px;
    }
    .quick-decision-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 1.1em;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 16px;
    }
    .quick-decision-items {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    @media (max-width: 900px) {
      .quick-decision-items {
        grid-template-columns: 1fr;
      }
    }
    .quick-decision-item {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 16px;
      background: var(--bg-elevated);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      font-size: 0.95em;
      color: var(--text-secondary);
      transition: all 0.2s ease;
    }
    .quick-decision-item:hover {
      border-color: var(--border-accent);
      background: var(--bg-hover);
    }
    .quick-decision-item .scenario {
      font-size: 0.9em;
      color: var(--text-muted);
      line-height: 1.5;
    }
    .quick-decision-item .result {
      font-size: 1.1em;
      font-weight: 600;
      color: var(--accent-blue);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* 选择区域强调提示 */
    .selection-hint {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 14px 20px;
      background: linear-gradient(135deg, rgba(60, 131, 246, 0.15) 0%, rgba(60, 131, 246, 0.05) 100%);
      border: 2px dashed var(--accent-blue);
      border-radius: var(--radius-lg);
      margin-bottom: 20px;
      color: var(--accent-blue-light);
      font-size: 1.05em;
      font-weight: 500;
      animation: pulse 2s ease-in-out infinite;
    }
    .selection-hint .material-icons {
      font-size: 1.4em;
      animation: bounce 1s ease-in-out infinite;
    }

    /* Step 4: 对话方式选择样式 */
    .channel-mode-selector {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-bottom: 24px;
    }
    .channel-mode-card {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 20px 24px;
      background: var(--bg-tertiary);
      border: 2px solid var(--border-default);
      border-radius: var(--radius-xl);
      cursor: pointer;
      transition: all 0.25s ease;
      position: relative;
    }
    .channel-mode-card:hover {
      border-color: var(--border-accent);
      background: var(--bg-hover);
    }
    .channel-mode-card.selected {
      border-color: var(--accent-blue);
      background: linear-gradient(135deg, rgba(60, 131, 246, 0.12) 0%, rgba(60, 131, 246, 0.04) 100%);
      box-shadow: 0 0 20px rgba(60, 131, 246, 0.15);
    }
    .channel-mode-icon {
      font-size: 2.2em;
      flex-shrink: 0;
    }
    .channel-mode-content {
      flex: 1;
    }
    .channel-mode-title {
      font-size: 1.15em;
      font-weight: 600;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .channel-mode-badge {
      font-size: 0.75em;
      padding: 3px 10px;
      border-radius: 12px;
      font-weight: 600;
    }
    .channel-mode-badge.recommended {
      background: linear-gradient(135deg, #3c83f6 0%, #60a5fa 100%);
      color: white;
    }
    .channel-mode-desc {
      font-size: 0.95em;
      color: var(--text-secondary);
      margin-bottom: 10px;
    }
    .channel-mode-features {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .feature-tag {
      font-size: 0.85em;
      padding: 4px 10px;
      background: rgba(34, 197, 94, 0.15);
      color: var(--accent-green);
      border-radius: 6px;
    }
    .feature-tag.subtle {
      background: var(--bg-elevated);
      color: var(--text-muted);
    }
    .channel-mode-check {
      position: absolute;
      top: 16px;
      right: 16px;
      opacity: 0;
      transition: all 0.2s ease;
    }
    .channel-mode-check .material-icons {
      font-size: 28px;
      color: var(--accent-blue);
    }
    .channel-mode-card.selected .channel-mode-check {
      opacity: 1;
    }

    /* 网页对话说明区域 */
    .channel-mode-detail {
      margin-bottom: 24px;
    }
    .web-mode-info {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 20px 24px;
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(34, 197, 94, 0.03) 100%);
      border: 1px solid rgba(34, 197, 94, 0.3);
      border-radius: var(--radius-lg);
    }
    .web-mode-info-icon {
      font-size: 1.8em;
    }
    .web-mode-info-title {
      font-weight: 600;
      color: var(--accent-green);
      margin-bottom: 10px;
    }
    .web-mode-steps {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .web-mode-steps li {
      position: relative;
      padding-left: 20px;
      margin-bottom: 8px;
      color: var(--text-secondary);
      font-size: 0.95em;
    }
    .web-mode-steps li::before {
      content: '→';
      position: absolute;
      left: 0;
      color: var(--accent-green);
    }
    .web-mode-steps code {
      background: rgba(60, 131, 246, 0.15);
      padding: 2px 8px;
      border-radius: 4px;
      color: var(--accent-blue-light);
      font-family: var(--font-mono);
      font-size: 0.9em;
    }

    /* IM配置折叠区域 */
    .im-config-section {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      padding: 24px;
      margin-bottom: 24px;
      animation: fadeInUp 0.3s ease-out;
    }
    .im-config-header {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 1.1em;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-default);
    }
    .im-config-header .material-icons {
      color: var(--accent-blue);
    }

    /* Step 4: 渠道配置样式 */
    .channel-selector {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
      border-bottom: 1px solid var(--border-default);
      padding-bottom: 16px;
    }
    .channel-tab {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: all 0.2s ease;
      font-weight: 500;
    }
    .channel-tab:hover:not(.disabled) {
      background: var(--bg-hover);
      border-color: var(--border-accent);
    }
    .channel-tab.selected {
      background: linear-gradient(135deg, rgba(60, 131, 246, 0.2) 0%, rgba(60, 131, 246, 0.1) 100%);
      border-color: var(--accent-blue);
      color: var(--accent-blue-light);
    }
    .channel-tab.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .channel-tab-icon { font-size: 1.2em; }
    .channel-tab-badge {
      font-size: 0.75em;
      background: var(--bg-elevated);
      padding: 2px 8px;
      border-radius: 10px;
      color: var(--text-muted);
    }

    .channel-config-form {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      padding: 24px;
      animation: fadeInUp 0.3s ease-out;
    }
    .channel-config-header {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-default);
    }
    .channel-config-icon {
      font-size: 2em;
      flex-shrink: 0;
    }
    .channel-config-title {
      font-size: 1.15em;
      font-weight: 600;
      color: var(--text-primary);
    }
    .channel-config-subtitle {
      font-size: 0.9em;
      color: var(--text-secondary);
      margin-top: 4px;
    }
    .channel-config-help {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 4px;
      color: var(--accent-blue);
      font-size: 0.9em;
      text-decoration: none;
      padding: 8px 12px;
      background: rgba(60, 131, 246, 0.1);
      border-radius: var(--radius-md);
      transition: all 0.2s ease;
      border: none;
      cursor: pointer;
    }
    .channel-config-help:hover {
      background: rgba(60, 131, 246, 0.2);
    }
    .channel-config-help .material-icons {
      font-size: 1.1em;
    }

    /* ========== 左右分栏配置布局（核心重构）========== */
    
    /* 配置表单容器 - 支持分栏模式 */
    .channel-config-form {
      position: relative;
    }
    
    /* 分栏模式激活时的布局 */
    .channel-config-form.split-mode {
      display: grid;
      grid-template-columns: 400px 1fr;
      grid-template-rows: auto 1fr auto;
      grid-template-areas:
        "header header"
        "fields guide"
        "status guide";
      gap: 0;
      min-height: 550px;
      max-height: calc(100vh - 260px);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      overflow: hidden;
      background: var(--bg-primary);
    }
    
    /* 分栏模式下的头部 - 跨两列 */
    .channel-config-form.split-mode .channel-config-header {
      grid-area: header;
      border-bottom: 1px solid var(--border-color);
      margin-bottom: 0;
      padding: 16px 20px;
      background: var(--bg-elevated);
    }
    
    /* 分栏模式下的左侧表单区 */
    .channel-config-form.split-mode .channel-config-fields {
      grid-area: fields;
      padding: 20px;
      border-right: 1px solid var(--border-color);
      background: var(--bg-primary);
      overflow-y: auto;
    }
    
    /* 分栏模式下的右侧指南区 */
    .channel-config-form.split-mode .channel-guide {
      grid-area: guide;
      margin: 0;
      border: none;
      border-radius: 0;
      overflow-y: auto;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.03) 0%, rgba(139, 92, 246, 0.03) 100%);
    }
    
    /* 分栏模式下指南的 header 改为 sticky */
    .channel-config-form.split-mode .guide-header {
      position: sticky;
      top: 0;
      z-index: 10;
      background: linear-gradient(90deg, rgba(59, 130, 246, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid rgba(59, 130, 246, 0.2);
    }
    
    /* 分栏模式下状态消息放在表单底部 */
    .channel-config-form.split-mode .status-message {
      grid-area: status;
      margin: 0;
      padding: 12px 20px;
      border-top: 1px solid var(--border-color);
      border-right: 1px solid var(--border-color);
    }
    
    /* 分栏模式下隐藏原按钮文字，显示新状态 */
    .channel-config-form.split-mode .channel-config-help {
      background: rgba(34, 197, 94, 0.1);
      color: var(--accent-green);
      border: 1px solid rgba(34, 197, 94, 0.3);
    }
    .channel-config-form.split-mode .channel-config-help::after {
      content: " (已展开)";
    }
    
    /* 响应式：小屏幕时改为上下布局 */
    @media (max-width: 900px) {
      .channel-config-form.split-mode {
        grid-template-columns: 1fr;
        grid-template-rows: auto auto 1fr auto;
        grid-template-areas:
          "header"
          "fields"
          "guide"
          "status";
        max-height: none;
      }
      
      .channel-config-form.split-mode .channel-config-fields {
        border-right: none;
        border-bottom: 1px solid var(--border-color);
      }
      
      .channel-config-form.split-mode .channel-guide {
        max-height: 400px;
      }
      
      .channel-config-form.split-mode .status-message {
        border-right: none;
      }
    }
    
    /* 配置指南样式 */
    .channel-guide {
      margin: 16px 0;
      background: var(--bg-elevated);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }
    .channel-guide.hidden {
      display: none;
    }
    .guide-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: rgba(60, 131, 246, 0.1);
      border-bottom: 1px solid var(--border-color);
      color: var(--accent-blue);
      font-weight: 600;
    }
    .guide-header .material-icons {
      font-size: 1.2em;
    }
    
    /* 指南关闭按钮 */
    .guide-close-btn {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      background: rgba(255, 255, 255, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      font-size: 0.85em;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .guide-close-btn:hover {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.4);
      color: var(--accent-red);
      transform: translateX(2px);
    }
    .guide-close-btn .material-icons {
      font-size: 1.1em;
    }
    
    /* 分栏模式下表单区的标题提示 */
    .channel-config-form.split-mode .channel-config-fields::before {
      content: "填写配置信息";
      display: block;
      font-size: 0.8em;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px dashed var(--border-subtle);
    }
    
    /* 分栏模式下的步骤高亮 - 第 3 步获取密钥 */
    .channel-config-form.split-mode .guide-step:nth-child(3) {
      background: rgba(34, 197, 94, 0.08);
      margin: 0 -16px 16px;
      padding: 16px;
      border-radius: var(--radius-md);
      border: 1px solid rgba(34, 197, 94, 0.2);
    }
    .channel-config-form.split-mode .guide-step:nth-child(3) .guide-step-number {
      background: var(--accent-green);
      animation: pulse-green 2s infinite;
    }
    
    @keyframes pulse-green {
      0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
      50% { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
    }
    
    .guide-content {
      padding: 16px;
    }
    .guide-step {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-subtle);
    }
    .guide-step:last-child {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }
    .guide-step-number {
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--accent-blue);
      color: white;
      border-radius: 50%;
      font-weight: 600;
      font-size: 0.9em;
    }
    .guide-step-content {
      flex: 1;
    }
    .guide-step-title {
      font-size: 1em;
      margin-bottom: 4px;
      color: var(--text-primary);
    }
    .guide-step-desc {
      font-size: 0.9em;
      color: var(--text-secondary);
      line-height: 1.6;
    }
    .guide-step-desc a {
      color: var(--accent-blue);
    }
    .guide-step-desc code {
      background: var(--bg-surface);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.9em;
      color: var(--accent-orange);
    }
    .guide-tip {
      display: block;
      margin-top: 8px;
      padding: 8px 12px;
      background: rgba(34, 197, 94, 0.1);
      border-left: 3px solid var(--accent-green);
      border-radius: 0 4px 4px 0;
      font-size: 0.85em;
      color: var(--accent-green);
    }
    .guide-footer {
      padding: 12px 16px;
      background: var(--bg-surface);
      border-top: 1px solid var(--border-color);
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }
    .guide-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--accent-blue);
      font-size: 0.9em;
      text-decoration: none;
    }
    .guide-link:hover {
      text-decoration: underline;
    }
    .guide-link .material-icons {
      font-size: 1.1em;
    }

    /* 前置条件 */
    .guide-prereq {
      margin: 0 16px 16px;
      padding: 16px;
      background: rgba(59, 130, 246, 0.05);
      border: 1px solid rgba(59, 130, 246, 0.2);
      border-radius: var(--radius-md);
    }
    .guide-prereq-title {
      font-weight: 600;
      color: var(--accent-blue);
      margin-bottom: 12px;
    }
    .guide-prereq-list {
      margin: 0;
      padding-left: 20px;
      color: var(--text-secondary);
      line-height: 1.8;
    }
    .guide-prereq-list li {
      margin-bottom: 4px;
    }

    /* 子步骤 */
    .guide-substeps {
      margin: 8px 0 0 0;
      padding-left: 20px;
      line-height: 1.8;
    }
    .guide-substeps li {
      margin-bottom: 6px;
    }
    .guide-substeps ul {
      margin: 4px 0 8px 0;
      padding-left: 20px;
    }

    /* 字段说明 */
    .guide-field-desc {
      margin: 12px 0;
      padding: 12px 16px;
      background: var(--bg-surface);
      border-radius: var(--radius-md);
      border-left: 3px solid var(--accent-blue);
    }
    .guide-field-row {
      margin-bottom: 8px;
      line-height: 1.6;
    }
    .guide-field-row:last-child {
      margin-bottom: 0;
    }
    .guide-field-name {
      font-weight: 600;
      color: var(--text-primary);
    }

    /* 权限列表 */
    .guide-permission-list {
      margin-top: 12px;
    }
    .guide-permission-item {
      margin-bottom: 12px;
      padding: 10px 14px;
      background: var(--bg-surface);
      border-radius: var(--radius-md);
      line-height: 1.6;
    }
    .guide-permission-item:last-child {
      margin-bottom: 0;
    }
    .guide-permission-item strong {
      color: var(--accent-blue);
    }
    .guide-permission-item code {
      background: rgba(249, 115, 22, 0.1);
      color: var(--accent-orange);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.9em;
    }

    /* 示例框 */
    .guide-example {
      margin-top: 12px;
      padding: 12px;
      background: var(--bg-surface);
      border-radius: var(--radius-md);
      font-size: 0.9em;
      color: var(--text-secondary);
    }
    .guide-example code {
      background: rgba(249, 115, 22, 0.1);
      color: var(--accent-orange);
      padding: 2px 6px;
      border-radius: 4px;
    }

    /* 权限表格 */
    .guide-permission-table,
    .guide-field-table {
      width: 100%;
      margin-top: 12px;
      border-collapse: collapse;
      font-size: 0.85em;
    }
    .guide-permission-table th,
    .guide-permission-table td,
    .guide-field-table th,
    .guide-field-table td {
      padding: 8px 12px;
      text-align: left;
      border: 1px solid var(--border-color);
    }
    .guide-permission-table th,
    .guide-field-table th {
      background: var(--bg-surface);
      font-weight: 600;
      color: var(--text-primary);
    }
    .guide-permission-table td,
    .guide-field-table td {
      background: var(--bg-elevated);
    }
    .guide-permission-table code,
    .guide-field-table code {
      background: rgba(249, 115, 22, 0.1);
      color: var(--accent-orange);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.9em;
    }

    /* FAQ */
    .guide-faq {
      margin: 16px;
      padding: 16px;
      background: var(--bg-surface);
      border-radius: var(--radius-md);
    }
    .guide-faq-title {
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 16px;
      font-size: 1em;
    }
    .guide-faq-item {
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border-subtle);
    }
    .guide-faq-item:last-child {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }
    .guide-faq-q {
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 4px;
      font-size: 0.9em;
    }
    .guide-faq-a {
      color: var(--text-secondary);
      font-size: 0.85em;
      line-height: 1.5;
    }

    /* 内网穿透说明 */
    .guide-tunnel-info {
      margin: 16px;
      padding: 16px;
      background: rgba(249, 115, 22, 0.05);
      border: 1px solid rgba(249, 115, 22, 0.2);
      border-radius: var(--radius-md);
    }
    .guide-tunnel-title {
      font-weight: 600;
      color: var(--accent-orange);
      margin-bottom: 12px;
    }
    .guide-tunnel-content {
      color: var(--text-secondary);
      font-size: 0.9em;
      line-height: 1.6;
    }
    .guide-tunnel-content p {
      margin: 0 0 12px 0;
    }
    .guide-tunnel-options {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    @media (max-width: 768px) {
      .guide-tunnel-options {
        grid-template-columns: 1fr;
      }
    }
    .guide-tunnel-option {
      padding: 12px;
      background: var(--bg-elevated);
      border-radius: var(--radius-md);
    }
    .guide-tunnel-option strong {
      display: block;
      margin-bottom: 8px;
      color: var(--text-primary);
    }
    .guide-tunnel-option ol {
      margin: 0;
      padding-left: 20px;
      line-height: 1.6;
    }
    .guide-tunnel-option code {
      background: rgba(249, 115, 22, 0.1);
      color: var(--accent-orange);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.9em;
    }

    .channel-config-fields {
      display: grid;
      gap: 20px;
    }
    .required {
      color: var(--accent-red);
    }

    /* 免责声明和同意条款 */
    .agreement-section {
      margin-top: 28px;
      padding: 20px 24px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
    }
    .agreement-text {
      font-size: 1em;
      color: var(--text-secondary);
      line-height: 1.7;
      margin-bottom: 16px;
    }
    .agreement-checkbox {
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      user-select: none;
    }
    .agreement-checkbox input[type="checkbox"] {
      width: 22px;
      height: 22px;
      accent-color: var(--accent-blue);
      cursor: pointer;
    }
    .agreement-checkbox label {
      font-size: 1.05em;
      font-weight: 500;
      color: var(--text-primary);
      cursor: pointer;
    }
    .agreement-checkbox.error {
      animation: shake 0.5s ease-in-out;
    }
    .agreement-checkbox.error label {
      color: var(--accent-red);
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
      20%, 40%, 60%, 80% { transform: translateX(8px); }
    }

    /* ============================================
       协议勾选区域样式（Step 4 验证成功后显示）
       ============================================ */
    .legal-agreement-section {
      margin-top: 28px;
      padding: 20px 24px;
      border: 2px dashed var(--accent-red);
      border-radius: var(--radius-lg);
      background: rgba(239, 68, 68, 0.05);
      transition: all 0.3s ease;
    }
    .legal-agreement-section.checked {
      border: 1px solid var(--border-default);
      background: var(--bg-tertiary);
    }
    .legal-agreement-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .legal-agreement-row input[type="checkbox"] {
      width: 22px;
      height: 22px;
      accent-color: var(--accent-green);
      cursor: pointer;
      flex-shrink: 0;
    }
    .legal-agreement-text {
      font-size: 0.95em;
      color: var(--text-secondary);
      line-height: 1.6;
    }
    .legal-agreement-text a {
      color: var(--accent-blue);
      text-decoration: underline;
      cursor: pointer;
      margin: 0 2px;
    }
    .legal-agreement-text a:hover {
      color: var(--accent-blue-light);
    }
    .legal-agreement-section.checked .legal-agreement-row input[type="checkbox"] {
      accent-color: var(--accent-green);
    }
    
    /* 协议弹窗样式 */
    .legal-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(4px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .legal-modal {
      background: var(--bg-secondary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-xl);
      max-width: 700px;
      width: 100%;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: var(--shadow-lg);
    }
    .legal-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      border-bottom: 1px solid var(--border-default);
    }
    .legal-modal-header h3 {
      font-size: 1.2em;
      font-weight: 600;
      color: var(--text-primary);
    }
    .legal-modal-close {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 8px;
      border-radius: var(--radius-sm);
      transition: all 0.2s;
    }
    .legal-modal-close:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }
    .legal-modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      font-size: 0.9em;
      line-height: 1.8;
      color: var(--text-secondary);
    }
    .legal-modal-body h4 {
      color: var(--text-primary);
      font-size: 1.1em;
      margin: 20px 0 12px 0;
    }
    .legal-modal-body h4:first-child {
      margin-top: 0;
    }
    .legal-modal-body p {
      margin-bottom: 12px;
    }
    .legal-modal-body ul, .legal-modal-body ol {
      margin: 12px 0;
      padding-left: 24px;
    }
    .legal-modal-body li {
      margin-bottom: 8px;
    }
    .legal-modal-footer {
      padding: 16px 24px;
      border-top: 1px solid var(--border-default);
      text-align: center;
    }
    
    /* Step 4 完成按钮组 */
    .step4-complete-btn-group {
      margin-top: 24px;
      display: flex;
      gap: 12px;
      justify-content: center;
    }
    .step4-complete-btn-group .btn {
      min-width: 140px;
    }

    /* ============================================
       Step 3 工作目录页面优化样式
       ============================================ */
    
    /* 当前模式状态卡片 */
    .mode-status-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px 24px;
      background: linear-gradient(135deg, rgba(60, 131, 246, 0.12) 0%, rgba(60, 131, 246, 0.04) 100%);
      border: 2px solid var(--accent-blue);
      border-radius: var(--radius-xl);
      margin-bottom: 28px;
    }
    .mode-status-icon {
      font-size: 2.5em;
    }
    .mode-status-content {
      flex: 1;
    }
    .mode-status-label {
      font-size: 0.85em;
      color: var(--text-muted);
      margin-bottom: 4px;
    }
    .mode-status-value {
      font-size: 1.4em;
      font-weight: 700;
      color: var(--accent-blue-light);
    }
    .mode-status-desc {
      font-size: 0.95em;
      color: var(--text-secondary);
      max-width: 280px;
      text-align: right;
    }

    /* 工作目录选择区域 */
    .workspace-section {
      background: var(--bg-tertiary);
      border: 2px solid var(--accent-blue);
      border-radius: var(--radius-xl);
      padding: 28px;
      margin-bottom: 24px;
      position: relative;
    }
    .workspace-section::before {
      content: '👇 请在这里选择';
      position: absolute;
      top: -14px;
      left: 24px;
      background: linear-gradient(135deg, #3c83f6 0%, #60a5fa 100%);
      color: white;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 0.85em;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(60, 131, 246, 0.4);
    }
    .workspace-header {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 24px;
    }
    .workspace-header-icon {
      font-size: 2.5em;
      line-height: 1;
    }
    .workspace-header-text {
      flex: 1;
    }
    .workspace-header-title {
      font-size: 1.3em;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 6px;
    }
    .workspace-header-subtitle {
      font-size: 1em;
      color: var(--text-secondary);
      line-height: 1.5;
    }
    .workspace-input-area {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }
    .workspace-input-wrapper {
      flex: 1;
      position: relative;
      display: flex;
      align-items: center;
    }
    .workspace-input-icon {
      position: absolute;
      left: 14px;
      color: var(--text-muted);
      font-size: 1.3em;
    }
    .workspace-input {
      width: 100%;
      padding: 16px 16px 16px 48px;
      background: var(--bg-secondary);
      border: 2px solid var(--border-default);
      border-radius: var(--radius-lg);
      color: var(--text-primary);
      font-size: 1.05em;
      font-family: var(--font-mono);
      transition: all 0.2s ease;
    }
    .workspace-input:focus {
      outline: none;
      border-color: var(--accent-blue);
      box-shadow: 0 0 0 4px rgba(60, 131, 246, 0.15);
    }
    .workspace-browse-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 16px 24px;
      background: linear-gradient(135deg, #3c83f6 0%, #60a5fa 100%);
      border: none;
      border-radius: var(--radius-lg);
      color: white;
      font-size: 1em;
      font-weight: 600;
      font-family: var(--font-sans);
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    .workspace-browse-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(60, 131, 246, 0.4);
    }
    .workspace-browse-btn .material-icons {
      font-size: 1.2em;
    }
    .workspace-tip {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: rgba(234, 179, 8, 0.1);
      border: 1px solid rgba(234, 179, 8, 0.3);
      border-radius: var(--radius-md);
      font-size: 0.95em;
      color: var(--accent-yellow);
    }
    .workspace-tip-icon {
      font-size: 1.2em;
    }
    .workspace-tip code {
      background: rgba(234, 179, 8, 0.15);
      padding: 2px 8px;
      border-radius: 4px;
      font-family: var(--font-mono);
      font-size: 0.9em;
    }

    /* 额外信任目录折叠区 */
    .extra-dirs-section {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      margin-bottom: 24px;
      overflow: hidden;
    }
    .extra-dirs-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      cursor: pointer;
      transition: background 0.2s ease;
    }
    .extra-dirs-header:hover {
      background: var(--bg-hover);
    }
    .extra-dirs-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 1em;
      font-weight: 500;
      color: var(--text-secondary);
    }
    .extra-dirs-arrow {
      color: var(--text-muted);
      transition: transform 0.2s ease;
    }
    .extra-dirs-section.open .extra-dirs-arrow {
      transform: rotate(180deg);
    }
    .extra-dirs-content {
      padding: 0 20px 20px;
    }
    .extra-dirs-content.hidden {
      display: none;
    }
    .extra-dirs-hint {
      font-size: 0.9em;
      color: var(--text-muted);
      margin-bottom: 16px;
      padding: 12px;
      background: var(--bg-elevated);
      border-radius: var(--radius-md);
    }
    .dir-empty {
      text-align: center;
      color: var(--text-muted);
      font-size: 0.9em;
      padding: 16px;
    }

    /* 表单元素 */
    .form-group {
      margin-bottom: 20px;
    }
    .form-label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      font-size: 0.9em;
      color: var(--text-secondary);
    }
    .form-input {
      width: 100%;
      padding: 12px 16px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      font-size: 0.95em;
      font-family: var(--font-sans);
      transition: all 0.2s ease;
    }
    .form-input::placeholder { color: var(--text-muted); }
    .form-input:hover { border-color: rgba(255, 255, 255, 0.15); }
    .form-input:focus {
      outline: none;
      border-color: var(--accent-blue);
      box-shadow: 0 0 0 3px rgba(60, 131, 246, 0.15);
    }
    .form-input.mono { font-family: var(--font-mono); font-size: 0.9em; }
    .form-input-group {
      display: flex;
      gap: 8px;
    }
    .form-input-group .form-input { flex: 1; }
    .form-help {
      margin-top: 6px;
      font-size: 0.85em;
      color: var(--text-muted);
    }
    .form-help a { color: var(--accent-blue); text-decoration: none; }
    .form-help a:hover { text-decoration: underline; }

    /* 密码输入框 */
    .password-input-wrapper {
      position: relative;
    }
    .password-input-wrapper .form-input {
      padding-right: 48px;
    }
    .password-toggle {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .password-toggle:hover { color: var(--text-secondary); }

    /* 按钮 */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 24px;
      border: none;
      border-radius: var(--radius-md);
      font-size: 0.95em;
      font-weight: 500;
      font-family: var(--font-sans);
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .btn-primary {
      background: var(--gradient-blue);
      color: white;
      box-shadow: var(--shadow-sm);
    }
    .btn-primary:hover:not(:disabled) {
      box-shadow: var(--shadow-glow);
      transform: translateY(-1px);
    }
    .btn-secondary {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      color: var(--text-primary);
    }
    .btn-secondary:hover:not(:disabled) {
      background: var(--bg-hover);
      border-color: rgba(255, 255, 255, 0.15);
    }
    .btn-ghost {
      background: transparent;
      color: var(--text-secondary);
    }
    .btn-ghost:hover:not(:disabled) {
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }
    .btn-lg {
      padding: 16px 32px;
      font-size: 1.05em;
    }
    .btn-group {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 32px;
    }

    /* 链接卡片 */
    .link-card {
      display: block;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 20px;
      text-decoration: none;
      color: var(--text-primary);
      transition: all 0.2s ease;
      margin-bottom: 12px;
    }
    .link-card:hover {
      border-color: var(--accent-blue);
      background: var(--bg-hover);
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }
    .link-card-content {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .link-card-icon {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-md);
      background: rgba(60, 131, 246, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5em;
    }
    .link-card-text { flex: 1; }
    .link-card-title { font-weight: 600; margin-bottom: 4px; }
    .link-card-desc { font-size: 0.85em; color: var(--text-secondary); }
    .link-card-arrow { color: var(--text-muted); }

    /* 状态消息 */
    .status-message {
      display: none;
      padding: 12px 16px;
      border-radius: var(--radius-md);
      margin-top: 16px;
      font-size: 0.9em;
      animation: fadeIn 0.3s ease;
    }
    .status-message.show { display: flex; align-items: center; gap: 8px; }
    .status-message.loading {
      background: rgba(60, 131, 246, 0.1);
      border: 1px solid rgba(60, 131, 246, 0.2);
      color: var(--accent-blue-light);
    }
    .status-message.success {
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.2);
      color: var(--accent-green);
    }
    .status-message.error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      color: var(--accent-red);
    }
    .status-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    /* 目录列表 */
    .dir-list {
      margin: 16px 0;
    }
    .dir-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      margin-bottom: 8px;
    }
    .dir-item-icon { font-size: 1.2em; }
    .dir-item-path {
      flex: 1;
      font-family: var(--font-mono);
      font-size: 0.9em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dir-item-remove {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      color: var(--accent-red);
      padding: 6px 12px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 0.85em;
      font-family: var(--font-sans);
    }
    .dir-item-remove:hover {
      background: rgba(239, 68, 68, 0.2);
    }

    /* 为什么选择 OpenClawCN */
    .why-choose-section {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      margin-bottom: 20px;
      overflow: hidden;
    }
    .why-choose-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 20px;
      background: var(--bg-elevated);
      border-bottom: 1px solid var(--border-default);
    }
    .why-choose-icon {
      font-size: 1.3em;
    }
    .why-choose-title {
      font-size: 1.05em;
      font-weight: 600;
      color: var(--text-primary);
    }
    .why-choose-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      padding: 16px;
    }
    @media (max-width: 600px) {
      .why-choose-grid {
        grid-template-columns: 1fr;
      }
    }
    .why-choose-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 14px;
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
      font-size: 0.9em;
      line-height: 1.5;
    }
    .why-item-icon {
      font-size: 1.2em;
      flex-shrink: 0;
    }
    .why-item-text {
      color: var(--text-secondary);
    }
    .why-item-text strong {
      color: var(--text-primary);
    }

    /* 增值服务卡片 */
    .premium-service-card {
      background: linear-gradient(135deg, rgba(255, 215, 0, 0.08) 0%, rgba(255, 165, 0, 0.03) 100%);
      border: 2px solid rgba(255, 215, 0, 0.4);
      border-radius: var(--radius-xl);
      padding: 0;
      margin-bottom: 0;
      position: relative;
      overflow: hidden;
    }
    .premium-badge {
      position: absolute;
      top: 0;
      right: 24px;
      background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
      color: #1a1a1a;
      font-size: 0.85em;
      font-weight: 700;
      padding: 6px 16px;
      border-radius: 0 0 12px 12px;
    }
    .premium-content {
      padding: 28px 24px;
      text-align: center;
    }
    .premium-title {
      font-size: 1.4em;
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: 6px;
    }
    .premium-subtitle {
      font-size: 0.95em;
      color: var(--text-secondary);
      margin-bottom: 20px;
    }
    .premium-features {
      display: flex;
      flex-direction: column;
      gap: 10px;
      text-align: left;
      margin-bottom: 24px;
    }
    .premium-feature {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
      font-size: 0.9em;
      color: var(--text-secondary);
    }
    .premium-feature strong {
      color: var(--text-primary);
    }
    
    /* 金色购买按钮 */
    .premium-buy-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      width: 100%;
      padding: 18px 32px;
      background: linear-gradient(135deg, #FFD700 0%, #FFA500 50%, #FF8C00 100%);
      border: none;
      border-radius: var(--radius-lg);
      color: #1a1a1a;
      font-size: 1.15em;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(255, 165, 0, 0.4);
    }
    .premium-buy-btn:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 25px rgba(255, 165, 0, 0.5);
      background: linear-gradient(135deg, #FFE44D 0%, #FFB833 50%, #FFA000 100%);
    }
    .premium-buy-btn .material-icons {
      font-size: 1.4em;
    }
    .premium-buy-text {
      flex: 1;
      text-align: center;
    }
    .premium-buy-arrow {
      font-size: 1.3em;
      animation: bounceRight 1.5s infinite;
    }
    @keyframes bounceRight {
      0%, 100% { transform: translateX(0); }
      50% { transform: translateX(5px); }
    }
    .premium-buy-hint {
      margin-top: 14px;
      font-size: 0.85em;
      color: var(--text-muted);
    }

    /* Step4 两栏布局：左侧会员服务 + 右侧微信二维码 */
    .step4-main-grid {
      display: grid;
      grid-template-columns: 1fr 320px;
      gap: 20px;
      margin-bottom: 20px;
      align-items: stretch;
    }
    @media (max-width: 800px) {
      .step4-main-grid {
        grid-template-columns: 1fr;
      }
    }

    /* 微信技术支持二维码卡片 */
    .wechat-support-card {
      background: linear-gradient(160deg, #1a1814 0%, #25201a 40%, #1e1b15 100%);
      border: 2px solid rgba(251, 191, 36, 0.4);
      border-radius: var(--radius-xl);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: border-color 0.3s ease, box-shadow 0.3s ease;
      animation: wechatCardBreathe 3s ease-in-out infinite;
    }
    @keyframes wechatCardBreathe {
      0%, 100% {
        border-color: rgba(251, 191, 36, 0.4);
        box-shadow: 0 0 20px rgba(251, 191, 36, 0.1), 0 4px 16px rgba(0, 0, 0, 0.2);
      }
      50% {
        border-color: rgba(251, 191, 36, 0.65);
        box-shadow: 0 0 32px rgba(251, 191, 36, 0.2), 0 4px 16px rgba(0, 0, 0, 0.2);
      }
    }
    .wechat-support-card:hover {
      border-color: rgba(251, 191, 36, 0.7);
      box-shadow: 0 4px 24px rgba(251, 191, 36, 0.2), 0 8px 32px rgba(0, 0, 0, 0.3);
      animation: none;
    }
    .wechat-support-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 14px 16px 10px;
      font-weight: 700;
      font-size: 0.95em;
      color: #fbbf24;
      letter-spacing: 0.5px;
      text-shadow: 0 0 12px rgba(251, 191, 36, 0.3);
    }
    .wechat-support-header .material-icons {
      font-size: 1.2em;
    }
    .wechat-support-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4px 16px 20px;
      text-align: center;
    }
    .wechat-qr-wrapper {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      margin-bottom: 16px;
      position: relative;
      border-radius: 12px;
      border: 2px solid rgba(251, 191, 36, 0.3);
    }
    .wechat-qr-wrapper img {
      width: 100%;
      height: auto;
      object-fit: cover;
      border-radius: 10px;
      transform: scale(1.15);
      filter: sepia(0.15) saturate(1.1) brightness(1.05);
    }
    .wechat-qr-wrapper .qrcode-loading {
      font-size: 0.85em;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .wechat-support-title {
      font-size: 1em;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
      margin-bottom: 4px;
      line-height: 1.4;
    }
    .wechat-support-group {
      font-size: 0.9em;
      font-weight: 600;
      color: #fbbf24;
      margin-bottom: 6px;
    }
    .wechat-support-hint {
      font-size: 0.82em;
      color: rgba(251, 191, 36, 0.55);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .wechat-support-hint::before {
      content: '';
      display: inline-block;
      width: 16px;
      height: 16px;
      background: url("data:image/svg+xml,%3Csvg viewBox='0 0 24 24' fill='%2307C160' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05a6.127 6.127 0 01-.253-1.736c0-3.56 3.143-6.443 7.02-6.443.35 0 .69.027 1.027.07-.91-3.223-4.59-5.523-8.905-5.523zm-2.7 3.805a1.065 1.065 0 110 2.13 1.065 1.065 0 010-2.13zm5.41 0a1.065 1.065 0 110 2.13 1.065 1.065 0 010-2.13z'/%3E%3Cpath d='M23.697 14.531c0-3.244-3.09-5.875-6.902-5.875-3.81 0-6.9 2.631-6.9 5.875 0 3.246 3.09 5.876 6.9 5.876.756 0 1.49-.098 2.18-.31a.67.67 0 01.553.074l1.468.86a.26.26 0 00.129.042.226.226 0 00.224-.228c0-.056-.022-.11-.037-.164l-.301-1.142a.456.456 0 01.164-.514c1.416-1.044 2.322-2.597 2.322-4.493zm-9.126-1.012a.822.822 0 110-1.645.822.822 0 010 1.645zm4.449 0a.822.822 0 110-1.645.822.822 0 010 1.645z'/%3E%3C/svg%3E") no-repeat center/contain;
    }
    .wechat-qr-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      color: var(--text-muted);
      font-size: 0.85em;
    }
    .wechat-qr-placeholder .material-icons {
      font-size: 2.5em;
      opacity: 0.3;
    }

    /* 旧版 qrcode-section 隐藏（已整合到新布局） */
    .qrcode-section { display: none !important; }

    /* 凭证输入区域 */
    .license-input-section {
      margin-top: 20px;
      padding: 16px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
    }
    .license-input-section .form-label {
      margin-bottom: 10px;
      font-size: 0.95em;
    }
    .license-input-wrapper {
      display: flex;
      gap: 12px;
    }
    .license-input-wrapper .form-input {
      flex: 1;
    }

    /* 服务说明区域（保留兼容） */
    .service-intro {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      margin-bottom: 24px;
      overflow: hidden;
    }
    .service-intro-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px 20px;
      background: var(--bg-elevated);
      border-bottom: 1px solid var(--border-default);
    }
    .service-intro-icon {
      font-size: 1.3em;
    }
    .service-intro-title {
      font-size: 1.05em;
      font-weight: 600;
      color: var(--text-primary);
    }
    .service-intro-content {
      padding: 20px;
      font-size: 0.95em;
      color: var(--text-secondary);
      line-height: 1.7;
    }
    .service-intro-content p {
      margin: 0;
    }
    .service-list {
      list-style: none;
      padding: 0;
      margin: 12px 0 0 0;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    @media (max-width: 600px) {
      .service-list {
        grid-template-columns: 1fr;
      }
    }
    .service-list li {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: var(--bg-secondary);
      border-radius: var(--radius-md);
      font-size: 0.95em;
    }

    /* 服务凭证卡片（保留兼容） */
    .license-card {
      background: linear-gradient(135deg, rgba(60, 131, 246, 0.1) 0%, rgba(60, 131, 246, 0.02) 100%);
      border: 1px solid var(--border-accent);
      border-radius: var(--radius-lg);
      padding: 32px;
      text-align: center;
      margin: 24px 0;
    }
    .license-card-icon {
      font-size: 3em;
      margin-bottom: 16px;
    }
    .license-card-title {
      font-size: 1.3em;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .license-card-desc {
      color: var(--text-secondary);
      margin-bottom: 20px;
    }
    .license-card-note {
      margin-top: 16px;
      font-size: 0.85em;
      color: var(--text-muted);
    }

    /* 验证成功动画 */
    .success-animation {
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 32px;
      animation: fadeIn 0.4s ease;
    }
    .success-animation.show { display: flex; }
    .success-checkmark {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: var(--accent-green);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 24px;
      animation: scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .success-checkmark svg {
      width: 40px;
      height: 40px;
      stroke: white;
      stroke-width: 3;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .success-checkmark svg path {
      stroke-dasharray: 100;
      stroke-dashoffset: 100;
      animation: checkmark 0.6s ease forwards 0.3s;
    }
    .success-title {
      font-size: 1.5em;
      font-weight: 600;
      margin-bottom: 8px;
      animation: fadeInUp 0.4s ease 0.2s backwards;
    }
    .success-desc {
      color: var(--text-secondary);
      margin-bottom: 8px;
      animation: fadeInUp 0.4s ease 0.3s backwards;
    }
    .success-expires {
      color: var(--accent-green);
      font-size: 0.9em;
      animation: fadeInUp 0.4s ease 0.4s backwards;
    }

    /* 撒花动画 */
    .confetti-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1000;
      overflow: hidden;
    }
    .confetti {
      position: absolute;
      width: 10px;
      height: 10px;
      background: var(--accent-blue);
      animation: confetti 3s ease-out forwards;
    }

    /* 配置摘要 */
    .summary-list {
      list-style: none;
      padding: 0;
      margin: 24px 0;
    }
    .summary-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      margin-bottom: 8px;
    }
    .summary-item-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(34, 197, 94, 0.1);
      color: var(--accent-green);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .summary-item-label {
      flex: 1;
      color: var(--text-secondary);
    }
    .summary-item-value {
      font-weight: 500;
      color: var(--text-primary);
      font-family: var(--font-mono);
      font-size: 0.9em;
    }

    /* 平台提示 */
    .platform-tips {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 20px;
      margin: 24px 0;
    }
    .platform-tips-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      font-weight: 500;
    }
    .platform-tips-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .platform-tips-list li {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 8px 0;
      color: var(--text-secondary);
      font-size: 0.9em;
    }
    .platform-tips-list li::before {
      content: '•';
      color: var(--accent-blue);
    }
    .platform-tips-list code {
      background: var(--bg-elevated);
      padding: 2px 8px;
      border-radius: 4px;
      font-family: var(--font-mono);
      font-size: 0.9em;
      color: var(--accent-blue-light);
    }

    /* 测试连接区域 */
    .test-connection-section {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-lg);
      margin: 24px 0;
      overflow: hidden;
    }
    .test-connection-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 16px 20px;
      background: var(--bg-elevated);
      border-bottom: 1px solid var(--border-default);
      font-weight: 500;
      color: var(--text-primary);
    }
    .test-connection-header .material-icons {
      color: var(--accent-blue);
    }
    .test-connection-content {
      padding: 20px;
    }
    .test-connection-result {
      margin-top: 16px;
      padding: 16px;
      border-radius: var(--radius-md);
      font-size: 0.9em;
    }
    .test-connection-result.success {
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.3);
      color: var(--accent-green);
    }
    .test-connection-result.error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: var(--accent-red);
    }
    .test-connection-result .result-icon {
      font-size: 1.5em;
      margin-bottom: 8px;
    }
    .test-connection-result .result-message {
      font-weight: 500;
      margin-bottom: 4px;
    }
    .test-connection-result .result-detail {
      color: var(--text-secondary);
      font-size: 0.9em;
    }

    /* 完成页面大按钮 */
    .launch-button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      width: 100%;
      padding: 20px 32px;
      background: var(--gradient-blue);
      border: none;
      border-radius: var(--radius-lg);
      color: white;
      font-size: 1.1em;
      font-weight: 600;
      font-family: var(--font-sans);
      cursor: pointer;
      transition: all 0.2s ease;
      margin-top: 32px;
    }
    .launch-button:hover:not(:disabled) {
      box-shadow: var(--shadow-glow);
      transform: translateY(-2px);
    }
    .launch-button:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
    .launch-button .material-icons {
      font-size: 1.3em;
    }

    /* 模态框 */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.2s ease;
    }
    .modal-overlay.hidden { display: none; }

    /* 豆包教程弹窗 */
    .doubao-tutorial-modal {
      background: var(--bg-secondary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-xl);
      width: 90%;
      max-width: 800px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      box-shadow: var(--shadow-lg);
      animation: scaleIn 0.3s ease;
    }
    .doubao-tutorial-header {
      padding: 20px 24px;
      border-bottom: 1px solid var(--border-default);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .doubao-tutorial-header h3 {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 1.2em;
      font-weight: 600;
      color: var(--accent-orange);
      margin: 0;
    }
    .doubao-tutorial-close {
      background: none;
      border: none;
      color: var(--text-tertiary);
      cursor: pointer;
      padding: 4px;
      border-radius: var(--radius-sm);
      transition: all 0.2s;
    }
    .doubao-tutorial-close:hover {
      background: var(--bg-tertiary);
      color: var(--text-primary);
    }
    .doubao-tutorial-body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
    }
    .doubao-tutorial-body h2 {
      font-size: 1.3em;
      color: var(--text-primary);
      margin: 24px 0 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border-subtle);
    }
    .doubao-tutorial-body h2:first-child {
      margin-top: 0;
    }
    .doubao-tutorial-body h3 {
      font-size: 1.1em;
      color: var(--text-primary);
      margin: 16px 0 8px;
    }
    .doubao-tutorial-body p {
      margin: 8px 0;
      color: var(--text-secondary);
      line-height: 1.7;
    }
    .doubao-tutorial-body ul, .doubao-tutorial-body ol {
      margin: 8px 0;
      padding-left: 24px;
      color: var(--text-secondary);
    }
    .doubao-tutorial-body li {
      margin: 6px 0;
      line-height: 1.6;
    }
    .doubao-tutorial-body code {
      background: var(--bg-tertiary);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'SF Mono', Monaco, Consolas, monospace;
      font-size: 0.9em;
      color: var(--accent-orange);
    }
    .doubao-tutorial-body pre {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 12px 16px;
      overflow-x: auto;
      margin: 12px 0;
    }
    .doubao-tutorial-body pre code {
      background: none;
      padding: 0;
      color: var(--text-primary);
    }
    .doubao-tutorial-body table {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
    }
    .doubao-tutorial-body th, .doubao-tutorial-body td {
      border: 1px solid var(--border-default);
      padding: 10px 12px;
      text-align: left;
    }
    .doubao-tutorial-body th {
      background: var(--bg-tertiary);
      font-weight: 600;
      color: var(--text-primary);
    }
    .doubao-tutorial-body td {
      color: var(--text-secondary);
    }
    .doubao-tutorial-body .step-box {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 16px;
      margin: 12px 0;
    }
    .doubao-tutorial-body .warning-box {
      background: rgba(234, 179, 8, 0.1);
      border: 1px solid rgba(234, 179, 8, 0.3);
      border-radius: var(--radius-md);
      padding: 16px;
      margin: 12px 0;
      color: var(--warning-color);
    }
    .doubao-tutorial-body .important-box {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: var(--radius-md);
      padding: 16px;
      margin: 12px 0;
    }
    .doubao-tutorial-body a {
      color: var(--accent-blue);
      text-decoration: none;
    }
    .doubao-tutorial-body a:hover {
      text-decoration: underline;
    }
    .doubao-tutorial-footer {
      padding: 16px 24px;
      border-top: 1px solid var(--border-default);
      display: flex;
      justify-content: flex-end;
      flex-shrink: 0;
    }
    .tutorial-help-btn {
      background: none;
      border: 1px solid var(--accent-orange);
      color: var(--accent-orange);
      padding: 4px 10px;
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 12px;
      margin-left: 8px;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .tutorial-help-btn:hover {
      background: var(--accent-orange);
      color: #000;
    }
    .tutorial-help-btn .material-icons {
      font-size: 14px;
    }

    /* 设备切换弹窗 */
    .device-switch-modal {
      background: var(--bg-secondary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-xl);
      width: 90%;
      max-width: 480px;
      box-shadow: var(--shadow-lg);
      animation: scaleIn 0.3s ease;
    }
    .device-switch-header {
      padding: 24px 24px 16px;
      border-bottom: 1px solid var(--border-default);
    }
    .device-switch-header h3 {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 1.2em;
      font-weight: 600;
      color: var(--warning-color);
      margin: 0;
    }
    .device-switch-body {
      padding: 24px;
    }
    .device-switch-body p {
      margin: 0 0 16px;
      color: var(--text-secondary);
      line-height: 1.6;
    }
    .device-switch-info {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 16px;
      margin: 16px 0;
    }
    .device-switch-info ul {
      margin: 8px 0 0;
      padding-left: 20px;
    }
    .device-switch-info li {
      color: var(--text-secondary);
      margin: 8px 0;
    }
    .device-switch-warning {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: rgba(234, 179, 8, 0.1);
      border: 1px solid rgba(234, 179, 8, 0.3);
      border-radius: var(--radius-md);
      color: #eab308;
      font-size: 0.9em;
      margin-top: 16px;
    }
    .device-switch-footer {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      padding: 16px 24px 24px;
    }
    .btn-warning {
      background: linear-gradient(135deg, #f97316, #ea580c);
      color: white;
    }
    .btn-warning:hover {
      background: linear-gradient(135deg, #ea580c, #dc2626);
    }
    .btn-warning:disabled {
      background: var(--bg-tertiary);
      color: var(--text-tertiary);
    }

    /* 冷却期弹窗 */
    .cooldown-info {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 20px;
      text-align: center;
      margin: 16px 0;
    }
    .cooldown-info .time-remaining {
      font-size: 1.5em;
      font-weight: 700;
      color: var(--primary-color);
      margin: 8px 0;
    }
    .cooldown-info .time-detail {
      color: var(--text-tertiary);
      font-size: 0.9em;
    }

    .modal {
      background: var(--bg-secondary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-xl);
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: var(--shadow-lg);
      animation: scaleIn 0.3s ease;
    }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px;
      border-bottom: 1px solid var(--border-default);
    }
    .modal-header h3 {
      font-size: 1.1em;
      font-weight: 600;
    }
    .modal-close {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      color: var(--text-secondary);
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .modal-close:hover { color: var(--text-primary); background: var(--bg-hover); }
    .modal-body {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
    }
    .modal-footer {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      padding: 20px 24px;
      border-top: 1px solid var(--border-default);
    }

    /* 文件浏览器 */
    .path-input-group {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }
    .path-input-group input {
      flex: 1;
      padding: 10px 14px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      font-family: var(--font-mono);
      font-size: 0.9em;
    }
    .path-input-group input:focus {
      outline: none;
      border-color: var(--accent-blue);
    }
    .drives-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .drive-btn {
      padding: 8px 14px;
      background: rgba(60, 131, 246, 0.1);
      border: 1px solid var(--border-accent);
      border-radius: var(--radius-sm);
      color: var(--accent-blue);
      cursor: pointer;
      font-family: var(--font-mono);
      font-size: 0.85em;
      font-weight: 500;
    }
    .drive-btn:hover { background: rgba(60, 131, 246, 0.2); }
    .folder-list {
      max-height: 300px;
      overflow-y: auto;
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      background: var(--bg-tertiary);
    }
    .folder-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      cursor: pointer;
      border-bottom: 1px solid var(--border-subtle);
      transition: background 0.2s ease;
    }
    .folder-item:last-child { border-bottom: none; }
    .folder-item:hover { background: var(--bg-hover); }
    .folder-item.selected { background: rgba(60, 131, 246, 0.1); }
    .folder-item-icon { font-size: 1.2em; }
    .folder-item-name { flex: 1; font-family: var(--font-mono); font-size: 0.9em; }
    .folder-empty {
      padding: 32px;
      text-align: center;
      color: var(--text-muted);
    }

    /* 免责声明 */
    .disclaimer {
      font-size: 0.8em;
      color: var(--text-muted);
      line-height: 1.6;
      padding: 16px;
      background: var(--bg-tertiary);
      border-radius: var(--radius-md);
      margin-top: 16px;
    }

    /* 快速决策指引 */
    .decision-guide {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-default);
      border-radius: var(--radius-md);
      padding: 16px;
      margin-top: 20px;
    }
    .decision-guide-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      font-weight: 500;
      color: var(--text-secondary);
    }
    .decision-guide-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .decision-guide-list li {
      padding: 8px 0;
      font-size: 0.9em;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .decision-guide-list li strong {
      color: var(--accent-blue);
    }

    /* 隐藏类 */
    .hidden { display: none !important; }

    /* 响应式 */
    @media (max-width: 768px) {
      .header { padding: 0 16px; }
      .main-container { padding: 80px 16px 40px; }
      .card { padding: 24px 20px; }
      .stepper { gap: 0; padding: 0; }
      .step-connector { width: 30px; }
      .step-label { display: none; }
      .btn-group { flex-direction: column; }
      .btn-group .btn { width: 100%; }
      .option-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
${renderBodyContent(ctx, getPlatformTips)}
${renderScriptContent(ctx)}
</body>
</html>`;
}

/**
 * 发送 Setup 页面
 * @param res - HTTP 响应对象
 * @param gatewayToken - 可选的 gateway token，用于跳转时携带
 */
export function serveSetupPage(res: ServerResponse, gatewayToken?: string): void {
  const html = generateSetupPageHtml(gatewayToken);
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.end(html);
}
