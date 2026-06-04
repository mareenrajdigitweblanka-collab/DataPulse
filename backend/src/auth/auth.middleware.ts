import jwt from "jsonwebtoken";
import type { FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";

import { env } from "../env.js";
import { AppError } from "../errors/app-error.js";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";

type JwtPayload = {
  sub: string;
  email: string;
};

/**
 * Protect routes using:
 * Authorization: Bearer <JWT>
 *
 * Important:
 * jwt.verify() only checks if the token is signed correctly and not expired.
 * It does NOT check whether the user still exists in the database.
 *
 * So after JWT verification, we must check users table also.
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

  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    throw new AppError({
      statusCode: 401,
      code: "missing_token",
      message: "Authorization token is required",
    });
  }

  let payload: JwtPayload;

  try {
    payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    throw new AppError({
      statusCode: 401,
      code: "invalid_token",
      message: "Token is invalid or expired",
    });
  }

  if (!payload.sub || typeof payload.sub !== "string") {
    throw new AppError({
      statusCode: 401,
      code: "invalid_token_payload",
      message: "Token payload is invalid",
    });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, payload.sub),
    columns: {
      id: true,
      email: true,
    },
  });

  if (!user) {
    throw new AppError({
      statusCode: 401,
      code: "invalid_session",
      message: "Your session is no longer valid. Please login or register again.",
    });
  }

  request.user = {
    id: user.id,
    email: user.email,
    authType: "jwt",
  };
}

export const authenticate = requireAuth;