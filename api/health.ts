import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Health check endpoint
 * GET /api/health
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    checks: {
      database: false,
      cloudflare: false,
      clerk: false,
    },
  };

  // Check database
  if (process.env.DATABASE_URL) {
    try {
      const postgres = (await import('postgres')).default;
      const client = postgres(process.env.DATABASE_URL, {
        max: 1,
        idle_timeout: 5,
        connect_timeout: 5,
        ssl: 'require',
        prepare: false,
      });
      await client`SELECT 1`;
      await client.end();
      health.checks.database = true;
    } catch {
      health.checks.database = false;
    }
  }

  // Check Cloudflare credentials exist
  health.checks.cloudflare = !!(
    process.env.CLOUDFLARE_ACCOUNT_ID &&
    process.env.CLOUDFLARE_STREAM_API_TOKEN
  );

  // Check Clerk credentials exist
  health.checks.clerk = !!process.env.CLERK_SECRET_KEY;

  // Overall status
  const allHealthy = Object.values(health.checks).every(Boolean);
  health.status = allHealthy ? 'ok' : 'degraded';

  return res.status(allHealthy ? 200 : 503).json(health);
}
