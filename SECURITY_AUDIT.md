# Security audit

## Summary

TickShow no longer contains a demo payment flow. Purchases are created server-side through a Supabase service-role RPC, priced from the database, paid through Stripe TEST MODE, and finalized only by a signed webhook. Browser roles cannot write order money fields, finalize paid state, or call webhook ledger functions. Private storage and account/admin surfaces remain protected by RLS and server-side role checks.

## Findings and remediation

| Area | Previous risk | Current control | Status |
| --- | --- | --- | --- |
| Demo payments | Fake checkout and DB writes could be mistaken for purchases | Removed demo checkout, fake bookings and localStorage store; real Stripe TEST Checkout only | Implemented |
| Browser-set prices | Client could influence totals | `create_stripe_checkout_order` reads price/currency from the database; browser sends no amount | Implemented |
| Paid-status forgery | Client/admin could mark orders paid | `admin_set_order_status` rejects `paid`; only `mark_stripe_order_paid` sets it, service-role only | Implemented |
| Webhook spoofing | Unsigned events could change order state | Raw-body `Stripe-Signature` verification, `livemode` rejection, event ledger idempotency | Implemented in code; live delivery untested |
| Amount mismatch | Provider event could disagree with stored order | `mark_stripe_order_paid` rechecks minor units and currency | Implemented |
| Order immutability | Money/identity fields writable from admin client | Client write grants revoked; trigger exception limited to status timestamps or exact account anonymization | Implemented |
| Demo ticket verification | Legacy demo QR reported as valid | `verify_ticket_by_id` paid-only; legacy verification RPCs revoked from browser roles; PDF DEMO banner removed | Implemented |
| Account deletion | Destructive unfiltered deletes possible | `delete_own_account()` uses auth.uid and exact anonymization; financial rows retained | Implemented |
| Admin exposure | Admin links/routes discoverable by role guessing | No public nav links; client gate plus server role checks; non-admin admin route goes to 403 | Implemented |
| Private storage | Ticket PDFs/design artwork could be enumerated | Private buckets; service-role and role-checked RPC access only | Implemented |
| API validation | Unbounded/untyped request bodies | Zod schemas, bounded JSON, method/origin checks and rate limits on all functions | Implemented |
| Error leakage | Internal error strings returned to browser | Safe mapping to public statuses/messages; fallback in client error helper | Implemented |
| SEO leakage | Private routes indexable | Dynamic noindex meta, robots.txt disallows, build-generated sitemap | Implemented |
| Secrets | Risk of secret keys in `VITE_` variables | `.env.example` separates browser values from server secrets; functions reject missing/live keys | Implemented |

## Secrets policy

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY` are server-only.
- Only `pk_test_...` may be returned to the browser, and the current client does not need it for Checkout redirects.
- `STRIPE_MODE` must be exactly `test`; `sk_live_` and `pk_live_` are rejected.
- Missing credentials fail closed with 503-style errors; there is no mock fallback.

## Data preservation

No destructive cleanup was executed against a live database. No broad unfiltered `DELETE` was run. The cleanup migration is forward-only and additive: it revokes privileges and replaces functions while preserving existing rows. Historical demo records remain readable only to authorized service/admin tooling and can never verify as entry-valid.

## Verification performed in this workspace

- `npm run db:test`: **140 passed, 0 failed** (PGlite in-memory PostgreSQL, migrations 0001–0035).
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- `npm run db:bundle`: regenerated `supabase/bootstrap.sql` from 35 migrations.

## Not verified here

- Deployed Supabase project state or applied migrations.
- Live Stripe TEST checkout, webhook endpoint signature and retry behavior.
- Brevo ticket email delivery.
- ESLint and E2E tests: no configuration exists.
- Deno function type-checking: Deno is not installed in this workspace.
- Production deployment; all changes are uncommitted in the local workspace.

## Recommended deployment checks

1. Apply migrations to a staging database from a backup and re-run `npm run db:test`.
2. Set Edge secrets and deploy the three functions.
3. Configure the Stripe Test webhook and send a test event; confirm the ledger row becomes processed.
4. Run a real TEST-mode checkout with `4242 4242 4242 4242` and confirm paid order, tickets and private PDF email.
5. Confirm BDT minor-unit handling for the Stripe account.
6. Verify robots/sitemap output with a valid `VITE_SITE_URL` build.
