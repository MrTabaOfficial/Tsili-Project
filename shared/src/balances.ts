import { MoneyError, assertTetri, compareIds, sumTetri, type MemberId, type Tetri } from "./money";
import type { Shares } from "./split";

/** The slice of a domain Expense that balances need. Pass live records only; soft-deleted ones must be filtered out first. */
export interface BalanceExpense {
  id: string;
  payerMemberId: MemberId;
  amount: Tetri;
  shares: Shares;
}

export interface BalanceRepayment {
  id: string;
  fromMemberId: MemberId;
  toMemberId: MemberId;
  amount: Tetri;
}

/** Signed tetri per member. Positive: the group owes them. Negative: they owe the group. */
export type Balances = Record<MemberId, number>;

export function computeBalances(memberIds: MemberId[], expenses: BalanceExpense[], repayments: BalanceRepayment[]): Balances {
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
    known(e.payerMemberId, `expense ${e.id} payer`);
    balances[e.payerMemberId]! += e.amount;
    for (const [id, share] of Object.entries(e.shares)) {
      known(id, `expense ${e.id} share`);
      balances[id]! -= share;
    }
  }

  for (const r of repayments) {
    assertTetri(r.amount, `repayment ${r.id} amount`);
    if (r.fromMemberId === r.toMemberId) {
      throw new MoneyError("SELF_REPAYMENT", `repayment ${r.id} pays a member back to themselves`);
    }
    known(r.fromMemberId, `repayment ${r.id} payer`);
    known(r.toMemberId, `repayment ${r.id} recipient`);
    balances[r.fromMemberId]! += r.amount;
    balances[r.toMemberId]! -= r.amount;
  }

  return balances;
}
