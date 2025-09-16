import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth';
import { scrapeProductPage, ScrapeError } from '../../server/scraper';

export default requireAuth(async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[SCRAPE] Request received:', req.method, req.url);
  console.log('[SCRAPE] Request body:', req.body);

  try {
    const { url } = req.body ?? {};

    if (!url || typeof url !== 'string') {
      console.error('[SCRAPE] Invalid URL provided:', url);
      return res.status(400).json({ message: 'A valid URL is required.' });
    }

    console.log('[SCRAPE] Scraping URL:', url);
    const scrapeResult = await scrapeProductPage(url);
    console.log('[SCRAPE] Scrape successful, found', scrapeResult.videoSources.length, 'videos');

    res.status(200).json(scrapeResult);
  } catch (error) {
    if (error instanceof ScrapeError) {
      console.error('[SCRAPE] ScrapeError:', error.message);
      return res.status(400).json({ message: error.message });
    }

    console.error('[SCRAPE] Error scraping URL:', error);
    res.status(500).json({ message: 'Failed to scrape the provided URL.' });
  }
});