-- Phase 1 / 0002: identity, roles and organizer ownership.
-- Auth is NOT implemented here; profiles are designed to mirror auth.users rows.

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text,
  email text,
  avatar_url text,
  phone text,
  status public.account_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_email_format CHECK (
    email IS NULL OR email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  CONSTRAINT profiles_phone_format CHECK (phone IS NULL OR length(phone) <= 32)
);

COMMENT ON TABLE public.profiles IS 'User-facing profile data keyed by auth.users.id. No authentication logic lives in Phase 1.';

CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name public.app_role NOT NULL UNIQUE,
  description text,
  is_system boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Configuration data, not sample/business data. Safe to repeat.
INSERT INTO public.roles (name, description)
VALUES
  ('admin', 'Platform administrator with full controlled access'),
  ('organizer', 'Event organizer account owner'),
  ('staff', 'Event/organizer staff member with explicit assignments'),
  ('customer', 'Ticket buyer')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles (id) ON DELETE RESTRICT,
  assigned_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_user_role_key UNIQUE (user_id, role_id)
);

COMMENT ON TABLE public.user_roles IS 'Role assignments are writable only through public.assign_user_role/remove_user_role, never through direct client DML.';

CREATE TABLE IF NOT EXISTS public.organizers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  logo_url text,
  contact_email text,
  contact_phone text,
  website_url text,
  address text,
  status public.organizer_status NOT NULL DEFAULT 'pending',
  approval_status public.approval_status NOT NULL DEFAULT 'pending',
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizers_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT organizers_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT organizers_contact_email_format CHECK (
    contact_email IS NULL OR contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  CONSTRAINT organizers_approval_consistency CHECK (
    (approval_status = 'approved' AND approved_at IS NOT NULL) OR
    (approval_status <> 'approved' AND approved_at IS NULL)
  ),
  CONSTRAINT organizers_active_requires_approval CHECK (
    status <> 'active' OR approval_status = 'approved'
  )
);

CREATE TABLE IF NOT EXISTS public.organizer_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES public.organizers (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role public.organizer_staff_role NOT NULL DEFAULT 'manager',
  status public.account_status NOT NULL DEFAULT 'active',
  invited_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizer_staff_unique UNIQUE (organizer_id, user_id)
);
