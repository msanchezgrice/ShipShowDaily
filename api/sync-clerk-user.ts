import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clerkClient } from '@clerk/clerk-sdk-node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  
  try {
    // Get user from Clerk
    const clerkUser = await clerkClient.users.getUser(userId);
    
    if (!clerkUser) {
      return res.status(404).json({ error: 'User not found in Clerk' });
    }
    
    // Get primary email
    const primaryEmail = clerkUser.emailAddresses.find(
      email => email.id === clerkUser.primaryEmailAddressId
    ) || clerkUser.emailAddresses[0];
    
    if (!primaryEmail) {
      return res.status(400).json({ error: 'User has no email address' });
    }
    
    // Import database dependencies
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const postgres = (await import('postgres')).default;
    const { users } = await import('@shared/schema');
    const { eq } = await import('drizzle-orm');
    
    const client = postgres(process.env.DATABASE_URL!, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: 'require',
      prepare: false,
    });
    const db = drizzle(client, { schema: { users } });
    
    // Check if user exists
    const [existingUser] = await db.select().from(users).where(eq(users.id, userId));
    
    if (existingUser) {
      await client.end();
      return res.status(200).json({
        success: true,
        message: 'User already exists',
        user: existingUser
      });
    }
    
    // Create user in database
    const [newUser] = await db.insert(users).values({
      id: clerkUser.id,
      email: primaryEmail.emailAddress,
      firstName: clerkUser.firstName || '',
      lastName: clerkUser.lastName || '',
      profileImageUrl: clerkUser.imageUrl || '',
      credits: 10,
      totalCreditsEarned: 0,
    }).returning();
    
    await client.end();
    
    return res.status(200).json({
      success: true,
      message: 'User synced successfully',
      user: newUser
    });
    
  } catch (error: any) {
    console.error('Sync user error:', error);
    return res.status(500).json({
      error: error.message,
      code: error.code,
      detail: error.detail
    });
  }
}