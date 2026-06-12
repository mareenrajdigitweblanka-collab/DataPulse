import { Worker } from "bullmq";

import "../env.js";

import { env } from "../env.js";
import { redisConnection } from "../queue/redis.js";
import {
  AMAZON_QUEUE_NAME,
  type AmazonJobData,
} from "../queue/amazon.queue.js";
import {
  AmazonBlockedError,
  scrapeAmazonSearch,
} from "../scrapers/amazon.scraper.js";
import { filterAmazonProducts } from "../filters/amazon.filter.js";
import {
  completeAmazonJobWithResults,
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== "") return error.message;
  if (typeof error === "string" && error.trim() !== "") return error;
  return "Unknown Amazon worker error";
}

const worker = new Worker<AmazonJobData>(
  AMAZON_QUEUE_NAME,
  async (job) => {
    const data = job.data;

    console.log({
      event: "amazon_job_started",
      jobId: data.jobId,
      userId: data.userId,
      query: data.query,
    });

    await updateJobRunning(data.jobId);
    await job.updateProgress(10);

    let rawProducts;

    try {
      rawProducts = await withTimeout(
        scrapeAmazonSearch({
          query: data.query,
        }),
        10 * 60 * 1000,
        "Amazon job timed out after 10 minutes"
      );
    } catch (error) {
      if (error instanceof AmazonBlockedError) {
        console.error({
          event: "amazon_block_detected",
          jobId: data.jobId,
          message: getErrorMessage(error),
        });
      }

      /**
       * Throw again so BullMQ retry can run.
       * Each retry launches a fresh browser session.
       */
      throw error;
    }

    await updateJobProgress({
      jobId: data.jobId,
      progressPercent: 70,
    });

    console.log({
      event: "amazon_raw_products_sample",
      jobId: data.jobId,
      sample: rawProducts.slice(0, 3),
    });

    await updateJobFiltering(data.jobId);

    const { filteredProducts, summary } = filterAmazonProducts({
      products: rawProducts,
      filters: data.filters,
    });

    await completeAmazonJobWithResults({
      jobId: data.jobId,
      userId: data.userId,
      scrapedCount: summary.totalScraped,
      filteredProducts,
    });

    await job.updateProgress(100);

    console.log({
      event: "amazon_job_completed",
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
     * Keep Amazon low.
     * Increase only after stable proxy/browser testing.
     */
    concurrency: env.AMAZON_WORKER_CONCURRENCY,
  }
);

worker.on("failed", async (job, error) => {
  if (!job) return;

  const attemptsAllowed = job.opts.attempts ?? 1;
  const attemptsMade = job.attemptsMade;

  console.error({
    event: "amazon_job_failed",
    jobId: job.data.jobId,
    attemptsMade,
    attemptsAllowed,
    error: getErrorMessage(error),
  });

  if (attemptsMade >= attemptsAllowed) {
    const lower = getErrorMessage(error).toLowerCase();

    const isTimeout = lower.includes("timed out");

    await failJob({
      jobId: job.data.jobId,
      message: getErrorMessage(error),
      status: isTimeout ? "timeout" : "error",
    });
  }
});

worker.on("completed", (job) => {
  console.log({
    event: "amazon_worker_completed_event",
    jobId: job.data.jobId,
  });
});

worker.on("error", (error) => {
  console.error({
    event: "amazon_worker_error",
    error: getErrorMessage(error),
  });
});

console.log("Amazon worker started and listening for jobs...");