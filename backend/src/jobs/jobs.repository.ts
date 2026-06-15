import { and, desc, eq, count } from "drizzle-orm";

import { db } from "../db/client.js";
import { jobs, results } from "../db/schema.js";
import type { AmazonFilters, EbayFilters, GoogleFilters, ShopifyFilters } from "./jobs.schema.js";

export async function getUserJobById(input: {
  jobId: string;
  userId: string;
}) {
  return db.query.jobs.findFirst({
    where: and(eq(jobs.id, input.jobId), eq(jobs.userId, input.userId)),
  });
}

export async function getUserJobsPage(input: {
  userId: string;
  page: number;
  limit: number;
}) {
  const offset = (input.page - 1) * input.limit;

  const rows = await db
    .select()
    .from(jobs)
    .where(eq(jobs.userId, input.userId))
    .orderBy(desc(jobs.createdAt))
    .limit(input.limit)
    .offset(offset);

  const [totalRow] = await db
    .select({ total: count() })
    .from(jobs)
    .where(eq(jobs.userId, input.userId));

  const total = Number(totalRow?.total ?? 0);
  const totalPages = Math.max(Math.ceil(total / input.limit), 1);

  return {
    jobs: rows,
    total,
    totalPages,
    page: input.page,
    limit: input.limit,
    hasPreviousPage: input.page > 1,
    hasNextPage: input.page < totalPages,
  };
}

export async function updateJobRunning(jobId: string) {
  await db
    .update(jobs)
    .set({
      status: "running",
      progressPercent: 10,
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, jobId));
}

export async function updateJobProgress(input: {
  jobId: string;
  progressPercent: number;
}) {
  await db
    .update(jobs)
    .set({
      progressPercent: input.progressPercent,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, input.jobId));
}

export async function updateJobFiltering(jobId: string) {
  await db
    .update(jobs)
    .set({
      status: "filtering",
      progressPercent: 80,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, jobId));
}

export async function failJob(input: {
  jobId: string;
  message: string;
  status?: "error" | "timeout";
}) {
  await db
    .update(jobs)
    .set({
      status: input.status ?? "error",
      errorMessage: input.message,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, input.jobId));
}

