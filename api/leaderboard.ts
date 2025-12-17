import type { VercelRequest, VercelResponse } from '@vercel/node';

// CORS helpers
const ALLOWED_ORIGINS = ['https://shipshow.io', 'https://www.shipshow.io', 'http://localhost:3000', 'http://localhost:5173'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string;
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    // Dynamic imports for Vercel serverless
    const { getLeaderboard } = await import('./_lib/data');
    const { trackEvent } = await import('./_lib/analytics');
    
    const limitParam = req.query?.limit;
    const limit = Math.min(limitParam ? parseInt(limitParam as string, 10) : 10, 50);
    
    const leaderboard = await getLeaderboard(limit);
    
    // Track leaderboard view
    trackEvent('leaderboard_viewed', {
      req: { headers: req.headers as Record<string, any> },
      properties: { items_count: leaderboard.length },
    });
    
    return res.status(200).json(leaderboard);
  } catch (error: any) {
    console.error('Leaderboard error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch leaderboard' });
  }
}