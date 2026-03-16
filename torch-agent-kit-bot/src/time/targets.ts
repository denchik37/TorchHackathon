/**
 * Next eligible target day at 12:00 UTC with minimum lead time (default 24h).
 */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getNoonUtcTimestamp(year: number, month: number, day: number): number {
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  return Math.floor(date.getTime() / 1000);
}

function formatMonthDayUtc(year: number, month: number, day: number): string {
  if (month < 1 || month > 12) throw new RangeError("month must be 1-12");
  return `${MONTH_NAMES[month - 1]} ${day}`;
}

function getTodayUtc(): { year: number; month: number; day: number } {
  const now = new Date();
  return {
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
    day: now.getUTCDate(),
  };
}

function addDaysUtc(
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

export interface TargetDay {
  timestamp: number;
  dayLabel: string;
  monthDay: string;
}

/**
 * anchor = nowUTC + minLeadSeconds; firstTarget = next 12:00 UTC >= anchor.
 * Returns DAYS_AHEAD targets (default 1).
 */
export function getNextEligibleTargets(overrides?: {
  minLeadSeconds?: number;
  daysAhead?: number;
}): TargetDay[] {
  const minLeadSeconds = overrides?.minLeadSeconds ?? 86400;
  const daysAhead = overrides?.daysAhead ?? 1;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const anchor = nowSeconds + minLeadSeconds;
  const today = getTodayUtc();

  let firstTarget = { year: today.year, month: today.month, day: today.day };
  for (let d = 0; d <= 365; d++) {
    const candidate = addDaysUtc(today.year, today.month, today.day, d);
    const ts = getNoonUtcTimestamp(candidate.year, candidate.month, candidate.day);
    if (ts >= anchor) {
      firstTarget = candidate;
      break;
    }
  }

  const out: TargetDay[] = [];
  for (let i = 0; i < daysAhead; i++) {
    const { year, month, day } = addDaysUtc(firstTarget.year, firstTarget.month, firstTarget.day, i);
    const timestamp = getNoonUtcTimestamp(year, month, day);
    const monthDay = formatMonthDayUtc(year, month, day);
    out.push({
      timestamp,
      dayLabel: `on ${monthDay}`,
      monthDay,
    });
  }
  return out;
}
