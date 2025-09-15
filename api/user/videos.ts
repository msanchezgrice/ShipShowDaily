import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Only allow GET requests
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Check authentication
    const token = req.headers.authorization?.toString().replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify token with Clerk
    const { createClerkClient } = await import('@clerk/clerk-sdk-node');
    const clerk = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
    
    let userId: string;
    try {
      const payload = await clerk.verifyToken(token);
      userId = payload.sub;
      if (!userId) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Dynamic imports for database
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const postgres = (await import('postgres')).default;
    const { videos, dailyStats } = await import('../../shared/schema.js');
    const { eq, and, sql } = await import('drizzle-orm');
    
    // Create database connection
    const client = postgres(process.env.DATABASE_URL!, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: 'require',
      prepare: false,
    });
    const db = drizzle(client);

    // Get today's date for stats
    const today = new Date().toISOString().split('T')[0];

    // Fetch user's videos with today's stats
    const result = await db
      .select({
        id: videos.id,
        title: videos.title,
        description: videos.description,
        productUrl: videos.productUrl,
        videoPath: videos.videoPath,
        thumbnailPath: videos.thumbnailPath,
        creatorId: videos.creatorId,
        totalViews: videos.totalViews,
        createdAt: videos.createdAt,
        isActive: videos.isActive,
        status: videos.status,
        boostAmount: videos.boostAmount,
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
      .orderBy(videos.createdAt);

    await client.end();

    // Transform the result to match expected format
    const userVideos = (result || []).map(video => ({
      ...video,
      todayViews: Number(video.todayViews) || 0,
    }));

    return res.status(200).json(userVideos);
  } catch (error: any) {
    console.error('Handler error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch user videos',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}