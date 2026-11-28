CREATE OR REPLACE FUNCTION public.default_ticket_design()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'version', 1,
    'backgroundColor', '#fffdf6',
    'primaryColor', '#f2c744',
    'secondaryColor', '#111111',
    'logoPath', NULL,
    'backgroundImagePath', NULL,
    'title', '',
    'subtitle', 'ADMIT ONE',
    'fontSize', 18,
    'textAlign', 'left',
    'showEventDate', true,
    'showEventTime', true,
    'showVenue', true,
    'showGuestName', true,
    'showBookingReference', true,
    'qrPosition', 'right',
    'qrSize', 32,
    'footerText', 'Thank you for joining us. Enjoy the event.'
  );
$$;

ALTER TABLE public.storefront_events
  ADD COLUMN IF NOT EXISTS ticket_design jsonb NOT NULL DEFAULT public.default_ticket_design();
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS ticket_design jsonb NOT NULL DEFAULT public.default_ticket_design();
ALTER TABLE public.storefront_bookings
  ADD COLUMN IF NOT EXISTS ticket_design jsonb NOT NULL DEFAULT public.default_ticket_design();

UPDATE public.storefront_events
SET ticket_design =
  jsonb_set(
    jsonb_set(
      jsonb_set(
        public.default_ticket_design(),
        '{backgroundColor}',
        to_jsonb(CASE ticket_design_style
          WHEN 'midnight' THEN '#111630'
          WHEN 'festival' THEN '#fff8ec'
          WHEN 'neon' THEN '#052730'
          ELSE '#fffdf6'
        END)
      ),
      '{primaryColor}',
      to_jsonb(CASE ticket_design_style
        WHEN 'midnight' THEN '#7d64ff'
        WHEN 'festival' THEN '#ffbe5c'
        WHEN 'neon' THEN '#00e0be'
        ELSE '#f2c744'
      END)
    ),
    '{secondaryColor}',
    to_jsonb(CASE ticket_design_style
      WHEN 'midnight' THEN '#ffffff'
      WHEN 'festival' THEN '#2d180a'
      WHEN 'neon' THEN '#ffffff'
      ELSE '#111111'
    END)
  );

UPDATE public.events catalog
SET ticket_design = showcase.ticket_design
FROM public.storefront_events showcase
WHERE showcase.normalized_event_id = catalog.id;

UPDATE public.storefront_bookings
SET ticket_design =
  jsonb_set(
    jsonb_set(
      jsonb_set(
        public.default_ticket_design(),
        '{backgroundColor}',
        to_jsonb(CASE ticket_design_style
          WHEN 'midnight' THEN '#111630'
          WHEN 'festival' THEN '#fff8ec'
          WHEN 'neon' THEN '#052730'
          ELSE '#fffdf6'
        END)
      ),
      '{primaryColor}',
      to_jsonb(CASE ticket_design_style
        WHEN 'midnight' THEN '#7d64ff'
        WHEN 'festival' THEN '#ffbe5c'
        WHEN 'neon' THEN '#00e0be'
        ELSE '#f2c744'
      END)
    ),
    '{secondaryColor}',
    to_jsonb(CASE ticket_design_style
      WHEN 'midnight' THEN '#ffffff'
      WHEN 'festival' THEN '#2d180a'
      WHEN 'neon' THEN '#ffffff'
      ELSE '#111111'
    END)
  );

ALTER TABLE public.storefront_events
  ADD CONSTRAINT storefront_events_ticket_design_object
    CHECK (jsonb_typeof(ticket_design) = 'object'),
  ADD CONSTRAINT storefront_events_ticket_design_colors
    CHECK (
      ticket_design->>'backgroundColor' ~ '^#[0-9a-fA-F]{6}$'
      AND ticket_design->>'primaryColor' ~ '^#[0-9a-fA-F]{6}$'
      AND ticket_design->>'secondaryColor' ~ '^#[0-9a-fA-F]{6}$'
    );
ALTER TABLE public.events
  ADD CONSTRAINT events_ticket_design_object
    CHECK (jsonb_typeof(ticket_design) = 'object'),
  ADD CONSTRAINT events_ticket_design_colors
    CHECK (
      ticket_design->>'backgroundColor' ~ '^#[0-9a-fA-F]{6}$'
      AND ticket_design->>'primaryColor' ~ '^#[0-9a-fA-F]{6}$'
      AND ticket_design->>'secondaryColor' ~ '^#[0-9a-fA-F]{6}$'
    );
