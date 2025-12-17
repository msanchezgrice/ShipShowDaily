/**
 * Data access layer using dynamic imports for Vercel serverless.
 * All functions use withDb() for automatic connection handling.
 */

import { withDb } from './database';

// ============ USER OPERATIONS ============

export async function getUser(id: string) {
  return withDb(async ({ db, schema, eq }) => {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  });
}

export async function upsertUser(userData: {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
}) {
  return withDb(async ({ db, schema }) => {
    const [user] = await db
      .insert(schema.users)
      .values(userData)
      .onConflictDoUpdate({
        target: schema.users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  });
}

export async function updateUserProfile(userId: string, profile: { 
  firstName: string; 
  lastName: string; 
  email: string;
}) {
  return withDb(async ({ db, schema, eq }) => {
    await db
      .update(schema.users)
      .set({
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId));
  });
}

export async function updateUserCredits(userId: string, amount: number) {
  return withDb(async ({ db, schema, eq, sql }) => {
    await db
      .update(schema.users)
      .set({
        credits: sql`${schema.users.credits} + ${amount}`,
        totalCreditsEarned: amount > 0 
          ? sql`${schema.users.totalCreditsEarned} + ${amount}` 
          : schema.users.totalCreditsEarned,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId));
  });
}

// ============ VIDEO OPERATIONS ============

export async function getVideo(id: string) {
  return withDb(async ({ db, schema, eq }) => {
    const [video] = await db.select().from(schema.videos).where(eq(schema.videos.id, id));
    return video;
  });
}

export async function getVideoWithCreator(id: string) {
  return withDb(async ({ db, schema, eq }) => {
    const result = await db
      .select()
      .from(schema.videos)
      .leftJoin(schema.users, eq(schema.videos.creatorId, schema.users.id))
      .where(eq(schema.videos.id, id));
    
    if (result.length === 0) return undefined;
    
    return {
      ...result[0].videos,
      creator: result[0].users,
    };
  });
}

export async function createVideo(video: {
  title: string;
  description: string;
  productUrl: string;
  videoPath: string;
  thumbnailPath?: string;
  creatorId: string;
  provider?: string;
  providerAssetId?: string;
  hlsUrl?: string;
  status?: string;
}) {
  return withDb(async ({ db, schema }) => {
    const [newVideo] = await db.insert(schema.videos).values(video).returning();
    return newVideo;
  });
}

export async function getUserVideos(userId: string) {
  return withDb(async ({ db, schema, eq, and, desc, sql }) => {
    const today = new Date().toISOString().split('T')[0];
    
    const result = await db
      .select({
        video: schema.videos,
        todayViews: sql<number>`COALESCE(${schema.dailyStats.views}, 0)`,
      })
      .from(schema.videos)
      .leftJoin(
        schema.dailyStats,
        and(
          eq(schema.videos.id, schema.dailyStats.videoId),
          eq(schema.dailyStats.date, today)
        )
      )
      .where(eq(schema.videos.creatorId, userId))
      .orderBy(desc(schema.videos.createdAt));
    
    return result.map(r => ({ ...r.video, todayViews: r.todayViews }));
  });
}

export async function updateVideo(videoId: string, updates: Partial<{
  title: string;
  description: string;
  productUrl: string;
  videoPath: string;
  thumbnailPath: string;
  hlsUrl: string;
  status: string;
  isActive: boolean;
}>) {
  return withDb(async ({ db, schema, eq }) => {
    const [updated] = await db
      .update(schema.videos)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.videos.id, videoId))
      .returning();
    return updated;
  });
}

// ============ FEED & LEADERBOARD ============

