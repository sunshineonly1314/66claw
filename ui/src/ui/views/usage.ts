/**
 * Token 使用量详情页面
 * 展示详细的使用量统计和图表
 */
import { html } from "lit";
import type { CostUsageSummary, CostUsageDailyEntry } from "../types";
import { formatTokenCount, formatCost } from "../controllers/usage";
import { t } from "../i18n/index.js";

export type UsageProps = {
  connected: boolean;
  loading: boolean;
  summary: CostUsageSummary | null;
  error: string | null;
  days: number;
  onDaysChange: (days: number) => void;
  onRefresh: () => void;
};

/**
 * 渲染使用量详情页面
 */
export function renderUsage(props: UsageProps) {
  return html`
    <section class="usage-page">
      ${renderUsageHeader(props)}
      ${props.loading
        ? renderLoading()
        : props.error
          ? renderError(props.error)
          : props.summary
            ? renderUsageContent(props.summary, props.days)
            : renderNoData()}
    </section>
  `;
}

function renderUsageHeader(props: UsageProps) {
  return html`
    <div class="usage-page__header">
      <div class="usage-page__title-section">
        <h2 class="usage-page__title">${t("usage.title")}</h2>
        <p class="usage-page__subtitle">${t("usage.subtitle")}</p>
      </div>
      <div class="usage-page__controls">
        <select
          class="usage-days-select"
          .value=${String(props.days)}
          @change=${(e: Event) => {
            const value = Number((e.target as HTMLSelectElement).value);
            props.onDaysChange(value);
          }}
          ?disabled=${!props.connected || props.loading}
        >
          <option value="7">${t("usage.days7")}</option>
          <option value="14">${t("usage.days14")}</option>
          <option value="30">${t("usage.days30")}</option>
        </select>
        <button
          class="btn btn--sm"
          @click=${props.onRefresh}
          ?disabled=${!props.connected || props.loading}
        >
          ${t("usage.refreshData")}
        </button>
      </div>
    </div>
  `;
}

function renderLoading() {
  return html`
    <div class="usage-loading">
      <div class="usage-loading__spinner"></div>
      <div class="usage-loading__text">${t("common.loading")}</div>
    </div>
  `;
}

function renderError(error: string) {
  return html`
    <div class="callout danger">${error}</div>
  `;
}

function renderNoData() {
  return html`
    <div class="usage-empty">
      <div class="usage-empty__icon">📊</div>
      <div class="usage-empty__title">${t("usage.noData")}</div>
    </div>
  `;
}

function renderUsageContent(summary: CostUsageSummary, days: number) {
  const { totals, daily } = summary;

  return html`
    <!-- 总计卡片 -->
    <div class="usage-totals-grid">
      <div class="usage-total-card">
        <div class="usage-total-card__label">${t("usage.totalTokens")}</div>
        <div class="usage-total-card__value">${formatTokenCount(totals.totalTokens)}</div>
        <div class="usage-total-card__sub">${t("usage.last30Days")}</div>
      </div>
      <div class="usage-total-card">
        <div class="usage-total-card__label">${t("usage.totalCost")}</div>
        <div class="usage-total-card__value">${formatCost(totals.totalCost)}</div>
        <div class="usage-total-card__sub">${t("usage.estimatedCost")}</div>
      </div>
      <div class="usage-total-card">
        <div class="usage-total-card__label">${t("usage.inputTokens")}</div>
        <div class="usage-total-card__value">${formatTokenCount(totals.input)}</div>
        <div class="usage-total-card__sub">${t("usage.tokens")}</div>
      </div>
      <div class="usage-total-card">
        <div class="usage-total-card__label">${t("usage.outputTokens")}</div>
        <div class="usage-total-card__value">${formatTokenCount(totals.output)}</div>
        <div class="usage-total-card__sub">${t("usage.tokens")}</div>
      </div>
    </div>

    <!-- 每日使用量图表 -->
    <div class="card" style="margin-top: 24px;">
      <div class="card-title">${t("usage.dailyUsage")}</div>
      <div class="card-sub">${t("usage.tokenBreakdown")}</div>
      ${renderDailyChart(daily)}
    </div>

    <!-- 每日明细表格 -->
    <div class="card" style="margin-top: 24px;">
      <div class="card-title">${t("usage.costBreakdown")}</div>
      ${renderDailyTable(daily)}
    </div>

    <!-- 更新时间 -->
    <div class="usage-footer">
      <span class="muted">
        ${t("usage.lastUpdated")}: ${new Date(summary.updatedAt).toLocaleString()}
      </span>
    </div>
  `;
}

