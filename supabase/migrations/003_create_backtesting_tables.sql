-- Create backtesting sessions table
CREATE TABLE IF NOT EXISTS backtesting_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL,
  system_id UUID REFERENCES systems(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  notes TEXT
);

-- Create backtesting trades table (theoretical trades in R)
CREATE TABLE IF NOT EXISTS backtesting_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES backtesting_sessions(id) ON DELETE CASCADE,
  trade_date DATE NOT NULL,
  trade_time TIME,
  asset TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('long', 'short')),
  entry_price DOUBLE PRECISION,
  stop_loss DOUBLE PRECISION,
  target_price DOUBLE PRECISION,
  outcome_r DOUBLE PRECISION NOT NULL,
  notes TEXT
);

-- Enable RLS
ALTER TABLE backtesting_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE backtesting_trades ENABLE ROW LEVEL SECURITY;

-- Sessions policies
DROP POLICY IF EXISTS "Users can only view their own backtesting sessions" ON backtesting_sessions;
CREATE POLICY "Users can only view their own backtesting sessions" ON backtesting_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only insert their own backtesting sessions" ON backtesting_sessions;
CREATE POLICY "Users can only insert their own backtesting sessions" ON backtesting_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only update their own backtesting sessions" ON backtesting_sessions;
CREATE POLICY "Users can only update their own backtesting sessions" ON backtesting_sessions
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only delete their own backtesting sessions" ON backtesting_sessions;
CREATE POLICY "Users can only delete their own backtesting sessions" ON backtesting_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Trades policies
DROP POLICY IF EXISTS "Users can only view their own backtesting trades" ON backtesting_trades;
CREATE POLICY "Users can only view their own backtesting trades" ON backtesting_trades
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only insert their own backtesting trades" ON backtesting_trades;
CREATE POLICY "Users can only insert their own backtesting trades" ON backtesting_trades
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only update their own backtesting trades" ON backtesting_trades;
CREATE POLICY "Users can only update their own backtesting trades" ON backtesting_trades
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only delete their own backtesting trades" ON backtesting_trades;
CREATE POLICY "Users can only delete their own backtesting trades" ON backtesting_trades
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_backtesting_sessions_user_id ON backtesting_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_backtesting_sessions_system_id ON backtesting_sessions(system_id);
CREATE INDEX IF NOT EXISTS idx_backtesting_trades_user_id ON backtesting_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_backtesting_trades_session_id ON backtesting_trades(session_id);
CREATE INDEX IF NOT EXISTS idx_backtesting_trades_trade_date ON backtesting_trades(trade_date);
