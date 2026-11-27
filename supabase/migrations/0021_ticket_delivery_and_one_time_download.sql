-- Secure digital ticket delivery and one-time account downloads.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.storefront_bookings
  ADD COLUMN IF NOT EXISTS ticket_token text,
  ADD COLUMN IF NOT EXISTS ticket_emailed_at timestamptz,
  ADD COLUMN IF NOT EXISTS ticket_downloaded_at timestamptz;

UPDATE public.storefront_bookings
SET ticket_token = encode(extensions.gen_random_bytes(18), 'hex')
WHERE ticket_token IS NULL;

ALTER TABLE public.storefront_bookings
  ALTER COLUMN ticket_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS storefront_bookings_ticket_token_idx
  ON public.storefront_bookings (ticket_token);

-- Changing this SECURITY DEFINER function's OUT parameters requires dropping
-- the existing overload before recreating it.
DROP FUNCTION IF EXISTS public.create_storefront_booking(text, integer, text, text, text);

CREATE OR REPLACE FUNCTION public.create_storefront_booking(
  p_event_slug text,
  p_quantity integer,
  p_buyer_name text,
  p_buyer_email text,
  p_buyer_phone text
)
RETURNS TABLE (
  booking_reference text,
  total_amount numeric,
  ticket_token text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
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
  v_token text;
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
  v_token := encode(extensions.gen_random_bytes(18), 'hex');

  INSERT INTO public.storefront_bookings (
    booking_reference, storefront_event_id, customer_id, event_slug, event_title,
    event_date_label, event_time_label, event_venue, event_location,
    quantity, unit_price_amount, total_amount, currency,
    buyer_name, buyer_email, buyer_phone, ticket_token
  )
  VALUES (
    v_reference, v_event_id, v_customer_id, v_event_slug, v_event_title,
    v_event_date_label, v_event_time_label, v_event_venue, v_event_location,
    p_quantity, v_unit_price, v_unit_price * p_quantity, v_currency,
    v_name, v_email, v_phone, v_token
  );

  RETURN QUERY SELECT v_reference, v_unit_price * p_quantity, v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.create_storefront_booking(text, integer, text, text, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_storefront_booking(text, integer, text, text, text)
TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.claim_storefront_ticket_download(
  p_booking_reference text
)
RETURNS TABLE (
  claimed boolean,
  ticket_token text,
  already_downloaded_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_booking public.storefront_bookings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to download your ticket.' USING ERRCODE = '28000';
  END IF;

  SELECT *
  INTO v_booking
  FROM public.storefront_bookings
  WHERE booking_reference = p_booking_reference
    AND customer_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_booking.ticket_downloaded_at IS NOT NULL THEN
    RETURN QUERY SELECT false, v_booking.ticket_token, v_booking.ticket_downloaded_at;
    RETURN;
  END IF;

  UPDATE public.storefront_bookings
  SET ticket_downloaded_at = now()
  WHERE id = v_booking.id;

  RETURN QUERY SELECT true, v_booking.ticket_token, NULL::timestamptz;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_storefront_ticket_download(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_storefront_ticket_download(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mark_storefront_ticket_emailed(
  p_booking_reference text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to update ticket delivery.' USING ERRCODE = '28000';
  END IF;
  UPDATE public.storefront_bookings
  SET ticket_emailed_at = now()
  WHERE booking_reference = p_booking_reference
    AND customer_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found.' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_storefront_ticket_emailed(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_storefront_ticket_emailed(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.verify_storefront_ticket(
  p_booking_reference text,
  p_ticket_token text
)
RETURNS TABLE (
  valid boolean,
  event_title text,
  event_date text,
  event_venue text,
  event_location text,
  quantity integer
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    true,
    b.event_title,
    b.event_date_label,
    b.event_venue,
    b.event_location,
    b.quantity
  FROM public.storefront_bookings AS b
  WHERE b.booking_reference = p_booking_reference
    AND b.ticket_token = p_ticket_token;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      false,
      NULL::text,
      NULL::text,
      NULL::text,
      NULL::text,
      NULL::integer;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_storefront_ticket(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_storefront_ticket(text, text) TO anon, authenticated, service_role;
