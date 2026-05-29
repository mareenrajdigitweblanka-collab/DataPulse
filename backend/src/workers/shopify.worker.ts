import { UnrecoverableError, Worker } from "bullmq";

import "../env.js";

import { redisConnection } from "../queue/redis.js";
import {
  SHOPIFY_QUEUE_NAME,
  type ShopifyJobData,
} from "../queue/shopify.queue.js";
import { scrapeShopifyProducts } from "../scrapers/shopify.scraper.js";
import { filterShopifyProducts } from "../filters/shopify.filter.js";
import {
  completeJobWithResults,
  failJob,
  updateJobFiltering,
  updateJobProgress,
  updateJobRunning,
} from "../jobs/jobs.repository.js";

/**
 * Simple timeout wrapper.
 * BullMQ retries the job if we throw.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  let timeout: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeout!);
  }
}

const worker = new Worker<ShopifyJobData>(
  SHOPIFY_QUEUE_NAME,
  async (job) => {
    const data = job.data;

    console.log({
      event: "shopify_job_started",
      jobId: data.jobId,
      userId: data.userId,
    });

    await updateJobRunning(data.jobId);
    await job.updateProgress(10);

    /**
     * Scrape /products.json.
     */
    // const rawProducts = await withTimeout(
    //   scrapeShopifyProducts({
    //     storeUrl: data.filters.storeUrl,
    //     query: data.query,
    //     filters: data.filters,
    //     maxPages: 2,
    //   }),
    //   5 * 60 * 1000,
    //   "Shopify job timed out after 5 minutes"
    // );

    let rawProducts;

    try {
      rawProducts = await withTimeout(
        scrapeShopifyProducts({
          storeUrl: data.filters.storeUrl,
          query: data.query,
          filters: data.filters,
          maxPages: 2,
        }),
        5 * 60 * 1000,
        "Shopify job timed out after 5 minutes"
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Shopify scrape error";

      /**
       * These errors are store configuration/access problems.
       * Retrying will not fix them.
       */
      if (
        message.includes("blocks public /products.json") ||
        message.includes("does not expose /products.json")
      ) {
        throw new UnrecoverableError(message);
      }

      /**
       * Network/timeouts can still retry.
       */
      throw error;
    }

    await updateJobProgress({
      jobId: data.jobId,
      progressPercent: 70,
    });
    await job.updateProgress(70);

    /**
     * Filter after scraping.
     */
    await updateJobFiltering(data.jobId);

    const { filteredProducts, summary } = filterShopifyProducts({
      products: rawProducts,
      filters: data.filters,
    });

    /**
     * Store filtered results.
     */
    await completeJobWithResults({
      jobId: data.jobId,
      userId: data.userId,
      scrapedCount: summary.totalScraped,
      filteredProducts,
    });

    await job.updateProgress(100);

    console.log({
      event: "shopify_job_completed",
      jobId: data.jobId,
      totalScraped: summary.totalScraped,
      totalFiltered: summary.totalFiltered,
    });

    return {
      totalScraped: summary.totalScraped,
      totalFiltered: summary.totalFiltered,
    };
  },
  {
    connection: redisConnection,

    /**
     * Shopify is light because it is HTTP JSON scraping.
     * Keep this aligned with your URD phase-1 limit.
     */
    concurrency: 5,
  }
);

worker.on("failed", async (job, error) => {
  if (!job) return;

  const attemptsAllowed = job.opts.attempts ?? 1;
  const attemptsMade = job.attemptsMade;

  console.error({
    event: "shopify_job_failed",
    jobId: job.data.jobId,
    attemptsMade,
    attemptsAllowed,
    error: error.message,
  });

  /**
   * Only mark DB as error after final retry.
   */
  if (attemptsMade >= attemptsAllowed) {
    const isTimeout = error.message.toLowerCase().includes("timed out");

    await failJob({
      jobId: job.data.jobId,
      message: error.message,
      status: isTimeout ? "timeout" : "error",
    });
  }
});

worker.on("completed", (job) => {
  console.log({
    event: "shopify_worker_completed_event",
    jobId: job.data.jobId,
  });
});

worker.on("error", (error) => {
  console.error({
    event: "shopify_worker_error",
    error: error.message,
  });
});

console.log("Shopify worker started and listening for jobs...");