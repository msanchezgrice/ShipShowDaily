import type { VercelRequest, VercelResponse } from '@vercel/node';
import { storage } from '../_lib/storage';
import { validateMethod, handleError, sendSuccess } from '../_lib/utils';
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

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

    const sig = req.headers['stripe-signature'];
    let event: Stripe.Event;

    try {
      // Verify webhook signature if secret is configured
      if (webhookSecret && sig) {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } else {
        // Fallback to parsing body without signature verification
        // This is less secure but works in development without webhook secret
        event = req.body;
      }
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      // Handle payment_intent.succeeded event
      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        console.log('Payment succeeded via webhook:', paymentIntent.id);

        // Extract metadata from payment intent
        const { userId, packageId, credits, bonus, totalCredits } = paymentIntent.metadata;
        
        if (!userId || !packageId || !totalCredits) {
          console.error('Missing required metadata in payment intent:', paymentIntent.id);
          return res.status(400).json({ error: 'Invalid payment intent metadata' });
        }

        // Validate package pricing against server-side definition
        const serverPackage = CREDIT_PACKAGES[packageId as PackageId];
        if (!serverPackage) {
          console.error('Invalid package ID in payment intent:', packageId);
          return res.status(400).json({ error: 'Invalid package in payment intent' });
        }

        // Validate payment amount matches server-side pricing
        const expectedAmount = Math.round(serverPackage.price * 100);
        if (paymentIntent.amount !== expectedAmount) {
          console.error(`Payment amount mismatch: expected ${expectedAmount}, got ${paymentIntent.amount}`);
          return res.status(400).json({ error: 'Payment amount validation failed' });
        }

        // Validate credit amounts match server-side calculation
        const expectedBonus = 'bonus' in serverPackage ? serverPackage.bonus || 0 : 0;
        const expectedTotalCredits = serverPackage.credits + expectedBonus;
        if (parseInt(totalCredits) !== expectedTotalCredits) {
          console.error(`Credit amount mismatch: expected ${expectedTotalCredits}, got ${totalCredits}`);
          return res.status(400).json({ error: 'Credit amount validation failed' });
        }

        // Check if we already processed this payment
        const existingTransaction = await storage.getUserCreditTransactions(userId, 100);
        const alreadyProcessed = existingTransaction.find(
          t => t.reason?.includes(paymentIntent.id)
        );

        if (alreadyProcessed) {
          console.log('Payment already processed:', paymentIntent.id);
          return res.json({ received: true, message: 'Payment already processed' });
        }

        // Add credits to user account
        const creditAmount = parseInt(totalCredits);
        await storage.updateUserCredits(userId, creditAmount);
        
        // Record the transaction
        await storage.recordCreditTransaction({
          userId,
          type: 'purchase',
          amount: creditAmount,
          reason: `Purchased ${credits} credits${bonus ? ` + ${bonus} bonus` : ''} for $${(paymentIntent.amount / 100).toFixed(2)} (${paymentIntent.id}) - Webhook`,
        });

        console.log(`Added ${creditAmount} credits to user ${userId} via webhook`);
      }

      // Return success response to Stripe
      return sendSuccess(res, { received: true });
    } catch (error: any) {
      console.error('Error processing webhook:', error);
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
  } catch (error) {
    return handleError(res, error, "Webhook processing failed");
  }
}