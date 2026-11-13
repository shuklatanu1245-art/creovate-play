-- ========================================================
-- CROCHIT MESSENGER - SUPABASE DATABASE CONFIGURATION
-- Run this script in your Supabase Dashboard SQL Editor (1-Click Setup)
-- Dashboard URL: https://supabase.com/dashboard/project/bmiabyytkxutomjtejot/sql
-- ========================================================

-- 1. Disable Row Level Security (RLS) on users & user_chats
ALTER TABLE IF EXISTS crochit_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS crochit_user_chats DISABLE ROW LEVEL SECURITY;

-- 2. Create crochit_messages table for real-time cross-user messaging
CREATE TABLE IF NOT EXISTS crochit_messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT,
  receiver_id TEXT NOT NULL,
  text TEXT,
  image TEXT,
  is_voice_note BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'delivered',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Disable RLS on messages table so client can insert and receive messages
ALTER TABLE crochit_messages DISABLE ROW LEVEL SECURITY;

-- 4. Enable Realtime replication for instant cross-device delivery
ALTER PUBLICATION supabase_realtime ADD TABLE crochit_messages;

-- 5. Indexes for fast user search and message queries
CREATE INDEX IF NOT EXISTS idx_crochit_users_username ON crochit_users (username);
CREATE INDEX IF NOT EXISTS idx_crochit_messages_chat_id ON crochit_messages (chat_id);
CREATE INDEX IF NOT EXISTS idx_crochit_messages_receiver ON crochit_messages (receiver_id);
