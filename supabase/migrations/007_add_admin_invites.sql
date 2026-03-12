-- Add app admin role and premium invite tokens.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'app_user_role'
  ) THEN
    CREATE TYPE app_user_role AS ENUM ('user', 'admin');
  END IF;
END;
$$;

ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS app_role app_user_role NOT NULL DEFAULT 'user';

INSERT INTO public.user_subscriptions (
  user_id,
  billing_provider,
  plan,
  status,
  cancel_at_period_end,
  app_role
)
VALUES (
  '11976209-2db2-459a-b81f-f287906ebbfc',
  'none',
  'free',
  'inactive',
  FALSE,
  'admin'::app_user_role
)
ON CONFLICT (user_id) DO UPDATE
SET app_role = 'admin'::app_user_role;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_subscriptions
    WHERE user_id = auth.uid()
      AND app_role = 'admin'::app_user_role
  );
$$;

REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;

CREATE TABLE IF NOT EXISTS public.premium_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE,
  grants_days INTEGER NOT NULL DEFAULT 2 CHECK (grants_days > 0),
  used_at TIMESTAMP WITH TIME ZONE,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_premium_invites_created_by ON public.premium_invites(created_by);
CREATE INDEX IF NOT EXISTS idx_premium_invites_used_at ON public.premium_invites(used_at);
CREATE INDEX IF NOT EXISTS idx_premium_invites_expires_at ON public.premium_invites(expires_at);

CREATE OR REPLACE FUNCTION public.update_premium_invites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_premium_invites_updated_at ON public.premium_invites;
CREATE TRIGGER trigger_update_premium_invites_updated_at
  BEFORE UPDATE ON public.premium_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_premium_invites_updated_at();

ALTER TABLE public.premium_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view premium invites" ON public.premium_invites;
CREATE POLICY "Admins can view premium invites" ON public.premium_invites
  FOR SELECT USING (public.is_current_user_admin());

DROP POLICY IF EXISTS "Admins can create premium invites" ON public.premium_invites;
CREATE POLICY "Admins can create premium invites" ON public.premium_invites
  FOR INSERT WITH CHECK (
    public.is_current_user_admin()
    AND created_by = auth.uid()
  );
