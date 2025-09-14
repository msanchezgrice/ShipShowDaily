import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, sendUnauthorized } from '../_lib/auth';
import { validateMethod, handleError, sendSuccess } from '../_lib/utils';
import { db } from '../_lib/db';
import { videos } from '@shared/schema';

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
  try {
    // Only allow POST requests
    if (!validateMethod(req, res, ['POST'])) {
      return;
    }

    // Require authentication
    console.log('Checking authentication for cloudflare-init...');
    console.log('Authorization header:', req.headers.authorization ? 'Present' : 'Missing');
    
    const auth = await requireAuth(req);
    if (!auth) {
      console.log('Authentication failed for cloudflare-init');
      return sendUnauthorized(res);
    }
    
    console.log('Authentication successful for user:', auth.userId);

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

    try {
      // 1. Create database entry with status 'uploading'
      const [videoRow] = await db
        .insert(videos)
        .values({
          title: body.title,
          description: body.description || '',
          productUrl: body.productUrl,
          videoPath: '', // Will be updated by webhook
          creatorId: auth.userId,
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
              'https://www.shipshow.io',
              'https://shipshow.io',
              'http://localhost:3000', // For development
            ],
            meta: {
              videoId: videoRow.id,
              userId: auth.userId,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('Cloudflare API error:', error);
        
        // Clean up database entry
        await db.delete(videos).where(eq(videos.id, videoRow.id));
        
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

      // 4. Handle tags if provided
      if (body.tags && body.tags.length > 0) {
        // TODO: Add tag handling logic
        // This would involve creating/finding tags and linking them to the video
      }

      // 5. Return upload URL and video ID to client
      return sendSuccess(res, {
        videoId: videoRow.id,
        uploadUrl: uploadURL,
        uploadId: uid,
        provider: 'stream',
        maxDurationSeconds,
      }, 201);

    } catch (dbError: any) {
      console.error('Database error:', dbError);
      return res.status(500).json({ 
        error: 'Failed to create video entry',
        detail: process.env.NODE_ENV === 'development' ? dbError.message : undefined
      });
    }

  } catch (error) {
    return handleError(res, error, 'Failed to initialize video upload');
  }
}

// Import to fix TypeScript error
import { eq } from 'drizzle-orm';
