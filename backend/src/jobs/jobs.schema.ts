import { z } from "zod";

export const channelSchema = z.enum(["shopify", "ebay"]);

export const shopifyFiltersSchema = z.object({
  storeUrl: z
    .string()
    .trim()
    .url("storeUrl must be a valid URL")
    .refine((url) => url.startsWith("https://"), {
      message: "storeUrl must use HTTPS",
    }),

  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  inStockOnly: z.coerce.boolean().optional().default(false),

  vendor: z.string().trim().optional().default(""),
  productType: z.string().trim().optional().default(""),
});

export const ebayFiltersSchema = z.object({
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),

  condition: z
    .enum(["any", "new", "used", "refurbished"])
    .optional()
    .default("any"),

  freeShippingOnly: z.coerce.boolean().optional().default(false),
  buyItNowOnly: z.coerce.boolean().optional().default(false),
});

/**
 * Shopify allows empty query because we use it for whole-store scraping.
 * eBay requires query because Browse API search is keyword-based.
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
]);

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type ShopifyFilters = z.infer<typeof shopifyFiltersSchema>;
export type EbayFilters = z.infer<typeof ebayFiltersSchema>;

export const jobIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const getResultsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  sortBy: z
    .enum(["position", "price_asc", "price_desc"])
    .optional()
    .default("position"),
});