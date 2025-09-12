import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../../../server/storage';
import { requireAuth, sendUnauthorized } from '../../_lib/auth';
import { validateMethod, handleError, sendSuccess, getQueryParam } from '../../_lib/utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Only allow POST requests
    if (!validateMethod(req, res, ['POST'])) {
      return;
    }

    // Require authentication
    const auth = await requireAuth(req);
    if (!auth) {
      return sendUnauthorized(res);
    }

    const videoId = getQueryParam(req, 'id');
    if (!videoId) {
      return res.status(400).json({ message: "Video ID is required" });
    }

    // Check if video exists
    const video = await storage.getVideo(videoId);
    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    const click = await storage.recordDemoLinkClick({
      userId: auth.userId,
      videoId,
    });

    return sendSuccess(res, { 
      success: true, 
      message: "Demo link click recorded",
      clickId: click.id 
    });
  } catch (error) {
    return handleError(res, error, "Failed to record demo link click");
  }
}