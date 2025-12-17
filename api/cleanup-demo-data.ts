import type { VercelRequest, VercelResponse } from '@vercel/node';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

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

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL not set' });
  }
  
  const client = postgres(process.env.DATABASE_URL, {
    max: 1,
    idle_timeout: 20,
    ssl: 'require',
    prepare: false,
  });

  try {
    const results: string[] = [];
    
    // Delete in order to respect foreign keys using raw SQL
    await client`DELETE FROM video_tags WHERE video_id LIKE 'demo-video-%'`;
    results.push('video_tags');
    
    await client`DELETE FROM daily_stats WHERE video_id LIKE 'demo-video-%'`;
    results.push('daily_stats');
    
    await client`DELETE FROM video_favorites WHERE video_id LIKE 'demo-video-%'`;
    results.push('video_favorites');
    
    await client`DELETE FROM video_views WHERE video_id LIKE 'demo-video-%'`;
    results.push('video_views');
    
    await client`DELETE FROM video_viewing_sessions WHERE video_id LIKE 'demo-video-%'`;
    results.push('video_viewing_sessions');
    
    await client`DELETE FROM demo_link_clicks WHERE video_id LIKE 'demo-video-%'`;
    results.push('demo_link_clicks');
    
    await client`DELETE FROM credit_transactions WHERE user_id = 'demo-user-1'`;
    results.push('credit_transactions');
    
    await client`DELETE FROM videos WHERE id LIKE 'demo-video-%' OR creator_id = 'demo-user-1'`;
    results.push('videos');
    
    await client`DELETE FROM users WHERE id = 'demo-user-1'`;
    results.push('demo user');
    
    await client.end();
    
    return res.status(200).json({
      success: true,
      message: 'Demo data cleanup completed',
      deleted: results
    });
  } catch (e: any) {
    await client.end();
    return res.status(500).json({
      error: e.message,
      detail: e.detail
    });
  }
}
