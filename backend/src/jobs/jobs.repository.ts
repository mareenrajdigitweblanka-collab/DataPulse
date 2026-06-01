import { and, desc, eq } from "drizzle-orm";

import { db } from "../db/client.js";
import { jobs, results } from "../db/schema.js";
import type { EbayFilters, ShopifyFilters } from "./jobs.schema.js";

export async function createShopifyJobRecord(input: {
  userId: string;
  query: string;
  filters: ShopifyFilters;
  queuePosition: number;
}) {
  const [job] = await db
    .insert(jobs)
    .values({
      userId: input.userId,
      channel: "shopify",
      query: input.query,
      filters: input.filters,
      status: "queued",
      queuePosition: input.queuePosition,
      progressPercent: 0,
    })
    .returning();

  return job;
}

export async function getUserJobById(input: {
  jobId: string;
  userId: string;
}) {
  return db.query.jobs.findFirst({
    where: and(eq(jobs.id, input.jobId), eq(jobs.userId, input.userId)),
  });
}

export async function getUserJobs(input: {
  userId: string;
  page: number;
  limit: number;
}) {
  const offset = (input.page - 1) * input.limit;

  return db
    .select()
    .from(jobs)
    .where(eq(jobs.userId, input.userId))
    .orderBy(desc(jobs.createdAt))
    .limit(input.limit)
    .offset(offset);
}

export async function updateJobRunning(jobId: string) {
  await db
    .update(jobs)
    .set({
      status: "running",
      queuePosition: null,
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

export async function completeJobWithResults(input: {
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

export async function getResultsForJob(input: {
  jobId: string;
  userId: string;
}) {
  return db
    .select()
    .from(results)
    .where(and(eq(results.jobId, input.jobId), eq(results.userId, input.userId)));
}

export async function createEbayJobRecord(input: {
  userId: string;
  query: string;
  filters: EbayFilters;
  queuePosition: number;
}) {
  const [job] = await db
    .insert(jobs)
    .values({
      userId: input.userId,
      channel: "ebay",
      query: input.query,
      filters: input.filters,
      status: "queued",
      queuePosition: input.queuePosition,
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