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
  getResultsPageForJob,
  getUserJobById,
  getUserJobsPage,
  deleteUserJob,
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
   * Creates a new scraping job for the authenticated user.
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
 * Lists current user's jobs with pagination.
 */
  app.get("/", { preHandler: requireAuth }, async (request, reply) => {
    const user = getAuthenticatedUser(request);

    const query = request.query as {
      page?: string;
      limit?: string;
    };

    const parsedPage = Number(query.page ?? 1);
    const parsedLimit = Number(query.limit ?? 5);

    const page = Number.isFinite(parsedPage)
      ? Math.max(parsedPage, 1)
      : 1;

    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 100)
      : 10;

    const jobsPage = await getUserJobsPage({
      userId: user.id,
      page,
      limit,
    });

    return reply.send({
      success: true,
      data: jobsPage,
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
 * Returns paginated and sorted results for a finished scraping job.
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

    const RATING_SORT_KEYS = ["rating_desc", "reviews_desc"] as const;
    const CHANNELS_WITH_RATING = ["amazon", "google"] as const;

    if (
      (RATING_SORT_KEYS as readonly string[]).includes(query.sortBy) &&
      !(CHANNELS_WITH_RATING as readonly string[]).includes(job.channel)
    ) {
      throw new AppError({
        statusCode: 400,
        code: "unsupported_sort",
        message: `Sort '${query.sortBy}' is not supported for channel '${job.channel}'`,
        details: {
          channel: job.channel,
          sortBy: query.sortBy,
          supportedSortBy: ["position", "price_asc", "price_desc"],
        },
      });
    }

    const resultsPage = await getResultsPageForJob({
      jobId: params.id,
      userId: user.id,
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
    });

    return reply.send({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        totalScraped: job.totalScraped,
        totalFiltered: job.totalFiltered,

        page: resultsPage.page,
        limit: resultsPage.limit,
        total: resultsPage.total,
        totalPages: resultsPage.totalPages,
        hasPreviousPage: resultsPage.hasPreviousPage,
        hasNextPage: resultsPage.hasNextPage,

        results: resultsPage.results.map((row) => ({
          id: row.id,
          position: row.position,
          data: row.data,
        })),
      },
    });
  });

  /**
 * DELETE /api/v1/jobs/:id
 * Deletes a finished user's job and its stored results.
 */
  app.delete("/:id", { preHandler: requireAuth }, async (request, reply) => {
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

    if (!isDeletableJobStatus(job.status)) {
      throw new AppError({
        statusCode: 409,
        code: "job_not_deletable",
        message: "Only finished jobs can be deleted",
        details: {
          currentStatus: job.status,
          allowedStatuses: ["done", "error", "timeout"],
        },
      });
    }

    const deletedJob = await deleteUserJob({
      jobId: job.id,
      userId: user.id,
    });

    return reply.send({
      success: true,
      data: {
        message: "Job deleted successfully",
        jobId: deletedJob?.id ?? job.id,
      },
    });
  });

  function isDeletableJobStatus(status: string) {
    return status === "done" || status === "error" || status === "timeout";
  }
}