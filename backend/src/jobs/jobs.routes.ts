import { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { createJobSchema, type CreateJobInput } from "./jobs.schema.js";
import { amazonQueue, type AmazonJobPayload } from "../queue/amazon.queue.js";
import { db } from "../db/client.js";
import { jobs, results, users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { authenticate } from "../auth/auth.middleware.js";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Register job routes.
 */
export async function jobsRoutes(app: FastifyInstance) {
  // Add authentication hook to all job routes
  app.addHook("preHandler", authenticate);

  /**
   * POST /api/v1/jobs
   * Create a new scraping job.
   */
  app.post(
    "/",
    async (
      request: FastifyRequest<{ Body: CreateJobInput }>,
      reply
    ) => {
      const body = createJobSchema.parse(request.body);
      const userId = (request.user as any).userId;

      // Only support Amazon for now
      if (body.channel !== "amazon") {
        return reply.status(400).send({
          error: "Only Amazon channel is supported at this time",
        });
      }

      // Create job in database
      const [newJob] = await db
        .insert(jobs)
        .values({
          userId,
          channel: body.channel,
          query: body.query,
          filters: body.filters,
          status: "queued",
        })
        .returning();

      // Add job to queue
      const jobPayload: AmazonJobPayload = {
        jobId: newJob.id.toString(),
        userId: userId.toString(),
        query: body.query,
        filters: body.filters,
      };

      await amazonQueue.add(jobPayload, {
        jobId: newJob.id.toString(),
      });

      return reply.status(201).send({
        success: true,
        job: {
          id: newJob.id,
          channel: newJob.channel,
          query: newJob.query,
          filters: newJob.filters,
          status: newJob.status,
          createdAt: newJob.createdAt,
        },
      });
    }
  );

  /**
   * GET /api/v1/jobs
   * List all jobs for the authenticated user.
   */
  app.get("/", async (request: FastifyRequest, reply) => {
    const userId = (request.user as any).userId;

    const userJobs = await db
      .select()
      .from(jobs)
      .where(eq(jobs.userId, userId))
      .orderBy(jobs.createdAt);

    return reply.send({
      success: true,
      jobs: userJobs.map((job) => ({
        id: job.id,
        channel: job.channel,
        query: job.query,
        filters: job.filters,
        status: job.status,
        progressPercent: job.progressPercent,
        totalScraped: job.totalScraped,
        totalFiltered: job.totalFiltered,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
      })),
    });
  });

  /**
   * GET /api/v1/jobs/:id
   * Get a specific job by ID.
   */
  app.get(
    "/:id",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply
    ) => {
      const { id } = paramsSchema.parse(request.params);
      const userId = (request.user as any).userId;

      const job = await db.query.jobs.findFirst({
        where: eq(jobs.id, id),
      });

      if (!job) {
        return reply.status(404).send({ error: "Job not found" });
      }

      if (job.userId !== userId) {
        return reply.status(403).send({ error: "Access denied" });
      }

      return reply.send({
        success: true,
        job: {
          id: job.id,
          channel: job.channel,
          query: job.query,
          filters: job.filters,
          status: job.status,
          progressPercent: job.progressPercent,
          totalScraped: job.totalScraped,
          totalFiltered: job.totalFiltered,
          errorMessage: job.errorMessage,
          createdAt: job.createdAt,
          completedAt: job.completedAt,
        },
      });
    }
  );

  /**
   * GET /api/v1/jobs/:id/results
   * Get results for a specific job.
   */
  app.get(
    "/:id/results",
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply
    ) => {
      const { id } = paramsSchema.parse(request.params);
      const userId = (request.user as any).userId;

      const job = await db.query.jobs.findFirst({
        where: eq(jobs.id, id),
      });

      if (!job) {
        return reply.status(404).send({ error: "Job not found" });
      }

      if (job.userId !== userId) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const jobResults = await db
        .select()
        .from(results)
        .where(eq(results.jobId, id))
        .orderBy(results.position);

      return reply.send({
        success: true,
        results: jobResults.map((r) => ({
          id: r.id,
          position: r.position,
          data: r.data,
          createdAt: r.createdAt,
        })),
      });
    }
  );
}