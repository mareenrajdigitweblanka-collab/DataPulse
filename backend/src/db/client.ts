import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import { env } from "../env.js";
import * as schema from "./schema.js";

/**
 * postgres.js client.
 * Used by Drizzle ORM.
 */
const client = postgres(env.DATABASE_URL);

/**
 * Drizzle database instance.
 * Import this anywhere you need database access.
 */
export const db = drizzle(client, { schema });