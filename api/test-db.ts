import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db } from './_lib/db';
import { sql } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Test basic connection
    const timeResult = await db.execute(sql`SELECT NOW() as current_time`);
    
    // Check which tables exist
    const tablesResult = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    // Check if users table has any data
    const usersCount = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
    
    return res.status(200).json({
      success: true,
      timestamp: timeResult.rows[0]?.current_time,
      tables: tablesResult.rows.map(row => row.table_name),
      usersCount: parseInt(usersCount.rows[0]?.count || '0'),
      message: 'Database connection working'
    });
    
  } catch (error: any) {
    console.error('Database test error:', error);
    return res.status(500).json({
      error: error.message,
      type: error.constructor.name,
      detail: error.detail || error.stack?.split('\n')[0]
    });
  }
}