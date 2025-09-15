import type { VercelRequest, VercelResponse } from '@vercel/node';

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_STREAM_API_TOKEN = process.env.CLOUDFLARE_STREAM_API_TOKEN;

interface InitUploadBody {
  title: string;
  description?: string;
  productUrl: string;
  tags?: string[];
  maxDurationSeconds?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Check authentication
    const token = req.headers.authorization?.toString().replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify token with Clerk
    const { createClerkClient } = await import('@clerk/clerk-sdk-node');
    const clerk = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
    
    let userId: string;
    try {
      const payload = await clerk.verifyToken(token);
      userId = payload.sub;
      if (!userId) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Validate request body
    const body = req.body as InitUploadBody;
    if (!body.title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!body.productUrl) {
      return res.status(400).json({ error: 'Product URL is required' });
    }

    // Check environment variables
    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_STREAM_API_TOKEN) {
      console.error('Missing Cloudflare credentials');
      return res.status(500).json({ error: 'Video upload service not configured' });
    }

    const maxDurationSeconds = body.maxDurationSeconds || 30;

    // Dynamic imports for database
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const postgres = (await import('postgres')).default;
    const { videos } = await import('../../shared/schema.js');
    const { eq } = await import('drizzle-orm');
    
    // Create database connection
    const client = postgres(process.env.DATABASE_URL!, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: 'require',
      prepare: false,
    });
    const db = drizzle(client);

    try {
      // 1. Create database entry with status 'uploading'
      const [videoRow] = await db
        .insert(videos)
        .values({
          title: body.title,
          description: body.description || '',
          productUrl: body.productUrl,
          videoPath: '', // Will be updated by webhook
          creatorId: userId,
          provider: 'stream',
          status: 'uploading',
          isActive: false, // Will be activated when ready
        })
        .returning();

      // 2. Request direct upload URL from Cloudflare Stream
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/direct_upload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            maxDurationSeconds,
            requireSignedURLs: false, // Set to true for private videos
            allowedOrigins: [
              'www.shipshow.io',
              'shipshow.io',
              'localhost:3000', // For development
            ],
            meta: {
              videoId: videoRow.id,
              userId: userId,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('Cloudflare API error:', error);
        
        // Clean up database entry
        await db.delete(videos).where(eq(videos.id, videoRow.id));
        await client.end();
        
        return res.status(502).json({ 
          error: 'Failed to initialize upload',
          detail: process.env.NODE_ENV === 'development' ? error : undefined 
        });
      }

      const cloudflareData = await response.json();
      const { uploadURL, uid } = cloudflareData.result || {};

      if (!uploadURL || !uid) {
        // Clean up database entry
        await db.delete(videos).where(eq(videos.id, videoRow.id));
        await client.end();
        
        return res.status(502).json({ error: 'Invalid response from upload service' });
      }

      // 3. Update video with Cloudflare asset ID
      await db
        .update(videos)
        .set({
          provider_asset_id: uid,
          status: 'processing',
        })
        .where(eq(videos.id, videoRow.id));

      await client.end();

      // 4. Return upload URL and video ID to client
      return res.status(201).json({
        videoId: videoRow.id,
        uploadUrl: uploadURL,
        uploadId: uid,
        provider: 'stream',
        maxDurationSeconds,
      });

    } catch (dbError: any) {
      console.error('Database error:', dbError);
      await client.end();
      return res.status(500).json({ 
        error: 'Failed to create video entry',
        detail: process.env.NODE_ENV === 'development' ? dbError.message : undefined
      });
    }

  } catch (error: any) {
    console.error('Handler error:', error);
    return res.status(500).json({ 
      error: 'Failed to initialize video upload',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}