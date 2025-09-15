import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Dynamic imports for database
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const postgres = (await import('postgres')).default;
    const { videos } = await import('../../shared/schema.js');
    const { eq, or, sql, isNull } = await import('drizzle-orm');
    
    // Create database connection
    const client = postgres(process.env.DATABASE_URL!, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: 'require',
      prepare: false,
    });
    const db = drizzle(client);

    // Find videos with NULL paths but have provider_asset_id
    const videosToFix = await db
      .select()
      .from(videos)
      .where(
        sql`(${videos.videoPath} IS NULL OR ${videos.videoPath} = '') AND ${videos.provider_asset_id} IS NOT NULL`
      );

    const updates = [];
    for (const video of videosToFix) {
      if (video.provider_asset_id) {
        const updated = await db
          .update(videos)
          .set({
            videoPath: `https://customer-59frtv9ixcqe1nv6.cloudflarestream.com/${video.provider_asset_id}/manifest/video.m3u8`,
            thumbnailPath: `https://customer-59frtv9ixcqe1nv6.cloudflarestream.com/${video.provider_asset_id}/thumbnails/thumbnail.jpg`,
          })
          .where(eq(videos.id, video.id))
          .returning();
        
        updates.push({
          id: video.id,
          title: video.title,
          provider_asset_id: video.provider_asset_id,
          videoPath: updated[0].videoPath,
        });
      }
    }

    await client.end();
    
    return res.status(200).json({
      success: true,
      message: `Fixed ${updates.length} videos`,
      totalFound: videosToFix.length,
      updates: updates
    });
    
  } catch (error: any) {
    console.error('Error fixing video paths:', error);
    return res.status(500).json({
      error: error.message,
      detail: error.stack
    });
  }
}