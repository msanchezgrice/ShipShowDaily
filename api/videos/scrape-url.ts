import type { VercelRequest, VercelResponse } from '@vercel/node';

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
    // Require authentication
    const token = req.headers.authorization?.toString().replace('Bearer ', '');
    if (!token || !process.env.CLERK_SECRET_KEY) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { createClerkClient } = await import('@clerk/clerk-sdk-node');
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    await clerk.verifyToken(token);

    const { url } = req.body ?? {};

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ message: 'A valid URL is required.' });
    }

    // Dynamic import of scraper
    const { scrapeProductPage, ScrapeError } = await import('../../server/scraper');
    
    console.log('[SCRAPE] Scraping URL:', url);
    const scrapeResult = await scrapeProductPage(url);
    console.log('[SCRAPE] Scrape successful, found', scrapeResult.videoSources.length, 'videos');

    return res.status(200).json(scrapeResult);
  } catch (error: any) {
    console.error('[SCRAPE] Error:', error);
    if (error.name === 'ScrapeError') {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: error.message || 'Failed to scrape the provided URL.' });
  }
}