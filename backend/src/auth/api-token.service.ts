import crypto from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "../db/client.js";
import { apiTokens, users } from "../db/schema.js";

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function createRawApiToken() {
  const random = crypto.randomBytes(32).toString("hex");
  return `dp_live_${random}`;
}

export async function createApiTokenForUser(input: {
  userId: string;
  name: string;
  scopes?: string[];
  expiresAt?: Date | null;
}) {
  const rawToken = createRawApiToken();
  const tokenHash = sha256(rawToken);
  const tokenPrefix = rawToken.slice(0, 16);

  const [row] = await db
    .insert(apiTokens)
    .values({
      userId: input.userId,
      name: input.name,
      tokenHash,
      tokenPrefix,
      scopes: input.scopes ?? ["jobs:create", "jobs:read", "results:read"],
      expiresAt: input.expiresAt ?? null,
    })
    .returning({
      id: apiTokens.id,
      name: apiTokens.name,
      tokenPrefix: apiTokens.tokenPrefix,
      createdAt: apiTokens.createdAt,
    });

  return {
    apiToken: row,
    rawToken,
  };
}

export async function verifyApiToken(rawToken: string) {
  const tokenHash = sha256(rawToken);

  const token = await db.query.apiTokens.findFirst({
    where: and(
      eq(apiTokens.tokenHash, tokenHash),
      eq(apiTokens.isActive, true),
      isNull(apiTokens.revokedAt)
    ),
  });

  if (!token) {
    return null;
  }

  if (token.expiresAt && token.expiresAt.getTime() < Date.now()) {
    return null;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, token.userId),
  });

  if (!user) {
    return null;
  }

  await db
    .update(apiTokens)
    .set({
      lastUsedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(apiTokens.id, token.id));

  return {
    user,
    token,
  };
}