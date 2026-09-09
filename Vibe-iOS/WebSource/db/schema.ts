import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
export const cinemaSessions = sqliteTable('cinema_sessions', {
  id: text('id').primaryKey(),
  hostHash: text('host_hash').notNull(),
  media: text('media').notNull(),
  position: real('position').notNull().default(0),
  paused: integer('paused').notNull().default(1),
  version: integer('version').notNull().default(1),
  updatedAt: integer('updated_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
}, table => [index('cinema_expiry_idx').on(table.expiresAt)]);
