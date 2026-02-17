/**
 * 个人微信渠道 UI 视图
 * Personal WeChat Channel UI View (via ClawChat Bridge)
 *
 * 通过 ClawChat 桥接服务接入个人微信
 */

import { html, nothing } from "lit";

import { formatAgo } from "../format";
import { t } from "../i18n/index.js";
import type { ChannelAccountSnapshot } from "../types";
import type { ChannelsProps, OpenclawwechatStatus } from "./channels.types";
import { renderChannelConfigSection } from "./channels.config";
import { isUnconfiguredError, errorCalloutClass } from "./channels.shared";

// 重新导出类型以保持向后兼容
export type { OpenclawwechatStatus } from "./channels.types";

export function renderOpenclawwechatCard(params: {
  props: ChannelsProps;
  openclawwechat?: OpenclawwechatStatus;
  openclawwechatAccounts: ChannelAccountSnapshot[];
  accountCountLabel: unknown;
}) {
  const { props, openclawwechat, openclawwechatAccounts } = params;
  const hasMultipleAccounts = openclawwechatAccounts.length > 1;

  const renderAccountCard = (account: ChannelAccountSnapshot) => {
    const label = account.name || account.accountId;
    return html`
      <div class="account-card">
        <div class="account-card-header">
          <div class="account-card-title">${label}</div>
          <div class="account-card-id">${account.accountId}</div>
        </div>
        <div class="status-list account-card-status">
          <div>
            <span class="label">${t("common.running")}</span>
            <span>${account.running ? t("common.yes") : t("common.no")}</span>
          </div>
          <div>
            <span class="label">${t("channels.configured")}</span>
            <span>${account.configured ? t("common.yes") : t("common.no")}</span>
          </div>
          <div>
            <span class="label">${t("sessions.lastActivity")}</span>
            <span>${account.lastInboundAt ? formatAgo(account.lastInboundAt) : t("common.na")}</span>
          </div>
          ${account.lastError
            ? html`
                <div class="${isUnconfiguredError(account.lastError) ? "account-card-muted" : "account-card-error"}">
                  ${account.lastError}
                </div>
              `
            : nothing}
        </div>
      </div>
    `;
  };

  // 状态徽章
  const statusBadge = openclawwechat?.running
    ? html`<span class="channel-card__badge channel-card__badge--ok">
        <span class="status-dot status-dot--running"></span>
        ${t("common.running")}
      </span>`
    : openclawwechat?.configured
      ? html`<span class="channel-card__badge channel-card__badge--warn">
          <span class="status-dot status-dot--configured"></span>
          ${t("common.stopped")}
        </span>`
      : html`<span class="channel-card__badge">
          <span class="status-dot status-dot--unconfigured"></span>
          ${t("channels.notConfigured")}
        </span>`;

  // 箭头图标
  const chevronIcon = html`<svg class="channel-card__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

  // 卡片样式类
  const cardClasses = [
    "channel-card",
    openclawwechat?.running ? "channel-card--running" : "",
    openclawwechat?.configured && !openclawwechat?.running ? "channel-card--configured" : "",
    openclawwechat?.lastError ? (isUnconfiguredError(openclawwechat.lastError) ? "channel-card--unconfigured" : "channel-card--error") : "",
  ].filter(Boolean).join(" ");

  // 自动展开：运行中 或 有真实错误
  const shouldOpen = openclawwechat?.running || (openclawwechat?.lastError != null && !isUnconfiguredError(openclawwechat.lastError));

  // 功能特性标签
  const features = html`
    <div class="channel-card__features">
      <span class="feature-tag">文本</span>
      <span class="feature-tag">图片</span>
      <span class="feature-tag">视频</span>
      <span class="feature-tag">文档</span>
      <span class="feature-tag feature-tag--highlight">无需翻墙</span>
    </div>
  `;

  return html`
    <details class="${cardClasses}" ?open=${shouldOpen}>
      <summary class="channel-card__header">
        <div class="channel-card__left">
          <span class="channel-card__icon">💬</span>
          <span class="channel-card__title">微信 (个人号)</span>
          <div class="channel-card__status">
            ${statusBadge}
          </div>
        </div>
        ${chevronIcon}
      </summary>
      <div class="channel-card__body">
        <div class="channel-card__desc">个人微信渠道 — 通过 ClawChat 桥接服务接入，无需企业认证，无需翻墙</div>
        ${features}

        ${hasMultipleAccounts
          ? html`
              <div class="account-card-list">
                ${openclawwechatAccounts.map((account) => renderAccountCard(account))}
              </div>
            `
          : (openclawwechat?.configured || openclawwechat?.running)
            ? html`
              <div class="status-list">
                <div>
                  <span class="label">${t("channels.configured")}</span>
                  <span class="status-value ${openclawwechat?.configured ? 'status-value--yes' : 'status-value--no'}">
                    ${openclawwechat?.configured ? t("common.yes") : t("common.no")}
                  </span>
                </div>
                <div>
                  <span class="label">${t("common.running")}</span>
                  <span class="status-value ${openclawwechat?.running ? 'status-value--yes' : 'status-value--no'}">
                    ${openclawwechat?.running ? t("common.yes") : t("common.no")}
                  </span>
                </div>
                <div>
                  <span class="label">${t("channels.lastStart")}</span>
                  <span>${openclawwechat?.lastStartAt ? formatAgo(openclawwechat.lastStartAt) : t("common.na")}</span>
                </div>
              </div>
            `
            : nothing}

        ${openclawwechat?.lastError
          ? html`<div class="${errorCalloutClass(openclawwechat.lastError)}" style="margin-top: 12px;">
              ${openclawwechat.lastError}
            </div>`
          : nothing}

        <!-- 配置帮助 - 详细指南 -->
        <details class="channel-card__help" style="margin-top: 16px;">
          <summary class="channel-card__help-title">
            📖 个人微信配置教程
            <span class="help-badge">详细教程</span>
          </summary>
          <div class="channel-card__help-content">
            <div class="callout" style="margin-bottom: 16px;">
              <strong>💡 工作原理：</strong>个人微信消息 → ClawChat 桥接服务器 → OpenClawCN AI → 回复到微信。
              无需公网 IP，无需企业认证，个人微信号即可使用。
            </div>

            <div style="margin-bottom: 16px; padding: 12px; background: var(--bg-elevated); border-radius: 8px; border-left: 3px solid var(--accent);">
              <strong style="font-size: 13px;">第一部分：上游 ClawChat 桥接服务配置</strong>
            </div>

            <div class="config-steps">
              <div class="config-step">
                <div class="step-number">1</div>
                <div class="step-content">
                  <strong>注册 ClawChat 账号</strong>
                  <p>在微信中搜索「ClawChat」小程序，或访问 ClawChat 官网</p>
                  <p>使用微信扫码注册 / 登录 ClawChat 账号</p>
                </div>
              </div>

              <div class="config-step">
                <div class="step-number">2</div>
                <div class="step-content">
                  <strong>绑定个人微信号</strong>
                  <p>进入 ClawChat 小程序，按照引导完成个人微信号绑定</p>
                  <p>绑定后，你的个人微信收到的消息会被转发到桥接服务器</p>
                </div>
              </div>

              <div class="config-step">
                <div class="step-number">3</div>
                <div class="step-content">
                  <strong>生成 API Key</strong>
                  <p>进入 ClawChat →「我的」→「APIKey 管理」→ 点击「生成 APIKey」</p>
                  <p>格式为 <code>bot_id:secret</code>（包含冒号），请完整复制</p>
                </div>
              </div>
            </div>

            <div style="margin: 16px 0 16px; padding: 12px; background: var(--bg-elevated); border-radius: 8px; border-left: 3px solid var(--accent);">
              <strong style="font-size: 13px;">第二部分：OpenClawCN 端配置</strong>
            </div>

            <div class="config-steps">
              <div class="config-step">
                <div class="step-number">4</div>
                <div class="step-content">
                  <strong>填写 API Key</strong>
                  <p>在下方配置表单中填入你的 ClawChat API Key</p>
                  <p>或通过配置文件设置：<code style="display: inline-block; margin-top: 4px; padding: 2px 6px; background: var(--bg-elevated); border-radius: 4px; font-size: 12px;">plugins.entries.openclawwechat.config.apiKey</code></p>
                  <p>或通过命令行向导：<code style="display: inline-block; margin-top: 4px; padding: 2px 6px; background: var(--bg-elevated); border-radius: 4px; font-size: 12px;">openclawcn setup</code></p>
                </div>
              </div>

              <div class="config-step">
                <div class="step-number">5</div>
                <div class="step-content">
                  <strong>启动网关并测试</strong>
                  <p>启动网关：<code style="padding: 2px 6px; background: var(--bg-elevated); border-radius: 4px; font-size: 12px;">openclawcn gateway run</code></p>
                  <p>在微信中给绑定的个人号发送一条消息，约 2 秒内即可收到 AI 回复</p>
                </div>
              </div>
            </div>

            <div class="callout warning" style="margin-top: 12px;">
              <strong>⚠️ 注意：</strong>API Key 中包含冒号（:），系统会自动处理 URL 编码，无需手动修改。
            </div>

            <div class="callout" style="margin-top: 8px;">
              <strong>🔍 调试提示：</strong>若未收到回复，在配置中设置 <code>debug: true</code>，然后执行 <code>openclawcn logs --follow</code> 查看日志。
            </div>
          </div>
        </details>

        ${renderChannelConfigSection({ channelId: "openclawwechat", props })}
      </div>
    </details>
  `;
}
