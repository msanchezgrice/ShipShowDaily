import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../../server/storage';
import { requireAuth, sendUnauthorized } from '../_lib/auth';
import { validateMethod, handleError, sendSuccess } from '../_lib/utils';
import { insertVideoWithTagsSchema } from '../../shared/schema';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Handle GET and POST requests
    if (!validateMethod(req, res, ['POST'])) {
      return;
    }

    if (req.method === 'POST') {
      // Require authentication for creating videos
      const auth = await requireAuth(req);
      if (!auth) {
        return sendUnauthorized(res);
      }

      const videoData = insertVideoWithTagsSchema.parse({
        ...req.body,
        creatorId: auth.userId,
      });
      
      const video = await storage.createVideoWithTags(videoData);
      return sendSuccess(res, video, 201);
    }
  } catch (error) {
    return handleError(res, error, "Failed to create video");
  }
}