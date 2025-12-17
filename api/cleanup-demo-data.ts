import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, videos, users, videoTags, dailyStats, videoFavorites, videoViews, videoViewingSessions, demoLinkClicks, creditTransactions } from './_lib/db';
import { eq, like, or } from 'drizzle-orm';

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
    const errors: string[] = [];
    
    const safeDelete = async (fn: () => Promise<any>, description: string) => {
      try {
        await fn();
        results.push(description);
      } catch (e: any) {
        errors.push(`${description}: ${e.message}`);
      }
    };

    // Delete in order to respect foreign keys
    await safeDelete(() => db.delete(videoTags).where(like(videoTags.videoId, 'demo-video-%')), 'video_tags');
    await safeDelete(() => db.delete(dailyStats).where(like(dailyStats.videoId, 'demo-video-%')), 'daily_stats');
    await safeDelete(() => db.delete(videoFavorites).where(like(videoFavorites.videoId, 'demo-video-%')), 'video_favorites');
    await safeDelete(() => db.delete(videoViews).where(like(videoViews.videoId, 'demo-video-%')), 'video_views');
    await safeDelete(() => db.delete(videoViewingSessions).where(like(videoViewingSessions.videoId, 'demo-video-%')), 'video_viewing_sessions');
    await safeDelete(() => db.delete(demoLinkClicks).where(like(demoLinkClicks.videoId, 'demo-video-%')), 'demo_link_clicks');
    await safeDelete(() => db.delete(creditTransactions).where(eq(creditTransactions.userId, 'demo-user-1')), 'credit_transactions');
    await safeDelete(() => db.delete(videos).where(or(like(videos.id, 'demo-video-%'), eq(videos.creatorId, 'demo-user-1'))), 'videos');
    await safeDelete(() => db.delete(users).where(eq(users.id, 'demo-user-1')), 'demo user');
    
    return res.status(200).json({
      success: true,
      message: 'Demo data cleanup completed',
      deleted: results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (e: any) {
    return res.status(500).json({
      error: e.message,
      stack: e.stack
    });
  }
}
