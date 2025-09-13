import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateMethod, handleError, sendSuccess } from './_lib/utils';
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

    // Create a simple connection
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle({ client: pool });

    // Get all tags with counts
    const result = await db.execute(sql`
      SELECT 
        t.id,
        t.name,
        COUNT(DISTINCT vt.video_id) as count
      FROM tags t
      LEFT JOIN video_tags vt ON t.id = vt.tag_id
      LEFT JOIN videos v ON vt.video_id = v.id AND v.is_active = true
      GROUP BY t.id, t.name
      HAVING COUNT(DISTINCT vt.video_id) > 0
      ORDER BY COUNT(DISTINCT vt.video_id) DESC
    `);
    
    return sendSuccess(res, result.rows || []);
  } catch (error) {
    return handleError(res, error, "Failed to fetch tags");
  }
}
