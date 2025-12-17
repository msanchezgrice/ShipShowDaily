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

    // Dynamic imports for Vercel serverless
    const postgres = (await import('postgres')).default;
    const { sql } = await import('drizzle-orm');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const { createClerkClient } = await import('@clerk/clerk-sdk-node');
    
    // Get video ID from URL
    const videoId = req.query.id as string;
    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    // Require authentication
    const token = req.headers.authorization?.toString().replace('Bearer ', '');
    if (!token || !process.env.CLERK_SECRET_KEY) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const payload = await clerk.verifyToken(token);
    if (!payload.sub) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const userId = payload.sub;

    client = postgres(process.env.DATABASE_URL, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: 'require',
      prepare: false,
    });
    const db = drizzle(client);

    // Check video exists
    const videoResult = await db.execute(sql`SELECT id, title FROM videos WHERE id = ${videoId}`);
    if (!videoResult.length) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Check if already favorited
    const existingFav = await db.execute(sql`
      SELECT id FROM video_favorites WHERE user_id = ${userId} AND video_id = ${videoId}
    `);

    let favorited: boolean;
    if (existingFav.length > 0) {
      // Remove favorite
      await db.execute(sql`DELETE FROM video_favorites WHERE user_id = ${userId} AND video_id = ${videoId}`);
      favorited = false;
    } else {
      // Add favorite
      await db.execute(sql`
        INSERT INTO video_favorites (user_id, video_id, created_at)
        VALUES (${userId}, ${videoId}, NOW())
      `);
      favorited = true;
    }

    return res.status(200).json({
      success: true,
      favorited,
      message: favorited ? 'Added to favorites' : 'Removed from favorites',
    });
  } catch (error: any) {
    console.error('Favorite error:', error);
    return res.status(500).json({ error: error.message || 'Failed to toggle favorite' });
  } finally {
    if (client) await client.end();
  }
}