-- Replace organizer accounts with administrator-entered event labels and
-- remove organizer accounts, invitations, staff, payout and commission data.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'organizer-logos') THEN
    RAISE EXCEPTION
      'Delete organizer logo files through Supabase Storage, then retry migration 0027';
  END IF;
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'organizer-logos') THEN
    RAISE EXCEPTION
      'Delete the empty organizer-logos bucket through Supabase Storage, then retry migration 0027';
  END IF;
END;
$$;

ALTER TABLE public.events ADD COLUMN organizer_name text;
UPDATE public.events e
SET organizer_name = coalesce(nullif(btrim(o.name), ''), 'Unknown organizer')
FROM public.organizers o
WHERE o.id = e.organizer_id;
UPDATE public.events
SET organizer_name = 'Unknown organizer'
WHERE organizer_name IS NULL OR length(btrim(organizer_name)) = 0;
ALTER TABLE public.events ALTER COLUMN organizer_name SET NOT NULL;
ALTER TABLE public.events
  ADD CONSTRAINT events_organizer_name_not_blank
  CHECK (length(btrim(organizer_name)) > 0);

ALTER TABLE public.storefront_events ADD COLUMN organizer_name text;
UPDATE public.storefront_events s
SET organizer_name = o.name
FROM public.organizers o
WHERE o.id = s.organizer_id;

ALTER TABLE public.storefront_events
  DROP CONSTRAINT IF EXISTS storefront_events_catalog_details_consistent;
ALTER TABLE public.storefront_events
  ADD CONSTRAINT storefront_events_catalog_details_consistent CHECK (
    (
      starts_at IS NULL
      AND ends_at IS NULL
      AND capacity IS NULL
      AND normalized_event_id IS NULL
    )
    OR (
      organizer_name IS NOT NULL
      AND length(btrim(organizer_name)) > 0
      AND starts_at IS NOT NULL
      AND ends_at IS NOT NULL
      AND ends_at > starts_at
      AND capacity > 0
    )
  );

CREATE OR REPLACE FUNCTION public.sync_storefront_event_to_catalog()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_category_id uuid;
  v_event_id uuid;
  v_rows_updated integer;
  v_operational_fields_present boolean;
BEGIN
  IF TG_OP = 'UPDATE'
    AND ROW(
      NEW.title, NEW.slug, NEW.category, NEW.about, NEW.image_url, NEW.venue,
      NEW.location, NEW.city, NEW.price_amount, NEW.currency, NEW.organizer_name,
      NEW.starts_at, NEW.ends_at, NEW.capacity
    ) IS NOT DISTINCT FROM ROW(
      OLD.title, OLD.slug, OLD.category, OLD.about, OLD.image_url, OLD.venue,
      OLD.location, OLD.city, OLD.price_amount, OLD.currency, OLD.organizer_name,
      OLD.starts_at, OLD.ends_at, OLD.capacity
    )
  THEN
    RETURN NEW;
  END IF;

  v_operational_fields_present :=
    NEW.starts_at IS NOT NULL
    OR NEW.ends_at IS NOT NULL
    OR NEW.capacity IS NOT NULL;

  IF NOT v_operational_fields_present AND NEW.normalized_event_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF nullif(btrim(coalesce(NEW.organizer_name, '')), '') IS NULL
    OR NEW.starts_at IS NULL
    OR NEW.ends_at IS NULL
    OR NEW.capacity IS NULL
    OR NEW.ends_at <= NEW.starts_at
    OR NEW.capacity <= 0
  THEN
    RAISE EXCEPTION
      'Enter an organizer name, valid event start/end times, and a positive ticket capacity.';
  END IF;

  SELECT id
  INTO v_category_id
  FROM public.event_categories
  WHERE lower(name) = lower(NEW.category)
  LIMIT 1;
  IF v_category_id IS NULL THEN
    RAISE EXCEPTION 'No event catalog category matches showcase category "%".', NEW.category;
  END IF;

  IF NEW.normalized_event_id IS NULL THEN
    INSERT INTO public.events (
      organizer_name, category_id, created_by, title, slug, description,
      cover_image_url, venue_name, venue_address, venue_city, starts_at,
      ends_at, status, approval_status, capacity
    )
    VALUES (
      btrim(NEW.organizer_name), v_category_id, auth.uid(), NEW.title, NEW.slug,
      NEW.about, NEW.image_url, NEW.venue, NEW.location, NEW.city,
      NEW.starts_at, NEW.ends_at, 'draft', 'pending', NEW.capacity
    )
    RETURNING id INTO v_event_id;

    INSERT INTO public.ticket_types (
      event_id, name, price_amount, currency, quantity_total, max_per_order,
      sales_start_at, sales_end_at
    )
    VALUES (
      v_event_id, 'General Admission', NEW.price_amount, NEW.currency,
      NEW.capacity, least(8, NEW.capacity),
      least(now(), NEW.starts_at - interval '1 minute'), NEW.starts_at
    );

    NEW.normalized_event_id := v_event_id;
    RETURN NEW;
  END IF;

  UPDATE public.events
  SET organizer_name = btrim(NEW.organizer_name),
      category_id = v_category_id,
      title = NEW.title,
      slug = NEW.slug,
      description = NEW.about,
      cover_image_url = NEW.image_url,
      venue_name = NEW.venue,
      venue_address = NEW.location,
      venue_city = NEW.city,
      starts_at = NEW.starts_at,
      ends_at = NEW.ends_at,
      capacity = NEW.capacity
  WHERE id = NEW.normalized_event_id;
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated = 0 THEN
    RAISE EXCEPTION 'The linked catalog event no longer exists.';
  END IF;

  UPDATE public.ticket_types
  SET price_amount = NEW.price_amount,
      currency = NEW.currency,
      quantity_total = NEW.capacity,
      max_per_order = least(8, NEW.capacity),
      sales_start_at = least(now(), NEW.starts_at - interval '1 minute'),
      sales_end_at = NEW.starts_at
  WHERE event_id = NEW.normalized_event_id
    AND name = 'General Admission';
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  IF v_rows_updated = 0 THEN
    RAISE EXCEPTION 'The linked General Admission ticket type no longer exists.';
  END IF;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS events_insert ON public.events;
