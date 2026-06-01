import { UnrecoverableError, Worker } from "bullmq";

import "../env.js";

import { redisConnection } from "../queue/redis.js";
import {
  GOOGLE_QUEUE_NAME,
  type GoogleJobData,
} from "../queue/google.queue.js";
import { fetchGoogleShoppingProducts } from "../scrapers/google-shopping.scraper.js";
import { filterGoogleShoppingProducts } from "../filters/google-shopping.filter.js";
import {
  completeGoogleJobWithResults,
  failJob,
  updateJobFiltering,
  updateJobProgress,
  updateJobRunning,
} from "../jobs/jobs.repository.js";

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

const worker = new Worker<GoogleJobData>(
  GOOGLE_QUEUE_NAME,
  async (job) => {
    const data = job.data;

    console.log({
      event: "google_job_started",
      jobId: data.jobId,
      userId: data.userId,
      query: data.query,
    });

    await updateJobRunning(data.jobId);
    await job.updateProgress(10);

    let rawProducts;

    try {
      rawProducts = await withTimeout(
        fetchGoogleShoppingProducts({
          query: data.query,
          filters: data.filters,
        }),
        10 * 60 * 1000,
        "Google Shopping job timed out after 10 minutes"
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Google Shopping error";

      /**
       * These are configuration/authentication errors.
       * Retrying will not fix them, so fail immediately.
       */
      if (
        message.includes("Invalid API key") ||
        message.includes("Missing SERPAPI_API_KEY")
      ) {
        throw new UnrecoverableError(message);
      }

      /**
       * Network errors, temporary SerpApi failures, and timeout errors can retry.
       */
      throw error;
    }
    await updateJobProgress({
      jobId: data.jobId,
      progressPercent: 70,
    });

    await job.updateProgress(70);

    await updateJobFiltering(data.jobId);

    const { filteredProducts, summary } = filterGoogleShoppingProducts({
      products: rawProducts,
      filters: data.filters,
    });

    await completeGoogleJobWithResults({
      jobId: data.jobId,
      userId: data.userId,
      scrapedCount: summary.totalScraped,
      filteredProducts,
    });

    await job.updateProgress(100);

    console.log({
      event: "google_job_completed",
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
     * Google Shopping uses paid API credits.
     * Keep concurrency lower than Shopify.
     */
    concurrency: 3,
  }
);

worker.on("failed", async (job, error) => {
  if (!job) return;

  const attemptsAllowed = job.opts.attempts ?? 1;
  const attemptsMade = job.attemptsMade;

  console.error({
    event: "google_job_failed",
    jobId: job.data.jobId,
    attemptsMade,
    attemptsAllowed,
    error: error.message,
  });

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
    event: "google_worker_completed_event",
    jobId: job.data.jobId,
  });
});

worker.on("error", (error) => {
  console.error({
    event: "google_worker_error",
    error: error.message,
  });
});

console.log("Google Shopping worker started and listening for jobs...");