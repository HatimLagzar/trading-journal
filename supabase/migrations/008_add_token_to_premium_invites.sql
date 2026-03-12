-- Persist invite token for admin copy actions.
ALTER TABLE public.premium_invites
  ADD COLUMN IF NOT EXISTS token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_premium_invites_token_unique
  ON public.premium_invites(token)
  WHERE token IS NOT NULL;
