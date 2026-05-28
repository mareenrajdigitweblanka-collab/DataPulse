import { z } from "zod";

/**
 * Create job validation.
 *
 * Today only Amazon is active.
 * eBay, Google, and Shopify are intentionally rejected.
 */
export const createJobSchema = z.object({
  channel: z.literal("amazon"),

  query: z
    .string()
    .trim()
    .min(1, "Query is required")
    .max(200, "Query cannot exceed 200 characters"),

  /**
   * Amazon filters for first fake worker version.
   */
  filters: z
    .object({
      minPrice: z.number().min(0).optional(),
      maxPrice: z.number().min(0).optional(),
      inStockOnly: z.boolean().optional(),

      minRating: z.number().min(1).max(5).optional(),
      minReviewCount: z.number().min(0).optional(),
      primeOnly: z.boolean().optional(),
    })
    .default({}),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;