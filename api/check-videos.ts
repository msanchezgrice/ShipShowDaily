import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    // Dynamic imports for database
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const postgres = (await import('postgres')).default;
    const { sql } = await import('drizzle-orm');
    
    // Create database connection
    const client = postgres(process.env.DATABASE_URL!, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: 'require',
      prepare: false,
    });
    const db = drizzle(client);
    
    // Get all videos
    const videos = await db.execute(sql`
      SELECT id, title, creator_id, is_active, total_views, boost_amount, status, moderation_state
      FROM videos
      ORDER BY created_at DESC
    `);
    
    // Get demo videos specifically
    const demoVideos = await db.execute(sql`
      SELECT id, title, creator_id, is_active, total_views, boost_amount, status, moderation_state
      FROM videos
      WHERE creator_id = 'demo-user-1'
      ORDER BY created_at DESC
    `);
    
    await client.end();
    
    return res.status(200).json({
      success: true,
      totalVideos: videos.length,
      videos: videos,
      demoVideosCount: demoVideos.length,
      demoVideos: demoVideos
    });
    
  } catch (error: any) {
    console.error('Check videos error:', error);
    return res.status(500).json({
      error: error.message,
      detail: error.detail
    });
  }
}