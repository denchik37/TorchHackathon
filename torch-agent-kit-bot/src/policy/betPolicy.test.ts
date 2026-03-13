import { describe, it, expect } from "vitest";
import { parseUnits, buildBetParams } from "./betPolicy.js";

describe("betPolicy", () => {
  it("parseUnits 8dp correctness", () => {
    expect(parseUnits("0.09543", 8)).toBe(9_543_000n);
    expect(parseUnits("0.10690", 8)).toBe(10_690_000n);
    expect(parseUnits("1", 8)).toBe(100_000_000n);
  });

  it("buildBetParams produces correct 8dp ints and stake", () => {
    const p = buildBetParams(1740700800, "0.09543", "0.10690", "0.1");
    expect(p.targetTimestamp).toBe(1740700800);
    expect(p.priceMinInt).toBe(9_543_000n);
    expect(p.priceMaxInt).toBe(10_690_000n);
    expect(p.stakeHbar).toBe("0.1");
  });
});
