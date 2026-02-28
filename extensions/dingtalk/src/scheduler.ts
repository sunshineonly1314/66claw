/**
 * 钉钉定时消息模块
 * DingTalk Scheduled Messaging Module
 *
 * 支持通过 cron 表达式配置定时消息，自动向指定用户发送模板消息。
 *
 * Cron 格式: 分 时 日 月 周 (5 段标准格式)
 * 示例:
 *   "0 9 * * 1-5"  → 工作日每天 9:00
 *   "30 18 * * *"  → 每天 18:30
 *   "0 0 1 * *"    → 每月 1 日 0:00
 */

import { sendDingtalkMessage } from "./api.js";
import type { DingtalkChannelConfig, DingtalkScheduledTask } from "./types.js";

// ============================================================================
// 常量
// ============================================================================

/** 调度器轮询间隔: 60 秒 */
const POLL_INTERVAL_MS = 60_000;

/** 星期名称映射 */
const WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

type LogInterface = {
  info?: (msg: string) => void;
  warn?: (msg: string) => void;
  error?: (msg: string) => void;
};

// ============================================================================
// Cron 解析器
// ============================================================================

/**
 * 判断当前时间是否匹配 cron 表达式
 *
 * 支持的语法:
 * - 固定值: "5"
 * - 通配符: "*"
 * - 范围: "1-5"
 * - 列表: "1,3,5"
 * - 步长: "* /10" (每隔 10)
 */
export function matchesCron(cron: string, date: Date): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const minute = date.getMinutes();
  const hour = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1; // 1-12
  const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat

  // 周日: getDay() 返回 0，但 cron 中 0 和 7 都表示周日
  // 需要同时检查 value=0 和 value=7 的匹配
  const dayOfWeekMatch =
    matchesCronField(parts[4], dayOfWeek, 0, 6) ||
    (dayOfWeek === 0 && matchesCronField(parts[4], 7, 0, 7));

  return (
    matchesCronField(parts[0], minute, 0, 59) &&
    matchesCronField(parts[1], hour, 0, 23) &&
    matchesCronField(parts[2], dayOfMonth, 1, 31) &&
    matchesCronField(parts[3], month, 1, 12) &&
    dayOfWeekMatch
  );
}

function matchesCronField(field: string, value: number, min: number, max: number): boolean {
  // 通配符
  if (field === "*") return true;

  // 列表: "1,3,5"
  const parts = field.split(",");
  for (const part of parts) {
    // 步长: "*/10" 或 "1-5/2"
    const [rangeStr, stepStr] = part.split("/");
    const step = stepStr ? parseInt(stepStr, 10) : 1;

    if (isNaN(step) || step <= 0) continue;

    if (rangeStr === "*") {
      // "*/step"
      if ((value - min) % step === 0) return true;
    } else if (rangeStr.includes("-")) {
      // 范围: "1-5"
      const [startStr, endStr] = rangeStr.split("-");
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (isNaN(start) || isNaN(end)) continue;
      if (value >= start && value <= end && (value - start) % step === 0) return true;
    } else {
      // 固定值: "5"
      const exact = parseInt(rangeStr, 10);
      if (!isNaN(exact) && value === exact) return true;
    }
  }

  return false;
}

// ============================================================================
// 模板引擎
// ============================================================================

/**
 * 替换消息模板中的变量
 *
 * 支持变量:
 * - {date}    → 2026-02-28
 * - {time}    → 14:30
 * - {weekday} → 周五
 * - {year}    → 2026
 * - {month}   → 02
 * - {day}     → 28
 */
function renderTemplate(template: string, date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");

  return template
    .replace(/\{date\}/g, `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`)
    .replace(/\{time\}/g, `${pad(date.getHours())}:${pad(date.getMinutes())}`)
    .replace(/\{weekday\}/g, WEEKDAY_NAMES[date.getDay()])
    .replace(/\{year\}/g, String(date.getFullYear()))
    .replace(/\{month\}/g, pad(date.getMonth() + 1))
    .replace(/\{day\}/g, pad(date.getDate()));
}

// ============================================================================
// 调度器
// ============================================================================

/**
 * 启动定时消息调度器
 */
export function startScheduler(
  config: DingtalkChannelConfig,
  log?: LogInterface,
): { stop: () => void } {
  const tasks = config.scheduledTasks;
  if (!tasks || tasks.length === 0) {
    log?.info?.(`[DingTalk][Scheduler] 无定时任务配置，调度器未启动`);
    return { stop: () => {} };
  }

  const enabledTasks = tasks.filter((t) => t.enabled !== false);
  log?.info?.(`[DingTalk][Scheduler] 启动调度器，${enabledTasks.length}/${tasks.length} 个任务已启用`);

  // 记录上次执行的分钟，避免同一分钟重复触发
  let lastCheckedMinute = -1;

  const timer = setInterval(() => {
    const now = new Date();
    const currentMinute = now.getHours() * 60 + now.getMinutes();

    // 同一分钟内不重复检查
    if (currentMinute === lastCheckedMinute) return;
    lastCheckedMinute = currentMinute;

    for (const task of enabledTasks) {
      if (matchesCron(task.cron, now)) {
        executeTask(config, task, now, log).catch((err) => {
          log?.error?.(`[DingTalk][Scheduler] 任务 ${task.id} 执行失败: ${err}`);
        });
      }
    }
  }, POLL_INTERVAL_MS);

  return {
    stop: () => {
      clearInterval(timer);
      log?.info?.(`[DingTalk][Scheduler] 调度器已停止`);
    },
  };
}

/**
 * 执行单个定时任务
 */
async function executeTask(
  config: DingtalkChannelConfig,
  task: DingtalkScheduledTask,
  now: Date,
  log?: LogInterface,
): Promise<void> {
  const message = renderTemplate(task.messageTemplate, now);
  log?.info?.(`[DingTalk][Scheduler] 执行任务 ${task.id}: "${message.slice(0, 50)}..." → ${task.targets.length} 个目标`);

  try {
    await sendDingtalkMessage(config, task.targets, message, {
      msgType: task.markdown ? "markdown" : "text",
      title: task.markdown ? `定时消息 - ${task.id}` : undefined,
    });
    log?.info?.(`[DingTalk][Scheduler] 任务 ${task.id} 发送成功`);
  } catch (err) {
    log?.error?.(`[DingTalk][Scheduler] 任务 ${task.id} 发送失败: ${err}`);
    throw err;
  }
}
