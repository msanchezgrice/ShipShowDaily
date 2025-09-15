import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const postgres = (await import('postgres')).default;
    const { sql } = await import('drizzle-orm');
    const { users } = await import('../shared/schema');
    
    const client = postgres(process.env.DATABASE_URL!, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: 'require',
      prepare: false,
    });
    const db = drizzle(client, { schema: { users } });
    
    if (req.method === 'GET') {
      // List all users
      const allUsers = await db.select().from(users);
      await client.end();
      
      return res.status(200).json({
        success: true,
        count: allUsers.length,
        users: allUsers
      });
    }
    
    if (req.method === 'POST') {
      // Create test user
      const testUser = {
        id: `user_${Date.now()}`,
        email: `test${Date.now()}@example.com`,
        firstName: 'Test',
        lastName: 'User',
        profileImageUrl: '',
        credits: 10,
        totalCreditsEarned: 0,
      };
      
      const [newUser] = await db.insert(users).values(testUser).returning();
      await client.end();
      
      return res.status(200).json({
        success: true,
        user: newUser
      });
    }
    
    await client.end();
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error: any) {
    console.error('Test user error:', error);
    return res.status(500).json({
      error: error.message,
      code: error.code,
      detail: error.detail
    });
  }
}