-- Phase 1 / 0008: notifications, reviews, platform settings and immutable audit log.

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_title_not_blank CHECK (length(btrim(title)) > 0)
);

CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  rating smallint NOT NULL,
  title text,
  comment text,
  status public.review_status NOT NULL DEFAULT 'pending',
  moderated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reviews_event_customer_key UNIQUE (event_id, customer_id),
  CONSTRAINT reviews_rating_range CHECK (rating >= 1 AND rating <= 5),
  CONSTRAINT reviews_comment_present CHECK (
    comment IS NOT NULL OR title IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL,
  description text,
  is_public boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_settings_key_format CHECK (
    key ~ '^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$'
  )
);

COMMENT ON TABLE public.platform_settings IS 'is_public = true is the only flag that exposes setting values to anonymous clients.';

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  actor_role public.app_role,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_action_not_blank CHECK (length(btrim(action)) > 0),
  CONSTRAINT audit_logs_entity_type_not_blank CHECK (length(btrim(entity_type)) > 0)
);

COMMENT ON TABLE public.audit_logs IS 'Append-only audit trail. No UPDATE/DELETE policy is granted; only service-role/backend writes.';
