import { Queue } from "bullmq";

import { redisConnection } from "./redis.js";
import type { ShopifyFilters } from "../jobs/jobs.schema.js";

export type ShopifyJobData = {
  jobId: string;
  userId: string;
  channel: "shopify";
  query: string;
  filters: ShopifyFilters;
};

export const SHOPIFY_QUEUE_NAME = "queue-shopify";

export const shopifyQueue = new Queue<ShopifyJobData>(SHOPIFY_QUEUE_NAME, {
  connection: redisConnection,
});

/**
 * Queue depth guard.
 * Prevents unlimited queue growth if many spreadsheet users submit jobs.
 */
export async function getShopifyQueueDepth() {
  const counts = await shopifyQueue.getJobCounts(
    "waiting",
    "delayed",
    "active"
  );

  return {
    waiting: counts.waiting ?? 0,
    delayed: counts.delayed ?? 0,
    active: counts.active ?? 0,
    total: (counts.waiting ?? 0) + (counts.delayed ?? 0) + (counts.active ?? 0),
  };
}

/**
 * Queue position is approximate:
 * current waiting + delayed jobs + 1.
 */
export async function getNextShopifyQueuePosition() {
  const counts = await shopifyQueue.getJobCounts("waiting", "delayed");

  return (counts.waiting ?? 0) + (counts.delayed ?? 0) + 1;
}

export async function addShopifyJob(data: ShopifyJobData) {
  return shopifyQueue.add("shopify.fetch", data, {
    jobId: data.jobId,

    /**
     * Retry network/temporary failures.
     */
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },

    /**
     * Keep Redis clean.
     */
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