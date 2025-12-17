import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(200).json({ success: false, error: 'DATABASE_URL not set' });
    }

    // Dynamic imports for Vercel serverless
    const postgres = (await import('postgres')).default;
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const { sql } = await import('drizzle-orm');
    
    const client = postgres(process.env.DATABASE_URL, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: 'require',
      prepare: false,
    });
    
    const db = drizzle(client);
    
    // Test query
    const result = await db.execute(sql`
      SELECT COUNT(*) as count FROM videos WHERE is_active = true
    `);
    
    await client.end();
    
    return res.status(200).json({
      success: true,
      videoCount: result[0]?.count,
    });
    
  } catch (e: any) {
    return res.status(200).json({
      success: false,
      error: e.message,
      stack: e.stack?.split('\n').slice(0, 5).join('\n')
    });
  }
}
