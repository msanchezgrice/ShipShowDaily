import type { VercelRequest, VercelResponse } from '@vercel/node';
import { deleteDemoData } from './_lib/data';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Use DELETE method' });

  // Require secret key
  const authHeader = req.headers.authorization;
  const expectedKey = process.env.ADMIN_SECRET_KEY;
  
  if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
    return res.status(401).json({ error: 'Unauthorized. Pass ADMIN_SECRET_KEY as Bearer token.' });
  }
  
  try {
    await deleteDemoData();
    return res.status(200).json({ success: true, message: 'Demo data deleted' });
  } catch (error: any) {
    console.error('Cleanup error:', error);
    return res.status(500).json({ error: error.message });
  }
}
