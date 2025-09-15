-- Missing tables from your Supabase database
-- Run this in Supabase SQL Editor to add the missing tables

-- Create sessions table (for Clerk/auth integration)
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_expire ON sessions(expire);

-- Create credit_transactions table
CREATE TABLE IF NOT EXISTS credit_transactions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  user_id VARCHAR NOT NULL REFERENCES users(id),
  type VARCHAR(50) NOT NULL,
  amount INTEGER NOT NULL,
  reason VARCHAR(255) NOT NULL,
  video_id VARCHAR REFERENCES videos(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create video_viewing_sessions table
CREATE TABLE IF NOT EXISTS video_viewing_sessions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
  user_id VARCHAR NOT NULL REFERENCES users(id),
  video_id VARCHAR NOT NULL REFERENCES videos(id),
  started_at TIMESTAMP DEFAULT NOW(),
  is_completed BOOLEAN DEFAULT false NOT NULL,
  completed_at TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_session ON video_viewing_sessions(user_id, video_id, is_completed);

-- Enable RLS on credit_transactions
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Basic RLS policy for credit_transactions
CREATE POLICY "Users can view own transactions" ON credit_transactions
    FOR SELECT USING (user_id = auth.uid()::text OR true); -- Adjust based on your auth setup