ALTER TABLE backtesting_trades
  ADD COLUMN IF NOT EXISTS take_profits JSONB NOT NULL DEFAULT '[]'::JSONB;

ALTER TABLE backtesting_trades
  DROP CONSTRAINT IF EXISTS backtesting_trades_take_profits_is_array;

ALTER TABLE backtesting_trades
  ADD CONSTRAINT backtesting_trades_take_profits_is_array
  CHECK (jsonb_typeof(take_profits) = 'array');

UPDATE backtesting_trades
SET take_profits = jsonb_build_array(
  jsonb_build_object(
    'price', target_price,
    'quantity_percent', 100
  )
)
WHERE take_profits = '[]'::JSONB
  AND target_price IS NOT NULL
  AND target_price IS DISTINCT FROM stop_loss;
