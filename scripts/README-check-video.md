# Checking if Video ID Exists in Database

To check if video ID `f1d111cb-a6ac-4abd-9be2-43b6cc119412` exists in your database, you have several options:

## Option 1: Using the check-video-id.ts Script

1. Create a `.env` file in the project root with your database URL:
   ```
   DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require
   ```

2. Run the script:
   ```bash
   npx tsx scripts/check-video-id.ts
   ```

## Option 2: Using the API Endpoints (if the server is running)

If your server is running, you can check via the API:

```bash
# Get video details
curl http://localhost:5000/api/videos/f1d111cb-a6ac-4abd-9be2-43b6cc119412
```

## Option 3: Direct Database Query

If you have direct access to your PostgreSQL database, you can run:

```sql
-- Check if video exists
SELECT * FROM videos WHERE id = 'f1d111cb-a6ac-4abd-9be2-43b6cc119412';

-- Get video with all related data
SELECT 
    v.*,
    u.email as creator_email,
    u.first_name as creator_first_name,
    u.last_name as creator_last_name
FROM videos v
LEFT JOIN users u ON v.creator_id = u.id
WHERE v.id = 'f1d111cb-a6ac-4abd-9be2-43b6cc119412';

-- Check video stats
SELECT 
    COUNT(DISTINCT vv.id) as total_views,
    COUNT(DISTINCT vvs.id) as viewing_sessions,
    COUNT(DISTINCT vf.id) as favorites,
    COUNT(DISTINCT dlc.id) as demo_clicks
FROM videos v
LEFT JOIN video_views vv ON v.id = vv.video_id
LEFT JOIN video_viewing_sessions vvs ON v.id = vvs.video_id
LEFT JOIN video_favorites vf ON v.id = vf.video_id
LEFT JOIN demo_link_clicks dlc ON v.id = dlc.video_id
WHERE v.id = 'f1d111cb-a6ac-4abd-9be2-43b6cc119412'
GROUP BY v.id;
```

## What the Script Checks

The `check-video-id.ts` script will:
1. Connect to your database
2. Check if the video exists
3. If found, display:
   - Video details (title, description, URLs, etc.)
   - Creator information
   - View counts and sessions
   - Associated tags
   - Related credit transactions
4. If not found, show a sample of existing videos for reference

## Database Schema Reference

The video is stored in the `videos` table with these key fields:
- `id`: The unique identifier (UUID)
- `title`: Video title
- `description`: Video description
- `creator_id`: References the user who created it
- `video_path`: Path to the video file
- `is_active`: Whether the video is active
- `total_views`: View count
- `created_at`: When it was created