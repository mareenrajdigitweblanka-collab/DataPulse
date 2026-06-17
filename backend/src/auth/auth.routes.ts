import type { FastifyInstance, FastifyRequest } from "fastify";

import { authService } from "./auth.service.js";
import {
    registerSchema,
    loginSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
} from "./auth.schemas.js";
import { requireAuth } from "./auth.middleware.js";
import { AppError } from "../errors/app-error.js";

function getAuthenticatedUserId(request: FastifyRequest) {
    if (!request.user?.id) {
        throw new AppError({
            statusCode: 401,
            code: "unauthorized",
            message: "Authentication required",
        });
    }

    return request.user.id;
}

export async function authRoutes(app: FastifyInstance) {
    app.post("/register", async (request, reply) => {
        const body = registerSchema.parse(request.body);
        const result = await authService.register(body);

        return reply.code(200).send({
            success: true,
            data: result,
        });
    });

    app.post("/login", async (request, reply) => {
        const body = loginSchema.parse(request.body);
        const result = await authService.login(body);

        return reply.send({
            success: true,
            data: result,
        });
    });

    app.get("/me", { preHandler: requireAuth }, async (request, reply) => {
        const userId = getAuthenticatedUserId(request);
        const result = await authService.getMe(userId);

        return reply.send({
            success: true,
            data: result,
        });
    });

    app.post("/forgot-password", async (request, reply) => {
        const body = forgotPasswordSchema.parse(request.body);
        const result = await authService.forgotPassword(body);

        return reply.send({
            success: true,
            data: result,
        });
    });

    app.post("/reset-password", async (request, reply) => {
        const body = resetPasswordSchema.parse(request.body);
        const result = await authService.resetPassword(body);

        return reply.send({
            success: true,
            data: result,
        });
    });

    app.delete("/account", { preHandler: requireAuth }, async (request, reply) => {
        const userId = getAuthenticatedUserId(request);
        const result = await authService.deleteOwnAccount(userId);

        return reply.send({
            success: true,
            data: result,
        });
    });

}