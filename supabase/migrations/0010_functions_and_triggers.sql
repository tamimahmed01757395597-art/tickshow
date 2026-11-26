-- Phase 1 / 0010: security helpers, moderation guards and consistency triggers.
-- Every SECURITY DEFINER function pins search_path to avoid search-path injection.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

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

CREATE OR REPLACE FUNCTION public.owns_active_organizer(p_organizer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.has_role('organizer') AND EXISTS (
    SELECT 1 FROM public.organizers o
    WHERE o.id = p_organizer_id
      AND o.owner_id = auth.uid()
      AND o.status = 'active'
      AND o.approval_status = 'approved'
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

CREATE OR REPLACE FUNCTION public.can_access_event(p_event_id uuid)
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
    )
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
  SELECT public.is_admin()
    OR (
      public.has_role('organizer')
      AND public.owns_organizer((SELECT e.organizer_id FROM public.events e WHERE e.id = p_event_id))
    );
$$;

CREATE OR REPLACE FUNCTION public.can_checkin_event(p_event_id uuid)
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
    )
    OR EXISTS (
      SELECT 1
      FROM public.event_staff es
      WHERE es.event_id = p_event_id
        AND es.user_id = auth.uid()
        AND es.status = 'active'
        AND es.permission IN ('checkin', 'manage_orders')
    );
$$;

