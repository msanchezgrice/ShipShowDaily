import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateMethod, handleError, sendSuccess, getQueryParamAsNumber } from '../_lib/utils';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Only allow GET requests
    if (!validateMethod(req, res, ['GET'])) {
      return;
    }

    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ error: "DATABASE_URL not set" });
    }

    const limit = getQueryParamAsNumber(req, 'limit', 3);

    // Create a simple connection
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle({ client: pool });

    // Get top videos by total views
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
      ORDER BY v.total_views DESC
      LIMIT ${limit}
    `);
    
    return sendSuccess(res, result.rows || []);
  } catch (error) {
    return handleError(res, error, "Failed to fetch top videos");
  }
}
