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

    // Get overall stats
    const statsResult = await db.execute(sql`
      SELECT 
        COALESCE(SUM(v.total_views), 0) as "totalViews",
        COUNT(v.id) as "totalVideos",
        COALESCE((
          SELECT COUNT(*) FROM video_favorites vf 
          INNER JOIN videos v2 ON vf.video_id = v2.id 
          WHERE v2.creator_id = ${userId} AND v2.is_active = true
        ), 0) as "totalFavorites",
        COALESCE((
          SELECT COUNT(*) FROM demo_link_clicks dlc 
          INNER JOIN videos v3 ON dlc.video_id = v3.id 
          WHERE v3.creator_id = ${userId} AND v3.is_active = true
        ), 0) as "totalDemoClicks",
        COALESCE((
          SELECT COUNT(*) FROM video_shares vs 
          INNER JOIN videos v4 ON vs.video_id = v4.id 
          WHERE v4.creator_id = ${userId} AND v4.is_active = true
        ), 0) as "totalShares"
      FROM videos v
      WHERE v.creator_id = ${userId} AND v.is_active = true
    `);

    // Get views by day (last 7 days)
    const viewsByDayResult = await db.execute(sql`
      SELECT 
        DATE(vvs.watched_at) as date,
        COUNT(*) as views
      FROM video_viewing_sessions vvs
      INNER JOIN videos v ON vvs.video_id = v.id
      WHERE v.creator_id = ${userId} 
        AND v.is_active = true
        AND vvs.watched_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(vvs.watched_at)
      ORDER BY date ASC
    `);

    // Get top performing videos
    const topVideosResult = await db.execute(sql`
      SELECT 
        v.id, v.slug, v.title, v.thumbnail_path as "thumbnailPath",
        v.total_views as "totalViews",
        COALESCE((SELECT COUNT(*) FROM video_favorites WHERE video_id = v.id), 0) as favorites,
        COALESCE((SELECT COUNT(*) FROM demo_link_clicks WHERE video_id = v.id), 0) as "demoClicks"
      FROM videos v
      WHERE v.creator_id = ${userId} AND v.is_active = true
      ORDER BY v.total_views DESC
      LIMIT 5
    `);

    // Get recent activity
    const recentActivityResult = await db.execute(sql`
      (
        SELECT 'favorite' as type, vf.created_at as "createdAt", v.title as "videoTitle", v.id as "videoId"
        FROM video_favorites vf
        INNER JOIN videos v ON vf.video_id = v.id
        WHERE v.creator_id = ${userId} AND v.is_active = true
        ORDER BY vf.created_at DESC
        LIMIT 5
      )
      UNION ALL
      (
        SELECT 'share' as type, vs.created_at as "createdAt", v.title as "videoTitle", v.id as "videoId"
        FROM video_shares vs
        INNER JOIN videos v ON vs.video_id = v.id
        WHERE v.creator_id = ${userId} AND v.is_active = true
        ORDER BY vs.created_at DESC
        LIMIT 5
      )
      UNION ALL
      (
        SELECT 'demo_click' as type, dlc.clicked_at as "createdAt", v.title as "videoTitle", v.id as "videoId"
        FROM demo_link_clicks dlc
        INNER JOIN videos v ON dlc.video_id = v.id
        WHERE v.creator_id = ${userId} AND v.is_active = true
        ORDER BY dlc.clicked_at DESC
        LIMIT 5
      )
      ORDER BY "createdAt" DESC
      LIMIT 10
    `);

    const stats = statsResult[0] as any;

    return res.status(200).json({
      overview: {
        totalViews: parseInt(stats.totalViews) || 0,
        totalVideos: parseInt(stats.totalVideos) || 0,
        totalFavorites: parseInt(stats.totalFavorites) || 0,
        totalDemoClicks: parseInt(stats.totalDemoClicks) || 0,
        totalShares: parseInt(stats.totalShares) || 0,
      },
      viewsByDay: viewsByDayResult.map((r: any) => ({
        date: r.date,
        views: parseInt(r.views) || 0,
      })),
      topVideos: topVideosResult.map((v: any) => ({
        id: v.id,
        slug: v.slug,
        title: v.title,
        thumbnailPath: v.thumbnailPath,
        totalViews: parseInt(v.totalViews) || 0,
        favorites: parseInt(v.favorites) || 0,
        demoClicks: parseInt(v.demoClicks) || 0,
      })),
      recentActivity: recentActivityResult.map((a: any) => ({
        type: a.type,
        createdAt: a.createdAt,
        videoTitle: a.videoTitle,
        videoId: a.videoId,
      })),
    });
  } catch (error: any) {
    console.error('Analytics error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch analytics' });
  } finally {
    if (client) await client.end();
  }
}
