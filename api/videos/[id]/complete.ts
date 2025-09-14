import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../../_lib/storage';
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

    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ message: "Session ID is required" });
    }

    // Complete the viewing session (server validates timing)
    const result = await storage.completeVideoViewing(sessionId);

    return sendSuccess(res, { 
      creditAwarded: result.creditAwarded,
      watchDuration: result.session.completedAt && result.session.startedAt ? 
        Math.floor((new Date(result.session.completedAt).getTime() - new Date(result.session.startedAt).getTime()) / 1000) : 0,
      message: result.creditAwarded ? "Credit earned!" : "Session completed, minimum watch time not met"
    });
  } catch (error: any) {
    if (error.message === "Viewing session not found" || error.message === "Session already completed") {
      return res.status(400).json({ message: error.message });
    }
    return handleError(res, error, "Failed to complete video viewing session");
  }
}