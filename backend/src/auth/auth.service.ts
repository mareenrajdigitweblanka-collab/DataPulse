import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { eq, and, gt, isNull } from "drizzle-orm";

import { db } from "../db/client.js";
import { users, passwordResetTokens } from "../db/schema.js";
import { env } from "../env.js";
import { AppError } from "../errors/app-error.js";

import type {
    RegisterInput,
    LoginInput,
    ForgotPasswordInput,
    ResetPasswordInput,
} from "./auth.schemas.js";

/**
 * JWT payload stored inside the token.
 */
type JwtPayload = {
    sub: string;
    email: string;
};

/**
 * Public user object returned to frontend.
 * Never return passwordHash.
 */
function toPublicUser(user: {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
}) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
    };
}

/**
 * Create JWT token.
 * We use only one token type for this MVP.
 */
function signToken(payload: JwtPayload) {
    return jwt.sign(payload, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN as any, // e.g. "7d" for 7 days
    });
}

/**
 * Hash reset token before storing in DB.
 * Raw reset token is only shown/sent once.
 */
function hashResetToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

function assertRegistrationAllowed(email: string): void {
    if (!env.REGISTRATION_ENABLED) {
        throw new AppError({
            statusCode: 403,
            code: "registration_disabled",
            message: "Registration is currently disabled. Contact your administrator.",
        });
    }

    const allowedUsernames = env.ALLOWED_EMAIL_USERNAMES;
    if (allowedUsernames.length > 0) {
        const emailUsername = email.split("@")[0]?.toLowerCase() ?? "";
        if (!allowedUsernames.some((u) => emailUsername.includes(u))) {
            throw new AppError({
                statusCode: 403,
                code: "email_not_allowed",
                message: "Registration is restricted to authorised users.",
            });
        }
    }
}

export const authService = {
    async register(input: RegisterInput) {
        assertRegistrationAllowed(input.email);

        const existingUser = await db.query.users.findFirst({
            where: eq(users.email, input.email),
        });

        if (existingUser) {
            throw new AppError({
                statusCode: 409,
                code: "email_already_exists",
                message: "An account with this email already exists",
            });
        }

        const passwordHash = await bcrypt.hash(input.password, 12);

        const [createdUser] = await db
            .insert(users)
            .values({
                name: input.name,
                email: input.email,
                passwordHash,
            })
            .returning({
                id: users.id,
                name: users.name,
                email: users.email,
                createdAt: users.createdAt,
            });

        const token = signToken({
            sub: createdUser.id,
            email: createdUser.email,
        });

        return {
            user: toPublicUser(createdUser),
            token,
        };
    },

    async login(input: LoginInput) {
        const user = await db.query.users.findFirst({
            where: eq(users.email, input.email),
        });

        /**
         * Use same error for missing user and wrong password.
         * This prevents attackers from discovering registered emails.
         */
        if (!user) {
            throw new AppError({
                statusCode: 401,
                code: "invalid_credentials",
                message: "Invalid email or password",
            });
        }

        const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

        if (!passwordMatches) {
            throw new AppError({
                statusCode: 401,
                code: "invalid_credentials",
                message: "Invalid email or password",
            });
        }

        const token = signToken({
            sub: user.id,
            email: user.email,
        });

        return {
            user: toPublicUser(user),
            token,
        };
    },

    async getMe(userId: string) {
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
            columns: {
                id: true,
                name: true,
                email: true,
                createdAt: true,
            },
        });

        if (!user) {
            throw new AppError({
                statusCode: 404,
                code: "user_not_found",
                message: "User not found",
            });
        }

        return {
            user,
        };
    },

    async forgotPassword(input: ForgotPasswordInput) {
        const user = await db.query.users.findFirst({
            where: eq(users.email, input.email),
        });

        /**
         * Always return a success-like response.
         * This prevents email enumeration.
         */
        if (!user) {
            return {
                message: "If an account exists, a reset link has been generated",
                resetToken: null,
            };
        }

        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = hashResetToken(rawToken);

        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        await db.insert(passwordResetTokens).values({
            userId: user.id,
            tokenHash,
            expiresAt,
        });

        /**
         * In production:
         * - Do NOT return resetToken in API response.
         * - Send it through email as a reset link.
         *
         * For local development:
         * - Returning token is okay so you can test reset password flow.
         */
        return {
            message: "If an account exists, a reset link has been generated",
            resetToken: rawToken,
        };
    },

    async resetPassword(input: ResetPasswordInput) {
        const tokenHash = hashResetToken(input.token);

        const resetToken = await db.query.passwordResetTokens.findFirst({
            where: and(
                eq(passwordResetTokens.tokenHash, tokenHash),
                gt(passwordResetTokens.expiresAt, new Date()),
                isNull(passwordResetTokens.usedAt)
            ),
        });

        if (!resetToken) {
            throw new AppError({
                statusCode: 400,
                code: "invalid_or_expired_reset_token",
                message: "Reset token is invalid or expired",
            });
        }

        const newPasswordHash = await bcrypt.hash(input.password, 12);

        await db
            .update(users)
            .set({
                passwordHash: newPasswordHash,
                updatedAt: new Date(),
            })
            .where(eq(users.id, resetToken.userId));

        await db
            .update(passwordResetTokens)
            .set({
                usedAt: new Date(),
            })
            .where(eq(passwordResetTokens.id, resetToken.id));

        return {
            message: "Password reset successful",
        };
    },

    async deleteOwnAccount(userId: string) {
        const [deletedUser] = await db
            .delete(users)
            .where(eq(users.id, userId))
            .returning({
                id: users.id,
                email: users.email,
            });

        if (!deletedUser) {
            throw new AppError({
                statusCode: 404,
                code: "user_not_found",
                message: "User not found",
            });
        }

        return {
            message: "Account deleted successfully",
        };
    },
};