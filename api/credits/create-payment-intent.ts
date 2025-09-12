import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../../server/storage';
import { requireAuth, sendUnauthorized } from '../_lib/auth';
import { validateMethod, handleError, sendSuccess } from '../_lib/utils';
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Server-side credit packages definition - this is the authoritative source
const CREDIT_PACKAGES = {
  starter: { credits: 100, price: 5 },
  popular: { credits: 500, price: 20, bonus: 50 },
  pro: { credits: 1000, price: 35, bonus: 200 },
  premium: { credits: 2500, price: 75, bonus: 750 }
} as const;

type PackageId = keyof typeof CREDIT_PACKAGES;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Only allow POST requests
    if (!validateMethod(req, res, ['POST'])) {
      return;
    }

    // Require authentication
    const auth = await requireAuth(req);
    if (!auth) {
      return sendUnauthorized(res);
    }

    const { packageId } = req.body;

    if (!packageId) {
      return res.status(400).json({ message: "Package ID is required" });
    }

    // Validate package ID against server-side definition
    const selectedPackage = CREDIT_PACKAGES[packageId as PackageId];
    if (!selectedPackage) {
      return res.status(400).json({ message: "Invalid package ID" });
    }

    // Get user for customer info
    const user = await storage.getUser(auth.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Calculate total credits including bonus
    const bonus = 'bonus' in selectedPackage ? selectedPackage.bonus : 0;
    const totalCredits = selectedPackage.credits + bonus;

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(selectedPackage.price * 100), // Convert to cents
      currency: "usd",
      metadata: {
        userId: auth.userId,
        packageId,
        credits: selectedPackage.credits.toString(),
        bonus: bonus.toString(),
        totalCredits: totalCredits.toString()
      },
      description: `Credits purchase: ${selectedPackage.credits} credits${bonus > 0 ? ` + ${bonus} bonus` : ''}`
    });

    return sendSuccess(res, { 
      clientSecret: paymentIntent.client_secret,
      package: selectedPackage,
      totalCredits
    });
  } catch (error: any) {
    console.error("Error creating payment intent:", error);
    return handleError(res, error, error.message || "Failed to create payment intent");
  }
}