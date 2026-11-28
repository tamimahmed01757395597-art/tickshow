-- Phase 5 / 0035: real Stripe TEST MODE checkout, signed webhook processing,
-- idempotency ledger and defense-in-depth API hardening.
--
-- This migration is forward-only and additive. It does not delete records.
-- Orders and payments are created only by trusted server code through the
-- SECURITY DEFINER functions below; browser clients never supply prices.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'stripe';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_provider_check'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_provider_check CHECK (provider IN ('stripe'));
  END IF;
END $$;

-- Extend the order immutability guard with one narrow, server-only exception
-- for verified payment state transitions. All money, identity and event fields
-- remain immutable; only status and its timestamps may change.
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

  IF current_setting('app.payment_webhook_update', true) = OLD.id::text
     AND (public.is_service_role() OR public.is_admin())
     AND (
       to_jsonb(NEW) - 'status' - 'paid_at' - 'cancelled_at' - 'updated_at'
     ) = (
       to_jsonb(OLD) - 'status' - 'paid_at' - 'cancelled_at' - 'updated_at'
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

-- ---------------------------------------------------------------------------
-- Idempotent webhook ledger claims. These are callable only by the webhook
-- service so a client cannot forge a processed event.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_payment_webhook_event(
  p_event_id text,
  p_event_type text,
  p_payload jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claimed integer;
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'Only the payment webhook service can claim provider events.'
      USING ERRCODE = '42501';
  END IF;
  IF coalesce(btrim(p_event_id), '') = '' OR coalesce(btrim(p_event_type), '') = '' THEN
    RAISE EXCEPTION 'A provider event id and type are required.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.payment_webhook_events (
    provider, event_id, event_type, payload, signature_verified, processed_at
  )
  VALUES ('stripe', p_event_id, p_event_type, coalesce(p_payload, '{}'::jsonb), true, NULL)
  ON CONFLICT (event_id) DO NOTHING;

  GET DIAGNOSTICS v_claimed = ROW_COUNT;
  RETURN v_claimed > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_payment_webhook_event(p_event_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'Only the payment webhook service can release provider events.'
      USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.payment_webhook_events
   WHERE event_id = p_event_id AND processed_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_payment_webhook_event(p_event_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'Only the payment webhook service can finish provider events.'
      USING ERRCODE = '42501';
  END IF;
  UPDATE public.payment_webhook_events
     SET processed_at = now()
   WHERE event_id = p_event_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Server-created pending order. Prices, currency and inventory come from the
-- database. The browser only supplies the event slug, quantity and contact
-- details; the authenticated email is passed by the Edge Function.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_stripe_checkout_order(
  p_event_slug text,
  p_quantity integer,
  p_buyer_name text,
  p_buyer_email text,
  p_buyer_phone text,
  p_customer_id uuid
)
RETURNS TABLE (
  order_id uuid,
  order_number text,
  amount_minor bigint,
  currency text,
  event_title text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event_id uuid;
  v_event_title text;
  v_unit_price numeric(14,2);
  v_currency text;
  v_ticket_type_id uuid;
  v_available integer;
  v_total numeric(14,2);
  v_order_id uuid;
  v_order_number text;
  v_name text := btrim(coalesce(p_buyer_name, ''));
  v_email text := lower(btrim(coalesce(p_buyer_email, '')));
  v_phone text := btrim(coalesce(p_buyer_phone, ''));
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'Checkout orders can only be created by the payment service.'
      USING ERRCODE = '42501';
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
  IF length(v_phone) NOT BETWEEN 7 AND 32 THEN
    RAISE EXCEPTION 'Enter a valid phone number.' USING ERRCODE = '22023';
  END IF;
  IF p_customer_id IS NULL THEN
    RAISE EXCEPTION 'Sign in before checkout.' USING ERRCODE = '28000';
  END IF;

  SELECT se.normalized_event_id, se.title, se.price_amount, upper(se.currency)
    INTO v_event_id, v_event_title, v_unit_price, v_currency
    FROM public.storefront_events se
   WHERE se.slug = p_event_slug
     AND se.is_visible
     AND se.event_group <> 'past'
     AND (se.event_group = 'ongoing' OR se.date_value >= current_date)
   FOR SHARE;
  IF NOT FOUND OR v_event_id IS NULL OR NOT public.is_event_public(v_event_id) THEN
    RAISE EXCEPTION 'This event is not available for paid checkout.'
      USING ERRCODE = '22023';
  END IF;

  SELECT tt.id
    INTO v_ticket_type_id
    FROM public.ticket_types tt
   WHERE tt.event_id = v_event_id
     AND tt.status = 'active'
     AND tt.is_active
     AND now() BETWEEN tt.sales_start_at AND tt.sales_end_at
     AND p_quantity <= tt.max_per_order
   ORDER BY tt.price_amount ASC, tt.created_at ASC
   LIMIT 1;
  IF v_ticket_type_id IS NULL THEN
    RAISE EXCEPTION 'Tickets for this event are not on sale.'
      USING ERRCODE = '22023';
  END IF;

  SELECT ti.total_quantity - ti.reserved_quantity - ti.sold_quantity
    INTO v_available
    FROM public.ticket_inventory ti
   WHERE ti.ticket_type_id = v_ticket_type_id
   FOR UPDATE;
  IF coalesce(v_available, 0) < p_quantity THEN
    RAISE EXCEPTION 'There are not enough tickets available for this order.'
      USING ERRCODE = '22023';
  END IF;

  v_total := v_unit_price * p_quantity;
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'This event has no payable ticket price configured.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.orders AS newly_created (
    customer_id, event_id, status, currency, subtotal_amount, total_amount,
    buyer_name, buyer_email, buyer_phone, expires_at
  )
  VALUES (
    p_customer_id, v_event_id, 'pending', v_currency, v_total, v_total,
    v_name, v_email, v_phone, now() + interval '30 minutes'
  )
  RETURNING newly_created.id, newly_created.order_number
    INTO v_order_id, v_order_number;

  INSERT INTO public.order_items (
    order_id, ticket_type_id, quantity, unit_price_amount, line_total_amount, currency
  )
  VALUES (v_order_id, v_ticket_type_id, p_quantity, v_unit_price, v_total, v_currency);

  INSERT INTO public.ticket_inventory_reservations (
    ticket_type_id, order_id, quantity, status, idempotency_key, expires_at
  )
  VALUES (
    v_ticket_type_id, v_order_id, p_quantity, 'pending', v_order_number,
    now() + interval '30 minutes'
  );

  INSERT INTO public.payments (
    order_id, transaction_reference, amount, currency, status, payment_method, provider
  )
  VALUES (
    v_order_id, 'pending_' || v_order_number, v_total, v_currency, 'pending', 'card', 'stripe'
  );

  RETURN QUERY SELECT v_order_id, v_order_number, round(v_total * 100)::bigint, v_currency, v_event_title;
END;
$$;

-- ---------------------------------------------------------------------------
-- Signed webhook state transitions. Every amount is rechecked against the
-- database record before an order can become paid or a ticket can be issued.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_stripe_order_processing(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'Only the payment webhook service can update payment state.'
      USING ERRCODE = '42501';
  END IF;
  UPDATE public.payments
     SET status = 'processing'
   WHERE order_id = p_order_id AND status = 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_stripe_order_paid(
  p_order_id uuid,
  p_session_id text,
  p_payment_intent_id text,
  p_amount_minor bigint,
  p_currency text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_item record;
  v_ticket_number integer := 1;
  v_item_number integer;
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'Only the payment webhook service can confirm payments.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The order for this payment was not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_order.status = 'paid' THEN
    RETURN;
  END IF;
  IF v_order.status <> 'pending' THEN
    RAISE EXCEPTION 'This order can no longer be confirmed by a payment event.'
      USING ERRCODE = '22023';
  END IF;
  IF round(v_order.total_amount * 100)::bigint <> p_amount_minor
     OR upper(v_order.currency) <> upper(coalesce(p_currency, '')) THEN
    RAISE EXCEPTION 'The verified payment amount does not match the order.'
      USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.payment_webhook_update', p_order_id::text, true);
  UPDATE public.orders
     SET status = 'paid', paid_at = now()
   WHERE id = p_order_id;

  UPDATE public.payments
     SET status = 'succeeded',
         verified_at = now(),
         provider = 'stripe',
         checkout_session_id = coalesce(p_session_id, checkout_session_id),
         payment_intent_id = coalesce(p_payment_intent_id, payment_intent_id),
         transaction_reference = coalesce(p_payment_intent_id, p_session_id, transaction_reference)
   WHERE order_id = p_order_id
     AND status IN ('pending', 'processing');

  UPDATE public.ticket_inventory_reservations
     SET status = 'confirmed', confirmed_at = now()
   WHERE order_id = p_order_id AND status = 'pending';

  FOR v_item IN
    SELECT oi.id, oi.ticket_type_id, oi.quantity
      FROM public.order_items oi
     WHERE oi.order_id = p_order_id
     ORDER BY oi.created_at, oi.id
  LOOP
    FOR v_item_number IN 1..v_item.quantity LOOP
      INSERT INTO public.tickets (
        order_id, order_item_id, customer_id, event_id, ticket_type_id,
        qr_token_hash, order_item_ticket_number, order_ticket_number
      )
      VALUES (
        v_order.id, v_item.id, v_order.customer_id, v_order.event_id, v_item.ticket_type_id,
        encode(extensions.digest(extensions.gen_random_bytes(32), 'sha256'), 'hex'),
        v_item_number, v_ticket_number
      );
      v_ticket_number := v_ticket_number + 1;
    END LOOP;
  END LOOP;

  PERFORM set_config('app.payment_webhook_update', '', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_stripe_order_unpaid(
  p_order_id uuid,
  p_status text,
  p_session_id text DEFAULT NULL,
  p_payment_intent_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order_status public.order_status;
  v_payment_status public.payment_status;
  v_reservation_status public.inventory_reservation_status;
BEGIN
  IF NOT public.is_service_role() THEN
    RAISE EXCEPTION 'Only the payment webhook service can update payment state.'
      USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('failed', 'cancelled', 'expired') THEN
    RAISE EXCEPTION 'Unsupported payment failure state.' USING ERRCODE = '22023';
  END IF;
  v_order_status := p_status::public.order_status;
  v_payment_status := CASE
    WHEN p_status = 'expired' THEN 'cancelled'::public.payment_status
    ELSE p_status::public.payment_status
  END;
  v_reservation_status := CASE WHEN p_status = 'expired' THEN 'expired' ELSE 'cancelled' END::public.inventory_reservation_status;

  PERFORM set_config('app.payment_webhook_update', p_order_id::text, true);
  UPDATE public.orders
     SET status = v_order_status,
         cancelled_at = CASE WHEN p_status = 'cancelled' THEN now() ELSE cancelled_at END
   WHERE id = p_order_id AND status = 'pending';
  IF NOT FOUND THEN
    PERFORM set_config('app.payment_webhook_update', '', true);
    RETURN;
  END IF;

  UPDATE public.payments
     SET status = v_payment_status,
         checkout_session_id = coalesce(p_session_id, checkout_session_id),
         payment_intent_id = coalesce(p_payment_intent_id, payment_intent_id),
         transaction_reference = coalesce(p_payment_intent_id, p_session_id, transaction_reference)
   WHERE order_id = p_order_id AND status IN ('pending', 'processing');

  UPDATE public.ticket_inventory_reservations
     SET status = v_reservation_status, released_at = now()
   WHERE order_id = p_order_id AND status = 'pending';
  PERFORM set_config('app.payment_webhook_update', '', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- Administrative status changes go through one role-checked function. Paid
-- status remains webhook-only so an admin client cannot mint revenue.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_set_order_status(
  p_order_id uuid,
  p_status public.order_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() OR public.is_service_role() THEN
    RAISE EXCEPTION 'Only administrators can change order status.'
      USING ERRCODE = '42501';
  END IF;
  IF p_status = 'paid' THEN
    RAISE EXCEPTION 'Paid status is set only by verified payment webhooks.'
      USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.payment_webhook_update', p_order_id::text, true);
  UPDATE public.orders
     SET status = p_status,
         paid_at = CASE WHEN p_status = 'paid' THEN now() ELSE paid_at END,
         cancelled_at = CASE WHEN p_status = 'cancelled' THEN now() ELSE cancelled_at END
   WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.' USING ERRCODE = 'P0002';
  END IF;
  PERFORM set_config('app.payment_webhook_update', '', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- Internal functions are never executable by anonymous or browser roles.
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.claim_payment_webhook_event(text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_payment_webhook_event(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_payment_webhook_event(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_stripe_checkout_order(text, integer, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_stripe_order_processing(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_stripe_order_paid(uuid, text, text, bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_stripe_order_unpaid(uuid, text, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_payment_webhook_event(text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_payment_webhook_event(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_payment_webhook_event(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_stripe_checkout_order(text, integer, text, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_stripe_order_processing(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_stripe_order_paid(uuid, text, text, bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_stripe_order_unpaid(uuid, text, text, text) TO service_role;

GRANT EXECUTE ON FUNCTION public.admin_set_order_status(uuid, public.order_status) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_set_order_status(uuid, public.order_status) FROM anon;

-- Ticket verification now covers paid tickets only. The legacy demo branch is
-- removed so a historical demo QR code can never be reported as entry-valid.
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
  SELECT
    coalesce(
      ticket.status = 'valid'
        AND ticket.checkin_status = 'not_checked_in'
        AND public.is_verified_paid_order(ticket.order_id),
      false
    ) AS valid,
    event.title AS event_title,
    to_char(event.starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS event_date,
    to_char(event.starts_at AT TIME ZONE 'UTC', 'HH12:MI AM') AS event_time,
    event.venue_name AS event_venue,
    concat_ws(', ', event.venue_address, event.venue_city) AS event_location,
    order_row.order_number AS booking_reference,
    ticket.order_item_ticket_number AS ticket_number,
    coalesce(ticket.checkin_status = 'checked_in', false) AS already_checked_in,
    false AS is_demo
  FROM public.tickets ticket
  JOIN public.orders order_row ON order_row.id = ticket.order_id
  JOIN public.events event ON event.id = ticket.event_id
  WHERE ticket.id = p_ticket_id
    AND p_ticket_token ~ '^[A-Za-z0-9_-]{32,128}$'
    AND ticket.qr_token_hash = encode(
      extensions.digest(convert_to(p_ticket_token, 'UTF8'), 'sha256'),
      'hex'
    );
$$;

-- The demo booking RPC and its ticket APIs are retired. Existing rows are
-- preserved; only service-role tooling may call them for controlled export.
REVOKE ALL ON FUNCTION public.create_storefront_booking(text, integer, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_storefront_ticket_email(text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_storefront_ticket_email(text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_storefront_ticket_assets(text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_storefront_ticket_assets(text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_storefront_ticket_download(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_storefront_ticket_by_id(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_storefront_ticket(text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_storefront_booking(text, integer, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_storefront_ticket_email(text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_storefront_ticket_email(text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_storefront_ticket_assets(text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_storefront_ticket_assets(text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_storefront_ticket_download(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_storefront_ticket_by_id(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_storefront_ticket(text, text) TO service_role;

-- Defense in depth: RLS already restricts these tables. Removing broad client
-- write grants prevents accidental writes if a future policy is too permissive.
REVOKE INSERT, UPDATE, DELETE ON public.orders FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.order_items FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payments FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payment_webhook_events FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ticket_inventory_reservations FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.tickets FROM anon, authenticated;

GRANT SELECT ON public.orders, public.order_items, public.payments,
  public.payment_webhook_events, public.ticket_inventory_reservations,
  public.tickets TO authenticated;
