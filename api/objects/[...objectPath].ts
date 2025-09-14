import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, sendUnauthorized } from '../_lib/auth';
import { validateMethod, handleError } from '../_lib/utils';
import { ObjectStorageService, ObjectNotFoundError } from '../_lib/objectStorage';
import { ObjectPermission } from '../_lib/objectAcl';

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

    const objectStorageService = new ObjectStorageService();
    
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.url || '');
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: auth.userId,
        requestedPermission: ObjectPermission.READ,
      });
      
      if (!canAccess) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ message: "Object not found" });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  } catch (error) {
    return handleError(res, error, "Failed to access object");
  }
}