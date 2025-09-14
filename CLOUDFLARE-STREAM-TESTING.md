# Cloudflare Stream Testing Guide

## Current Status ✅

### Completed:
- ✅ Database schema updated with Stream fields
- ✅ Backend API endpoints created
- ✅ Frontend components built with HLS support
- ✅ Dual-provider support (S3 + Stream)
- ✅ Feature flag for easy switching

### Pending Setup:
- ⏳ Cloudflare Stream account setup
- ⏳ Database migration execution
- ⏳ Environment variables configuration
- ⏳ Webhook configuration

## Quick Setup Checklist

### 1. Run Database Migration
```sql
-- Go to Supabase SQL Editor and run:
-- Copy contents from scripts/cloudflare-stream-migration.sql
```

### 2. Set Environment Variables (Vercel)
```env
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_STREAM_API_TOKEN=your_api_token  
CLOUDFLARE_STREAM_WEBHOOK_SECRET=your_webhook_secret
```

### 3. Toggle Feature Flag
In `client/src/pages/submit-demo.tsx`:
```typescript
// Line 22 - Set to true to use Cloudflare Stream
const USE_CLOUDFLARE_STREAM = true;  // Currently enabled
```

## Testing Flow

### Test 1: Video Upload (Cloudflare Stream)
1. **Navigate to Submit Demo page**
2. **Select a video file** (MP4, max 100MB, 30s)
3. **Fill in demo details**:
   - Title
   - Description
   - Product URL
   - Tags
4. **Click Submit**
5. **Expected Results**:
   - Video uploads directly to Cloudflare
   - Progress bar shows upload status
   - Database entry created with status 'uploading'
   - Webhook updates status to 'ready'

### Test 2: Video Playback (HLS)
1. **Navigate to Feed or Dashboard**
2. **Click on a video**
3. **Expected Results**:
   - HLS.js loads for Stream videos
   - Adaptive bitrate streaming works
   - Quality auto-adjusts based on bandwidth
   - Playback controls function correctly

### Test 3: Backward Compatibility (S3)
1. **Set feature flag to false**:
```typescript
const USE_CLOUDFLARE_STREAM = false;
```
2. **Upload a video using S3**
3. **Expected Results**:
   - Original S3 upload flow works
   - Existing S3 videos still play
   - No disruption to current videos

## API Testing

### Test Upload Initialization
```bash
curl -X POST http://localhost:3000/api/videos/cloudflare-init \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Video",
    "description": "Testing Stream",
    "productUrl": "https://example.com",
    "maxDurationSeconds": 30
  }'
```

**Expected Response**:
```json
{
  "videoId": "uuid",
  "uploadUrl": "https://upload.cloudflarestream.com/...",
  "uploadId": "cloudflare-uid",
  "provider": "stream",
  "maxDurationSeconds": 30
}
```

### Test Webhook Processing
```bash
# Cloudflare will call this automatically
# Check Vercel function logs for:
# - Webhook received
# - Signature verified
# - Database updated
```

## Database Verification

### Check Video Status
```sql
-- Check videos by provider
SELECT 
  provider,
  status,
  COUNT(*) as count
FROM videos
GROUP BY provider, status;

-- Check Stream videos
SELECT 
  id,
  title,
  provider,
  provider_asset_id,
  hls_url,
  status,
  created_at
FROM videos
WHERE provider = 'stream'
ORDER BY created_at DESC;
```

## Browser Testing

### Desktop Browsers
- [ ] Chrome: HLS playback works
- [ ] Firefox: HLS playback works
- [ ] Safari: Native HLS support works
- [ ] Edge: HLS playback works

### Mobile Testing
- [ ] iOS Safari: Native HLS works
- [ ] Android Chrome: HLS.js works
- [ ] Mobile upload works

## Performance Metrics

### Target Metrics
- **Upload Time**: < 10s for 30s video
- **Time to First Frame**: < 400ms desktop
- **Buffering**: < 2% of playback time
- **Quality Switching**: Smooth, no interruption

### Monitor in Browser DevTools
1. **Network Tab**:
   - HLS manifest loads
   - Segments load sequentially
   - Bitrate adaptation occurs

2. **Performance Tab**:
   - Memory usage stable
   - No memory leaks
   - Smooth playback

## Troubleshooting

### Issue: Upload fails with 502
**Solution**: Check Cloudflare API token permissions

### Issue: Webhook not updating database
**Solution**: 
- Verify webhook secret matches
- Check Vercel function logs
- Ensure webhook URL is configured in Cloudflare

### Issue: HLS playback fails
**Solution**:
- Check browser console for errors
- Verify HLS URL format
- Test direct URL in browser

### Issue: Feature flag not working
**Solution**:
- Restart dev server after changing flag
- Clear browser cache
- Check for TypeScript errors

## Success Indicators

✅ **Upload Success**
- Video appears in Cloudflare dashboard
- Database has correct provider_asset_id
- Status changes from 'uploading' to 'ready'

✅ **Playback Success**  
- HLS manifest loads (.m3u8)
- Multiple quality levels available
- Smooth quality transitions
- No buffering on good connection

✅ **Integration Success**
- Both S3 and Stream videos work
- No regression in existing features
- Performance improved for new videos

## Next Steps After Testing

1. **Production Rollout**:
   - Start with 10% of uploads
   - Monitor costs and performance
   - Gradually increase percentage

2. **Optimization**:
   - Add thumbnail customization
   - Implement video analytics
   - Add moderation workflow

3. **User Communication**:
   - Announce improved video quality
   - Highlight faster loading times
   - Explain 30-second limit (if applicable)

## Rollback Plan

If issues arise:
1. Set `USE_CLOUDFLARE_STREAM = false`
2. All new uploads revert to S3
3. Existing Stream videos continue working
4. No data loss or disruption

## Questions?

- Check `CLOUDFLARE-STREAM-IMPLEMENTATION-PLAN.md` for architecture details
- Check `CLOUDFLARE-STREAM-SETUP.md` for configuration steps
- Check Vercel logs for API errors
- Check Cloudflare dashboard for video status
