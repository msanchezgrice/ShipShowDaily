import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Only allow GET requests
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Check authentication
    const token = req.headers.authorization?.toString().replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify token with Clerk
    const { createClerkClient } = await import('@clerk/clerk-sdk-node');
    const clerk = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
    
    let userId: string;
    try {
      const payload = await clerk.verifyToken(token);
      userId = payload.sub;
      if (!userId) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Dynamic imports for database
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const postgres = (await import('postgres')).default;
    const { creditTransactions } = await import('../../shared/schema.js');
    const { eq, desc } = await import('drizzle-orm');
    
    // Create database connection
    const client = postgres(process.env.DATABASE_URL!, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: 'require',
      prepare: false,
    });
    const db = drizzle(client);

    // Fetch user's credit transactions
    const transactions = await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(20);

    await client.end();

    return res.status(200).json(transactions || []);
  } catch (error: any) {
    console.error('Handler error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch credit transactions',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}