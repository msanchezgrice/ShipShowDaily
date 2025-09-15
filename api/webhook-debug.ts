import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('Webhook Debug - Method:', req.method);
  console.log('Webhook Debug - Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Webhook Debug - Body:', JSON.stringify(req.body, null, 2));
  
  // Log the raw body if available
  if (req.body) {
    console.log('Webhook Debug - Body Type:', typeof req.body);
    console.log('Webhook Debug - Body Keys:', Object.keys(req.body));
  }
  
  return res.status(200).json({ 
    success: true, 
    message: 'Debug info logged',
    method: req.method,
    hasBody: !!req.body,
    bodyType: typeof req.body,
    bodyKeys: req.body ? Object.keys(req.body) : []
  });
}