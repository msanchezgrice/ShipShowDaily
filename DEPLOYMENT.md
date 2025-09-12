# ShipShow.io - Deployment Guide

## Quick Deploy to Vercel

This guide will help you deploy ShipShow.io from GitHub to Vercel with all necessary configurations.

## Prerequisites

Before deploying, ensure you have accounts for:
- [GitHub](https://github.com) (for code hosting)
- [Vercel](https://vercel.com) (for deployment)
- [Clerk](https://clerk.com) (for authentication)
- [Stripe](https://stripe.com) (for payments)
- [Neon](https://neon.tech) or any PostgreSQL provider (for database)
- [Google Cloud Platform](https://cloud.google.com) (for file storage) - *Optional, see alternatives below*

## Step 1: Prepare Your Code

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Verify Files**: Ensure these files are in your repository:
   - `vercel.json` ✅ (already created)
   - `.env.example` ✅ (already created)
   - `package.json` with build scripts ✅

## Step 2: Set Up External Services

### 2.1 Database Setup (Neon PostgreSQL)

1. Go to [Neon Console](https://console.neon.tech)
2. Create a new project
3. Copy the connection string from **Connection Details**
4. Save this as `DATABASE_URL` for later

### 2.2 Authentication Setup (Clerk)

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Create a new application
3. Go to **API Keys** section
4. Copy:
   - **Secret Key** → Save as `CLERK_SECRET_KEY`
   - **Publishable Key** → Save as `VITE_CLERK_PUBLISHABLE_KEY`

### 2.3 Payment Setup (Stripe)

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Get your API keys from **Developers > API Keys**:
   - **Secret Key** → Save as `STRIPE_SECRET_KEY`
   - **Publishable Key** → Save as `VITE_STRIPE_PUBLIC_KEY`
3. Set up webhooks:
   - Go to **Developers > Webhooks**
   - Add endpoint: `https://your-domain.vercel.app/api/stripe/webhook`
   - Select events: `payment_intent.succeeded`
   - Copy **Signing Secret** → Save as `STRIPE_WEBHOOK_SECRET`

### 2.4 File Storage Setup

#### Option A: Google Cloud Storage (Recommended)
1. Create a [Google Cloud Project](https://console.cloud.google.com)
2. Enable **Cloud Storage API**
3. Create a storage bucket
4. Create a service account with **Storage Admin** role
5. Download service account JSON key
6. Set up environment variables:
   - `PUBLIC_OBJECT_SEARCH_PATHS=/your-bucket-name/public`
   - `PRIVATE_OBJECT_DIR=/your-bucket-name/.private`

#### Option B: Alternative Storage Solutions
For simpler deployment, consider using:
- **Vercel Blob Storage**
- **AWS S3**
- **Cloudinary**

*Note: You'll need to modify the storage configuration in `server/objectStorage.ts` if using alternatives.*

## Step 3: Deploy to Vercel

### 3.1 Connect Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"New Project"**
3. Import your GitHub repository
4. Vercel will auto-detect the framework

### 3.2 Configure Environment Variables

In the Vercel deployment settings, add these environment variables:

**Database:**
- `DATABASE_URL` = `postgresql://...` (from Neon)

**Authentication:**
- `CLERK_SECRET_KEY` = `sk_...` (from Clerk)
- `VITE_CLERK_PUBLISHABLE_KEY` = `pk_...` (from Clerk)

**Payments:**
- `STRIPE_SECRET_KEY` = `sk_...` (from Stripe)
- `STRIPE_WEBHOOK_SECRET` = `whsec_...` (from Stripe)
- `VITE_STRIPE_PUBLIC_KEY` = `pk_...` (from Stripe)

**Storage (if using Google Cloud):**
- `PUBLIC_OBJECT_SEARCH_PATHS` = `/your-bucket-name/public`
- `PRIVATE_OBJECT_DIR` = `/your-bucket-name/.private`

**System:**
- `NODE_ENV` = `production`
- `PORT` = `5000`

### 3.3 Deploy

1. Click **"Deploy"**
2. Wait for build to complete (usually 2-3 minutes)
3. Your app will be available at `https://your-project.vercel.app`

## Step 4: Post-Deployment Configuration

### 4.1 Update Stripe Webhook URL
1. Go back to Stripe Dashboard > Webhooks
2. Update your webhook endpoint to your actual Vercel URL:
   `https://your-actual-domain.vercel.app/api/stripe/webhook`

### 4.2 Update Clerk Settings
1. In Clerk Dashboard, go to **Domains**
2. Add your Vercel domain to allowed origins
3. Update any redirect URLs if needed

### 4.3 Database Migration
Run the database migration to set up tables:
```bash
npm run db:push
```

*Note: You can run this locally with your production DATABASE_URL, or set up a GitHub Action for automated migrations.*

## Step 5: Custom Domain (Optional)

### 5.1 Add Domain in Vercel
1. Go to your project in Vercel Dashboard
2. Go to **Settings > Domains**
3. Add your custom domain
4. Follow DNS configuration instructions

### 5.2 Update Service Configurations
After adding custom domain, update:
- **Stripe webhook URL** to use your custom domain
- **Clerk allowed origins** to include your custom domain

## Environment Variables Quick Reference

Copy this template to your Vercel environment variables:

```env
# Database
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require

# Authentication  
CLERK_SECRET_KEY=sk_test_your_clerk_secret_key_here
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_publishable_key_here

# Payments
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret_here
VITE_STRIPE_PUBLIC_KEY=pk_test_your_stripe_publishable_key_here

# Storage (Google Cloud)
PUBLIC_OBJECT_SEARCH_PATHS=/your-bucket-name/public
PRIVATE_OBJECT_DIR=/your-bucket-name/.private

# System
NODE_ENV=production
PORT=5000
```

## Troubleshooting

### Common Issues

**Build Errors:**
- Ensure all environment variables are set
- Check that dependencies are properly installed
- Verify TypeScript compilation passes

**Database Connection Issues:**
- Confirm DATABASE_URL is correct
- Check that database allows connections from Vercel IPs
- Verify SSL mode is enabled

**Authentication Problems:**
- Double-check Clerk API keys
- Ensure domain is added to Clerk settings
- Verify CORS configuration

**Payment Issues:**
- Confirm Stripe webhook URL is correct
- Check webhook signing secret
- Verify webhook events are properly configured

**File Upload Problems:**
- Ensure Google Cloud Storage bucket exists
- Verify service account has proper permissions
- Check bucket CORS configuration

### Getting Help

- **Vercel Deployment Issues**: [Vercel Documentation](https://vercel.com/docs)
- **Database Problems**: [Neon Documentation](https://neon.tech/docs)
- **Authentication Issues**: [Clerk Documentation](https://clerk.com/docs)
- **Payment Problems**: [Stripe Documentation](https://stripe.com/docs)

## Security Checklist

Before going live:
- [ ] All API keys are environment variables (not hardcoded)
- [ ] Database has proper access controls
- [ ] Stripe webhooks use signing secrets
- [ ] CORS is properly configured
- [ ] Rate limiting is implemented where needed
- [ ] Error messages don't expose sensitive information

## Performance Optimization

- [ ] Enable Vercel Analytics
- [ ] Set up proper caching headers
- [ ] Optimize images and videos
- [ ] Enable database connection pooling
- [ ] Monitor serverless function cold starts

---

**Congratulations!** 🎉 Your ShipShow.io app should now be live on Vercel!

For ongoing maintenance, consider setting up:
- Automated deployments on git push
- Database backup strategies  
- Monitoring and alerting
- CI/CD pipelines for testing