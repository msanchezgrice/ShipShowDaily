import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { insertVideoSchema, insertVideoWithTagsSchema, insertVideoViewSchema, insertCreditTransactionSchema, insertVideoFavoriteSchema, insertDemoLinkClickSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Video routes
  app.get('/api/videos/top', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const tagFilter = req.query.tag as string;
      const videos = await storage.getTopVideosTodayWithTags(limit, tagFilter);
      res.json(videos);
    } catch (error) {
      console.error("Error fetching top videos:", error);
      res.status(500).json({ message: "Failed to fetch videos" });
    }
  });

  app.get('/api/videos/:id', async (req, res) => {
    try {
      const video = await storage.getVideoWithCreatorAndTags(req.params.id);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }
      res.json(video);
    } catch (error) {
      console.error("Error fetching video:", error);
      res.status(500).json({ message: "Failed to fetch video" });
    }
  });

  app.post('/api/videos', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const videoData = insertVideoWithTagsSchema.parse({
        ...req.body,
        creatorId: userId,
      });
      
      const video = await storage.createVideoWithTags(videoData);
      res.status(201).json(video);
    } catch (error) {
      console.error("Error creating video:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid video data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create video" });
    }
  });

  app.get('/api/user/videos', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const videos = await storage.getUserVideosWithTags(userId);
      res.json(videos);
    } catch (error) {
      console.error("Error fetching user videos:", error);
      res.status(500).json({ message: "Failed to fetch user videos" });
    }
  });

  // Tag routes
  app.get('/api/tags', async (req, res) => {
    try {
      const tags = await storage.getAllTags();
      res.json(tags);
    } catch (error) {
      console.error("Error fetching tags:", error);
      res.status(500).json({ message: "Failed to fetch tags" });
    }
  });

  // Video viewing routes (secure start/complete handshake)
  app.post('/api/videos/:id/start', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const videoId = req.params.id;
      
      // Start a viewing session (this handles all validation)
      const session = await storage.startVideoViewing(userId, videoId);

      res.json({ 
        sessionId: session.id,
        message: "Video viewing session started" 
      });
    } catch (error: any) {
      console.error("Error starting video viewing:", error);
      if (error.message === "Video already viewed today") {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to start video viewing session" });
    }
  });

  app.post('/api/videos/:id/complete', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const videoId = req.params.id;
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({ message: "Session ID is required" });
      }

      // Complete the viewing session (server validates timing)
      const result = await storage.completeVideoViewing(sessionId);

      res.json({ 
        creditAwarded: result.creditAwarded,
        watchDuration: result.session.completedAt ? Math.floor((new Date(result.session.completedAt).getTime() - new Date(result.session.startedAt).getTime()) / 1000) : 0,
        message: result.creditAwarded ? "Credit earned!" : "Session completed, minimum watch time not met"
      });
    } catch (error: any) {
      console.error("Error completing video viewing:", error);
      if (error.message === "Viewing session not found" || error.message === "Session already completed") {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to complete video viewing session" });
    }
  });

  // Video favorites routes
  app.post('/api/videos/:id/favorite', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const videoId = req.params.id;

      // Check if video exists
      const video = await storage.getVideo(videoId);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }

      // Check if already favorited
      const isAlreadyFavorited = await storage.isVideoFavorited(userId, videoId);
      if (isAlreadyFavorited) {
        return res.status(400).json({ message: "Video already favorited" });
      }

      const favorite = await storage.favoriteVideo({
        userId,
        videoId,
      });

      res.json({ 
        success: true, 
        message: "Video added to favorites",
        favoriteId: favorite.id 
      });
    } catch (error) {
      console.error("Error favoriting video:", error);
      res.status(500).json({ message: "Failed to favorite video" });
    }
  });

  app.post('/api/videos/:id/demo-click', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const videoId = req.params.id;

      // Check if video exists
      const video = await storage.getVideo(videoId);
      if (!video) {
        return res.status(404).json({ message: "Video not found" });
      }

      const click = await storage.recordDemoLinkClick({
        userId,
        videoId,
      });

      res.json({ 
        success: true, 
        message: "Demo link click recorded",
        clickId: click.id 
      });
    } catch (error) {
      console.error("Error recording demo link click:", error);
      res.status(500).json({ message: "Failed to record demo link click" });
    }
  });

  // Credit routes
  app.post('/api/credits/boost', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { videoId, amount } = req.body;

      if (!videoId || !amount || amount < 10) {
        return res.status(400).json({ message: "Invalid boost parameters" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.credits < amount) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      // Deduct credits
      await storage.updateUserCredits(userId, -amount);
      await storage.recordCreditTransaction({
        userId,
        type: 'spent',
        amount,
        reason: 'video_boost',
        videoId,
      });

      // Add to daily stats as credits spent
      await storage.updateDailyStats(videoId, 0, amount);

      res.json({ success: true });
    } catch (error) {
      console.error("Error boosting video:", error);
      res.status(500).json({ message: "Failed to boost video" });
    }
  });

  app.get('/api/credits/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const transactions = await storage.getUserCreditTransactions(userId);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching credit transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Profile management routes
  app.patch('/api/profile/update', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { firstName, lastName, email } = req.body;

      // Basic validation
      if (!firstName || !lastName || !email) {
        return res.status(400).json({ message: "All fields are required" });
      }

      if (!/\S+@\S+\.\S+/.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      await storage.updateUserProfile(userId, { firstName, lastName, email });
      res.json({ success: true, message: "Profile updated successfully" });
    } catch (error: any) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: error.message || "Failed to update profile" });
    }
  });

  app.patch('/api/profile/password', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters long" });
      }

      await storage.updateUserPassword(userId, currentPassword, newPassword);
      res.json({ success: true, message: "Password updated successfully" });
    } catch (error: any) {
      console.error("Error updating password:", error);
      res.status(500).json({ message: error.message || "Failed to update password" });
    }
  });

  app.post('/api/auth/logout', async (req, res) => {
    try {
      req.session.destroy((err: any) => {
        if (err) {
          console.error("Error destroying session:", err);
          return res.status(500).json({ message: "Failed to sign out" });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true, message: "Signed out successfully" });
      });
    } catch (error) {
      console.error("Error signing out:", error);
      res.status(500).json({ message: "Failed to sign out" });
    }
  });

  // Credit purchase route
  app.post('/api/credits/purchase', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { packageId } = req.body;

      if (!packageId) {
        return res.status(400).json({ message: "Package ID is required" });
      }

      // Define credit packages (same as frontend)
      const creditPackages = {
        starter: { credits: 100, price: 5 },
        popular: { credits: 500, price: 20, bonus: 50 },
        pro: { credits: 1000, price: 35, bonus: 200 },
        premium: { credits: 2500, price: 75, bonus: 750 }
      };

      const selectedPackage = creditPackages[packageId as keyof typeof creditPackages];
      if (!selectedPackage) {
        return res.status(400).json({ message: "Invalid package ID" });
      }

      // Calculate total credits including bonus
      const totalCredits = selectedPackage.credits + (selectedPackage.bonus || 0);

      // In a real application, this would integrate with a payment processor like Stripe
      // For now, we'll simulate a successful purchase
      
      // Add credits to user account
      await storage.updateUserCredits(userId, totalCredits);
      
      // Record the transaction
      await storage.recordCreditTransaction({
        userId,
        type: 'purchase',
        amount: totalCredits,
        reason: `Purchased ${selectedPackage.credits} credits${selectedPackage.bonus ? ` + ${selectedPackage.bonus} bonus` : ''} for $${selectedPackage.price}`,
      });

      res.json({
        success: true,
        credits: totalCredits,
        package: selectedPackage,
        message: "Credits purchased successfully"
      });
    } catch (error: any) {
      console.error("Error purchasing credits:", error);
      res.status(500).json({ message: error.message || "Failed to purchase credits" });
    }
  });

  // Stats routes
  app.get('/api/stats/today', async (req, res) => {
    try {
      const stats = await storage.getTodayStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching today's stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get('/api/leaderboard', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const sortBy = (req.query.sortBy as string) || 'views';
      const tagFilter = req.query.tag as string;
      
      // Use enhanced leaderboard if filtering options are provided
      if (sortBy !== 'views' || tagFilter) {
        const enhancedLeaderboard = await storage.getEnhancedLeaderboard(limit, sortBy as any, tagFilter);
        res.json(enhancedLeaderboard);
      } else {
        // Use original leaderboard for basic views sorting (for backward compatibility)
        const leaderboard = await storage.getTodayLeaderboard(limit);
        res.json(leaderboard);
      }
    } catch (error: any) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  // Object storage routes
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", isAuthenticated, async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL });
  });

  app.put("/api/videos/video-file", isAuthenticated, async (req: any, res) => {
    if (!req.body.videoURL) {
      return res.status(400).json({ error: "videoURL is required" });
    }

    const userId = req.user?.claims?.sub;

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.videoURL,
        {
          owner: userId,
          visibility: "public",
        },
      );

      res.status(200).json({
        objectPath: objectPath,
      });
    } catch (error) {
      console.error("Error setting video file:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Serve public objects
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    const objectStorageService = new ObjectStorageService();
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