ALTER TABLE public.storefront_bookings
  ADD CONSTRAINT storefront_bookings_ticket_design_object
    CHECK (jsonb_typeof(ticket_design) = 'object'),
  ADD CONSTRAINT storefront_bookings_ticket_design_colors
    CHECK (
      ticket_design->>'backgroundColor' ~ '^#[0-9a-fA-F]{6}$'
      AND ticket_design->>'primaryColor' ~ '^#[0-9a-fA-F]{6}$'
      AND ticket_design->>'secondaryColor' ~ '^#[0-9a-fA-F]{6}$'
    );

CREATE OR REPLACE FUNCTION public.sync_storefront_ticket_design()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.normalized_event_id IS NOT NULL
     AND (
       TG_OP = 'INSERT'
       OR OLD.normalized_event_id IS DISTINCT FROM NEW.normalized_event_id
       OR OLD.ticket_design IS DISTINCT FROM NEW.ticket_design
     )
  THEN
    UPDATE public.events
    SET ticket_design = NEW.ticket_design
    WHERE id = NEW.normalized_event_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_storefront_ticket_design ON public.storefront_events;
CREATE TRIGGER trg_sync_storefront_ticket_design
AFTER INSERT OR UPDATE ON public.storefront_events
FOR EACH ROW EXECUTE FUNCTION public.sync_storefront_ticket_design();

CREATE OR REPLACE FUNCTION public.snapshot_storefront_ticket_design()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.storefront_event_id IS NOT NULL THEN
    SELECT ticket_design_style, ticket_design_image_path, ticket_design
    INTO NEW.ticket_design_style, NEW.ticket_design_image_path, NEW.ticket_design
    FROM public.storefront_events
    WHERE id = NEW.storefront_event_id;
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS ticket_assets_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ticket_pdf_path text,
  ADD COLUMN IF NOT EXISTS ticket_email_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ticket_email_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS ticket_emailed_at timestamptz,
  ADD COLUMN IF NOT EXISTS ticket_email_error text;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_ticket_assets_status_check
    CHECK (ticket_assets_status IN ('pending', 'generating', 'ready')),
  ADD CONSTRAINT orders_ticket_email_status_check
    CHECK (ticket_email_status IN ('pending', 'sending', 'sent', 'failed')),
  ADD CONSTRAINT orders_ticket_email_error_length
    CHECK (ticket_email_error IS NULL OR length(ticket_email_error) <= 500);

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

  IF current_setting('app.ticket_delivery_update', true) = OLD.id::text
     AND (
       public.is_service_role()
       OR public.is_admin()
       OR public.owns_order(OLD.id)
     )
     AND (
       to_jsonb(NEW) - 'ticket_assets_status' - 'ticket_pdf_path'
         - 'ticket_email_status' - 'ticket_email_claimed_at'
         - 'ticket_emailed_at' - 'ticket_email_error' - 'updated_at'
     ) = (
       to_jsonb(OLD) - 'ticket_assets_status' - 'ticket_pdf_path'
         - 'ticket_email_status' - 'ticket_email_claimed_at'
         - 'ticket_emailed_at' - 'ticket_email_error' - 'updated_at'
     ) THEN
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

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS order_item_ticket_number integer,
  ADD COLUMN IF NOT EXISTS order_ticket_number integer;

WITH numbered AS (
  SELECT id,
         row_number() OVER (PARTITION BY order_item_id ORDER BY issued_at, id)::integer AS item_number,
         row_number() OVER (PARTITION BY order_id ORDER BY issued_at, id)::integer AS order_number
  FROM public.tickets
)
UPDATE public.tickets ticket
SET order_item_ticket_number = numbered.item_number,
    order_ticket_number = numbered.order_number
FROM numbered
WHERE ticket.id = numbered.id
  AND (ticket.order_item_ticket_number IS NULL OR ticket.order_ticket_number IS NULL);

ALTER TABLE public.tickets
  ALTER COLUMN order_item_ticket_number SET NOT NULL,
  ALTER COLUMN order_ticket_number SET NOT NULL,
  ADD CONSTRAINT tickets_order_item_number_positive
    CHECK (order_item_ticket_number > 0 AND order_ticket_number > 0);

CREATE UNIQUE INDEX IF NOT EXISTS tickets_order_item_number_unique
  ON public.tickets (order_item_id, order_item_ticket_number);
CREATE UNIQUE INDEX IF NOT EXISTS tickets_order_number_unique
  ON public.tickets (order_id, order_ticket_number);

