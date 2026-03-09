-- Ongoing-trade thinking quotes (text/image discussion)
CREATE TABLE IF NOT EXISTS trade_thinking_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  quote_text TEXT,
  image_storage_path TEXT,
  image_filename TEXT,
  CONSTRAINT trade_thinking_quotes_has_content CHECK (
    COALESCE(NULLIF(TRIM(quote_text), ''), '') <> ''
    OR image_storage_path IS NOT NULL
  )
);

ALTER TABLE trade_thinking_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own trade thinking quotes" ON trade_thinking_quotes;
CREATE POLICY "Users can view their own trade thinking quotes" ON trade_thinking_quotes
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own trade thinking quotes" ON trade_thinking_quotes;
CREATE POLICY "Users can insert their own trade thinking quotes" ON trade_thinking_quotes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own trade thinking quotes" ON trade_thinking_quotes;
CREATE POLICY "Users can delete their own trade thinking quotes" ON trade_thinking_quotes
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_trade_thinking_quotes_trade_id_created_at
  ON trade_thinking_quotes(trade_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_trade_thinking_quotes_user_id
  ON trade_thinking_quotes(user_id);