CREATE OR REPLACE FUNCTION public.is_event_public(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = p_event_id
      AND e.status = 'published'
      AND e.approval_status = 'approved'
      AND e.cancelled_at IS NULL
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

CREATE OR REPLACE FUNCTION public.can_access_order(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_admin()
    OR public.owns_order(p_order_id)
    OR public.can_access_event((SELECT o.event_id FROM public.orders o WHERE o.id = p_order_id));
$$;

CREATE OR REPLACE FUNCTION public.can_view_ticket(p_ticket_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = p_ticket_id
        AND (
          t.customer_id = auth.uid()
          OR public.owns_order(t.order_id)
          OR public.can_access_event(t.event_id)
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_access_reservation(p_reservation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.ticket_inventory_reservations r
      WHERE r.id = p_reservation_id
        AND (
          public.owns_order(r.order_id)
          OR public.can_access_event((SELECT tt.event_id FROM public.ticket_types tt WHERE tt.id = r.ticket_type_id))
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

-- Role changes go through these two functions only. Direct client DML is denied by RLS.
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

  IF p_user_id = auth.uid() AND p_role IN ('admin', 'organizer') THEN
    RAISE EXCEPTION 'Self-assignment of admin/organizer roles is not allowed';
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

REVOKE ALL ON FUNCTION public.assign_user_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_user_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_user_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_user_role(uuid, public.app_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_user_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE')
     AND NEW.user_id = auth.uid()
     AND EXISTS (
       SELECT 1 FROM public.roles r
       WHERE r.id = NEW.role_id AND r.name IN ('admin', 'organizer')
     )
     AND NOT public.is_service_role() THEN
    RAISE EXCEPTION 'Self-assignment of admin/organizer roles is not allowed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin()
     AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.id IS DISTINCT FROM OLD.id) THEN
    RAISE EXCEPTION 'Profile status and identity cannot be changed by the user';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_organizer_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin()
     AND (
       NEW.status IS DISTINCT FROM OLD.status
       OR NEW.approval_status IS DISTINCT FROM OLD.approval_status
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
     ) THEN
    RAISE EXCEPTION 'Organizer status, approval and ownership can only be changed by an administrator';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_event_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('draft', 'pending') THEN
      RAISE EXCEPTION 'New events must start as draft or pending';
    END IF;
    IF NEW.approval_status <> 'pending' THEN
      RAISE EXCEPTION 'Event approval can only be set by an administrator';
    END IF;
    NEW.approved_at := NULL;
    NEW.published_at := NULL;
    NEW.cancelled_at := NULL;
    NEW.completed_at := NULL;
    RETURN NEW;
  END IF;

  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.published_at IS DISTINCT FROM OLD.published_at THEN
    RAISE EXCEPTION 'Event approval/publication fields can only be changed by an administrator';
  END IF;

  IF OLD.status IN ('rejected', 'cancelled', 'completed')
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Only administrators can reopen rejected, cancelled or completed events';
  END IF;

  IF NEW.status = 'published' AND OLD.approval_status <> 'approved' THEN
    RAISE EXCEPTION 'An event must be approved before it can be published';
  END IF;

  IF NEW.status = 'cancelled' THEN
    NEW.cancelled_at := coalesce(NEW.cancelled_at, now());
  END IF;

  IF NEW.status = 'completed' THEN
    NEW.completed_at := coalesce(NEW.completed_at, now());
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_review_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'pending' OR public.is_admin() OR public.can_manage_event(NEW.event_id) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Only administrators or event owners can moderate reviews';
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_ticket_inventory_on_ticket_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.ticket_inventory (ticket_type_id, total_quantity)
  VALUES (NEW.id, NEW.quantity_total)
  ON CONFLICT (ticket_type_id) DO UPDATE
    SET total_quantity = EXCLUDED.total_quantity,
        updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_ticket_inventory_on_reservation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_reserved integer;
  v_old_sold integer;
  v_new_reserved integer;
  v_new_sold integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.ticket_type_id IS DISTINCT FROM OLD.ticket_type_id THEN
    RAISE EXCEPTION 'A reservation cannot be moved to a different ticket type';
  END IF;

  v_old_reserved := CASE
    WHEN TG_OP IN ('UPDATE', 'DELETE') AND OLD.status = 'pending' THEN OLD.quantity ELSE 0 END;
  v_old_sold := CASE
    WHEN TG_OP IN ('UPDATE', 'DELETE') AND OLD.status = 'confirmed' THEN OLD.quantity ELSE 0 END;
  v_new_reserved := CASE
    WHEN TG_OP IN ('INSERT', 'UPDATE') AND NEW.status = 'pending' THEN NEW.quantity ELSE 0 END;
  v_new_sold := CASE
    WHEN TG_OP IN ('INSERT', 'UPDATE') AND NEW.status = 'confirmed' THEN NEW.quantity ELSE 0 END;

  UPDATE public.ticket_inventory ti
  SET reserved_quantity = ti.reserved_quantity - v_old_reserved + v_new_reserved,
      sold_quantity = ti.sold_quantity - v_old_sold + v_new_sold,
      updated_at = now()
  WHERE ti.ticket_type_id = coalesce(NEW.ticket_type_id, OLD.ticket_type_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory row missing for reserved ticket type';
  END IF;

  RETURN coalesce(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_refund_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment_amount numeric(14,2);
  v_payment_currency char(3);
  v_already_refunded numeric(14,2);
BEGIN
  SELECT p.amount, p.currency INTO v_payment_amount, v_payment_currency
  FROM public.payments p WHERE p.id = NEW.payment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  IF NEW.currency IS DISTINCT FROM v_payment_currency THEN
    RAISE EXCEPTION 'Refund currency must match payment currency';
  END IF;

  SELECT coalesce(sum(r.amount), 0) INTO v_already_refunded
  FROM public.refunds r
  WHERE r.payment_id = NEW.payment_id
    AND r.status = 'succeeded'
    AND r.id IS DISTINCT FROM NEW.id;

  IF NEW.amount > v_payment_amount - v_already_refunded THEN
    RAISE EXCEPTION 'Refund exceeds the remaining payment amount';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_payment_refunded_amount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment_id uuid;
BEGIN
  v_payment_id := coalesce(NEW.payment_id, OLD.payment_id);
  UPDATE public.payments p
  SET refunded_amount = coalesce((
    SELECT sum(r.amount) FROM public.refunds r
    WHERE r.payment_id = v_payment_id AND r.status = 'succeeded'
  ), 0),
      updated_at = now()
  WHERE p.id = v_payment_id;
  RETURN coalesce(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_ticket_checkin_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ticket public.tickets;
BEGIN
  SELECT * INTO v_ticket FROM public.tickets t WHERE t.id = NEW.ticket_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  IF NEW.event_id IS DISTINCT FROM v_ticket.event_id THEN
    RAISE EXCEPTION 'Check-in event must match the ticket event';
  END IF;

  IF NEW.result = 'success' AND v_ticket.status NOT IN ('valid', 'used') THEN
    RAISE EXCEPTION 'Only valid or already-used tickets can be checked in';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_ticket_checkin_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.result = 'success' THEN
    UPDATE public.tickets
    SET checkin_status = 'checked_in',
        checked_in_at = NEW.created_at,
        status = CASE WHEN status = 'valid' THEN 'used' ELSE status END,
        updated_at = now()
    WHERE id = NEW.ticket_id;
  ELSIF NEW.result = 'reversed' THEN
    UPDATE public.tickets
    SET checkin_status = 'not_checked_in',
        checked_in_at = NULL,
        status = CASE WHEN status = 'used' THEN 'valid' ELSE status END,
        updated_at = now()
    WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Triggers are recreated idempotently; they never rewrite existing data.
DROP TRIGGER IF EXISTS trg_set_updated_at ON public.profiles;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_set_updated_at ON public.roles;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.roles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_set_updated_at ON public.organizers;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.organizers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_set_updated_at ON public.organizer_staff;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.organizer_staff FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_set_updated_at ON public.event_categories;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.event_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_set_updated_at ON public.events;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_set_updated_at ON public.event_lineup_items;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.event_lineup_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_set_updated_at ON public.event_staff;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.event_staff FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_set_updated_at ON public.ticket_types;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.ticket_types FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_set_updated_at ON public.ticket_inventory;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.ticket_inventory FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_set_updated_at ON public.ticket_inventory_reservations;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.ticket_inventory_reservations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_set_updated_at ON public.orders;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_set_updated_at ON public.order_items;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_set_updated_at ON public.payments;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_set_updated_at ON public.tickets;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_set_updated_at ON public.refunds;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.refunds FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_set_updated_at ON public.organizer_payouts;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.organizer_payouts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_set_updated_at ON public.organizer_commissions;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.organizer_commissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_set_updated_at ON public.notifications;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_set_updated_at ON public.reviews;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_set_updated_at ON public.platform_settings;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.platform_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_prevent_role_self_escalation ON public.user_roles;
CREATE TRIGGER trg_prevent_role_self_escalation BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_role_self_escalation();
DROP TRIGGER IF EXISTS trg_enforce_profile_update ON public.profiles;
CREATE TRIGGER trg_enforce_profile_update BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_update();
DROP TRIGGER IF EXISTS trg_enforce_organizer_moderation ON public.organizers;
CREATE TRIGGER trg_enforce_organizer_moderation BEFORE UPDATE ON public.organizers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_organizer_moderation();
DROP TRIGGER IF EXISTS trg_enforce_event_moderation ON public.events;
CREATE TRIGGER trg_enforce_event_moderation BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_event_moderation();
DROP TRIGGER IF EXISTS trg_enforce_review_moderation ON public.reviews;
CREATE TRIGGER trg_enforce_review_moderation BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.enforce_review_moderation();
DROP TRIGGER IF EXISTS trg_sync_inventory_on_ticket_type ON public.ticket_types;
CREATE TRIGGER trg_sync_inventory_on_ticket_type AFTER INSERT OR UPDATE OF quantity_total ON public.ticket_types
  FOR EACH ROW EXECUTE FUNCTION public.sync_ticket_inventory_on_ticket_type();
DROP TRIGGER IF EXISTS trg_sync_inventory_on_reservation ON public.ticket_inventory_reservations;
CREATE TRIGGER trg_sync_inventory_on_reservation AFTER INSERT OR UPDATE OR DELETE ON public.ticket_inventory_reservations
  FOR EACH ROW EXECUTE FUNCTION public.sync_ticket_inventory_on_reservation();
DROP TRIGGER IF EXISTS trg_enforce_refund_amount ON public.refunds;
CREATE TRIGGER trg_enforce_refund_amount BEFORE INSERT OR UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.enforce_refund_amount();
DROP TRIGGER IF EXISTS trg_sync_payment_refunded_amount ON public.refunds;
CREATE TRIGGER trg_sync_payment_refunded_amount AFTER INSERT OR UPDATE OR DELETE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.sync_payment_refunded_amount();
DROP TRIGGER IF EXISTS trg_enforce_ticket_checkin_event ON public.ticket_checkins;
CREATE TRIGGER trg_enforce_ticket_checkin_event BEFORE INSERT OR UPDATE ON public.ticket_checkins
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ticket_checkin_event();
DROP TRIGGER IF EXISTS trg_apply_ticket_checkin_result ON public.ticket_checkins;
CREATE TRIGGER trg_apply_ticket_checkin_result AFTER INSERT OR UPDATE OF result ON public.ticket_checkins
  FOR EACH ROW EXECUTE FUNCTION public.apply_ticket_checkin_result();
