import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClerkClient } from '@clerk/clerk-sdk-node';
import { getVideo, toggleFavorite } from '../../_lib/data';
import { trackFavorite } from '../../_lib/analytics';

const ALLOWED_ORIGINS = ['https://shipshow.io', 'https://www.shipshow.io', 'http://localhost:3000', 'http://localhost:5173'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string;
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    // Get video ID from URL
    const videoId = req.query.id as string;
    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    // Require authentication
    const token = req.headers.authorization?.toString().replace('Bearer ', '');
    if (!token || !process.env.CLERK_SECRET_KEY) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const payload = await clerk.verifyToken(token);
    if (!payload.sub) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const userId = payload.sub;

    // Check video exists
    const video = await getVideo(videoId);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Toggle favorite
    const result = await toggleFavorite(userId, videoId);
    
    // Track in analytics (both logged-in and for aggregate stats)
    trackFavorite(videoId, video.title, result.favorited, {
      userId,
      req: { headers: req.headers as Record<string, any> },
    });

    return res.status(200).json({
      success: true,
      favorited: result.favorited,
      message: result.favorited ? 'Added to favorites' : 'Removed from favorites',
    });
  } catch (error: any) {
    console.error('Favorite error:', error);
    return res.status(500).json({ error: error.message || 'Failed to toggle favorite' });
  }
}