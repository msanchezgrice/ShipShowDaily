import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { insertVideoSchema, insertVideoViewSchema, insertCreditTransactionSchema } from "@shared/schema";
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
      const videos = await storage.getTopVideosToday(limit);
      res.json(videos);
    } catch (error) {
      console.error("Error fetching top videos:", error);
      res.status(500).json({ message: "Failed to fetch videos" });
    }
  });

  app.get('/api/videos/:id', async (req, res) => {
    try {
      const video = await storage.getVideoWithCreator(req.params.id);
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
      const videoData = insertVideoSchema.parse({
        ...req.body,
        creatorId: userId,
      });
      
      const video = await storage.createVideo(videoData);
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
      const videos = await storage.getUserVideos(userId);
      res.json(videos);
    } catch (error) {
      console.error("Error fetching user videos:", error);
      res.status(500).json({ message: "Failed to fetch user videos" });
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
    } catch (error) {
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
        watchDuration: Math.floor((new Date(result.session.completedAt!).getTime() - new Date(result.session.startedAt).getTime()) / 1000),
        message: result.creditAwarded ? "Credit earned!" : "Session completed, minimum watch time not met"
      });
    } catch (error) {
      console.error("Error completing video viewing:", error);
      if (error.message === "Viewing session not found" || error.message === "Session already completed") {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to complete video viewing session" });
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
      const leaderboard = await storage.getTodayLeaderboard(limit);
      res.json(leaderboard);
    } catch (error) {
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
