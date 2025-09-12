# Production Configuration Notes

## Google Cloud Storage Configuration for Vercel

⚠️ **Important**: The current Google Cloud Storage configuration in `server/objectStorage.ts` uses Replit-specific infrastructure that won't work on Vercel.

### Current Issue
```typescript
const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106"; // This won't work on Vercel
```

### Solution Options

#### Option 1: Use Google Cloud Service Account (Recommended)
Replace the existing Google Cloud Storage client configuration with standard service account authentication:

```typescript
// In server/objectStorage.ts, replace the current client with:
export const objectStorageClient = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_CLOUD_KEY_FILE, // Path to service account JSON
  // OR use base64 encoded key:
  credentials: JSON.parse(Buffer.from(process.env.GOOGLE_CLOUD_CREDENTIALS_BASE64, 'base64').toString())
});
```

**Required Environment Variables:**
- `GOOGLE_CLOUD_PROJECT_ID`: Your Google Cloud project ID
- `GOOGLE_CLOUD_CREDENTIALS_BASE64`: Base64 encoded service account JSON key

#### Option 2: Use Vercel Blob Storage (Simpler)
Replace Google Cloud Storage with Vercel's built-in blob storage:

1. Install Vercel Blob: `npm install @vercel/blob`
2. Update storage implementation to use Vercel Blob
3. No additional configuration needed

#### Option 3: Use AWS S3 or Cloudinary
Switch to alternative storage providers that have simpler authentication.

### Immediate Fix for Deployment

For quick deployment, you can temporarily disable file upload features by:

1. Adding environment variable check:
```typescript
const ENABLE_FILE_STORAGE = process.env.ENABLE_FILE_STORAGE === 'true';
```

2. Wrapping storage operations in conditional blocks
3. Setting `ENABLE_FILE_STORAGE=false` in Vercel environment variables

## Database Connection Notes

✅ **PostgreSQL configuration is production-ready**
- Uses environment variable `DATABASE_URL`
- Supports SSL connections
- Compatible with Neon, Supabase, and other PostgreSQL providers

## Authentication Notes

✅ **Clerk authentication is production-ready**
- Properly configured with environment variables
- No hardcoded URLs or development-specific settings

## Payment Processing Notes

✅ **Stripe integration is production-ready**
- Uses environment variables for API keys
- Webhook endpoints are configurable
- No hardcoded development URLs

## Server Configuration Notes

✅ **Express server is Vercel-compatible**
- Uses dynamic port configuration (`process.env.PORT`)
- Proper middleware setup for serverless functions
- No hardcoded localhost dependencies

---

## Quick Fix Summary

To deploy immediately with minimal changes:

1. **Set storage to disabled mode**: `ENABLE_FILE_STORAGE=false`
2. **Configure all other environment variables** as documented in `DEPLOYMENT.md`
3. **Deploy to Vercel** - everything except file uploads will work
4. **Later**: Implement proper Google Cloud Storage or switch to Vercel Blob

This approach allows you to get the core application running quickly while you set up proper file storage separately.