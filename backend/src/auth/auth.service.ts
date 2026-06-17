import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { eq, and, gt, isNull } from "drizzle-orm";

import { db } from "../db/client.js";
import { users, passwordResetTokens } from "../db/schema.js";
import { env } from "../env.js";
import { AppError } from "../errors/app-error.js";
import { redisConnection } from "../queue/redis.js";
import { sendOtpEmail } from "../services/email.service.js";

import type {
    RegisterInput,
    LoginInput,
    ForgotPasswordInput,
    ResetPasswordInput,
    VerifyOtpInput,
    ResendOtpInput,
} from "./auth.schemas.js";

type JwtPayload = {
    sub: string;
    email: string;
};

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

function signToken(payload: JwtPayload) {
    return jwt.sign(payload, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN as any,
    });
}

function hashResetToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

const OTP_TTL = 600;
const RESEND_COOLDOWN = 60;

function otpKey(email: string) { return `otp:${email}`; }
function resendCooldownKey(email: string) { return `otp:resend:${email}`; }

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
        await db.insert(users).values({ name: input.name, email: input.email, passwordHash });

        const otp = String(crypto.randomInt(100000, 999999));
        await redisConnection.set(otpKey(input.email), otp, "EX", OTP_TTL);

        try {
            await sendOtpEmail(input.email, otp);
        } catch {
            // Roll back: remove user and OTP so they can register again
            await db.delete(users).where(eq(users.email, input.email));
            await redisConnection.del(otpKey(input.email));
            throw new AppError({
                statusCode: 502,
                code: "email_send_failed",
                message: "Failed to send verification email. Please check your email address and try again.",
            });
        }

        return { message: "Verification code sent to your email.", email: input.email };
    },

    async verifyOtp(input: VerifyOtpInput) {
        const stored = await redisConnection.get(otpKey(input.email));

        if (!stored || stored !== input.otp) {
            throw new AppError({
                statusCode: 400,
                code: "invalid_or_expired_otp",
                message: "Invalid or expired verification code.",
            });
        }

        const [updatedUser] = await db
            .update(users)
            .set({ emailVerified: true, updatedAt: new Date() })
            .where(eq(users.email, input.email))
            .returning({
                id: users.id,
                name: users.name,
                email: users.email,
                createdAt: users.createdAt,
            });

        if (!updatedUser) {
            throw new AppError({
                statusCode: 404,
                code: "user_not_found",
                message: "User not found.",
            });
        }

        await redisConnection.del(otpKey(input.email));

        const token = signToken({ sub: updatedUser.id, email: updatedUser.email });
        return { user: toPublicUser(updatedUser), token };
    },

    async resendOtp(input: ResendOtpInput) {
        const cooldown = await redisConnection.get(resendCooldownKey(input.email));

        if (cooldown) {
            throw new AppError({
                statusCode: 429,
                code: "resend_too_soon",
                message: "Please wait before requesting a new code.",
            });
        }

        const user = await db.query.users.findFirst({ where: eq(users.email, input.email) });

        if (!user || user.emailVerified) {
            return { message: "If applicable, a new code has been sent." };
        }

        const otp = String(crypto.randomInt(100000, 999999));
        await redisConnection.set(otpKey(input.email), otp, "EX", OTP_TTL);

        try {
            await sendOtpEmail(input.email, otp);
        } catch {
            await redisConnection.del(otpKey(input.email));
            throw new AppError({
                statusCode: 502,
                code: "email_send_failed",
                message: "Failed to send verification email. Please try again.",
            });
        }

        await redisConnection.set(resendCooldownKey(input.email), "1", "EX", RESEND_COOLDOWN);
        return { message: "A new verification code has been sent." };
    },

    async login(input: LoginInput) {
        const user = await db.query.users.findFirst({
            where: eq(users.email, input.email),
        });

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

        if (!user.emailVerified) {
            throw new AppError({
                statusCode: 403,
                code: "email_not_verified",
                message: "Please verify your email before logging in.",
            });
        }

        const token = signToken({ sub: user.id, email: user.email });
        return { user: toPublicUser(user), token };
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

        return { user };
    },

    async forgotPassword(input: ForgotPasswordInput) {
        const user = await db.query.users.findFirst({
            where: eq(users.email, input.email),
        });

        if (!user) {
            return {
                message: "If an account exists, a reset link has been generated",
                resetToken: null,
            };
        }

        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = hashResetToken(rawToken);
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await db.insert(passwordResetTokens).values({ userId: user.id, tokenHash, expiresAt });

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
            .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
            .where(eq(users.id, resetToken.userId));

        await db
            .update(passwordResetTokens)
            .set({ usedAt: new Date() })
            .where(eq(passwordResetTokens.id, resetToken.id));

        return { message: "Password reset successful" };
    },

    async deleteOwnAccount(userId: string) {
        const [deletedUser] = await db
            .delete(users)
            .where(eq(users.id, userId))
            .returning({ id: users.id, email: users.email });

        if (!deletedUser) {
            throw new AppError({
                statusCode: 404,
                code: "user_not_found",
                message: "User not found",
            });
        }

        return { message: "Account deleted successfully" };
    },
};
