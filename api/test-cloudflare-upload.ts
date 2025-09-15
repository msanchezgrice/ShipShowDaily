import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
    const CLOUDFLARE_STREAM_API_TOKEN = process.env.CLOUDFLARE_STREAM_API_TOKEN;
    
    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_STREAM_API_TOKEN) {
      return res.status(500).json({ error: 'Cloudflare not configured' });
    }
    
    // Create a direct upload URL
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/direct_upload`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maxDurationSeconds: 30,
          requireSignedURLs: false,
          allowedOrigins: ['*'],
          meta: {
            name: 'Test Upload',
          },
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ 
        error: 'Cloudflare API error',
        status: response.status,
        detail: error 
      });
    }
    
    const data = await response.json();
    
    return res.status(200).json({
      success: true,
      uploadUrl: data.result?.uploadURL,
      uid: data.result?.uid,
      instructions: 'Upload a video file to the uploadUrl using PUT request',
      example: `curl -X PUT ${data.result?.uploadURL} --upload-file your-video.mp4`
    });
    
  } catch (error: any) {
    return res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
}