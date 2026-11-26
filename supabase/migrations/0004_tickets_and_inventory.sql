-- Phase 1 / 0004: ticket types and inventory counters.
-- Reservation/checkout execution is intentionally deferred to a later phase.

CREATE TABLE IF NOT EXISTS public.ticket_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_amount numeric(14,2) NOT NULL,
  currency char(3) NOT NULL DEFAULT 'BDT',
  quantity_total integer NOT NULL,
  max_per_order integer NOT NULL DEFAULT 8,
  sales_start_at timestamptz NOT NULL,
  sales_end_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  status public.ticket_type_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_types_event_name_key UNIQUE (event_id, name),
  CONSTRAINT ticket_types_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT ticket_types_price_nonnegative CHECK (price_amount >= 0),
  CONSTRAINT ticket_types_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT ticket_types_quantity_positive CHECK (quantity_total > 0),
  CONSTRAINT ticket_types_max_per_order_positive CHECK (max_per_order > 0),
  CONSTRAINT ticket_types_max_per_order_within_total CHECK (max_per_order <= quantity_total),
  CONSTRAINT ticket_types_sales_window CHECK (sales_end_at > sales_start_at)
);

COMMENT ON TABLE public.ticket_types IS 'Price/currency and sales-window definition. Monetary values use numeric(14,2); never floating point.';

CREATE TABLE IF NOT EXISTS public.ticket_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_type_id uuid NOT NULL UNIQUE REFERENCES public.ticket_types (id) ON DELETE CASCADE,
  total_quantity integer NOT NULL,
  reserved_quantity integer NOT NULL DEFAULT 0,
  sold_quantity integer NOT NULL DEFAULT 0,
  available_quantity integer GENERATED ALWAYS AS
    (total_quantity - reserved_quantity - sold_quantity) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_inventory_total_positive CHECK (total_quantity > 0),
  CONSTRAINT ticket_inventory_reserved_nonnegative CHECK (reserved_quantity >= 0),
  CONSTRAINT ticket_inventory_sold_nonnegative CHECK (sold_quantity >= 0),
  CONSTRAINT ticket_inventory_within_total CHECK (reserved_quantity + sold_quantity <= total_quantity)
);

COMMENT ON COLUMN public.ticket_inventory.available_quantity IS 'Generated invariant: total - reserved - sold. Clients cannot write it.';
