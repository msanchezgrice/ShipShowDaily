import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Test dynamic imports
    const imports = [];
    
    // Test db import
    try {
      const { db } = await import('./_lib/db');
      imports.push('db: success');
    } catch (e: any) {
      imports.push(`db: ${e.message}`);
    }
    
    // Test schema import
    try {
      const schema = await import('../shared/schema');
      imports.push('schema: success');
    } catch (e: any) {
      imports.push(`schema: ${e.message}`);
    }
    
    // Test auth import
    try {
      const auth = await import('./_lib/auth');
      imports.push('auth: success');
    } catch (e: any) {
      imports.push(`auth: ${e.message}`);
    }
    
    // Test storage import
    try {
      const storage = await import('./_lib/storage');
      imports.push('storage: success');
    } catch (e: any) {
      imports.push(`storage: ${e.message}`);
    }
    
    return res.status(200).json({
      success: true,
      imports,
      cwd: process.cwd(),
      env: {
        hasDatabase: !!process.env.DATABASE_URL,
        hasClerk: !!process.env.CLERK_SECRET_KEY,
        hasCloudflare: !!process.env.CLOUDFLARE_ACCOUNT_ID,
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
}