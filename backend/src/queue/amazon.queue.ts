import { Queue } from "bullmq";

import { redisConnection } from "./redis.js";
import type { AmazonFilters } from "../jobs/jobs.schema.js";

export type AmazonJobData = {
  jobId: string;
  userId: string;
  channel: "amazon";
  query: string;
  filters: AmazonFilters;
};

/**
 * Use BullMQ-safe name.
 * Avoid queue:amazon because earlier BullMQ versions rejected colon names.
 */
export const AMAZON_QUEUE_NAME = "queue-amazon";

export const amazonQueue = new Queue<AmazonJobData>(AMAZON_QUEUE_NAME, {
  connection: redisConnection,
});

export async function getAmazonQueueDepth() {
  const counts = await amazonQueue.getJobCounts("waiting", "delayed", "active");

  return {
    waiting: counts.waiting ?? 0,
    delayed: counts.delayed ?? 0,
    active: counts.active ?? 0,
    total: (counts.waiting ?? 0) + (counts.delayed ?? 0) + (counts.active ?? 0),
  };
}

export async function getNextAmazonQueuePosition() {
  const counts = await amazonQueue.getJobCounts("waiting", "delayed");

  return (counts.waiting ?? 0) + (counts.delayed ?? 0) + 1;
}

export async function addAmazonJob(data: AmazonJobData) {
  return amazonQueue.add("amazon.scrape", data, {
    jobId: data.jobId,

    /**
     * Amazon can fail from captcha/block/timeout.
     * Retry with a fresh browser session.
     */
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 10000,
    },

    removeOnComplete: {
      age: 60 * 60,
      count: 1000,
    },

    removeOnFail: {
      age: 24 * 60 * 60,
      count: 1000,
    },
  });
}