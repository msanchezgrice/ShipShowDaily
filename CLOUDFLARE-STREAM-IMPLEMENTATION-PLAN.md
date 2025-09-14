# Cloudflare Stream Implementation Plan

## Executive Summary

Implementing Cloudflare Stream for video hosting in our existing ShipShowDaily platform, adapting the Supabase Edge Functions approach to our Vercel/Clerk architecture.

## Current Architecture Analysis

### What We Have:
1. **Authentication**: Clerk (not Supabase Auth)
2. **Database**: Supabase PostgreSQL
3. **API**: Vercel Serverless Functions (not Supabase Edge Functions)
4. **Storage**: Currently using S3-compatible storage with Uppy
5. **Frontend**: React with react-query for data fetching
6. **Video Schema**: Existing `videos` table with basic fields

### Key Architecture Conflicts & Resolutions

#### 🔴 **CONFLICT 1: Supabase Edge Functions vs Vercel Serverless**
**Issue**: The guide uses Supabase Edge Functions (Deno), we use Vercel Serverless (Node.js)
**Resolution**: 
- Adapt all Edge Function code to Vercel API routes
- Use Node.js crypto instead of Deno crypto for webhook verification
- Replace Deno.env with process.env

#### 🔴 **CONFLICT 2: Authentication Mismatch**
**Issue**: Guide uses Supabase Auth, we use Clerk
**Resolution**:
- Replace Supabase Auth checks with our existing `requireAuth` middleware
- Use Clerk user IDs instead of Supabase user IDs
- Keep our existing auth flow unchanged

#### 🔴 **CONFLICT 3: Database Schema Differences**
**Issue**: Our existing schema differs from the guide's schema
**Current Schema**:
```typescript
videos: {
  id, title, description, productUrl, 
  videoPath, thumbnailPath, creatorId,
  totalViews, isActive, createdAt, updatedAt
}
```
**Guide Schema Additions Needed**:
```typescript
// New fields to add:
provider: 'stream' | 's3'  // Support migration
provider_asset_id: string   // Cloudflare UID
hls_url: string
dash_url: string
status: 'uploading' | 'processing' | 'ready' | 'rejected'
duration_s: number
width: number
height: number
moderation_state: 'pending' | 'approved' | 'limited' | 'rejected'
```
**Resolution**: Add migration to extend schema without breaking existing data

#### 🔴 **CONFLICT 4: Upload Flow Differences**
**Issue**: Currently using Uppy with S3, need to switch to Cloudflare direct upload
**Resolution**: 
- Create parallel upload flow initially
- Keep S3 as fallback during migration
- Update ObjectUploader component to support both

#### ⚠️ **CONCERN 1: Webhook Security**
**Issue**: Webhooks from Cloudflare need to be verified
**Resolution**: 
- Implement HMAC verification in a dedicated webhook endpoint
- Store webhook secret securely in environment variables
- Add IP allowlisting if Cloudflare provides webhook IPs

#### ⚠️ **CONCERN 2: Migration Strategy**
**Issue**: Existing videos need to continue working
**Resolution**:
- Dual-provider approach: keep S3 for existing, use Stream for new
- Add `provider` field to distinguish
- Gradual migration tools if needed

#### ⚠️ **CONCERN 3: Cost Management**
**Issue**: Cloudflare Stream has different pricing than S3
**Resolution**:
- Monitor usage closely in initial rollout
- Set upload limits (30s max duration)
- Implement quotas per user if needed

## Implementation Plan

### Phase 1: Database & Schema Updates (Day 1)
```sql
-- Add new columns to videos table
ALTER TABLE videos 
ADD COLUMN provider TEXT DEFAULT 's3' CHECK (provider IN ('s3', 'stream')),
ADD COLUMN provider_asset_id TEXT,
ADD COLUMN hls_url TEXT,
ADD COLUMN dash_url TEXT,
ADD COLUMN status TEXT DEFAULT 'ready' CHECK (status IN ('uploading', 'processing', 'ready', 'rejected')),
ADD COLUMN moderation_state TEXT DEFAULT 'approved' CHECK (moderation_state IN ('pending', 'approved', 'limited', 'rejected')),
ADD COLUMN duration_s INTEGER,
ADD COLUMN width INTEGER,
ADD COLUMN height INTEGER;

-- Index for performance
CREATE INDEX idx_videos_provider_status ON videos(provider, status);
```

### Phase 2: API Endpoints (Day 1-2)

#### 2.1 Create Upload Initialization Endpoint
**File**: `api/videos/cloudflare-init.ts`
```typescript
// Vercel serverless function
export default async function handler(req, res) {
  const auth = await requireAuth(req);
  if (!auth) return sendUnauthorized(res);
  
  // Create DB row
  // Request upload URL from Cloudflare
  // Return upload URL to client
}
```

#### 2.2 Webhook Handler
**File**: `api/webhooks/cloudflare-stream.ts`
```typescript
// Verify HMAC signature
// Update video status in DB
// Handle ready/error states
```

