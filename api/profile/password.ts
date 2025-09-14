import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../_lib/storage';
import { requireAuth, sendUnauthorized } from '../_lib/auth';
import { validateMethod, handleError, sendSuccess } from '../_lib/utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Only allow PATCH requests
    if (!validateMethod(req, res, ['PATCH'])) {
      return;
    }

    // Require authentication
    const auth = await requireAuth(req);
    if (!auth) {
      return sendUnauthorized(res);
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "New password must be at least 8 characters long" });
    }

    await storage.updateUserPassword(auth.userId, currentPassword, newPassword);
    
    return sendSuccess(res, { success: true, message: "Password updated successfully" });
  } catch (error: any) {
    console.error("Error updating password:", error);
    return handleError(res, error, error.message || "Failed to update password");
  }
}