import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow admin access (you should add proper auth here)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Dynamic imports for database
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const postgres = (await import('postgres')).default;
    const { videos } = await import('../shared/schema.js');
    const { eq, or, sql } = await import('drizzle-orm');
    
    // Create database connection
    const client = postgres(process.env.DATABASE_URL!, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: 'require',
      prepare: false,
    });
    const db = drizzle(client);

    // Find videos with empty paths but have provider_asset_id
    const videosToFix = await db
      .select()
      .from(videos)
      .where(
        sql`${videos.videoPath} = '' AND ${videos.provider_asset_id} IS NOT NULL`
      );

    let fixed = 0;
    for (const video of videosToFix) {
      if (video.provider_asset_id) {
        await db
          .update(videos)
          .set({
            videoPath: `https://customer-59frtv9ixcqe1nv6.cloudflarestream.com/${video.provider_asset_id}/manifest/video.m3u8`,
            thumbnailPath: `https://customer-59frtv9ixcqe1nv6.cloudflarestream.com/${video.provider_asset_id}/thumbnails/thumbnail.jpg`,
          })
          .where(eq(videos.id, video.id));
        fixed++;
      }
    }

    await client.end();
    
    return res.status(200).json({
      success: true,
      message: `Fixed ${fixed} videos with empty paths`,
      totalFound: videosToFix.length
    });
    
  } catch (error: any) {
    console.error('Error fixing video paths:', error);
    return res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
}