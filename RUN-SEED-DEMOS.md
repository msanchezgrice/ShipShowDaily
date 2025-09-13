# Adding Test Demo Videos to Your Database

## Quick Start

### Step 1: Get Your User ID

First, you need a user ID to associate with the demo videos. You have two options:

#### Option A: Use Your Clerk User ID (Recommended)
1. Sign up/sign in to your app
2. Go to [Clerk Dashboard](https://dashboard.clerk.com)
3. Click on **Users**
4. Find your user and copy the User ID (starts with `user_`)
5. It looks like: `user_2abcdefghijklmnop`

#### Option B: Check Your Database
```bash
# If you have database access, run:
# You can use any SQL client or run this query
SELECT id, email FROM users LIMIT 5;
```

### Step 2: Set Environment Variables

Make sure your `.env` file has:
```bash
DATABASE_URL=postgresql://...your-database-url...
DEMO_USER_ID=user_xxxxx  # Your actual user ID from Step 1
```

### Step 3: Run the Seed Script

```bash
# Install dependencies if you haven't
npm install

# Run the seeding script
npm run seed:demos
```

## What This Creates

The script will add 10 demo products:
1. **TaskFlow** - AI Project Management
2. **CodeSnap** - AI Code Reviews  
3. **DataViz Pro** - Analytics Dashboards
4. **ChatBot Builder** - Custom AI Assistants
5. **DesignAI** - Automated Graphic Design
6. **SecureVault** - Password Manager
7. **MeetSync** - AI Meeting Assistant
8. **FormBuilder Pro** - Smart Forms
9. **APIHub** - Universal API Gateway
10. **VideoEdit AI** - Automated Video Editing

Each demo includes:
- Title and description
- Product URL (placeholder)
- Video URL (placeholder - needs real videos)
- Thumbnail URL (placeholder)
- Tags for categorization
- Random initial view counts

## Important Notes

### ⚠️ Placeholder URLs
The demos use placeholder video URLs like:
```
https://storage.googleapis.com/sample-bucket/demo1.mp4
```

These won't actually play videos until you:
1. Set up Google Cloud Storage (see GOOGLE-CLOUD-SETUP.md)
2. Upload real video files
3. Update the URLs in the database

### 🎥 Sample Videos for Testing

You can use these free sample videos for testing:

1. **Big Buck Bunny** (Short clips):
   - https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_30mb.mp4

2. **Sample Product Demos**:
   - https://cdn.videvo.net/videvo_files/video/free/2018-07/small_watermarked/180607_A_101_preview.webm

3. **Create Your Own**:
   - Record 30-second screen recordings
   - Use OBS Studio, Loom, or QuickTime
   - Keep them under 50MB for testing

### 📝 Update Videos with Real URLs

After uploading real videos to Google Cloud Storage:

```sql
-- Update a specific video
UPDATE videos 
SET 
  video_path = 'https://storage.googleapis.com/your-bucket/real-video.mp4',
  thumbnail_path = 'https://storage.googleapis.com/your-bucket/real-thumb.jpg'
WHERE title = 'TaskFlow - AI-Powered Project Management';

-- Or update all at once if you have a naming pattern
UPDATE videos 
SET video_path = REPLACE(video_path, 'sample-bucket', 'your-real-bucket');
```

## Troubleshooting

### "DATABASE_URL not set"
- Make sure you have a `.env` file in the root directory
- Add your database connection string

### "User not found" or Foreign Key Error
- The DEMO_USER_ID must exist in the users table
- Sign up for an account first, then use that user's ID

### "Permission denied" on database
- Check your database connection string
- Ensure your database user has INSERT permissions

### Videos not playing
- This is expected! The placeholder URLs don't point to real videos
- Follow GOOGLE-CLOUD-SETUP.md to set up real video hosting

## Next Steps

1. ✅ Run the seed script
2. ✅ Check your dashboard - you should see 10 demos
3. ✅ Set up Google Cloud Storage (GOOGLE-CLOUD-SETUP.md)
4. ✅ Upload real 30-second demo videos
5. ✅ Update database with real video URLs
6. ✅ Test the full user experience

## Clean Up (Optional)

To remove all demo videos:
```sql
-- Remove demo videos (adjust the WHERE clause as needed)
DELETE FROM videos WHERE creator_id = 'your-demo-user-id';
```
