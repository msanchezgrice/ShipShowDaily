import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../../server/storage';
import { requireAuth, sendUnauthorized } from '../_lib/auth';
import { validateMethod, handleError, sendSuccess } from '../_lib/utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Only allow GET requests
    if (!validateMethod(req, res, ['GET'])) {
      return;
    }

    // Require authentication
    const auth = await requireAuth(req);
    if (!auth) {
      return sendUnauthorized(res);
    }

    // Get user data from storage
    const user = await storage.getUser(auth.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return sendSuccess(res, user);
  } catch (error) {
    return handleError(res, error, "Failed to fetch user");
  }
}