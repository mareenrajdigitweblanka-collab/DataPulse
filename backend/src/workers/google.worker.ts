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

const GOOGLE_WORKER_TIMEOUT_MS = 15 * 60 * 1000;

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

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }

  if (typeof error === "string" && error.trim() !== "") {
    return error;
  }

  return "Unknown Google Shopping worker error";
}

function getErrorName(error: unknown) {
  if (error instanceof Error && error.name.trim() !== "") {
    return error.name;
  }

  return "UnknownError";
}

function getErrorStack(error: unknown) {
  if (error instanceof Error) {
    return error.stack;
  }

  return undefined;
}

function isTimeoutError(message: string) {
  return message.toLowerCase().includes("timed out");
}

function isPermanentGoogleShoppingError(message: string) {
  const lowerMessage = message.toLowerCase();

  return (
    lowerMessage.includes("missing serpapi_api_key") ||
    lowerMessage.includes("invalid api key") ||
    lowerMessage.includes("invalid api_key") ||
    lowerMessage.includes("api key is missing") ||
    lowerMessage.includes("unauthorized") ||
    lowerMessage.includes("forbidden") ||
    lowerMessage.includes("invalid parameter") ||
    lowerMessage.includes("invalid engine") ||
    lowerMessage.includes("account has run out") ||
    lowerMessage.includes("no credits") ||
    lowerMessage.includes("quota exceeded") ||
    lowerMessage.includes("billing") ||
    lowerMessage.includes("account disabled")
  );
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
    await updateJobProgress({
      jobId: data.jobId,
      progressPercent: 10,
    });
    await job.updateProgress(10);

    let rawProducts: Awaited<ReturnType<typeof fetchGoogleShoppingProducts>>;

    try {
      rawProducts = await withTimeout(
        fetchGoogleShoppingProducts({
          query: data.query,
          filters: data.filters,
        }),
        GOOGLE_WORKER_TIMEOUT_MS,
        "Google Shopping job timed out after 15 minutes"
      );
    } catch (error) {
      const message = getErrorMessage(error);

      /**
       * Configuration, authentication, quota, billing, and invalid parameter
       * errors will not be fixed by retrying the job.
       */
      if (isPermanentGoogleShoppingError(message)) {
        throw new UnrecoverableError(message);
      }

      /**
       * Network errors, temporary API failures, and timeout errors can retry.
       */
      throw error;
    }

    await updateJobProgress({
      jobId: data.jobId,
      progressPercent: 70,
    });
    await job.updateProgress(70);

    await updateJobFiltering(data.jobId);

    await updateJobProgress({
      jobId: data.jobId,
      progressPercent: 85,
    });
    await job.updateProgress(85);

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
     *
     * If credits/cost are sensitive, reduce this to 1 or 2.
     */
    concurrency: 3,
  }
);

worker.on("failed", async (job, error) => {
  if (!job) return;

  const attemptsAllowed = job.opts.attempts ?? 1;
  const attemptsMade = job.attemptsMade;
  const message = getErrorMessage(error);
  const errorName = getErrorName(error);
  const stack = getErrorStack(error);

  const isUnrecoverable =
    error instanceof UnrecoverableError || errorName === "UnrecoverableError";

  const isFinalAttempt = attemptsMade >= attemptsAllowed;

  console.error({
    event: "google_job_failed",
    jobId: job.data.jobId,
    attemptsMade,
    attemptsAllowed,
    isUnrecoverable,
    errorName,
    error: message,
    stack,
  });

  /**
   * Important:
   * UnrecoverableError should update DB immediately.
   * Final retry failure should also update DB.
   */
  if (isUnrecoverable || isFinalAttempt) {
    await failJob({
      jobId: job.data.jobId,
      message,
      status: isTimeoutError(message) ? "timeout" : "error",
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
    errorName: getErrorName(error),
    error: getErrorMessage(error),
    stack: getErrorStack(error),
  });
});

console.log("Google Shopping worker started and listening for jobs...");