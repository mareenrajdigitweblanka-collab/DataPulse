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

  PORT: z.coerce.number().default(4000),

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
    .max(100)
    .default(20),

  AMAZON_MAX_PAGES: z.coerce
    .number()
    .int()
    .min(1)
    .max(10)
    .default(2),

  AMAZON_WORKER_CONCURRENCY: z.coerce
    .number()
    .int()
    .min(1)
    .max(3)
    .default(1),

  AMAZON_HEADLESS: z.coerce.boolean().default(true),

  AMAZON_PROXY_SERVER: z.string().optional().default(""),
  AMAZON_PROXY_USERNAME: z.string().optional().default(""),
  AMAZON_PROXY_PASSWORD: z.string().optional().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables");
  process.exit(1);
}

export const env = parsed.data;