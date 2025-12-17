import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Diagnostic endpoint to verify Cloudflare Stream configuration
 * GET /api/debug/cloudflare-check
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
  const CLOUDFLARE_STREAM_API_TOKEN = process.env.CLOUDFLARE_STREAM_API_TOKEN;
  const CLOUDFLARE_STREAM_WEBHOOK_SECRET = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET;
  const DATABASE_URL = process.env.DATABASE_URL;

  const checks = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    envVars: {
      CLOUDFLARE_ACCOUNT_ID: CLOUDFLARE_ACCOUNT_ID ? `Set (${CLOUDFLARE_ACCOUNT_ID.substring(0, 8)}...)` : 'MISSING',
      CLOUDFLARE_STREAM_API_TOKEN: CLOUDFLARE_STREAM_API_TOKEN ? `Set (${CLOUDFLARE_STREAM_API_TOKEN.substring(0, 8)}...)` : 'MISSING',
      CLOUDFLARE_STREAM_WEBHOOK_SECRET: CLOUDFLARE_STREAM_WEBHOOK_SECRET ? `Set (${CLOUDFLARE_STREAM_WEBHOOK_SECRET.substring(0, 8)}...)` : 'MISSING',
      DATABASE_URL: DATABASE_URL ? 'Set' : 'MISSING',
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ? 'Set' : 'MISSING',
    },
    cloudflareApiTest: null as any,
  };

  // Test Cloudflare API connection if credentials are present
  if (CLOUDFLARE_ACCOUNT_ID && CLOUDFLARE_STREAM_API_TOKEN) {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
          },
        }
      );

      const data = await response.json();
      
      checks.cloudflareApiTest = {
        status: response.status,
        success: data.success,
        videoCount: data.result?.length || 0,
        errors: data.errors || [],
      };
    } catch (error: any) {
      checks.cloudflareApiTest = {
        error: error.message,
        status: 'FAILED',
      };
    }
  } else {
    checks.cloudflareApiTest = {
      status: 'SKIPPED',
      reason: 'Missing Cloudflare credentials',
    };
  }

  return res.status(200).json(checks);
}