/**
 * 渲染每日使用量柱状图
 */
function renderDailyChart(daily: CostUsageDailyEntry[]) {
  if (!daily || daily.length === 0) {
    return html`<div class="muted" style="padding: 20px 0;">No daily data</div>`;
  }

  const sorted = [...daily].sort((a, b) => a.date.localeCompare(b.date));
  const maxTokens = Math.max(...sorted.map((d) => d.totalTokens), 1);

  return html`
    <div class="usage-chart" style="margin-top: 20px;">
      <div class="usage-chart__bars">
        ${sorted.map((day) => {
          const inputHeight = (day.input / maxTokens) * 100;
          const outputHeight = (day.output / maxTokens) * 100;
          const dayLabel = day.date.slice(-5); // MM-DD

          return html`
            <div class="usage-chart__bar-group" title="${day.date}&#10;Input: ${formatTokenCount(day.input)}&#10;Output: ${formatTokenCount(day.output)}&#10;Total: ${formatTokenCount(day.totalTokens)}&#10;Cost: ${formatCost(day.totalCost)}">
              <div class="usage-chart__stacked-bar">
                <div class="usage-chart__bar usage-chart__bar--output" style="height: ${outputHeight}%"></div>
                <div class="usage-chart__bar usage-chart__bar--input" style="height: ${inputHeight}%"></div>
              </div>
              <div class="usage-chart__label">${dayLabel}</div>
            </div>
          `;
        })}
      </div>
      <div class="usage-chart__legend">
        <span class="usage-chart__legend-item">
          <span class="usage-chart__legend-color usage-chart__legend-color--input"></span>
          ${t("usage.inputTokens")}
        </span>
        <span class="usage-chart__legend-item">
          <span class="usage-chart__legend-color usage-chart__legend-color--output"></span>
          ${t("usage.outputTokens")}
        </span>
      </div>
    </div>
  `;
}

/**
 * 渲染每日明细表格
 */
function renderDailyTable(daily: CostUsageDailyEntry[]) {
  if (!daily || daily.length === 0) {
    return html`<div class="muted" style="padding: 20px 0;">No daily data</div>`;
  }

  const sorted = [...daily].sort((a, b) => b.date.localeCompare(a.date)); // 最新的在前

  return html`
    <div class="usage-table-container" style="margin-top: 16px;">
      <table class="usage-table">
        <thead>
          <tr>
            <th>Date</th>
            <th class="text-right">${t("usage.inputTokens")}</th>
            <th class="text-right">${t("usage.outputTokens")}</th>
            <th class="text-right">${t("usage.cacheRead")}</th>
            <th class="text-right">${t("usage.totalTokens")}</th>
            <th class="text-right">${t("usage.totalCost")}</th>
          </tr>
        </thead>
        <tbody>
          ${sorted.map(
            (day) => html`
              <tr>
                <td>${day.date}</td>
                <td class="text-right">${formatTokenCount(day.input)}</td>
                <td class="text-right">${formatTokenCount(day.output)}</td>
                <td class="text-right">${formatTokenCount(day.cacheRead)}</td>
                <td class="text-right"><strong>${formatTokenCount(day.totalTokens)}</strong></td>
                <td class="text-right">${formatCost(day.totalCost)}</td>
              </tr>
            `,
          )}
        </tbody>
      </table>
    </div>
  `;
}
