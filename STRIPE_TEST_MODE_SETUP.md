# Stripe TEST MODE setup

TickShow accepts **Stripe TEST MODE only**. The Edge Functions reject live keys and live webhook events before doing any work.

## 1. Required environment variables

Copy `.env.example` and fill the values in the appropriate place.

Browser-only (public by design):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_SITE_URL=https://your-site.vercel.app
```

Edge Function secrets (server-only; never prefix these with `VITE_`):

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
STRIPE_MODE=test
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SITE_URL=https://your-site.vercel.app
BREVO_API_KEY=...
BREVO_FROM_EMAIL=tickets@your-verified-domain
BREVO_FROM_NAME=TickShow
```

`SITE_URL` must be the exact public origin used by `create-checkout-session` for Stripe return URLs and by ticket QR links. CORS accepts that origin plus the local Vite origins.

## 2. Set the secrets on Supabase

With the Supabase CLI available in your deployment environment:

```bash
supabase secrets set \
  SUPABASE_URL="$SUPABASE_URL" \
  SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" \
  SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  STRIPE_MODE=test \
  STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY" \
  STRIPE_PUBLISHABLE_KEY="$STRIPE_PUBLISHABLE_KEY" \
  STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET" \
  SITE_URL="$SITE_URL" \
  BREVO_API_KEY="$BREVO_API_KEY" \
  BREVO_FROM_EMAIL="$BREVO_FROM_EMAIL" \
  BREVO_FROM_NAME="TickShow"
```

Apply the database migration before enabling checkout:

```bash
supabase db push
# or, for a manual SQL-editor deployment, run supabase/bootstrap.sql (now includes 0035)
```

Deploy the functions:

```bash
supabase functions deploy create-checkout-session --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy send-storefront-ticket
```

`create-checkout-session` verifies the caller's Supabase JWT itself. `stripe-webhook` verifies the Stripe signature itself. Neither should rely on a gateway-level bypass for authorization.

## 3. Configure the Stripe webhook

In Stripe **Test mode**, add an endpoint:

```text
https://<project-ref>.supabase.co/functions/v1/stripe-webhook
```

Subscribe to these events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

Copy the endpoint's signing secret into `STRIPE_WEBHOOK_SECRET`. The webhook handler:

1. Verifies `Stripe-Signature` against the raw request body.
2. Rejects `livemode: true`.
3. Records the event once in `payment_webhook_events`.
4. Rechecks amount, currency and order state in the database.
5. Marks the order paid only through `mark_stripe_order_paid`, which also confirms inventory and issues tickets.
6. Releases the ledger claim on failure so Stripe can retry.

A non-2xx response is intentional on processing failures: it asks Stripe to retry.

## 4. Test the flow

Use a Stripe test card such as `4242 4242 4242 4242`, any future expiry and any CVC. Do **not** use a real card.

1. Sign in and open an event with a visible, linked catalog record and active ticket type.
2. Enter quantity and contact details. The browser never sends a price.
3. `create-checkout-session` creates a pending order, server-priced line item and inventory reservation, then redirects to Stripe Checkout.
4. Pay with the test card.
5. Stripe redirects to `/#/payment/confirmation?order=...`; the page polls the database while the webhook is pending.
6. Verify the order is `paid`, the payment is `succeeded`, the reservation is `confirmed`, and tickets exist.
7. Email tickets from the confirmation page or account dashboard.

## 5. Currency check before rollout

The server converts database currency units with `round(total_amount * 100)`. Stripe documentation indicates BDT uses 100 minor units, but confirm this for the specific Stripe account and adjust the conversion in `0035_stripe_test_checkout_and_api_hardening.sql` and `create-checkout-session/index.ts` if Stripe reports a different exponent for your account.

## 6. Verification status in this workspace

- Database migration logic, RPC roles, amount checks, idempotency and state transitions: **140/140 PGlite tests passed** (`npm run db:test`).
- TypeScript: `npx tsc --noEmit` passed.
- Production build: `npm run build` passed.
- Live Stripe checkout, live webhook delivery, Brevo email delivery and deployed Supabase secrets: **not tested** because no credentials or dashboard access were available in this workspace.

No live keys should ever be added to `.env.local` or to any `VITE_` variable.
