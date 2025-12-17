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
    await clerk.verifyToken(token);

    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    client = postgres(process.env.DATABASE_URL, {
      max: 1, idle_timeout: 20, connect_timeout: 10, ssl: 'require', prepare: false,
    });
    const db = drizzle(client);

    // Complete the session
    const sessionResult = await db.execute(sql`
      UPDATE video_viewing_sessions 
      SET completed_at = NOW()
      WHERE id = ${sessionId} AND completed_at IS NULL
      RETURNING id, started_at, completed_at
    `);

    if (!sessionResult.length) {
      return res.status(400).json({ error: 'Session not found or already completed' });
    }

    const session = sessionResult[0] as any;
    const watchDuration = session.completed_at && session.started_at 
      ? Math.floor((new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 1000) 
      : 0;

    return res.status(200).json({ 
      success: true,
      watchDuration,
      message: 'Session completed',
    });
  } catch (error: any) {
    console.error('Complete view error:', error);
    return res.status(500).json({ error: error.message || 'Failed to complete viewing session' });
  } finally {
    if (client) await client.end();
  }
}