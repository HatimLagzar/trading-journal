-- Create systems table for storing trading system rules
CREATE TABLE IF NOT EXISTS systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  entry_rules TEXT,
  sl_rules TEXT,
  tp_rules TEXT,
  description TEXT
);

-- Add unique constraint for system name per user (drop first if exists)
DO $$ BEGIN
  ALTER TABLE systems DROP CONSTRAINT IF EXISTS unique_system_name_per_user;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
ALTER TABLE systems ADD CONSTRAINT unique_system_name_per_user UNIQUE (user_id, name);

-- Enable RLS
ALTER TABLE systems ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only see their own systems
DROP POLICY IF EXISTS "Users can only view their own systems" ON systems;
CREATE POLICY "Users can only view their own systems" ON systems
  FOR SELECT USING (auth.uid() = user_id);

-- RLS policy: users can only insert their own systems
DROP POLICY IF EXISTS "Users can only insert their own systems" ON systems;
CREATE POLICY "Users can only insert their own systems" ON systems
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS policy: users can only update their own systems
DROP POLICY IF EXISTS "Users can only update their own systems" ON systems;
CREATE POLICY "Users can only update their own systems" ON systems
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS policy: users can only delete their own systems
DROP POLICY IF EXISTS "Users can only delete their own systems" ON systems;
CREATE POLICY "Users can only delete their own systems" ON systems
  FOR DELETE USING (auth.uid() = user_id);

-- Add system_id column to trades if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'system_id') THEN
    ALTER TABLE trades ADD COLUMN system_id UUID REFERENCES systems(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_systems_user_id ON systems(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_system_id ON trades(system_id);
