import { describe, it, expect } from "vitest";
import { getNextEligibleTargets } from "./targets.js";

describe("getNextEligibleTargets", () => {
  it("returns first target >= now + lead at 12:00 UTC", () => {
    const targets = getNextEligibleTargets({ minLeadSeconds: 0, daysAhead: 1 });
    expect(targets.length).toBe(1);
    const d = new Date(targets[0].timestamp * 1000);
    expect(d.getUTCHours()).toBe(12);
    expect(d.getUTCMinutes()).toBe(0);
    expect(targets[0].monthDay).toMatch(/^[A-Za-z]+ \d+$/);
  });

  it("returns N targets when daysAhead is N", () => {
    const targets = getNextEligibleTargets({ minLeadSeconds: 0, daysAhead: 3 });
    expect(targets.length).toBe(3);
  });
});
