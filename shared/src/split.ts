import { MoneyError, assertTetri, compareIds, sumTetri, type MemberId, type Tetri } from "./money";

/** Resolved per-member amounts. Values always sum to the split amount. */
export type Shares = Record<MemberId, Tetri>;

export type SplitRule =
  | { kind: "equal"; memberIds: MemberId[] }
  | { kind: "exact"; amounts: Shares }
  | { kind: "shares"; weights: Record<MemberId, number> };

export function split(amount: Tetri, rule: SplitRule): Shares {
  switch (rule.kind) {
    case "equal":
      return splitEqually(amount, rule.memberIds);
    case "exact":
      return splitExact(amount, rule.amounts);
    case "shares":
      return splitByShares(amount, rule.weights);
  }
}

export function splitEqually(amount: Tetri, memberIds: MemberId[]): Shares {
  assertTetri(amount, "amount");
  if (memberIds.length === 0) {
    throw new MoneyError("NO_PARTICIPANTS", "an equal split needs at least one participant");
  }
  if (new Set(memberIds).size !== memberIds.length) {
    throw new MoneyError("DUPLICATE_MEMBER", "equal split lists a member twice");
  }
  const weights: Record<MemberId, number> = {};
  for (const id of memberIds) weights[id] = 1;
  return splitByShares(amount, weights);
}

export function splitExact(amount: Tetri, amounts: Shares): Shares {
  assertTetri(amount, "amount");
  const ids = Object.keys(amounts).sort(compareIds);
  if (ids.length === 0) {
    throw new MoneyError("NO_PARTICIPANTS", "an exact split needs at least one participant");
  }
  for (const id of ids) assertTetri(amounts[id], `amount for ${id}`);
  const total = sumTetri(Object.values(amounts));
  if (total !== amount) {
    throw new MoneyError("EXACT_SUM_MISMATCH", `exact amounts sum to ${total}, expected ${amount}`);
  }
  const result: Shares = {};
  for (const id of ids) result[id] = amounts[id]!;
  return result;
}

/**
 * Largest-remainder allocation: each member gets floor(amount * w / W), and the
 * leftover tetri go one each to the largest fractional parts, ties broken by
 * ascending member id, so every device produces identical shares.
 */
export function splitByShares(amount: Tetri, weights: Record<MemberId, number>): Shares {
  assertTetri(amount, "amount");
  const ids = Object.keys(weights).sort(compareIds);
  if (ids.length === 0) {
    throw new MoneyError("NO_PARTICIPANTS", "a share split needs at least one participant");
  }
  for (const id of ids) {
    const w = weights[id];
    if (typeof w !== "number" || !Number.isSafeInteger(w) || w < 0) {
      throw new MoneyError("NOT_INTEGER", `share for ${id} must be a non-negative integer, got ${String(w)}`);
    }
  }
  const totalWeight = sumTetri(ids.map((id) => weights[id]!));
  if (totalWeight === 0) throw new MoneyError("NO_SHARES", "share weights must not all be zero");

  // BigInt keeps amount * weight exact; a float product can misplace a tetri on large amounts.
  const bigTotal = BigInt(totalWeight);
  const result: Shares = {};
  const remainders: { id: MemberId; remainder: bigint }[] = [];
  let allocated = 0;
  for (const id of ids) {
    const product = BigInt(amount) * BigInt(weights[id]!);
    const base = Number(product / bigTotal);
    result[id] = base;
    allocated += base;
    remainders.push({ id, remainder: product % bigTotal });
  }

  remainders.sort((a, b) => {
    if (a.remainder !== b.remainder) return a.remainder > b.remainder ? -1 : 1;
    return compareIds(a.id, b.id);
  });
  let leftover = amount - allocated;
  for (const { id } of remainders) {
    if (leftover === 0) break;
    result[id]! += 1;
    leftover -= 1;
  }
  return result;
}
