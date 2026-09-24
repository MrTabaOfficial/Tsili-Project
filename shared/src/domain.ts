import { z } from "zod";
import { MoneyError } from "./money";
import { split, type SplitRule } from "./split";

export const CURRENCIES = ["GEL"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Invite codes avoid 0/O/1/I so they survive being read aloud or typed from a photo. */
export const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 8;

export const idSchema = z.uuid();
export const tetriSchema = z.int().min(0).max(Number.MAX_SAFE_INTEGER);
export const positiveTetriSchema = tetriSchema.min(1);
export const isoDateTimeSchema = z.iso.datetime();
export const dateOnlySchema = z.iso.date();
export const currencySchema = z.enum(CURRENCIES);
export const inviteCodeSchema = z
  .string()
  .length(INVITE_CODE_LENGTH)
  .regex(new RegExp(`^[${INVITE_CODE_ALPHABET}]+$`), "invite code uses an unsupported character");

/** Fields every synced record carries. Soft deletes let other phones learn that a row is gone. */
export const syncedRecordSchema = z.object({
  id: idSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  deletedAt: isoDateTimeSchema.nullable(),
});
export type SyncedRecord = z.infer<typeof syncedRecordSchema>;

export const groupSchema = syncedRecordSchema.extend({
  name: z.string().trim().min(1).max(80),
  currency: currencySchema,
  inviteCode: inviteCodeSchema,
});
export type Group = z.infer<typeof groupSchema>;

export const memberSchema = syncedRecordSchema.extend({
  groupId: idSchema,
  name: z.string().trim().min(1).max(60),
  /** Null until a real account joins by invite and claims this slot. */
  userId: idSchema.nullable(),
});
export type Member = z.infer<typeof memberSchema>;

const memberIdList = z.array(idSchema).min(1);
const tetriByMember = z.record(idSchema, tetriSchema);
const weightByMember = z.record(idSchema, z.int().min(0));

export const splitRuleSchema: z.ZodType<SplitRule> = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("equal"), memberIds: memberIdList }),
  z.object({ kind: z.literal("exact"), amounts: tetriByMember }),
  z.object({ kind: z.literal("shares"), weights: weightByMember }),
]);

export const expenseSchema = syncedRecordSchema
  .extend({
    groupId: idSchema,
    payerMemberId: idSchema,
    amount: positiveTetriSchema,
    description: z.string().trim().min(1).max(200),
    date: dateOnlySchema,
    splitRule: splitRuleSchema,
    shares: tetriByMember,
  })
  .superRefine((expense, ctx) => {
    let expected: Record<string, number>;
    try {
      expected = split(expense.amount, expense.splitRule);
    } catch (err) {
      ctx.addIssue({
        code: "custom",
        path: ["splitRule"],
        message: err instanceof MoneyError ? err.message : "invalid split rule",
      });
      return;
    }
    if (!sameShares(expected, expense.shares)) {
      ctx.addIssue({
        code: "custom",
        path: ["shares"],
        message: "shares do not match the split rule",
      });
    }
  });
export type Expense = z.infer<typeof expenseSchema>;

export const repaymentSchema = syncedRecordSchema
  .extend({
    groupId: idSchema,
    fromMemberId: idSchema,
    toMemberId: idSchema,
    amount: positiveTetriSchema,
    date: dateOnlySchema,
    note: z.string().trim().max(200).nullable(),
  })
  .refine((r) => r.fromMemberId !== r.toMemberId, {
    path: ["toMemberId"],
    message: "a member cannot repay themselves",
  });
export type Repayment = z.infer<typeof repaymentSchema>;

function sameShares(a: Record<string, number>, b: Record<string, number>): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((k) => a[k] === b[k]);
}
