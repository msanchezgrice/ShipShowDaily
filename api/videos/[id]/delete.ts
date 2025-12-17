import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_ORIGINS = ['https://shipshow.io', 'https://www.shipshow.io', 'http://localhost:3000', 'http://localhost:5173'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string;
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  let client;

  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ error: 'DATABASE_URL not set' });
    }

    // Require authentication
    const token = req.headers.authorization?.toString().replace('Bearer ', '');
    if (!token || !process.env.CLERK_SECRET_KEY) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { createClerkClient } = await import('@clerk/clerk-sdk-node');
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const payload = await clerk.verifyToken(token);
    if (!payload.sub) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const userId = payload.sub;

    const videoId = req.query.id as string;
    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    const postgres = (await import('postgres')).default;
    const { sql } = await import('drizzle-orm');
    const { drizzle } = await import('drizzle-orm/postgres-js');

    client = postgres(process.env.DATABASE_URL, {
      max: 1, idle_timeout: 20, connect_timeout: 10, ssl: 'require', prepare: false,
    });
    const db = drizzle(client);

    // Verify video belongs to user
    const videoResult = await db.execute(sql`
      SELECT id, creator_id as "creatorId", provider_asset_id as "providerAssetId"
      FROM videos WHERE id = ${videoId}
    `);

    if (!videoResult.length) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const video = videoResult[0] as any;
    if (video.creatorId !== userId) {
      return res.status(403).json({ error: 'You can only delete your own videos' });
    }

    // Delete related records first (foreign key constraints)
    await db.execute(sql`DELETE FROM video_tags WHERE video_id = ${videoId}`);
    await db.execute(sql`DELETE FROM video_favorites WHERE video_id = ${videoId}`);
    await db.execute(sql`DELETE FROM video_shares WHERE video_id = ${videoId}`);
    await db.execute(sql`DELETE FROM demo_link_clicks WHERE video_id = ${videoId}`);
    await db.execute(sql`DELETE FROM video_viewing_sessions WHERE video_id = ${videoId}`);
    await db.execute(sql`DELETE FROM video_views WHERE video_id = ${videoId}`);
    await db.execute(sql`DELETE FROM daily_stats WHERE video_id = ${videoId}`);
    await db.execute(sql`DELETE FROM credit_transactions WHERE video_id = ${videoId}`);

    // Delete the video
    await db.execute(sql`DELETE FROM videos WHERE id = ${videoId}`);

    // If it's a Cloudflare Stream video, delete from Stream too
    if (video.providerAssetId && process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_STREAM_API_TOKEN) {
      try {
        await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/stream/${video.providerAssetId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${process.env.CLOUDFLARE_STREAM_API_TOKEN}`,
            },
          }
        );
        console.log('[DELETE] Deleted from Cloudflare Stream:', video.providerAssetId);
      } catch (cfError) {
        console.error('[DELETE] Failed to delete from Cloudflare Stream:', cfError);
        // Continue anyway - video is deleted from DB
      }
    }

    console.log('[DELETE] Video deleted:', videoId);
    return res.status(200).json({ success: true, message: 'Video deleted successfully' });
  } catch (error: any) {
    console.error('[DELETE] Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete video' });
  } finally {
    if (client) await client.end();
  }
}