CREATE OR REPLACE FUNCTION public.is_verified_paid_order(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders order_row
    JOIN public.payments payment_row ON payment_row.order_id = order_row.id
    WHERE order_row.id = p_order_id
      AND order_row.status = 'paid'
      AND order_row.paid_at IS NOT NULL
      AND payment_row.status = 'succeeded'
      AND payment_row.verified_at IS NOT NULL
      AND payment_row.refunded_amount = 0
      AND payment_row.amount >= order_row.total_amount
  );
$$;

CREATE OR REPLACE FUNCTION public.claim_order_ticket_assets(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.is_admin() OR public.owns_order(p_order_id)
  ) THEN
    RAISE EXCEPTION 'You are not allowed to prepare tickets for this order.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;
  IF NOT FOUND OR NOT public.is_verified_paid_order(p_order_id) THEN
    RAISE EXCEPTION 'Tickets are issued only after verified payment.'
      USING ERRCODE = '42501';
  END IF;

  IF v_order.ticket_assets_status = 'ready' THEN
    RETURN false;
  END IF;
  IF v_order.ticket_assets_status = 'generating'
     AND v_order.updated_at > now() - interval '10 minutes' THEN
    RETURN false;
  END IF;

  PERFORM set_config('app.ticket_delivery_update', p_order_id::text, true);
  UPDATE public.orders
  SET ticket_assets_status = 'generating'
  WHERE id = p_order_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_order_ticket_assets(
  p_order_id uuid,
  p_ready boolean,
  p_pdf_path text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'Only the ticket delivery service can update this order''s ticket state.'
      USING ERRCODE = '42501';
  END IF;
  IF p_ready AND (p_pdf_path IS NULL OR length(btrim(p_pdf_path)) = 0) THEN
    RAISE EXCEPTION 'A stored ticket PDF path is required.';
  END IF;

  PERFORM set_config('app.ticket_delivery_update', p_order_id::text, true);
  UPDATE public.orders
  SET ticket_assets_status = CASE WHEN p_ready THEN 'ready' ELSE 'pending' END,
      ticket_pdf_path = CASE WHEN p_ready THEN p_pdf_path ELSE NULL END
  WHERE id = p_order_id
    AND ticket_assets_status = 'generating';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket preparation state could not be updated.'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_order_ticket_email(
  p_order_id uuid,
  p_resend boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.is_admin() OR public.owns_order(p_order_id)
  ) THEN
    RAISE EXCEPTION 'You are not allowed to email tickets for this order.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;
  IF NOT FOUND OR NOT public.is_verified_paid_order(p_order_id) THEN
    RAISE EXCEPTION 'Tickets are emailed only after verified payment.'
      USING ERRCODE = '42501';
  END IF;
  IF v_order.ticket_assets_status <> 'ready' OR v_order.ticket_pdf_path IS NULL THEN
    RAISE EXCEPTION 'The paid ticket PDF is not ready yet.';
  END IF;
  IF (
       v_order.ticket_email_status = 'sending'
       AND v_order.ticket_email_claimed_at > now() - interval '10 minutes'
     )
     OR (v_order.ticket_email_status = 'sent' AND NOT coalesce(p_resend, false)) THEN
    RETURN false;
  END IF;

  PERFORM set_config('app.ticket_delivery_update', p_order_id::text, true);
  UPDATE public.orders
  SET ticket_email_status = 'sending',
      ticket_email_claimed_at = now(),
      ticket_email_error = NULL
  WHERE id = p_order_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_order_ticket_email(
  p_order_id uuid,
  p_sent boolean,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'Only the ticket delivery service can update this order''s email state.'
      USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.ticket_delivery_update', p_order_id::text, true);
  UPDATE public.orders
  SET ticket_email_status = CASE WHEN p_sent THEN 'sent' ELSE 'failed' END,
      ticket_email_claimed_at = NULL,
      ticket_emailed_at = CASE WHEN p_sent THEN now() ELSE ticket_emailed_at END,
      ticket_email_error = CASE WHEN p_sent THEN NULL ELSE left(coalesce(p_error, 'Email delivery failed.'), 500) END
  WHERE id = p_order_id
    AND ticket_email_status = 'sending'
    AND public.is_verified_paid_order(p_order_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket email state could not be updated.'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.is_verified_paid_order(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_order_ticket_assets(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finish_order_ticket_assets(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_order_ticket_email(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finish_order_ticket_email(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_verified_paid_order(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_order_ticket_assets(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finish_order_ticket_assets(uuid, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_order_ticket_email(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.finish_order_ticket_email(uuid, boolean, text) TO service_role;

CREATE OR REPLACE FUNCTION public.verify_ticket_by_id(
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
  already_checked_in boolean,
  is_demo boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, extensions, pg_temp
AS $$
  WITH matches AS (
    SELECT
      coalesce(ticket.revoked_at IS NULL AND ticket.checked_in_at IS NULL AND booking.is_demo, false) AS valid,
      booking.event_title,
      booking.event_date_label AS event_date,
      booking.event_time_label AS event_time,
      booking.event_venue,
      booking.event_location,
      booking.booking_reference,
      ticket.ticket_number,
      coalesce(ticket.checked_in_at IS NOT NULL, false) AS already_checked_in,
      true AS is_demo
    FROM public.storefront_tickets ticket
    JOIN public.storefront_bookings booking ON booking.id = ticket.booking_id
    WHERE ticket.id = p_ticket_id
      AND p_ticket_token ~ '^[A-Za-z0-9_-]{32,128}$'
      AND ticket.token_hash = encode(
        extensions.digest(convert_to(p_ticket_token, 'UTF8'), 'sha256'),
        'hex'
      )
      AND booking.is_demo

    UNION ALL

    SELECT
      ticket.status = 'valid'
        AND ticket.checkin_status = 'not_checked_in'
        AND public.is_verified_paid_order(ticket.order_id) AS valid,
      event.title AS event_title,
      to_char(event.starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS event_date,
      to_char(event.starts_at AT TIME ZONE 'UTC', 'HH12:MI AM') AS event_time,
      event.venue_name AS event_venue,
      concat_ws(', ', event.venue_address, event.venue_city) AS event_location,
      order_row.order_number AS booking_reference,
      ticket.order_item_ticket_number AS ticket_number,
      ticket.checkin_status = 'checked_in' AS already_checked_in,
      false AS is_demo
    FROM public.tickets ticket
    JOIN public.orders order_row ON order_row.id = ticket.order_id
    JOIN public.events event ON event.id = ticket.event_id
    WHERE ticket.id = p_ticket_id
      AND p_ticket_token ~ '^[A-Za-z0-9_-]{32,128}$'
      AND ticket.qr_token_hash = encode(
        extensions.digest(convert_to(p_ticket_token, 'UTF8'), 'sha256'),
        'hex'
      )
  )
  SELECT
    coalesce(matched.valid, false),
    matched.event_title,
    matched.event_date,
    matched.event_time,
    matched.event_venue,
    matched.event_location,
    matched.booking_reference,
    matched.ticket_number,
    coalesce(matched.already_checked_in, false),
    coalesce(matched.is_demo, false)
  FROM (SELECT 1) requested
  LEFT JOIN matches matched ON true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.verify_ticket_by_id(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_ticket_by_id(uuid, text)
  TO anon, authenticated, service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ticket-design-assets',
  'ticket-design-assets',
  false,
  10 * 1024 * 1024,
  ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS storage_ticket_design_asset_read ON storage.objects;
CREATE POLICY storage_ticket_design_asset_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'ticket-design-assets'
    AND public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.storefront_events showcase
      WHERE showcase.id = public.storage_path_uuid(storage.objects.name)
    )
  );
DROP POLICY IF EXISTS storage_ticket_design_asset_insert ON storage.objects;
CREATE POLICY storage_ticket_design_asset_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ticket-design-assets'
    AND public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.storefront_events showcase
      WHERE showcase.id = public.storage_path_uuid(name)
    )
  );
DROP POLICY IF EXISTS storage_ticket_design_asset_update ON storage.objects;
CREATE POLICY storage_ticket_design_asset_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'ticket-design-assets'
    AND public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.storefront_events showcase
      WHERE showcase.id = public.storage_path_uuid(storage.objects.name)
    )
  )
  WITH CHECK (
    bucket_id = 'ticket-design-assets'
    AND public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.storefront_events showcase
      WHERE showcase.id = public.storage_path_uuid(name)
    )
  );
DROP POLICY IF EXISTS storage_ticket_design_asset_delete ON storage.objects;
CREATE POLICY storage_ticket_design_asset_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'ticket-design-assets'
    AND public.is_admin()
    AND EXISTS (
      SELECT 1 FROM public.storefront_events showcase
      WHERE showcase.id = public.storage_path_uuid(storage.objects.name)
    )
  );
