import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const postgres = (await import('postgres')).default;
    const { sql } = await import('drizzle-orm');
    
    const client = postgres(process.env.DATABASE_URL!, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: 'require',
      prepare: false,
    });
    const db = drizzle(client);
    
    if (req.method === 'GET') {
      // List all users using raw SQL
      const result = await db.execute(sql`SELECT * FROM users`);
      await client.end();
      
      // Extract rows from the result
      const rows = Array.isArray(result) ? result : result.rows || [];
      
      return res.status(200).json({
        success: true,
        count: rows.length,
        users: rows
      });
    }
    
    if (req.method === 'POST') {
      // Create test user using raw SQL
      const id = `user_${Date.now()}`;
      const email = `test${Date.now()}@example.com`;
      
      const result = await db.execute(sql`
        INSERT INTO users (id, email, first_name, last_name, profile_image_url, credits, total_credits_earned)
        VALUES (${id}, ${email}, 'Test', 'User', '', 10, 0)
        RETURNING *
      `);
      
      await client.end();
      
      // Extract the first row from result
      const rows = Array.isArray(result) ? result : result.rows || [];
      
      return res.status(200).json({
        success: true,
        user: rows[0] || null
      });
    }
    
    await client.end();
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error: any) {
    console.error('Simple test error:', error);
    return res.status(500).json({
      error: error.message,
      code: error.code,
      detail: error.detail
    });
  }
}