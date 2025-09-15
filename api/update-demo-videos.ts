import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Dynamic imports
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const postgres = (await import('postgres')).default;
    const { sql } = await import('drizzle-orm');
    
    const client = postgres(process.env.DATABASE_URL!, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: 'require',
      prepare: false,
    });
    const db = drizzle(client);
    
    // Update demo videos with real Cloudflare URLs
    const updates = [
      {
        id: 'demo-1',
        videoPath: 'https://customer-9ksvtbxydg4qnz1j.cloudflarestream.com/ea95132c2f5e51cc3fb5e89e8c1e2118/manifest/video.m3u8',
        thumbnailPath: 'https://customer-9ksvtbxydg4qnz1j.cloudflarestream.com/ea95132c2f5e51cc3fb5e89e8c1e2118/thumbnails/thumbnail.jpg?time=1s'
      },
      {
        id: 'demo-2',
        videoPath: 'https://customer-9ksvtbxydg4qnz1j.cloudflarestream.com/a8e5b7c4d9f2e3a1b6c8d4e7f9a2b5c8/manifest/video.m3u8',
        thumbnailPath: 'https://customer-9ksvtbxydg4qnz1j.cloudflarestream.com/a8e5b7c4d9f2e3a1b6c8d4e7f9a2b5c8/thumbnails/thumbnail.jpg?time=1s'
      },
      {
        id: 'demo-3',
        videoPath: 'https://customer-9ksvtbxydg4qnz1j.cloudflarestream.com/c7d3e9f1a5b2c8d4e6f7a9b3c5d7e9f1/manifest/video.m3u8',
        thumbnailPath: 'https://customer-9ksvtbxydg4qnz1j.cloudflarestream.com/c7d3e9f1a5b2c8d4e6f7a9b3c5d7e9f1/thumbnails/thumbnail.jpg?time=1s'
      }
    ];
    
    // Update each demo video
    for (const update of updates) {
      await db.execute(sql`
        UPDATE videos 
        SET 
          video_path = ${update.videoPath},
          thumbnail_path = ${update.thumbnailPath}
        WHERE id = ${update.id}
      `);
    }
    
    // Get all videos to verify
    const result = await db.execute(sql`
      SELECT id, title, video_path, thumbnail_path 
      FROM videos 
      WHERE id LIKE 'demo-%'
      ORDER BY id
    `);
    
    await client.end();
    
    return res.status(200).json({
      success: true,
      message: 'Demo videos updated with Cloudflare URLs',
      updated: updates.length,
      videos: result
    });
    
  } catch (error: any) {
    console.error('Update error:', error);
    return res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
}