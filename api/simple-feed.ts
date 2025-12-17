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

    // Dynamic imports for Vercel serverless
    const postgres = (await import('postgres')).default;
    const { sql } = await import('drizzle-orm');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    
    // Try to get user ID from auth token (optional)
    let userId: string | null = null;
    const token = req.headers.authorization?.toString().replace('Bearer ', '');
    if (token && process.env.CLERK_SECRET_KEY) {
      try {
        const { createClerkClient } = await import('@clerk/clerk-sdk-node');
        const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
        const payload = await clerk.verifyToken(token);
        userId = payload.sub || null;
      } catch {
        // Ignore auth errors - feed works without auth
      }
    }

    const limitParam = req.query?.limit;
    const limit = Math.min(limitParam ? parseInt(limitParam as string, 10) : 20, 100);

    client = postgres(process.env.DATABASE_URL, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: 'require',
      prepare: false,
    });
    const db = drizzle(client);

    // Query videos with favorite status if user is logged in
    const result = await db.execute(sql`
      SELECT 
        v.id, v.title, v.description,
        v.product_url as "productUrl",
        v.video_path as "videoPath",
        v.thumbnail_path as "thumbnailPath",
        v.creator_id as "creatorId",
        COALESCE(u.email, 'Anonymous') as "creatorName",
        u.first_name as "creatorFirstName",
        u.last_name as "creatorLastName",
        u.profile_image_url as "creatorImageUrl",
        COALESCE(v.total_views, 0) as "totalViews",
        v.hls_url as "hlsUrl",
        v.provider, v.status,
        v.is_active as "isActive",
        v.created_at as "createdAt",
        ${userId ? sql`EXISTS(SELECT 1 FROM video_favorites vf WHERE vf.video_id = v.id AND vf.user_id = ${userId})` : sql`false`} as "isFavorited"
      FROM videos v
      LEFT JOIN users u ON v.creator_id = u.id
      WHERE v.is_active = true
      ORDER BY v.total_views DESC, v.created_at DESC
      LIMIT ${limit}
    `);
    
    const feedItems = (result || []).map((row: any) => ({
      video: {
        id: row.id,
        title: row.title || '',
        description: row.description || '',
        productUrl: row.productUrl || '',
        videoPath: row.videoPath || row.hlsUrl || '',
        thumbnailPath: row.thumbnailPath || null,
        creatorId: row.creatorId,
        totalViews: row.totalViews || 0,
        isActive: row.isActive || false,
        createdAt: row.createdAt,
        provider: row.provider,
        status: row.status,
        hls_url: row.hlsUrl,
      },
      creator: {
        id: row.creatorId || '',
        firstName: row.creatorFirstName,
        lastName: row.creatorLastName,
        email: row.creatorName,
        profileImageUrl: row.creatorImageUrl || null,
      },
      tags: [],
      todayViews: 0,
      totalViews: row.totalViews || 0,
      isFavorited: row.isFavorited === true || row.isFavorited === 't',
      boostAmount: 0,
    }));
    
    return res.status(200).json(feedItems);
  } catch (error: any) {
    console.error('Feed error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch feed' });
  } finally {
    if (client) await client.end();
  }
}