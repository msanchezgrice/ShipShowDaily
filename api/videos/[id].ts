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

    // Get video ID from URL
    const { id } = req.query;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    // Dynamic imports for database
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const postgres = (await import('postgres')).default;
    const { videos, users } = await import('../../shared/schema.js');
    const { eq } = await import('drizzle-orm');
    
    // Create database connection
    const client = postgres(process.env.DATABASE_URL!, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: 'require',
      prepare: false,
    });
    const db = drizzle(client);

    // Fetch video details with creator info
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
        creatorName: users.firstName,
        creatorImageUrl: users.profileImageUrl,
      })
      .from(videos)
      .leftJoin(users, eq(videos.creatorId, users.id))
      .where(eq(videos.id, id));

    await client.end();

    if (result.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const video = result[0];
    
    // Only return active videos or videos still processing
    if (!video.isActive && video.status !== 'processing') {
      return res.status(404).json({ error: 'Video not available' });
    }

    return res.status(200).json(video);
  } catch (error: any) {
    console.error('Handler error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch video',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}