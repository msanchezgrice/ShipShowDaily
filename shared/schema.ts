import { sql, relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  date,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  credits: integer("credits").default(0).notNull(),
  totalCreditsEarned: integer("total_credits_earned").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const videos = pgTable("videos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  productUrl: varchar("product_url", { length: 500 }).notNull(),
  videoPath: varchar("video_path", { length: 500 }).notNull(),
  thumbnailPath: varchar("thumbnail_path", { length: 500 }),
  creatorId: varchar("creator_id").notNull().references(() => users.id),
  totalViews: integer("total_views").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const videoViews = pgTable("video_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  videoId: varchar("video_id").notNull().references(() => videos.id),
  viewerId: varchar("viewer_id").notNull().references(() => users.id),
  watchedAt: timestamp("watched_at").defaultNow(),
  watchDuration: integer("watch_duration").notNull(), // in seconds
  completedMinimum: boolean("completed_minimum").default(false).notNull(), // watched at least 30 seconds
  creditAwarded: boolean("credit_awarded").default(false).notNull(),
});

export const dailyStats = pgTable("daily_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: date("date").notNull(),
  videoId: varchar("video_id").notNull().references(() => videos.id),
  views: integer("views").default(0).notNull(),
  creditsSpent: integer("credits_spent").default(0).notNull(), // credits spent to boost this video
}, (table) => ({
  // Unique constraint for video-date combination to support ON CONFLICT
  uniqueVideoDate: uniqueIndex("unique_video_date").on(table.videoId, table.date),
}));

export const creditTransactions = pgTable("credit_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type", { length: 50 }).notNull(), // 'earned', 'spent'
  amount: integer("amount").notNull(),
  reason: varchar("reason", { length: 255 }).notNull(), // 'video_watch', 'video_boost'
  videoId: varchar("video_id").references(() => videos.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const videoViewingSessions = pgTable("video_viewing_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  videoId: varchar("video_id").notNull().references(() => videos.id),
  startedAt: timestamp("started_at").defaultNow(),
  isCompleted: boolean("is_completed").default(false).notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  // Unique constraint to prevent multiple active sessions per user-video pair
  uniqueActiveSession: uniqueIndex("unique_active_session").on(table.userId, table.videoId, table.isCompleted),
}));

export const tags = pgTable("tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 50 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const videoTags = pgTable("video_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  videoId: varchar("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
  tagId: varchar("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Unique constraint to prevent duplicate video-tag pairs
  uniqueVideoTag: uniqueIndex("unique_video_tag").on(table.videoId, table.tagId),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  videos: many(videos),
  videoViews: many(videoViews),
  creditTransactions: many(creditTransactions),
  videoViewingSessions: many(videoViewingSessions),
}));

export const videosRelations = relations(videos, ({ one, many }) => ({
  creator: one(users, {
    fields: [videos.creatorId],
    references: [users.id],
  }),
  views: many(videoViews),
  dailyStats: many(dailyStats),
  creditTransactions: many(creditTransactions),
  viewingSessions: many(videoViewingSessions),
  videoTags: many(videoTags),
}));

export const videoViewsRelations = relations(videoViews, ({ one }) => ({
  video: one(videos, {
    fields: [videoViews.videoId],
    references: [videos.id],
  }),
  viewer: one(users, {
    fields: [videoViews.viewerId],
    references: [users.id],
  }),
}));

export const dailyStatsRelations = relations(dailyStats, ({ one }) => ({
  video: one(videos, {
    fields: [dailyStats.videoId],
    references: [videos.id],
  }),
}));

export const creditTransactionsRelations = relations(creditTransactions, ({ one }) => ({
  user: one(users, {
    fields: [creditTransactions.userId],
    references: [users.id],
  }),
  video: one(videos, {
    fields: [creditTransactions.videoId],
    references: [videos.id],
  }),
}));

export const videoViewingSessionsRelations = relations(videoViewingSessions, ({ one }) => ({
  user: one(users, {
    fields: [videoViewingSessions.userId],
    references: [users.id],
  }),
  video: one(videos, {
    fields: [videoViewingSessions.videoId],
    references: [videos.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  videoTags: many(videoTags),
}));

export const videoTagsRelations = relations(videoTags, ({ one }) => ({
  video: one(videos, {
    fields: [videoTags.videoId],
    references: [videos.id],
  }),
  tag: one(tags, {
    fields: [videoTags.tagId],
    references: [tags.id],
  }),
}));

// Insert schemas
export const insertVideoSchema = createInsertSchema(videos).omit({
  id: true,
  totalViews: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVideoViewSchema = createInsertSchema(videoViews).omit({
  id: true,
  watchedAt: true,
});

export const insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertVideoViewingSessionSchema = createInsertSchema(videoViewingSessions).omit({
  id: true,
  startedAt: true,
  completedAt: true,
});

export const insertTagSchema = createInsertSchema(tags).omit({
  id: true,
  createdAt: true,
});

export const insertVideoTagSchema = createInsertSchema(videoTags).omit({
  id: true,
  createdAt: true,
});

// Updated video schema to include tags as string array for form submission
export const insertVideoWithTagsSchema = insertVideoSchema.extend({
  tags: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type InsertVideoWithTags = z.infer<typeof insertVideoWithTagsSchema>;
export type Video = typeof videos.$inferSelect;
export type InsertVideoView = z.infer<typeof insertVideoViewSchema>;
export type VideoView = typeof videoViews.$inferSelect;
export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type DailyStat = typeof dailyStats.$inferSelect;
export type InsertVideoViewingSession = z.infer<typeof insertVideoViewingSessionSchema>;
export type VideoViewingSession = typeof videoViewingSessions.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type InsertTag = z.infer<typeof insertTagSchema>;
export type VideoTag = typeof videoTags.$inferSelect;
export type InsertVideoTag = z.infer<typeof insertVideoTagSchema>;
