import type { IncomingMessage, Server as HttpServer, ServerResponse } from "node:http";
import { Server } from "socket.io";
import { Redis } from "ioredis";
import jwt from "jsonwebtoken";
import { env } from "../env.js";
import type { JobUpdateEvent } from "./job-events.js";

const CHANNEL = "job:update";

export function setupSocketServer(
  httpServer: HttpServer<typeof IncomingMessage, typeof ServerResponse>
): void {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGINS,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("Unauthorized"));

    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);
  });

  const subscriber = new Redis(env.REDIS_URL);

  subscriber.subscribe(CHANNEL, (err) => {
    if (err) {
      console.error({ event: "socket_redis_subscribe_error", error: String(err) });
    }
  });

  subscriber.on("message", (_channel, message) => {
    try {
      const event = JSON.parse(message) as JobUpdateEvent;
      io.to(`user:${event.userId}`).emit("job:update", event);
    } catch {
      // malformed message — ignore
    }
  });
}
