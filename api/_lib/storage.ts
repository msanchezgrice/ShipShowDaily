import { db, videos, users, dailyStats, tags, videoTags, videoFavorites, demoLinkClicks } from "./db";
import { eq, desc, sql, and, gte } from "drizzle-orm";

export async function getTodayLeaderboard(limit = 10) {
  const today = new Date().toISOString().split('T')[0];
  
  const result = await db
    .select({
      id: videos.id,
      title: videos.title,
      description: videos.description,
      productUrl: videos.productUrl,
      videoPath: videos.videoPath,
      thumbnailPath: videos.thumbnailPath,
      creatorId: videos.creatorId,
      creatorName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email}, 'Anonymous')`,
      creatorImageUrl: users.profileImageUrl,
      views: sql<number>`COALESCE(${dailyStats.views}, 0)`,
      totalViews: videos.totalViews,
      creditsSpent: sql<number>`COALESCE(${dailyStats.creditsSpent}, 0)`,
      isActive: videos.isActive,
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
    .where(eq(videos.isActive, true))
    .orderBy(desc(sql`COALESCE(${dailyStats.views}, 0)`))
    .limit(limit);

  return result;
}

export async function getEnhancedLeaderboard(
  limit = 10, 
  sortBy: 'views' | 'favorites' | 'demo_clicks' = 'views',
  tagFilter?: string
) {
  const today = new Date().toISOString().split('T')[0];
  
  // Base query
  let query = db
    .select({
      id: videos.id,
      title: videos.title,
      description: videos.description,
      productUrl: videos.productUrl,
      videoPath: videos.videoPath,
      thumbnailPath: videos.thumbnailPath,
      creatorId: videos.creatorId,
      creatorName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email}, 'Anonymous')`,
      creatorImageUrl: users.profileImageUrl,
      views: sql<number>`COALESCE(${dailyStats.views}, 0)`,
      totalViews: videos.totalViews,
      creditsSpent: sql<number>`COALESCE(${dailyStats.creditsSpent}, 0)`,
      isActive: videos.isActive,
      favoriteCount: sql<number>`(SELECT COUNT(*) FROM ${videoFavorites} WHERE video_id = ${videos.id})`,
      demoClickCount: sql<number>`(SELECT COUNT(*) FROM ${demoLinkClicks} WHERE video_id = ${videos.id})`,
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
    .where(eq(videos.isActive, true))
    .$dynamic();

  // Add tag filter if specified
  if (tagFilter) {
    query = query.innerJoin(videoTags, eq(videos.id, videoTags.videoId))
      .innerJoin(tags, and(
        eq(videoTags.tagId, tags.id),
        eq(tags.name, tagFilter)
      ));
  }

  // Apply sorting
  const orderByClause = sortBy === 'favorites' 
    ? desc(sql`(SELECT COUNT(*) FROM ${videoFavorites} WHERE video_id = ${videos.id})`)
    : sortBy === 'demo_clicks'
    ? desc(sql`(SELECT COUNT(*) FROM ${demoLinkClicks} WHERE video_id = ${videos.id})`)
    : desc(sql`COALESCE(${dailyStats.views}, 0)`);

  const result = await query
    .orderBy(orderByClause)
    .limit(limit);

  return result;
}

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
    totalDemos: stats[0]?.totalDemos || 0,
    totalCreditsEarned: stats[0]?.totalCreditsSpent || 0,
    activeUsers: activeUsers[0]?.count || 0,
  };
}

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
