-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'favorite', 'share', 'view_milestone', 'comment', etc.
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  video_id VARCHAR REFERENCES videos(id) ON DELETE CASCADE,
  actor_id VARCHAR REFERENCES users(id) ON DELETE SET NULL, -- User who triggered the notification
  is_read BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast user notification lookups
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications(user_id, is_read) WHERE is_read = FALSE;