#### 2.3 Update Existing Endpoints
- Modify video fetching to handle both providers
- Update playback URLs based on provider

### Phase 3: Frontend Updates (Day 2-3)

#### 3.1 Video Upload Component
```typescript
// Add provider selection (initially hidden, Stream by default)
// Implement direct upload to Cloudflare
// Progress tracking
// Error handling
```

#### 3.2 Video Player Updates
```typescript
// Detect provider type
// Use HLS.js for Stream videos
// Fallback to direct video tag for S3
```

#### 3.3 Feed Optimization
- Prefetch next video's manifest
- Implement buffering strategy
- Add loading states

### Phase 4: Testing & Rollout (Day 3-4)

#### 4.1 Testing Checklist
- [ ] Upload flow (30s limit)
- [ ] Webhook processing
- [ ] HLS playback across browsers
- [ ] Mobile performance
- [ ] Error states
- [ ] Existing S3 videos still work

#### 4.2 Rollout Strategy
1. **Alpha**: Test with team accounts
2. **Beta**: Enable for 10% of new uploads
3. **GA**: All new uploads use Stream
4. **Migration**: Optional tool for existing videos

## Environment Variables Needed

```env
# Cloudflare Stream
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_STREAM_API_TOKEN=
CLOUDFLARE_STREAM_WEBHOOK_SECRET=
CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN= # optional

# Feature Flags
ENABLE_CLOUDFLARE_STREAM=false # Toggle during rollout
STREAM_MAX_DURATION_SECONDS=30
STREAM_MAX_FILE_SIZE_MB=200
```

## Security Considerations

1. **Upload Security**:
   - One-time upload URLs expire quickly
   - Validate file types on client
   - Set max duration/size limits

2. **Playback Security**:
   - Start with public playback
   - Add domain restrictions later
   - Consider signed URLs for premium content

3. **Webhook Security**:
   - HMAC verification required
   - Rate limiting on webhook endpoint
   - Log all webhook calls for audit

## Performance Optimizations

1. **Upload**: 
   - Direct browser → Cloudflare (no proxy)
   - Show progress with Cloudflare's tus protocol

2. **Playback**:
   - HLS adaptive bitrate
   - CDN delivery built-in
   - Prefetch next video manifest

3. **Database**:
   - Index on provider + status
   - Async webhook processing
   - Cache video metadata

## Migration Path for Existing Videos

### Option 1: Dual-Provider (Recommended)
- Keep existing videos on S3
- New videos on Cloudflare Stream
- Player detects provider and adapts

### Option 2: Gradual Migration
- Build migration tool
- Process videos in batches
- Update URLs after successful migration

### Option 3: Full Migration
- Download from S3
- Upload to Stream via API
- Update all references
- Higher risk, not recommended initially

## Success Metrics

1. **Upload Success Rate**: >95%
2. **Time to First Frame**: <400ms desktop, <800ms mobile
3. **Playback Errors**: <1%
4. **Webhook Processing Time**: <2s
5. **User Satisfaction**: No degradation from current

## Timeline

- **Day 1**: Database migration, API endpoints
- **Day 2**: Frontend upload flow, webhook handler
- **Day 3**: Player updates, testing
- **Day 4**: Beta rollout, monitoring
- **Week 2**: GA rollout, optimization

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Webhook failures | Videos stuck processing | Retry logic, manual recovery |
| Upload failures | User frustration | Clear errors, S3 fallback |
| Playback issues | Poor UX | Progressive enhancement |
| Cost overrun | Budget impact | Monitoring, quotas |
| Migration bugs | Data loss | Backups, gradual rollout |

## Decision Points

### ✅ **GO**: Proceed with Cloudflare Stream
**Pros**:
- Better performance (HLS, CDN)
- No infrastructure management
- Built-in transcoding
- Thumbnail generation

**Cons**:
- Vendor lock-in
- Migration complexity
- Additional costs

### Alternative: Stay with S3 + CloudFront
**Pros**:
- Already working
- More control
- Predictable costs

**Cons**:
- Need transcoding solution
- Manual CDN setup
- Performance limitations

## Recommendation

**Proceed with Cloudflare Stream implementation** using a dual-provider approach:

1. **Keep existing S3 infrastructure** operational
2. **Implement Stream for new uploads** with feature flag
3. **Gradual rollout** with monitoring
4. **Migration optional** based on success metrics

This minimizes risk while gaining Stream's benefits for new content.

## Next Steps

1. **Review & Approve** this plan
2. **Set up Cloudflare Stream** account
3. **Create environment variables**
4. **Begin Phase 1** implementation

## Questions for Sign-off

1. Is 30-second limit acceptable for demos?
2. Should we implement quotas per user?
3. Do we need moderation workflow immediately?
4. Should existing videos be migrated?
5. Budget approval for Stream costs?
