import { MoneyError, parseTetri, split, type Shares, type SplitRule } from "@tsili/shared";

export type SplitMode = "equal" | "exact" | "shares";

/** Raw form state: text inputs keyed by member id, kept as strings until the user saves. */
export interface SplitInputs {
  mode: SplitMode;
  /** Equal mode: who takes part. */
  participants: Set<string>;
  /** Exact mode: amount text per member, "" means not taking part. */
  exactText: Record<string, string>;
  /** Shares mode: integer text per member, "" or "0" means not taking part. */
  sharesText: Record<string, string>;
}

export type SplitResult = { ok: true; rule: SplitRule; shares: Shares } | { ok: false; error: string };

export function emptySplitInputs(memberIds: string[]): SplitInputs {
  return {
    mode: "equal",
    participants: new Set(memberIds),
    exactText: {},
    sharesText: Object.fromEntries(memberIds.map((id) => [id, "1"])),
  };
}

/** Turns form state into a split rule and resolved shares, or a message the form can show. */
export function resolveSplit(amount: number, inputs: SplitInputs): SplitResult {
  try {
    const rule = toRule(amount, inputs);
    return { ok: true, rule, shares: split(amount, rule) };
  } catch (err) {
    if (err instanceof MoneyError) return { ok: false, error: friendly(err) };
    throw err;
  }
}

function toRule(amount: number, inputs: SplitInputs): SplitRule {
  switch (inputs.mode) {
    case "equal": {
      const memberIds = [...inputs.participants].sort();
      if (memberIds.length === 0) throw new MoneyError("NO_PARTICIPANTS", "pick at least one person");
      return { kind: "equal", memberIds };
    }
    case "exact": {
      const amounts: Shares = {};
      for (const [id, text] of Object.entries(inputs.exactText)) {
        if (text.trim() === "") continue;
        amounts[id] = parseTetri(text);
      }
      return { kind: "exact", amounts };
    }
    case "shares": {
      const weights: Record<string, number> = {};
      for (const [id, text] of Object.entries(inputs.sharesText)) {
        const trimmed = text.trim();
        if (trimmed === "") continue;
        if (!/^\d+$/.test(trimmed)) throw new MoneyError("NOT_INTEGER", `shares must be whole numbers`);
        weights[id] = Number(trimmed);
      }
      return { kind: "shares", weights };
    }
  }
}

/** Sum of the exact-mode inputs so far, ignoring unparsable text, for the "remaining" hint. */
export function exactTotal(exactText: Record<string, string>): number {
  let total = 0;
  for (const text of Object.values(exactText)) {
    if (text.trim() === "") continue;
    try {
      total += parseTetri(text);
    } catch {
      // Still being typed; the save step reports it properly.
    }
  }
  return total;
}

function friendly(err: MoneyError): string {
  switch (err.code) {
    case "EXACT_SUM_MISMATCH":
      return "The amounts must add up to the total";
    case "NO_PARTICIPANTS":
      return "Pick at least one person";
    case "NO_SHARES":
      return "Give at least one person a share";
    case "NOT_INTEGER":
      return err.message.startsWith("shares") ? "Shares must be whole numbers" : "Enter amounts like 12.50";
    case "NEGATIVE_AMOUNT":
      return "Amounts cannot be negative";
    default:
      return err.message;
  }
}
