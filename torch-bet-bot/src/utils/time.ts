/**
 * UTC date helpers for forecast day labels and target timestamps.
 * All times are 12:00 UTC on the target day.
 */

import { getEnv } from "../config/env.js";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Get 12:00 UTC timestamp for a given UTC date (year, month 1-12, day).
 */
export function getNoonUtcTimestamp(year: number, month: number, day: number): number {
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  return Math.floor(date.getTime() / 1000);
}

/**
 * Format a UTC date as "February 28" (month name + day).
 */
export function formatMonthDayUtc(year: number, month: number, day: number): string {
  if (month < 1 || month > 12) throw new RangeError("month must be 1-12");
  return `${MONTH_NAMES[month - 1]} ${day}`;
}

/**
 * Return today's date in UTC (year, month 1-12, day).
 */
export function getTodayUtc(): { year: number; month: number; day: number } {
  const now = new Date();
  return {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate(),
  };
}

/**
 * Add days to a UTC date (handles month/year rollover).
 */
export function addDaysUtc(
  year: number,
  month: number,
  day: number,
  days: number
): { year: number; month: number; day: number } {
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

/**
 * Build the next 7 target days at 12:00 UTC, starting from the first 12:00 UTC >= now + MIN_TARGET_LEAD_SECONDS.
 * anchor = nowUTC + MIN_TARGET_LEAD_SECONDS; firstTarget = next 12:00 UTC >= anchor; then 7 days.
 * Day labels are always "on Month Day" (e.g. "on March 6").
 * @param overrides - Optional; use minLeadSeconds to override env (e.g. in tests without full env).
 */
export function getNextSevenTargets(overrides?: {
  minLeadSeconds?: number;
}): Array<{ timestamp: number; dayLabel: string }> {
  const minLeadSeconds =
    overrides?.minLeadSeconds ?? getEnv().MIN_TARGET_LEAD_SECONDS;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const anchor = nowSeconds + minLeadSeconds;

  const today = getTodayUtc();

  // First target = next 12:00 UTC >= anchor
  let firstTarget = { year: today.year, month: today.month, day: today.day };
  for (let d = 0; d <= 365; d++) {
    const candidate = addDaysUtc(today.year, today.month, today.day, d);
    const ts = getNoonUtcTimestamp(candidate.year, candidate.month, candidate.day);
    if (ts >= anchor) {
      firstTarget = candidate;
      break;
    }
  }

  const out: Array<{ timestamp: number; dayLabel: string }> = [];
  for (let i = 0; i < 7; i++) {
    const { year, month, day } = addDaysUtc(firstTarget.year, firstTarget.month, firstTarget.day, i);
    const timestamp = getNoonUtcTimestamp(year, month, day);
    const dayLabel = `on ${formatMonthDayUtc(year, month, day)}`;
    out.push({ timestamp, dayLabel });
  }
  return out;
}
