import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
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
  
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ error: "DATABASE_URL not set" });
    }

    // Create a simple connection
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle({ client: pool });

    // Simple direct SQL query
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
        v.is_active as "isActive"
      FROM videos v
      LEFT JOIN users u ON v.creator_id = u.id
      WHERE v.is_active = true
      LIMIT 20
    `);
    
    // Transform the results to ensure creator object exists
    const videos = (result.rows || []).map((row: any) => ({
      id: row.id,
      title: row.title || '',
      description: row.description || '',
      productUrl: row.productUrl || '',
      videoPath: row.videoPath || '',
      thumbnailPath: row.thumbnailPath || null,
      totalViews: row.totalViews || 0,
      views: row.views || 0,
      creditsSpent: row.creditsSpent || 0,
      isActive: row.isActive || false,
      creator: {
        id: row.creatorId || '',
        name: row.creatorName || 'Anonymous',
        profileImageUrl: row.creatorImageUrl || null
      }
    }));
    
    return res.status(200).json(videos);
  } catch (error: any) {
    console.error('Leaderboard error:', error);
    return res.status(500).json({
      error: error.message || "Failed to fetch leaderboard",
      details: error.toString()
    });
  }
}