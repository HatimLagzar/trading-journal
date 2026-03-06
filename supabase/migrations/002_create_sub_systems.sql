-- Create sub_systems table
CREATE TABLE IF NOT EXISTS sub_systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL,
  system_id UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  entry_rules TEXT,
  sl_rules TEXT,
  tp_rules TEXT,
  description TEXT
);

-- Add unique constraint for sub-system name per system per user
ALTER TABLE sub_systems ADD CONSTRAINT unique_sub_system_name_per_system UNIQUE (user_id, system_id, name);

-- Enable RLS
ALTER TABLE sub_systems ENABLE ROW LEVEL SECURITY;

--DROP POLICY IF EXISTS "Users can only view their own sub_systems" ON sub_systems;
CREATE POLICY "Users can only view their own sub_systems" ON sub_systems
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only insert their own sub_systems" ON sub_systems;
CREATE POLICY "Users can only insert their own sub_systems" ON sub_systems
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only update their own sub_systems" ON sub_systems;
CREATE POLICY "Users can only update their own sub_systems" ON sub_systems
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only delete their own sub_systems" ON sub_systems;
CREATE POLICY "Users can only delete their own sub_systems" ON sub_systems
  FOR DELETE USING (auth.uid() = user_id);

-- Add sub_system_id column to trades if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'sub_system_id') THEN
    ALTER TABLE trades ADD COLUMN sub_system_id UUID REFERENCES sub_systems(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sub_systems_user_id ON sub_systems(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_systems_system_id ON sub_systems(system_id);
CREATE INDEX IF NOT EXISTS idx_trades_sub_system_id ON trades(sub_system_id);
