-- Phase 3 / 0017: persist public demo bookings for the showcase checkout.
-- These records are not paid orders and do not issue tickets.

CREATE TABLE IF NOT EXISTS public.storefront_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference text NOT NULL UNIQUE,
  storefront_event_id uuid REFERENCES public.storefront_events (id) ON DELETE SET NULL,
  event_slug text NOT NULL,
  event_title text NOT NULL,
  quantity integer NOT NULL,
  unit_price_amount numeric(14, 2) NOT NULL,
  total_amount numeric(14, 2) NOT NULL,
  currency text NOT NULL DEFAULT 'BDT',
  buyer_name text NOT NULL,
  buyer_email text NOT NULL,
  buyer_phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT storefront_bookings_reference_format CHECK (
    booking_reference ~ '^TS-[A-Z0-9]{10}$'
  ),
  CONSTRAINT storefront_bookings_quantity_limit CHECK (quantity BETWEEN 1 AND 8),
  CONSTRAINT storefront_bookings_unit_price_nonnegative CHECK (unit_price_amount >= 0),
  CONSTRAINT storefront_bookings_total_matches CHECK (
    total_amount = unit_price_amount * quantity
  ),
  CONSTRAINT storefront_bookings_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT storefront_bookings_buyer_name_not_blank CHECK (
    length(btrim(buyer_name)) BETWEEN 1 AND 160
  ),
  CONSTRAINT storefront_bookings_buyer_email_format CHECK (
    buyer_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  CONSTRAINT storefront_bookings_buyer_phone_length CHECK (
    length(btrim(buyer_phone)) BETWEEN 7 AND 32
  )
);

CREATE INDEX IF NOT EXISTS storefront_bookings_created_at_idx
  ON public.storefront_bookings (created_at DESC);

ALTER TABLE public.storefront_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS storefront_bookings_admin_select ON public.storefront_bookings;
CREATE POLICY storefront_bookings_admin_select ON public.storefront_bookings
FOR SELECT TO authenticated
USING (public.is_admin());

GRANT SELECT ON public.storefront_bookings TO authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE ON public.storefront_bookings FROM anon, authenticated;

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
  v_event_id uuid;
  v_event_slug text;
  v_event_title text;
  v_unit_price numeric(14, 2);
  v_currency text;
  v_reference text;
  v_name text := btrim(coalesce(p_buyer_name, ''));
  v_email text := btrim(coalesce(p_buyer_email, ''));
  v_phone text := btrim(coalesce(p_buyer_phone, ''));
BEGIN
  IF p_quantity IS NULL OR p_quantity NOT BETWEEN 1 AND 8 THEN
    RAISE EXCEPTION 'Choose between 1 and 8 tickets.' USING ERRCODE = '22023';
  END IF;

  IF length(v_name) NOT BETWEEN 1 AND 160 THEN
    RAISE EXCEPTION 'Enter a valid name.' USING ERRCODE = '22023';
  END IF;

  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'Enter a valid email address.' USING ERRCODE = '22023';
  END IF;

  IF length(v_phone) NOT BETWEEN 7 AND 32 THEN
    RAISE EXCEPTION 'Enter a valid phone number.' USING ERRCODE = '22023';
  END IF;

  SELECT e.id, e.slug, e.title, e.price_amount, e.currency
  INTO v_event_id, v_event_slug, v_event_title, v_unit_price, v_currency
  FROM public.storefront_events AS e
  WHERE e.slug = p_event_slug
    AND e.is_visible
    AND e.event_group <> 'past'
    AND (e.event_group = 'ongoing' OR e.date_value >= current_date)
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This event is no longer available for booking.' USING ERRCODE = '22023';
  END IF;

  v_reference := 'TS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  INSERT INTO public.storefront_bookings (
    booking_reference, storefront_event_id, event_slug, event_title,
    quantity, unit_price_amount, total_amount, currency,
    buyer_name, buyer_email, buyer_phone
  )
  VALUES (
    v_reference, v_event_id, v_event_slug, v_event_title,
    p_quantity, v_unit_price, v_unit_price * p_quantity, v_currency,
    v_name, v_email, v_phone
  );

  RETURN QUERY SELECT v_reference, v_unit_price * p_quantity;
END;
$$;

REVOKE ALL ON FUNCTION public.create_storefront_booking(text, integer, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_storefront_booking(text, integer, text, text, text)
TO anon, authenticated, service_role;
