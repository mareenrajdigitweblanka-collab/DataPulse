import { Redis } from "ioredis";
import { env } from "../env.js";

export type JobUpdateEvent = {
  jobId: string;
  userId: string;
  status: string;
  progressPercent: number;
  scrapedCount?: number;
  resultsCount?: number;
};

const CHANNEL = "job:update";

let publisher: Redis | null = null;

function getPublisher(): Redis {
  if (!publisher) {
    publisher = new Redis(env.REDIS_URL);
  }
  return publisher;
}

export function emitJobEvent(event: JobUpdateEvent): void {
  getPublisher().publish(CHANNEL, JSON.stringify(event)).catch((err) => {
    console.error({ event: "job_event_publish_error", error: String(err) });
  });
}
