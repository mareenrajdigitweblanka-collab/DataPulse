import jwt from "jsonwebtoken";
import type { FastifyReply, FastifyRequest } from "fastify";

import { env } from "../env.js";
import { AppError } from "../errors/app-error.js";

type JwtPayload = {
  sub: string;
  email: string;
};

/**
 * Protect routes using:
 * Authorization: Bearer <token>
 */
export async function requireAuth(
  request: FastifyRequest,
  _reply: FastifyReply
) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError({
      statusCode: 401,
      code: "missing_token",
      message: "Authorization token is required",
    });
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    request.user = {
      id: payload.sub,
      email: payload.email,
    };
  } catch {
    throw new AppError({
      statusCode: 401,
      code: "invalid_token",
      message: "Token is invalid or expired",
    });
  }
}