import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, sendUnauthorized } from '../_lib/auth';
import { validateMethod, handleError, sendSuccess } from '../_lib/utils';
import { ObjectStorageService } from '../../server/objectStorage';

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

    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    
    return sendSuccess(res, { uploadURL });
  } catch (error) {
    return handleError(res, error, "Failed to get upload URL");
  }
}