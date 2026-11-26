-- Phase 1 / 0007: refunds, commissions and payout records.
-- All money values are numeric(14,2) with explicit currency codes.

CREATE TABLE IF NOT EXISTS public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments (id) ON DELETE RESTRICT,
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE RESTRICT,
  stripe_refund_id text UNIQUE,
  amount numeric(14,2) NOT NULL,
  currency char(3) NOT NULL DEFAULT 'BDT',
  status public.refund_status NOT NULL DEFAULT 'pending',
  reason text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT refunds_amount_positive CHECK (amount > 0),
  CONSTRAINT refunds_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT refunds_processed_timestamp CHECK (
    status <> 'succeeded' OR processed_at IS NOT NULL
  )
);

CREATE TABLE IF NOT EXISTS public.organizer_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES public.organizers (id) ON DELETE RESTRICT,
  payout_reference text NOT NULL UNIQUE DEFAULT (
    'PO-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
  ),
  amount numeric(14,2) NOT NULL,
  currency char(3) NOT NULL DEFAULT 'BDT',
  status public.payout_status NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizer_payouts_amount_positive CHECK (amount > 0),
  CONSTRAINT organizer_payouts_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT organizer_payouts_paid_timestamp CHECK (
    status <> 'paid' OR paid_at IS NOT NULL
  ),
  CONSTRAINT organizer_payouts_reference_format CHECK (payout_reference ~ '^PO-[A-Z0-9]{6,32}$')
);

CREATE TABLE IF NOT EXISTS public.organizer_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES public.organizers (id) ON DELETE RESTRICT,
  event_id uuid REFERENCES public.events (id) ON DELETE RESTRICT,
  order_id uuid REFERENCES public.orders (id) ON DELETE RESTRICT,
  payout_id uuid REFERENCES public.organizer_payouts (id) ON DELETE SET NULL,
  commission_rate numeric(5,4) NOT NULL,
  gross_amount numeric(14,2) NOT NULL,
  commission_amount numeric(14,2) NOT NULL,
  net_amount numeric(14,2) NOT NULL,
  currency char(3) NOT NULL DEFAULT 'BDT',
  status public.commission_status NOT NULL DEFAULT 'pending',
  period_start timestamptz,
  period_end timestamptz,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizer_commissions_rate_range CHECK (
    commission_rate >= 0 AND commission_rate <= 1
  ),
  CONSTRAINT organizer_commissions_gross_nonnegative CHECK (gross_amount >= 0),
  CONSTRAINT organizer_commissions_commission_nonnegative CHECK (commission_amount >= 0),
  CONSTRAINT organizer_commissions_net_nonnegative CHECK (net_amount >= 0),
  CONSTRAINT organizer_commissions_amount_math CHECK (
    gross_amount = commission_amount + net_amount
  ),
  CONSTRAINT organizer_commissions_currency_format CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT organizer_commissions_period_order CHECK (
    period_start IS NULL OR period_end IS NULL OR period_end > period_start
  )
);
