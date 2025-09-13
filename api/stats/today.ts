import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getTodayStats } from '../_lib/storage';
import { validateMethod, handleError, sendSuccess } from '../_lib/utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Only allow GET requests
    if (!validateMethod(req, res, ['GET'])) {
      return;
    }

    const stats = await getTodayStats();
    
    return sendSuccess(res, stats);
  } catch (error) {
    return handleError(res, error, "Failed to fetch today's stats");
  }
}