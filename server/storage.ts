import {
  users,
  videos,
  videoViews,
  dailyStats,
  creditTransactions,
  videoViewingSessions,
  tags,
  videoTags,
  videoFavorites,
  demoLinkClicks,
  type User,
  type UpsertUser,
  type Video,
  type InsertVideo,
  type InsertVideoWithTags,
  type VideoView,
  type InsertVideoView,
  type DailyStat,
  type CreditTransaction,
  type InsertCreditTransaction,
  type VideoViewingSession,
  type InsertVideoViewingSession,
  type Tag,
  type InsertTag,
  type VideoTag,
  type InsertVideoTag,
  type VideoFavorite,
  type InsertVideoFavorite,
  type DemoLinkClick,
  type InsertDemoLinkClick,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, gte, lt, or } from "drizzle-orm";

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserCredits(userId: string, amount: number): Promise<void>;
  updateUserProfile(userId: string, profile: { firstName: string; lastName: string; email: string }): Promise<void>;
  updateUserPassword(userId: string, currentPassword: string, newPassword: string): Promise<void>;
  
  // Video operations
  createVideo(video: InsertVideo): Promise<Video>;
  createVideoWithTags(video: InsertVideoWithTags): Promise<Video>;
  getVideo(id: string): Promise<Video | undefined>;
  getVideoWithCreator(id: string): Promise<(Video & { creator: User }) | undefined>;
  getVideoWithCreatorAndTags(id: string): Promise<(Video & { creator: User; tags: Tag[] }) | undefined>;
  getUserVideos(userId: string): Promise<(Video & { todayViews: number })[]>;
  getUserVideosWithTags(userId: string): Promise<(Video & { todayViews: number; tags: Tag[] })[]>;
  getTopVideosToday(limit?: number, tagFilter?: string): Promise<(Video & { creator: User; todayViews: number })[]>;
  getTopVideosTodayWithTags(limit?: number, tagFilter?: string): Promise<(Video & { creator: User; todayViews: number; tags: Tag[] })[]>;
  incrementVideoViews(videoId: string): Promise<void>;
  
  // Video viewing operations
  recordVideoView(view: InsertVideoView): Promise<VideoView>;
  hasUserViewedVideo(userId: string, videoId: string): Promise<boolean>;
  
  // Daily stats operations
  getTodayStats(): Promise<{
    totalViews: number;
    demosSubmitted: number;
    creditsEarned: number;
    activeUsers: number;
  }>;
  getVideoStatsToday(videoId: string): Promise<DailyStat | undefined>;
  updateDailyStats(videoId: string, views: number, creditsSpent?: number): Promise<void>;
  
  // Credit operations
  recordCreditTransaction(transaction: InsertCreditTransaction): Promise<CreditTransaction>;
  getUserCreditTransactions(userId: string, limit?: number): Promise<CreditTransaction[]>;
  
  // Leaderboard operations
  getTodayLeaderboard(limit?: number): Promise<Array<{
    position: number;
    video: Video;
    creator: User;
    views: number;
  }>>;
  getEnhancedLeaderboard(limit?: number, sortBy?: 'views' | 'favorites' | 'demo_clicks', tagFilter?: string): Promise<Array<{
    position: number;
    video: Video & { tags: Tag[] };
    creator: User;
    views: number;
    favorites: number;
    demoClicks: number;
  }>>;
  
  // Video viewing session operations (secure)
  startVideoViewing(userId: string, videoId: string): Promise<VideoViewingSession>;
  completeVideoViewing(sessionId: string): Promise<{ session: VideoViewingSession; creditAwarded: boolean }>;
  getActiveVideoViewingSession(userId: string, videoId: string): Promise<VideoViewingSession | undefined>;
  hasUserViewedVideoToday(userId: string, videoId: string): Promise<boolean>;
  
  // Tag operations
  getAllTags(): Promise<Tag[]>;
  getOrCreateTag(name: string): Promise<Tag>;
  getVideoTags(videoId: string): Promise<Tag[]>;
  addTagsToVideo(videoId: string, tagIds: string[]): Promise<void>;

  // Favorites operations
  favoriteVideo(favorite: InsertVideoFavorite): Promise<VideoFavorite>;
  isVideoFavorited(userId: string, videoId: string): Promise<boolean>;
  getUserFavoriteVideos(userId: string): Promise<(Video & { creator: User })[]>;

  // Demo link clicks operations
  recordDemoLinkClick(click: InsertDemoLinkClick): Promise<DemoLinkClick>;
  getDemoLinkClickCount(videoId: string): Promise<number>;

  // Feed operations
  getFeedVideos(params: {
    limit?: number;
    offset?: number;
    tagFilter?: string;
    userId?: string | null;
  }): Promise<Array<{
    video: Video;
    creator: User;
    tags: Tag[];
    todayViews: number;
    totalViews: number;
    isFavorited: boolean;
    boostAmount: number;
  }>>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserCredits(userId: string, amount: number): Promise<void> {
    await db
      .update(users)
      .set({
        credits: sql`${users.credits} + ${amount}`,
        totalCreditsEarned: amount > 0 ? sql`${users.totalCreditsEarned} + ${amount}` : users.totalCreditsEarned,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async updateUserProfile(userId: string, profile: { firstName: string; lastName: string; email: string }): Promise<void> {
    const existingUser = await this.getUser(userId);
    if (!existingUser) {
      throw new Error("User not found");
    }

    // Check if email is already taken by another user
    const existingEmailUser = await db
      .select()
      .from(users)
      .where(and(
        eq(users.email, profile.email),
        sql`${users.id} != ${userId}`
      ));

    if (existingEmailUser.length > 0) {
      throw new Error("Email is already taken");
    }

    await db
      .update(users)
      .set({
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async updateUserPassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    // Note: Since we're using Replit OIDC auth, password management might not be applicable
    // This is a placeholder implementation - in reality, password changes would be handled
    // by the OIDC provider (Replit) rather than our application
    throw new Error("Password management is handled by your Replit account. Please update your password in your Replit account settings.");
  }

  // Video operations
  async createVideo(video: InsertVideo): Promise<Video> {
    const [newVideo] = await db.insert(videos).values(video).returning();
    return newVideo;
  }

  async getVideo(id: string): Promise<Video | undefined> {
    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    return video;
  }

  async getVideoWithCreator(id: string): Promise<(Video & { creator: User }) | undefined> {
    const result = await db
      .select()
      .from(videos)
      .innerJoin(users, eq(videos.creatorId, users.id))
      .where(eq(videos.id, id));
    
    if (result.length === 0) return undefined;
    
    return {
      ...result[0].videos,
      creator: result[0].users,
    };
  }

  async getUserVideos(userId: string): Promise<(Video & { todayViews: number })[]> {
    const today = new Date().toISOString().split('T')[0];
    
    const result = await db
      .select({
        video: videos,
        todayViews: sql<number>`COALESCE(${dailyStats.views}, 0)`,
      })
      .from(videos)
      .leftJoin(
        dailyStats,
        and(
          eq(videos.id, dailyStats.videoId),
          eq(dailyStats.date, today)
        )
      )
      .where(eq(videos.creatorId, userId))
      .orderBy(desc(videos.createdAt));

    return result.map(row => ({
      ...row.video,
      todayViews: row.todayViews,
    }));
  }

  async getTopVideosToday(limit = 10): Promise<(Video & { creator: User; todayViews: number })[]> {
    const today = new Date().toISOString().split('T')[0];
    
    const result = await db
      .select({
        video: videos,
        creator: users,
        todayViews: sql<number>`COALESCE(${dailyStats.views}, 0)`,
      })
      .from(videos)
      .innerJoin(users, eq(videos.creatorId, users.id))
      .leftJoin(
        dailyStats,
        and(
          eq(videos.id, dailyStats.videoId),
          eq(dailyStats.date, today)
        )
      )
      .where(eq(videos.isActive, true))
      .orderBy(desc(sql`COALESCE(${dailyStats.views}, 0)`))
      .limit(limit);

    return result.map(row => ({
      ...row.video,
      creator: row.creator,
      todayViews: row.todayViews,
    }));
  }

  async incrementVideoViews(videoId: string): Promise<void> {
    await db
      .update(videos)
      .set({
        totalViews: sql`${videos.totalViews} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(videos.id, videoId));
  }

  // Video viewing operations
  async recordVideoView(view: InsertVideoView): Promise<VideoView> {
    const [newView] = await db.insert(videoViews).values(view).returning();
    return newView;
  }

  async hasUserViewedVideo(userId: string, videoId: string): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [view] = await db
      .select()
      .from(videoViews)
      .where(
        and(
          eq(videoViews.viewerId, userId),
          eq(videoViews.videoId, videoId),
          gte(videoViews.watchedAt, today)
        )
      );
    
    return !!view;
  }

  // Daily stats operations
  async getTodayStats(): Promise<{
    totalViews: number;
    demosSubmitted: number;
    creditsEarned: number;
    activeUsers: number;
  }> {
    const today = new Date().toISOString().split('T')[0];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const [statsResult] = await db
      .select({
        totalViews: sql<number>`COALESCE(SUM(${dailyStats.views}), 0)`,
      })
      .from(dailyStats)
      .where(eq(dailyStats.date, today));

    const [videosResult] = await db
      .select({
        demosSubmitted: sql<number>`COUNT(*)`,
      })
      .from(videos)
      .where(gte(videos.createdAt, todayStart));

    const [creditsResult] = await db
      .select({
        creditsEarned: sql<number>`COALESCE(SUM(${creditTransactions.amount}), 0)`,
      })
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.type, 'earned'),
          gte(creditTransactions.createdAt, todayStart)
        )
      );

    const [usersResult] = await db
      .select({
        activeUsers: sql<number>`COUNT(DISTINCT ${videoViews.viewerId})`,
      })
      .from(videoViews)
      .where(gte(videoViews.watchedAt, todayStart));

    return {
      totalViews: statsResult?.totalViews || 0,
      demosSubmitted: videosResult?.demosSubmitted || 0,
      creditsEarned: creditsResult?.creditsEarned || 0,
      activeUsers: usersResult?.activeUsers || 0,
    };
  }

  async getVideoStatsToday(videoId: string): Promise<DailyStat | undefined> {
    const today = new Date().toISOString().split('T')[0];
    
    const [stat] = await db
      .select()
      .from(dailyStats)
      .where(
        and(
          eq(dailyStats.videoId, videoId),
          eq(dailyStats.date, today)
        )
      );
    
    return stat;
  }

  async updateDailyStats(videoId: string, views: number, creditsSpent = 0): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    await db
      .insert(dailyStats)
      .values({
        date: today,
        videoId,
        views,
        creditsSpent,
      })
      .onConflictDoUpdate({
        target: [dailyStats.videoId, dailyStats.date],
        set: {
          views: sql`${dailyStats.views} + ${views}`,
          creditsSpent: sql`${dailyStats.creditsSpent} + ${creditsSpent}`,
        },
      });
  }

  // Credit operations
  async recordCreditTransaction(transaction: InsertCreditTransaction): Promise<CreditTransaction> {
    const [newTransaction] = await db.insert(creditTransactions).values(transaction).returning();
    return newTransaction;
  }

  async getUserCreditTransactions(userId: string, limit = 50): Promise<CreditTransaction[]> {
    return await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit);
  }

  // Leaderboard operations
  async getTodayLeaderboard(limit = 10): Promise<Array<{
    position: number;
    video: Video;
    creator: User;
    views: number;
  }>> {
    const today = new Date().toISOString().split('T')[0];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const result = await db
      .select({
        video: videos,
        creator: users,
        views: sql<number>`COALESCE(${dailyStats.views}, 0)`,
      })
      .from(videos)
      .innerJoin(users, eq(videos.creatorId, users.id))
      .leftJoin(
        dailyStats,
        and(
          eq(videos.id, dailyStats.videoId),
          eq(dailyStats.date, today)
        )
      )
      .where(
        and(
          eq(videos.isActive, true),
          gte(videos.createdAt, todayStart) // Show all videos created today
        )
      )
      .orderBy(
        desc(sql`COALESCE(${dailyStats.views}, 0)`),
        desc(videos.createdAt) // Secondary sort by creation time
      )
      .limit(limit);

    return result.map((row, index) => ({
      position: index + 1,
      video: row.video,
      creator: row.creator,
      views: row.views,
    }));
  }

  async getEnhancedLeaderboard(limit = 10, sortBy: 'views' | 'favorites' | 'demo_clicks' = 'views', tagFilter?: string): Promise<Array<{
    position: number;
    video: Video & { tags: Tag[] };
    creator: User;
    views: number;
    favorites: number;
    demoClicks: number;
  }>> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayStr = today.toISOString().split('T')[0];

    // Base query
    let query = db
      .select({
        video: videos,
        creator: users,
        views: sql<number>`COALESCE(${dailyStats.views}, 0)`,
        favorites: sql<number>`COUNT(DISTINCT ${videoFavorites.id})`,
        demoClicks: sql<number>`COUNT(DISTINCT CASE 
          WHEN ${demoLinkClicks.clickedAt} >= ${today} 
          AND ${demoLinkClicks.clickedAt} < ${tomorrow} 
          THEN ${demoLinkClicks.id} 
          ELSE NULL 
        END)`,
      })
      .from(videos)
      .innerJoin(users, eq(videos.creatorId, users.id))
      .leftJoin(
        dailyStats,
        and(
          eq(videos.id, dailyStats.videoId),
          eq(dailyStats.date, todayStr)
        )
      )
      .leftJoin(videoFavorites, eq(videos.id, videoFavorites.videoId))
      .leftJoin(demoLinkClicks, eq(videos.id, demoLinkClicks.videoId))
      .where(
        and(
          eq(videos.isActive, true),
          gte(videos.createdAt, today) // Show all videos created today
        )
      );

    // Add tag filtering if specified
    if (tagFilter) {
      query = query
        .innerJoin(videoTags, eq(videos.id, videoTags.videoId))
        .innerJoin(tags, and(eq(videoTags.tagId, tags.id), eq(tags.name, tagFilter)));
    }

    // Group and order by the specified metric
    let orderBy;
    switch (sortBy) {
      case 'favorites':
        orderBy = desc(sql`COUNT(DISTINCT ${videoFavorites.id})`);
        break;
      case 'demo_clicks':
        orderBy = desc(sql`COUNT(DISTINCT CASE 
          WHEN ${demoLinkClicks.clickedAt} >= ${today} 
          AND ${demoLinkClicks.clickedAt} < ${tomorrow} 
          THEN ${demoLinkClicks.id} 
          ELSE NULL 
        END)`);
        break;
      default:
        orderBy = desc(sql`COALESCE(${dailyStats.views}, 0)`);
    }

    const result = await query
      .groupBy(videos.id, users.id, dailyStats.views)
      .orderBy(orderBy)
      .limit(limit);

    // Get tags for each video
    const videosWithTags = await Promise.all(
      result.map(async (row) => {
        const videoTags = await this.getVideoTags(row.video.id);
        return {
          position: 0, // Will be set below
          video: {
            ...row.video,
            tags: videoTags,
          },
          creator: row.creator,
          views: row.views,
          favorites: row.favorites,
          demoClicks: row.demoClicks,
        };
      })
    );

    // Set positions
    return videosWithTags.map((item, index) => ({
      ...item,
      position: index + 1,
    }));
  }

  // Video viewing session operations (secure)
  async startVideoViewing(userId: string, videoId: string): Promise<VideoViewingSession> {
    // Check if user already has an active session for this video
    const existingSession = await this.getActiveVideoViewingSession(userId, videoId);
    if (existingSession) {
      return existingSession;
    }

    // Check if user already viewed this video today
    const hasViewed = await this.hasUserViewedVideoToday(userId, videoId);
    if (hasViewed) {
      throw new Error("Video already viewed today");
    }

    const [session] = await db
      .insert(videoViewingSessions)
      .values({
        userId,
        videoId,
      })
      .returning();
    
    return session;
  }

  async completeVideoViewing(sessionId: string): Promise<{ session: VideoViewingSession; creditAwarded: boolean }> {
    // Get the viewing session
    const [session] = await db
      .select()
      .from(videoViewingSessions)
      .where(eq(videoViewingSessions.id, sessionId));

    if (!session) {
      throw new Error("Viewing session not found");
    }

    if (session.isCompleted) {
      throw new Error("Session already completed");
    }

    // Calculate elapsed time in seconds
    const now = new Date();
    const startTime = session.startedAt ? new Date(session.startedAt) : new Date();
    const elapsedSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);

    // Check if minimum watch time has been met (30 seconds)
    const completedMinimum = elapsedSeconds >= 30;

    // Mark session as completed
    const [updatedSession] = await db
      .update(videoViewingSessions)
      .set({
        isCompleted: true,
        completedAt: now,
      })
      .where(eq(videoViewingSessions.id, sessionId))
      .returning();

    let creditAwarded = false;

    if (completedMinimum) {
      // Check if user already earned credit for this video today (double-check)
      const hasViewedToday = await this.hasUserViewedVideoToday(session.userId, session.videoId);
      
      if (!hasViewedToday) {
        // Record the video view
        await this.recordVideoView({
          videoId: session.videoId,
          viewerId: session.userId,
          watchDuration: elapsedSeconds,
          completedMinimum: true,
          creditAwarded: true,
        });

        // Award credit
        await this.updateUserCredits(session.userId, 1);
        await this.recordCreditTransaction({
          userId: session.userId,
          type: 'earned',
          amount: 1,
          reason: 'video_watch',
          videoId: session.videoId,
        });

        // Update video stats
        await this.incrementVideoViews(session.videoId);
        await this.updateDailyStats(session.videoId, 1);

        creditAwarded = true;
      }
    }

    return {
      session: updatedSession,
      creditAwarded,
    };
  }

  async getActiveVideoViewingSession(userId: string, videoId: string): Promise<VideoViewingSession | undefined> {
    const [session] = await db
      .select()
      .from(videoViewingSessions)
      .where(
        and(
          eq(videoViewingSessions.userId, userId),
          eq(videoViewingSessions.videoId, videoId),
          eq(videoViewingSessions.isCompleted, false)
        )
      )
      .orderBy(desc(videoViewingSessions.startedAt))
      .limit(1);

    return session;
  }

  async hasUserViewedVideoToday(userId: string, videoId: string): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [view] = await db
      .select()
      .from(videoViews)
      .where(
        and(
          eq(videoViews.viewerId, userId),
          eq(videoViews.videoId, videoId),
          gte(videoViews.watchedAt, today)
        )
      );
    
    return !!view;
  }

  // Video operations with tags
  async createVideoWithTags(video: InsertVideoWithTags): Promise<Video> {
    const { tags: tagNames, ...videoData } = video;
    
    // Create the video first
    const [newVideo] = await db.insert(videos).values(videoData).returning();
    
    // If tags are provided, handle them
    if (tagNames && tagNames.length > 0) {
      const tagIds: string[] = [];
      
      // Get or create each tag
      for (const tagName of tagNames) {
        const tag = await this.getOrCreateTag(tagName);
        tagIds.push(tag.id);
      }
      
      // Associate tags with the video
      if (tagIds.length > 0) {
        await this.addTagsToVideo(newVideo.id, tagIds);
      }
    }
    
    return newVideo;
  }

  async getVideoWithCreatorAndTags(id: string): Promise<(Video & { creator: User; tags: Tag[] }) | undefined> {
    // Get video with creator
    const result = await db
      .select()
      .from(videos)
      .innerJoin(users, eq(videos.creatorId, users.id))
      .where(eq(videos.id, id));
    
    if (result.length === 0) return undefined;
    
    // Get tags for this video
    const videoTags = await this.getVideoTags(id);
    
    return {
      ...result[0].videos,
      creator: result[0].users,
      tags: videoTags,
    };
  }

  async getUserVideosWithTags(userId: string): Promise<(Video & { todayViews: number; tags: Tag[] })[]> {
    const today = new Date().toISOString().split('T')[0];
    
    const result = await db
      .select({
        video: videos,
        todayViews: sql<number>`COALESCE(${dailyStats.views}, 0)`,
      })
      .from(videos)
      .leftJoin(
        dailyStats,
        and(
          eq(videos.id, dailyStats.videoId),
          eq(dailyStats.date, today)
        )
      )
      .where(eq(videos.creatorId, userId))
      .orderBy(desc(videos.createdAt));

    // Get tags for each video
    const videosWithTags = await Promise.all(
      result.map(async row => {
        const videoTags = await this.getVideoTags(row.video.id);
        return {
          ...row.video,
          todayViews: row.todayViews,
          tags: videoTags,
        };
      })
    );

    return videosWithTags;
  }

  async getTopVideosTodayWithTags(limit = 10, tagFilter?: string): Promise<(Video & { creator: User; todayViews: number; tags: Tag[] })[]> {
    const today = new Date().toISOString().split('T')[0];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let query = db
      .select({
        video: videos,
        creator: users,
        todayViews: sql<number>`COALESCE(${dailyStats.views}, 0)`,
      })
      .from(videos)
      .innerJoin(users, eq(videos.creatorId, users.id))
      .leftJoin(
        dailyStats,
        and(
          eq(videos.id, dailyStats.videoId),
          eq(dailyStats.date, today)
        )
      )
      .where(
        and(
          eq(videos.isActive, true),
          gte(videos.createdAt, todayStart) // Only show videos created today
        )
      );

    // Add tag filtering if specified
    if (tagFilter) {
      query = query
        .innerJoin(videoTags, eq(videos.id, videoTags.videoId))
        .innerJoin(tags, and(eq(videoTags.tagId, tags.id), eq(tags.name, tagFilter)));
    }

    const result = await query
      .orderBy(desc(sql`COALESCE(${dailyStats.views}, 0)`))
      .limit(limit);

    // Get tags for each video
    const videosWithTags = await Promise.all(
      result.map(async row => {
        const videoTags = await this.getVideoTags(row.video.id);
        return {
          ...row.video,
          creator: row.creator,
          todayViews: row.todayViews,
          tags: videoTags,
        };
      })
    );

    return videosWithTags;
  }

  // Tag operations
  async getAllTags(): Promise<Tag[]> {
    return await db.select().from(tags).orderBy(tags.name);
  }

  async getOrCreateTag(name: string): Promise<Tag> {
    const normalizedName = name.trim().toLowerCase();
    
    // Try to get existing tag
    const [existingTag] = await db
      .select()
      .from(tags)
      .where(eq(tags.name, normalizedName));
    
    if (existingTag) {
      return existingTag;
    }
    
    // Create new tag
    const [newTag] = await db
      .insert(tags)
      .values({ name: normalizedName })
      .returning();
    
    return newTag;
  }

  async getVideoTags(videoId: string): Promise<Tag[]> {
    const result = await db
      .select({ tag: tags })
      .from(videoTags)
      .innerJoin(tags, eq(videoTags.tagId, tags.id))
      .where(eq(videoTags.videoId, videoId))
      .orderBy(tags.name);
    
    return result.map(row => row.tag);
  }

  async addTagsToVideo(videoId: string, tagIds: string[]): Promise<void> {
    if (tagIds.length === 0) return;
    
    const tagValues = tagIds.map(tagId => ({
      videoId,
      tagId,
    }));
    
    await db.insert(videoTags).values(tagValues);
  }

  // Favorites operations
  async favoriteVideo(favorite: InsertVideoFavorite): Promise<VideoFavorite> {
    const [result] = await db
      .insert(videoFavorites)
      .values(favorite)
      .onConflictDoNothing() // Prevent duplicate favorites
      .returning();
    
    return result;
  }

  async isVideoFavorited(userId: string, videoId: string): Promise<boolean> {
    const [result] = await db
      .select()
      .from(videoFavorites)
      .where(and(eq(videoFavorites.userId, userId), eq(videoFavorites.videoId, videoId)))
      .limit(1);
    
    return !!result;
  }

  async getUserFavoriteVideos(userId: string): Promise<(Video & { creator: User })[]> {
    const result = await db
      .select({
        video: videos,
        creator: users,
      })
      .from(videoFavorites)
      .innerJoin(videos, eq(videoFavorites.videoId, videos.id))
      .innerJoin(users, eq(videos.creatorId, users.id))
      .where(and(eq(videoFavorites.userId, userId), eq(videos.isActive, true)))
      .orderBy(desc(videoFavorites.createdAt));

    return result.map(row => ({
      ...row.video,
      creator: row.creator,
    }));
  }

  // Demo link clicks operations
  async recordDemoLinkClick(click: InsertDemoLinkClick): Promise<DemoLinkClick> {
    const [result] = await db
      .insert(demoLinkClicks)
      .values(click)
      .returning();
    
    return result;
  }

  async getDemoLinkClickCount(videoId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [result] = await db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(demoLinkClicks)
      .where(
        and(
          eq(demoLinkClicks.videoId, videoId),
          gte(demoLinkClicks.clickedAt, today),
          lt(demoLinkClicks.clickedAt, tomorrow)
        )
      );

    return result?.count || 0;
  }

  // Feed operations
  async getFeedVideos(params: {
    limit?: number;
    offset?: number;
    tagFilter?: string;
    userId?: string | null;
  }): Promise<Array<{
    video: Video;
    creator: User;
    tags: Tag[];
    todayViews: number;
    totalViews: number;
    isFavorited: boolean;
    boostAmount: number;
  }>> {
    const { limit = 10, offset = 0, tagFilter, userId } = params;
    const today = new Date().toISOString().split('T')[0];
    
    // Build the base query
    let query = db
      .select({
        video: videos,
        creator: users,
        todayViews: sql<number>`COALESCE(${dailyStats.views}, 0)`,
        boostAmount: sql<number>`COALESCE(${dailyStats.creditsSpent}, 0)`,
      })
      .from(videos)
      .innerJoin(users, eq(videos.creatorId, users.id))
      .leftJoin(
        dailyStats,
        and(
          eq(videos.id, dailyStats.videoId),
          eq(dailyStats.date, today)
        )
      )
      .where(eq(videos.isActive, true));

    // Add tag filtering if specified
    if (tagFilter) {
      query = query
        .innerJoin(videoTags, eq(videos.id, videoTags.videoId))
        .innerJoin(tags, and(eq(videoTags.tagId, tags.id), eq(tags.name, tagFilter)));
    }

    // Order by boost amount (trending), then today's views, then upload time
    const result = await query
      .orderBy(
        desc(sql`COALESCE(${dailyStats.creditsSpent}, 0)`),
        desc(sql`COALESCE(${dailyStats.views}, 0)`),
        desc(videos.createdAt)
      )
      .limit(limit)
      .offset(offset);

    // Get tags and favorite status for each video
    const videosWithFullData = await Promise.all(
      result.map(async row => {
        const videoTags = await this.getVideoTags(row.video.id);
        const isFavorited = userId ? await this.isVideoFavorited(userId, row.video.id) : false;
        
        return {
          video: row.video,
          creator: row.creator,
          tags: videoTags,
          todayViews: row.todayViews,
          totalViews: row.video.totalViews,
          isFavorited,
          boostAmount: row.boostAmount,
        };
      })
    );

    return videosWithFullData;
  }
}

export const storage = new DatabaseStorage();
