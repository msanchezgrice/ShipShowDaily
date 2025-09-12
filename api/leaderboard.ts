import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../server/storage';
import { validateMethod, handleError, sendSuccess, getQueryParamAsNumber, getQueryParam } from './_lib/utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Only allow GET requests
    if (!validateMethod(req, res, ['GET'])) {
      return;
    }

    const limit = getQueryParamAsNumber(req, 'limit', 10);
    const sortBy = getQueryParam(req, 'sortBy', 'views') as 'views' | 'favorites' | 'demo_clicks';
    const tagFilter = getQueryParam(req, 'tag');
    
    // Use enhanced leaderboard if filtering options are provided
    if (sortBy !== 'views' || tagFilter) {
      const enhancedLeaderboard = await storage.getEnhancedLeaderboard(limit, sortBy, tagFilter);
      return sendSuccess(res, enhancedLeaderboard);
    } else {
      // Use original leaderboard for basic views sorting (for backward compatibility)
      const leaderboard = await storage.getTodayLeaderboard(limit);
      return sendSuccess(res, leaderboard);
    }
  } catch (error) {
    return handleError(res, error, "Failed to fetch leaderboard");
  }
}