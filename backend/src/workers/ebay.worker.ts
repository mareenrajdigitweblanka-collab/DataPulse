import { Worker } from "bullmq";

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

    await updateJobRunning(data.jobId);
    await job.updateProgress(10);

    const rawProducts = await withTimeout(
      fetchEbayProducts({
        query: data.query,
        filters: data.filters,
      }),
      2 * 60 * 1000,
      "eBay job timed out after 2 minutes"
    );

    await updateJobProgress({
      jobId: data.jobId,
      progressPercent: 70,
    });

    await job.updateProgress(70);

    await updateJobFiltering(data.jobId);

    const { filteredProducts, summary } = filterEbayProducts({
      products: rawProducts,
      filters: data.filters,
    });

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
    });

    return {
      totalScraped: summary.totalScraped,
      totalFiltered: summary.totalFiltered,
    };
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

worker.on("failed", async (job, error) => {
  if (!job) return;

  const attemptsAllowed = job.opts.attempts ?? 1;
  const attemptsMade = job.attemptsMade;

  console.error({
    event: "ebay_job_failed",
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
    event: "ebay_worker_completed_event",
    jobId: job.data.jobId,
  });
});

worker.on("error", (error) => {
  console.error({
    event: "ebay_worker_error",
    error: error.message,
  });
});

console.log("eBay worker started and listening for jobs...");