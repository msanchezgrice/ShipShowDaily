-- Create video_shares table for tracking share events
CREATE TABLE IF NOT EXISTS video_shares (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,  -- nullable for anonymous shares
  video_id VARCHAR NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,  -- 'twitter', 'linkedin', 'facebook', 'copy', 'other'
  shared_at TIMESTAMP DEFAULT NOW()
);

-- Index for querying shares by video
CREATE INDEX IF NOT EXISTS idx_video_shares_video_id ON video_shares(video_id);

-- Index for querying shares by user
CREATE INDEX IF NOT EXISTS idx_video_shares_user_id ON video_shares(user_id);
