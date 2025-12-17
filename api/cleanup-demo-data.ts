import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_lib/db';
import { sql } from 'drizzle-orm';

// DELETE endpoint to remove all demo/placeholder data
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed. Use DELETE.' });
  }

  // Require secret key for safety
  const authHeader = req.headers.authorization;
  const expectedKey = process.env.ADMIN_SECRET_KEY;
  
  if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
    return res.status(401).json({ error: 'Unauthorized. Set ADMIN_SECRET_KEY env var and pass as Bearer token.' });
  }
  
  try {
    const results: string[] = [];
    
    // Delete video_tags for demo videos
    const deletedVideoTags = await db.execute(sql`
      DELETE FROM video_tags 
      WHERE video_id LIKE 'demo-video-%'
    `);
    results.push(`Deleted video_tags for demo videos`);
    
    // Delete daily_stats for demo videos  
    const deletedStats = await db.execute(sql`
      DELETE FROM daily_stats 
      WHERE video_id LIKE 'demo-video-%'
    `);
    results.push(`Deleted daily_stats for demo videos`);
    
    // Delete video_favorites for demo videos
    const deletedFavorites = await db.execute(sql`
      DELETE FROM video_favorites 
      WHERE video_id LIKE 'demo-video-%'
    `);
    results.push(`Deleted video_favorites for demo videos`);
    
    // Delete video_views for demo videos
    const deletedViews = await db.execute(sql`
      DELETE FROM video_views 
      WHERE video_id LIKE 'demo-video-%'
    `);
    results.push(`Deleted video_views for demo videos`);
    
    // Delete video_viewing_sessions for demo videos
    const deletedSessions = await db.execute(sql`
      DELETE FROM video_viewing_sessions 
      WHERE video_id LIKE 'demo-video-%'
    `);
    results.push(`Deleted video_viewing_sessions for demo videos`);
    
    // Delete demo_link_clicks for demo videos
    const deletedClicks = await db.execute(sql`
      DELETE FROM demo_link_clicks 
      WHERE video_id LIKE 'demo-video-%'
    `);
    results.push(`Deleted demo_link_clicks for demo videos`);
    
    // Delete the demo videos themselves
    const deletedVideos = await db.execute(sql`
      DELETE FROM videos 
      WHERE id LIKE 'demo-video-%' OR creator_id = 'demo-user-1'
    `);
    results.push(`Deleted demo videos`);
    
    // Delete the demo user
    const deletedUsers = await db.execute(sql`
      DELETE FROM users 
      WHERE id = 'demo-user-1'
    `);
    results.push(`Deleted demo user`);
    
    // Clean up unused tags (tags with no videos)
    const deletedTags = await db.execute(sql`
      DELETE FROM tags 
      WHERE id NOT IN (SELECT DISTINCT tag_id FROM video_tags)
    `);
    results.push(`Cleaned up orphaned tags`);
    
    return res.status(200).json({
      success: true,
      message: 'Demo data cleaned up successfully',
      actions: results
    });
    
  } catch (error: any) {
    console.error('Cleanup error:', error);
    return res.status(500).json({
      error: error.message,
      detail: error.detail
    });
  }
}
