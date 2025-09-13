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

    // Get all tags (simplified - without counts for now)
    const result = await db.execute(sql`
      SELECT 
        id,
        name,
        1 as count
      FROM tags
      ORDER BY name
      LIMIT 50
    `);
    
    return sendSuccess(res, result.rows || []);
  } catch (error) {
    return handleError(res, error, "Failed to fetch tags");
  }
}
