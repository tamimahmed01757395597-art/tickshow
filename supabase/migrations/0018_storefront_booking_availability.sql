-- Phase 3 / 0018: use the showcase group as the sale-availability source.
-- Showcase dates are display data; administrators control availability by
-- moving events between upcoming, ongoing and past.

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

GRANT EXECUTE ON FUNCTION public.create_storefront_booking(text, integer, text, text, text)
TO anon, authenticated, service_role;
