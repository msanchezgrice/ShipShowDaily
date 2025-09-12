import { createClerkClient } from '@clerk/clerk-sdk-node';
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";

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

export async function setupAuth(app: Express) {
  // Clerk middleware to verify JWT tokens
  app.use('/api', async (req: any, res, next) => {
    // Skip authentication for webhook routes and public routes
    if (req.path.startsWith('/stripe/webhook') || req.path === '/auth/user') {
      return next();
    }
    
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        const payload = await clerk.verifyToken(token);
        req.auth = { userId: payload.sub };
      }
      next();
    } catch (error) {
      // Continue without auth - will be handled by isAuthenticated middleware if needed
      next();
    }
  });
}

// Middleware to require authentication and sync user data
export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Verify the JWT token
    const payload = await clerk.verifyToken(token);
    
    if (!payload.sub) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Get full user data from Clerk
    const clerkUser = await clerk.users.getUser(payload.sub);
    
    if (!clerkUser) {
      return res.status(401).json({ message: "User not found" });
    }

    // Sync user data with our database
    await syncClerkUser(clerkUser);
    
    // Add user data to request for downstream use
    req.user = { 
      claims: { 
        sub: clerkUser.id 
      },
      ...clerkUser
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};

// Helper to get authenticated user ID from request
export function getAuthenticatedUserId(req: any): string | null {
  return req.user?.claims?.sub || null;
}