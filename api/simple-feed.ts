import type { VercelRequest, VercelResponse } from '@vercel/node';

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://shipshow.io',
  'https://www.shipshow.io',
  'http://localhost:3000',
  'http://localhost:5173',
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  const origin = req.headers.origin as string;
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ message: `Method ${req.method} not allowed` });
  }
  
  try {
    // Dynamic imports for Vercel serverless
    const { createClerkClient } = await import('@clerk/clerk-sdk-node');
    const { getFeedVideos } = await import('./_lib/data');
    const { trackEvent } = await import('./_lib/analytics');
    
    // Try to get user ID from auth token (optional - feed works for unauthenticated users too)
    let userId: string | null = null;
    const token = req.headers.authorization?.toString().replace('Bearer ', '');
    if (token && process.env.CLERK_SECRET_KEY) {
      try {
        const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
        const payload = await clerk.verifyToken(token);
        userId = payload.sub || null;
      } catch {
        // Ignore auth errors - feed works without auth
      }
    }

    // Get limit from query params (capped at 100)
    const limitParam = req.query?.limit;
    const limit = Math.min(limitParam ? parseInt(limitParam as string, 10) : 20, 100);

    // Fetch feed using data layer
    const feedItems = await getFeedVideos({ limit, userId });

    // Track feed view (both logged-in and anonymous)
    trackEvent('feed_viewed', {
      userId,
      req: { headers: req.headers as Record<string, any> },
      properties: { items_count: feedItems.length },
    });
    
    return res.status(200).json(feedItems);
  } catch (error: any) {
    console.error('Feed error:', error);
    return res.status(500).json({
      error: error.message || "Failed to fetch feed",
    });
  }
}