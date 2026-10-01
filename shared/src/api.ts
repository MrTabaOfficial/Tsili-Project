import { z } from "zod";
import {
  currencySchema,
  expenseSchema,
  groupSchema,
  idSchema,
  inviteCodeSchema,
  isoDateTimeSchema,
  memberSchema,
  repaymentSchema,
} from "./domain";

/** Auth request bodies, shared so the app's forms and the server enforce identical rules. */
export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());
export const passwordSchema = z.string().min(8, "password must be at least 8 characters").max(200);
export const displayNameSchema = z.string().trim().min(1).max(60);

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema,
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

export const publicUserSchema = z.object({
  id: idSchema,
  email: emailSchema,
  displayName: displayNameSchema,
  createdAt: isoDateTimeSchema,
});
export type PublicUser = z.infer<typeof publicUserSchema>;

export const tokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type TokenPair = z.infer<typeof tokenPairSchema>;

export const authResponseSchema = tokenPairSchema.extend({ user: publicUserSchema });
export type AuthResponse = z.infer<typeof authResponseSchema>;

/** Every error body the server returns has this shape. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

/** Groups and membership. The client may pass its own uuid so offline-created rows keep their id. */
export const createGroupRequestSchema = z.object({
  id: idSchema.optional(),
  name: z.string().trim().min(1).max(80),
  currency: currencySchema.default("GEL"),
  /** A phone registering an offline-created group names the member it already uses for this account. */
  creatorMember: z.object({ id: idSchema, name: z.string().trim().min(1).max(60) }).optional(),
});
export type CreateGroupRequest = z.infer<typeof createGroupRequestSchema>;

export const updateGroupRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  /** When set, the server applies the rename only if this is newer than its copy (same rule as sync). */
  updatedAt: isoDateTimeSchema.optional(),
});
export type UpdateGroupRequest = z.infer<typeof updateGroupRequestSchema>;

export const createMemberRequestSchema = z.object({
  id: idSchema.optional(),
  name: z.string().trim().min(1).max(60),
});
export type CreateMemberRequest = z.infer<typeof createMemberRequestSchema>;

export const updateMemberRequestSchema = z.object({
  name: z.string().trim().min(1).max(60),
});
export type UpdateMemberRequest = z.infer<typeof updateMemberRequestSchema>;

export const inviteCodeParamSchema = z.object({ code: inviteCodeSchema });

/** Join by claiming an existing unclaimed member, or by adding yourself under a new name. */
export const joinGroupRequestSchema = z.union([
  z.object({ memberId: idSchema }),
  z.object({ name: z.string().trim().min(1).max(60) }),
]);
export type JoinGroupRequest = z.infer<typeof joinGroupRequestSchema>;

export const groupWithMembersSchema = z.object({
  group: groupSchema,
  members: z.array(memberSchema),
});
export type GroupWithMembers = z.infer<typeof groupWithMembersSchema>;

export const invitePreviewSchema = z.object({
  group: groupSchema.pick({ id: true, name: true, currency: true }),
  unclaimedMembers: z.array(memberSchema.pick({ id: true, name: true })),
  /** Set when the caller is already a member, so the app can skip straight to the group. */
  alreadyMemberId: idSchema.nullable(),
});
export type InvitePreview = z.infer<typeof invitePreviewSchema>;

/** Sync. Pushed records are validated one by one on the server, so they arrive untyped here. */
export const syncCursorSchema = z.string().regex(/^\d+$/, "cursor must be a non-negative integer string");

export const syncRequestSchema = z.object({
  cursor: syncCursorSchema,
  changes: z
    .object({
      members: z.array(z.unknown()).max(1000).default([]),
      expenses: z.array(z.unknown()).max(1000).default([]),
      repayments: z.array(z.unknown()).max(1000).default([]),
    })
    .default({ members: [], expenses: [], repayments: [] }),
});
export type SyncRequest = z.infer<typeof syncRequestSchema>;

export const syncRecordKindSchema = z.enum(["member", "expense", "repayment"]);
export type SyncRecordKind = z.infer<typeof syncRecordKindSchema>;

export const syncRejectionSchema = z.object({
  kind: syncRecordKindSchema,
  id: z.string().nullable(),
  code: z.string(),
  message: z.string(),
});
export type SyncRejection = z.infer<typeof syncRejectionSchema>;

export const syncResponseSchema = z.object({
  cursor: syncCursorSchema,
  /** Always included so phones pick up renames; deletion is signalled by a 404 instead. */
  group: groupSchema,
  changes: z.object({
    members: z.array(memberSchema),
    expenses: z.array(expenseSchema),
    repayments: z.array(repaymentSchema),
  }),
  rejected: z.array(syncRejectionSchema),
});
export type SyncResponse = z.infer<typeof syncResponseSchema>;
