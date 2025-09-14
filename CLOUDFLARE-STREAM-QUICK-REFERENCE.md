# Cloudflare Stream - Quick Implementation Reference

## Key Architecture Adaptations

### 1. Platform Differences
| Guide Uses | We Use | Adaptation |
|------------|---------|------------|
| Supabase Edge Functions (Deno) | Vercel Serverless (Node.js) | Convert Deno → Node.js syntax |
| Supabase Auth | Clerk Auth | Use `requireAuth` middleware |
| `Deno.env.get()` | `process.env` | Simple replacement |
| Deno crypto | Node crypto | Use `crypto.createHmac()` |
| Fresh/Deno Deploy | Next.js/Vercel | API routes in `/api` folder |

### 2. Code Conversions

#### Webhook Verification (Node.js version)
```typescript
// Original Deno version uses Web Crypto API
// Node.js version:
import crypto from 'crypto';

function verifyWebhook(secret: string, signature: string, body: string) {
  const [time, sig] = signature.split(',').map(p => p.split('=')[1]);
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${time}.${body}`)
    .digest('hex');
  return expected === sig;
}
```

#### Auth Check
```typescript
// Instead of Supabase Auth:
// const { data: { user } } = await supabase.auth.getUser(token);

// Use our Clerk auth:
const auth = await requireAuth(req);
if (!auth) return sendUnauthorized(res);
const userId = auth.userId;
```

### 3. Database Schema Migration
```sql
-- Run in Supabase SQL Editor
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 's3',
ADD COLUMN IF NOT EXISTS provider_asset_id TEXT,
ADD COLUMN IF NOT EXISTS hls_url TEXT,
ADD COLUMN IF NOT EXISTS dash_url TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ready',
ADD COLUMN IF NOT EXISTS duration_s INTEGER,
ADD COLUMN IF NOT EXISTS width INTEGER,
ADD COLUMN IF NOT EXISTS height INTEGER;
```

### 4. Environment Variables
```bash
# Add to Vercel Dashboard
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_STREAM_API_TOKEN=your_api_token
CLOUDFLARE_STREAM_WEBHOOK_SECRET=webhook_secret_from_api
```

### 5. API Endpoints Map

| Purpose | Guide Location | Our Location |
|---------|---------------|--------------|
| Init Upload | `/functions/init-upload` | `/api/videos/cloudflare-init.ts` |
| Webhook | `/functions/video-webhooks` | `/api/webhooks/cloudflare-stream.ts` |
| Get Videos | Supabase SDK | `/api/videos/index.ts` |

### 6. Quick Start Commands

```bash
# 1. Install dependencies
npm install hls.js

# 2. Run database migration
# Go to Supabase Dashboard → SQL Editor → Run migration SQL

# 3. Set environment variables in Vercel
vercel env add CLOUDFLARE_ACCOUNT_ID
vercel env add CLOUDFLARE_STREAM_API_TOKEN
vercel env add CLOUDFLARE_STREAM_WEBHOOK_SECRET

# 4. Deploy
git add . && git commit -m "Add Cloudflare Stream support"
git push origin main
```

### 7. Testing Checklist
- [ ] Can create upload URL via API
- [ ] Can upload video to Cloudflare
- [ ] Webhook updates database
- [ ] HLS URL is stored correctly
- [ ] Video plays with HLS.js
- [ ] Old S3 videos still work

### 8. Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Webhook 401 | Check HMAC secret matches |
| Upload fails | Check CORS, verify API token |
| Video won't play | Check HLS URL format, CORS headers |
| Database not updating | Check webhook logs in Vercel |

### 9. Dual Provider Support
```typescript
// In video player component
if (video.provider === 'stream' && video.hls_url) {
  // Use HLS.js
  attachHls(videoElement, video.hls_url);
} else {
  // Use direct video source (S3)
  videoElement.src = video.videoPath;
}
```
