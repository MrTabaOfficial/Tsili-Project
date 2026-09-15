import { MoneyError, assertTetri, compareIds, sumTetri, type MemberId, type Tetri } from "./money.js";
import type { Shares } from "./split.js";

export interface Expense {
  id: string;
  payerId: MemberId;
  amount: Tetri;
  /** Resolved shares are stored with the expense so history never shifts if the split rule changes later. */
  shares: Shares;
}

export interface Repayment {
  id: string;
  fromId: MemberId;
  toId: MemberId;
  amount: Tetri;
}

/** Signed tetri per member. Positive: the group owes them. Negative: they owe the group. */
export type Balances = Record<MemberId, number>;

export function computeBalances(memberIds: MemberId[], expenses: Expense[], repayments: Repayment[]): Balances {
  const balances: Balances = {};
  for (const id of [...memberIds].sort(compareIds)) balances[id] = 0;

  const known = (id: MemberId, what: string) => {
    if (!(id in balances)) throw new MoneyError("UNKNOWN_MEMBER", `${what} references unknown member ${id}`);
  };

  for (const e of expenses) {
    assertTetri(e.amount, `expense ${e.id} amount`);
    for (const [id, share] of Object.entries(e.shares)) assertTetri(share, `expense ${e.id} share for ${id}`);
    const shareTotal = sumTetri(Object.values(e.shares));
    if (shareTotal !== e.amount) {
      throw new MoneyError("UNBALANCED", `expense ${e.id} shares sum to ${shareTotal}, expected ${e.amount}`);
    }
    known(e.payerId, `expense ${e.id} payer`);
    balances[e.payerId]! += e.amount;
    for (const [id, share] of Object.entries(e.shares)) {
      known(id, `expense ${e.id} share`);
      balances[id]! -= share;
    }
  }

  for (const r of repayments) {
    assertTetri(r.amount, `repayment ${r.id} amount`);
    if (r.fromId === r.toId) {
      throw new MoneyError("SELF_REPAYMENT", `repayment ${r.id} pays a member back to themselves`);
    }
    known(r.fromId, `repayment ${r.id} payer`);
    known(r.toId, `repayment ${r.id} recipient`);
    balances[r.fromId]! += r.amount;
    balances[r.toId]! -= r.amount;
  }

  return balances;
}
