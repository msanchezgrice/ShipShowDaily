import { db } from './db';
import { users, videos, dailyStats, tags, videoTags, videoFavorites, videoViews, creditTransactions, videoViewingSessions, demoLinkClicks } from '../../shared/schema';
import { eq, desc, sql, and, gte, lt, or } from 'drizzle-orm';

// User operations
export async function getUser(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user;
}

export async function upsertUser(userData: any) {
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

export async function updateUserCredits(userId: string, amount: number) {
  await db
    .update(users)
    .set({
      credits: sql`${users.credits} + ${amount}`,
      totalCreditsEarned: amount > 0 ? sql`${users.totalCreditsEarned} + ${amount}` : users.totalCreditsEarned,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function updateUserProfile(userId: string, profile: { firstName: string; lastName: string; email: string }) {
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

export async function updateUserPassword(userId: string, currentPassword: string, newPassword: string) {
  // Clerk handles passwords, not our database
  throw new Error("Password management is handled by Clerk");
}

// Video operations
export async function createVideo(video: any) {
  const [newVideo] = await db.insert(videos).values(video).returning();
  return newVideo;
}

export async function createVideoWithTags(videoData: any) {
  const { tagNames, ...video } = videoData;
  const [newVideo] = await db.insert(videos).values(video).returning();
  
  if (tagNames && tagNames.length > 0) {
    // Handle tags
    for (const tagName of tagNames) {
      const [tag] = await db
        .insert(tags)
        .values({ name: tagName })
        .onConflictDoNothing()
        .returning();
      
      if (tag) {
        await db.insert(videoTags).values({
          videoId: newVideo.id,
          tagId: tag.id,
        });
      }
    }
  }
  
  return newVideo;
}

export async function getVideo(id: string) {
  const [video] = await db.select().from(videos).where(eq(videos.id, id));
  return video;
}

export async function getVideoWithCreator(id: string) {
  const result = await db
    .select()
    .from(videos)
    .leftJoin(users, eq(videos.creatorId, users.id))
    .where(eq(videos.id, id));
  
  if (result.length === 0) return undefined;
  
  return {
    ...result[0].videos,
    creator: result[0].users,
  };
}

export async function getUserVideos(userId: string) {
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
    .where(eq(videos.creatorId, userId));
  
  return result.map(r => ({ ...r.video, todayViews: r.todayViews }));
}

export async function getUserVideosWithTags(userId: string) {
  // For now, just return getUserVideos without tags
  // Complex joins can be added later
  return getUserVideos(userId);
}

export async function getVideoWithCreatorAndTags(id: string) {
  const result = await db
    .select()
    .from(videos)
    .leftJoin(users, eq(videos.creatorId, users.id))
    .where(eq(videos.id, id));
  
  if (result.length === 0) return undefined;
  
  return {
    ...result[0].videos,
    creator: result[0].users,
    tags: [], // Tags would need separate query
  };
}

export async function getTopVideosTodayWithTags(limit = 10, tagFilter?: string) {
  // For now, just return getTopVideosToday without tags
  return getTopVideosToday(limit);
}

export async function getTopVideosToday(limit = 10) {
  const today = new Date().toISOString().split('T')[0];
  
  const result = await db
    .select()
    .from(videos)
    .leftJoin(users, eq(videos.creatorId, users.id))
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
  
  return result.map(r => ({
    ...r.videos,
    creator: r.users,
    todayViews: r.daily_stats?.views || 0,
  }));
}

export async function incrementVideoViews(videoId: string) {
  await db
    .update(videos)
    .set({
      totalViews: sql`${videos.totalViews} + 1`,
    })
    .where(eq(videos.id, videoId));
}

// Video viewing operations
export async function recordVideoView(view: any) {
  const [newView] = await db.insert(videoViews).values(view).returning();
  return newView;
}

export async function hasUserViewedVideo(userId: string, videoId: string) {
  const result = await db
    .select()
    .from(videoViews)
    .where(and(
      eq(videoViews.viewerId, userId),
      eq(videoViews.videoId, videoId)
    ));
  
  return result.length > 0;
}

// Daily stats operations
export async function getTodayStats() {
  const today = new Date().toISOString().split('T')[0];
  
  const stats = await db
    .select({
      totalViews: sql<number>`COALESCE(SUM(${dailyStats.views}), 0)`,
      totalDemos: sql<number>`COUNT(DISTINCT ${dailyStats.videoId})`,
      totalCreditsSpent: sql<number>`COALESCE(SUM(${dailyStats.creditsSpent}), 0)`,
    })
    .from(dailyStats)
    .where(eq(dailyStats.date, today));

  const activeUsers = await db
    .select({
      count: sql<number>`COUNT(DISTINCT ${users.id})`,
    })
    .from(users)
    .where(gte(users.createdAt, new Date(today)));

  return {
    totalViews: stats[0]?.totalViews || 0,
    demosSubmitted: stats[0]?.totalDemos || 0,
    creditsEarned: stats[0]?.totalCreditsSpent || 0,
    activeUsers: activeUsers[0]?.count || 0,
  };
}

export async function getVideoStatsToday(videoId: string) {
  const today = new Date().toISOString().split('T')[0];
  
  const [stat] = await db
    .select()
    .from(dailyStats)
    .where(and(
      eq(dailyStats.videoId, videoId),
      eq(dailyStats.date, today)
    ));
  
  return stat;
}

export async function updateDailyStats(videoId: string, views: number, creditsSpent = 0) {
  const today = new Date().toISOString().split('T')[0];
  
  await db
    .insert(dailyStats)
    .values({
      videoId,
      date: today,
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
export async function recordCreditTransaction(transaction: any) {
  const [newTransaction] = await db.insert(creditTransactions).values(transaction).returning();
  return newTransaction;
}

export async function getUserCreditTransactions(userId: string, limit = 10) {
  const transactions = await db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, userId))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(limit);
  
  return transactions;
}

// Leaderboard operations
export async function getTodayLeaderboard(limit = 10) {
  const today = new Date().toISOString().split('T')[0];
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  
  const result = await db
    .select({
      id: videos.id,
      title: videos.title,
      description: videos.description,
      productUrl: videos.productUrl,
      videoPath: videos.videoPath,
      thumbnailPath: videos.thumbnailPath,
      creatorId: videos.creatorId,
      creatorName: sql<string>`COALESCE(CONCAT(${users.firstName}, ' ', ${users.lastName}), ${users.email}, 'Anonymous')`,
      creatorImageUrl: users.profileImageUrl,
      views: sql<number>`COALESCE(${dailyStats.views}, 0)`,
      totalViews: videos.totalViews,
      creditsSpent: sql<number>`COALESCE(${dailyStats.creditsSpent}, 0)`,
      isActive: videos.isActive,
      createdAt: videos.createdAt,
    })
    .from(videos)
    .leftJoin(users, eq(videos.creatorId, users.id))
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
        or(
          // Either has views today
          sql`${dailyStats.views} > 0`,
          // Or was created today
          gte(videos.createdAt, todayStart)
        )
      )
    )
    .orderBy(
      desc(sql`COALESCE(${dailyStats.views}, 0)`),
      desc(videos.createdAt) // Secondary sort by creation time
    )
    .limit(limit);

  return result.map((item, index) => ({
    position: index + 1,
    video: {
      id: item.id,
      title: item.title,
      description: item.description,
      productUrl: item.productUrl,
      videoPath: item.videoPath,
      thumbnailPath: item.thumbnailPath,
      creatorId: item.creatorId,
      totalViews: item.totalViews,
      isActive: item.isActive,
    },
    creator: {
      id: item.creatorId,
      name: item.creatorName,
      profileImageUrl: item.creatorImageUrl,
    },
    views: item.views,
  }));
}

export async function getEnhancedLeaderboard(limit = 10, sortBy = 'views', tagFilter?: string) {
  // For now, just use the basic leaderboard
  return getTodayLeaderboard(limit);
}

// Video viewing session operations
export async function startVideoViewing(userId: string, videoId: string) {
  const [session] = await db
    .insert(videoViewingSessions)
    .values({
      userId,
      videoId,
      startedAt: new Date(),
      isCompleted: false,
    })
    .returning();
  
  return session;
}

export async function completeVideoViewing(sessionId: string) {
  const [session] = await db
    .update(videoViewingSessions)
    .set({
      completedAt: new Date(),
      isCompleted: true,
    })
    .where(eq(videoViewingSessions.id, sessionId))
    .returning();
  
  return { session, creditAwarded: false };
}

export async function getActiveVideoViewingSession(userId: string, videoId: string) {
  const [session] = await db
    .select()
    .from(videoViewingSessions)
    .where(and(
      eq(videoViewingSessions.userId, userId),
      eq(videoViewingSessions.videoId, videoId),
      eq(videoViewingSessions.isCompleted, false)
    ))
    .orderBy(desc(videoViewingSessions.startedAt));
  
  return session;
}

export async function hasUserViewedVideoToday(userId: string, videoId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const result = await db
    .select()
    .from(videoViewingSessions)
    .where(and(
      eq(videoViewingSessions.userId, userId),
      eq(videoViewingSessions.videoId, videoId),
      eq(videoViewingSessions.isCompleted, true),
      gte(videoViewingSessions.completedAt, today)
    ));
  
  return result.length > 0;
}

// Tag operations
export async function getAllTags() {
  const result = await db
    .select({
      id: tags.id,
      name: tags.name,
      count: sql<number>`COUNT(DISTINCT ${videoTags.videoId})`,
    })
    .from(tags)
    .leftJoin(videoTags, eq(tags.id, videoTags.tagId))
    .leftJoin(videos, and(
      eq(videoTags.videoId, videos.id),
      eq(videos.isActive, true)
    ))
    .groupBy(tags.id, tags.name)
    .orderBy(desc(sql`COUNT(DISTINCT ${videoTags.videoId})`));

  return result.filter(tag => tag.count > 0);
}

export async function getOrCreateTag(name: string) {
  const [existingTag] = await db
    .select()
    .from(tags)
    .where(eq(tags.name, name));
  
  if (existingTag) return existingTag;
  
  const [newTag] = await db
    .insert(tags)
    .values({ name })
    .returning();
  
  return newTag;
}

export async function getVideoTags(videoId: string) {
  const result = await db
    .select()
    .from(tags)
    .innerJoin(videoTags, eq(tags.id, videoTags.tagId))
    .where(eq(videoTags.videoId, videoId));
  
  return result.map(r => r.tags);
}

export async function addTagsToVideo(videoId: string, tagIds: string[]) {
  const values = tagIds.map(tagId => ({ videoId, tagId }));
  await db.insert(videoTags).values(values).onConflictDoNothing();
}

// Favorites operations
export async function favoriteVideo(favorite: any) {
  const [newFavorite] = await db
    .insert(videoFavorites)
    .values(favorite)
    .onConflictDoNothing()
    .returning();
  
  return newFavorite;
}

export async function isVideoFavorited(userId: string, videoId: string) {
  const result = await db
    .select()
    .from(videoFavorites)
    .where(and(
      eq(videoFavorites.userId, userId),
      eq(videoFavorites.videoId, videoId)
    ));
  
  return result.length > 0;
}

export async function getUserFavoriteVideos(userId: string) {
  const result = await db
    .select()
    .from(videos)
    .innerJoin(videoFavorites, eq(videos.id, videoFavorites.videoId))
    .leftJoin(users, eq(videos.creatorId, users.id))
    .where(eq(videoFavorites.userId, userId))
    .orderBy(desc(videoFavorites.createdAt));
  
  return result.map(r => ({
    ...r.videos,
    creator: r.users,
  }));
}

// Demo link clicks operations
export async function recordDemoLinkClick(click: any) {
  const [newClick] = await db.insert(demoLinkClicks).values(click).returning();
  return newClick;
}

export async function getDemoLinkClickCount(videoId: string) {
  const result = await db
    .select({
      count: sql<number>`COUNT(*)`,
    })
    .from(demoLinkClicks)
    .where(eq(demoLinkClicks.videoId, videoId));
  
  return result[0]?.count || 0;
}

// Feed operations (already exists in storage-adapter.ts)
export { getFeedVideos } from './storage-adapter';

// Export storage object for compatibility
export const storage = {
  getUser,
  upsertUser,
  updateUserCredits,
  updateUserProfile,
  updateUserPassword,
  createVideo,
  createVideoWithTags,
  getVideo,
  getVideoWithCreator,
  getVideoWithCreatorAndTags,
  getUserVideos,
  getUserVideosWithTags,
  getTopVideosToday,
  getTopVideosTodayWithTags,
  incrementVideoViews,
  recordVideoView,
  hasUserViewedVideo,
  getTodayStats,
  getVideoStatsToday,
  updateDailyStats,
  recordCreditTransaction,
  getUserCreditTransactions,
  getTodayLeaderboard,
  getEnhancedLeaderboard,
  startVideoViewing,
  completeVideoViewing,
  getActiveVideoViewingSession,
  hasUserViewedVideoToday,
  getAllTags,
  getOrCreateTag,
  getVideoTags,
  addTagsToVideo,
  favoriteVideo,
  isVideoFavorited,
  getUserFavoriteVideos,
  recordDemoLinkClick,
  getDemoLinkClickCount,
  getFeedVideos: (params: any) => require('./storage-adapter').getFeedVideos(params),
};