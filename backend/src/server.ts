import Fastify from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: true,
  credentials: true,
});

app.get("/health", async () => {
  return {
    status: "ok",
    service: "datapulse-backend",
  };
});

const port = Number(process.env.PORT || 4000);

try {
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`Backend running on http://localhost:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}