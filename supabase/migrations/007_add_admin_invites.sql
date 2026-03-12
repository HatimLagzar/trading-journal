-- Add admin role on auth.users and premium invite tokens.

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

ALTER TABLE auth.users
  ADD COLUMN IF NOT EXISTS app_role app_user_role NOT NULL DEFAULT 'user';

UPDATE auth.users
SET app_role = 'admin'::app_user_role
WHERE id = '11976209-2db2-459a-b81f-f287906ebbfc';

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = auth.uid()
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

CREATE OR REPLACE FUNCTION public.apply_premium_invite_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  invite_token TEXT;
  invite_row public.premium_invites%ROWTYPE;
  invite_period_end TIMESTAMP WITH TIME ZONE;
BEGIN
  invite_token := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'invite_token', '')), '');

  IF invite_token IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO invite_row
  FROM public.premium_invites
  WHERE token_hash = ENCODE(extensions.digest(invite_token, 'sha256'), 'hex')
    AND used_at IS NULL
    AND (expires_at IS NULL OR expires_at > NEW.created_at)
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  UPDATE public.premium_invites
  SET
    used_at = NEW.created_at,
    used_by = NEW.id
  WHERE id = invite_row.id
    AND used_at IS NULL;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  invite_period_end := NEW.created_at + MAKE_INTERVAL(days => invite_row.grants_days);

  INSERT INTO public.user_subscriptions (
    user_id,
    billing_provider,
    plan,
    status,
    current_period_end,
    cancel_at_period_end
  )
  VALUES (
    NEW.id,
    'none',
    'premium_monthly',
    'trialing',
    invite_period_end,
    FALSE
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    billing_provider = EXCLUDED.billing_provider,
    plan = EXCLUDED.plan,
    status = EXCLUDED.status,
    current_period_end = GREATEST(
      COALESCE(public.user_subscriptions.current_period_end, EXCLUDED.current_period_end),
      EXCLUDED.current_period_end
    ),
    cancel_at_period_end = FALSE;

  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) - 'invite_token'
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_apply_premium_invite_on_signup ON auth.users;
CREATE TRIGGER trigger_apply_premium_invite_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_premium_invite_on_signup();
