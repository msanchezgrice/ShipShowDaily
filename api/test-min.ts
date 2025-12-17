import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    // Minimal test - just import the database module
    const { withDb } = await import('./_lib/database');
    
    const result = await withDb(async ({ db, schema }) => {
      return { tables: Object.keys(schema) };
    });
    
    return res.status(200).json({ success: true, result });
  } catch (e: any) {
    return res.status(200).json({
      success: false,
      error: e.message,
      stack: e.stack?.split('\n').slice(0, 10).join('\n')
    });
  }
}
