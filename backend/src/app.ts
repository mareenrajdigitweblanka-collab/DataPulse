import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./env.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { healthRoutes } from "./routes/health.routes.js";
import { authRoutes } from "./auth/auth.routes.js";
import { jobsRoutes } from "./jobs/jobs.routes.js";
import { seedDevUser } from "./auth/dev-user.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Api-Key"],
  });

  registerErrorHandler(app);

  await app.register(healthRoutes);

  await app.register(authRoutes, {
    prefix: "/api/v1/auth",
  });

  await app.register(jobsRoutes, {
    prefix: "/api/v1/jobs",
  });

  app.addHook("onReady", async () => {
    if (env.DEV_API_KEY) {
      await seedDevUser();
    }
  });

  return app;
}