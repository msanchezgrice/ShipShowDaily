import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { uid, title, description, productUrl } = req.body;
    
    if (!uid || !title) {
      return res.status(400).json({ error: 'uid and title are required' });
    }
    
    // Dynamic imports
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const postgres = (await import('postgres')).default;
    const { videos } = await import('../shared/schema.js');
    
    const client = postgres(process.env.DATABASE_URL!, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: 'require',
      prepare: false,
    });
    const db = drizzle(client);
    
    // Add video to database
    const [video] = await db
      .insert(videos)
      .values({
        title,
        description: description || '',
        productUrl: productUrl || 'https://example.com',
        videoPath: `https://customer-59frtv9ixcqe1nv6.cloudflarestream.com/${uid}/manifest/video.m3u8`,
        thumbnailPath: `https://customer-59frtv9ixcqe1nv6.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg?time=1s`,
        creatorId: 'manual-upload',
        provider: 'stream',
        provider_asset_id: uid,
        status: 'ready',
        isActive: true,
      })
      .returning();
    
    await client.end();
    
    return res.status(201).json({
      success: true,
      video,
      message: 'Video added to database successfully'
    });
    
  } catch (error: any) {
    console.error('Error adding video:', error);
    return res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
}