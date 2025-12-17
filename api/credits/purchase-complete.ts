import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_ORIGINS = ['https://shipshow.io', 'https://www.shipshow.io', 'http://localhost:3000', 'http://localhost:5173'];

// Server-side credit packages definition
const CREDIT_PACKAGES = {
  starter: { credits: 100, price: 5 },
  popular: { credits: 500, price: 20, bonus: 50 },
  pro: { credits: 1000, price: 35, bonus: 200 },
  premium: { credits: 2500, price: 75, bonus: 750 }
} as const;

type PackageId = keyof typeof CREDIT_PACKAGES;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin as string;
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let client;

  try {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.DATABASE_URL) {
      return res.status(500).json({ error: 'Server not configured' });
    }

    // Dynamic imports
    const postgres = (await import('postgres')).default;
    const { sql } = await import('drizzle-orm');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const { createClerkClient } = await import('@clerk/clerk-sdk-node');
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Require authentication
    const token = req.headers.authorization?.toString().replace('Bearer ', '');
    if (!token || !process.env.CLERK_SECRET_KEY) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const payload = await clerk.verifyToken(token);
    if (!payload.sub) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    const userId = payload.sub;

    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Payment intent ID is required' });
    }

    // Retrieve the payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // Verify the payment belongs to the current user
    if (paymentIntent.metadata.userId !== userId) {
      return res.status(403).json({ error: 'Payment verification failed' });
    }

    // Extract and validate metadata
    const { packageId, totalCredits } = paymentIntent.metadata;
    
    if (!packageId || !totalCredits) {
      return res.status(400).json({ error: 'Invalid payment intent metadata' });
    }

    // Validate package
    const serverPackage = CREDIT_PACKAGES[packageId as PackageId];
    if (!serverPackage) {
      return res.status(400).json({ error: 'Invalid package in payment intent' });
    }

    // Validate payment amount
    const expectedAmount = Math.round(serverPackage.price * 100);
    if (paymentIntent.amount !== expectedAmount) {
      return res.status(400).json({ error: 'Payment amount validation failed' });
    }

    const expectedBonus = 'bonus' in serverPackage ? serverPackage.bonus || 0 : 0;
    const expectedTotalCredits = serverPackage.credits + expectedBonus;

    client = postgres(process.env.DATABASE_URL, {
      max: 1, idle_timeout: 20, connect_timeout: 10, ssl: 'require', prepare: false,
    });
    const db = drizzle(client);

    // Check if already processed
    const existingResult = await db.execute(sql`
      SELECT id FROM credit_transactions WHERE reason LIKE ${'%' + paymentIntentId + '%'} LIMIT 1
    `);
    if (existingResult.length > 0) {
      return res.status(400).json({ error: 'Payment already processed' });
    }

    // Add credits to user
    await db.execute(sql`
      UPDATE users SET credits = credits + ${expectedTotalCredits} WHERE id = ${userId}
    `);
    
    // Record the transaction
    const reason = `Purchased ${serverPackage.credits} credits${expectedBonus > 0 ? ` + ${expectedBonus} bonus` : ''} for $${(paymentIntent.amount / 100).toFixed(2)} (${paymentIntentId})`;
    await db.execute(sql`
      INSERT INTO credit_transactions (user_id, type, amount, reason)
      VALUES (${userId}, 'purchase', ${expectedTotalCredits}, ${reason})
    `);

    return res.status(200).json({
      success: true,
      credits: expectedTotalCredits,
      package: {
        id: packageId,
        credits: serverPackage.credits,
        bonus: expectedBonus,
        price: paymentIntent.amount / 100
      },
      message: 'Credits purchased successfully'
    });
  } catch (error: any) {
    console.error('Purchase complete error:', error);
    return res.status(500).json({ error: error.message || 'Failed to complete purchase' });
  } finally {
    if (client) await client.end();
  }
}