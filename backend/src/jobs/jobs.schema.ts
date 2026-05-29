import { z } from "zod";

/**
 * For now we allow only Shopify.
 * Other channels are intentionally rejected until their workers exist.
 */
export const channelSchema = z.literal("shopify");

/**
 * Shopify-specific filters.
 * storeUrl is required because Shopify scraping depends on a target store.
 */
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

/**
 * POST /api/v1/jobs body.
 * Google Apps Script/Postman will send this shape.
 */
export const createJobSchema = z.object({
  channel: channelSchema,
  query: z
    .string()
    .trim()
    .min(1, "query is required")
    .max(200, "query must be at most 200 characters"),

  filters: shopifyFiltersSchema,
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type ShopifyFilters = z.infer<typeof shopifyFiltersSchema>;

export const jobIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const getResultsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z
    .enum(["position", "price_asc", "price_desc"])
    .optional()
    .default("position"),
});