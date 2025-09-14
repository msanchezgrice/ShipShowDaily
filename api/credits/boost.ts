import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../_lib/storage';
import { requireAuth, sendUnauthorized } from '../_lib/auth';
import { validateMethod, handleError, sendSuccess } from '../_lib/utils';

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

    const { videoId, amount } = req.body;

    if (!videoId || !amount || amount < 10) {
      return res.status(400).json({ message: "Invalid boost parameters" });
    }

    const user = await storage.getUser(auth.userId);
    if (!user || user.credits < amount) {
      return res.status(400).json({ message: "Insufficient credits" });
    }

    // Deduct credits
    await storage.updateUserCredits(auth.userId, -amount);
    await storage.recordCreditTransaction({
      userId: auth.userId,
      type: 'spent',
      amount,
      reason: 'video_boost',
      videoId,
    });

    // Add to daily stats as credits spent
    await storage.updateDailyStats(videoId, 0, amount);

    return sendSuccess(res, { success: true });
  } catch (error) {
    return handleError(res, error, "Failed to boost video");
  }
}