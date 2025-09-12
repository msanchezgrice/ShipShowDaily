import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, sendUnauthorized } from '../_lib/auth';
import { validateMethod, handleError, sendSuccess } from '../_lib/utils';
import { ObjectStorageService } from '../../server/objectStorage';
import { ObjectPermission } from '../../server/objectAcl';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Only allow PUT requests
    if (!validateMethod(req, res, ['PUT'])) {
      return;
    }

    // Require authentication
    const auth = await requireAuth(req);
    if (!auth) {
      return sendUnauthorized(res);
    }

    if (!req.body.videoURL) {
      return res.status(400).json({ error: "videoURL is required" });
    }

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.videoURL,
        {
          owner: auth.userId,
          visibility: "public",
        }
      );

      return sendSuccess(res, { objectPath });
    } catch (error) {
      console.error("Error setting object ACL policy:", error);
      return res.status(500).json({ error: "Failed to set object permissions" });
    }
  } catch (error) {
    return handleError(res, error, "Failed to process video file");
  }
}