DROP POLICY IF EXISTS event_staff_select ON public.event_staff;
ALTER TABLE public.events DROP COLUMN organizer_id;
ALTER TABLE public.storefront_events DROP COLUMN organizer_id;

CREATE OR REPLACE FUNCTION public.can_access_event(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.event_staff es
      WHERE es.event_id = p_event_id
        AND es.user_id = auth.uid()
        AND es.status = 'active'
    );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_event(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_admin();
$$;

CREATE OR REPLACE FUNCTION public.can_checkin_event(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.event_staff es
      WHERE es.event_id = p_event_id
        AND es.user_id = auth.uid()
        AND es.status = 'active'
        AND es.permission IN ('checkin', 'manage_orders')
    );
$$;

DROP POLICY IF EXISTS events_insert ON public.events;
CREATE POLICY events_insert ON public.events
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS events_update ON public.events;
CREATE POLICY events_update ON public.events
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS events_delete ON public.events;
CREATE POLICY events_delete ON public.events
  FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS event_staff_select ON public.event_staff;
CREATE POLICY event_staff_select ON public.event_staff
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS organizers_public_select ON public.organizers;
DROP POLICY IF EXISTS organizers_member_select ON public.organizers;
DROP POLICY IF EXISTS organizers_insert ON public.organizers;
DROP POLICY IF EXISTS organizers_update ON public.organizers;
DROP POLICY IF EXISTS organizers_delete ON public.organizers;
DROP POLICY IF EXISTS organizer_staff_select ON public.organizer_staff;
DROP POLICY IF EXISTS organizer_staff_insert ON public.organizer_staff;
DROP POLICY IF EXISTS organizer_staff_update ON public.organizer_staff;
DROP POLICY IF EXISTS organizer_staff_delete ON public.organizer_staff;
DROP POLICY IF EXISTS commissions_select ON public.organizer_commissions;
DROP POLICY IF EXISTS payouts_select ON public.organizer_payouts;
DROP POLICY IF EXISTS payouts_admin_update ON public.organizer_payouts;

DROP POLICY IF EXISTS storage_organizer_logo_insert ON storage.objects;
DROP POLICY IF EXISTS storage_organizer_logo_update ON storage.objects;
DROP POLICY IF EXISTS storage_organizer_logo_delete ON storage.objects;

DELETE FROM public.audit_logs
WHERE actor_role::text = 'organizer'
   OR entity_type IN (
     'organizers',
     'organizer_staff',
     'organizer_invitations',
     'organizer_payouts',
     'organizer_commissions'
   );
UPDATE public.audit_logs
SET changes = jsonb_set(
  changes,
  '{before}',
  coalesce(changes->'before', '{}'::jsonb) - 'organizer_id'
)
WHERE (changes->'before') ? 'organizer_id';
UPDATE public.audit_logs
SET changes = jsonb_set(
  changes,
  '{after}',
  coalesce(changes->'after', '{}'::jsonb) - 'organizer_id'
)
WHERE (changes->'after') ? 'organizer_id';
UPDATE public.audit_logs
SET changes = changes - 'organizer_id'
WHERE changes ? 'organizer_id';

DELETE FROM public.notifications WHERE type::text = 'payout_paid';

INSERT INTO public.user_roles (user_id, role_id, assigned_by)
SELECT DISTINCT org_roles.user_id, customer_role.id, org_roles.assigned_by
FROM public.user_roles org_roles
JOIN public.roles organizer_role ON organizer_role.id = org_roles.role_id
JOIN public.roles customer_role ON customer_role.name::text = 'customer'
WHERE organizer_role.name::text = 'organizer'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles existing
    JOIN public.roles existing_role ON existing_role.id = existing.role_id
    WHERE existing.user_id = org_roles.user_id
      AND existing_role.name::text <> 'organizer'
  )
ON CONFLICT (user_id, role_id) DO NOTHING;

