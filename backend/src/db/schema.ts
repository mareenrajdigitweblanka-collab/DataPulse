import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  index,
  pgEnum,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const channelEnum = pgEnum("channel_type", ["amazon", "ebay", "google", "shopify"]);
export const statusEnum = pgEnum("job_status", ["queued", "running", "filtering", "done", "error", "timeout"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),

  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * password_reset_tokens table
 * Stores hashed reset tokens.
 * We never store the raw reset token in the database.
 */
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    tokenHash: text("token_hash").notNull().unique(),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("password_reset_tokens_user_id_idx").on(table.userId),
  ]
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    channel: channelEnum("channel").notNull(),
    query: text("query").notNull(),
    filters: jsonb("filters").notNull().default({}),

    status: statusEnum("status").notNull().default("queued"),
    queuePosition: integer("queue_position"),
    progressPercent: integer("progress_percent").notNull().default(0),

    totalScraped: integer("total_scraped"),
    totalFiltered: integer("total_filtered"),
    errorMessage: text("error_message"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("jobs_user_status_created_idx").on(
      table.userId,
      table.status,
      table.createdAt
    ),
    index("jobs_user_id_idx").on(table.userId, table.id),
    index("jobs_channel_status_idx").on(table.channel, table.status),
  ]
);

export const results = pgTable(
  "results",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    channel: channelEnum("channel").notNull(),
    position: integer("position").notNull(),
    data: jsonb("data").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("results_job_position_idx").on(table.jobId, table.position),
    index("results_user_channel_created_idx").on(
      table.userId,
      table.channel,
      table.createdAt
    ),
  ]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;

export type Result = typeof results.$inferSelect;
export type NewResult = typeof results.$inferInsert;