import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    // Dynamic imports only - no static imports at all
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const postgres = (await import('postgres')).default;
    const { eq } = await import('drizzle-orm');
    const { users } = await import('../shared/schema');
    
    if (!process.env.DATABASE_URL) {
      return res.status(200).json({ success: false, error: 'DATABASE_URL not set' });
    }
    
    const sql = postgres(process.env.DATABASE_URL, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: 'require',
      prepare: false,
    });
    
    const db = drizzle(sql);
    
    // Test a simple query
    const result = await db.select().from(users).limit(1);
    
    await sql.end();
    
    return res.status(200).json({
      success: true,
      userCount: result.length,
      firstUser: result[0] ? { id: result[0].id, email: result[0].email } : null
    });
    
  } catch (e: any) {
    return res.status(200).json({
      success: false,
      error: e.message,
      stack: e.stack?.split('\n').slice(0, 5).join('\n')
    });
  }
}
