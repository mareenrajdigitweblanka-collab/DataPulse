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
  completeShopifyJobWithResults,
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

    let rawProducts;

    try {
      rawProducts = await withTimeout(
        scrapeShopifyProducts({
          storeUrl: data.filters.storeUrl,
          query: data.query,
          filters: data.filters,
          maxPages: null,       // Scrape all pages.
        }),
        15 * 60 * 1000,
        "Shopify job timed out after 15 minutes"
      );
    } catch (error) {
      const message = getErrorMessage(error);

      /**
       * These errors are permanent store/configuration/access problems.
       * Retrying will not fix them.
       */
      if (isPermanentShopifyError(message)) {
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
    await completeShopifyJobWithResults({
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

function getErrorMessage(error: unknown) {
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }

  return "Unknown Shopify worker error";
}

function getErrorStack(error: unknown) {
  if (error instanceof Error && typeof error.stack === "string") {
    return error.stack;
  }

  return null;
}

function getErrorName(error: unknown) {
  if (error instanceof Error && typeof error.name === "string") {
    return error.name;
  }

  return "UnknownError";
}

function isTimeoutError(message: string) {
  return message.toLowerCase().includes("timed out");
}

function isPermanentShopifyError(message: string) {
  const lowerMessage = message.toLowerCase();

  return (
    lowerMessage.includes("blocks public /products.json") ||
    lowerMessage.includes("does not expose /products.json") ||
    lowerMessage.includes("invalid shopify store url") ||
    lowerMessage.includes("invalid url") ||
    lowerMessage.includes("private ip") ||
    lowerMessage.includes("private network") ||
    lowerMessage.includes("unsupported store format")
  );
}

worker.on("failed", async (job, error) => {
  if (!job) return;

  const attemptsAllowed = job.opts.attempts ?? 1;
  const attemptsMade = job.attemptsMade;

  const message = getErrorMessage(error);
  const errorName = getErrorName(error);
  const errorStack = getErrorStack(error);

  const isUnrecoverable = error instanceof UnrecoverableError;
  const isFinalAttempt = attemptsMade >= attemptsAllowed;
  const isTimeout = isTimeoutError(message);

  console.error({
    event: "shopify_job_failed",
    jobId: job.data.jobId,
    attemptsMade,
    attemptsAllowed,
    isUnrecoverable,
    isFinalAttempt,
    errorName,
    error: message,
    stack: errorStack,
  });

  /**
   * Mark DB as failed when:
   * 1. Error is unrecoverable, so BullMQ will not retry
   * OR
   * 2. This is the final retry attempt
   */
  if (isUnrecoverable || isFinalAttempt) {
    await failJob({
      jobId: job.data.jobId,
      message,
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
    errorName: getErrorName(error),
    error: getErrorMessage(error),
    stack: getErrorStack(error),
  });
});

console.log("Shopify worker started and listening for jobs...");