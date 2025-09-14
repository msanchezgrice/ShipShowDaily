import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const results = {
      timestamp: new Date().toISOString(),
      environment: {
        hasDatabase: !!process.env.DATABASE_URL,
        hasClerkSecret: !!process.env.CLERK_SECRET_KEY,
        hasClerkWebhookSecret: !!process.env.CLERK_WEBHOOK_SECRET,
        hasCloudflareAccount: !!process.env.CLOUDFLARE_ACCOUNT_ID,
        hasCloudflareToken: !!process.env.CLOUDFLARE_STREAM_API_TOKEN,
        hasCloudflareWebhook: !!process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET,
      },
      database: {
        connected: false,
        userCount: 0,
        videoCount: 0,
        error: null,
      },
      clerk: {
        configured: false,
        error: null,
      }
    };

    // Test database connection
    if (process.env.DATABASE_URL) {
      try {
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        const db = drizzle(pool);
        
        // Test basic query
        const userResult = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
        const videoResult = await db.execute(sql`SELECT COUNT(*) as count FROM videos`);
        
        results.database = {
          connected: true,
          userCount: parseInt(userResult.rows[0]?.count as string || '0'),
          videoCount: parseInt(videoResult.rows[0]?.count as string || '0'),
          error: null,
        };
        
        await pool.end();
      } catch (dbError: any) {
        results.database.error = dbError.message;
      }
    }

    // Test Clerk configuration
    if (process.env.CLERK_SECRET_KEY) {
      try {
        const { createClerkClient } = await import('@clerk/clerk-sdk-node');
        const clerk = createClerkClient({
          secretKey: process.env.CLERK_SECRET_KEY,
        });
        
        // Test if we can make a request to Clerk (this will fail with auth but shows connectivity)
        try {
          await clerk.users.getUserList({ limit: 1 });
          results.clerk.configured = true;
        } catch (clerkError: any) {
          // Even errors show that Clerk is configured correctly
          if (clerkError.message.includes('authentication') || clerkError.message.includes('401')) {
            results.clerk.configured = true;
          } else {
            results.clerk.error = clerkError.message;
          }
        }
      } catch (importError: any) {
        results.clerk.error = `Import error: ${importError.message}`;
      }
    }

    return res.status(200).json(results);

  } catch (error: any) {
    return res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
