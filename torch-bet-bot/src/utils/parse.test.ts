import { describe, it, expect } from "vitest";
import { parseMinMax } from "./parse.js";

describe("parseMinMax", () => {
  it("parses valid line with 5 decimal places", () => {
    const r = parseMinMax("Min: 0.09300, Max: 0.11000", 12345, "Tomorrow");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.forecast.priceLow).toBe(0.093);
      expect(r.forecast.priceHigh).toBe(0.11);
      expect(r.forecast.targetTimestamp).toBe(12345);
      expect(r.forecast.dayLabel).toBe("Tomorrow");
    }
  });

  it("allows extra whitespace", () => {
    const r = parseMinMax("  Min:  0.1 ,  Max:  0.2  ", 1, "on March 2");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.forecast.priceLow).toBe(0.1);
      expect(r.forecast.priceHigh).toBe(0.2);
    }
  });

  it("rejects min <= 0", () => {
    const r = parseMinMax("Min: 0, Max: 0.5", 1, "Tomorrow");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Min must be > 0");
  });

  it("rejects max <= min", () => {
    const r = parseMinMax("Min: 0.11, Max: 0.10", 1, "Tomorrow");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Max must be > Min");
  });

  it("rejects non-numeric", () => {
    const r = parseMinMax("Min: abc, Max: 0.10", 1, "Tomorrow");
    expect(r.ok).toBe(false);
  });

  it("rejects missing pattern", () => {
    const r = parseMinMax("The price will be around 0.10", 1, "Tomorrow");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Could not find/);
  });

  it("is case-insensitive for Min/Max", () => {
    const r = parseMinMax("min: 0.05, max: 0.15", 1, "Tomorrow");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.forecast.priceLow).toBe(0.05);
      expect(r.forecast.priceHigh).toBe(0.15);
    }
  });

  it("parses bracketed numbers with optional trailing period", () => {
    const r = parseMinMax("Min: [0.09585], Max: [0.10737].", 99, "on March 6");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.forecast.priceLow).toBe(0.09585);
      expect(r.forecast.priceHigh).toBe(0.10737);
      expect(r.forecast.priceLowStr).toBe("0.09585");
      expect(r.forecast.priceHighStr).toBe("0.10737");
    }
  });
});
