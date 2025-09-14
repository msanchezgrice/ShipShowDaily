import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClerkClient } from '@clerk/clerk-sdk-node';
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
    // Check for required environment variables
    if (!process.env.CLERK_SECRET_KEY) {
      console.error("CLERK_SECRET_KEY not set");
      return res.status(500).json({ error: "Authentication configuration error" });
    }
    
    if (!process.env.DATABASE_URL) {
      console.error("DATABASE_URL not set");
      return res.status(500).json({ error: "Database configuration error" });
    }
    
    // Get the authorization header
    const token = req.headers.authorization?.toString().replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: "No authentication token provided" });
    }
    
    // Initialize Clerk client
    const clerk = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    
    // Verify the JWT token
    let userId: string;
    try {
      const payload = await clerk.verifyToken(token);
      userId = payload.sub;
      
      if (!userId) {
        return res.status(401).json({ message: "Invalid token payload" });
      }
    } catch (verifyError) {
      console.error("Token verification failed:", verifyError);
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    
    // Get user data from Clerk
    let clerkUser;
    try {
      clerkUser = await clerk.users.getUser(userId);
    } catch (clerkError) {
      console.error("Failed to get Clerk user:", clerkError);
      return res.status(404).json({ message: "User not found in Clerk" });
    }
    
    // Create database connection
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle(pool);
    
    const userEmail = clerkUser.primaryEmailAddress?.emailAddress || 
                     clerkUser.emailAddresses[0]?.emailAddress || 
                     `${clerkUser.id}@placeholder.email`;
    
    // First, try to get the existing user
    const existingUserResult = await db.execute(sql`
      SELECT id FROM users WHERE id = ${clerkUser.id} OR email = ${userEmail} LIMIT 1
    `);
    
    if (existingUserResult.rows.length > 0) {
      const existingUser = existingUserResult.rows[0];
      
      // If user exists but with different ID (email match), update the ID
      if (existingUser.id !== clerkUser.id) {
        // Delete any existing user with the Clerk ID first
        await db.execute(sql`
          DELETE FROM users WHERE id = ${clerkUser.id}
        `);
        
        // Update the existing user to use Clerk's ID
        await db.execute(sql`
          UPDATE users 
          SET 
            id = ${clerkUser.id},
            first_name = ${clerkUser.firstName || ''},
            last_name = ${clerkUser.lastName || ''},
            profile_image_url = ${clerkUser.imageUrl || ''},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${existingUser.id}
        `);
      } else {
        // User exists with correct ID, just update their info
        await db.execute(sql`
          UPDATE users 
          SET 
            email = ${userEmail},
            first_name = ${clerkUser.firstName || ''},
            last_name = ${clerkUser.lastName || ''},
            profile_image_url = ${clerkUser.imageUrl || ''},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ${clerkUser.id}
        `);
      }
    } else {
      // User doesn't exist, create new user
      await db.execute(sql`
        INSERT INTO users (
          id, 
          email, 
          first_name, 
          last_name, 
          profile_image_url,
          credits,
          total_credits_earned
        ) VALUES (
          ${clerkUser.id},
          ${userEmail},
          ${clerkUser.firstName || ''},
          ${clerkUser.lastName || ''},
          ${clerkUser.imageUrl || ''},
          10,  -- Default credits for new users
          0
        )
      `);
    }
    
    // Get user data from database
    const result = await db.execute(sql`
      SELECT 
        id,
        email,
        first_name as "firstName",
        last_name as "lastName",
        profile_image_url as "profileImageUrl",
        credits,
        total_credits_earned as "totalCreditsEarned",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM users
      WHERE id = ${clerkUser.id}
      LIMIT 1
    `);

    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ message: "User not found in database" });
    }

    return res.status(200).json(user);
  } catch (error: any) {
    console.error("API Error in /api/auth/user-simple:", error);
    return res.status(500).json({ 
      message: "Failed to fetch user",
      error: error.message || "Unknown error"
    });
  }
}