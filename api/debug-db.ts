import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Basic environment check
    const hasDatabase = !!process.env.DATABASE_URL;
    const dbUrl = process.env.DATABASE_URL;
    
    console.log('Database URL present:', hasDatabase);
    console.log('Database URL prefix:', dbUrl?.substring(0, 20) || 'none');
    
    if (!hasDatabase) {
      return res.status(500).json({ 
        error: 'DATABASE_URL not found',
        env: Object.keys(process.env).filter(k => k.includes('DATABASE'))
      });
    }

    // Try basic connection
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const postgres = (await import('postgres')).default;
    const { sql } = await import('drizzle-orm');
    
    const client = postgres(process.env.DATABASE_URL!, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: 'require',
    });
    const db = drizzle(client);
    
    console.log('Attempting database connection...');
    
    // Simple query
    const result = await db.execute(sql`SELECT NOW() as current_time`);
    
    console.log('Database query successful');
    
    await client.end();
    
    return res.status(200).json({
      success: true,
      timestamp: result.rows[0]?.current_time,
      message: 'Database connection working'
    });
    
  } catch (error: any) {
    console.error('Database test error:', error);
    return res.status(500).json({
      error: error.message,
      type: error.constructor.name,
      stack: error.stack?.split('\n')[0]
    });
  }
}
