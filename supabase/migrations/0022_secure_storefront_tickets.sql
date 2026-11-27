-- Replace booking-level raw QR tokens with private, per-ticket token hashes.

ALTER TABLE public.storefront_bookings
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ticket_email_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ticket_assets_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ticket_assets_started_at timestamptz;

UPDATE public.storefront_bookings
SET ticket_email_status = CASE
      WHEN ticket_emailed_at IS NOT NULL THEN 'sent'
      ELSE 'pending'
    END
WHERE ticket_email_status = 'pending';

ALTER TABLE public.storefront_bookings
  DROP CONSTRAINT IF EXISTS storefront_bookings_ticket_email_status_check,
  ADD CONSTRAINT storefront_bookings_ticket_email_status_check
    CHECK (ticket_email_status IN ('pending', 'sending', 'sent', 'failed')),
  DROP CONSTRAINT IF EXISTS storefront_bookings_ticket_assets_status_check,
  ADD CONSTRAINT storefront_bookings_ticket_assets_status_check
    CHECK (ticket_assets_status IN ('pending', 'generating', 'ready'));

CREATE TABLE IF NOT EXISTS public.storefront_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.storefront_bookings (id) ON DELETE CASCADE,
  ticket_number integer NOT NULL,
  token_hash text NOT NULL,
  revoked_at timestamptz,
  checked_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT storefront_tickets_number_positive CHECK (ticket_number > 0),
  CONSTRAINT storefront_tickets_hash_format CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT storefront_tickets_booking_number_unique UNIQUE (booking_id, ticket_number),
  CONSTRAINT storefront_tickets_token_hash_unique UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS storefront_tickets_booking_idx
  ON public.storefront_tickets (booking_id);

-- Preserve the existing single QR token as ticket one. Additional historical
-- tickets receive secure hashes and are rotated when their PDF is first issued.
INSERT INTO public.storefront_tickets (booking_id, ticket_number, token_hash)
SELECT
  b.id,
  ticket_number,
  CASE
    WHEN ticket_number = 1 AND b.ticket_token IS NOT NULL
      THEN encode(extensions.digest(convert_to(b.ticket_token, 'UTF8'), 'sha256'), 'hex')
    ELSE encode(extensions.digest(extensions.gen_random_bytes(32), 'sha256'), 'hex')
  END
FROM public.storefront_bookings AS b
CROSS JOIN LATERAL generate_series(1, b.quantity) AS gs(ticket_number)
ON CONFLICT (booking_id, ticket_number) DO NOTHING;

ALTER TABLE public.storefront_bookings
  DROP COLUMN IF EXISTS ticket_token;

ALTER TABLE public.storefront_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.storefront_tickets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.storefront_tickets TO service_role;

-- The create function no longer returns any token to browser clients.
DROP FUNCTION IF EXISTS public.create_storefront_booking(text, integer, text, text, text);

CREATE FUNCTION public.create_storefront_booking(
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
    buyer_name, buyer_email, buyer_phone, is_demo
  )
  VALUES (
    v_reference, v_event_id, v_customer_id, v_event_slug, v_event_title,
    v_event_date_label, v_event_time_label, v_event_venue, v_event_location,
    p_quantity, v_unit_price, v_unit_price * p_quantity, v_currency,
    v_name, v_email, v_phone, true
  );

  RETURN QUERY SELECT v_reference, v_unit_price * p_quantity;
END;
$$;

