import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from './_lib/storage-adapter';
import { requireAuth } from './_lib/auth';
import { validateMethod, handleError, sendSuccess, getQueryParamAsNumber, getQueryParam } from './_lib/utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Only allow GET requests
    if (!validateMethod(req, res, ['GET'])) {
      return;
    }

    const limit = getQueryParamAsNumber(req, 'limit', 10);
    const offset = getQueryParamAsNumber(req, 'offset', 0);
    const tagFilter = getQueryParam(req, 'tag');
    
    // Get the authenticated user ID if available (optional for feed)
    const auth = await requireAuth(req);
    const userId = auth?.userId || null;

    const feedVideos = await storage.getFeedVideos({
      limit,
      offset,
      tagFilter,
      userId,
    });

    return sendSuccess(res, feedVideos);
  } catch (error) {
    return handleError(res, error, "Failed to fetch feed");
  }
}