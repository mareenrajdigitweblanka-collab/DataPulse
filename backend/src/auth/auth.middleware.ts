import jwt from "jsonwebtoken";
import type { FastifyReply, FastifyRequest } from "fastify";

import { env } from "../env.js";
import { AppError } from "../errors/app-error.js";
import { verifyApiToken } from "./api-token.service.js";

type JwtPayload = {
  sub: string;
  email: string;
};

/**
 * Protect routes using:
 * Authorization: Bearer <JWT>
 * OR
 * Authorization: Bearer dp_live_xxxxxxxxx
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

  /**
   * Google Sheets / Apps Script API token mode.
   */
  if (token.startsWith("dp_live_")) {
    const verified = await verifyApiToken(token);

    if (!verified) {
      throw new AppError({
        statusCode: 401,
        code: "invalid_api_token",
        message: "API token is invalid, expired, or revoked",
      });
    }

    request.user = {
      id: verified.user.id,
      email: verified.user.email,
      authType: "api_token",
      apiTokenId: verified.token.id,
    };

    return;
  }

  /**
   * Existing JWT mode.
   */
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    request.user = {
      id: payload.sub,
      email: payload.email,
      authType: "jwt",
    };
  } catch {
    throw new AppError({
      statusCode: 401,
      code: "invalid_token",
      message: "Token is invalid or expired",
    });
  }
}

export const authenticate = requireAuth;