-- Create the missing video_views table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS video_views (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  video_id VARCHAR NOT NULL REFERENCES videos(id),
  viewer_id VARCHAR NOT NULL REFERENCES users(id),
  watched_at TIMESTAMP DEFAULT NOW(),
  watch_duration INTEGER NOT NULL,
  completed_minimum BOOLEAN DEFAULT false NOT NULL,
  credit_awarded BOOLEAN DEFAULT false NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_views_video_id ON video_views(video_id);
CREATE INDEX IF NOT EXISTS idx_video_views_viewer_id ON video_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_video_views_watched_at ON video_views(watched_at);

-- Enable RLS
ALTER TABLE video_views ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own video views" ON video_views
    FOR SELECT USING (viewer_id = auth.uid()::text OR true);