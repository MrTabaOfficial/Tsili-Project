import { MoneyError, parseTetri, split, type Shares, type SplitRule } from "@tsili/shared";
import type { TranslationKey } from "../i18n";

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

export type SplitErrorKey = Extract<TranslationKey, `split.error.${string}`>;
export type SplitResult = { ok: true; rule: SplitRule; shares: Shares } | { ok: false; errorKey: SplitErrorKey };

export function emptySplitInputs(memberIds: string[]): SplitInputs {
  return {
    mode: "equal",
    participants: new Set(memberIds),
    exactText: {},
    sharesText: Object.fromEntries(memberIds.map((id) => [id, "1"])),
  };
}

/** The reverse of resolveSplit, for editing: form state that reproduces a stored rule. */
export function inputsFromRule(rule: SplitRule, memberIds: string[]): SplitInputs {
  const base = emptySplitInputs(memberIds);
  switch (rule.kind) {
    case "equal":
      return { ...base, mode: "equal", participants: new Set(rule.memberIds) };
    case "exact":
      return {
        ...base,
        mode: "exact",
        exactText: Object.fromEntries(Object.entries(rule.amounts).map(([id, tetri]) => [id, tetriToText(tetri)])),
      };
    case "shares":
      return {
        ...base,
        mode: "shares",
        sharesText: Object.fromEntries(memberIds.map((id) => [id, String(rule.weights[id] ?? 0)])),
      };
  }
}

/** 1250 -> "12.50", the plain decimal the amount fields use. */
export function tetriToText(tetri: number): string {
  const sign = tetri < 0 ? "-" : "";
  const abs = Math.abs(tetri);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Turns form state into a split rule and resolved shares, or a message the form can show. */
export function resolveSplit(amount: number, inputs: SplitInputs): SplitResult {
  try {
    const rule = toRule(amount, inputs);
    return { ok: true, rule, shares: split(amount, rule) };
  } catch (err) {
    if (err instanceof MoneyError) return { ok: false, errorKey: errorKeyFor(err) };
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

/** Maps shared error codes to translation keys; wording lives in the dictionaries. */
function errorKeyFor(err: MoneyError): SplitErrorKey {
  switch (err.code) {
    case "EXACT_SUM_MISMATCH":
      return "split.error.sum";
    case "NO_PARTICIPANTS":
      return "split.error.participants";
    case "NO_SHARES":
      return "split.error.noShares";
    case "NOT_INTEGER":
      return err.message.startsWith("shares") ? "split.error.wholeShares" : "split.error.amountFormat";
    case "NEGATIVE_AMOUNT":
      return "split.error.negative";
    default:
      return "split.error.amountFormat";
  }
}
