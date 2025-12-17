import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../_lib/storage';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    const user = await storage.getUser('test-id-that-does-not-exist');
    
    return res.status(200).json({
      success: true,
      storageImported: true,
      userResult: user || 'no user found (expected)'
    });
    
  } catch (e: any) {
    return res.status(200).json({
      success: false,
      error: e.message,
      stack: e.stack
    });
  }
}
