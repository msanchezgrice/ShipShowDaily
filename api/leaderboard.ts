import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_ORIGINS = ['https://shipshow.io', 'https://www.shipshow.io', 'http://localhost:3000', 'http://localhost:5173'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string;
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
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
    
    const limitParam = req.query?.limit;
    const limit = Math.min(limitParam ? parseInt(limitParam as string, 10) : 10, 50);
    
    client = postgres(process.env.DATABASE_URL, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: 'require',
      prepare: false,
    });
    const db = drizzle(client);

    // Leaderboard query - all active videos sorted by boost, then views, then newest
    const result = await db.execute(sql`
      SELECT 
        v.id, v.title, v.description,
        v.product_url as "productUrl",
        v.video_path as "videoPath",
        v.thumbnail_path as "thumbnailPath",
        v.creator_id as "creatorId",
        u.first_name as "creatorFirstName",
        u.last_name as "creatorLastName",
        u.profile_image_url as "creatorImageUrl",
        COALESCE(v.total_views, 0) as "totalViews",
        COALESCE((SELECT SUM(ct.amount) FROM credit_transactions ct WHERE ct.video_id = v.id AND ct.type = 'spent'), 0) as "boostAmount",
        COALESCE((SELECT COUNT(*) FROM video_favorites vf WHERE vf.video_id = v.id), 0) as "favorites",
        COALESCE((SELECT COUNT(*) FROM demo_link_clicks dlc WHERE dlc.video_id = v.id), 0) as "demoClicks",
        v.is_active as "isActive"
      FROM videos v
      LEFT JOIN users u ON v.creator_id = u.id
      WHERE v.is_active = true
      ORDER BY "boostAmount" DESC, "totalViews" DESC, v.created_at DESC
      LIMIT ${limit}
    `);
    
    // Fetch tags for all videos
    const videoIds = result.map((r: any) => r.id);
    let tagsByVideo: Record<string, Array<{id: string, name: string}>> = {};
    
    if (videoIds.length > 0) {
      // Use IN clause with properly formatted UUIDs
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
    
    const leaderboard = (result || []).map((row: any) => ({
      id: row.id,
      title: row.title || '',
      description: row.description || '',
      productUrl: row.productUrl || '',
      videoPath: row.videoPath || '',
      thumbnailPath: row.thumbnailPath || null,
      totalViews: parseInt(row.totalViews) || 0,
      views: parseInt(row.totalViews) || 0,
      favorites: parseInt(row.favorites) || 0,
      demoClicks: parseInt(row.demoClicks) || 0,
      creditsSpent: parseInt(row.boostAmount) || 0,
      isActive: row.isActive || false,
      tags: tagsByVideo[row.id] || [],
      creator: {
        id: row.creatorId || '',
        firstName: row.creatorFirstName || null,
        lastName: row.creatorLastName || null,
        profileImageUrl: row.creatorImageUrl || null,
      },
    }));
    
    return res.status(200).json(leaderboard);
  } catch (error: any) {
    console.error('Leaderboard error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch leaderboard' });
  } finally {
    if (client) await client.end();
  }
}