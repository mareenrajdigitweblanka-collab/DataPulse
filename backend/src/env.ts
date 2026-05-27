import dotenv from "dotenv";
import { z } from "zod";

/**
 * Load root .env file.
 * Backend is running from /backend, so root .env is one level up.
 */
dotenv.config({ path: "../.env" });

/**
 * Runtime validation for environment variables.
 * This prevents the server from starting with missing/invalid config.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().regex(/^(\d+)([smhdwy])$/, "Invalid duration format").default("7d"),
  PORT: z.string().optional(),
});

export const env = envSchema.parse(process.env);