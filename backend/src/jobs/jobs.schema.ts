import { z } from "zod";

export const channelSchema = z.enum(["shopify", "ebay", "google", "amazon"]);

export const shopifyFiltersSchema = z.object({
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  inStockOnly: z.coerce.boolean().optional().default(false),

  storeUrl: z
    .string()
    .trim()
    .url("storeUrl must be a valid URL")
    .refine((url) => url.startsWith("https://"), {
      message: "storeUrl must use HTTPS",
    }),
  vendor: z.string().trim().optional().default(""),
  productType: z.string().trim().optional().default(""),
});

export const ebayFiltersSchema = z.object({
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  inStockOnly: z.coerce.boolean().optional().default(false),

  condition: z
    .enum(["any", "new", "used", "refurbished"])
    .optional()
    .default("any"),
  freeShippingOnly: z.coerce.boolean().optional().default(false),
  buyItNowOnly: z.coerce.boolean().optional().default(false),
});

export const googleFiltersSchema = z.object({
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  /**
   * Google result availability is not always consistent.
   * We keep this but apply only when mapped isInStock is false.
   */
  inStockOnly: z.coerce.boolean().optional().default(false),

  /**
   * Google country parameter maps to SerpApi gl.
   * SerpApi expects country codes such as us, uk, ca, au, de.
   */
  country: z
    .enum(["us", "gb", "ca", "au", "de"])
    .optional()
    .default("gb"),

  /**
   * Search result language maps to SerpApi hl.
   */
  language: z.string().min(2).max(10).optional().default("en"),

  /**
   * For now, sort is mostly post-processing.
   * SerpApi/Google Shopping sorting behavior can vary.
   */
  sortBy: z
    .enum(["relevance", "price_asc", "price_desc", "rating"])
    .optional()
    .default("relevance"),

  /**
   * Optional store/source text filter.
   * Example: Amazon, eBay, Walmart, Best Buy.
   */
  storeName: z.string().trim().optional().default(""),
});

export const amazonFiltersSchema = z.object({
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  inStockOnly: z.coerce.boolean().optional().default(false),

  minRating: z.coerce.number().min(1).max(5).optional(),
  minReviewCount: z.coerce.number().int().min(0).optional(),
});

/**
 * Shopify allows empty query for whole-store scraping.
 * eBay, Google, and Amazon require query because they are search APIs.
 */
export const createJobSchema = z.discriminatedUnion("channel", [
  z.object({
    channel: z.literal("shopify"),
    query: z
      .string()
      .trim()
      .max(200, "query must be at most 200 characters")
      .optional()
      .default(""),
    filters: shopifyFiltersSchema,
  }),

  z.object({
    channel: z.literal("ebay"),
    query: z
      .string()
      .trim()
      .min(1, "query is required for eBay")
      .max(200, "query must be at most 200 characters"),
    filters: ebayFiltersSchema,
  }),

  z.object({
    channel: z.literal("google"),
    query: z
      .string()
      .trim()
      .min(1, "query is required for Google Shopping")
      .max(200, "query must be at most 200 characters"),
    filters: googleFiltersSchema,
  }),

  z.object({
    channel: z.literal("amazon"),
    query: z
      .string()
      .trim()
      .min(1, "query is required for Amazon")
      .max(200, "query must be at most 200 characters"),
    filters: amazonFiltersSchema,
  }),
]);

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type ShopifyFilters = z.infer<typeof shopifyFiltersSchema>;
export type EbayFilters = z.infer<typeof ebayFiltersSchema>;
export type GoogleFilters = z.infer<typeof googleFiltersSchema>;
export type AmazonFilters = z.infer<typeof amazonFiltersSchema>;

export const jobIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const getResultsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  sortBy: z
    .enum(["position", "price_asc", "price_desc", "rating_desc", "reviews_desc"])
    .optional()
    .default("position"),
});