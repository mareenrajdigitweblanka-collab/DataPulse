import Fastify from "fastify";
import cors from "@fastify/cors";

import "./env.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { healthRoutes } from "./routes/health.routes.js";
import { authRoutes } from "./auth/auth.routes.js";
import { jobsRoutes } from "./jobs/jobs.routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  registerErrorHandler(app);

  await app.register(healthRoutes);

  await app.register(authRoutes, {
    prefix: "/api/v1/auth",
  });

  await app.register(jobsRoutes, {
    prefix: "/api/v1/jobs",
  });

  return app;
}