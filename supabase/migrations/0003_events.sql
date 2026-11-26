-- Phase 1 / 0003: event catalog, public event records and explicit staff assignments.

CREATE TABLE IF NOT EXISTS public.event_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_categories_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT event_categories_sort_order_nonnegative CHECK (sort_order >= 0)
);

-- Reference data mirroring the existing frontend categories; no event/business data.
INSERT INTO public.event_categories (name, slug, sort_order)
VALUES
  ('Concerts & Music', 'concerts-music', 1),
  ('Sports', 'sports', 2),
  ('Festivals', 'festivals', 3),
  ('Theatre', 'theatre', 4),
  ('Technology', 'technology', 5),
  ('Workshops', 'workshops', 6),
  ('Business Events', 'business-events', 7),
  ('Other Experiences', 'other-experiences', 8)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES public.organizers (id) ON DELETE RESTRICT,
  category_id uuid NOT NULL REFERENCES public.event_categories (id) ON DELETE RESTRICT,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  cover_image_url text,
  gallery_image_urls text[] NOT NULL DEFAULT '{}',
  venue_name text,
  venue_address text,
  venue_city text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status public.event_status NOT NULL DEFAULT 'draft',
  approval_status public.approval_status NOT NULL DEFAULT 'pending',
  capacity integer,
  published_at timestamptz,
  approved_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT events_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT events_title_not_blank CHECK (length(btrim(title)) > 0),
  CONSTRAINT events_time_order CHECK (ends_at > starts_at),
  CONSTRAINT events_capacity_positive CHECK (capacity IS NULL OR capacity > 0),
  CONSTRAINT events_cancelled_has_reason CHECK (
    status <> 'cancelled' OR (cancelled_at IS NOT NULL AND length(btrim(cancellation_reason)) > 0)
  ),
  CONSTRAINT events_published_has_timestamp CHECK (
    status <> 'published' OR published_at IS NOT NULL
  ),
  CONSTRAINT events_approval_timestamp_consistency CHECK (
    (approval_status = 'approved' AND approved_at IS NOT NULL) OR
    (approval_status <> 'approved' AND approved_at IS NULL)
  )
);

COMMENT ON COLUMN public.events.status IS 'Publication lifecycle. Public reads also require approval_status = approved and cancelled_at IS NULL.';
COMMENT ON COLUMN public.events.gallery_image_urls IS 'Storage object paths/URLs. Public only when the event itself is public.';

CREATE TABLE IF NOT EXISTS public.event_lineup_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_lineup_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT event_lineup_sort_order_nonnegative CHECK (sort_order >= 0)
);

-- Staff access is event-specific: an assignment here is the only staff path to event data.
CREATE TABLE IF NOT EXISTS public.event_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  permission public.event_staff_permission NOT NULL DEFAULT 'view',
  status public.account_status NOT NULL DEFAULT 'active',
  assigned_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_staff_unique UNIQUE (event_id, user_id)
);
