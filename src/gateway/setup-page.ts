/**
 * Setup Page HTML Generator
 * ClawbotCN 安装向导页面 - 基于 Stitch 设计风格 + PRD 内容
 */

import type { ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  CN_PROVIDERS,
  AFFILIATE_LINKS,
} from "../config/region-cn.js";

/**
 * 获取 logo 图片的 base64 数据 URL
 */
function getLogoBase64(): string {
  try {
    // 获取 assets 目录路径（相对于 src/gateway/setup-page.ts）
    const assetsDir = path.resolve(import.meta.dirname, "../../assets");
    const logoPath = path.join(assetsDir, "dmg-background.png");
    const imageBuffer = fs.readFileSync(logoPath);
    return `data:image/png;base64,${imageBuffer.toString("base64")}`;
  } catch {
    // 如果读取失败，返回空字符串，后续会使用 fallback SVG
    return "";
  }
}

/**
 * 检测当前运行平台和版本
 */
function detectPlatformInfo(): {
  os: string;
  variant: "lite" | "pro";
  sandboxType: string;
  icon: string;
  displayName: string;
} {
  const platform = os.platform();
  // 检测是否有 Docker（Pro 版本）
  const hasDocker = process.env.CLAWDBOT_DOCKER === "1" || process.env.DOCKER_HOST;
  const variant = hasDocker ? "pro" : "lite";

  if (platform === "darwin") {
    return {
      os: "macOS",
      variant: "lite",
      sandboxType: "软沙盒（目录隔离）",
      icon: "🍎",
      displayName: "macOS Lite 版",
    };
  } else if (platform === "win32") {
    return {
      os: "Windows",
      variant,
      sandboxType: variant === "pro" ? "Docker 容器沙盒" : "轻量沙盒",
      icon: "🪟",
      displayName: `Windows ${variant === "pro" ? "Pro" : "Lite"} 版`,
    };
  } else {
    return {
      os: "Linux",
      variant,
      sandboxType: variant === "pro" ? "Docker 容器沙盒" : "轻量沙盒",
      icon: "🐧",
      displayName: `Linux ${variant === "pro" ? "Pro" : "Lite"} 版`,
    };
  }
}

/**
 * 获取平台默认工作目录
 */
function getDefaultWorkspace(): string {
  const platform = os.platform();
  if (platform === "win32") {
    return "C:\\Clawdbot\\workspace";
  } else if (platform === "darwin") {
    return "~/.clawbotcn/workspace";
  } else {
    return "/opt/clawdbot/workspace";
  }
}

/**
 * 生成 Setup 页面 HTML - 严格按照 PRD 文档
 * @param gatewayToken - 当前 gateway token，用于重启后跳转时携带
 */
