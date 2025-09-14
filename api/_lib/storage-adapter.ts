import { db } from './db';
import { users, videos, dailyStats, tags, videoTags, videoFavorites } from '@shared/schema';
import { eq, desc, sql, and, gte } from 'drizzle-orm';

export async function getFeedVideos(params: {
  limit?: number;
  offset?: number;
  tagFilter?: string;
  userId?: string | null;
}) {
  const { limit = 10, offset = 0, tagFilter, userId } = params;
  const today = new Date().toISOString().split('T')[0];

  try {
    // Build base query
    let query = db
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
        todayViews: sql<number>`COALESCE(${dailyStats.views}, 0)`,
        totalViews: videos.totalViews,
        createdAt: videos.createdAt,
        isActive: videos.isActive,
        boostAmount: videos.boostAmount,
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
      .orderBy(desc(videos.boostAmount), desc(sql`COALESCE(${dailyStats.views}, 0)`))
      .limit(limit)
      .offset(offset);

    const result = await query;

    // Transform the result to match expected format
    return result.map(video => ({
      video: {
        id: video.id,
        title: video.title,
        description: video.description,
        productUrl: video.productUrl,
        videoPath: video.videoPath,
        thumbnailPath: video.thumbnailPath,
        creatorId: video.creatorId,
        totalViews: video.totalViews,
        createdAt: video.createdAt,
        isActive: video.isActive,
        boostAmount: video.boostAmount,
      },
      creator: {
        id: video.creatorId,
        name: video.creatorName,
        profileImageUrl: video.creatorImageUrl,
      },
      tags: [], // Tags would need a separate query
      todayViews: video.todayViews,
      totalViews: video.totalViews,
      isFavorited: false, // Would need a separate query if userId is provided
      boostAmount: video.boostAmount,
    }));
  } catch (error) {
    console.error('Feed query error:', error);
    // Return empty array on error
    return [];
  }
}

// Export storage object to match the interface used in api/feed.ts
export const storage = {
  getFeedVideos,
};
