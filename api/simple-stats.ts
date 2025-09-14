import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: `Method ${req.method} not allowed` });
  }
  
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ error: "DATABASE_URL not set" });
    }

    // Create a simple connection
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle({ client: pool });

    // Get video count
    const videoResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM videos WHERE is_active = true
    `);
    
    // Get user count
    const userResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM users
    `);
    
    // Return simple stats
    const stats = {
      totalViews: 0,
      totalDemos: parseInt(videoResult.rows[0]?.count as string || '0'),
      totalCreditsEarned: 0,
      activeUsers: parseInt(userResult.rows[0]?.count as string || '0')
    };
    
    return res.status(200).json(stats);
  } catch (error: any) {
    console.error('Stats error:', error);
    return res.status(500).json({
      error: error.message || "Failed to fetch stats",
      details: error.toString()
    });
  }
}