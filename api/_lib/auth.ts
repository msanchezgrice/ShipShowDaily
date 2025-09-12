import { createClerkClient } from '@clerk/clerk-sdk-node';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../../server/storage';

if (!process.env.CLERK_SECRET_KEY) {
  throw new Error('Missing required Clerk secret: CLERK_SECRET_KEY');
}

// Initialize Clerk client
const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

// Helper function to sync Clerk user data with our database
async function syncClerkUser(clerkUser: any) {
  await storage.upsertUser({
    id: clerkUser.id,
    email: clerkUser.primaryEmailAddress?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress,
    firstName: clerkUser.firstName,
    lastName: clerkUser.lastName,
    profileImageUrl: clerkUser.imageUrl,
  });
}

// Authentication middleware for serverless functions
export async function requireAuth(req: VercelRequest): Promise<{ userId: string; user: any } | null> {
  try {
    const token = req.headers.authorization?.toString().replace('Bearer ', '');
    
    if (!token) {
      return null;
    }

    // Verify the JWT token
    const payload = await clerk.verifyToken(token);
    
    if (!payload.sub) {
      return null;
    }

    // Get full user data from Clerk
    const clerkUser = await clerk.users.getUser(payload.sub);
    
    if (!clerkUser) {
      return null;
    }

    // Sync user data with our database
    await syncClerkUser(clerkUser);
    
    return {
      userId: clerkUser.id,
      user: clerkUser
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

// Helper to send unauthorized response
export function sendUnauthorized(res: VercelResponse) {
  return res.status(401).json({ message: "Unauthorized" });
}

// Helper to handle authentication errors
export function sendAuthError(res: VercelResponse, message = "Authentication failed") {
  return res.status(401).json({ message });
}