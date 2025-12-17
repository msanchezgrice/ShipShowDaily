import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const results: Record<string, any> = {
    step: 'start',
    errors: []
  };
  
  try {
    results.step = 'importing db';
    const { db } = await import('../_lib/db');
    results.dbImported = true;
    
    results.step = 'importing storage';
    const { storage } = await import('../_lib/storage');
    results.storageImported = true;
    
    results.step = 'testing getUser';
    const user = await storage.getUser('test-id-that-does-not-exist');
    results.getUserWorks = true;
    results.userResult = user || 'no user found (expected)';
    
    results.step = 'done';
    results.success = true;
    
  } catch (e: any) {
    results.error = e.message;
    results.stack = e.stack;
    results.success = false;
  }
  
  return res.status(200).json(results);
}
