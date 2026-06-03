import type { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return {
      success: true,
      data: {
        status: "ok",
        service: "datapulse-backend",
        message: "Backend is healthy and running smoothly.",
      },
    };
  });

  app.get("/db-test", async () => {
    const allUsers = await db.select().from(users);

    return {
      success: true,
      data: {
        connected: true,
        usersCount: allUsers.length,
        message: "Database connection successful and users retrieved.",
      },
    };
  });
}