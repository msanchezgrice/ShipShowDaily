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

    const { firstName, lastName, email } = req.body;

    // Basic validation
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    await storage.updateUserProfile(auth.userId, { firstName, lastName, email });
    
    return sendSuccess(res, { success: true, message: "Profile updated successfully" });
  } catch (error: any) {
    console.error("Error updating profile:", error);
    return handleError(res, error, error.message || "Failed to update profile");
  }
}