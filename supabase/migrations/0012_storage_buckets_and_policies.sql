-- Phase 1 / 0012: Supabase Storage buckets and object-level policies.
-- Path conventions:
--   event-images/{event_id}/{filename}
--   event-gallery/{event_id}/{filename}
--   organizer-logos/{organizer_id}/{filename}
--   user-avatars/{auth_user_id}/{filename}
--   ticket-files/{order_id}/{ticket_id}/{filename}

-- These helpers are also defined in 0010. They are repeated here with
-- CREATE OR REPLACE so this storage migration can be applied on its own
-- without failing with "function public.is_admin() does not exist".
-- Re-running 0010 later simply restores the same definitions.

CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(auth.jwt() ->> 'role', current_setting('request.jwt.claim.role', true), '') = 'service_role';
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_service_role() OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.name = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(p_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_service_role() OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.name = p_role
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_organizer(p_organizer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizers o
    WHERE o.id = p_organizer_id AND o.owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_organizer(p_organizer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_admin()
    OR (public.has_role('organizer') AND public.owns_organizer(p_organizer_id));
$$;

CREATE OR REPLACE FUNCTION public.can_manage_event(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_admin()
    OR (
      public.has_role('organizer')
      AND public.owns_organizer((SELECT e.organizer_id FROM public.events e WHERE e.id = p_event_id))
    );
$$;

CREATE OR REPLACE FUNCTION public.owns_order(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = p_order_id
      AND (
        o.customer_id = auth.uid()
        OR (o.buyer_email IS NOT NULL AND lower(o.buyer_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.storage_path_uuid(p_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN split_part(p_name, '/', 1) ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN split_part(p_name, '/', 1)::uuid
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.storage_path_owned_by_user(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT split_part(p_name, '/', 1) = auth.uid()::text;
$$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('event-images', 'event-images', true, 10 * 1024 * 1024, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('event-gallery', 'event-gallery', true, 10 * 1024 * 1024, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('organizer-logos', 'organizer-logos', true, 5 * 1024 * 1024, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
  ('user-avatars', 'user-avatars', true, 5 * 1024 * 1024, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('ticket-files', 'ticket-files', false, 10 * 1024 * 1024, ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

-- Supabase enables RLS on storage.objects by default and, since April 2025,
-- blocks ALTER TABLE on storage-owned tables for project roles. Do not add
-- an ENABLE ROW LEVEL SECURITY statement here; only the policies below are
-- needed and are permitted by Supabase.

-- Public read is granted only through buckets explicitly marked public.
DROP POLICY IF EXISTS storage_public_asset_read ON storage.objects;
CREATE POLICY storage_public_asset_read ON storage.objects
  FOR SELECT TO public USING (
    EXISTS (
      SELECT 1 FROM storage.buckets b
      WHERE b.id = storage.objects.bucket_id AND b.public = true
    )
  );

-- Private ticket files require order ownership or administrator access.
DROP POLICY IF EXISTS storage_private_asset_read ON storage.objects;
CREATE POLICY storage_private_asset_read ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'ticket-files'
    AND (
      public.is_admin()
      OR public.owns_order(public.storage_path_uuid(storage.objects.name))
    )
  );

-- Event image writers must own/manage the event identified by the first path segment.
DROP POLICY IF EXISTS storage_event_asset_insert ON storage.objects;
CREATE POLICY storage_event_asset_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id IN ('event-images', 'event-gallery')
    AND (public.is_admin() OR public.can_manage_event(public.storage_path_uuid(name)))
  );
DROP POLICY IF EXISTS storage_event_asset_update ON storage.objects;
CREATE POLICY storage_event_asset_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('event-images', 'event-gallery')
    AND (public.is_admin() OR public.can_manage_event(public.storage_path_uuid(name)))
  )
  WITH CHECK (
    bucket_id IN ('event-images', 'event-gallery')
    AND (public.is_admin() OR public.can_manage_event(public.storage_path_uuid(name)))
  );
DROP POLICY IF EXISTS storage_event_asset_delete ON storage.objects;
CREATE POLICY storage_event_asset_delete ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id IN ('event-images', 'event-gallery')
    AND (public.is_admin() OR public.can_manage_event(public.storage_path_uuid(name)))
  );

-- Organizer logo writes are restricted to the organizer owner/admin.
DROP POLICY IF EXISTS storage_organizer_logo_insert ON storage.objects;
CREATE POLICY storage_organizer_logo_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'organizer-logos'
    AND (public.is_admin() OR public.can_manage_organizer(public.storage_path_uuid(name)))
  );
DROP POLICY IF EXISTS storage_organizer_logo_update ON storage.objects;
CREATE POLICY storage_organizer_logo_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'organizer-logos'
    AND (public.is_admin() OR public.can_manage_organizer(public.storage_path_uuid(name)))
  )
  WITH CHECK (
    bucket_id = 'organizer-logos'
    AND (public.is_admin() OR public.can_manage_organizer(public.storage_path_uuid(name)))
  );
DROP POLICY IF EXISTS storage_organizer_logo_delete ON storage.objects;
CREATE POLICY storage_organizer_logo_delete ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'organizer-logos'
    AND (public.is_admin() OR public.can_manage_organizer(public.storage_path_uuid(name)))
  );

-- Avatars are public to read but writable only inside the signed-in user's folder.
DROP POLICY IF EXISTS storage_avatar_insert ON storage.objects;
CREATE POLICY storage_avatar_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'user-avatars'
    AND (public.is_admin() OR public.storage_path_owned_by_user(name))
  );
DROP POLICY IF EXISTS storage_avatar_update ON storage.objects;
CREATE POLICY storage_avatar_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'user-avatars'
    AND (public.is_admin() OR public.storage_path_owned_by_user(name))
  )
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND (public.is_admin() OR public.storage_path_owned_by_user(name))
  );
DROP POLICY IF EXISTS storage_avatar_delete ON storage.objects;
CREATE POLICY storage_avatar_delete ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'user-avatars'
    AND (public.is_admin() OR public.storage_path_owned_by_user(name))
  );

-- Ticket files are private; only the order owner/admin may add or remove them.
DROP POLICY IF EXISTS storage_ticket_file_insert ON storage.objects;
CREATE POLICY storage_ticket_file_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'ticket-files'
    AND (
      public.is_admin()
      OR public.owns_order(public.storage_path_uuid(name))
    )
  );
DROP POLICY IF EXISTS storage_ticket_file_update ON storage.objects;
CREATE POLICY storage_ticket_file_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'ticket-files'
    AND (
      public.is_admin()
      OR public.owns_order(public.storage_path_uuid(name))
    )
  )
  WITH CHECK (
    bucket_id = 'ticket-files'
    AND (
      public.is_admin()
      OR public.owns_order(public.storage_path_uuid(name))
    )
  );
DROP POLICY IF EXISTS storage_ticket_file_delete ON storage.objects;
CREATE POLICY storage_ticket_file_delete ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'ticket-files'
    AND (
      public.is_admin()
      OR public.owns_order(public.storage_path_uuid(name))
    )
  );