export async function getFeedVideos(params: {
  limit?: number;
  offset?: number;
  userId?: string | null;
}) {
  const { limit = 20, offset = 0, userId } = params;
  
  return withDb(async ({ db, schema, eq, and, desc, sql }) => {
    const today = new Date().toISOString().split('T')[0];
    
    const result = await db
      .select({
        id: schema.videos.id,
        title: schema.videos.title,
        description: schema.videos.description,
        productUrl: schema.videos.productUrl,
        videoPath: schema.videos.videoPath,
        thumbnailPath: schema.videos.thumbnailPath,
        hlsUrl: schema.videos.hls_url,
        provider: schema.videos.provider,
        status: schema.videos.status,
        creatorId: schema.videos.creatorId,
        creatorFirstName: schema.users.firstName,
        creatorLastName: schema.users.lastName,
        creatorEmail: schema.users.email,
        creatorImageUrl: schema.users.profileImageUrl,
        todayViews: sql<number>`COALESCE(${schema.dailyStats.views}, 0)`,
        totalViews: schema.videos.totalViews,
        createdAt: schema.videos.createdAt,
        isActive: schema.videos.isActive,
        boostAmount: schema.videos.boostAmount,
      })
      .from(schema.videos)
      .leftJoin(schema.users, eq(schema.videos.creatorId, schema.users.id))
      .leftJoin(
        schema.dailyStats,
        and(
          eq(schema.videos.id, schema.dailyStats.videoId),
          eq(schema.dailyStats.date, today)
        )
      )
      .where(eq(schema.videos.isActive, true))
      .orderBy(
        desc(sql`COALESCE(${schema.dailyStats.creditsSpent}, 0)`),
        desc(sql`COALESCE(${schema.dailyStats.views}, 0)`),
        desc(schema.videos.createdAt)
      )
      .limit(limit)
      .offset(offset);
    
    // Check favorites for logged-in user
    let favoritedIds = new Set<string>();
    if (userId) {
      const favorites = await db
        .select({ videoId: schema.videoFavorites.videoId })
        .from(schema.videoFavorites)
        .where(eq(schema.videoFavorites.userId, userId));
      favoritedIds = new Set(favorites.map(f => f.videoId));
    }
    
    return result.map(video => ({
      video: {
        id: video.id,
        title: video.title,
        description: video.description,
        productUrl: video.productUrl,
        videoPath: video.videoPath,
        thumbnailPath: video.thumbnailPath,
        hls_url: video.hlsUrl,
        provider: video.provider,
        status: video.status,
        creatorId: video.creatorId,
        totalViews: video.totalViews,
        createdAt: video.createdAt,
        isActive: video.isActive,
      },
      creator: {
        id: video.creatorId,
        firstName: video.creatorFirstName,
        lastName: video.creatorLastName,
        email: video.creatorEmail,
        profileImageUrl: video.creatorImageUrl,
      },
      tags: [],
      todayViews: video.todayViews,
      totalViews: video.totalViews,
      isFavorited: favoritedIds.has(video.id),
      boostAmount: video.boostAmount || 0,
    }));
  });
}

export async function getLeaderboard(limit = 10) {
  return withDb(async ({ db, schema, eq, and, desc, sql }) => {
    const today = new Date().toISOString().split('T')[0];
    
    const result = await db
      .select({
        id: schema.videos.id,
        title: schema.videos.title,
        description: schema.videos.description,
        productUrl: schema.videos.productUrl,
        videoPath: schema.videos.videoPath,
        thumbnailPath: schema.videos.thumbnailPath,
        hlsUrl: schema.videos.hls_url,
        provider: schema.videos.provider,
        status: schema.videos.status,
        creatorId: schema.videos.creatorId,
        creatorFirstName: schema.users.firstName,
        creatorLastName: schema.users.lastName,
        creatorEmail: schema.users.email,
        creatorImageUrl: schema.users.profileImageUrl,
        views: sql<number>`COALESCE(${schema.dailyStats.views}, 0)`,
        totalViews: schema.videos.totalViews,
        creditsSpent: sql<number>`COALESCE(${schema.dailyStats.creditsSpent}, 0)`,
        isActive: schema.videos.isActive,
        createdAt: schema.videos.createdAt,
      })
      .from(schema.videos)
      .leftJoin(schema.users, eq(schema.videos.creatorId, schema.users.id))
      .leftJoin(
        schema.dailyStats,
        and(
          eq(schema.videos.id, schema.dailyStats.videoId),
          eq(schema.dailyStats.date, today)
        )
      )
      .where(eq(schema.videos.isActive, true))
      .orderBy(
        desc(sql`COALESCE(${schema.dailyStats.creditsSpent}, 0)`),
        desc(sql`COALESCE(${schema.dailyStats.views}, 0)`),
        desc(schema.videos.createdAt)
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
        totalViews: item.totalViews,
        isActive: item.isActive,
      },
      creator: {
        id: item.creatorId,
        name: [item.creatorFirstName, item.creatorLastName].filter(Boolean).join(' ') || item.creatorEmail || 'Anonymous',
        profileImageUrl: item.creatorImageUrl,
      },
      views: item.views,
    }));
  });
}

// ============ FAVORITES ============

