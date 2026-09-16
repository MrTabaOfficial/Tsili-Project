import { MoneyError, type Tetri } from "./money.js";
import type { Currency } from "./domain.js";

const MINOR_PER_MAJOR = 100;

/** 1250 -> "12.50 GEL". Negative amounts keep their sign: -5 -> "-0.05 GEL". */
export function formatTetri(amount: number, currency: Currency): string {
  if (!Number.isSafeInteger(amount)) {
    throw new MoneyError("NOT_INTEGER", `cannot format non-integer amount ${String(amount)}`);
  }
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  const major = Math.floor(abs / MINOR_PER_MAJOR);
  const minor = String(abs % MINOR_PER_MAJOR).padStart(2, "0");
  return `${sign}${major}.${minor} ${currency}`;
}

/**
 * Parses user input like "12.50", "12,5", " 7 " or "0.05" into tetri using string
 * arithmetic, so "0.29" becomes 29 and not 28.999. Rejects more than two decimals,
 * signs, and anything else that is not a plain decimal number.
 */
export function parseTetri(input: string): Tetri {
  const trimmed = input.trim().replace(",", ".");
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(trimmed);
  if (!match || trimmed === "") {
    throw new MoneyError("NOT_INTEGER", `"${input}" is not a valid amount`);
  }
  const major = match[1]!;
  const minor = (match[2] ?? "").padEnd(2, "0");
  const value = Number(major) * MINOR_PER_MAJOR + Number(minor);
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError("NOT_INTEGER", `"${input}" is too large`);
  }
  return value;
}
