import { z } from "zod";
import { currencySchema, groupSchema, idSchema, inviteCodeSchema, isoDateTimeSchema, memberSchema } from "./domain.js";

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
});
export type CreateGroupRequest = z.infer<typeof createGroupRequestSchema>;

export const updateGroupRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
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
