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

    // Dynamic imports
    const postgres = (await import('postgres')).default;
    const { sql } = await import('drizzle-orm');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const { createClerkClient } = await import('@clerk/clerk-sdk-node');

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

    const { videoId, amount } = req.body;

    if (!videoId || !amount || amount < 10) {
      return res.status(400).json({ error: 'Invalid boost parameters (minimum 10 credits)' });
    }

    client = postgres(process.env.DATABASE_URL, {
      max: 1, idle_timeout: 20, connect_timeout: 10, ssl: 'require', prepare: false,
    });
    const db = drizzle(client);

    // Check user has enough credits
    const userResult = await db.execute(sql`SELECT credits FROM users WHERE id = ${userId}`);
    if (!userResult.length || (userResult[0] as any).credits < amount) {
      return res.status(400).json({ error: 'Insufficient credits' });
    }

    // Deduct credits
    await db.execute(sql`UPDATE users SET credits = credits - ${amount} WHERE id = ${userId}`);

    // Record transaction
    await db.execute(sql`
      INSERT INTO credit_transactions (user_id, type, amount, reason, video_id)
      VALUES (${userId}, 'spent', ${amount}, 'video_boost', ${videoId})
    `);

    return res.status(200).json({ success: true, message: 'Video boosted successfully' });
  } catch (error: any) {
    console.error('Boost error:', error);
    return res.status(500).json({ error: error.message || 'Failed to boost video' });
  } finally {
    if (client) await client.end();
  }
}