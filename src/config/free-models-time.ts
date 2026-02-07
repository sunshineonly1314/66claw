/**
 * Free models time helpers.
 *
 * We treat "daily" quotas as resetting at 00:00 Beijing time (Asia/Shanghai),
 * matching the product copy and CN provider expectations.
 */

const BEIJING_TZ = "Asia/Shanghai";

/**
 * Returns YYYY-MM-DD for the given date in Beijing time.
 *
 * Uses `en-CA` because it formats as `YYYY-MM-DD` across JS engines.
 */
export function getBeijingDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BEIJING_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

