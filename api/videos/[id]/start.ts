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
    
    // Start a viewing session (this handles all validation)
    const session = await storage.startVideoViewing(auth.userId, videoId);

    return sendSuccess(res, { 
      sessionId: session.id,
      message: "Video viewing session started" 
    });
  } catch (error: any) {
    if (error.message === "Video already viewed today") {
      return res.status(400).json({ message: error.message });
    }
    return handleError(res, error, "Failed to start video viewing session");
  }
}