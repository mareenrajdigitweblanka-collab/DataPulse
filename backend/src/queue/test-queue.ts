import { randomUUID } from "node:crypto";

import { amazonQueue } from "./amazon.queue.js";

const job = await amazonQueue.add("amazon.fake.scrape", {
  jobId: randomUUID(),
  userId: randomUUID(),
  query: "wireless mouse",
  filters: {
    minPrice: 10,
    maxPrice: 50,
    inStockOnly: true,
    minRating: 4,
    minReviewCount: 100,
    primeOnly: false,
  },
});

console.log("Added job to Amazon queue:", job.id);

await amazonQueue.close();

process.exit(0);