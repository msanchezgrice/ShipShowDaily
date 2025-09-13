import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, sendUnauthorized } from '../_lib/auth';
import { validateMethod, handleError, sendSuccess } from '../_lib/utils';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Only allow GET requests
    if (!validateMethod(req, res, ['GET'])) {
      return;
    }

    // Require authentication
    const auth = await requireAuth(req);
    if (!auth) {
      return sendUnauthorized(res);
    }

    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ error: "DATABASE_URL not set" });
    }

    // Create a simple connection
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle({ client: pool });

    // Get user data from database
    const result = await db.execute(sql`
      SELECT 
        id,
        email,
        first_name as "firstName",
        last_name as "lastName",
        profile_image_url as "profileImageUrl",
        credits,
        total_credits_earned as "totalCreditsEarned",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM users
      WHERE id = ${auth.userId}
      LIMIT 1
    `);

    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return sendSuccess(res, user);
  } catch (error) {
    return handleError(res, error, "Failed to fetch user");
  }
}
