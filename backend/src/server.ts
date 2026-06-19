import { buildApp } from "./app.js";
import { setupSocketServer } from "./realtime/socket.js";

const app = await buildApp();

setupSocketServer(app.server);

const port = Number(process.env.PORT || 4000);

try {

  await app.listen({ port, host: "0.0.0.0" });
  console.log(`Backend running on http://localhost:${port}`);

} catch (error) {

  app.log.error(error);
  process.exit(1);

}