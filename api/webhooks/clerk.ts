import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Webhook } from 'svix';
import { db } from '../_lib/db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

// Clerk webhook event types
interface ClerkWebhookEvent {
  type: string;
  data: any; // Clerk sends different data structures for different events
  event_attributes?: any;
  instance_id?: string;
  object: string;
  timestamp: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check webhook secret
  if (!CLERK_WEBHOOK_SECRET) {
    console.error('CLERK_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  try {
    // Get headers for verification
    const svixId = req.headers['svix-id'] as string;
    const svixTimestamp = req.headers['svix-timestamp'] as string; 
    const svixSignature = req.headers['svix-signature'] as string;

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error('Missing svix headers');
      return res.status(400).json({ error: 'Missing svix headers' });
    }

    // Get raw body for verification
    const body = JSON.stringify(req.body);
    
    // Verify webhook signature
    const wh = new Webhook(CLERK_WEBHOOK_SECRET);
    let evt: ClerkWebhookEvent;

    try {
      evt = wh.verify(body, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as ClerkWebhookEvent;
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    console.log(`Clerk webhook received: ${evt.type}`);

    // Handle different event types
    switch (evt.type) {
      case 'user.created':
        await handleUserCreated(evt.data);
        break;
      
      case 'user.updated':
        await handleUserUpdated(evt.data);
        break;
      
      case 'user.deleted':
        await handleUserDeleted(evt.data.id);
        break;

      case 'session.created':
      case 'email.created':
        // These events don't require database updates
        console.log(`Received ${evt.type} event, no action needed`);
        break;

      default:
        console.log(`Unhandled event type: ${evt.type}`);
    }

    return res.status(200).json({ success: true, message: `Processed ${evt.type}` });

  } catch (error: any) {
    console.error('Clerk webhook error:', error);
    return res.status(500).json({ 
      error: 'Webhook processing failed',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

async function handleUserCreated(userData: any) {
  console.log('Creating user in database:', userData.id);
  
  try {
    // Get email from email_addresses array or use a fallback
    let userEmail = null;
    
    if (userData.email_addresses && userData.email_addresses.length > 0) {
      const primaryEmail = userData.email_addresses.find(
        email => email.id === userData.primary_email_address_id
      ) || userData.email_addresses[0];
      userEmail = primaryEmail?.email_address;
    }
    
    // If no email, create a placeholder email
    if (!userEmail) {
      console.log('No email found for user, using placeholder:', userData.id);
      userEmail = `${userData.id}@placeholder.local`;
    }

    // Create user in database
    const [newUser] = await db
      .insert(users)
      .values({
        id: userData.id,
        email: userEmail,
        firstName: userData.first_name || '',
        lastName: userData.last_name || '',
        profileImageUrl: userData.profile_image_url || userData.image_url || '',
        credits: 10, // Default credits for new users
        totalCreditsEarned: 0,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userEmail,
          firstName: userData.first_name || '',
          lastName: userData.last_name || '',
          profileImageUrl: userData.profile_image_url || userData.image_url || '',
          updatedAt: new Date(),
        },
      })
      .returning();

    console.log('User created/updated in database:', newUser.id);
    
  } catch (error: any) {
    console.error('Error creating user in database:', error);
    throw error; // Re-throw to trigger webhook retry
  }
}

async function handleUserUpdated(userData: any) {
  console.log('Updating user in database:', userData.id);
  
  try {
    // Get email from email_addresses array or use existing
    let userEmail = null;
    
    if (userData.email_addresses && userData.email_addresses.length > 0) {
      const primaryEmail = userData.email_addresses.find(
        email => email.id === userData.primary_email_address_id
      ) || userData.email_addresses[0];
      userEmail = primaryEmail?.email_address;
    }

    // Build update object conditionally
    const updateData: any = {
      firstName: userData.first_name || '',
      lastName: userData.last_name || '',
      profileImageUrl: userData.profile_image_url || userData.image_url || '',
      updatedAt: new Date(),
    };
    
    // Only update email if we have one
    if (userEmail) {
      updateData.email = userEmail;
    }

    // Update user in database
    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userData.id));

    console.log('User updated in database:', userData.id);
    
  } catch (error: any) {
    console.error('Error updating user in database:', error);
    throw error; // Re-throw to trigger webhook retry
  }
}

async function handleUserDeleted(userId: string) {
  console.log('Deleting user from database:', userId);
  
  try {
    // Note: This will cascade delete related records due to foreign key constraints
    await db.delete(users).where(eq(users.id, userId));
    console.log('User deleted from database:', userId);
    
  } catch (error: any) {
    console.error('Error deleting user from database:', error);
  }
}
