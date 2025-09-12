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

    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ message: "Payment intent ID is required" });
    }

    // Retrieve the payment intent to verify it was successful
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ message: "Payment not completed" });
    }

    // Verify the payment belongs to the current user
    if (paymentIntent.metadata.userId !== auth.userId) {
      return res.status(403).json({ message: "Payment verification failed" });
    }

    // Extract and validate metadata
    const { packageId, credits, bonus, totalCredits } = paymentIntent.metadata;
    
    if (!packageId || !totalCredits) {
      return res.status(400).json({ message: "Invalid payment intent metadata" });
    }

    // Validate package pricing against server-side definition
    const serverPackage = CREDIT_PACKAGES[packageId as PackageId];
    if (!serverPackage) {
      return res.status(400).json({ message: "Invalid package in payment intent" });
    }

    // Validate payment amount matches server-side pricing
    const expectedAmount = Math.round(serverPackage.price * 100);
    if (paymentIntent.amount !== expectedAmount) {
      return res.status(400).json({ message: "Payment amount validation failed" });
    }

    // Validate credit amounts match server-side calculation
    const expectedBonus = 'bonus' in serverPackage ? serverPackage.bonus || 0 : 0;
    const expectedTotalCredits = serverPackage.credits + expectedBonus;
    if (parseInt(totalCredits) !== expectedTotalCredits) {
      return res.status(400).json({ message: "Credit amount validation failed" });
    }

    // Check if we already processed this payment
    const existingTransaction = await storage.getUserCreditTransactions(auth.userId, 100);
    const alreadyProcessed = existingTransaction.find(
      t => t.reason?.includes(paymentIntentId)
    );

    if (alreadyProcessed) {
      return res.status(400).json({ message: "Payment already processed" });
    }

    // Use server-validated values instead of trusting metadata
    const creditsToAdd = expectedTotalCredits;

    // Add credits to user account
    await storage.updateUserCredits(auth.userId, creditsToAdd);
    
    // Record the transaction
    await storage.recordCreditTransaction({
      userId: auth.userId,
      type: 'purchase',
      amount: creditsToAdd,
      reason: `Purchased ${serverPackage.credits} credits${expectedBonus > 0 ? ` + ${expectedBonus} bonus` : ''} for $${(paymentIntent.amount / 100).toFixed(2)} (${paymentIntentId})`,
    });

    return sendSuccess(res, {
      success: true,
      credits: creditsToAdd,
      package: {
        id: packageId,
        credits: serverPackage.credits,
        bonus: expectedBonus,
        price: paymentIntent.amount / 100
      },
      message: "Credits purchased successfully"
    });
  } catch (error: any) {
    console.error("Error completing purchase:", error);
    return handleError(res, error, error.message || "Failed to complete purchase");
  }
}