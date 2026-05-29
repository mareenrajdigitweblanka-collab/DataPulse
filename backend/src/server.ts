import { buildApp } from "./app.js";

const app = await buildApp();

const port = Number(process.env.PORT || 4000);

try {

  await app.listen({ port, host: "0.0.0.0" });
  console.log(`Backend running on http://localhost:${port}`);
  console.log("DataPulse API ready. Shopify jobs are handled by worker:shopify.");

} catch (error) {

  app.log.error(error);
  process.exit(1);
  
}