export async function getResultsPageForJob(input: {
  jobId: string;
  userId: string;
  page: number;
  limit: number;
  sortBy: "position" | "price_asc" | "price_desc" | "rating_desc" | "reviews_desc";
}) {
  const rows = await db
    .select()
    .from(results)
    .where(and(eq(results.jobId, input.jobId), eq(results.userId, input.userId)));

  /**
   * Parse a possibly-numeric field that may be stored as a number, a
   * formatted string, or be missing entirely. Returns null when absent.
   */
  const parseNumeric = (raw: number | string | null | undefined) => {
    if (typeof raw === "number") {
      return Number.isFinite(raw) ? raw : null;
    }

    if (typeof raw === "string") {
      const parsed = Number.parseFloat(
        raw.replace(/,/g, "").replace(/[^\d.-]/g, "")
      );

      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  };

  const getPrice = (row: typeof rows[number]) => {
    const data = row.data as {
      price?: number | string | null;
      minPrice?: number | string | null;
    };

    return parseNumeric(data.price ?? data.minPrice);
  };

  const getRating = (row: typeof rows[number]) => {
    const data = row.data as { rating?: number | string | null };

    return parseNumeric(data.rating);
  };

  /**
   * Amazon stores review count as `reviewCount`, Google as `reviews`.
   */
  const getReviews = (row: typeof rows[number]) => {
    const data = row.data as {
      reviewCount?: number | string | null;
      reviews?: number | string | null;
    };

    return parseNumeric(data.reviewCount ?? data.reviews);
  };

  const sortedRows = [...rows].sort((a, b) => {
    if (input.sortBy === "position") {
      return a.position - b.position;
    }

    /**
     * Pick the value extractor for the active sort. Missing values sink to
     * the bottom and ties fall back to original position, matching the
     * existing price-sort behaviour.
     */
    const getValue =
      input.sortBy === "rating_desc"
        ? getRating
        : input.sortBy === "reviews_desc"
          ? getReviews
          : getPrice;

    const valueA = getValue(a);
    const valueB = getValue(b);

    if (valueA === null && valueB === null) return a.position - b.position;
    if (valueA === null) return 1;
    if (valueB === null) return -1;

    if (input.sortBy === "price_asc") {
      return valueA - valueB;
    }

    /**
     * price_desc, rating_desc and reviews_desc all sort high to low.
     */
    return valueB - valueA;
  });

  const total = sortedRows.length;
  const totalPages = Math.max(Math.ceil(total / input.limit), 1);
  const offset = (input.page - 1) * input.limit;
  const paginatedRows = sortedRows.slice(offset, offset + input.limit);

  return {
    results: paginatedRows,
    total,
    totalPages,
    page: input.page,
    limit: input.limit,
    hasPreviousPage: input.page > 1,
    hasNextPage: input.page < totalPages,
  };
}

export async function createShopifyJobRecord(input: {
  userId: string;
  query: string;
  filters: ShopifyFilters;
}) {
  const [job] = await db
    .insert(jobs)
    .values({
      userId: input.userId,
      channel: "shopify",
      query: input.query,
      filters: input.filters,
      status: "queued",
      progressPercent: 0,
    })
    .returning();

  return job;
}

export async function completeShopifyJobWithResults(input: {
  jobId: string;
  userId: string;
  scrapedCount: number;
  filteredProducts: unknown[];
}) {
  await db.transaction(async (tx) => {
    /**
     * Clear old results for safety.
     * This helps if a job is retried and reaches this point again.
     */
    await tx.delete(results).where(eq(results.jobId, input.jobId));

    if (input.filteredProducts.length > 0) {
      await tx.insert(results).values(
        input.filteredProducts.map((product, index) => ({
          jobId: input.jobId,
          userId: input.userId,
          channel: "shopify" as const,
          position: index + 1,
          data: product,
        }))
      );
    }

    await tx
      .update(jobs)
      .set({
        status: "done",
        progressPercent: 100,
        totalScraped: input.scrapedCount,
        totalFiltered: input.filteredProducts.length,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, input.jobId));
  });
}

export async function createEbayJobRecord(input: {
  userId: string;
  query: string;
  filters: EbayFilters;
}) {
  const [job] = await db
    .insert(jobs)
    .values({
      userId: input.userId,
      channel: "ebay",
      query: input.query,
      filters: input.filters,
      status: "queued",
      progressPercent: 0,
    })
    .returning();

  return job;
}

export async function completeEbayJobWithResults(input: {
  jobId: string;
  userId: string;
  scrapedCount: number;
  filteredProducts: unknown[];
}) {
  await db.transaction(async (tx) => {
    await tx.delete(results).where(eq(results.jobId, input.jobId));

    if (input.filteredProducts.length > 0) {
      await tx.insert(results).values(
        input.filteredProducts.map((product, index) => {
          const safeProduct =
            typeof product === "string" ? JSON.parse(product) : product;

          return {
            jobId: input.jobId,
            userId: input.userId,
            channel: "ebay" as const,
            position: index + 1,
            data: safeProduct,
          };
        })
      );
    }

    await tx
      .update(jobs)
      .set({
        status: "done",
        progressPercent: 100,
        totalScraped: input.scrapedCount,
        totalFiltered: input.filteredProducts.length,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, input.jobId));
  });
}

export async function createGoogleJobRecord(input: {
  userId: string;
  query: string;
  filters: GoogleFilters;
}) {
  const [job] = await db
    .insert(jobs)
    .values({
      userId: input.userId,
      channel: "google",
      query: input.query,
      filters: input.filters,
      status: "queued",
      progressPercent: 0,
    })
    .returning();

  return job;
}

export async function completeGoogleJobWithResults(input: {
  jobId: string;
  userId: string;
  scrapedCount: number;
  filteredProducts: unknown[];
}) {
  await db.transaction(async (tx) => {
    await tx.delete(results).where(eq(results.jobId, input.jobId));

    if (input.filteredProducts.length > 0) {
      await tx.insert(results).values(
        input.filteredProducts.map((product, index) => {
          const safeProduct =
            typeof product === "string" ? JSON.parse(product) : product;

          return {
            jobId: input.jobId,
            userId: input.userId,
            channel: "google" as const,
            position: index + 1,
            data: safeProduct,
          };
        })
      );
    }

    await tx
      .update(jobs)
      .set({
        status: "done",
        progressPercent: 100,
        totalScraped: input.scrapedCount,
        totalFiltered: input.filteredProducts.length,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, input.jobId));
  });
}

export async function createAmazonJobRecord(input: {
  userId: string;
  query: string;
  filters: AmazonFilters;
}) {
  const [job] = await db
    .insert(jobs)
    .values({
      userId: input.userId,
      channel: "amazon",
      query: input.query,
      filters: input.filters,
      status: "queued",
      progressPercent: 0,
    })
    .returning();

  return job;
}

export async function completeAmazonJobWithResults(input: {
  jobId: string;
  userId: string;
  scrapedCount: number;
  filteredProducts: unknown[];
}) {
  await db.transaction(async (tx) => {
    await tx.delete(results).where(eq(results.jobId, input.jobId));

    if (input.filteredProducts.length > 0) {
      await tx.insert(results).values(
        input.filteredProducts.map((product, index) => {
          const safeProduct =
            typeof product === "string" ? JSON.parse(product) : product;

          return {
            jobId: input.jobId,
            userId: input.userId,
            channel: "amazon" as const,
            position: index + 1,
            data: safeProduct,
          };
        })
      );
    }

    await tx
      .update(jobs)
      .set({
        status: "done",
        progressPercent: 100,
        totalScraped: input.scrapedCount,
        totalFiltered: input.filteredProducts.length,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, input.jobId));
  });
}

export async function deleteUserJob(input: {
  jobId: string;
  userId: string;
}) {
  return db.transaction(async (tx) => {
    const job = await tx.query.jobs.findFirst({
      where: and(eq(jobs.id, input.jobId), eq(jobs.userId, input.userId)),
    });

    if (!job) {
      return null;
    }

    await tx
      .delete(results)
      .where(and(eq(results.jobId, input.jobId), eq(results.userId, input.userId)));

    await tx
      .delete(jobs)
      .where(and(eq(jobs.id, input.jobId), eq(jobs.userId, input.userId)));

    return job;
  });
}