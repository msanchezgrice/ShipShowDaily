# Google Cloud Storage Setup for Video Hosting

## Overview
This guide will help you set up Google Cloud Storage to host video files for ShipShow.io.

## Step 1: Create a Google Cloud Project

1. **Go to [Google Cloud Console](https://console.cloud.google.com)**
2. **Create a new project** or select an existing one
3. **Note your Project ID** (you'll need this later)

## Step 2: Enable Required APIs

1. Go to **APIs & Services > Library**
2. Search and enable:
   - **Cloud Storage API**
   - **Cloud Storage JSON API**

## Step 3: Create Storage Buckets

### Create Two Buckets (Public and Private)

1. Go to **Storage > Browser**
2. Click **Create Bucket**

### Public Bucket (for videos and thumbnails):
- **Name**: `shipshow-public` (must be globally unique, add random suffix if taken)
- **Location**: Choose closest to your users (e.g., `us-central1`)
- **Storage class**: `Standard`
- **Access control**: `Fine-grained` (important!)
- **Protection**: Uncheck all protection tools for now

### Private Bucket (for processing):
- **Name**: `shipshow-private` (must be globally unique)
- Same settings as public, but will remain private

## Step 4: Configure CORS for Public Bucket

1. Create a file `cors.json`:

```json
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD", "OPTIONS"],
    "responseHeader": ["Content-Type", "Access-Control-Allow-Origin"],
    "maxAgeSeconds": 3600
  }
]
```

2. Apply CORS configuration:
```bash
gsutil cors set cors.json gs://your-public-bucket-name
```

Or use the Console:
- Go to your bucket
- Click **Configuration** tab
- Edit CORS configuration

## Step 5: Make Public Bucket Accessible

1. Go to your **public bucket** in Cloud Console
2. Click **Permissions** tab
3. Click **Grant Access**
4. Add member: `allUsers`
5. Role: `Storage Object Viewer`
6. Save

⚠️ **Warning**: This makes all objects in this bucket publicly readable!

## Step 6: Create Service Account

1. Go to **IAM & Admin > Service Accounts**
2. Click **Create Service Account**
3. Details:
   - **Name**: `shipshow-storage`
   - **ID**: Auto-generated is fine
4. Grant roles:
   - `Storage Admin` (for full access)
   - Or more restricted:
     - `Storage Object Creator` (upload only)
     - `Storage Object Viewer` (read only)
5. Click **Done**

## Step 7: Create and Download Service Account Key

1. Click on your new service account
2. Go to **Keys** tab
3. **Add Key > Create New Key**
4. Choose **JSON** format
5. **Download** the key file
6. **KEEP THIS FILE SECURE!**

## Step 8: Set Up Environment Variables

### For Local Development (.env file):
```bash
# Google Cloud Storage
GCS_PROJECT_ID=your-project-id
GCS_KEY_FILENAME=./path-to-your-key.json
PUBLIC_BUCKET_NAME=shipshow-public
PRIVATE_BUCKET_NAME=shipshow-private

# Or encode the key as base64 for production
GCS_CREDENTIALS_BASE64=base64-encoded-json-key
```

### For Vercel Deployment:

1. **Encode your service account key**:
```bash
# On Mac/Linux:
base64 -i your-service-account-key.json | pbcopy

# On Windows:
certutil -encode your-service-account-key.json encoded.txt
```

2. **Add to Vercel Environment Variables**:
   - `GCS_PROJECT_ID`: Your Google Cloud project ID
   - `GCS_CREDENTIALS_BASE64`: The base64-encoded service account key
   - `PUBLIC_BUCKET_NAME`: Your public bucket name
   - `PRIVATE_BUCKET_NAME`: Your private bucket name

## Step 9: Update Storage Configuration

The app needs to be configured to use Google Cloud Storage. Check `/server/objectStorage.ts`:

```typescript
// This should already be configured, but verify:
const storage = new Storage({
  projectId: process.env.GCS_PROJECT_ID,
  keyFilename: process.env.GCS_KEY_FILENAME,
  // OR use base64 credentials for production
  credentials: process.env.GCS_CREDENTIALS_BASE64 
    ? JSON.parse(Buffer.from(process.env.GCS_CREDENTIALS_BASE64, 'base64').toString())
    : undefined
});
```

## Step 10: Test Upload

1. **Run the app locally**:
```bash
npm run dev
```

2. **Try uploading a video**:
   - Go to `/submit-demo`
   - Upload a test video
   - Check Google Cloud Console to see if file appears

## Step 11: Update Demo Videos

After setting up storage, update the placeholder demos with real video URLs:

1. **Upload sample videos** to your bucket
2. **Get public URLs** for each video:
   - Format: `https://storage.googleapis.com/BUCKET_NAME/OBJECT_NAME`
3. **Update database** with real URLs

## Folder Structure in Bucket

Recommended structure:
```
shipshow-public/
├── videos/
│   ├── [video-id].mp4
│   └── [video-id].webm
├── thumbnails/
│   └── [video-id].jpg
└── temp/
    └── (temporary uploads)
```

## Cost Optimization Tips

1. **Set Lifecycle Rules**:
   - Delete temp files after 1 day
   - Move old videos to Nearline/Coldline storage

2. **Enable CDN** (optional):
   - Use Cloud CDN for better performance
   - Or integrate with Cloudflare

3. **Set Budget Alerts**:
   - Go to **Billing > Budgets & Alerts**
   - Create budget with email alerts

## Troubleshooting

### "Permission Denied" Errors:
- Check service account has correct roles
- Verify bucket permissions for public access
- Check CORS configuration

### "Bucket Not Found" Errors:
- Verify bucket names in environment variables
- Check bucket exists and is in correct project

### Upload Failures:
- Check service account key is valid
- Verify environment variables are set
- Check file size limits (default 5GB)

### CORS Issues:
- Update cors.json with your domains
- Include localhost for development
- Re-apply CORS settings after changes

## Security Best Practices

1. **Never commit service account keys** to Git
2. **Use different buckets** for public/private content
3. **Implement file validation** before upload
4. **Set up monitoring** for unusual activity
5. **Regular audit** of bucket permissions

## Next Steps

1. ✅ Complete all steps above
2. ✅ Test video upload functionality
3. ✅ Update placeholder demos with real videos
4. ✅ Monitor storage usage and costs
5. ✅ Consider CDN integration for better performance

## Support

- [Google Cloud Storage Documentation](https://cloud.google.com/storage/docs)
- [Node.js Client Library](https://googleapis.dev/nodejs/storage/latest/)
- [Pricing Calculator](https://cloud.google.com/products/calculator)
