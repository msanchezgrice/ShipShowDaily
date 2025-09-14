import { createClerkClient } from '@clerk/clerk-sdk-node';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from './storage';

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
    
    console.log('requireAuth - Token present:', !!token);
    console.log('requireAuth - Token length:', token?.length || 0);
    console.log('requireAuth - Token prefix:', token?.substring(0, 20) || 'none');
    
    if (!token) {
      console.log('requireAuth - No token provided');
      return null;
    }

    // Verify the JWT token
    console.log('requireAuth - Attempting to verify token...');
    const payload = await clerk.verifyToken(token);
    console.log('requireAuth - Token verified, payload:', { sub: payload.sub, iss: payload.iss });
    
    if (!payload.sub) {
      console.log('requireAuth - No user ID in payload');
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
  } catch (error: any) {
    console.error('requireAuth - Authentication error:', {
      message: error.message,
      type: error.constructor.name,
      stack: error.stack?.split('\n')[0] // First line of stack trace
    });
    return null;
  }
}

// Helper to set CORS headers
function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// Helper to send unauthorized response
export function sendUnauthorized(res: VercelResponse) {
  setCorsHeaders(res);
  return res.status(401).json({ message: "Unauthorized" });
}

// Helper to handle authentication errors
export function sendAuthError(res: VercelResponse, message = "Authentication failed") {
  setCorsHeaders(res);
  return res.status(401).json({ message });
}