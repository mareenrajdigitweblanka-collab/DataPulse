import Fastify from "fastify";
import cors from "@fastify/cors";

import "./env.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { healthRoutes } from "./routes/health.routes.js";
import { authRoutes } from "./auth/auth.routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  registerErrorHandler(app);

  await app.register(healthRoutes);
  await app.register(authRoutes, {
    prefix: "/api/v1/auth",
  });

  return app;
}