REVOKE ALL ON FUNCTION public.create_storefront_booking(text, integer, text, text, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_storefront_booking(text, integer, text, text, text)
TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.claim_storefront_ticket_email(
  p_booking_reference text,
  p_resend boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_booking public.storefront_bookings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to request your ticket email.' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_booking
  FROM public.storefront_bookings
  WHERE booking_reference = p_booking_reference
    AND customer_id = auth.uid()
    AND is_demo
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demo booking not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_booking.ticket_email_status = 'sending'
     OR (v_booking.ticket_email_status = 'sent' AND NOT coalesce(p_resend, false)) THEN
    RETURN false;
  END IF;

  UPDATE public.storefront_bookings
  SET ticket_email_status = 'sending'
  WHERE id = v_booking.id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_storefront_ticket_email(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_storefront_ticket_email(text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.finish_storefront_ticket_email(
  p_booking_reference text,
  p_sent boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to update ticket delivery.' USING ERRCODE = '28000';
  END IF;

  UPDATE public.storefront_bookings
  SET ticket_email_status = CASE WHEN p_sent THEN 'sent' ELSE 'failed' END,
      ticket_emailed_at = CASE WHEN p_sent THEN now() ELSE ticket_emailed_at END
  WHERE booking_reference = p_booking_reference
    AND customer_id = auth.uid()
    AND is_demo
    AND ticket_email_status = 'sending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket delivery state could not be updated.' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.finish_storefront_ticket_email(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finish_storefront_ticket_email(text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_storefront_ticket_assets(
  p_booking_reference text,
  p_force boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_booking public.storefront_bookings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to prepare your ticket.' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_booking
  FROM public.storefront_bookings
  WHERE booking_reference = p_booking_reference
    AND customer_id = auth.uid()
    AND is_demo
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demo booking not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_booking.ticket_assets_status = 'ready' AND NOT coalesce(p_force, false) THEN
    RETURN false;
  END IF;
  IF v_booking.ticket_assets_status = 'generating'
     AND v_booking.ticket_assets_started_at > now() - interval '10 minutes' THEN
    RETURN false;
  END IF;

  UPDATE public.storefront_bookings
  SET ticket_assets_status = 'generating',
      ticket_assets_started_at = now()
  WHERE id = v_booking.id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_storefront_ticket_assets(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_storefront_ticket_assets(text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.finish_storefront_ticket_assets(
  p_booking_reference text,
  p_ready boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to update ticket preparation.' USING ERRCODE = '28000';
  END IF;

  UPDATE public.storefront_bookings
  SET ticket_assets_status = CASE WHEN p_ready THEN 'ready' ELSE 'pending' END,
      ticket_assets_started_at = NULL
  WHERE booking_reference = p_booking_reference
    AND customer_id = auth.uid()
    AND is_demo
    AND ticket_assets_status = 'generating';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket preparation state could not be updated.' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.finish_storefront_ticket_assets(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finish_storefront_ticket_assets(text, boolean) TO authenticated;

DROP FUNCTION IF EXISTS public.claim_storefront_ticket_download(text);

CREATE FUNCTION public.claim_storefront_ticket_download(p_booking_reference text)
RETURNS TABLE (claimed boolean, already_downloaded_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_booking public.storefront_bookings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to download your ticket.' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_booking
  FROM public.storefront_bookings
  WHERE booking_reference = p_booking_reference
    AND customer_id = auth.uid()
    AND is_demo
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demo ticket not found.' USING ERRCODE = 'P0002';
  END IF;

  IF v_booking.ticket_downloaded_at IS NOT NULL THEN
    RETURN QUERY SELECT false, v_booking.ticket_downloaded_at;
    RETURN;
  END IF;

  UPDATE public.storefront_bookings
  SET ticket_downloaded_at = now()
  WHERE id = v_booking.id;
  RETURN QUERY SELECT true, NULL::timestamptz;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_storefront_ticket_download(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_storefront_ticket_download(text) TO authenticated;

DROP FUNCTION IF EXISTS public.mark_storefront_ticket_emailed(text);

CREATE OR REPLACE FUNCTION public.verify_storefront_ticket_by_id(
  p_ticket_id uuid,
  p_ticket_token text
)
RETURNS TABLE (
  valid boolean,
  event_title text,
  event_date text,
  event_time text,
  event_venue text,
  event_location text,
  booking_reference text,
  ticket_number integer,
  already_checked_in boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, extensions, pg_temp
AS $$
  WITH matched AS (
    SELECT t.revoked_at, t.checked_in_at, t.ticket_number, b.*
    FROM public.storefront_tickets AS t
    JOIN public.storefront_bookings AS b ON b.id = t.booking_id
    WHERE t.id = p_ticket_id
      AND p_ticket_token ~ '^[A-Za-z0-9_-]{32,128}$'
      AND t.token_hash = encode(
        extensions.digest(convert_to(p_ticket_token, 'UTF8'), 'sha256'),
        'hex'
      )
  )
  SELECT
    coalesce(m.revoked_at IS NULL AND m.checked_in_at IS NULL AND m.is_demo, false),
    m.event_title,
    m.event_date_label,
    m.event_time_label,
    m.event_venue,
    m.event_location,
    m.booking_reference,
    m.ticket_number,
    coalesce(m.checked_in_at IS NOT NULL, false)
  FROM (SELECT 1) AS requested
  LEFT JOIN matched AS m ON true;
$$;

REVOKE ALL ON FUNCTION public.verify_storefront_ticket_by_id(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_storefront_ticket_by_id(uuid, text)
TO anon, authenticated, service_role;

-- Keep old booking-reference QR links working while validating their hashed token.
DROP FUNCTION IF EXISTS public.verify_storefront_ticket(text, text);

CREATE FUNCTION public.verify_storefront_ticket(
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
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, extensions, pg_temp
AS $$
  WITH matched AS (
    SELECT t.revoked_at, t.checked_in_at, b.*
    FROM public.storefront_tickets AS t
    JOIN public.storefront_bookings AS b ON b.id = t.booking_id
    WHERE b.booking_reference = p_booking_reference
      AND t.ticket_number = 1
      AND p_ticket_token ~ '^[A-Za-z0-9_-]{32,128}$'
      AND t.token_hash = encode(
        extensions.digest(convert_to(p_ticket_token, 'UTF8'), 'sha256'),
        'hex'
      )
  )
  SELECT
    coalesce(m.revoked_at IS NULL AND m.checked_in_at IS NULL AND m.is_demo, false),
    m.event_title,
    m.event_date_label,
    m.event_venue,
    m.event_location,
    m.quantity
  FROM (SELECT 1) AS requested
  LEFT JOIN matched AS m ON true;
$$;

REVOKE ALL ON FUNCTION public.verify_storefront_ticket(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_storefront_ticket(text, text)
TO anon, authenticated, service_role;
