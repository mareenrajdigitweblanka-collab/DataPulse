import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/**
 * This file lives at:
 * backend/src/env.ts
 *
 * Project root .env lives at:
 * datapulse/.env
 *
 * So we resolve ../../.env from this file.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../../.env"),
});

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("7d"),

  PORT: z.coerce.number().default(4000),

  /**
   * eBay vars are optional so Shopify/backend can still run
   * even before eBay credentials are added.
   */
  EBAY_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  EBAY_CLIENT_ID: z.string().min(1).optional(),
  EBAY_CLIENT_SECRET: z.string().min(1).optional(),
  EBAY_MARKETPLACE_ID: z.string().min(1).default("EBAY_US"),
  EBAY_SEARCH_LIMIT: z.coerce.number().int().min(1).max(200).default(50),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;