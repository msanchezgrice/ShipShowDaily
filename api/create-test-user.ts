import type { VercelRequest, VercelResponse } from '@vercel/node';
import { db, users } from './_lib/db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Create a test user
    const testUser = {
      id: 'test-user-' + Date.now(),
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      profileImageUrl: '',
      credits: 10,
      totalCreditsEarned: 0,
    };

    const [newUser] = await db
      .insert(users)
      .values(testUser)
      .returning();

    return res.status(200).json({
      success: true,
      user: newUser,
      message: 'Test user created successfully'
    });
    
  } catch (error: any) {
    console.error('Create test user error:', error);
    return res.status(500).json({
      error: error.message,
      type: error.constructor.name,
      detail: error.detail
    });
  }
}