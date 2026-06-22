import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";

export const DEV_USER_EMAIL = "dev-api@datapulse.internal";

export async function seedDevUser(): Promise<{ id: string; email: string }> {
  const existing = await db.query.users.findFirst({
    where: eq(users.email, DEV_USER_EMAIL),
    columns: { id: true, email: true },
  });

  if (existing) return existing;

  // Not a valid bcrypt hash — login via password is permanently blocked.
  const unusableHash = `dev-nologin-${crypto.randomBytes(32).toString("hex")}`;

  const [created] = await db
    .insert(users)
    .values({
      name: "DataPulse API Bot",
      email: DEV_USER_EMAIL,
      passwordHash: unusableHash,
    })
    .returning({ id: users.id, email: users.email });

  return created;
}
