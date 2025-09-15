-- Supabase Migration Script for ShipShowDaily
-- Run this in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create sessions table (for legacy Clerk integration)
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_expire ON sessions(expire);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  email VARCHAR UNIQUE,
  first_name VARCHAR,
  last_name VARCHAR,
  profile_image_url VARCHAR,
  credits INTEGER DEFAULT 0 NOT NULL,
  total_credits_earned INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create videos table
CREATE TABLE IF NOT EXISTS videos (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  product_url VARCHAR(500) NOT NULL,
  video_path VARCHAR(500) NOT NULL,
  thumbnail_path VARCHAR(500),
  creator_id VARCHAR NOT NULL REFERENCES users(id),
  total_views INTEGER DEFAULT 0 NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  provider VARCHAR(10) DEFAULT 's3',
  provider_asset_id VARCHAR(255),
  hls_url VARCHAR(500),
  dash_url VARCHAR(500),
  status VARCHAR(20) DEFAULT 'ready',
  moderation_state VARCHAR(20) DEFAULT 'approved',
  duration_s INTEGER,
  width INTEGER,
  height INTEGER,
  boost_amount INTEGER DEFAULT 0 NOT NULL
);

-- Create credit_transactions table (was missing from screenshot)
CREATE TABLE IF NOT EXISTS credit_transactions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  user_id VARCHAR NOT NULL REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  amount INTEGER NOT NULL,
  reason VARCHAR(255) NOT NULL,
  video_id VARCHAR REFERENCES videos(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create video_views table
CREATE TABLE IF NOT EXISTS video_views (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  video_id VARCHAR NOT NULL REFERENCES videos(id),
  viewer_id VARCHAR NOT NULL REFERENCES users(id),
  watched_at TIMESTAMP DEFAULT NOW(),
  watch_duration INTEGER NOT NULL,
  completed_minimum BOOLEAN DEFAULT false NOT NULL,
  credit_awarded BOOLEAN DEFAULT false NOT NULL
);

-- Create daily_stats table
CREATE TABLE IF NOT EXISTS daily_stats (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  date DATE NOT NULL,
  video_id VARCHAR NOT NULL REFERENCES videos(id),
  views INTEGER DEFAULT 0 NOT NULL,
  credits_spent INTEGER DEFAULT 0 NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_video_date ON daily_stats(video_id, date);

-- Create credit_transactions table
-- Create video_viewing_sessions table (renamed from viewing_sessions)
CREATE TABLE IF NOT EXISTS video_viewing_sessions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  user_id VARCHAR NOT NULL REFERENCES users(id),
  video_id VARCHAR NOT NULL REFERENCES videos(id),
  started_at TIMESTAMP DEFAULT NOW(),
  is_completed BOOLEAN DEFAULT false NOT NULL,
  completed_at TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_session ON video_viewing_sessions(user_id, video_id, is_completed);

-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  name VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create video_tags table
CREATE TABLE IF NOT EXISTS video_tags (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  video_id VARCHAR NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  tag_id VARCHAR NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_video_tag ON video_tags(video_id, tag_id);

-- Create video_favorites table
CREATE TABLE IF NOT EXISTS video_favorites (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id VARCHAR NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_video_favorite ON video_favorites(user_id, video_id);

-- Create demo_link_clicks table
CREATE TABLE IF NOT EXISTS demo_link_clicks (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id VARCHAR NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  clicked_at TIMESTAMP DEFAULT NOW()
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON videos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS (Row Level Security) policies if needed
-- Enable RLS on tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies (adjust as needed)
-- Allow authenticated users to read their own data
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (true);

CREATE POLICY "Anyone can view active videos" ON videos
    FOR SELECT USING (is_active = true);

CREATE POLICY "Creators can manage own videos" ON videos
    FOR ALL USING (creator_id = id);

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Add any initial data
-- Example: Add demo user if needed
-- INSERT INTO users (id, email, first_name, last_name, credits) 
-- VALUES ('demo-user-id', 'demo@example.com', 'Demo', 'User', 100)
-- ON CONFLICT (id) DO NOTHING;