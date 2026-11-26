-- Phase 2 / 0013: auth profile creation and invite-only admin registration.
-- The raw invite token is generated in the client and never sent to the database;
-- only its SHA-256 hex hash is stored and compared.
-- No user can assign themselves the admin role: the secure function validates a
-- single-use, unexpired invitation that matches the new auth user's email.

CREATE TABLE IF NOT EXISTS public.admin_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  invited_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_invitations_email_format CHECK (
    email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  CONSTRAINT admin_invitations_token_hash CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT admin_invitations_expiry_future CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS admin_invitations_email_idx
  ON public.admin_invitations (lower(email));
CREATE INDEX IF NOT EXISTS admin_invitations_unused_idx
  ON public.admin_invitations (expires_at) WHERE used_at IS NULL;

ALTER TABLE public.admin_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_invitations_admin_select ON public.admin_invitations;
CREATE POLICY admin_invitations_admin_select ON public.admin_invitations
  FOR SELECT TO authenticated USING (public.is_admin());

-- Supabase Auth trigger: create a profile for every new auth user.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    coalesce(nullif(btrim(NEW.raw_user_meta_data ->> 'full_name'), ''), split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Refresh the self-escalation guard so a validated invitation can insert exactly
-- one admin role assignment without allowing ordinary self-assignment.
CREATE OR REPLACE FUNCTION public.prevent_user_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE')
     AND NEW.user_id = auth.uid()
     AND NOT public.is_service_role()
     AND coalesce(current_setting('app.admin_invite_accepted', true), '') <> 'true'
     AND EXISTS (
       SELECT 1 FROM public.roles r
       WHERE r.id = NEW.role_id AND r.name IN ('admin', 'organizer')
     ) THEN
    RAISE EXCEPTION 'Self-assignment of admin/organizer roles is not allowed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_admin_invitation(
  p_email text,
  p_token_hash text,
  p_expires_in interval DEFAULT interval '7 days'
)
RETURNS public.admin_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result public.admin_invitations;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can create admin invitations';
  END IF;
  IF p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'Invalid invitation email';
  END IF;
  IF p_token_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid invitation token hash';
  END IF;
  IF p_expires_in IS NULL OR p_expires_in <= interval '0' THEN
    RAISE EXCEPTION 'Invitation lifetime must be positive';
  END IF;

  INSERT INTO public.admin_invitations (email, token_hash, invited_by, expires_at)
  VALUES (p_email, p_token_hash, auth.uid(), now() + p_expires_in)
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_admin_invitation(
  p_user_id uuid,
  p_token_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation public.admin_invitations;
BEGIN
  IF p_token_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid invitation token hash';
  END IF;

  SELECT * INTO v_invitation
  FROM public.admin_invitations
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND OR v_invitation.used_at IS NOT NULL OR v_invitation.expires_at <= now() THEN
    RAISE EXCEPTION 'Invitation is invalid, expired, or already used';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = p_user_id AND lower(u.email) = lower(v_invitation.email)
  ) THEN
    RAISE EXCEPTION 'Invitation email does not match this account';
  END IF;

  UPDATE public.admin_invitations
  SET used_at = now()
  WHERE id = v_invitation.id;

  BEGIN
    PERFORM set_config('app.admin_invite_accepted', 'true', true);
    INSERT INTO public.user_roles (user_id, role_id, assigned_by)
    SELECT p_user_id, r.id, v_invitation.invited_by
    FROM public.roles r
    WHERE r.name = 'admin'
    ON CONFLICT (user_id, role_id) DO NOTHING;
    PERFORM set_config('app.admin_invite_accepted', '', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.admin_invite_accepted', '', true);
    RAISE;
  END;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.create_admin_invitation(text, text, interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_admin_invitation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_admin_invitation(text, text, interval) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_admin_invitation(uuid, text) TO anon, authenticated;
