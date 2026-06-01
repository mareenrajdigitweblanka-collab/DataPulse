import { Queue } from "bullmq";

import { redisConnection } from "./redis.js";
import type { EbayFilters } from "../jobs/jobs.schema.js";

export type EbayJobData = {
  jobId: string;
  userId: string;
  channel: "ebay";
  query: string;
  filters: EbayFilters;
};

export const EBAY_QUEUE_NAME = "queue-ebay";

export const ebayQueue = new Queue<EbayJobData>(EBAY_QUEUE_NAME, {
  connection: redisConnection,
});

export async function getEbayQueueDepth() {
  const counts = await ebayQueue.getJobCounts("waiting", "delayed", "active");

  return {
    waiting: counts.waiting ?? 0,
    delayed: counts.delayed ?? 0,
    active: counts.active ?? 0,
    total: (counts.waiting ?? 0) + (counts.delayed ?? 0) + (counts.active ?? 0),
  };
}

export async function getNextEbayQueuePosition() {
  const counts = await ebayQueue.getJobCounts("waiting", "delayed");

  return (counts.waiting ?? 0) + (counts.delayed ?? 0) + 1;
}

export async function addEbayJob(data: EbayJobData) {
  return ebayQueue.add("ebay.fetch", data, {
    jobId: data.jobId,

    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
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