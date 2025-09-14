# Cloudflare Stream Setup Guide

## Prerequisites
- Cloudflare account with Stream enabled
- Vercel project deployed
- Supabase database configured

## Step 1: Enable Cloudflare Stream

1. **Log in to Cloudflare Dashboard**
   - Go to https://dash.cloudflare.com
   - Select your account

2. **Enable Stream**
   - Navigate to "Stream" in the sidebar
   - Click "Enable Stream"
   - Choose a plan (Start with Pay-as-you-go)

## Step 2: Get API Credentials

1. **Get Account ID**
   - In Cloudflare Dashboard, look at the right sidebar
   - Copy your "Account ID"

2. **Create API Token**
   - Go to "My Profile" → "API Tokens"
   - Click "Create Token"
   - Use "Custom token" template
   - Set permissions:
     - Account → Cloudflare Stream:Edit
     - Account → Cloudflare Stream:Read
   - Create and copy the token

## Step 3: Configure Webhook

1. **Set Webhook URL** (Run this command)
```bash
curl -X PUT \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  https://api.cloudflare.com/client/v4/accounts/YOUR_ACCOUNT_ID/stream/webhook \
  --data '{
    "notificationUrl": "https://www.shipshow.io/api/webhooks/cloudflare-stream"
  }'
```

2. **Save the Webhook Secret**
   - The response will contain: `{"result": {"secret": "YOUR_WEBHOOK_SECRET"}}`
   - Save this secret for environment variables

## Step 4: Run Database Migration

1. **Go to Supabase Dashboard**
   - Navigate to SQL Editor
   - Create new query

2. **Run Migration Script**
   - Copy contents from `scripts/cloudflare-stream-migration.sql`
   - Execute the query
   - Verify success

## Step 5: Set Environment Variables

### In Vercel Dashboard:

1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add these variables:

```env
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
CLOUDFLARE_STREAM_API_TOKEN=your_api_token_here
CLOUDFLARE_STREAM_WEBHOOK_SECRET=webhook_secret_from_step3
```

4. Deploy to apply changes

### For Local Development:

Add to `.env.local`:
```env
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
CLOUDFLARE_STREAM_API_TOKEN=your_api_token_here
CLOUDFLARE_STREAM_WEBHOOK_SECRET=webhook_secret_from_step3
```

## Step 6: Configure Allowed Origins (Optional but Recommended)

1. **In Cloudflare Stream Dashboard**
   - Go to Stream → Settings
   - Add allowed origins:
     - `https://www.shipshow.io`
     - `https://shipshow.io`
     - `http://localhost:3000` (for development)

## Step 7: Test the Integration

### Test Upload Flow:
```bash
# Test the init endpoint
curl -X POST https://www.shipshow.io/api/videos/cloudflare-init \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Video",
    "description": "Testing Cloudflare Stream",
    "productUrl": "https://example.com"
  }'
```

### Test Webhook:
```bash
# Cloudflare will send a test webhook when configured
# Check Vercel logs for webhook processing
```

## Step 8: Update Frontend (Next Steps)

1. **Install HLS.js**
```bash
npm install hls.js
```

2. **Update VideoPlayer component** to support HLS playback
3. **Update submit-demo page** to use new upload endpoint

## Troubleshooting

### Issue: Webhook 401 Unauthorized
- Verify webhook secret matches in environment variables
- Check signature verification logic

### Issue: Upload fails with 502
- Check API token has correct permissions
- Verify account ID is correct
- Check Cloudflare Stream is enabled

### Issue: Video stuck in "processing"
- Check webhook endpoint is receiving calls
- Verify webhook URL is correct in Cloudflare
- Check Vercel function logs

### Issue: Video won't play
- Verify HLS URL format
- Check CORS/allowed origins
- Test with direct URL in browser

## Monitoring

### Cloudflare Dashboard
- Stream → Analytics: View usage and performance
- Stream → Videos: See all uploaded videos

### Vercel Dashboard
- Functions → Logs: Monitor API calls and webhooks
- Check for errors in cloudflare-init and cloudflare-stream functions

### Database
```sql
-- Check video statuses
SELECT provider, status, COUNT(*) 
FROM videos 
GROUP BY provider, status;

-- Find stuck videos
SELECT id, title, provider_asset_id, status, created_at 
FROM videos 
WHERE status = 'processing' 
AND created_at < NOW() - INTERVAL '1 hour';
```

## Cost Estimation

### Cloudflare Stream Pricing (as of 2024)
- Storage: $5 per 1000 minutes
- Streaming: $1 per 1000 minutes viewed
- Encoding: Included

### Example for 30-second demos:
- 1000 demos = 500 minutes = $2.50 storage
- 10,000 views = 5000 minutes = $5 streaming
- Total: ~$7.50 per 1000 demos with 10 views each

## Security Checklist

- [ ] Webhook secret stored securely
- [ ] API token not exposed in code
- [ ] Allowed origins configured
- [ ] Max duration limit enforced (30s)
- [ ] File type validation on frontend
- [ ] Rate limiting on upload endpoint

## Next Steps

1. Test with team accounts first
2. Monitor costs and performance
3. Consider adding:
   - Thumbnail customization
   - Video moderation
   - Analytics tracking
   - Signed URLs for premium content
