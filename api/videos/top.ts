import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../../server/storage';
import { validateMethod, handleError, sendSuccess, getQueryParamAsNumber, getQueryParam } from '../_lib/utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Only allow GET requests
    if (!validateMethod(req, res, ['GET'])) {
      return;
    }

    const limit = getQueryParamAsNumber(req, 'limit', 10);
    const tagFilter = getQueryParam(req, 'tag');
    
    const videos = await storage.getTopVideosTodayWithTags(limit, tagFilter);
    
    return sendSuccess(res, videos);
  } catch (error) {
    return handleError(res, error, "Failed to fetch top videos");
  }
}