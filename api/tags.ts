import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../server/storage';
import { validateMethod, handleError, sendSuccess } from './_lib/utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Only allow GET requests
    if (!validateMethod(req, res, ['GET'])) {
      return;
    }

    const tags = await storage.getAllTags();
    
    return sendSuccess(res, tags);
  } catch (error) {
    return handleError(res, error, "Failed to fetch tags");
  }
}