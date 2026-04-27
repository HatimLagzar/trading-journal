-- Set premium invite trial default to 15 days.
-- Also upgrade existing unused invites that still grant 2 days.

ALTER TABLE public.premium_invites
  ALTER COLUMN grants_days SET DEFAULT 15;

UPDATE public.premium_invites
SET grants_days = 15
WHERE used_at IS NULL
  AND grants_days = 2;
