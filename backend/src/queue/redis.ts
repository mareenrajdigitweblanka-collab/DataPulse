import { Redis } from "ioredis";

import { env } from "../env.js";

/**
 * Shared Redis connection for BullMQ.
 *
 * Redis is used for temporary queue state:
 * - waiting jobs
 * - active jobs
 * - failed jobs
 * - retry metadata
 * - progress metadata
 *
 * PostgreSQL remains the permanent database for users, jobs, and results.
 */
export const redisConnection = new Redis(env.REDIS_URL, {
    /**
     * BullMQ requires this option when using ioredis.
     */
    maxRetriesPerRequest: null,
});