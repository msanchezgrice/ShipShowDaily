import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initDb, db } from '../_lib/db';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    // Initialize db first
    await initDb();
    
    // Test a simple query
    const [user] = await db.select().from(users).where(eq(users.id, 'test-id')).limit(1);
    
    return res.status(200).json({
      success: true,
      dbInitialized: true,
      userResult: user || 'no user found (expected)'
    });
    
  } catch (e: any) {
    return res.status(200).json({
      success: false,
      error: e.message,
      stack: e.stack
    });
  }
}
