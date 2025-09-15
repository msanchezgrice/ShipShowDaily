import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: `Method ${req.method} not allowed` });
  }
  
  let client;
  
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ error: "DATABASE_URL not set" });
    }

    // Get limit from query params
    const limitParam = req.query?.limit;
    const limit = limitParam ? parseInt(limitParam as string, 10) : 20;

    // Dynamic import of postgres
    const postgres = (await import('postgres')).default;
    const { sql } = await import('drizzle-orm');
    client = postgres(process.env.DATABASE_URL, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: 'require',
      prepare: false,
    });
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const db = drizzle(client);

    // Get all active videos ordered by total views (same as leaderboard)
    const result = await db.execute(sql`
      SELECT 
        v.id,
        v.title,
        v.description,
        v.product_url as "productUrl",
        v.video_path as "videoPath",
        v.thumbnail_path as "thumbnailPath",
        v.creator_id as "creatorId",
        COALESCE(u.email, 'Anonymous') as "creatorName",
        u.profile_image_url as "creatorImageUrl",
        COALESCE(v.total_views, 0) as "totalViews",
        0 as views,
        0 as "creditsSpent",
        v.is_active as "isActive",
        v.created_at as "createdAt"
      FROM videos v
      LEFT JOIN users u ON v.creator_id = u.id
      WHERE v.is_active = true
      ORDER BY v.total_views DESC, v.created_at DESC
      LIMIT ${limit}
    `);
    
    // Transform the results to match feed format
    const feedItems = (result || []).map((row: any) => ({
      video: {
        id: row.id,
        title: row.title || '',
        description: row.description || '',
        productUrl: row.productUrl || '',
        videoPath: row.videoPath || '',
        thumbnailPath: row.thumbnailPath || null,
        creatorId: row.creatorId,
        totalViews: row.totalViews || 0,
        isActive: row.isActive || false,
        createdAt: row.createdAt
      },
      creator: {
        id: row.creatorId || '',
        name: row.creatorName || 'Anonymous',
        profileImageUrl: row.creatorImageUrl || null
      },
      tags: [],
      todayViews: row.views || 0,
      totalViews: row.totalViews || 0,
      isFavorited: false,
      boostAmount: 0
    }));
    
    return res.status(200).json(feedItems);
  } catch (error: any) {
    console.error('Feed error:', error);
    return res.status(500).json({
      error: error.message || "Failed to fetch feed",
      details: error.toString()
    });
  } finally {
    // Close the connection
    if (client) {
      await client.end();
    }
  }
}