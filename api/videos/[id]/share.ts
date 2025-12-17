import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_ORIGINS = ['https://shipshow.io', 'https://www.shipshow.io', 'http://localhost:3000', 'http://localhost:5173'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string;
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let client;

  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ error: 'DATABASE_URL not set' });
    }

    const postgres = (await import('postgres')).default;
    const { sql } = await import('drizzle-orm');
    const { drizzle } = await import('drizzle-orm/postgres-js');

    const videoId = req.query.id as string;
    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const platform = body?.platform || 'unknown';

    client = postgres(process.env.DATABASE_URL, {
      max: 1, idle_timeout: 20, connect_timeout: 10, ssl: 'require', prepare: false,
    });
    const db = drizzle(client);

    // Check video exists
    const videoResult = await db.execute(sql`SELECT id FROM videos WHERE id = ${videoId}`);
    if (!videoResult.length) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Try to get user ID if authenticated (optional)
    let userId: string | null = null;
    const token = req.headers.authorization?.toString().replace('Bearer ', '');
    if (token && process.env.CLERK_SECRET_KEY) {
      try {
        const { createClerkClient } = await import('@clerk/clerk-sdk-node');
        const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
        const payload = await clerk.verifyToken(token);
        userId = payload.sub || null;
      } catch {
        // Token invalid - continue as anonymous
      }
    }

    // Record share event
    await db.execute(sql`
      INSERT INTO video_shares (video_id, user_id, platform, shared_at)
      VALUES (${videoId}, ${userId}, ${platform}, NOW())
    `);

    return res.status(200).json({
      success: true,
      message: 'Share recorded',
    });
  } catch (error: any) {
    console.error('Share tracking error:', error);
    return res.status(500).json({ error: error.message || 'Failed to record share' });
  } finally {
    if (client) await client.end();
  }
}
