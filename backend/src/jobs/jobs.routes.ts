import type { FastifyInstance, FastifyRequest } from "fastify";

import { requireAuth } from "../auth/auth.middleware.js";
import { AppError } from "../errors/app-error.js";
import {
  createJobSchema,
  getResultsQuerySchema,
  jobIdParamsSchema,
} from "./jobs.schema.js";
import {
  createShopifyJobRecord,
  getResultsForJob,
  getUserJobById,
  getUserJobs,
} from "./jobs.repository.js";
import {
  addShopifyJob,
  getNextShopifyQueuePosition,
  getShopifyQueueDepth,
} from "../queue/shopify.queue.js";
import { redisConnection } from "../queue/redis.js";

function getAuthenticatedUser(request: FastifyRequest) {
  if (!request.user?.id) {
    throw new AppError({
      statusCode: 401,
      code: "unauthorized",
      message: "Authentication required",
    });
  }

  return request.user;
}

/**
 * Basic Redis rate limit:
 * 10 job submissions per user per minute.
 */
async function enforceJobRateLimit(userId: string) {
  const now = new Date();
  const minuteBucket = now.toISOString().slice(0, 16);
  const key = `rate-limit:jobs:${userId}:${minuteBucket}`;

  const count = await redisConnection.incr(key);

  if (count === 1) {
    await redisConnection.expire(key, 60);
  }

  if (count > 10) {
    throw new AppError({
      statusCode: 429,
      code: "rate_limit_exceeded",
      message: "Too many job submissions. Maximum 10 jobs per minute.",
      details: {
        retryAfterSeconds: 60,
      },
    });
  }
}

export async function jobsRoutes(app: FastifyInstance) {
  /**
   * POST /api/v1/jobs
   * Creates a Shopify scrape job and pushes it to BullMQ.
   */
  app.post("/", { preHandler: requireAuth }, async (request, reply) => {
    const user = getAuthenticatedUser(request);
    const body = createJobSchema.parse(request.body);

    await enforceJobRateLimit(user.id);

    /**
     * We only allow Shopify right now.
     */
    if (body.channel !== "shopify") {
      throw new AppError({
        statusCode: 400,
        code: "unsupported_channel",
        message: "Only Shopify channel is active right now.",
      });
    }

    const queueDepth = await getShopifyQueueDepth();

    if (queueDepth.total >= 50) {
      throw new AppError({
        statusCode: 503,
        code: "queue_full",
        message: "Shopify queue is full. Please retry later.",
        details: {
          channel: "shopify",
          retryAfterSeconds: 60,
        },
      });
    }

    const queuePosition = await getNextShopifyQueuePosition();

    /**
     * Create permanent DB record first.
     */
    const dbJob = await createShopifyJobRecord({
      userId: user.id,
      query: body.query,
      filters: body.filters,
      queuePosition,
    });

    /**
     * Push job to Redis queue.
     */
    await addShopifyJob({
      jobId: dbJob.id,
      userId: user.id,
      channel: "shopify",
      query: body.query,
      filters: body.filters,
    });

    return reply.code(202).send({
      success: true,
      data: {
        jobId: dbJob.id,
        status: dbJob.status,
        queuePosition,
      },
    });
  });

  /**
   * GET /api/v1/jobs
   * Lists current user's jobs.
   */
  app.get("/", { preHandler: requireAuth }, async (request, reply) => {
    const user = getAuthenticatedUser(request);

    const query = request.query as {
      page?: string;
      limit?: string;
    };

    const page = Math.max(Number(query.page ?? 1), 1);
    const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 100);

    const userJobs = await getUserJobs({
      userId: user.id,
      page,
      limit,
    });

    return reply.send({
      success: true,
      data: {
        jobs: userJobs,
        page,
        limit,
      },
    });
  });

  /**
   * GET /api/v1/jobs/:id
   * Returns current status for polling from Postman/Apps Script.
   */
  app.get("/:id", { preHandler: requireAuth }, async (request, reply) => {
    const user = getAuthenticatedUser(request);
    const params = jobIdParamsSchema.parse(request.params);

    const job = await getUserJobById({
      jobId: params.id,
      userId: user.id,
    });

    if (!job) {
      throw new AppError({
        statusCode: 404,
        code: "job_not_found",
        message: "Job not found",
      });
    }

    return reply.send({
      success: true,
      data: {
        job,
      },
    });
  });

  /**
   * GET /api/v1/jobs/:id/results
   * Returns filtered Shopify results.
   */
  app.get("/:id/results", { preHandler: requireAuth }, async (request, reply) => {
    const user = getAuthenticatedUser(request);
    const params = jobIdParamsSchema.parse(request.params);
    const query = getResultsQuerySchema.parse(request.query);

    const job = await getUserJobById({
      jobId: params.id,
      userId: user.id,
    });

    if (!job) {
      throw new AppError({
        statusCode: 404,
        code: "job_not_found",
        message: "Job not found",
      });
    }

    if (!["done", "error", "timeout"].includes(job.status)) {
      throw new AppError({
        statusCode: 409,
        code: "job_not_finished",
        message: "Job is not finished yet",
        details: {
          status: job.status,
          progressPercent: job.progressPercent,
        },
      });
    }

    const rows = await getResultsForJob({
      jobId: params.id,
      userId: user.id,
    });

    let sortedRows = [...rows];

    /**
     * JSONB price sort is easier in application code for MVP.
     * Shopify result count is small, so this is acceptable now.
     */
    if (query.sortBy === "price_asc" || query.sortBy === "price_desc") {
      sortedRows.sort((a, b) => {
        const aData = a.data as { price?: number | null };
        const bData = b.data as { price?: number | null };

        const aPrice = aData.price ?? Number.POSITIVE_INFINITY;
        const bPrice = bData.price ?? Number.POSITIVE_INFINITY;

        return query.sortBy === "price_asc"
          ? aPrice - bPrice
          : bPrice - aPrice;
      });
    } else {
      sortedRows.sort((a, b) => a.position - b.position);
    }

    const start = (query.page - 1) * query.limit;
    const paginatedRows = sortedRows.slice(start, start + query.limit);

    return reply.send({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        totalScraped: job.totalScraped,
        totalFiltered: job.totalFiltered,
        page: query.page,
        limit: query.limit,
        total: sortedRows.length,
        results: paginatedRows.map((row) => ({
          id: row.id,
          position: row.position,
          data: row.data,
        })),
      },
    });
  });
}