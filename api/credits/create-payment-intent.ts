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

  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    // Dynamic imports
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

    const { packageId } = req.body;

    if (!packageId) {
      return res.status(400).json({ error: 'Package ID is required' });
    }

    // Validate package ID
    const selectedPackage = CREDIT_PACKAGES[packageId as PackageId];
    if (!selectedPackage) {
      return res.status(400).json({ error: 'Invalid package ID' });
    }

    // Calculate total credits including bonus
    const bonus = 'bonus' in selectedPackage ? selectedPackage.bonus : 0;
    const totalCredits = selectedPackage.credits + bonus;

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(selectedPackage.price * 100),
      currency: 'usd',
      metadata: {
        userId,
        packageId,
        credits: selectedPackage.credits.toString(),
        bonus: bonus.toString(),
        totalCredits: totalCredits.toString()
      },
      description: `Credits purchase: ${selectedPackage.credits} credits${bonus > 0 ? ` + ${bonus} bonus` : ''}`
    });

    return res.status(200).json({ 
      clientSecret: paymentIntent.client_secret,
      package: selectedPackage,
      totalCredits
    });
  } catch (error: any) {
    console.error('Payment intent error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create payment intent' });
  }
}