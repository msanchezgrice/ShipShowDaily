-- Cloudflare Stream Migration
-- Run this in Supabase SQL Editor

-- Add new columns to support Cloudflare Stream
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 's3' CHECK (provider IN ('s3', 'stream')),
ADD COLUMN IF NOT EXISTS provider_asset_id TEXT,
ADD COLUMN IF NOT EXISTS hls_url TEXT,
ADD COLUMN IF NOT EXISTS dash_url TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ready' CHECK (status IN ('uploading', 'processing', 'ready', 'rejected')),
ADD COLUMN IF NOT EXISTS moderation_state TEXT DEFAULT 'approved' CHECK (moderation_state IN ('pending', 'approved', 'limited', 'rejected')),
ADD COLUMN IF NOT EXISTS duration_s INTEGER,
ADD COLUMN IF NOT EXISTS width INTEGER,
ADD COLUMN IF NOT EXISTS height INTEGER,
ADD COLUMN IF NOT EXISTS boost_amount INTEGER DEFAULT 0 NOT NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_videos_provider_status ON videos(provider, status);
CREATE INDEX IF NOT EXISTS idx_videos_provider_asset_id ON videos(provider_asset_id) WHERE provider_asset_id IS NOT NULL;

-- Update existing videos to have 'ready' status and 's3' provider
UPDATE videos 
SET 
  status = 'ready',
  provider = 's3',
  moderation_state = 'approved'
WHERE 
  status IS NULL 
  OR provider IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN videos.provider IS 'Video storage provider: s3 for Amazon S3, stream for Cloudflare Stream';
COMMENT ON COLUMN videos.provider_asset_id IS 'Unique identifier from the video provider (Cloudflare UID for Stream)';
COMMENT ON COLUMN videos.hls_url IS 'HLS manifest URL for streaming (Cloudflare Stream)';
COMMENT ON COLUMN videos.dash_url IS 'DASH manifest URL for streaming (Cloudflare Stream)';
COMMENT ON COLUMN videos.status IS 'Video processing status';
COMMENT ON COLUMN videos.moderation_state IS 'Content moderation status';
COMMENT ON COLUMN videos.duration_s IS 'Video duration in seconds';
COMMENT ON COLUMN videos.width IS 'Video width in pixels';
COMMENT ON COLUMN videos.height IS 'Video height in pixels';
COMMENT ON COLUMN videos.boost_amount IS 'Credits spent to boost video visibility';

-- Verify migration
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM 
  information_schema.columns 
WHERE 
  table_name = 'videos' 
  AND column_name IN (
    'provider', 
    'provider_asset_id', 
    'hls_url', 
    'dash_url', 
    'status',
    'moderation_state',
    'duration_s',
    'width',
    'height',
    'boost_amount'
  )
ORDER BY 
  ordinal_position;
