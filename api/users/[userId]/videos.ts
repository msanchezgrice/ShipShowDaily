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

    // Get user's videos with stats
    const videosResult = await db.execute(sql`
      SELECT 
        v.id, v.slug, v.title, v.description, v.product_url as "productUrl",
        v.video_path as "videoPath", v.thumbnail_path as "thumbnailPath",
        v.total_views as "totalViews", v.is_active as "isActive",
        v.created_at as "createdAt", v.status, v.provider, v.hls_url,
        COALESCE((SELECT COUNT(*) FROM video_favorites WHERE video_id = v.id), 0) as "favorites",
        COALESCE((SELECT COUNT(*) FROM demo_link_clicks WHERE video_id = v.id), 0) as "demoClicks",
        COALESCE((SELECT COUNT(*) FROM video_shares WHERE video_id = v.id), 0) as "shares"
      FROM videos v
      WHERE v.creator_id = ${userId} AND v.is_active = true
      ORDER BY v.created_at DESC
    `);

    // Get tags for all videos
    const videoIds = videosResult.map((v: any) => v.id);
    let tagsByVideo: Record<string, Array<{id: string, name: string}>> = {};
    
    if (videoIds.length > 0) {
      const videoIdList = videoIds.map((id: string) => `'${id}'`).join(',');
      const tagsResult = await db.execute(sql.raw(`
        SELECT vt.video_id as "videoId", t.id, t.name
        FROM video_tags vt
        JOIN tags t ON vt.tag_id = t.id
        WHERE vt.video_id IN (${videoIdList})
      `));
      
      for (const tag of tagsResult as any[]) {
        if (!tagsByVideo[tag.videoId]) {
          tagsByVideo[tag.videoId] = [];
        }
        tagsByVideo[tag.videoId].push({ id: tag.id, name: tag.name });
      }
    }

    const videos = videosResult.map((v: any) => ({
      id: v.id,
      slug: v.slug,
      title: v.title,
      description: v.description,
      productUrl: v.productUrl,
      videoPath: v.videoPath,
      thumbnailPath: v.thumbnailPath,
      totalViews: parseInt(v.totalViews) || 0,
      isActive: v.isActive,
      createdAt: v.createdAt,
      status: v.status,
      provider: v.provider,
      hls_url: v.hls_url,
      favorites: parseInt(v.favorites) || 0,
      demoClicks: parseInt(v.demoClicks) || 0,
      shares: parseInt(v.shares) || 0,
      tags: tagsByVideo[v.id] || [],
    }));

    return res.status(200).json(videos);
  } catch (error: any) {
    console.error('User videos error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch user videos' });
  } finally {
    if (client) await client.end();
  }
}
