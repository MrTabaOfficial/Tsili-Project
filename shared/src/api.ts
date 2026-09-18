import { z } from "zod";
import { idSchema, isoDateTimeSchema } from "./domain.js";

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
