import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Better Auth's own tables, as drizzle-kit generates them. The SQL in
// migrations/0003_auth.sql is the same DDL — this file is what the adapter reads,
// that file is what D1 gets. Keep the two in step: if the shape changes, regenerate
// with drizzle-kit rather than editing either by hand.

const timestamp = (name: string) => integer(name, { mode: "timestamp_ms" });
const now = sql`(cast(unixepoch('subsecond') * 1000 as integer))`;

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").default(now).notNull(),
  updatedAt: timestamp("updated_at").default(now).notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").default(now).notNull(),
    updatedAt: timestamp("updated_at").default(now).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").default(now).notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").default(now).notNull(),
    updatedAt: timestamp("updated_at").default(now).notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);
