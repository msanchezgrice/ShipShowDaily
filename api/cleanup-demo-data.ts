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
  
  const results: string[] = [];
  const errors: string[] = [];
  
  const safeDelete = async (query: any, description: string) => {
    try {
      await db.execute(query);
      results.push(description);
    } catch (e: any) {
      errors.push(`${description}: ${e.message}`);
    }
  };

  // Delete in order to respect foreign keys
  await safeDelete(sql`DELETE FROM video_tags WHERE video_id LIKE 'demo-video-%'`, 'video_tags');
  await safeDelete(sql`DELETE FROM daily_stats WHERE video_id LIKE 'demo-video-%'`, 'daily_stats');
  await safeDelete(sql`DELETE FROM video_favorites WHERE video_id LIKE 'demo-video-%'`, 'video_favorites');
  await safeDelete(sql`DELETE FROM video_views WHERE video_id LIKE 'demo-video-%'`, 'video_views');
  await safeDelete(sql`DELETE FROM video_viewing_sessions WHERE video_id LIKE 'demo-video-%'`, 'video_viewing_sessions');
  await safeDelete(sql`DELETE FROM demo_link_clicks WHERE video_id LIKE 'demo-video-%'`, 'demo_link_clicks');
  await safeDelete(sql`DELETE FROM credit_transactions WHERE user_id = 'demo-user-1'`, 'credit_transactions');
  await safeDelete(sql`DELETE FROM videos WHERE id LIKE 'demo-video-%' OR creator_id = 'demo-user-1'`, 'videos');
  await safeDelete(sql`DELETE FROM users WHERE id = 'demo-user-1'`, 'demo user');
  
  return res.status(200).json({
    success: true,
    message: 'Demo data cleanup completed',
    deleted: results,
    errors: errors.length > 0 ? errors : undefined
  });
}