export function generateSetupPageHtml(gatewayToken?: string): string {
  const providers = Object.values(CN_PROVIDERS);
  const affiliates = Object.values(AFFILIATE_LINKS);
  const platformInfo = detectPlatformInfo();
  const defaultWorkspace = getDefaultWorkspace();
  const logoBase64 = getLogoBase64();
  // 将 token 注入到页面中，供 JavaScript 使用
  const tokenScript = gatewayToken 
    ? `<script>window.__GATEWAY_TOKEN__ = ${JSON.stringify(gatewayToken)};</script>`
    : `<script>window.__GATEWAY_TOKEN__ = null;</script>`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ClawbotCN 安装向导</title>
  ${tokenScript}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
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

    /* 提供商网格布局 */
    .provider-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    @media (max-width: 900px) {
      .provider-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
    @media (max-width: 600px) {
      .provider-grid {
        grid-template-columns: 1fr;
      }
    }
    .provider-grid .option-card {
      padding: 16px;
      display: flex;
      flex-direction: column;
      min-height: 100px;
    }
    .provider-grid .option-card-header {
      margin-bottom: 6px;
    }
    .provider-grid .option-icon {
      width: 36px;
      height: 36px;
      font-size: 1.1em;
    }
    .provider-grid .option-desc {
      font-size: 0.8em;
      line-height: 1.4;
      flex: 1;
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
       Step 2 安全设置页面优化样式
       ============================================ */
    
    /* 安全设置卡片优化 */
    #page2 .card-header h2 {
      font-size: 1.8em;
      margin-bottom: 12px;
    }
    #page2 .card-header p {
      font-size: 1.1em;
      color: var(--text-secondary);
    }

    /* 沙盒说明简化 */
    .sandbox-intro {
      background: linear-gradient(135deg, rgba(60, 131, 246, 0.08) 0%, rgba(60, 131, 246, 0.02) 100%);
      border: 1px solid rgba(60, 131, 246, 0.2);
      border-radius: var(--radius-lg);
      padding: 20px 24px;
      margin-bottom: 24px;
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }
    .sandbox-intro-icon {
      font-size: 2em;
      line-height: 1;
    }
    .sandbox-intro-content {
      flex: 1;
    }
    .sandbox-intro-title {
      font-size: 1.1em;
      font-weight: 600;
      color: var(--accent-blue-light);
      margin-bottom: 6px;
    }
    .sandbox-intro-text {
      font-size: 1em;
      color: var(--text-secondary);
      line-height: 1.6;
    }

    /* 风险提示简化 */
    .risk-banner {
      background: linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(249, 115, 22, 0.03) 100%);
      border: 1px solid rgba(249, 115, 22, 0.3);
      border-radius: var(--radius-lg);
      padding: 20px 24px;
      margin-bottom: 32px;
    }
    .risk-banner-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }
    .risk-banner-icon {
      font-size: 1.5em;
    }
    .risk-banner-title {
      font-size: 1.1em;
      font-weight: 600;
      color: var(--accent-orange);
    }
    .risk-banner-content {
      font-size: 1em;
      color: var(--text-secondary);
      line-height: 1.8;
    }
    .risk-banner-highlight {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(249, 115, 22, 0.15);
      padding: 4px 12px;
      border-radius: 6px;
      color: var(--accent-orange);
      font-weight: 500;
      margin-top: 12px;
    }

    /* 安全模式选择卡片优化 */
    .security-options {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 28px;
    }
    @media (max-width: 900px) {
      .security-options {
        grid-template-columns: 1fr;
        gap: 16px;
      }
    }
    .security-card {
      background: var(--bg-tertiary);
      border: 2px solid var(--border-default);
      border-radius: var(--radius-xl);
      padding: 24px;
      cursor: pointer;
      transition: all 0.25s ease;
      position: relative;
      display: flex;
      flex-direction: column;
    }
    .security-card:hover {
      border-color: var(--border-accent);
      background: var(--bg-hover);
      transform: translateY(-2px);
    }
    .security-card.selected {
      border-color: var(--accent-blue);
      background: rgba(60, 131, 246, 0.08);
      box-shadow: 0 0 20px rgba(60, 131, 246, 0.2);
    }
    .security-card.recommended {
      border-color: var(--accent-blue);
    }
    .security-card.recommended::before {
      content: '⭐ 推荐';
      position: absolute;
      top: -12px;
      left: 20px;
      background: linear-gradient(135deg, #3c83f6 0%, #60a5fa 100%);
      color: white;
      padding: 4px 14px;
      border-radius: 12px;
      font-size: 0.8em;
      font-weight: 600;
    }
    .security-card-icon {
      font-size: 2.5em;
      margin-bottom: 16px;
      text-align: center;
    }
    .security-card-title {
      font-size: 1.2em;
      font-weight: 600;
      text-align: center;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .security-card-desc {
      font-size: 0.95em;
      color: var(--text-secondary);
      line-height: 1.6;
      text-align: center;
      flex: 1;
    }
    .security-card-tag {
      display: inline-block;
      background: var(--bg-elevated);
      color: var(--text-muted);
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.75em;
      font-weight: 500;
    }
    .security-card-footer {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--border-subtle);
      text-align: center;
      font-size: 0.85em;
      color: var(--text-muted);
    }
    /* 安全模式优缺点说明 */
    .security-card-pros,
    .security-card-cons {
      font-size: 0.88em;
      line-height: 1.5;
      padding: 8px 12px;
      border-radius: 8px;
      margin-top: 10px;
      text-align: left;
    }
    .security-card-pros {
      background: rgba(76, 175, 80, 0.1);
      color: #4caf50;
      border: 1px solid rgba(76, 175, 80, 0.2);
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
    }
    .channel-config-help:hover {
      background: rgba(60, 131, 246, 0.2);
    }
    .channel-config-help .material-icons {
      font-size: 1.1em;
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

    /* 服务说明区域 */
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

    /* 服务凭证卡片 */
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
  <!-- 顶部导航栏 -->
  <header class="header">
    <div class="header-logo">
      ${logoBase64 ? `<img src="${logoBase64}" alt="ClawbotCN Logo" />` : `<svg viewBox="0 0 32 32" fill="none">
        <rect width="32" height="32" rx="8" fill="url(#logo-gradient)"/>
        <path d="M8 12h16M8 16h12M8 20h8" stroke="white" stroke-width="2" stroke-linecap="round"/>
        <defs>
          <linearGradient id="logo-gradient" x1="0" y1="0" x2="32" y2="32">
            <stop stop-color="#3c83f6"/>
            <stop offset="1" stop-color="#60a5fa"/>
          </linearGradient>
        </defs>
      </svg>`}
      <span>ClawbotCN</span>
    </div>
    <div class="header-env">
      <span class="icon">${platformInfo.icon}</span>
      <span>当前环境: ${platformInfo.displayName} · ${platformInfo.sandboxType}</span>
    </div>
  </header>

  <main class="main-container">
    <!-- 步骤进度条 -->
    <div class="stepper">
      <div class="step-item active" id="stepItem1">
        <div class="step-circle">1</div>
        <div class="step-label">AI服务</div>
      </div>
      <div class="step-connector" id="connector1"></div>
      <div class="step-item" id="stepItem2">
        <div class="step-circle">2</div>
        <div class="step-label">安全设置</div>
      </div>
      <div class="step-connector" id="connector2"></div>
      <div class="step-item" id="stepItem3">
        <div class="step-circle">3</div>
        <div class="step-label">工作目录</div>
      </div>
      <div class="step-connector" id="connector3"></div>
      <div class="step-item" id="stepItem4">
        <div class="step-circle">4</div>
        <div class="step-label">指挥渠道</div>
      </div>
      <div class="step-connector" id="connector4"></div>
      <div class="step-item" id="stepItem5">
        <div class="step-circle">5</div>
        <div class="step-label">产品验证</div>
      </div>
      <div class="step-connector" id="connector5"></div>
      <div class="step-item" id="stepItem6">
        <div class="step-circle"><span class="material-icons" style="font-size:18px;">check</span></div>
        <div class="step-label">完成</div>
      </div>
    </div>

    <!-- Step 1: 选择 AI 服务 -->
    <div id="page1" class="card">
      <div class="card-header">
        <h2>第一步：选择 AI 服务</h2>
        <p>选择你要使用的 AI 平台，或者注册一个新账号</p>
      </div>

      <div class="alert alert-info">
        <span class="alert-icon">💡</span>
        <div class="alert-content">
          <div class="alert-title">新用户推荐</div>
          硅基流动（首选推荐，免费送 Token，聚合多家顶尖大模型）
        </div>
      </div>

      <div class="provider-grid" id="providerList">
        ${providers.map((p) => `
        <div class="option-card${p.id === 'siliconflow' ? ' featured' : ''}" data-provider="${p.id}" onclick="selectProvider('${p.id}')">
          <div class="option-card-header">
            <div class="option-icon">${getProviderIcon(p.id)}</div>
            <div style="flex:1;">
              <span class="option-title">${p.name}</span>
              ${p.id === 'siliconflow' ? '<span class="option-badge hot">🔥 推荐</span>' : ''}
            </div>
          </div>
          <div class="option-desc">${p.description}</div>
          <div class="option-check"><span class="material-icons" style="font-size:16px;">check</span></div>
        </div>
        `).join('')}
      </div>

      <div id="affiliateSection" class="affiliate-section">
        <div class="affiliate-header">
          <span>🚀</span>
          还没有接入过大模型？点击开通账号 →
        </div>
        <div class="affiliate-grid">
          <a href="https://cloud.siliconflow.cn/i/uXXX7IEi" target="_blank" class="affiliate-card featured">
            <div class="affiliate-icon">🔮</div>
            <div class="affiliate-info">
              <div class="affiliate-name">
                硅基流动
                <span class="badge hot">⭐ 首选</span>
                <span class="badge free">免费送Token</span>
              </div>
              <div class="affiliate-benefit">聚合 DeepSeek、Qwen、GLM 等顶尖模型</div>
            </div>
            <span class="affiliate-arrow material-icons">arrow_forward</span>
          </a>
          <a href="https://www.aliyun.com/daily-act/ecs/activity_selection?source=5176.29345612&userCode=xsngby7y" target="_blank" class="affiliate-card">
            <div class="affiliate-icon">☁️</div>
            <div class="affiliate-info">
              <div class="affiliate-name">
                阿里云百炼
                <span class="badge free">送100万Token</span>
              </div>
              <div class="affiliate-benefit">通义千问 Qwen 系列，国内访问最快</div>
            </div>
            <span class="affiliate-arrow material-icons">arrow_forward</span>
          </a>
          <a href="https://curl.qcloud.com/7r5iz507" target="_blank" class="affiliate-card">
            <div class="affiliate-icon">💫</div>
            <div class="affiliate-info">
              <div class="affiliate-name">
                腾讯混元
              </div>
              <div class="affiliate-benefit">混元大模型，腾讯云生态</div>
            </div>
            <span class="affiliate-arrow material-icons">arrow_forward</span>
          </a>
          <a href="https://www.tbox.cn/login?invitation=5gKu1AUyRDxR22NH" target="_blank" class="affiliate-card">
            <div class="affiliate-icon">🐜</div>
            <div class="affiliate-info">
              <div class="affiliate-name">
                蚂蚁百灵
              </div>
              <div class="affiliate-benefit">蚂蚁集团大模型平台</div>
            </div>
            <span class="affiliate-arrow material-icons">arrow_forward</span>
          </a>
          <a href="https://bigmodel.cn/special_area" target="_blank" class="affiliate-card">
            <div class="affiliate-icon">🧠</div>
            <div class="affiliate-info">
              <div class="affiliate-name">
                智谱 GLM
              </div>
              <div class="affiliate-benefit">GLM-4 系列，支持视觉理解</div>
            </div>
            <span class="affiliate-arrow material-icons">arrow_forward</span>
          </a>
        </div>
      </div>

      <div id="apiKeyForm" class="hidden" style="margin-top: 24px;">
        <div class="form-group">
          <label class="form-label" id="apiKeyLabel">API Key</label>
          <div class="password-input-wrapper">
            <input type="password" class="form-input mono" id="apiKeyInput" placeholder="请输入 API Key">
            <button type="button" class="password-toggle" onclick="togglePasswordVisibility()">
              <span class="material-icons" id="passwordIcon">visibility</span>
            </button>
          </div>
          <div class="form-help" id="apiKeyHelp">在对应平台的控制台获取 API Key</div>
        </div>

        <!-- 模型选择 -->
        <div class="form-group" id="modelSelectGroup" style="margin-top: 20px;">
          <label class="form-label">选择模型</label>
          <div class="model-select-wrapper">
            <select class="form-input model-select" id="modelSelect">
              <option value="">-- 请先选择 AI 平台 --</option>
            </select>
          </div>
          <div class="form-help" id="modelHelp">选择你要使用的 AI 模型，推荐使用默认模型</div>
        </div>

        <div id="apiKeyStatus" class="status-message"></div>
      </div>

      <div class="btn-group">
        <button class="btn btn-primary" onclick="nextStep(1)" id="step1Next" disabled>
          下一步
          <span class="material-icons">arrow_forward</span>
        </button>
      </div>
    </div>

    <!-- Step 2: 安全设置 -->
    <div id="page2" class="card hidden">
      <div class="card-header">
        <h2>第二步：安全设置</h2>
        <p>选择 AI 助手的权限级别，保护你的数据安全</p>
      </div>

      <!-- 沙盒简介 -->
      <div class="sandbox-intro">
        <div class="sandbox-intro-icon">🛡️</div>
        <div class="sandbox-intro-content">
          <div class="sandbox-intro-title">什么是「沙盒」？</div>
          <div class="sandbox-intro-text">
            沙盒 = AI 的「活动范围」。超出范围的文件，AI 碰不到、改不了。
          </div>
        </div>
      </div>

      <!-- 风险提示 -->
      <div class="risk-banner">
        <div class="risk-banner-header">
          <span class="risk-banner-icon">⚠️</span>
          <span class="risk-banner-title">安全提示</span>
        </div>
        <div class="risk-banner-content">
          AI 存在「提示词注入」风险 —— 恶意文档可能诱导 AI 执行危险操作。
          <div class="risk-banner-highlight">
            <span class="material-icons" style="font-size:18px;">tips_and_updates</span>
            建议：使用独立设备部署，或选择「智能模式」
          </div>
        </div>
      </div>

      <!-- 选择提示 -->
      <div class="selection-hint">
        <span class="material-icons">touch_app</span>
        请在下方选择一种安全保护模式
      </div>

      <!-- 安全模式选择 - 新布局 -->
      <div class="security-options" id="securityList">
        <div class="security-card" data-security="full" onclick="selectSecurity('full')">
          <div class="security-card-icon">🛡️</div>
          <div class="security-card-title">安全模式</div>
          <div class="security-card-desc">
            AI 无法执行系统操作，只能对话和浏览网页。所有操作都在沙盒内进行，最安全。
          </div>
          <div class="security-card-pros">✅ 适合：有重要文件、共用电脑、不信任AI</div>
          <div class="security-card-cons">❌ 限制：无法执行命令、无法读写本地文件</div>
          <div class="security-card-footer">
            🔐 最高安全级别
          </div>
          <div class="security-card-check"><span class="material-icons" style="font-size:18px;">check</span></div>
        </div>

        <div class="security-card recommended selected" data-security="standard" onclick="selectSecurity('standard')">
          <div class="security-card-icon">🔒</div>
          <div class="security-card-title">智能模式</div>
          <div class="security-card-desc">
            常用操作直接执行，敏感操作会询问你。兼顾体验与安全的最佳平衡。
          </div>
          <div class="security-card-pros">✅ 适合：日常工作电脑、大部分用户</div>
          <div class="security-card-footer">
            ⭐ 推荐大多数用户选择
          </div>
          <div class="security-card-check"><span class="material-icons" style="font-size:18px;">check</span></div>
        </div>

        <div class="security-card" data-security="trust" onclick="selectSecurity('trust')">
          <div class="security-card-icon">⚡</div>
          <div class="security-card-title">
            专家模式
            <span class="security-card-warning">⚠️ 需谨慎</span>
          </div>
          <div class="security-card-desc">
            解锁全部能力，完整系统权限，风险自担。
          </div>
          <div class="security-card-pros">✅ 适合：独立设备、技术高手</div>
          <div class="security-card-cons danger">⚠️ 风险：AI 可能误删文件、执行危险命令</div>
          <div class="security-card-footer">
            ⚡ 完全信任 AI
          </div>
          <div class="security-card-check"><span class="material-icons" style="font-size:18px;">check</span></div>
        </div>
      </div>

      <!-- 快速决策 -->
      <div class="quick-decision">
        <div class="quick-decision-title">
          <span class="material-icons" style="font-size:22px;">help_outline</span>
          不知道选哪个？
        </div>
        <div class="quick-decision-items">
          <div class="quick-decision-item" onclick="doSelectSecurity('standard')">
            <div class="scenario">💻 主力电脑 & 兼顾体验与安全</div>
            <div class="result">→ 智能模式（推荐）</div>
          </div>
          <div class="quick-decision-item" onclick="doSelectSecurity('full')">
            <div class="scenario">🔒 有敏感数据 & 追求极致安全</div>
            <div class="result">→ 安全模式</div>
          </div>
          <div class="quick-decision-item" onclick="selectSecurity('trust')">
            <div class="scenario">🖥️ 独立设备 & 技术大佬探索可能性</div>
            <div class="result">→ 专家模式</div>
          </div>
        </div>
      </div>

      <!-- 免责声明和同意条款 -->
      <div class="agreement-section">
        <div class="agreement-text">
          ⚠️ <strong>风险声明</strong>：使用本软件即表示您已了解并接受相关风险。AI 助手可能因误操作或恶意提示词注入而造成数据丢失、文件损坏等问题，开发者不承担因使用不当造成的任何责任。
        </div>
        <div class="agreement-checkbox" id="agreementCheckbox">
          <input type="checkbox" id="agreeTerms" onclick="updateAgreement()">
          <label for="agreeTerms">我已阅读并同意上述风险声明</label>
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

    <!-- Step 3: 设置隔离工作目录 -->
    <div id="page3" class="card hidden">
      <div class="card-header">
        <h2>第三步：设置工作目录</h2>
        <p>指定 AI 可以操作的文件夹范围</p>
      </div>

      <!-- 当前模式状态卡片 -->
      <div class="mode-status-card" id="modeStatusCard">
        <div class="mode-status-icon">🔒</div>
        <div class="mode-status-content">
          <div class="mode-status-label">当前安全模式</div>
          <div class="mode-status-value" id="currentModeDisplay">智能模式</div>
        </div>
        <div class="mode-status-desc" id="modeStatusDesc">
          AI 只能访问下方指定的工作目录
        </div>
      </div>

      <!-- 核心操作区 - 选择工作目录 -->
      <div class="workspace-section">
        <div class="workspace-header">
          <div class="workspace-header-icon">📁</div>
          <div class="workspace-header-text">
            <div class="workspace-header-title">选择 AI 的工作目录</div>
            <div class="workspace-header-subtitle">AI 只能在这个文件夹内读写文件，无法访问其他位置</div>
          </div>
        </div>
        
        <div class="workspace-input-area">
          <div class="workspace-input-wrapper">
            <span class="workspace-input-icon material-icons">folder</span>
            <input type="text" class="workspace-input" id="workspaceInput" placeholder="点击右侧按钮选择文件夹..." value="${defaultWorkspace}" readonly>
          </div>
          <button type="button" class="workspace-browse-btn" onclick="browseWorkspace()">
            <span class="material-icons">folder_open</span>
            浏览选择
          </button>
        </div>

        <div class="workspace-tip">
          <span class="workspace-tip-icon">💡</span>
          <span class="workspace-tip-text">建议：创建一个专用文件夹（如 <code>D:\\AI工作区</code>），不要选择「文档」或「桌面」</span>
        </div>
      </div>

      <!-- 额外信任目录 - 折叠 -->
      <div class="extra-dirs-section" id="trustedDirsSection">
        <div class="extra-dirs-header" onclick="toggleExtraDirs()">
          <div class="extra-dirs-title">
            <span class="material-icons">add_circle_outline</span>
            添加额外信任目录（可选）
          </div>
          <span class="extra-dirs-arrow material-icons" id="extraDirsArrow">expand_more</span>
        </div>
        <div class="extra-dirs-content hidden" id="extraDirsContent">
          <div class="extra-dirs-hint">
            如果 AI 需要访问工作目录以外的其他文件夹，可以在这里添加
          </div>
          <div id="trustedDirsList" class="dir-list">
            <div class="dir-empty">暂未添加额外目录</div>
          </div>
          <button type="button" class="btn btn-secondary" onclick="addTrustedDir()" style="width: 100%; margin-top: 12px;">
            <span class="material-icons">add</span>
            添加目录
          </button>
        </div>
      </div>

      <div class="btn-group">
        <button class="btn btn-secondary" onclick="prevStep(3)">
          <span class="material-icons">arrow_back</span>
          上一步
        </button>
        <button class="btn btn-primary btn-lg" onclick="nextStep(3)" id="step3Next">
          下一步
          <span class="material-icons">arrow_forward</span>
        </button>
      </div>
    </div>

    <!-- Step 4: 配置指挥渠道 -->
    <div id="page4" class="card hidden">
      <div class="card-header">
        <h2>第四步：配置指挥渠道</h2>
        <p>选择并配置你的聊天应用，让 AI 助手可以接收指令</p>
      </div>

      <div class="alert alert-info" style="background: linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.05) 100%); border-color: var(--accent-green);">
        <span class="alert-icon">✨</span>
        <div class="alert-content">
          <strong>建议直接配置！</strong>配置后即可通过钉钉/飞书向 AI 发送消息。如果暂时没有，可以点击「跳过」稍后配置。
        </div>
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
        <div class="channel-tab disabled" data-channel="wecom">
          <span class="channel-tab-icon">💼</span>
          <span class="channel-tab-name">企业微信</span>
          <span class="channel-tab-badge">即将支持</span>
        </div>
      </div>

      <!-- 钉钉配置表单 -->
      <div id="dingtalkConfigForm" class="channel-config-form">
        <div class="channel-config-header">
          <span class="channel-config-icon">📱</span>
          <div>
            <div class="channel-config-title">钉钉机器人配置</div>
            <div class="channel-config-subtitle">在钉钉开放平台创建企业内部应用获取以下信息</div>
          </div>
          <a href="https://open.dingtalk.com/document/orgapp/create-an-interface-based-chatbot" target="_blank" class="channel-config-help">
            <span class="material-icons">help_outline</span>
            配置教程
          </a>
        </div>

        <div class="channel-config-fields">
          <div class="form-group">
            <label class="form-label">App Key <span class="required">*</span></label>
            <input type="text" class="form-input mono" id="dingtalkAppKey" placeholder="例如：dingxxxxxxxx">
            <div class="form-help">在钉钉开放平台 → 应用信息 → 凭证与基础信息中获取</div>
          </div>
          <div class="form-group">
            <label class="form-label">App Secret <span class="required">*</span></label>
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
            <div class="form-help">用于接收来自钉钉的消息回调</div>
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
            <div class="channel-config-subtitle">在飞书开放平台创建企业自建应用获取以下信息</div>
          </div>
          <a href="https://open.feishu.cn/document/home/develop-a-bot-in-5-minutes/create-an-app" target="_blank" class="channel-config-help">
            <span class="material-icons">help_outline</span>
            配置教程
          </a>
        </div>

        <div class="channel-config-fields">
          <div class="form-group">
            <label class="form-label">App ID <span class="required">*</span></label>
            <input type="text" class="form-input mono" id="feishuAppId" placeholder="例如：cli_xxxxxxxx">
            <div class="form-help">在飞书开放平台 → 凭证与基础信息中获取</div>
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
            <div class="form-help">在「事件订阅」页面的 Encrypt Key</div>
          </div>
          <div class="form-group">
            <label class="form-label">Verification Token（可选）</label>
            <input type="text" class="form-input mono" id="feishuVerificationToken" placeholder="事件订阅的验证 Token">
          </div>
        </div>

        <div id="feishuConfigStatus" class="status-message"></div>
      </div>

      <div class="btn-group" style="margin-top: 24px;">
        <button class="btn btn-secondary" onclick="prevStep(4)">
          <span class="material-icons">arrow_back</span>
          上一步
        </button>
        <button class="btn btn-ghost" onclick="skipChannels()">
          跳过，稍后配置
        </button>
        <button class="btn btn-primary" onclick="saveChannelConfig()" id="saveChannelBtn">
          <span class="material-icons">save</span>
          保存并继续
        </button>
      </div>
    </div>

    <!-- Step 5: 服务验证 -->
    <div id="page5" class="card hidden">
      <div class="card-header">
        <h2>第五步：服务激活</h2>
        <p>输入服务凭证，获取技术支持与汉化服务</p>
      </div>

      <div id="licenseFormSection">
        <!-- 说明区域 -->
        <div class="service-intro">
          <div class="service-intro-header">
            <span class="service-intro-icon">📋</span>
            <span class="service-intro-title">服务说明</span>
          </div>
          <div class="service-intro-content">
            <p><strong>ClawbotCN 基于开源项目二次开发</strong>，软件本身免费使用。</p>
            <p style="margin-top: 8px;">我们提供的<strong>增值服务</strong>包括：</p>
            <ul class="service-list">
              <li>📚 中文使用教程与文档</li>
              <li>🌐 国内 AI 平台适配与汉化（UI、Skills适配）</li>
              <li>💬 AI 技术咨询 - tecbinAI</li>
              <li>🔧 不定期更新与版本维护</li>
            </ul>
          </div>
        </div>

        <!-- 获取服务凭证 -->
        <div class="license-card">
          <div class="license-card-icon">🎫</div>
          <div class="license-card-title">获取服务凭证</div>
          <div class="license-card-desc">支持我们的汉化工作，获取完整服务体验</div>
          <a href="https://m.tb.cn/h.7Jaij2B?tk=FT4gU7cFsKQ" target="_blank" class="btn btn-primary">
            <span class="material-icons">redeem</span>
            获取服务凭证
          </a>
          <div class="license-card-note">
            在闲鱼搜索「ClawbotCN」或点击上方按钮
          </div>
        </div>

        <!-- 输入凭证 -->
        <div class="form-group" style="margin-top: 24px;">
          <label class="form-label">输入服务凭证</label>
          <input type="text" class="form-input mono" id="licenseTokenInput" placeholder="请输入获取的服务凭证...">
          <div class="form-help" style="margin-top: 8px;">
            凭证用于验证您的服务订阅状态
          </div>
        </div>

        <div id="licenseStatus" class="status-message"></div>

        <div class="btn-group">
          <button class="btn btn-secondary" onclick="prevStep(5)">
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
        <div class="success-desc">感谢支持我们的汉化与服务工作！</div>
        <div class="success-expires" id="licenseExpiresText"></div>
      </div>
    </div>

    <!-- Step 6: 完成重启 -->
    <div id="page6" class="card hidden">
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
        <li class="summary-item">
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
          <span class="summary-item-label">指挥渠道</span>
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
          <li>前往「指挥渠道」页面完成钉钉/飞书的详细配置</li>
          <li>把需要处理的文件放到工作目录</li>
          <li>随时可以在设置中调整配置</li>
          <li>Skills 仓库: <a href="https://gitee.com/tecbinai/skills" target="_blank" style="color: var(--accent-blue);">gitee.com/tecbinai/skills</a></li>
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

      <div id="restartStatus" class="status-message" style="margin-bottom: 16px;"></div>

      <button class="launch-button" id="launchButton" onclick="restartAndRedirect()">
        <span class="material-icons">rocket_launch</span>
        点击重启，进入你的 ClawbotCN 世界
      </button>
    </div>
  </main>

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

  <!-- 撒花容器 -->
  <div id="confettiContainer" class="confetti-container"></div>

  <script>
    // ==================== 状态管理 ====================
    let currentStep = 1;
    let selectedProvider = null;
    let selectedSecurity = 'standard';
    let selectedChannels = [];
    let trustedDirs = [];
    let licenseValidated = false;
    let licenseExpires = null;

    const providerNames = ${JSON.stringify(Object.fromEntries(providers.map(p => [p.id, p.name])))};
    const securityModeNames = { full: '安全模式', standard: '智能模式', trust: '专家模式' };
    const channelNames = { dingtalk: '钉钉', feishu: '飞书', wecom: '企业微信' };

    // ==================== 步骤导航 ====================
    function goToStep(step) {
      currentStep = step;
      
      // 更新页面显示
      for (let i = 1; i <= 6; i++) {
        const page = document.getElementById('page' + i);
        if (page) page.classList.toggle('hidden', i !== step);
        
        const stepItem = document.getElementById('stepItem' + i);
        if (stepItem) {
          stepItem.classList.toggle('active', i === step);
          stepItem.classList.toggle('completed', i < step);
        }
        
        if (i < 6) {
          const connector = document.getElementById('connector' + i);
          if (connector) connector.classList.toggle('completed', i < step);
        }
      }
      
      // 更新 Step 6 的完成状态
      const stepItem6 = document.getElementById('stepItem6');
      if (stepItem6 && step === 6) {
        stepItem6.classList.add('completed');
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

        const btn = document.getElementById('step1Next');
        btn.disabled = true;
        btn.innerHTML = '<span class="status-spinner"></span> 验证中...';

        // 先验证 API Key 是否有效
        showStatus('apiKeyStatus', '正在验证 API Key...', 'loading');
        try {
          const modelToUse = selectedModel || document.getElementById('modelSelect').value;
          const verifyRes = await fetch('/api/setup/verify-apikey', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: selectedProvider, apiKey: apiKey, model: modelToUse })
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
          const res = await fetch('/api/setup/configure-provider', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: selectedProvider, apiKey: apiKey, model: modelToUse })
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
          // 滚动到同意条款位置
          checkboxWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // 移除错误状态
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
        
        try {
          await fetch('/api/setup/configure-security', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: selectedSecurity, trustedDirs: [] })
          });
        } catch (e) {
          console.warn('保存安全设置时出错:', e);
        }
        
        // 更新 Step 3 显示
        updateSecurityModeDisplay();
      }

      if (step === 3) {
        const workspace = document.getElementById('workspaceInput').value.trim();
        if (selectedSecurity !== 'trust' && !workspace) {
          alert('请选择主工作目录');
          return;
        }

        try {
          if (workspace) {
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
              trustedDirs: selectedSecurity !== 'trust' ? trustedDirs : [] 
            })
          });
        } catch (e) {
          alert('保存失败: ' + e.message);
          return;
        }
      }

      if (step === 4) {
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

      // 重置 Step 4 按钮
      const saveChannelBtn = document.getElementById('saveChannelBtn');
      if (saveChannelBtn) {
        saveChannelBtn.disabled = false;
        saveChannelBtn.innerHTML = '<span class="material-icons">save</span> 保存并继续';
      }

      // 重置 Step 5 按钮
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
    const providerModels = ${JSON.stringify(Object.fromEntries(
      providers.map(p => [p.id, p.models.map(m => ({ id: m.id, name: m.name, description: m.description, recommended: m.recommended }))])
    ))};
    
    const defaultModels = {
      'siliconflow': 'deepseek-ai/DeepSeek-V3',
      'aliyun-bailian': 'qwen-plus',
      'deepseek': 'deepseek-chat',
      'glm': 'glm-4-plus',
      'volcengine-ark': 'Doubao-Seed-1.8',
      'tencent-hunyuan': 'hunyuan-pro',
      'minimax': 'MiniMax-M2.1'
    };
    
    let selectedModel = null;

    function selectProvider(id) {
      selectedProvider = id;
      document.querySelectorAll('#providerList .option-card').forEach(el => {
        el.classList.toggle('selected', el.dataset.provider === id);
        // 保持 featured 类
        if (el.dataset.provider === 'siliconflow') {
          el.classList.add('featured');
        }
      });
      document.getElementById('apiKeyForm').classList.remove('hidden');
      document.getElementById('apiKeyLabel').textContent = providerNames[id] + ' API Key';
      
      // 根据提供商更新 API Key 帮助信息
      const apiKeyHelp = document.getElementById('apiKeyHelp');
      const apiKeyHelpTexts = {
        'siliconflow': '在 <a href="https://cloud.siliconflow.cn/account/ak" target="_blank">硅基流动控制台</a> 获取 API Key',
        'aliyun-bailian': '在 <a href="https://bailian.console.aliyun.com/" target="_blank">阿里云百炼控制台</a> 获取 API Key',
        'deepseek': '在 <a href="https://platform.deepseek.com/api_keys" target="_blank">DeepSeek 控制台</a> 获取 API Key',
        'glm': '在 <a href="https://open.bigmodel.cn/usercenter/apikeys" target="_blank">智谱 AI 开放平台</a> 获取 API Key',
        'volcengine-ark': '在 <a href="https://console.volcengine.com/ark" target="_blank">火山引擎控制台</a> 获取 API Key 和模型 ID',
        'tencent-hunyuan': '在 <a href="https://console.cloud.tencent.com/hunyuan" target="_blank">腾讯云混元控制台</a> 获取 Secret ID 和 Secret Key',
        'minimax': '在 <a href="https://platform.minimaxi.com/user-center/basic-information/interface-key" target="_blank">MiniMax 开放平台</a> 获取 API Key（不需要 Group ID）'
      };
      apiKeyHelp.innerHTML = apiKeyHelpTexts[id] || '在对应平台的控制台获取 API Key';
      
      // 更新模型选择
      updateModelSelect(id);
      
      document.getElementById('step1Next').disabled = false;
    }
    
    function updateModelSelect(providerId) {
      const select = document.getElementById('modelSelect');
      const models = providerModels[providerId] || [];
      const defaultModel = defaultModels[providerId];
      
      let html = '';
      models.forEach(m => {
        const isDefault = m.id === defaultModel;
        const isRecommended = m.recommended;
        const label = m.name + (isDefault ? ' ⭐ 推荐' : '') + (m.description ? ' - ' + m.description : '');
        html += '<option value="' + m.id + '"' + (isDefault ? ' selected' : '') + '>' + label + '</option>';
      });
      
      if (html === '') {
        html = '<option value="">使用默认模型</option>';
      }
      
      select.innerHTML = html;
      selectedModel = defaultModel || (models[0]?.id || null);
      
      // 更新帮助文本
      const helpText = document.getElementById('modelHelp');
      if (providerId === 'siliconflow') {
        helpText.textContent = '推荐 DeepSeek-V3，性能强劲';
      } else if (providerId === 'aliyun-bailian') {
        helpText.textContent = '推荐 Qwen-Plus，性价比最高';
      } else {
        helpText.textContent = '已为你选择该平台的推荐模型';
      }
    }
    
    document.getElementById('modelSelect').addEventListener('change', function() {
      selectedModel = this.value;
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
      document.querySelectorAll('#securityList .security-card, #securityList .option-card').forEach(el => {
        el.classList.toggle('selected', el.dataset.security === mode);
      });
      window.trustModeConfirmed = (mode === 'trust');
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
      const workspaceSection = document.querySelector('.workspace-section');
      
      if (modeDisplay) modeDisplay.textContent = securityModeNames[selectedSecurity];
      
      if (selectedSecurity === 'trust') {
        // 专家模式
        if (modeStatusIcon) modeStatusIcon.textContent = '⚡';
        if (modeStatusDesc) modeStatusDesc.textContent = '⚠️ AI 拥有完整系统权限，请谨慎操作';
        if (modeStatusCard) {
          modeStatusCard.style.borderColor = 'var(--accent-orange)';
          modeStatusCard.style.background = 'linear-gradient(135deg, rgba(249, 115, 22, 0.12) 0%, rgba(249, 115, 22, 0.04) 100%)';
        }
        if (modeDisplay) modeDisplay.style.color = 'var(--accent-orange)';
        if (trustedSection) trustedSection.style.display = 'none';
        if (workspaceSection) workspaceSection.style.display = 'none';
      } else if (selectedSecurity === 'full') {
        // 安全模式
        if (modeStatusIcon) modeStatusIcon.textContent = '🛡️';
        if (modeStatusDesc) modeStatusDesc.textContent = '🔐 AI 所有操作都在沙盒内，无法访问外部文件';
        if (modeStatusCard) {
          modeStatusCard.style.borderColor = 'var(--accent-green)';
          modeStatusCard.style.background = 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(34, 197, 94, 0.04) 100%)';
        }
        if (modeDisplay) modeDisplay.style.color = 'var(--accent-green)';
        if (trustedSection) trustedSection.style.display = 'block';
        if (workspaceSection) workspaceSection.style.display = 'block';
      } else {
        // 智能模式（默认）
        if (modeStatusIcon) modeStatusIcon.textContent = '🔒';
        if (modeStatusDesc) modeStatusDesc.textContent = '常用操作直接执行，敏感操作会询问你';
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

    // ==================== Step 4: 指挥渠道 ====================
    let currentChannelTab = 'dingtalk';

    function selectChannelTab(channelId) {
      if (channelId === 'wecom') return; // 企业微信暂不支持
      
      currentChannelTab = channelId;
      
      // 更新 tab 选中状态
      document.querySelectorAll('.channel-tab').forEach(el => {
        el.classList.toggle('selected', el.dataset.channel === channelId);
      });
      
      // 显示对应的配置表单
      document.getElementById('dingtalkConfigForm').classList.toggle('hidden', channelId !== 'dingtalk');
      document.getElementById('feishuConfigForm').classList.toggle('hidden', channelId !== 'feishu');
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
      const btn = document.getElementById('saveChannelBtn');
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

      if (!hasConfig) {
        // 没有配置任何渠道，提示用户
        const confirmSkip = confirm('您还没有配置任何指挥渠道。\\n\\n建议配置钉钉或飞书以便与 AI 助手交互。\\n\\n确定要跳过吗？');
        if (confirmSkip) {
          skipChannels();
        }
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<span class="status-spinner"></span> 验证凭证中...';

      // 确定当前显示的状态区域
      const statusEl = configData.dingtalk ? 'dingtalkConfigStatus' : 'feishuConfigStatus';

      try {
        // 显示验证中状态
        if (configData.dingtalk) {
          showStatus('dingtalkConfigStatus', '正在验证钉钉凭证...', 'loading');
        }
        if (configData.feishu) {
          showStatus('feishuConfigStatus', '正在验证飞书凭证...', 'loading');
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
          } else {
            showStatus(statusEl, '❌ ' + errorMsg, 'error');
          }
          btn.disabled = false;
          btn.innerHTML = '<span class="material-icons">save</span> 保存并继续';
          return;
        }

        // 显示成功状态
        if (configData.dingtalk) {
          showStatus('dingtalkConfigStatus', '✓ 钉钉凭证验证成功', 'success');
        }
        if (configData.feishu) {
          showStatus('feishuConfigStatus', '✓ 飞书凭证验证成功', 'success');
        }
        
        await delay(800);
        goToStep(5);
      } catch (e) {
        showStatus(statusEl, '保存失败: ' + e.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons">save</span> 保存并继续';
      }
    }

    function skipChannels() {
      selectedChannels = [];
      goToStep(5);
    }

    // ==================== Step 5: 产品验证 ====================
    async function validateLicense() {
      const token = document.getElementById('licenseTokenInput').value.trim();
      if (!token) {
        showStatus('licenseStatus', '请输入许可证 Token', 'error');
        return;
      }
      
      const btn = document.getElementById('validateLicenseBtn');
      btn.disabled = true;
      btn.innerHTML = '<span class="status-spinner"></span> 验证中...';
      showStatus('licenseStatus', '正在验证许可证，请稍候...', 'loading');
      
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
          
          // 延迟后自动进入下一步
          await delay(2500);
          goToStep(6);
          showSummary();
        } else {
          throw new Error(data.data?.error || data.error || '许可证无效');
        }
      } catch (e) {
        showStatus('licenseStatus', '验证失败: ' + e.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons">verified</span> 验证许可证';
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

    // ==================== Step 6: 完成 ====================
    function showSummary() {
      document.getElementById('summaryProvider').textContent = providerNames[selectedProvider] || selectedProvider;
      document.getElementById('summarySecurity').textContent = securityModeNames[selectedSecurity];
      const workspacePath = document.getElementById('workspaceInput').value || '未设置';
      document.getElementById('summaryWorkspace').textContent = workspacePath;
      
      const channelsText = selectedChannels.length > 0 
        ? selectedChannels.map(c => channelNames[c] || c).join('、')
        : '暂未配置';
      document.getElementById('summaryChannels').textContent = channelsText;
      
      if (selectedSecurity !== 'trust' && trustedDirs.length > 0) {
        document.getElementById('summaryTrustedDirsRow').classList.remove('hidden');
        document.getElementById('summaryTrustedDirs').textContent = trustedDirs.length + ' 个目录';
      }
      
      if (licenseExpires) {
        const expDate = new Date(licenseExpires);
        document.getElementById('summaryLicense').innerHTML = '已激活 <span style="color: var(--text-muted); font-size: 0.85em;">(有效期至 ' + expDate.toLocaleDateString('zh-CN') + ')</span>';
      }
      
      // 更新平台提示中的工作目录路径
      const platformTipsList = document.getElementById('platformTipsList');
      if (platformTipsList && workspacePath !== '未设置') {
        platformTipsList.innerHTML = platformTipsList.innerHTML.replace(
          /工作目录位于: <code>[^<]+<\\/code>/g,
          '工作目录位于: <code>' + workspacePath.replace(/\\\\/g, '\\\\\\\\') + '</code>'
        );
      }
    }

    async function restartAndRedirect() {
      const btn = document.getElementById('launchButton');
      const statusEl = document.getElementById('restartStatus');
      
      btn.disabled = true;
      btn.innerHTML = '<span class="status-spinner"></span> 正在重启...';
      showStatus('restartStatus', '正在保存配置并重启 Gateway...', 'loading');
      
      // 获取当前的 gateway token（从页面注入的变量）
      const gatewayToken = window.__GATEWAY_TOKEN__;
      
      // 构建带 token 的跳转 URL
      const buildRedirectUrl = () => {
        const url = new URL('/', window.location.origin);
        if (gatewayToken) {
          url.searchParams.set('token', gatewayToken);
        }
        return url.toString();
      };
      
      try {
        await fetch('/api/setup/complete', { method: 'POST' });
        await fetch('/api/setup/restart', { method: 'POST' });
        
        showStatus('restartStatus', '重启中，等待服务恢复...', 'loading');
        
        let retries = 0;
        const maxRetries = 45; // 增加重试次数，从30增加到45
        const initialDelay = 3000; // 初始等待3秒，让gateway有时间关闭和启动
        
        const checkReady = async () => {
          try {
            const res = await fetch('/api/setup/state', { 
              method: 'GET',
              signal: AbortSignal.timeout(3000) // 增加超时时间到3秒
            });
            if (res.ok) {
              showStatus('restartStatus', '✓ 重启成功！正在跳转...', 'success');
              await delay(800);
              window.location.href = buildRedirectUrl();
              return;
            }
          } catch {}
          
          retries++;
          if (retries < maxRetries) {
            statusEl.querySelector('.status-message') && (statusEl.innerHTML = '<span class="status-spinner"></span> 重启中，等待服务恢复... (' + retries + 's)');
            setTimeout(checkReady, 1000);
          } else {
            showStatus('restartStatus', '重启可能需要更长时间，正在跳转...', 'loading');
            await delay(1000);
            window.location.href = buildRedirectUrl();
          }
        };
        
        setTimeout(checkReady, initialDelay); // 使用更长的初始等待时间
      } catch (e) {
        showStatus('restartStatus', '重启失败: ' + e.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons">refresh</span> 重试';
      }
    }

    // ==================== 工具函数 ====================
    function showStatus(elementId, message, type) {
      const el = document.getElementById(elementId);
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

    // ==================== 初始化 ====================
    window.trustModeConfirmed = false;
    renderTrustedDirs();
  </script>
</body>
</html>`;
}

/**
 * 获取提供商图标
 */
function getProviderIcon(providerId: string): string {
  const icons: Record<string, string> = {
    'aliyun-bailian': '☁️',
    'siliconflow': '🔮',
    'deepseek': '🔍',
    'glm': '🧠',
    'volcengine-ark': '🌋',
    'tencent-hunyuan': '💫',
    'minimax': '⚡',
  };
  return icons[providerId] || '🤖';
}

/**
 * 获取平台特定提示
 */
function getPlatformTips(platformInfo: ReturnType<typeof detectPlatformInfo>): string {
  if (platformInfo.os === 'macOS') {
    return `
      <li>如遇到「无法验证开发者」提示，请在终端执行：<code>xattr -cr /Applications/ClawbotCN</code></li>
      <li>工作目录位于: <code>~/.clawbotcn/workspace</code></li>
    `;
  } else if (platformInfo.os === 'Windows') {
    if (platformInfo.variant === 'pro') {
      return `
        <li>请确保 Docker Desktop 正在运行</li>
        <li>首次启动可能需要拉取沙盒镜像（约 80MB）</li>
        <li>工作目录位于: <code>C:\\Clawdbot\\workspace</code></li>
      `;
    } else {
      return `
        <li>工作目录位于: <code>C:\\Clawdbot\\workspace</code></li>
        <li>可通过开始菜单或桌面快捷方式启动</li>
      `;
    }
  } else {
    return `
      <li>启动服务: <code>sudo systemctl start clawdbot</code></li>
      <li>开机自启: <code>sudo systemctl enable clawdbot</code></li>
      <li>查看日志: <code>journalctl -u clawdbot -f</code></li>
    `;
  }
}

/**
 * 发送 Setup 页面
 * @param res - HTTP 响应对象
 * @param gatewayToken - 可选的 gateway token，用于重启后跳转时携带
 */
export function serveSetupPage(res: ServerResponse, gatewayToken?: string): void {
  const html = generateSetupPageHtml(gatewayToken);
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.end(html);
}
