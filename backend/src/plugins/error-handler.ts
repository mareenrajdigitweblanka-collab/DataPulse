import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";

import { AppError } from "../errors/app-error.js";

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "validation_error",
          message: "Invalid request data",
          details: z.flattenError(error),
        },
      });
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? null,
        },
      });
    }

    app.log.error(error);

    return reply.status(500).send({
      success: false,
      error: {
        code: "internal_server_error",
        message: "Something went wrong",
        details: null,
      },
    });
  });
}