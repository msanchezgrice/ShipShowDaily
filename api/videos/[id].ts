import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../_lib/storage';
import { validateMethod, handleError, sendSuccess, getQueryParam } from '../_lib/utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Only allow GET requests
    if (!validateMethod(req, res, ['GET'])) {
      return;
    }

    const videoId = getQueryParam(req, 'id');
    if (!videoId) {
      return res.status(400).json({ message: "Video ID is required" });
    }

    const video = await storage.getVideoWithCreatorAndTags(videoId);
    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }
    
    return sendSuccess(res, video);
  } catch (error) {
    return handleError(res, error, "Failed to fetch video");
  }
}