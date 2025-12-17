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

    const postgres = (await import('postgres')).default;
    const { sql } = await import('drizzle-orm');
    const { drizzle } = await import('drizzle-orm/postgres-js');

    const idOrSlug = req.query.id as string;
    if (!idOrSlug) {
      return res.status(400).json({ error: 'Video ID or slug is required' });
    }

    // Check if it's a UUID or slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    client = postgres(process.env.DATABASE_URL, {
      max: 1, idle_timeout: 20, connect_timeout: 10, ssl: 'require', prepare: false,
    });
    const db = drizzle(client);

    // Get video with creator info (lookup by id or slug)
    const videoResult = await db.execute(sql`
      SELECT 
        v.id, v.slug, v.title, v.description, v.product_url as "productUrl",
        v.video_path as "videoPath", v.thumbnail_path as "thumbnailPath",
        v.creator_id as "creatorId", v.total_views as "totalViews",
        v.is_active as "isActive", v.created_at as "createdAt",
        v.provider, v.hls_url, v.duration_s, v.width, v.height,
        u.id as "creator_id", u.email as "creator_email",
        u.first_name as "creator_firstName", u.last_name as "creator_lastName",
        u.profile_image_url as "creator_profileImageUrl"
      FROM videos v
      LEFT JOIN users u ON v.creator_id = u.id
      WHERE (v.id = ${idOrSlug} OR v.slug = ${idOrSlug})
        AND v.is_active = true
    `);

    if (!videoResult.length) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const row = videoResult[0] as any;
    const videoId = row.id; // Use actual video ID for subsequent queries

    // Get stats
    const statsResult = await db.execute(sql`
      SELECT 
        COALESCE((SELECT COUNT(*) FROM video_favorites WHERE video_id = ${videoId}), 0) as favorites,
        COALESCE((SELECT COUNT(*) FROM demo_link_clicks WHERE video_id = ${videoId}), 0) as "demoClicks",
        COALESCE((SELECT COUNT(*) FROM video_shares WHERE video_id = ${videoId}), 0) as shares
    `);

    // Get tags
    const tagsResult = await db.execute(sql`
      SELECT t.id, t.name
      FROM tags t
      INNER JOIN video_tags vt ON t.id = vt.tag_id
      WHERE vt.video_id = ${videoId}
    `);

    // Check if user has favorited (if authenticated)
    let isFavorited = false;
    const token = req.headers.authorization?.toString().replace('Bearer ', '');
    if (token && process.env.CLERK_SECRET_KEY) {
      try {
        const { createClerkClient } = await import('@clerk/clerk-sdk-node');
        const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
        const payload = await clerk.verifyToken(token);
        if (payload.sub) {
          const favResult = await db.execute(sql`
            SELECT 1 FROM video_favorites WHERE user_id = ${payload.sub} AND video_id = ${videoId}
          `);
          isFavorited = favResult.length > 0;
        }
      } catch {
        // Not authenticated or token invalid
      }
    }

    const stats = statsResult[0] as any;

    return res.status(200).json({
      video: {
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        productUrl: row.productUrl,
        videoPath: row.videoPath,
        thumbnailPath: row.thumbnailPath,
        creatorId: row.creatorId,
        totalViews: parseInt(row.totalViews) || 0,
        isActive: row.isActive,
        createdAt: row.createdAt,
        provider: row.provider,
        hls_url: row.hls_url,
        duration_s: row.duration_s,
        width: row.width,
        height: row.height,
      },
      creator: {
        id: row.creator_id,
        email: row.creator_email,
        firstName: row.creator_firstName,
        lastName: row.creator_lastName,
        profileImageUrl: row.creator_profileImageUrl,
      },
      stats: {
        totalViews: parseInt(row.totalViews) || 0,
        favorites: parseInt(stats.favorites) || 0,
        demoClicks: parseInt(stats.demoClicks) || 0,
        shares: parseInt(stats.shares) || 0,
      },
      tags: tagsResult || [],
      isFavorited,
    });
  } catch (error: any) {
    console.error('Video details error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch video details' });
  } finally {
    if (client) await client.end();
  }
}
