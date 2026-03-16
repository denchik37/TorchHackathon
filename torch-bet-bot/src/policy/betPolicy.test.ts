import { describe, it, expect } from "vitest";
import { forecastToBetParams, parseHbar } from "./betPolicy.js";

describe("betPolicy", () => {
  it("parseHbar converts 0.1 to 18-decimal weibar (default)", () => {
    const w = parseHbar("0.1");
    expect(w).toBe(100_000_000_000_000_000n); // 0.1 * 10^18
  });

  it("forecastToBetParams produces 8-decimal fixed-point integers (same as frontend)", () => {
    const forecast = {
      targetTimestamp: 1740700800,
      dayLabel: "Tomorrow",
      priceLow: 0.093,
      priceHigh: 0.11,
    };
    const params = forecastToBetParams(forecast, "0.1", 8, 18);
    expect(params.targetTimestamp).toBe(1740700800);
    expect(params.priceLowInt).toBe(9_300_000n); // 0.093 * 10^8
    expect(params.priceHighInt).toBe(11_000_000n); // 0.11 * 10^8
    expect(params.stakeValue).toBe(100_000_000_000_000_000n); // 0.1 HBAR, 18 decimals (weibar)
  });

  it("forecastToBetParams rounds correctly with parseUnits", () => {
    const forecast = {
      targetTimestamp: 1,
      dayLabel: "x",
      priceLow: 0.09333,
      priceHigh: 0.10666,
    };
    const params = forecastToBetParams(forecast, "1", 8, 18);
    expect(params.priceLowInt).toBe(9_333_000n); // 0.09333 -> 8 dp
    expect(params.priceHighInt).toBe(10_666_000n); // 0.10666 -> 8 dp
  });

  it("forecastToBetParams uses exact priceLowStr/priceHighStr with parseUnits(., 8)", () => {
    const forecast = {
      targetTimestamp: 1,
      dayLabel: "on March 6",
      priceLow: 0.09585,
      priceHigh: 0.10737,
      priceLowStr: "0.09585",
      priceHighStr: "0.10737",
    };
    const params = forecastToBetParams(forecast, "0.1", 8, 18);
    expect(params.priceLowInt).toBe(9_585_000n); // parseUnits("0.09585", 8)
    expect(params.priceHighInt).toBe(10_737_000n); // parseUnits("0.10737", 8)
  });

  it("parseHbar throws when non-zero stake is below 1 tinybar (10^10 weibar)", () => {
    expect(() => parseHbar("0.000000001", 18)).toThrow(/at least 0.00000001/);
  });
});
