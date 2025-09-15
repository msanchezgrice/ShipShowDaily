import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./clerkAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { insertVideoSchema, insertVideoWithTagsSchema, insertVideoViewSchema, insertCreditTransactionSchema, insertVideoFavoriteSchema, insertDemoLinkClickSchema } from "@shared/schema";
import { z } from "zod";
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Webhook secret for verifying webhook signatures (optional but recommended)
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Server-side credit packages definition - this is the authoritative source
const CREDIT_PACKAGES = {
  starter: { credits: 100, price: 5 },
  popular: { credits: 500, price: 20, bonus: 50 },
  pro: { credits: 1000, price: 35, bonus: 200 },
  premium: { credits: 2500, price: 75, bonus: 750 }
} as const;

type PackageId = keyof typeof CREDIT_PACKAGES;

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  const enableFileStorage = process.env.ENABLE_FILE_STORAGE === 'true';

  // Stripe webhook handler (must be before auth middleware)
  app.post('/api/stripe/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    
    let event: Stripe.Event;

    try {
      // Verify webhook signature if secret is configured
      if (webhookSecret && sig) {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } else {
        // Fallback to parsing body without signature verification
        // This is less secure but works in development without webhook secret
        event = req.body;
      }
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      // Handle payment_intent.succeeded event
      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        console.log('Payment succeeded via webhook:', paymentIntent.id);

        // Extract metadata from payment intent
        const { userId, packageId, credits, bonus, totalCredits } = paymentIntent.metadata;
        
        if (!userId || !packageId || !totalCredits) {
          console.error('Missing required metadata in payment intent:', paymentIntent.id);
          return res.status(400).json({ error: 'Invalid payment intent metadata' });
        }

        // Validate package pricing against server-side definition
        const serverPackage = CREDIT_PACKAGES[packageId as PackageId];
        if (!serverPackage) {
          console.error('Invalid package ID in payment intent:', packageId);
          return res.status(400).json({ error: 'Invalid package in payment intent' });
        }

        // Validate payment amount matches server-side pricing
        const expectedAmount = Math.round(serverPackage.price * 100);
        if (paymentIntent.amount !== expectedAmount) {
          console.error(`Payment amount mismatch: expected ${expectedAmount}, got ${paymentIntent.amount}`);
          return res.status(400).json({ error: 'Payment amount validation failed' });
        }

        // Validate credit amounts match server-side calculation
        const expectedBonus = 'bonus' in serverPackage ? serverPackage.bonus || 0 : 0;
        const expectedTotalCredits = serverPackage.credits + expectedBonus;
        if (parseInt(totalCredits) !== expectedTotalCredits) {
          console.error(`Credit amount mismatch: expected ${expectedTotalCredits}, got ${totalCredits}`);
          return res.status(400).json({ error: 'Credit amount validation failed' });
        }

        // Check if we already processed this payment
        const existingTransaction = await storage.getUserCreditTransactions(userId, 100);
        const alreadyProcessed = existingTransaction.find(
          t => t.reason?.includes(paymentIntent.id)
        );

        if (alreadyProcessed) {
          console.log('Payment already processed:', paymentIntent.id);
          return res.json({ received: true, message: 'Payment already processed' });
        }

        // Add credits to user account
        const creditAmount = parseInt(totalCredits);
        await storage.updateUserCredits(userId, creditAmount);
        
        // Record the transaction
        await storage.recordCreditTransaction({
          userId,
          type: 'purchase',
          amount: creditAmount,
          reason: `Purchased ${credits} credits${bonus ? ` + ${bonus} bonus` : ''} for $${(paymentIntent.amount / 100).toFixed(2)} (${paymentIntent.id}) - Webhook`,
        });

        console.log(`Added ${creditAmount} credits to user ${userId} via webhook`);
      }

      // Return success response to Stripe
      res.json({ received: true });
    } catch (error: any) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

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

  // User profile routes
  app.get('/api/users/:userId', async (req, res) => {
    try {
      const user = await storage.getUser(req.params.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      // Return public user info only
      res.json({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      });
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  app.get('/api/users/:userId/videos', async (req, res) => {
    try {
      const videos = await storage.getUserVideosWithTags(req.params.userId);
      res.json(videos);
    } catch (error) {
      console.error("Error fetching user videos:", error);
      res.status(500).json({ message: "Failed to fetch user videos" });
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

  // Cloudflare Stream init endpoint (creates video with metadata)
  app.post('/api/videos/cloudflare-init-simple', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { title, description, productUrl, tags, maxDurationSeconds } = req.body;

      // Create video record with tags
      const videoData = {
        title,
        description,
        productUrl,
        videoPath: `/cloudflare/${Date.now()}_${title.replace(/\s+/g, '_').toLowerCase()}`,  // Placeholder path for Cloudflare videos
        creatorId: userId,
        status: 'processing' as const,
        isActive: true,
        tags: tags || [],
      };

      const video = await storage.createVideoWithTags(videoData);

      // For now, return a mock Cloudflare response
      // In production, this would integrate with Cloudflare Stream API
      res.json({
        videoId: video.id,
        uploadUrl: `https://upload.cloudflarestream.com/mock/${video.id}`,
        uploadId: `mock-upload-${video.id}`,
        provider: 'cloudflare',
        maxDurationSeconds: maxDurationSeconds || 30,
      });
    } catch (error) {
      console.error("Error initializing Cloudflare upload:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid video data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to initialize upload" });
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

  // Feed route - TikTok-style paginated video feed
  app.get('/api/feed', async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;
      const tagFilter = req.query.tag as string;
      
      // Get the authenticated user ID if available
      const userId = req.user?.claims?.sub || null;

      const feedVideos = await storage.getFeedVideos({
        limit,
        offset,
        tagFilter,
        userId,
      });

      res.json(feedVideos);
    } catch (error) {
      console.error("Error fetching feed:", error);
      res.status(500).json({ message: "Failed to fetch feed" });
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

      console.log(`[VIEW START] User ${userId} starting view for video ${videoId}`);

      // Start a viewing session (this handles all validation)
      const session = await storage.startVideoViewing(userId, videoId);

      console.log(`[VIEW START] Session created: ${session.id}`);

      res.json({
        sessionId: session.id,
        message: "Video viewing session started"
      });
    } catch (error: any) {
      console.error("[VIEW START] Error starting video viewing:", error);
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

      console.log(`[VIEW COMPLETE] User ${userId} completing view for video ${videoId}, session ${sessionId}`);

      if (!sessionId) {
        console.error("[VIEW COMPLETE] No session ID provided");
        return res.status(400).json({ message: "Session ID is required" });
      }

      // Complete the viewing session (server validates timing)
      const result = await storage.completeVideoViewing(sessionId);

      console.log(`[VIEW COMPLETE] Session completed:`, {
        creditAwarded: result.creditAwarded,
        sessionId: sessionId
      });

      res.json({
        creditAwarded: result.creditAwarded,
        watchDuration: result.session.completedAt && result.session.startedAt ? Math.floor((new Date(result.session.completedAt).getTime() - new Date(result.session.startedAt).getTime()) / 1000) : 0,
        message: result.creditAwarded ? "Credit earned!" : "Session completed, minimum watch time not met"
      });
    } catch (error: any) {
      console.error("[VIEW COMPLETE] Error completing video viewing:", error);
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

      console.log(`[FAVORITE] User ${userId} favoriting video ${videoId}`);

      // Check if video exists
      const video = await storage.getVideo(videoId);
      if (!video) {
        console.error(`[FAVORITE] Video not found: ${videoId}`);
        return res.status(404).json({ message: "Video not found" });
      }

      // Check if already favorited
      const isAlreadyFavorited = await storage.isVideoFavorited(userId, videoId);
      if (isAlreadyFavorited) {
        console.log(`[FAVORITE] Video already favorited by user ${userId}`);
        return res.status(400).json({ message: "Video already favorited" });
      }

      const favorite = await storage.favoriteVideo({
        userId,
        videoId,
      });

      console.log(`[FAVORITE] Video favorited successfully: ${favorite.id}`);

      res.json({
        success: true,
        message: "Video added to favorites",
        favoriteId: favorite.id
      });
    } catch (error) {
      console.error("[FAVORITE] Error favoriting video:", error);
      res.status(500).json({ message: "Failed to favorite video" });
    }
  });

  app.post('/api/videos/:id/demo-click', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const videoId = req.params.id;

      console.log(`[DEMO CLICK] User ${userId} clicking demo link for video ${videoId}`);

      // Check if video exists
      const video = await storage.getVideo(videoId);
      if (!video) {
        console.error(`[DEMO CLICK] Video not found: ${videoId}`);
        return res.status(404).json({ message: "Video not found" });
      }

      const click = await storage.recordDemoLinkClick({
        userId,
        videoId,
      });

      console.log(`[DEMO CLICK] Demo link click recorded: ${click.id}`);

      res.json({
        success: true,
        message: "Demo link click recorded",
        clickId: click.id
      });
    } catch (error) {
      console.error("[DEMO CLICK] Error recording demo link click:", error);
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


  // Credit purchase routes with Stripe integration
  
  // Create payment intent for credit purchase
  app.post('/api/credits/create-payment-intent', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { packageId } = req.body;

      if (!packageId) {
        return res.status(400).json({ message: "Package ID is required" });
      }

      // Validate package ID against server-side definition
      const selectedPackage = CREDIT_PACKAGES[packageId as PackageId];
      if (!selectedPackage) {
        return res.status(400).json({ message: "Invalid package ID" });
      }

      // Get user for customer info
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Calculate total credits including bonus
      const bonus = 'bonus' in selectedPackage ? selectedPackage.bonus : 0;
      const totalCredits = selectedPackage.credits + bonus;

      // Create Stripe Payment Intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(selectedPackage.price * 100), // Convert to cents
        currency: "usd",
        metadata: {
          userId,
          packageId,
          credits: selectedPackage.credits.toString(),
          bonus: bonus.toString(),
          totalCredits: totalCredits.toString()
        },
        description: `Credits purchase: ${selectedPackage.credits} credits${bonus > 0 ? ` + ${bonus} bonus` : ''}`
      });

      res.json({ 
        clientSecret: paymentIntent.client_secret,
        package: selectedPackage,
        totalCredits
      });
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ message: error.message || "Failed to create payment intent" });
    }
  });

  // Complete credit purchase after successful payment
  app.post('/api/credits/purchase-complete', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { paymentIntentId } = req.body;

      if (!paymentIntentId) {
        return res.status(400).json({ message: "Payment intent ID is required" });
      }

      // Retrieve the payment intent to verify it was successful
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ message: "Payment not completed" });
      }

      // Verify the payment belongs to the current user
      if (paymentIntent.metadata.userId !== userId) {
        return res.status(403).json({ message: "Payment verification failed" });
      }

      // Extract and validate metadata
      const { packageId, credits, bonus, totalCredits } = paymentIntent.metadata;
      
      if (!packageId || !totalCredits) {
        return res.status(400).json({ message: "Invalid payment intent metadata" });
      }

      // Validate package pricing against server-side definition
      const serverPackage = CREDIT_PACKAGES[packageId as PackageId];
      if (!serverPackage) {
        return res.status(400).json({ message: "Invalid package in payment intent" });
      }

      // Validate payment amount matches server-side pricing
      const expectedAmount = Math.round(serverPackage.price * 100);
      if (paymentIntent.amount !== expectedAmount) {
        return res.status(400).json({ message: "Payment amount validation failed" });
      }

      // Validate credit amounts match server-side calculation
      const expectedBonus = 'bonus' in serverPackage ? serverPackage.bonus || 0 : 0;
      const expectedTotalCredits = serverPackage.credits + expectedBonus;
      if (parseInt(totalCredits) !== expectedTotalCredits) {
        return res.status(400).json({ message: "Credit amount validation failed" });
      }

      // Check if we already processed this payment
      const existingTransaction = await storage.getUserCreditTransactions(userId, 100);
      const alreadyProcessed = existingTransaction.find(
        t => t.reason?.includes(paymentIntentId)
      );

      if (alreadyProcessed) {
        return res.status(400).json({ message: "Payment already processed" });
      }

      // Use server-validated values instead of trusting metadata
      const creditsToAdd = expectedTotalCredits;

      // Add credits to user account
      await storage.updateUserCredits(userId, creditsToAdd);
      
      // Record the transaction
      await storage.recordCreditTransaction({
        userId,
        type: 'purchase',
        amount: creditsToAdd,
        reason: `Purchased ${serverPackage.credits} credits${expectedBonus > 0 ? ` + ${expectedBonus} bonus` : ''} for $${(paymentIntent.amount / 100).toFixed(2)} (${paymentIntentId})`,
      });

      res.json({
        success: true,
        credits: creditsToAdd,
        package: {
          id: packageId,
          credits: serverPackage.credits,
          bonus: expectedBonus,
          price: paymentIntent.amount / 100
        },
        message: "Credits purchased successfully"
      });
    } catch (error: any) {
      console.error("Error completing purchase:", error);
      res.status(500).json({ message: error.message || "Failed to complete purchase" });
    }
  });

  // Legacy purchase route (deprecated - use create-payment-intent instead)
  app.post('/api/credits/purchase', isAuthenticated, async (req: any, res) => {
    res.status(410).json({ 
      message: "This endpoint is deprecated. Use /api/credits/create-payment-intent instead.",
      deprecated: true
    });
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

  // Seed placeholder videos (idempotent-ish for quick testing)
  app.post('/api/dev/seed-placeholder-videos', async (_req, res) => {
    try {
      // Create a demo user if missing
      const demoUser = await storage.upsertUser({
        id: 'demo-user',
        email: 'demo@shipshow.io',
        firstName: 'Demo',
        lastName: 'User',
        credits: 1000,
      });

      const titles = Array.from({ length: 10 }, (_, i) => `Demo Product ${i + 1}`);
      for (const [index, title] of titles.entries()) {
        const video = await storage.createVideoWithTags({
          title,
          description: 'Placeholder demo video for testing feed and dashboard.',
          productUrl: 'https://example.com',
          videoPath: `/objects/demo/${index + 1}.mp4`,
          creatorId: demoUser.id,
          tags: ['demo', 'test']
        } as any);

        // Add a little stats so they show up
        await storage.updateDailyStats(video.id, Math.floor(Math.random() * 50) + 1, Math.floor(Math.random() * 20));
      }

      res.json({ ok: true });
    } catch (e: any) {
      console.error('Seed failed', e);
      res.status(500).json({ error: e?.message || 'Seed failed' });
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
    if (!enableFileStorage) {
      return res.status(503).json({ error: "File uploads are disabled in this environment" });
    }
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL });
  });

  app.put("/api/videos/video-file", isAuthenticated, async (req: any, res) => {
    if (!enableFileStorage) {
      return res.status(503).json({ error: "File storage is disabled in this environment" });
    }
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
