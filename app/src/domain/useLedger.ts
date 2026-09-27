import { computeBalances, settleUp, type Balances, type Payment } from "@tsili/shared";
import { listExpenses, type LocalExpense } from "../db/repo/expenses";
import { listMembers, type LocalMember } from "../db/repo/members";
import { listRepayments, type LocalRepayment } from "../db/repo/repayments";
import type { SqlDb } from "../db/sql";
import { useQuery, type QueryState } from "../db/useQuery";

export interface Ledger {
  members: LocalMember[];
  membersById: Map<string, LocalMember>;
  expenses: LocalExpense[];
  repayments: LocalRepayment[];
  balances: Balances;
  plan: Payment[];
}

export async function loadLedger(db: SqlDb, groupId: string): Promise<Ledger> {
  const [members, expenses, repayments] = await Promise.all([
    listMembers(db, groupId),
    listExpenses(db, groupId),
    listRepayments(db, groupId),
  ]);
  // Deleted members may still appear in old expenses, so balances are computed over every member id seen.
  const ids = new Set(members.map((m) => m.id));
  for (const e of expenses) {
    ids.add(e.payerMemberId);
    for (const id of Object.keys(e.shares)) ids.add(id);
  }
  for (const r of repayments) {
    ids.add(r.fromMemberId);
    ids.add(r.toMemberId);
  }
  const balances = computeBalances([...ids], expenses, repayments);
  return {
    members,
    membersById: new Map(members.map((m) => [m.id, m])),
    expenses,
    repayments,
    balances,
    plan: settleUp(balances),
  };
}

export function useLedger(groupId: string): QueryState<Ledger> {
  return useQuery((db) => loadLedger(db, groupId), [groupId]);
}
