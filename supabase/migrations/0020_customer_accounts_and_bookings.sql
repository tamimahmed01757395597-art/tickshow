-- Phase 4 / 0020: require customer accounts for checkout and enable self-service.

ALTER TABLE public.storefront_bookings
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES auth.users (id) ON DELETE CASCADE;
ALTER TABLE public.storefront_bookings
  ADD COLUMN IF NOT EXISTS event_date_label text;
ALTER TABLE public.storefront_bookings
  ADD COLUMN IF NOT EXISTS event_time_label text;
ALTER TABLE public.storefront_bookings
  ADD COLUMN IF NOT EXISTS event_venue text;
ALTER TABLE public.storefront_bookings
  ADD COLUMN IF NOT EXISTS event_location text;

DROP POLICY IF EXISTS storefront_bookings_customer_select ON public.storefront_bookings;
CREATE POLICY storefront_bookings_customer_select ON public.storefront_bookings
FOR SELECT TO authenticated
USING (customer_id = auth.uid());

CREATE OR REPLACE FUNCTION public.create_storefront_booking(
  p_event_slug text,
  p_quantity integer,
  p_buyer_name text,
  p_buyer_email text,
  p_buyer_phone text
)
RETURNS TABLE (booking_reference text, total_amount numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_customer_id uuid := auth.uid();
  v_event_id uuid;
  v_event_slug text;
  v_event_title text;
  v_event_date_label text;
  v_event_time_label text;
  v_event_venue text;
  v_event_location text;
  v_unit_price numeric(14, 2);
  v_currency text;
  v_reference text;
  v_name text := btrim(coalesce(p_buyer_name, ''));
  v_email text := btrim(coalesce(p_buyer_email, ''));
  v_phone text := btrim(coalesce(p_buyer_phone, ''));
BEGIN
  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Sign in or create an account before booking.' USING ERRCODE = '28000';
  END IF;

  IF p_quantity IS NULL OR p_quantity NOT BETWEEN 1 AND 8 THEN
    RAISE EXCEPTION 'Choose between 1 and 8 tickets.' USING ERRCODE = '22023';
  END IF;

  IF length(v_name) NOT BETWEEN 1 AND 160 THEN
    RAISE EXCEPTION 'Enter a valid name.' USING ERRCODE = '22023';
  END IF;

  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'Enter a valid email address.' USING ERRCODE = '22023';
  END IF;

  IF lower(v_email) <> lower(coalesce(auth.jwt() ->> 'email', '')) THEN
    RAISE EXCEPTION 'Use the email address on your TickShow account.' USING ERRCODE = '22023';
  END IF;

  IF length(v_phone) NOT BETWEEN 7 AND 32 THEN
    RAISE EXCEPTION 'Enter a valid phone number.' USING ERRCODE = '22023';
  END IF;

  SELECT e.id, e.slug, e.title, e.date_label, e.time_label, e.venue, e.location,
         e.price_amount, e.currency
  INTO v_event_id, v_event_slug, v_event_title, v_event_date_label, v_event_time_label,
       v_event_venue, v_event_location, v_unit_price, v_currency
  FROM public.storefront_events AS e
  WHERE e.slug = p_event_slug
    AND e.is_visible
    AND e.event_group <> 'past'
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This event is no longer available for booking.' USING ERRCODE = '22023';
  END IF;

  v_reference := 'TS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  INSERT INTO public.storefront_bookings (
    booking_reference, storefront_event_id, customer_id, event_slug, event_title,
    event_date_label, event_time_label, event_venue, event_location,
    quantity, unit_price_amount, total_amount, currency,
    buyer_name, buyer_email, buyer_phone
  )
  VALUES (
    v_reference, v_event_id, v_customer_id, v_event_slug, v_event_title,
    v_event_date_label, v_event_time_label, v_event_venue, v_event_location,
    p_quantity, v_unit_price, v_unit_price * p_quantity, v_currency,
    v_name, v_email, v_phone
  );

  RETURN QUERY SELECT v_reference, v_unit_price * p_quantity;
END;
$$;

REVOKE ALL ON FUNCTION public.create_storefront_booking(text, integer, text, text, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_storefront_booking(text, integer, text, text, text)
TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_admin_order_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_setting('app.account_deletion', true) = auth.uid()::text
     AND OLD.customer_id = auth.uid()
     AND NEW.customer_id IS NULL
     AND NEW.buyer_name = 'Deleted account'
     AND NEW.buyer_email = 'deleted+' || OLD.id::text || '@example.invalid'
     AND NEW.buyer_phone IS NULL
     AND (to_jsonb(NEW) - 'customer_id' - 'buyer_name' - 'buyer_email' - 'buyer_phone') =
         (to_jsonb(OLD) - 'customer_id' - 'buyer_name' - 'buyer_email' - 'buyer_phone') THEN
    RETURN NEW;
  END IF;

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

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_deleted_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to delete your account.' USING ERRCODE = '28000';
  END IF;

  BEGIN
    PERFORM set_config('app.account_deletion', v_user_id::text, true);
    UPDATE public.orders
    SET customer_id = NULL,
        buyer_name = 'Deleted account',
        buyer_email = 'deleted+' || id::text || '@example.invalid',
        buyer_phone = NULL
    WHERE customer_id = v_user_id;
    DELETE FROM auth.users WHERE id = v_user_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    PERFORM set_config('app.account_deletion', '', true);
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.account_deletion', '', true);
    RAISE;
  END;
  IF v_deleted_count = 0 THEN
    RAISE EXCEPTION 'The account no longer exists.' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