export async function toggleFavorite(userId: string, videoId: string) {
  return withDb(async ({ db, schema, eq, and }) => {
    // Check if already favorited
    const [existing] = await db
      .select()
      .from(schema.videoFavorites)
      .where(and(
        eq(schema.videoFavorites.userId, userId),
        eq(schema.videoFavorites.videoId, videoId)
      ));
    
    if (existing) {
      // Unfavorite
      await db
        .delete(schema.videoFavorites)
        .where(and(
          eq(schema.videoFavorites.userId, userId),
          eq(schema.videoFavorites.videoId, videoId)
        ));
      return { favorited: false };
    } else {
      // Favorite
      await db.insert(schema.videoFavorites).values({ userId, videoId });
      return { favorited: true };
    }
  });
}

export async function isVideoFavorited(userId: string, videoId: string) {
  return withDb(async ({ db, schema, eq, and }) => {
    const [existing] = await db
      .select()
      .from(schema.videoFavorites)
      .where(and(
        eq(schema.videoFavorites.userId, userId),
        eq(schema.videoFavorites.videoId, videoId)
      ));
    return !!existing;
  });
}

export async function getUserFavorites(userId: string) {
  return withDb(async ({ db, schema, eq, desc }) => {
    const result = await db
      .select()
      .from(schema.videos)
      .innerJoin(schema.videoFavorites, eq(schema.videos.id, schema.videoFavorites.videoId))
      .leftJoin(schema.users, eq(schema.videos.creatorId, schema.users.id))
      .where(eq(schema.videoFavorites.userId, userId))
      .orderBy(desc(schema.videoFavorites.createdAt));
    
    return result.map(r => ({
      ...r.videos,
      creator: r.users,
    }));
  });
}

// ============ STATS ============

export async function getTodayStats() {
  return withDb(async ({ db, schema, eq, sql, gte }) => {
    const today = new Date().toISOString().split('T')[0];
    
    const stats = await db
      .select({
        totalViews: sql<number>`COALESCE(SUM(${schema.dailyStats.views}), 0)`,
        totalDemos: sql<number>`COUNT(DISTINCT ${schema.dailyStats.videoId})`,
        totalCreditsSpent: sql<number>`COALESCE(SUM(${schema.dailyStats.creditsSpent}), 0)`,
      })
      .from(schema.dailyStats)
      .where(eq(schema.dailyStats.date, today));

    const activeUsers = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${schema.users.id})`,
      })
      .from(schema.users)
      .where(gte(schema.users.createdAt, new Date(today)));

    return {
      totalViews: stats[0]?.totalViews || 0,
      demosSubmitted: stats[0]?.totalDemos || 0,
      creditsEarned: stats[0]?.totalCreditsSpent || 0,
      activeUsers: activeUsers[0]?.count || 0,
    };
  });
}

export async function incrementVideoView(videoId: string) {
  return withDb(async ({ db, schema, eq, sql }) => {
    const today = new Date().toISOString().split('T')[0];
    
    // Increment total views
    await db
      .update(schema.videos)
      .set({ totalViews: sql`${schema.videos.totalViews} + 1` })
      .where(eq(schema.videos.id, videoId));
    
    // Increment daily views
    await db
      .insert(schema.dailyStats)
      .values({ videoId, date: today, views: 1, creditsSpent: 0 })
      .onConflictDoUpdate({
        target: [schema.dailyStats.videoId, schema.dailyStats.date],
        set: { views: sql`${schema.dailyStats.views} + 1` },
      });
  });
}

// ============ CLEANUP ============

export async function deleteDemoData() {
  return withDb(async ({ db, schema, eq, like, or }) => {
    // Delete related data first (foreign keys)
    await db.delete(schema.videoTags).where(like(schema.videoTags.videoId, 'demo-video-%'));
    await db.delete(schema.dailyStats).where(like(schema.dailyStats.videoId, 'demo-video-%'));
    await db.delete(schema.videoFavorites).where(like(schema.videoFavorites.videoId, 'demo-video-%'));
    await db.delete(schema.videoViews).where(like(schema.videoViews.videoId, 'demo-video-%'));
    await db.delete(schema.videoViewingSessions).where(like(schema.videoViewingSessions.videoId, 'demo-video-%'));
    await db.delete(schema.demoLinkClicks).where(like(schema.demoLinkClicks.videoId, 'demo-video-%'));
    await db.delete(schema.creditTransactions).where(eq(schema.creditTransactions.userId, 'demo-user-1'));
    
    // Delete demo videos
    await db.delete(schema.videos).where(
      or(
        like(schema.videos.id, 'demo-video-%'),
        eq(schema.videos.creatorId, 'demo-user-1')
      )
    );
    
    // Delete demo user
    await db.delete(schema.users).where(eq(schema.users.id, 'demo-user-1'));
    
    return { success: true };
  });
}
