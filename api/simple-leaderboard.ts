import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    
    res.status(200).json(result.rows || []);
  } catch (error: any) {
    console.error('Leaderboard error:', error);
    res.status(500).json({
      error: error.message || "Failed to fetch leaderboard",
      details: error.toString()
    });
  }
}
