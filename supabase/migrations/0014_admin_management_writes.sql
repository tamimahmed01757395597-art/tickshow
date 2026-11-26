-- Phase 2 / 0014: controlled administrative record management.
-- Orders and payouts are readable by admins already; this adds narrow UPDATE
-- rights for operational status changes only. Money, ownership and currency
-- fields remain immutable from the client. Payment records and refunds stay
-- write-only for trusted server/webhook code.

DROP POLICY IF EXISTS orders_admin_update ON public.orders;
CREATE POLICY orders_admin_update ON public.orders
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS payouts_admin_update ON public.organizer_payouts;
CREATE POLICY payouts_admin_update ON public.organizer_payouts
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.enforce_admin_order_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can update order status';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.order_number IS DISTINCT FROM OLD.order_number
     OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
     OR NEW.event_id IS DISTINCT FROM OLD.event_id
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.subtotal_amount IS DISTINCT FROM OLD.subtotal_amount
     OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
     OR NEW.fee_amount IS DISTINCT FROM OLD.fee_amount
     OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
     OR NEW.buyer_name IS DISTINCT FROM OLD.buyer_name
     OR NEW.buyer_email IS DISTINCT FROM OLD.buyer_email
     OR NEW.buyer_phone IS DISTINCT FROM OLD.buyer_phone
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Order amounts, identity and currency are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_admin_order_update ON public.orders;
CREATE TRIGGER trg_enforce_admin_order_update
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_order_update();

CREATE OR REPLACE FUNCTION public.enforce_admin_payout_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can update payout status';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.organizer_id IS DISTINCT FROM OLD.organizer_id
     OR NEW.payout_reference IS DISTINCT FROM OLD.payout_reference
     OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.requested_at IS DISTINCT FROM OLD.requested_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Payout amount, owner and currency are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_admin_payout_update ON public.organizer_payouts;
CREATE TRIGGER trg_enforce_admin_payout_update
  BEFORE UPDATE ON public.organizer_payouts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_payout_update();

-- Append-only audit entries for administrative mutations. Client code has no
-- INSERT/UPDATE/DELETE policy on audit_logs; only these SECURITY DEFINER
-- triggers write to it.
CREATE OR REPLACE FUNCTION public.log_admin_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role public.app_role;
  v_entity_id uuid;
  v_changes jsonb;
BEGIN
  SELECT r.name INTO v_role
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = auth.uid() AND r.name = 'admin'
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

DROP TRIGGER IF EXISTS trg_audit_profiles ON public.profiles;
CREATE TRIGGER trg_audit_profiles AFTER UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_mutation();

DROP TRIGGER IF EXISTS trg_audit_organizers ON public.organizers;
CREATE TRIGGER trg_audit_organizers AFTER UPDATE OR DELETE ON public.organizers
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_mutation();

DROP TRIGGER IF EXISTS trg_audit_events ON public.events;
CREATE TRIGGER trg_audit_events AFTER UPDATE OR DELETE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_mutation();

DROP TRIGGER IF EXISTS trg_audit_orders ON public.orders;
CREATE TRIGGER trg_audit_orders AFTER UPDATE OR DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_mutation();

DROP TRIGGER IF EXISTS trg_audit_payouts ON public.organizer_payouts;
CREATE TRIGGER trg_audit_payouts AFTER UPDATE OR DELETE ON public.organizer_payouts
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_mutation();

DROP TRIGGER IF EXISTS trg_audit_reviews ON public.reviews;
CREATE TRIGGER trg_audit_reviews AFTER UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.log_admin_mutation();
