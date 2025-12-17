import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_ORIGINS = ['https://shipshow.io', 'https://www.shipshow.io', 'http://localhost:3000', 'http://localhost:5173'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string;
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  let client;

  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ error: 'DATABASE_URL not set' });
    }

    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const postgres = (await import('postgres')).default;
    const { sql } = await import('drizzle-orm');
    const { drizzle } = await import('drizzle-orm/postgres-js');

    client = postgres(process.env.DATABASE_URL, {
      max: 1, idle_timeout: 20, connect_timeout: 10, ssl: 'require', prepare: false,
    });
    const db = drizzle(client);

    // Get user profile with aggregated stats
    const userResult = await db.execute(sql`
      SELECT 
        u.id, u.email, u.first_name as "firstName", u.last_name as "lastName",
        u.profile_image_url as "profileImageUrl", u.credits,
        u.total_credits_earned as "totalCreditsEarned", u.created_at as "createdAt",
        COALESCE((SELECT COUNT(*) FROM videos WHERE creator_id = u.id AND is_active = true), 0) as "videoCount",
        COALESCE((SELECT SUM(total_views) FROM videos WHERE creator_id = u.id AND is_active = true), 0) as "totalViews",
        COALESCE((SELECT COUNT(*) FROM video_favorites vf 
          INNER JOIN videos v ON vf.video_id = v.id 
          WHERE v.creator_id = u.id AND v.is_active = true), 0) as "totalFavorites"
      FROM users u
      WHERE u.id = ${userId}
    `);

    if (!userResult.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult[0] as any;

    return res.status(200).json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      credits: parseInt(user.credits) || 0,
      totalCreditsEarned: parseInt(user.totalCreditsEarned) || 0,
      createdAt: user.createdAt,
      stats: {
        videoCount: parseInt(user.videoCount) || 0,
        totalViews: parseInt(user.totalViews) || 0,
        totalFavorites: parseInt(user.totalFavorites) || 0,
      }
    });
  } catch (error: any) {
    console.error('User profile error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch user profile' });
  } finally {
    if (client) await client.end();
  }
}
