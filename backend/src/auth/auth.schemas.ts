import { z } from "zod";

/**
 * Register request runtime validation.
 * z.infer gives compile-time TypeScript type.
 */
export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name must be less than 80 characters"),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email address"),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be less than 100 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Login request validation.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email address"),

  password: z
    .string()
    .min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Forgot password request.
 * In production, the reset link should be emailed.
 */
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email address"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/**
 * Reset password request.
 */
export const resetPasswordSchema = z.object({
  token: z.string().min(20, "Reset token is required"),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be less than 100 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/**
 * Create API token request.
 * Used for Google Sheets / Apps Script integration.
 *
 * The raw API token will be shown only once after creation.
 */
export const createApiTokenSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Token name must be at least 2 characters")
    .max(100, "Token name must be less than 100 characters")
    .default("Google Sheets Token"),

  expiresAt: z
    .string()
    .datetime("expiresAt must be a valid ISO datetime")
    .optional()
    .nullable(),

  scopes: z
    .array(
      z.enum([
        "jobs:create",
        "jobs:read",
        "results:read",
      ])
    )
    .optional()
    .default(["jobs:create", "jobs:read", "results:read"]),
});

export type CreateApiTokenInput = z.infer<typeof createApiTokenSchema>;