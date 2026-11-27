-- Invite new organizer accounts by email. Accepted invitations create a
-- pending organizer profile that an administrator must approve.

CREATE TABLE IF NOT EXISTS public.organizer_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  organizer_name text NOT NULL,
  organizer_slug text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  invited_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizer_invitations_email_format CHECK (
    email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  CONSTRAINT organizer_invitations_name_not_blank CHECK (length(btrim(organizer_name)) > 0),
  CONSTRAINT organizer_invitations_slug_format CHECK (
    organizer_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  CONSTRAINT organizer_invitations_token_hash CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT organizer_invitations_expiry_future CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS organizer_invitations_email_idx
  ON public.organizer_invitations (lower(email));
CREATE INDEX IF NOT EXISTS organizer_invitations_unused_idx
  ON public.organizer_invitations (expires_at) WHERE used_at IS NULL;

ALTER TABLE public.organizer_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizer_invitations_admin_select
  ON public.organizer_invitations;
CREATE POLICY organizer_invitations_admin_select
  ON public.organizer_invitations
  FOR SELECT TO authenticated USING (public.is_admin());

REVOKE ALL ON TABLE public.organizer_invitations FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.organizer_invitations TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_organizer_invitation(
  p_email text,
  p_organizer_name text,
  p_organizer_slug text,
  p_token_hash text,
  p_expires_in interval DEFAULT interval '7 days'
)
RETURNS public.organizer_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result public.organizer_invitations;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := btrim(coalesce(p_organizer_name, ''));
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can invite organizers';
  END IF;
  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'Enter a valid organizer email address';
  END IF;
  IF length(v_name) NOT BETWEEN 1 AND 160 THEN
    RAISE EXCEPTION 'Enter an organizer name between 1 and 160 characters';
  END IF;
  IF p_organizer_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Invalid organizer URL slug';
  END IF;
  IF p_token_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid invitation token hash';
  END IF;
  IF p_expires_in IS NULL OR p_expires_in <= interval '0' THEN
    RAISE EXCEPTION 'Invitation lifetime must be positive';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) THEN
    RAISE EXCEPTION 'This email already has an account; invite a new email address';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.organizer_invitations
    WHERE lower(email) = v_email
      AND used_at IS NULL
      AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'An active organizer invitation already exists for this email';
  END IF;
  IF EXISTS (SELECT 1 FROM public.organizers WHERE slug = p_organizer_slug)
    OR EXISTS (
      SELECT 1 FROM public.organizer_invitations
      WHERE organizer_slug = p_organizer_slug
        AND used_at IS NULL
        AND expires_at > now()
    )
  THEN
    RAISE EXCEPTION 'That organizer URL slug is already in use';
  END IF;

  INSERT INTO public.organizer_invitations (
    email, organizer_name, organizer_slug, token_hash, invited_by, expires_at
  )
  VALUES (
    v_email, v_name, p_organizer_slug, p_token_hash, auth.uid(), now() + p_expires_in
  )
  RETURNING * INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_organizer_invitation(p_invitation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can cancel organizer invitations';
  END IF;

  DELETE FROM public.organizer_invitations
  WHERE id = p_invitation_id AND used_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The unused organizer invitation could not be cancelled';
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_organizer_invitation(
  p_user_id uuid,
  p_token_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation public.organizer_invitations;
BEGIN
  IF p_token_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid organizer invitation token';
  END IF;

  SELECT * INTO v_invitation
  FROM public.organizer_invitations
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND OR v_invitation.used_at IS NOT NULL OR v_invitation.expires_at <= now() THEN
    RAISE EXCEPTION 'Organizer invitation is invalid, expired, or already used';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = p_user_id AND lower(email) = lower(v_invitation.email)
  ) THEN
    RAISE EXCEPTION 'Organizer invitation email does not match this account';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.organizers WHERE owner_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'This account already owns an organizer profile';
  END IF;

  UPDATE public.organizer_invitations
  SET used_at = now()
  WHERE id = v_invitation.id;

  BEGIN
    PERFORM set_config('app.organizer_invite_accepted', 'true', true);
    INSERT INTO public.user_roles (user_id, role_id, assigned_by)
    SELECT p_user_id, r.id, v_invitation.invited_by
    FROM public.roles r
    WHERE r.name = 'organizer'
    ON CONFLICT (user_id, role_id) DO NOTHING;
    PERFORM set_config('app.organizer_invite_accepted', '', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.organizer_invite_accepted', '', true);
    RAISE;
  END;

  INSERT INTO public.organizers (
    owner_id, slug, name, contact_email, status, approval_status
  )
  VALUES (
    p_user_id, v_invitation.organizer_slug, v_invitation.organizer_name,
    v_invitation.email, 'pending', 'pending'
  );
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.create_organizer_invitation(text, text, text, text, interval)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_organizer_invitation(text, text, text, text, interval)
  TO authenticated;
REVOKE ALL ON FUNCTION public.cancel_organizer_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_organizer_invitation(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.accept_organizer_invitation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_organizer_invitation(uuid, text)
  TO anon, authenticated;

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
     AND coalesce(current_setting('app.organizer_invite_accepted', true), '') <> 'true'
     AND EXISTS (
       SELECT 1 FROM public.roles r
       WHERE r.id = NEW.role_id AND r.name IN ('admin', 'organizer')
     ) THEN
    RAISE EXCEPTION 'Self-assignment of admin/organizer roles is not allowed';
  END IF;
  RETURN NEW;
END;
$$;
