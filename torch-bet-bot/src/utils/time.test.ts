import { describe, it, expect } from "vitest";
import {
  getNoonUtcTimestamp,
  formatMonthDayUtc,
  addDaysUtc,
  getNextSevenTargets,
} from "./time.js";

describe("time utils", () => {
  it("getNoonUtcTimestamp returns correct unix time for a given date", () => {
    const ts = getNoonUtcTimestamp(2025, 2, 28);
    const d = new Date(ts * 1000);
    expect(d.getUTCFullYear()).toBe(2025);
    expect(d.getUTCMonth()).toBe(1);
    expect(d.getUTCDate()).toBe(28);
    expect(d.getUTCHours()).toBe(12);
    expect(d.getUTCMinutes()).toBe(0);
  });

  it("formatMonthDayUtc returns February 28", () => {
    expect(formatMonthDayUtc(2025, 2, 28)).toBe("February 28");
  });

  it("addDaysUtc rolls to next month", () => {
    const next = addDaysUtc(2025, 1, 31, 1);
    expect(next.year).toBe(2025);
    expect(next.month).toBe(2);
    expect(next.day).toBe(1);
  });

  it("getNextSevenTargets returns 7 entries, dayLabel always 'on Month Day', first at 12:00 UTC", () => {
    const targets = getNextSevenTargets({ minLeadSeconds: 0 });
    expect(targets.length).toBe(7);
    for (const t of targets) {
      expect(t.dayLabel).toMatch(/^on [A-Za-z]+ \d+$/);
    }
    const d = new Date(targets[0].timestamp * 1000);
    expect(d.getUTCHours()).toBe(12);
    expect(d.getUTCMinutes()).toBe(0);
  });
});
