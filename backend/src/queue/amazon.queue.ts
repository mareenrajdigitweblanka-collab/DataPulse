import { Queue } from "bullmq";
import { redisConnection } from "./redis.js";

export const AMAZON_QUEUE_NAME = "queue-amazon";

export type AmazonJobPayload = {
  jobId: string;
  userId: string;
  query: string;
  filters: {
    minPrice?: number;
    maxPrice?: number;
    inStockOnly?: boolean;
    minRating?: number;
    minReviewCount?: number;
    primeOnly?: boolean;
  };
};

/**
 * Amazon queue.
 *
 * Note:
 * Original requirement said queue:amazon.
 * BullMQ v5 does not allow ":" in queue names.
 * So we use "queue-amazon" as the safe BullMQ queue name.
 */
export const amazonQueue = new Queue<AmazonJobPayload>(AMAZON_QUEUE_NAME, {
  connection: redisConnection,

  defaultJobOptions: {
    attempts: 3,

    backoff: {
      type: "exponential",
      delay: 5000,
    },

    removeOnComplete: false,
    removeOnFail: false,
  },
});