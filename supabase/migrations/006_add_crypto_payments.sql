-- Add provider metadata for subscriptions and crypto payment audit log.
ALTER TABLE user_subscriptions
  ADD COLUMN IF NOT EXISTS billing_provider TEXT NOT NULL DEFAULT 'none'
  CHECK (billing_provider IN ('none', 'stripe', 'nowpayments'));

CREATE TABLE IF NOT EXISTS crypto_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('nowpayments')),
  provider_payment_id TEXT NOT NULL UNIQUE,
  checkout_reference TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'annual')),
  status TEXT NOT NULL,
  price_usd NUMERIC(12, 2) NOT NULL,
  pay_amount NUMERIC(24, 12),
  pay_currency TEXT,
  network TEXT,
  tx_hash TEXT,
  period_start TIMESTAMP WITH TIME ZONE,
  period_end TIMESTAMP WITH TIME ZONE,
  raw_payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crypto_payments_user_id ON crypto_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_crypto_payments_status ON crypto_payments(status);
CREATE INDEX IF NOT EXISTS idx_crypto_payments_checkout_reference ON crypto_payments(checkout_reference);

CREATE OR REPLACE FUNCTION update_crypto_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_crypto_payments_updated_at ON crypto_payments;
CREATE TRIGGER trigger_update_crypto_payments_updated_at
  BEFORE UPDATE ON crypto_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_crypto_payments_updated_at();

ALTER TABLE crypto_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own crypto payments" ON crypto_payments;
CREATE POLICY "Users can view own crypto payments" ON crypto_payments
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own crypto payments" ON crypto_payments;
CREATE POLICY "Users can insert own crypto payments" ON crypto_payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
