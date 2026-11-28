# Demo removal report

## Objective

TickShow no longer presents a fake checkout. The browser flow now creates a real, server-priced order, redirects to Stripe **TEST MODE** Checkout, and treats a signed Stripe webhook as the only authority for paid status and ticket issuance. Existing database rows were preserved; no live cleanup or destructive delete was performed.

## What was removed

| Item | Removal / replacement |
| --- | --- |
| `src/lib/ticket.ts` | Deleted. The localStorage booking store and demo PDF/download path no longer exist. |
| `supabase/functions/send-ticket-email/index.ts` | Deleted. Legacy DEMO / TEST ticket delivery is no longer available as a client-callable function. |
| `CheckoutPage` demo submit | Replaced with authenticated `create-checkout-session` invocation and Stripe redirect. The browser sends only event slug, quantity and contact details — no price. |
| `OrderPage` demo lookup | Replaced with real `orders`/`payments` lookup plus paid-ticket resend through the secured function. |
| `AccountDashboard` demo history | Replaced with normalized order history and paid-ticket delivery state. |
| Demo PDF banners/copy, admin demo metrics and showcase demo copy | Removed from `ticket-pdf.ts`, `AdminPanel.tsx`, `src/lib/admin.ts`, `FooterPages.tsx` and `EventPage.tsx`. |
| Legacy demo RPC access | `create_storefront_booking`, `claim_storefront_ticket_email`, `finish_storefront_ticket_email`, `claim_storefront_ticket_assets`, `finish_storefront_ticket_assets`, `claim_storefront_ticket_download`, `verify_storefront_ticket_by_id` and `verify_storefront_ticket` were revoked from `PUBLIC`, `anon` and `authenticated` in migration `0035`. `service_role` access remains for controlled export/migration. |
| `admin_set_order_status('paid')` | Explicitly rejected in the database. Admin clients cannot mint paid orders. |
| Demo ticket verification | `verify_ticket_by_id` is paid-only, returns `is_demo = false`, and refunded orders no longer verify as paid. |

The remaining literal `demo` references in application code are limited to explicit rejection/help copy: the ticket verification screen labels a preserved legacy record as invalid for entry, and the ticket-design preview states that preview codes are not valid tickets.

## What was added

### Real Stripe TEST MODE checkout

- `supabase/migrations/0035_stripe_test_checkout_and_api_hardening.sql`
  - `payments.provider` column.
  - `create_stripe_checkout_order` (`service_role` only): validates event availability, reads the database price, reserves inventory and creates a pending order/payment in one transaction.
  - `claim_payment_webhook_event` / `release_payment_webhook_event` / `finish_payment_webhook_event`: idempotent provider-event ledger, `service_role` only.
  - `mark_stripe_order_processing`, `mark_stripe_order_paid`, `mark_stripe_order_unpaid`: guarded state transitions; only `mark_stripe_order_paid` issues tickets.
  - `admin_set_order_status`: role-checked admin status changes that cannot set `paid` or mutate money fields.
  - Client DML grants on financial tables revoked; `SELECT` remains available under RLS.
- `supabase/functions/create-checkout-session/index.ts`
  - Verifies the Supabase JWT, validates the body with Zod, calls the service-role pricing RPC and creates a Stripe Checkout session with `sk_test_` credentials only.
- `supabase/functions/stripe-webhook/index.ts`
  - Verifies the raw-body Stripe signature, rejects `livemode: true`, records events once, rechecks amount/currency/order state and releases claims on processing failure so Stripe can retry.
- `supabase/functions/_shared/http.ts` and `stripe-env.ts`
  - Allow-list CORS, bounded JSON bodies, per-isolate rate limits, safe JSON responses and strict server-side Stripe TEST credential checks. Missing or live credentials fail closed.
- Client helpers: `src/lib/checkout.ts`, `src/lib/payments.ts`, `src/lib/function-error.ts`.

### Complete account and payment pages

- `#/payment/confirmation`, `#/payment/processing`, `#/payment/failed`, `#/payment/cancelled`
- `#/forgot-password`, `#/reset-password`
- `#/account/delete`, `#/account/deletion-status`
- `#/error/<state>` for 400, 401, 403, 404, 409, 419, 429, 500, 502, 503 and specialized origin/token/rate-limit/payment/maintenance states. Unknown routes now render the 404 state instead of the home page.

### Deployment hygiene

- `index.html` defaults to `index,follow`; private routes switch to `noindex,nofollow,noarchive`.
- Build generates `robots.txt` (disallowing `/auth/callback` and `/supabase/`) and a root-only `sitemap.xml` from `VITE_SITE_URL`/`SITE_URL`.
- `vercel.json` rewrites unknown paths to the SPA shell and sets security headers.
- `.env.example` separates public `VITE_` values from server-only Stripe/Supabase/Brevo secrets.

## Data preservation

No broad unfiltered `DELETE`, truncation or table drop was run. No live database cleanup was performed because no linked project or service-role credentials were available. Migration `0035` is forward-only: it adds columns/functions and revokes privileges while retaining rows. Historical demo bookings and tickets remain in the database for authorized export/review, but browser roles can no longer create, finalize or verify them as entry-valid.

Account deletion retains historical `orders`, `order_items`, `payments`, `tickets` and webhook records. `delete_own_account()` anonymizes buyer contact details and ownership before removing the auth user; see `ACCOUNT_DELETION_FLOW.md`.

## Verification performed here

| Check | Result |
| --- | --- |
| `npm run db:test` | **140 passed, 0 failed** (PGlite in-memory PostgreSQL; migrations 0001–0035). Includes 18 new checkout/webhook/RPC assertions. |
| `npx tsc --noEmit` | Passed. |
| `npm run build` | Passed; Vite produced the single-file production bundle and SEO files. |
| `npm run db:bundle` | Regenerated `supabase/bootstrap.sql` from all 35 migrations. |
| Edge Function syntax parse via Vite's `esbuild` | All five function TypeScript files parsed successfully. |

## Not verified here

- Live Stripe TEST checkout, webhook signature delivery/retries, live payment capture or refunds.
- Deployed Supabase migration application, secrets, RLS behavior on the remote project.
- Brevo PDF email delivery.
- Deno type-checking: Deno is not installed in this workspace.
- ESLint and E2E tests: no configuration or runner exists in this repository.
- Production deployment; all work remains uncommitted in the local workspace.

See `STRIPE_TEST_MODE_SETUP.md` for the credentials and webhook configuration required before live TEST verification.
