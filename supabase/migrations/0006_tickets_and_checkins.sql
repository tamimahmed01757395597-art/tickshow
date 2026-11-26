-- Phase 1 / 0006: issued tickets, QR verification token storage and one-time check-in ledger.
-- QR generation and verification endpoints are deferred to a later phase.

CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text NOT NULL UNIQUE DEFAULT (
    'TSK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
  ),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE RESTRICT,
  order_item_id uuid NOT NULL REFERENCES public.order_items (id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE RESTRICT,
  ticket_type_id uuid NOT NULL REFERENCES public.ticket_types (id) ON DELETE RESTRICT,
  qr_token_hash text NOT NULL UNIQUE,
  status public.ticket_status NOT NULL DEFAULT 'valid',
  checkin_status public.checkin_status NOT NULL DEFAULT 'not_checked_in',
  issued_at timestamptz NOT NULL DEFAULT now(),
  checked_in_at timestamptz,
  token_issued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tickets_hash_is_sha256 CHECK (qr_token_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT tickets_checked_in_timestamp CHECK (
    checkin_status <> 'checked_in' OR checked_in_at IS NOT NULL
  ),
  CONSTRAINT tickets_usable_status CHECK (
    status NOT IN ('cancelled', 'refunded', 'expired') OR checkin_status <> 'checked_in'
  )
);

COMMENT ON COLUMN public.tickets.qr_token_hash IS 'SHA-256 hash of a high-entropy token. The raw QR token is never stored in the database.';

CREATE TABLE IF NOT EXISTS public.ticket_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets (id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE RESTRICT,
  scanned_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  result public.checkin_result NOT NULL,
  denied_reason text,
  device_info text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_checkins_denied_has_reason CHECK (
    result <> 'denied' OR (denied_reason IS NOT NULL AND length(btrim(denied_reason)) > 0)
  )
);

COMMENT ON TABLE public.ticket_checkins IS 'Append-only-style verification ledger. A partial unique index enforces at most one successful check-in per ticket.';
