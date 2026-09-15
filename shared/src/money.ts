/** An amount in minor units (tetri). Always a non-negative safe integer. */
export type Tetri = number;

export type MemberId = string;

export type MoneyErrorCode =
  | "NOT_INTEGER"
  | "NEGATIVE_AMOUNT"
  | "NO_PARTICIPANTS"
  | "DUPLICATE_MEMBER"
  | "EXACT_SUM_MISMATCH"
  | "NO_SHARES"
  | "UNKNOWN_MEMBER"
  | "SELF_REPAYMENT"
  | "UNBALANCED";

export class MoneyError extends Error {
  constructor(
    readonly code: MoneyErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MoneyError";
  }
}

export function assertTetri(value: unknown, what: string): asserts value is Tetri {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new MoneyError("NOT_INTEGER", `${what} must be an integer number of tetri, got ${String(value)}`);
  }
  if (value < 0) {
    throw new MoneyError("NEGATIVE_AMOUNT", `${what} must not be negative, got ${value}`);
  }
}

/** Stable ordering for member ids so every device walks members in the same order. */
export function compareIds(a: MemberId, b: MemberId): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function sumTetri(values: Iterable<Tetri>): Tetri {
  let total = 0;
  for (const v of values) total += v;
  return total;
}
