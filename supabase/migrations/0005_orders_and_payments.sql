-- Phase 1 / 0005: orders, reservation records and Stripe-ready payment tables.
-- No Stripe calls, webhook handlers or checkout logic are implemented here.

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE DEFAULT (
    'TS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
  ),
  customer_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE RESTRICT,
  status public.order_status NOT NULL DEFAULT 'pending',
  currency char(3) NOT NULL DEFAULT 'BDT',
  subtotal_amount numeric(14,2) NOT NULL,
  discount_amount numeric(14,2) NOT NULL DEFAULT 0,
  fee_amount numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL,
  buyer_name text NOT NULL,
  buyer_email text NOT NULL,
  buyer_phone text,
  expires_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orders_order_number_format CHECK (order_number ~ '^TS-[A-Z0-9]{6,32}$'),
  CONSTRAINT orders_subtotal_nonnegative CHECK (subtotal_amount >= 0),
  CONSTRAINT orders_discount_nonnegative CHECK (discount_amount >= 0),
  CONSTRAINT orders_fee_nonnegative CHECK (fee_amount >= 0),
  CONSTRAINT orders_total_nonnegative CHECK (total_amount >= 0),
  CONSTRAINT orders_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT orders_buyer_name_not_blank CHECK (length(btrim(buyer_name)) > 0),
  CONSTRAINT orders_buyer_email_format CHECK (
    buyer_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  CONSTRAINT orders_paid_has_timestamp CHECK (status <> 'paid' OR paid_at IS NOT NULL),
  CONSTRAINT orders_cancelled_has_timestamp CHECK (
    status <> 'cancelled' OR cancelled_at IS NOT NULL
  )
);

COMMENT ON COLUMN public.orders.customer_id IS 'Nullable to support guest checkout until auth is wired in a later phase; buyer_email is required.';

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  ticket_type_id uuid NOT NULL REFERENCES public.ticket_types (id) ON DELETE RESTRICT,
  quantity integer NOT NULL,
  unit_price_amount numeric(14,2) NOT NULL,
  line_total_amount numeric(14,2) NOT NULL,
  currency char(3) NOT NULL DEFAULT 'BDT',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_items_order_ticket_type_key UNIQUE (order_id, ticket_type_id),
  CONSTRAINT order_items_quantity_positive CHECK (quantity > 0),
  CONSTRAINT order_items_unit_price_nonnegative CHECK (unit_price_amount >= 0),
  CONSTRAINT order_items_line_total_nonnegative CHECK (line_total_amount >= 0),
  CONSTRAINT order_items_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT order_items_line_total_matches CHECK (
    line_total_amount = unit_price_amount * quantity
  )
);

-- Inventory reservation schema only. Later checkout code must lock inventory rows
-- before mutating these records; Phase 1 does not create reservations.
CREATE TABLE IF NOT EXISTS public.ticket_inventory_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_type_id uuid NOT NULL REFERENCES public.ticket_types (id) ON DELETE RESTRICT,
  order_id uuid REFERENCES public.orders (id) ON DELETE SET NULL,
  quantity integer NOT NULL,
  status public.inventory_reservation_status NOT NULL DEFAULT 'pending',
  idempotency_key text UNIQUE,
  expires_at timestamptz NOT NULL,
  confirmed_at timestamptz,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_inventory_reservations_quantity_positive CHECK (quantity > 0),
  CONSTRAINT ticket_inventory_reservations_confirmed_has_order CHECK (
    status <> 'confirmed' OR order_id IS NOT NULL
  ),
  CONSTRAINT ticket_inventory_reservations_confirmed_timestamp CHECK (
    status <> 'confirmed' OR confirmed_at IS NOT NULL
  ),
  CONSTRAINT ticket_inventory_reservations_released_timestamp CHECK (
    status NOT IN ('released', 'expired', 'cancelled') OR released_at IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE RESTRICT,
  payment_intent_id text UNIQUE,
  checkout_session_id text UNIQUE,
  transaction_reference text UNIQUE,
  amount numeric(14,2) NOT NULL,
  refunded_amount numeric(14,2) NOT NULL DEFAULT 0,
  currency char(3) NOT NULL DEFAULT 'BDT',
  status public.payment_status NOT NULL DEFAULT 'pending',
  payment_method public.payment_method NOT NULL DEFAULT 'card',
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_amount_nonnegative CHECK (amount >= 0),
  CONSTRAINT payments_refunded_nonnegative CHECK (refunded_amount >= 0),
  CONSTRAINT payments_refunded_within_amount CHECK (refunded_amount <= amount),
  CONSTRAINT payments_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT payments_succeeded_requires_verification CHECK (
    status <> 'succeeded' OR verified_at IS NOT NULL
  ),
  CONSTRAINT payments_has_provider_reference CHECK (
    payment_intent_id IS NOT NULL OR
    checkout_session_id IS NOT NULL OR
    transaction_reference IS NOT NULL
  )
);

COMMENT ON TABLE public.payments IS 'Provider metadata only. Card numbers, CVCs and raw credentials must never be stored here.';

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'stripe',
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  signature_verified boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_webhook_events_provider_not_blank CHECK (length(btrim(provider)) > 0),
  CONSTRAINT payment_webhook_events_type_not_blank CHECK (length(btrim(event_type)) > 0)
);

COMMENT ON TABLE public.payment_webhook_events IS 'Idempotency ledger for provider webhooks. Payloads must be sanitized before storage; no raw card data.';
