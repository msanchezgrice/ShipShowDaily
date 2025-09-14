import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../_lib/storage';
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

    const transactions = await storage.getUserCreditTransactions(auth.userId);
    
    return sendSuccess(res, transactions);
  } catch (error) {
    return handleError(res, error, "Failed to fetch credit transactions");
  }
}