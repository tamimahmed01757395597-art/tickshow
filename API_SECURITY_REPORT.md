# API security report

## Scope

Reviewed the browser-to-Supabase boundary, Edge Functions, database RPCs, RLS policies, storage policies and deployment metadata in this repository. This is a code and local test review; it is not a deployed penetration test.

## Endpoint controls

| Surface | Authentication / authorization | Validation | Limits | Notes |
| --- | --- | --- | --- | --- |
| `POST /functions/v1/create-checkout-session` | Supabase JWT verified with `auth.getUser`; email must exist on the account | Zod body schema: slug, quantity 1–8, name, phone | 8 KB body; 8 requests/minute/user; allow-list CORS | Price and currency come from the database via service-role RPC; browser never sends amounts. Live keys rejected. |
| `POST /functions/v1/stripe-webhook` | Stripe signature verified against raw body; `livemode` rejected | Zod schemas for session/intent fields; order UUID required | 1 MB body; 300 requests/minute/IP | Idempotency ledger, amount/currency recheck, claim released on failure. No browser origin required. |
| `POST /functions/v1/send-storefront-ticket` | Supabase JWT; owner-by-`customer_id`/buyer email or admin | Zod schema: `action`, `order_id` UUID | 4 KB body; 8 requests/10 minutes/user; allow-list CORS | Verified-paid RPC gates PDF/email work; private storage; safe public errors. |
| `create_stripe_checkout_order` | `service_role` only | Quantity, name, email, phone, event availability, inventory | Database transaction with row locks | Returns server-computed Stripe minor units. |
| `claim_payment_webhook_event`, `release_payment_webhook_event`, `finish_payment_webhook_event` | `service_role` only | Event ID/type required | Ledger `ON CONFLICT DO NOTHING` | Cannot be invoked by anon or authenticated clients. |
| `mark_stripe_order_processing`, `mark_stripe_order_paid`, `mark_stripe_order_unpaid` | `service_role` only | Amount/currency/order-state checks | State machine guards | Only path that issues paid tickets. |
| `admin_set_order_status` | `is_admin()`, not service role | Status enum; `paid` explicitly denied | Role-checked RPC; client write grants revoked | Admin cannot mint revenue from the browser. |
| `verify_ticket_by_id` | Public read helper | Token format regex and SHA-256 hash comparison | Paid-order check in `is_verified_paid_order` | Legacy demo branch removed; refunded tickets no longer verify. |
| `delete_own_account` | `auth.uid()` required | Fixed no-argument RPC | Narrow trigger exception for anonymization | Financial records retained, contact fields anonymized. |

## Database and storage

- RLS remains enabled on user-data tables. Migration `0035` additionally revokes `INSERT`, `UPDATE` and `DELETE` on `orders`, `order_items`, `payments`, `payment_webhook_events`, `ticket_inventory_reservations` and `tickets` from `anon` and `authenticated`; `SELECT` is granted back to `authenticated` and still filtered by RLS.
- Demo booking and legacy ticket RPCs are revoked from browser roles and retained only for `service_role` export/migration use.
- `ticket-files` and `ticket-design-assets` are private buckets; client access goes through role-checked functions.
- `storefront_events` public select is limited to visible records; admin writes require admin role.
- Order amounts, currency, identity and event fields are protected by `enforce_admin_order_update()`.

## Request hardening

- CORS: allow-list based on `SITE_URL` plus local Vite origins; disallowed origins get `403` and `Access-Control-Allow-Origin: null`.
- Methods: only `POST` and `OPTIONS` are accepted by the functions.
- Bodies: bounded reads before JSON parsing; oversized declared or actual bodies are rejected.
- Errors: internal details are not returned to clients. See `ERROR_HANDLING.md`.
- CSRF: Supabase JWT in the `Authorization` header plus origin allow-listing; cookie-based auth is not used by these endpoints.
- Secrets: Stripe secret/service-role keys exist only in Edge Function environment variables; no `VITE_` secret keys.

## Test evidence

`npm run db:test` (PGlite, in-memory PostgreSQL) — **140 passed, 0 failed**. New coverage includes:

- Browser roles cannot create server-priced checkout orders or claim webhook events.
- Demo booking/delivery RPCs are inaccessible to anon/authenticated roles.
- Wrong amount and wrong currency cannot mark an order paid.
- Webhook event claims are idempotent.
- Verified payment marks order paid, confirms reservation and issues exactly two tickets.
- Paid tickets verify as non-demo; refunded orders do not verify as paid.
- Expired checkout releases inventory and issues no tickets.
- Admin cannot mark an order paid or alter amounts; admin refund goes through the role-checked RPC.
- Customer status changes and direct order writes are denied.

`npx tsc --noEmit` and `npm run build` also passed.

## Residual risks and follow-up

1. In-memory rate limits are per Edge Function isolate. Add platform/WAF rate limiting for a hard global limit.
2. Live Stripe signature verification, webhook delivery, test-card checkout and Brevo delivery were not executed here; no credentials were available.
3. Confirm BDT's minor-unit exponent for the actual Stripe account before rollout.
4. No ESLint or E2E framework is configured; those checks remain unavailable rather than passed.
5. `robots.txt` and dynamic noindex reduce indexing but are not access controls; server-side role checks and RLS remain authoritative.
