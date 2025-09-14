# Supabase Database Setup Guide

## 1. Create Supabase Account & Project

1. **Go to [Supabase](https://supabase.com)**
2. **Sign up** (if you don't have an account)
3. **Create a new project**:
   - Project name: `shipshow-daily` (or your preference)
   - Database password: Choose a strong password (save this!)
   - Region: Choose closest to your users
   - Pricing plan: Free tier is fine to start

4. **Wait for project to initialize** (takes ~2 minutes)

## 2. Get Your Database Connection String

Once your project is ready:

1. Go to **Settings** (gear icon in sidebar)
2. Click **Database** in the settings menu
3. Scroll to **Connection string** section
4. Copy the **URI** connection string
5. It looks like: `postgresql://postgres.[project-ref]:[password]@[region].pooler.supabase.com:5432/postgres`

## 3. Set Up Database Schema

### Option A: Use Supabase SQL Editor (Recommended)

1. In Supabase dashboard, click **SQL Editor** (left sidebar)
2. Click **New query**
3. Copy and paste this entire schema:

```sql
-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  profile_image_url TEXT DEFAULT '',
  credits INTEGER DEFAULT 10,
  total_credits_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create videos table
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  description TEXT,
  product_url TEXT,
  video_path TEXT NOT NULL,
  thumbnail_path TEXT,
  creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  total_views INTEGER DEFAULT 0,
  boost_credits INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create daily_stats table
CREATE TABLE IF NOT EXISTS daily_stats (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  views INTEGER DEFAULT 0,
  credits_spent INTEGER DEFAULT 0,
  favorites INTEGER DEFAULT 0,
  demo_clicks INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(video_id, date)
);

-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create video_tags junction table
CREATE TABLE IF NOT EXISTS video_tags (
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (video_id, tag_id)
);

-- Create video_favorites table
CREATE TABLE IF NOT EXISTS video_favorites (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(video_id, user_id)
);

-- Create demo_link_clicks table
CREATE TABLE IF NOT EXISTS demo_link_clicks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earned', 'spent', 'purchased', 'boost')),
  description TEXT,
  video_id TEXT REFERENCES videos(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT UNIQUE NOT NULL,
  amount INTEGER NOT NULL,
  credits INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Create viewing_sessions table
CREATE TABLE IF NOT EXISTS viewing_sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  credits_earned INTEGER DEFAULT 0
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_videos_creator_id ON videos(creator_id);
CREATE INDEX IF NOT EXISTS idx_videos_is_active ON videos(is_active);
CREATE INDEX IF NOT EXISTS idx_daily_stats_video_date ON daily_stats(video_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_viewing_sessions_user_video ON viewing_sessions(user_id, video_id);

-- Add update triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

4. Click **Run** to execute the schema

### Option B: Use Migration File

If you prefer using Drizzle migrations:
1. Update your `DATABASE_URL` first (see step 4)
2. Run: `npm run db:push`

## 4. Update Environment Variables

### Local Development (.env.local)
```env
# Replace your current DATABASE_URL with Supabase
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@[region].pooler.supabase.com:5432/postgres?pgbouncer=true

# Keep your other variables
VITE_CLERK_PUBLISHABLE_KEY=[your-clerk-publishable-key]
CLERK_SECRET_KEY=[your-clerk-secret-key]
```

### Vercel Environment Variables
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Update `DATABASE_URL` with your Supabase connection string
3. Save and redeploy

## 5. Add Sample Data (Optional)

Once your schema is set up, you can add sample data:

```sql
-- Insert a demo user (you can use your Clerk user ID here)
INSERT INTO users (id, email, first_name, last_name, credits)
VALUES ('demo-user-1', 'demo@example.com', 'Demo', 'User', 100);

-- Insert sample videos
INSERT INTO videos (id, title, description, product_url, video_path, thumbnail_path, creator_id)
VALUES 
  ('demo-1', 'TaskFlow Demo', 'AI-powered project management', 'https://example.com', 'https://example.com/video1.mp4', null, 'demo-user-1'),
  ('demo-2', 'CodeSnap Demo', 'Instant code reviews', 'https://example.com', 'https://example.com/video2.mp4', null, 'demo-user-1'),
  ('demo-3', 'DataViz Demo', 'Beautiful analytics', 'https://example.com', 'https://example.com/video3.mp4', null, 'demo-user-1');

-- Insert sample tags
INSERT INTO tags (name) VALUES ('AI'), ('SaaS'), ('Developer Tools'), ('Analytics');
```

## 6. Test Your Connection

Run this test script to verify everything works:

```bash
cd /Users/miguel/Downloads/ShipShowDaily
npx tsx -e "
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool });

const result = await db.execute(sql\`SELECT COUNT(*) as count FROM users\`);
console.log('Users in database:', result.rows[0].count);
console.log('✅ Database connection successful!');
process.exit(0);
"
```

## 7. Advantages of Using Supabase

- **Better UI**: Visual table editor, SQL editor, and logs
- **Real-time subscriptions**: Built-in if you need them later
- **Storage**: Built-in file storage for videos/images
- **Authentication**: Can replace Clerk if desired
- **Free tier**: Generous limits for starting out
- **Automatic backups**: Daily backups on free tier

## 8. Next Steps

1. ✅ Create Supabase project
2. ✅ Run the schema SQL
3. ✅ Update DATABASE_URL in .env.local
4. ✅ Update DATABASE_URL in Vercel
5. ✅ Test the connection
6. ✅ Redeploy to Vercel

Your app will automatically work with the new database!
