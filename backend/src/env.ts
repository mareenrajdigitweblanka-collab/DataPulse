import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

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

  DEV_API_KEY: z.string().min(1).optional(),

  REGISTRATION_ENABLED: z.coerce.boolean().default(true),

  ALLOWED_EMAIL_USERNAMES: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return [];
      return val
        .split(",")
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean);
    }),

  PORT: z.coerce.number().default(4000),

  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://127.0.0.1:3000")
    .transform((val) =>
      (val || "http://localhost:3000,http://127.0.0.1:3000")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean)
    )
    .refine(
      (origins) =>
        origins.length > 0 &&
        origins.every((o) => {
          try {
            new URL(o);
            return true;
          } catch {
            return false;
          }
        }),
      { message: "CORS_ORIGINS must be a non-empty comma-separated list of valid URLs" }
    ),

  /**
   * eBay vars are optional so backend and other platform services can still run
   * even before eBay credentials are added.
   */
  EBAY_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  EBAY_CLIENT_ID: z.string().min(1).optional(),
  EBAY_CLIENT_SECRET: z.string().min(1).optional(),
  EBAY_MARKETPLACE_ID: z.string().min(1).default("EBAY_GB"),
  EBAY_SEARCH_LIMIT: z.coerce.number().int().min(1).max(200).default(50),
  EBAY_SEARCH_MAX_TOTAL: z.coerce.number().int().min(1).max(10_000).default(200),


  /**
  * Google Shopping via SerpApi.
  * Optional here so backend and other platform services can still run without SerpApi key.
  * Google worker validates it when used.
  */
  SERPAPI_API_KEY: z.string().min(1).optional(),

  GOOGLE_SHOPPING_SEARCH_LIMIT: z.coerce
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(200),

  GOOGLE_SHOPPING_PAGE_SIZE: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(40),

  GOOGLE_SHOPPING_MAX_PAGES: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10),
    
  GOOGLE_SHOPPING_DEFAULT_COUNTRY: z.string().min(2).default("gb"),
  GOOGLE_SHOPPING_DEFAULT_LANGUAGE: z.string().min(2).default("en"),

  /**
   * Amazon scraping config.
   * Keep concurrency low because Amazon blocks aggressively.
   */
  AMAZON_BASE_URL: z.string().url().default("https://www.amazon.co.uk"),

  AMAZON_RESULT_LIMIT: z.coerce
    .number()
    .int()
    .min(1)
    .max(600)
    .default(100),

  AMAZON_MAX_PAGES: z.coerce
    .number()
    .int()
    .min(1)
    .max(20)
    .default(5),

  AMAZON_WORKER_CONCURRENCY: z.coerce
    .number()
    .int()
    .min(1)
    .max(3)
    .default(1),

  AMAZON_HEADLESS: z.coerce.boolean().default(true),

  /**
   * Reuse a persistent browser profile so cookies/session build trust
   * across jobs from the same IP (important when not using a proxy).
   */
  AMAZON_USER_DATA_DIR: z.string().default("./.amazon-profile"),

  /**
   * Visit the homepage and accept cookies before searching, to seed a
   * realistic session. Disable to navigate straight to the search page.
   */
  AMAZON_WARMUP: z.coerce.boolean().default(true),

  /**
   * Minimum gap (ms) between Amazon jobs on a single worker. Without a
   * proxy, request rate from one IP is the main block trigger.
   */
  AMAZON_MIN_JOB_GAP_MS: z.coerce.number().int().min(0).default(30000),

  AMAZON_PROXY_SERVER: z.string().optional().default(""),
  AMAZON_PROXY_USERNAME: z.string().optional().default(""),
  AMAZON_PROXY_PASSWORD: z.string().optional().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;