DELETE FROM public.user_roles
WHERE role_id IN (SELECT id FROM public.roles WHERE name::text = 'organizer');
DELETE FROM public.roles WHERE name::text = 'organizer';

ALTER TABLE public.audit_logs
  ALTER COLUMN actor_role TYPE text USING actor_role::text;
ALTER TABLE public.roles
  ALTER COLUMN name TYPE text USING name::text;

CREATE OR REPLACE FUNCTION public.log_admin_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
  v_entity_id uuid;
  v_changes jsonb;
BEGIN
  SELECT r.name::text INTO v_role
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = auth.uid() AND r.name::text = 'admin'
  LIMIT 1;

  IF v_role IS NULL THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_entity_id := (to_jsonb(OLD) ->> 'id')::uuid;
    v_changes := to_jsonb(OLD);
  ELSE
    v_entity_id := (to_jsonb(NEW) ->> 'id')::uuid;
    v_changes := jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW));
  END IF;

  INSERT INTO public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, changes)
  VALUES (auth.uid(), v_role, TG_OP || ':' || TG_TABLE_NAME, TG_TABLE_NAME, v_entity_id, v_changes);
  RETURN NULL;
END;
$$;

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
       WHERE r.id = NEW.role_id AND r.name::text = 'admin'
     ) THEN
    RAISE EXCEPTION 'Self-assignment of admin role is not allowed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_admin_payout_update ON public.organizer_payouts;
DROP TRIGGER IF EXISTS trg_enforce_organizer_moderation ON public.organizers;
DROP TRIGGER IF EXISTS trg_audit_organizers ON public.organizers;
DROP TRIGGER IF EXISTS trg_audit_payouts ON public.organizer_payouts;
DROP FUNCTION IF EXISTS public.enforce_admin_payout_update();
DROP FUNCTION IF EXISTS public.enforce_organizer_moderation();
DROP FUNCTION IF EXISTS public.owns_active_organizer(uuid);
DROP FUNCTION IF EXISTS public.can_manage_organizer(uuid);
DROP FUNCTION IF EXISTS public.owns_organizer(uuid);
DROP FUNCTION IF EXISTS public.delete_organizer(uuid);
DROP FUNCTION IF EXISTS public.create_organizer_invitation(text, text, text, text, interval);
DROP FUNCTION IF EXISTS public.cancel_organizer_invitation(uuid);
DROP FUNCTION IF EXISTS public.accept_organizer_invitation(uuid, text);
DROP FUNCTION IF EXISTS public.has_role(public.app_role);
DROP FUNCTION IF EXISTS public.assign_user_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.remove_user_role(uuid, public.app_role);

DROP TABLE public.organizer_commissions;
DROP TABLE public.organizer_payouts;
DROP TABLE public.organizer_staff;
DROP TABLE public.organizer_invitations;
DROP TABLE public.organizers;

DROP TYPE public.organizer_staff_role;
DROP TYPE public.organizer_status;
DROP TYPE public.payout_status;
DROP TYPE public.commission_status;

DROP TYPE public.app_role;
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'customer');
ALTER TABLE public.roles
  ALTER COLUMN name TYPE public.app_role USING name::public.app_role;

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

CREATE OR REPLACE FUNCTION public.assign_user_role(p_user_id uuid, p_role public.app_role)
RETURNS public.user_roles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role_id uuid;
  v_result public.user_roles;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can assign roles';
  END IF;
  IF p_user_id = auth.uid() AND p_role = 'admin' THEN
    RAISE EXCEPTION 'Administrators cannot assign themselves the admin role';
  END IF;

  SELECT id INTO v_role_id FROM public.roles WHERE name = p_role;
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Unknown role: %', p_role;
  END IF;

  INSERT INTO public.user_roles (user_id, role_id, assigned_by)
  VALUES (p_user_id, v_role_id, auth.uid())
  ON CONFLICT (user_id, role_id) DO NOTHING;

  SELECT * INTO v_result
  FROM public.user_roles
  WHERE user_id = p_user_id AND role_id = v_role_id;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_user_role(p_user_id uuid, p_role public.app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can remove roles';
  END IF;
  IF p_user_id = auth.uid() AND p_role = 'admin' THEN
    RAISE EXCEPTION 'Administrators cannot remove their own admin role';
  END IF;

  DELETE FROM public.user_roles ur
  USING public.roles r
  WHERE ur.role_id = r.id
    AND r.name = p_role
    AND ur.user_id = p_user_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.has_role(public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assign_user_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_user_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_user_role(uuid, public.app_role) TO authenticated;

ALTER TABLE public.notifications ALTER COLUMN type TYPE text USING type::text;
DROP TYPE public.notification_type;
CREATE TYPE public.notification_type AS ENUM (
  'order_created',
  'payment_succeeded',
  'payment_failed',
  'ticket_issued',
  'event_published',
  'event_cancelled',
  'refund_issued',
  'system'
);
ALTER TABLE public.notifications
  ALTER COLUMN type TYPE public.notification_type USING type::public.notification_type;
