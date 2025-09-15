import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
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
    
    // First, ensure we have the demo user
    const demoUser = await db.execute(sql`
      SELECT id FROM users WHERE id = 'demo-user-1' LIMIT 1
    `);
    
    if (!demoUser || demoUser.length === 0) {
      return res.status(400).json({ error: 'Demo user not found. Please create demo-user-1 first.' });
    }
    
    // Demo video data
    const demoVideos = [
      {
        id: 'demo-video-1',
        title: 'Revolutionary Project Management Tool',
        description: 'Streamline your workflow with our AI-powered project management solution. Features include real-time collaboration, automated task assignment, and predictive analytics.',
        productUrl: 'https://example.com/project-tool',
        videoPath: 'https://customer-9ksvtbxydg4qnz1j.cloudflarestream.com/ea95132c2f5e51cc3fb5e89e8c1e2118/manifest/video.m3u8',
        thumbnailPath: 'https://customer-9ksvtbxydg4qnz1j.cloudflarestream.com/ea95132c2f5e51cc3fb5e89e8c1e2118/thumbnails/thumbnail.jpg?time=1s',
        boostAmount: 50,
        views: 1250,
        provider: 'stream',
        status: 'ready',
        moderationState: 'approved',
        duration: 120,
        width: 1920,
        height: 1080
      },
      {
        id: 'demo-video-2',
        title: 'Smart Home Automation Platform',
        description: 'Control your entire home from one intuitive app. Works with all major smart devices, includes AI scheduling, and energy optimization features.',
        productUrl: 'https://example.com/smart-home',
        videoPath: 'https://customer-9ksvtbxydg4qnz1j.cloudflarestream.com/a8e5b7c4d9f2e3a1b6c8d4e7f9a2b5c8/manifest/video.m3u8',
        thumbnailPath: 'https://customer-9ksvtbxydg4qnz1j.cloudflarestream.com/a8e5b7c4d9f2e3a1b6c8d4e7f9a2b5c8/thumbnails/thumbnail.jpg?time=1s',
        boostAmount: 30,
        views: 890,
        provider: 'stream',
        status: 'ready',
        moderationState: 'approved',
        duration: 90,
        width: 1920,
        height: 1080
      },
      {
        id: 'demo-video-3',
        title: 'AI Content Generator Suite',
        description: 'Create stunning content in seconds with our AI-powered tools. Generate blog posts, social media content, and marketing copy that converts.',
        productUrl: 'https://example.com/ai-content',
        videoPath: 'https://customer-9ksvtbxydg4qnz1j.cloudflarestream.com/c7d3e9f1a5b2c8d4e6f7a9b3c5d7e9f1/manifest/video.m3u8',
        thumbnailPath: 'https://customer-9ksvtbxydg4qnz1j.cloudflarestream.com/c7d3e9f1a5b2c8d4e6f7a9b3c5d7e9f1/thumbnails/thumbnail.jpg?time=1s',
        boostAmount: 75,
        views: 2100,
        provider: 'stream',
        status: 'ready',
        moderationState: 'approved',
        duration: 150,
        width: 1920,
        height: 1080
      },
      {
        id: 'demo-video-4',
        title: 'Fitness Tracking Wearable',
        description: 'Track your health metrics 24/7 with our advanced wearable. Features heart rate monitoring, sleep analysis, and personalized workout recommendations.',
        productUrl: 'https://example.com/fitness-tracker',
        videoPath: 'https://customer-9ksvtbxydg4qnz1j.cloudflarestream.com/e5f7a9b3c1d5e7f9a2b4c6d8e1f3a5b7/manifest/video.m3u8',
        thumbnailPath: 'https://customer-9ksvtbxydg4qnz1j.cloudflarestream.com/e5f7a9b3c1d5e7f9a2b4c6d8e1f3a5b7/thumbnails/thumbnail.jpg?time=1s',
        boostAmount: 20,
        views: 650,
        provider: 'stream',
        status: 'ready',
        moderationState: 'approved',
        duration: 60,
        width: 1920,
        height: 1080
      },
      {
        id: 'demo-video-5',
        title: 'Cloud Storage Solution',
        description: 'Secure, fast, and reliable cloud storage for businesses. Features end-to-end encryption, automatic backups, and seamless collaboration tools.',
        productUrl: 'https://example.com/cloud-storage',
        videoPath: 'https://customer-9ksvtbxydg4qnz1j.cloudflarestream.com/b3c5d7e9f1a3b5c7d9e1f3a5b7c9d1e3/manifest/video.m3u8',
        thumbnailPath: 'https://customer-9ksvtbxydg4qnz1j.cloudflarestream.com/b3c5d7e9f1a3b5c7d9e1f3a5b7c9d1e3/thumbnails/thumbnail.jpg?time=1s',
        boostAmount: 40,
        views: 1500,
        provider: 'stream',
        status: 'ready',
        moderationState: 'approved',
        duration: 180,
        width: 1920,
        height: 1080
      }
    ];
    
    // Insert demo videos
    for (const video of demoVideos) {
      await db.execute(sql`
        INSERT INTO videos (
          id, title, description, product_url, video_path, thumbnail_path,
          creator_id, total_views, is_active, provider, provider_asset_id,
          hls_url, dash_url, status, moderation_state, duration_s, 
          width, height, boost_amount
        ) VALUES (
          ${video.id}, ${video.title}, ${video.description}, ${video.productUrl},
          ${video.videoPath}, ${video.thumbnailPath}, 'demo-user-1', ${video.views},
          true, ${video.provider}, ${video.id}, ${video.videoPath}, ${video.videoPath},
          ${video.status}, ${video.moderationState}, ${video.duration},
          ${video.width}, ${video.height}, ${video.boostAmount}
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          total_views = EXCLUDED.total_views,
          boost_amount = EXCLUDED.boost_amount,
          updated_at = NOW()
      `);
      
      // Add some daily stats for the videos
      const today = new Date().toISOString().split('T')[0];
      await db.execute(sql`
        INSERT INTO daily_stats (video_id, date, views, credits_spent)
        VALUES (${video.id}, ${today}, ${Math.floor(video.views * 0.3)}, ${video.boostAmount})
        ON CONFLICT (video_id, date) DO UPDATE SET
          views = EXCLUDED.views,
          credits_spent = EXCLUDED.credits_spent
      `);
    }
    
    // Add some demo tags
    const tags = ['AI', 'Productivity', 'SaaS', 'Developer Tools', 'Health', 'Smart Home'];
    for (const tagName of tags) {
      await db.execute(sql`
        INSERT INTO tags (name) VALUES (${tagName})
        ON CONFLICT (name) DO NOTHING
      `);
    }
    
    // Link videos to tags
    const videoTags = [
      { videoId: 'demo-video-1', tags: ['Productivity', 'SaaS', 'AI'] },
      { videoId: 'demo-video-2', tags: ['Smart Home', 'AI'] },
      { videoId: 'demo-video-3', tags: ['AI', 'Developer Tools', 'SaaS'] },
      { videoId: 'demo-video-4', tags: ['Health'] },
      { videoId: 'demo-video-5', tags: ['SaaS', 'Developer Tools'] }
    ];
    
    for (const vt of videoTags) {
      for (const tagName of vt.tags) {
        const tagResult = await db.execute(sql`
          SELECT id FROM tags WHERE name = ${tagName} LIMIT 1
        `);
        
        if (tagResult && tagResult.length > 0) {
          await db.execute(sql`
            INSERT INTO video_tags (video_id, tag_id)
            VALUES (${vt.videoId}, ${tagResult[0].id})
            ON CONFLICT (video_id, tag_id) DO NOTHING
          `);
        }
      }
    }
    
    await client.end();
    
    return res.status(200).json({
      success: true,
      message: 'Demo data seeded successfully',
      videosCreated: demoVideos.length
    });
    
  } catch (error: any) {
    console.error('Seed demo data error:', error);
    return res.status(500).json({
      error: error.message,
      detail: error.detail
    });
  }
}