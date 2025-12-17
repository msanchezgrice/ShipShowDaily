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
    if (!process.env.DATABASE_URL || !process.env.CLERK_SECRET_KEY) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Require authentication
    const token = req.headers.authorization?.toString().replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { createClerkClient } = await import('@clerk/clerk-sdk-node');
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const payload = await clerk.verifyToken(token);
    if (!payload.sub) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const userId = payload.sub;

    const postgres = (await import('postgres')).default;
    const { sql } = await import('drizzle-orm');
    const { drizzle } = await import('drizzle-orm/postgres-js');

    client = postgres(process.env.DATABASE_URL, {
      max: 1, idle_timeout: 20, connect_timeout: 10, ssl: 'require', prepare: false,
    });
    const db = drizzle(client);

    const { notificationIds, markAll } = req.body || {};

    if (markAll) {
      // Mark all notifications as read
      await db.execute(sql`
        UPDATE notifications SET is_read = true WHERE user_id = ${userId}
      `);
    } else if (notificationIds && Array.isArray(notificationIds) && notificationIds.length > 0) {
      // Mark specific notifications as read
      const idList = notificationIds.map((id: string) => `'${id}'`).join(',');
      await db.execute(sql.raw(`
        UPDATE notifications SET is_read = true 
        WHERE user_id = '${userId}' AND id IN (${idList})
      `));
    } else {
      return res.status(400).json({ error: 'Provide notificationIds array or markAll: true' });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Mark read error:', error);
    return res.status(500).json({ error: error.message || 'Failed to mark notifications as read' });
  } finally {
    if (client) await client.end();
  }
}
