import { MoneyError, compareIds, type MemberId, type Tetri } from "./money.js";
import type { Balances } from "./balances.js";

export interface Payment {
  fromId: MemberId;
  toId: MemberId;
  amount: Tetri;
}

interface Side {
  id: MemberId;
  amount: Tetri;
}

/**
 * Greedy settle-up: pair exact matches first, then repeatedly have the largest
 * debtor pay the largest creditor. Produces at most (non-zero balances - 1)
 * payments. Not guaranteed minimal; the exact problem is NP-hard.
 */
export function settleUp(balances: Balances): Payment[] {
  let debtors: Side[] = [];
  let creditors: Side[] = [];
  for (const id of Object.keys(balances).sort(compareIds)) {
    const b = balances[id]!;
    if (!Number.isSafeInteger(b)) throw new MoneyError("NOT_INTEGER", `balance for ${id} is not an integer`);
    if (b < 0) debtors.push({ id, amount: -b });
    else if (b > 0) creditors.push({ id, amount: b });
  }
  const totalOwed = debtors.reduce((s, d) => s + d.amount, 0);
  const totalDue = creditors.reduce((s, c) => s + c.amount, 0);
  if (totalOwed !== totalDue) {
    throw new MoneyError("UNBALANCED", `balances sum to ${totalDue - totalOwed}, expected 0`);
  }

  const payments: Payment[] = [];

  // Exact-match pass: one payment clears both sides.
  const creditorsByAmount = new Map<Tetri, Side[]>();
  for (const c of creditors) {
    const list = creditorsByAmount.get(c.amount) ?? [];
    list.push(c);
    creditorsByAmount.set(c.amount, list);
  }
  const unmatched: Side[] = [];
  for (const d of debtors) {
    const match = creditorsByAmount.get(d.amount)?.shift();
    if (match) payments.push({ fromId: d.id, toId: match.id, amount: d.amount });
    else unmatched.push(d);
  }
  debtors = unmatched;
  creditors = [...creditorsByAmount.values()].flat();

  const largestFirst = (a: Side, b: Side) => b.amount - a.amount || compareIds(a.id, b.id);
  debtors.sort(largestFirst);
  creditors.sort(largestFirst);

  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]!;
    const c = creditors[j]!;
    const amount = Math.min(d.amount, c.amount);
    payments.push({ fromId: d.id, toId: c.id, amount });
    d.amount -= amount;
    c.amount -= amount;
    if (d.amount === 0) i++;
    if (c.amount === 0) j++;
  }

  return payments;
}
