import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_ORIGINS = ['https://shipshow.io', 'https://www.shipshow.io', 'http://localhost:3000', 'http://localhost:5173'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string;
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  
  let client;
  
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ error: 'DATABASE_URL not set' });
    }

    const postgres = (await import('postgres')).default;
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const { sql } = await import('drizzle-orm');

    client = postgres(process.env.DATABASE_URL, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: 'require',
      prepare: false,
    });
    const db = drizzle(client);

    // Get total videos count
    const videosResult = await db.execute(sql`SELECT COUNT(*) as count FROM videos`);
    const totalVideos = parseInt(videosResult[0]?.count as string) || 0;

    // Get total users count
    const usersResult = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
    const totalUsers = parseInt(usersResult[0]?.count as string) || 0;

    // Get total views count
    const viewsResult = await db.execute(sql`SELECT COALESCE(SUM(view_count), 0) as count FROM video_views`);
    const totalViews = parseInt(viewsResult[0]?.count as string) || 0;

    // Get total credits earned (sum of all user credits + credits spent on boosts)
    const creditsResult = await db.execute(sql`SELECT COALESCE(SUM(credits), 0) as count FROM users`);
    const totalCredits = parseInt(creditsResult[0]?.count as string) || 0;

    // Format numbers for display
    const formatNumber = (num: number): string => {
      if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M+`;
      if (num >= 1000) return `${(num / 1000).toFixed(1)}K+`;
      return `${num}+`;
    };

    return res.status(200).json({
      totalVideos: formatNumber(totalVideos),
      totalUsers: formatNumber(totalUsers),
      totalViews: formatNumber(totalViews),
      totalCredits: formatNumber(totalCredits),
      raw: {
        videos: totalVideos,
        users: totalUsers,
        views: totalViews,
        credits: totalCredits,
      }
    });
  } catch (error: any) {
    console.error('Public stats error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch stats' });
  } finally {
    if (client) await client.end();
  }
}
