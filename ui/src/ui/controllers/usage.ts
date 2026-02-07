/**
 * Token 使用量统计控制器
 * 调用 Gateway 的 usage.cost API 获取使用量数据
 */
import type { CostUsageSummary } from "../types";
import { t } from "../i18n/index.js";

type UsageHost = {
  client: { request: (method: string, params?: unknown) => Promise<unknown> } | null;
  connected: boolean;
  usageLoading: boolean;
  usageSummary: CostUsageSummary | null;
  usageError: string | null;
  usageDays: number;
};

/**
 * 加载 Token 使用量统计数据
 * @param host - 应用宿主对象
 * @param days - 查询天数，默认使用 host.usageDays
 */
export async function loadUsageSummary(
  host: UsageHost,
  days?: number,
): Promise<void> {
  if (!host.client || !host.connected) {
    host.usageError = "Not connected to gateway";
    return;
  }

  const queryDays = days ?? host.usageDays;
  host.usageLoading = true;
  host.usageError = null;

  try {
    const result = await host.client.request("usage.cost", { days: queryDays });
    host.usageSummary = result as CostUsageSummary;
    host.usageDays = queryDays;
  } catch (err) {
    host.usageError = t("usage.error.loadFailed", { error: String(err) });
    host.usageSummary = null;
  } finally {
    host.usageLoading = false;
  }
}

/**
 * 格式化 Token 数量为可读字符串
 * @param value - Token 数量
 * @returns 格式化后的字符串（如 1.2K, 3.5M）
 */
export function formatTokenCount(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0";
  if (value < 1000) return String(Math.round(value));
  if (value < 1_000_000) return `${(value / 1000).toFixed(1)}K`;
  if (value < 1_000_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  return `${(value / 1_000_000_000).toFixed(2)}B`;
}

/**
 * 格式化费用为可读字符串
 * @param value - 费用（人民币）
 * @returns 格式化后的字符串
 */
export function formatCost(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "¥0.00";
  if (value < 0.01) return `¥${value.toFixed(4)}`;
  if (value < 1) return `¥${value.toFixed(3)}`;
  if (value < 100) return `¥${value.toFixed(2)}`;
  return `¥${value.toFixed(0)}`;
}

/**
 * 获取今日使用量
 * @param summary - 使用量摘要
 * @returns 今日使用量数据，如果没有则返回 null
 */
export function getTodayUsage(summary: CostUsageSummary | null): {
  totalTokens: number;
  totalCost: number;
  input: number;
  output: number;
} | null {
  if (!summary || !summary.daily || summary.daily.length === 0) return null;

  // 获取今天的日期字符串（本地时区）
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const todayEntry = summary.daily.find((entry) => entry.date === today);
  if (!todayEntry) return null;

  return {
    totalTokens: todayEntry.totalTokens,
    totalCost: todayEntry.totalCost,
    input: todayEntry.input,
    output: todayEntry.output,
  };
}

/**
 * 计算使用量趋势（与前一天相比）
 * @param summary - 使用量摘要
 * @returns 趋势对象，包含变化百分比和方向
 */
export function getUsageTrend(summary: CostUsageSummary | null): {
  direction: "up" | "down" | "stable";
  percentage: number;
} | null {
  if (!summary || !summary.daily || summary.daily.length < 2) return null;

  const sorted = [...summary.daily].sort((a, b) => b.date.localeCompare(a.date));
  if (sorted.length < 2) return null;

  const today = sorted[0].totalTokens;
  const yesterday = sorted[1].totalTokens;

  if (yesterday === 0) {
    return today > 0 ? { direction: "up", percentage: 100 } : { direction: "stable", percentage: 0 };
  }

  const change = ((today - yesterday) / yesterday) * 100;
  if (Math.abs(change) < 1) return { direction: "stable", percentage: 0 };
  return {
    direction: change > 0 ? "up" : "down",
    percentage: Math.abs(Math.round(change)),
  };
}
