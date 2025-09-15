import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const WEBHOOK_SECRET = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET;

/**
 * Verify Cloudflare webhook signature
 * Format: "time=1234567890,sig1=abc123..."
 */
function verifyWebhookSignature(secret: string, signature: string, body: string): boolean {
  if (!signature || !secret) return false;

  try {
    // Parse signature header
    const parts = signature.split(',').reduce((acc, part) => {
      const [key, value] = part.split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    const time = parts['time'];
    const sig1 = parts['sig1'];

    if (!time || !sig1) return false;

    // Compute expected signature: HMAC-SHA256(secret, time + "." + body)
    const message = `${time}.${body}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('hex');

    // Compare signatures (case-insensitive)
    return expectedSignature.toLowerCase() === sig1.toLowerCase();
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

interface CloudflareWebhookPayload {
  uid: string;
  readyToStream?: boolean;
  status?: {
    state: 'ready' | 'error' | 'queued' | 'inprogress';
    pctComplete?: number;
    errorReasonCode?: string;
    errorReasonText?: string;
  };
  playback?: {
    hls: string;
    dash: string;
  };
  thumbnail?: string;
  thumbnailTimestampPct?: number;
  duration?: number;
  input?: {
    width: number;
    height: number;
  };
  meta?: {
    videoId?: string;
    userId?: string;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Read raw body for signature verification
  const rawBody = typeof req.body === 'string' 
    ? req.body 
    : JSON.stringify(req.body);

  // Verify webhook signature
  const signature = req.headers['webhook-signature'] as string;
  
  if (!WEBHOOK_SECRET) {
    console.error('CLOUDFLARE_STREAM_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  if (!verifyWebhookSignature(WEBHOOK_SECRET, signature, rawBody)) {
    console.error('Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  try {
    // Dynamic imports for database
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const postgres = (await import('postgres')).default;
    const { eq } = await import('drizzle-orm');
    const { videos } = await import('../../shared/schema.js');
    
    // Create database connection
    const client = postgres(process.env.DATABASE_URL!, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: 'require',
      prepare: false,
    });
    const db = drizzle(client);

    // Parse webhook payload
    const payload: CloudflareWebhookPayload = typeof req.body === 'string' 
      ? JSON.parse(req.body) 
      : req.body;

    const { uid, readyToStream, status, playback, thumbnail, duration, input, meta } = payload;

    if (!uid) {
      await client.end();
      return res.status(400).json({ error: 'Missing video UID' });
    }

    console.log(`Processing webhook for video UID: ${uid}, status: ${status?.state}, ready: ${readyToStream}`);

    // Handle different webhook states
    if (status?.state === 'ready' && readyToStream) {
      // Video is ready for streaming
      const updateData: any = {
        status: 'ready',
        isActive: true, // Activate the video
      };
      
      // Check if this is a manual upload without a videoId in metadata
      const isManualUpload = !meta?.videoId;

      // Add playback URLs if provided
      if (playback?.hls) {
        updateData.videoPath = playback.hls;
      }

      // Generate fallback HLS URL if not provided
      if (!updateData.videoPath) {
        // Use standard Cloudflare Stream URL pattern
        updateData.videoPath = `https://customer-9ksvtbxydg4qnz1j.cloudflarestream.com/${uid}/manifest/video.m3u8`;
      }

      // Add thumbnail if provided
      if (thumbnail) {
        updateData.thumbnailPath = thumbnail;
      } else {
        // Generate default thumbnail URL
        updateData.thumbnailPath = `https://customer-9ksvtbxydg4qnz1j.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg?time=1s`;
      }

      if (isManualUpload) {
        // This is a manual upload from Cloudflare dashboard
        // Create a new video entry with demo-user-1 as creator
        console.log(`Creating new video entry for manual upload: ${uid}`);
        
        try {
          await db
            .insert(videos)
            .values({
              title: `Manual Upload ${uid.substring(0, 8)}`,
              description: 'Video uploaded via Cloudflare dashboard',
              productUrl: 'https://example.com',
              videoPath: updateData.videoPath || '',
              thumbnailPath: updateData.thumbnailPath || '',
              creatorId: 'demo-user-1', // Use demo user for manual uploads
              provider: 'stream',
              provider_asset_id: uid,
              status: 'ready',
              isActive: true,
            });
          
          console.log(`Created video entry for manual upload: ${uid}`);
        } catch (insertError: any) {
          // Video might already exist, try updating instead
          console.log(`Video might already exist, trying update for: ${uid}`);
          await db
            .update(videos)
            .set(updateData)
            .where(eq(videos.provider_asset_id, uid));
        }
      } else {
        // Normal flow - update existing video
        const result = await db
          .update(videos)
          .set(updateData)
          .where(eq(videos.provider_asset_id, uid))
          .returning();

        if (result.length === 0) {
          console.error(`Video not found for UID: ${uid}`);
          // Try updating by meta.videoId if provided
          if (meta?.videoId) {
            await db
              .update(videos)
              .set(updateData)
              .where(eq(videos.id, meta.videoId));
          }
        }
      }

      console.log(`Video ${uid} marked as ready`);

    } else if (status?.state === 'error') {
      // Video processing failed
      const errorMessage = status.errorReasonText || status.errorReasonCode || 'Unknown error';
      
      await db
        .update(videos)
        .set({
          status: 'failed',
          isActive: false,
        })
        .where(eq(videos.provider_asset_id, uid));

      console.error(`Video ${uid} processing failed: ${errorMessage}`);

    } else if (status?.state === 'inprogress' || status?.state === 'queued') {
      // Video is still processing
      console.log(`Video ${uid} is ${status.state}, progress: ${status.pctComplete}%`);
      
      // Optionally update processing progress
      await db
        .update(videos)
        .set({
          status: 'processing',
        })
        .where(eq(videos.provider_asset_id, uid));
    }

    await client.end();

    // Return success response
    return res.status(200).json({ 
      success: true,
      message: `Webhook processed for ${uid}` 
    });

  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ 
      error: 'Failed to process webhook',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}