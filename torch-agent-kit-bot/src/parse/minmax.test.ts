import { describe, it, expect } from "vitest";
import { parseMinMax } from "./minmax.js";

describe("parseMinMax", () => {
  it("parses bracketed format with trailing period", () => {
    const r = parseMinMax("Min: [0.09543], Max: [0.10690].");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.minStr).toBe("0.09543");
      expect(r.maxStr).toBe("0.10690");
      expect(r.min).toBe(0.09543);
      expect(r.max).toBe(0.1069);
    }
  });

  it("parses unbracketed format", () => {
    const r = parseMinMax("Min: 0.09543, Max: 0.10690");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.minStr).toBe("0.09543");
      expect(r.maxStr).toBe("0.10690");
    }
  });

  it("allows extra whitespace", () => {
    const r = parseMinMax("  Min:  0.1 ,  Max:  0.2  ");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.min).toBe(0.1);
      expect(r.max).toBe(0.2);
    }
  });

  it("rejects min <= 0", () => {
    const r = parseMinMax("Min: 0, Max: 0.5");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Min must be > 0");
  });

  it("rejects max <= min", () => {
    const r = parseMinMax("Min: 0.11, Max: 0.10");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Max must be > Min");
  });

  it("rejects non-numeric", () => {
    const r = parseMinMax("Min: abc, Max: 0.10");
    expect(r.ok).toBe(false);
  });

  it("rejects missing pattern", () => {
    const r = parseMinMax("The price will be around 0.10");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Could not find/);
  });

  it("is case-insensitive for Min/Max", () => {
    const r = parseMinMax("min: 0.05, max: 0.15");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.min).toBe(0.05);
      expect(r.max).toBe(0.15);
    }
  });
});
