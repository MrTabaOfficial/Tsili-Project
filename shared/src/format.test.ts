import { describe, expect, it } from "vitest";
import { formatTetri, parseTetri } from "./format";
import { MoneyError } from "./money";

describe("formatTetri", () => {
  it("formats whole and fractional amounts with two decimals", () => {
    expect(formatTetri(1250, "GEL")).toBe("12.50 GEL");
    expect(formatTetri(100, "GEL")).toBe("1.00 GEL");
    expect(formatTetri(5, "GEL")).toBe("0.05 GEL");
    expect(formatTetri(0, "GEL")).toBe("0.00 GEL");
  });

  it("keeps the sign on negative balances", () => {
    expect(formatTetri(-5, "GEL")).toBe("-0.05 GEL");
    expect(formatTetri(-123456, "GEL")).toBe("-1234.56 GEL");
  });

  it("refuses floats", () => {
    expect(() => formatTetri(12.5, "GEL")).toThrow(MoneyError);
  });
});

describe("parseTetri", () => {
  it("parses common user inputs", () => {
    expect(parseTetri("12.50")).toBe(1250);
    expect(parseTetri("12.5")).toBe(1250);
    expect(parseTetri("12,5")).toBe(1250);
    expect(parseTetri(" 7 ")).toBe(700);
    expect(parseTetri("0.05")).toBe(5);
    expect(parseTetri("12.")).toBe(1200);
    expect(parseTetri("0")).toBe(0);
  });

  it("does not suffer float drift", () => {
    expect(parseTetri("0.29")).toBe(29);
    expect(parseTetri("1.13")).toBe(113);
    expect(parseTetri("4.35")).toBe(435);
  });

  it("rejects more than two decimals, signs, text and empty input", () => {
    for (const bad of ["12.505", "-5", "+5", "abc", "", "  ", ".5", "1e3", "12.5.0"]) {
      expect(() => parseTetri(bad), bad).toThrow(MoneyError);
    }
  });

  it("round-trips through format", () => {
    for (const amount of [0, 1, 99, 100, 1250, 999999]) {
      const text = formatTetri(amount, "GEL").replace(" GEL", "");
      expect(parseTetri(text)).toBe(amount);
    }
  });
});
