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
  createEbayJobRecord,
  createGoogleJobRecord,
  createAmazonJobRecord,
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

import {
  addEbayJob,
  getEbayQueueDepth,
  getNextEbayQueuePosition,
} from "../queue/ebay.queue.js";

import {
  addGoogleJob,
  getGoogleQueueDepth,
  getNextGoogleQueuePosition,
} from "../queue/google.queue.js";

import {
  addAmazonJob,
  getAmazonQueueDepth,
  getNextAmazonQueuePosition,
} from "../queue/amazon.queue.js";

const MAX_QUEUE_DEPTH = 1000;

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

    if (body.channel === "shopify") {
      const queueDepth = await getShopifyQueueDepth();

      if (queueDepth.total >= MAX_QUEUE_DEPTH) {
        throw new AppError({
          statusCode: 503,
          code: "queue_full",
          message: "Shopify queue is temporarily full. Please retry later.",
          details: {
            channel: "shopify",
            retryAfterSeconds: 60,
          },
        });
      }

      const dbJob = await createShopifyJobRecord({
        userId: user.id,
        query: body.query,
        filters: body.filters,
      });

      const queuePosition = await getNextShopifyQueuePosition();

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
    }

    if (body.channel === "ebay") {
      const queueDepth = await getEbayQueueDepth();

      if (queueDepth.total >= MAX_QUEUE_DEPTH) {
        throw new AppError({
          statusCode: 503,
          code: "queue_full",
          message: "eBay queue is temporarily full. Please retry later.",
          details: {
            channel: "ebay",
            retryAfterSeconds: 60,
          },
        });
      }

      const dbJob = await createEbayJobRecord({
        userId: user.id,
        query: body.query,
        filters: body.filters,
      });

      const queuePosition = await getNextEbayQueuePosition();

      await addEbayJob({
        jobId: dbJob.id,
        userId: user.id,
        channel: "ebay",
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
    }

    if (body.channel === "google") {
      const queueDepth = await getGoogleQueueDepth();

      if (queueDepth.total >= MAX_QUEUE_DEPTH) {
        throw new AppError({
          statusCode: 503,
          code: "queue_full",
          message: "Google Shopping queue is temporarily full. Please retry later.",
          details: {
            channel: "google",
            retryAfterSeconds: 60,
          },
        });
      }

      const dbJob = await createGoogleJobRecord({
        userId: user.id,
        query: body.query,
        filters: body.filters,
      });

      const queuePosition = await getNextGoogleQueuePosition();

      await addGoogleJob({
        jobId: dbJob.id,
        userId: user.id,
        channel: "google",
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
    }

    if (body.channel === "amazon") {
      const queueDepth = await getAmazonQueueDepth();

      if (queueDepth.total >= MAX_QUEUE_DEPTH) {
        throw new AppError({
          statusCode: 503,
          code: "queue_full",
          message: "Amazon queue is temporarily full. Please retry later.",
          details: {
            channel: "amazon",
            retryAfterSeconds: 60,
          },
        });
      }

      const dbJob = await createAmazonJobRecord({
        userId: user.id,
        query: body.query,
        filters: body.filters,
      });

      const queuePosition = await getNextAmazonQueuePosition();

      await addAmazonJob({
        jobId: dbJob.id,
        userId: user.id,
        channel: "amazon",
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
    }

    throw new AppError({
      statusCode: 400,
      code: "unsupported_channel",
      message: "Unsupported channel",
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

    // For pagination safety.
    const page = Math.max(Number(query.page ?? 1), 1);  // Default to page 1, minimum 1
    const limit = Math.min(Math.max(Number(query.limit ?? 20), 1), 100);  // Default to 20, minimum 1, maximum 100

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
   * Current user job by job_id
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
 * Returns paginated results for a finished scraping job.
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
     */
    if (query.sortBy === "price_asc" || query.sortBy === "price_desc") {
      const getPrice = (row: typeof rows[number]) => {
        const data = row.data as { price?: number | null };
        return typeof data.price === "number" ? data.price : null;
      };

      sortedRows.sort((a, b) => {
        const aPrice = getPrice(a);
        const bPrice = getPrice(b);

        if (aPrice === null && bPrice === null) return 0;
        if (aPrice === null) return 1;
        if (bPrice === null) return -1;

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