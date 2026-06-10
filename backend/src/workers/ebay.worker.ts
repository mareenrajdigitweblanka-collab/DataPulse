import { UnrecoverableError, Worker } from "bullmq";

import "../env.js";

import { redisConnection } from "../queue/redis.js";
import { EBAY_QUEUE_NAME, type EbayJobData } from "../queue/ebay.queue.js";
import { fetchEbayProducts } from "../scrapers/ebay.scraper.js";
import { filterEbayProducts } from "../filters/ebay.filter.js";
import {
  completeEbayJobWithResults,
  failJob,
  updateJobFiltering,
  updateJobProgress,
  updateJobRunning,
} from "../jobs/jobs.repository.js";

/**
 * Timeout wrapper.
 *
 * BullMQ itself can retry failed jobs, but this protects the worker from
 * waiting forever if eBay API, network, or token request hangs.
 *
 * Important:
 * Promise.race does not truly cancel the original fetch.
 * It only lets this worker flow fail after timeout.
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

const worker = new Worker<EbayJobData>(
  EBAY_QUEUE_NAME,
  async (job) => {
    const data = job.data;

    console.log({
      event: "ebay_job_started",
      jobId: data.jobId,
      userId: data.userId,
      query: data.query,
    });

    /**
     * Step 1:
     * Mark the PostgreSQL job as running.
     */
    await updateJobRunning(data.jobId);
    await job.updateProgress(10);

    let rawProducts;

    /**
     * Step 2:
     * Fetch products from eBay Browse API.
     *
     * Some errors are permanent:
     * - missing credentials
     * - invalid OAuth client
     * - invalid scope
     * - invalid marketplace/config
     *
     * Retrying permanent errors wastes attempts, so we throw
     * UnrecoverableError for those cases.
     *
     * Temporary errors:
     * - timeout
     * - HTTP 429
     * - HTTP 500/502/503/504
     * - fetch/network failure
     *
     * Those should still be retried by BullMQ.
     */
    try {
      rawProducts = await withTimeout(
        fetchEbayProducts({
          query: data.query,
          filters: data.filters,
        }),
        15 * 60 * 1000,
        "eBay job timed out after 15 minutes"
      );
    } catch (error) {
      const message = getErrorMessage(error);

      if (isPermanentEbayError(message)) {
        throw new UnrecoverableError(message);
      }

      throw error;
    }

    /**
     * Step 3:
     * Scraping/API fetch completed. Update progress before filtering.
     */
    await updateJobProgress({
      jobId: data.jobId,
      progressPercent: 70,
    });

    await job.updateProgress(70);

    /**
     * Step 4:
     * Mark job as filtering.
     */
    await updateJobFiltering(data.jobId);

    /**
     * Step 5:
     * Apply server-side business filters.
     *
     * eBay API-level filtering is intentionally limited in scraper.
     * Most filters are kept here for predictable MVP behavior.
     */
    const { filteredProducts, summary } = filterEbayProducts({
      products: rawProducts,
      filters: data.filters,
    });

    /**
     * Step 6:
     * Save filtered results and mark job done transactionally.
     */
    await completeEbayJobWithResults({
      jobId: data.jobId,
      userId: data.userId,
      scrapedCount: summary.totalScraped,
      filteredProducts,
    });

    await job.updateProgress(100);

    console.log({
      event: "ebay_job_completed",
      jobId: data.jobId,
      totalScraped: summary.totalScraped,
      totalFiltered: summary.totalFiltered,
      filtersApplied: summary.filtersApplied,
    });

    return {
      totalScraped: summary.totalScraped,
      totalFiltered: summary.totalFiltered,
    };
  },
  {
    connection: redisConnection,

    /**
     * eBay uses official API calls.
     *
     * Concurrency 5 is okay for MVP, but if eBay returns many 429/rate-limit
     * errors later, reduce this or add stronger rate limiting.
     */
    concurrency: 5,
  }
);

/**
 * Safe error message extraction.
 *
 * In TypeScript, caught errors are unknown.
 * This helper prevents unsafe direct error.message access.
 */
function getErrorMessage(error: unknown) {
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }

  return "Unknown eBay worker error";
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

/**
 * Permanent eBay errors.
 *
 * These are usually caused by wrong/missing configuration.
 * Retrying will not fix them.
 */
function isPermanentEbayError(message: string) {
  const lowerMessage = message.toLowerCase();

  return (
    lowerMessage.includes("missing ebay credentials") ||
    lowerMessage.includes("set ebay_client_id") ||
    lowerMessage.includes("set ebay_client_secret") ||
    lowerMessage.includes("invalid_client") ||
    lowerMessage.includes("invalid client") ||
    lowerMessage.includes("unauthorized_client") ||
    lowerMessage.includes("invalid_scope") ||
    lowerMessage.includes("invalid scope") ||
    lowerMessage.includes("invalid marketplace") ||
    lowerMessage.includes("unsupported marketplace") ||
    lowerMessage.includes("invalid endpoint") ||
    lowerMessage.includes("bad request caused by invalid ebay filter")
  );
}

/**
 * BullMQ failed event.
 *
 * This event runs after every failed attempt.
 * We only mark PostgreSQL job as failed when:
 *
 * 1. Error is unrecoverable
 * OR
 * 2. BullMQ has reached the final attempt
 */
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
    event: "ebay_job_failed",
    jobId: job.data.jobId,
    attemptsMade,
    attemptsAllowed,
    isUnrecoverable,
    isFinalAttempt,
    errorName,
    error: message,
    stack: errorStack,
  });

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
    event: "ebay_worker_completed_event",
    jobId: job.data.jobId,
  });
});

worker.on("error", (error) => {
  console.error({
    event: "ebay_worker_error",
    errorName: getErrorName(error),
    error: getErrorMessage(error),
    stack: getErrorStack(error),
  });
});

console.log("eBay worker started and listening for jobs...");