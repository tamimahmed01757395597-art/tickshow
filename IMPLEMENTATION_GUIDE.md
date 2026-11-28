# TickShow Stripe TEST MODE implementation guide

**Prepared:** 28 November 2026  
**Scope:** Demo removal, database migration `0035`, Stripe TEST MODE checkout, signed webhooks, paid tickets, account/payment/error pages, API hardening and deployment.

> This guide describes the current local workspace. All changes are **uncommitted**. Nothing has been deployed, and live Stripe/Brevo/Supabase verification is still pending credentials.

---

## 1. What changed

| Area | Before | Now |
| --- | --- | --- |
| Checkout | Demo form, localStorage bookings, no payment | Real Stripe TEST MODE Checkout; browser sends no price |
| Pricing | Client-influenced totals | Service-role RPC reads price from the database |
| Inventory | Not reserved by checkout | Pending order reserves inventory; webhook confirms or releases it |
| Paid status | Client/admin could set paid | Only signed webhook via service-role RPC can mark paid |
| Webhooks | None | Signature verified, `livemode` rejected, event ledger idempotent |
| Tickets | DEMO / TEST PDFs from browser flow | Paid-only tickets issued by webhook; private PDF and Brevo email |
| Verification | Legacy demo QR could appear valid | Paid-only; legacy/demo records cannot verify for entry |
| Account | No reset/deletion pages | Complete forgot/reset password and account deletion flow |
| Errors | Unknown routes fell back to home | Dedicated 400/401/403/404/409/419/429/500/502/503 pages |
| SEO | No robots/sitemap hygiene | Dynamic noindex for private routes, robots.txt, generated sitemap |
| Secrets | No clear split | `.env.example` separates public `VITE_` values from server secrets |

### Key implementation files

**Added**

- `supabase/migrations/0035_stripe_test_checkout_and_api_hardening.sql`
- `supabase/functions/create-checkout-session/index.ts`
- `supabase/functions/stripe-webhook/index.ts`
- `supabase/functions/_shared/http.ts`
- `supabase/functions/_shared/stripe-env.ts`
- `src/lib/checkout.ts`
- `src/lib/payments.ts`
- `src/lib/function-error.ts`
- `src/components/PaymentResultPage.tsx`
- `src/components/ResetPasswordPage.tsx`
- `src/components/AccountDeletionPage.tsx`
- `src/components/AccountDeletionStatusPage.tsx`
- `src/components/ErrorPage.tsx`
- `.env.example`
- `DEMO_REMOVAL_REPORT.md`, `SECURITY_AUDIT.md`, `STRIPE_TEST_MODE_SETUP.md`, `ACCOUNT_DELETION_FLOW.md`, `ERROR_HANDLING.md`, `API_SECURITY_REPORT.md`

**Removed from active use**

- `src/lib/ticket.ts` — deleted; localStorage booking store removed
- `supabase/functions/send-ticket-email/index.ts` — deleted; legacy demo ticket email removed

**Modified**

- `src/App.tsx`, `CheckoutPage.tsx`, `OrderPage.tsx`, `AccountDashboard.tsx`, `AdminPanel.tsx`, `EventPage.tsx`, `FooterPages.tsx`
- `src/lib/auth.tsx`, `src/lib/admin.ts`, `src/lib/ticket-pdf.ts`, `src/types/database.ts`, `src/data/bookings.ts`, `src/index.css`
- `supabase/functions/send-storefront-ticket/index.ts`
- `supabase/tests/run-tests.mjs`, `supabase/bootstrap.sql`, `supabase/README.md`
- `index.html`, `vite.config.ts`, `vercel.json`, `package.json`, `package-lock.json`
- `PROJECT_DOCUMENTATION.md`

---

## 2. Your existing `.env`: what to do

### 2.1 What is in this workspace

The repository has:

- `.env.local` — currently contains only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- `.env.example` — the new template with all supported variable names

I did **not** read or print the values.

### 2.2 Simple rule

> Keep your existing `.env` / `.env.local`. Do **not** replace it with `.env.example`. Merge only the missing public values. Put every secret in **Supabase Edge Function secrets**, not in the frontend env file.

### 2.3 Browser / Vite values

These are public by design because Vite inlines them into the bundle:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_SITE_URL=https://your-site.vercel.app
```

- You already have the first two. Leave them unless the project changed.
- `VITE_SITE_URL` is optional, but set it before a production build so `robots.txt` and `sitemap.xml` contain your real origin.
- Never put a secret in a `VITE_` variable.

### 2.4 Server-only values — Supabase Edge Function secrets

Set these in **Supabase Dashboard → Edge Functions → Secrets** or with the Supabase CLI. Do **not** put them in `.env`, `.env.local`, Vercel, or any `VITE_` variable.

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
STRIPE_MODE=test
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SITE_URL=https://your-site.vercel.app
BREVO_API_KEY=your-brevo-api-key
BREVO_FROM_EMAIL=tickets@your-verified-domain
BREVO_FROM_NAME=TickShow
```

`STRIPE_MODE` must be exactly `test`. Live keys and `livemode: true` events are rejected by code.

### 2.5 If you literally have a separate `.env` file

Vite loads `.env` first, then `.env.local` overrides it. If both exist, keep the working values in `.env.local` and make sure neither contains service-role, Stripe secret, webhook secret or Brevo keys.

Do not rename or delete your existing file. Add `VITE_SITE_URL` only if it is missing.

---

## 3. Implement one step at a time

### Step 0 — Commit and back up

Before touching a live project:

```powershell
git status
git add -A
git commit -m "Add Stripe TEST MODE checkout and remove demo flow"
```

Take a Supabase database backup. Migration `0035` is forward-only: it preserves rows, but a backup is required before applying it to production-like data.

### Step 1 — Install dependencies

```powershell
npm install
```

`zod@3.24.2` was added for Edge Function and client validation.

### Step 2 — Confirm env key names only

```powershell
Get-Content '.env.local' | ForEach-Object {
  if ($_ -match '^\s*([A-Za-z0-9_]+)\s*=') { $matches[1] }
} | Sort-Object -Unique
```

Expected minimum output:

```text
VITE_SUPABASE_ANON_KEY
VITE_SUPABASE_URL
```

If any `SECRET`, `SERVICE_ROLE`, `sk_`, `whsec_` or `BREVO` name appears there, remove those lines from the frontend env file and set them as Supabase secrets instead.

### Step 3 — Apply the database migration

For a linked Supabase project:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npm run db:migrate
```

If your database is already at `0034`, this applies only `0035`.

For a fresh/manual setup, run `supabase/bootstrap.sql` in the Supabase SQL editor. It contains migrations `0001`–`0035` in order. Do not run later migration files first; helper functions must exist.

After migration:

```powershell
npm run db:types:remote
```

This refreshes `src/types/database.ts`.

### Step 4 — Set Edge Function secrets

Using the CLI:

```powershell
npx supabase@latest secrets set `
  SUPABASE_URL="https://your-project.supabase.co" `
  SUPABASE_ANON_KEY="YOUR_ANON_KEY" `
  SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY" `
  STRIPE_MODE=test `
  STRIPE_SECRET_KEY="sk_test_xxx" `
  STRIPE_PUBLISHABLE_KEY="pk_test_xxx" `
  STRIPE_WEBHOOK_SECRET="whsec_xxx" `
  SITE_URL="https://your-site.vercel.app" `
  BREVO_API_KEY="YOUR_BREVO_API_KEY" `
  BREVO_FROM_EMAIL="tickets@your-verified-domain" `
  BREVO_FROM_NAME="TickShow" `
  --remote=YOUR_PROJECT_REF
```

You can also enter the same names and values in the Supabase Dashboard secrets UI.

### Step 5 — Deploy the three Edge Functions

```powershell
npx supabase@latest functions deploy create-checkout-session --no-verify-jwt --remote=YOUR_PROJECT_REF
npx supabase@latest functions deploy stripe-webhook --no-verify-jwt --remote=YOUR_PROJECT_REF
npx supabase@latest functions deploy send-storefront-ticket --remote=YOUR_PROJECT_REF
```

- `create-checkout-session` verifies the Supabase JWT itself.
- `stripe-webhook` verifies the Stripe signature itself.
- `--no-verify-jwt` does not mean “no auth”; it prevents the gateway from blocking Stripe’s unsigned webhook request.

Delete old deployed functions `send-ticket-email` and `invite-organizer` from the Supabase Dashboard if they still exist.

### Step 6 — Configure the Stripe webhook

In **Stripe Dashboard → Test mode → Developers → Webhooks**, add:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook
```

Subscribe to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

Copy the endpoint signing secret into `STRIPE_WEBHOOK_SECRET` and redeploy the webhook function if you set the secret afterward.

### Step 7 — Configure Supabase Auth redirects

In Supabase Auth settings:

- Site URL: `https://your-site.vercel.app`
- Redirect URLs:
  - `https://your-site.vercel.app/auth/callback`
  - `http://localhost:5173/auth/callback` for local development

Password recovery relies on `/auth/callback` redirecting to `#/reset-password`.

### Step 8 — Deploy the frontend

In Vercel, set:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_SITE_URL=https://your-site.vercel.app
```

Then redeploy. Vite inlines these values at build time; changing them requires a fresh build.

`vercel.json` rewrites `/auth/callback` and unknown paths to `index.html` and adds security headers.

### Step 9 — Run local checks before the live test

```powershell
npm run db:test
npx tsc --noEmit
npm run build
```

Expected local result from this workspace:

- `npm run db:test`: **140 passed, 0 failed**
- `npx tsc --noEmit`: passed
- `npm run build`: passed

Deno is not installed here, so Edge Functions were syntax-parsed but not Deno type-checked. ESLint and E2E runners are not configured.

### Step 10 — Live TEST MODE smoke test

1. Sign in to TickShow.
2. Open an approved, published event with a linked catalog event and active ticket type.
3. Choose 1–8 tickets and enter contact details.
4. Confirm the redirect goes to Stripe Checkout and displays TEST MODE.
5. Pay with test card `4242 4242 4242 4242`, any future expiry, any CVC.
6. Return to `#/payment/confirmation?order=TS-...`.
7. Wait for the webhook; the page polls order state.
8. Confirm the order is paid, inventory is confirmed and tickets exist.
9. Email the tickets from the confirmation page or account dashboard.

### Step 11 — Verify database state

Use the Supabase SQL editor:

```sql
SELECT o.order_number, o.status, p.status AS payment_status,
       p.checkout_session_id, p.payment_intent_id,
       r.status AS reservation_status,
       (SELECT count(*) FROM tickets t WHERE t.order_id = o.id) AS ticket_count
FROM orders o
JOIN payments p ON p.order_id = o.id
JOIN ticket_inventory_reservations r ON r.order_id = o.id
WHERE o.order_number = 'TS-XXXXXX';

SELECT event_id, event_type, processed_at, error
FROM payment_webhook_events
ORDER BY created_at DESC
LIMIT 10;
```

Expected after success:

```text
order status        = paid
payment status      = succeeded
reservation status  = confirmed
ticket count        = number of tickets purchased
webhook processed_at is not null
```

### Step 12 — Test failure, cancellation and refund

- Cancel at Stripe Checkout: expect `#/payment/cancelled`, order expired/cancelled, no tickets.
- Use a declining test card: expect `#/payment/failed`, no tickets.
- Refund from Stripe Test mode and confirm the order no longer verifies as paid.
- Admin status changes must use `admin_set_order_status`; setting `paid` from the client is rejected.

### Step 13 — Test account flows

- `#/forgot-password` → recovery email → `#/reset-password`.
- `#/account/delete` → enter password and `DELETE MY ACCOUNT`.
- Confirm the auth user/profile are removed, historical orders remain, and buyer contact fields are anonymized.

### Step 14 — Confirm SEO and public navigation

- Public header has no admin link.
- Private routes (`admin`, `account`, `checkout`, `order`, `payment`, `ticket`, `error`, auth/recovery) set `noindex,nofollow,noarchive`.
- `robots.txt` disallows `/auth/callback` and `/supabase/`.
- `sitemap.xml` lists the public root when `VITE_SITE_URL` is set.

---

## 4. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `Payments are not configured` | Missing Stripe/Supabase secrets or `STRIPE_MODE` not `test` | Check Edge Function secrets and redeploy |
| `Origin is not allowed` | `SITE_URL` does not match the browser origin | Set `SITE_URL` and `VITE_SITE_URL` to the exact origin |
| `The Stripe signature is invalid` | Wrong `STRIPE_WEBHOOK_SECRET` or webhook sent to wrong endpoint | Copy the Test-mode signing secret; redeploy function |
| Order stays `pending` | Webhook not delivered, claim failed, or amount/currency mismatch | Check Stripe webhook logs and `payment_webhook_events` |
| No tickets after paid | `mark_stripe_order_paid` did not complete | Check webhook logs; failed events release the claim for retry |
| RLS / permission error | Wrong anon key or user not signed in | Confirm `VITE_SUPABASE_ANON_KEY` and sign-in state |
| Amount looks wrong | Currency minor-unit mismatch | Verify BDT exponent for your Stripe account before rollout |

---

## 5. What is already verified vs still pending

| Check | Status |
| --- | --- |
| Database migration logic and RPC permissions | Passed locally: 140/140 PGlite tests |
| TypeScript | Passed locally |
| Production build | Passed locally |
| Edge Function syntax parse | Passed locally |
| Applied migration on remote Supabase | Pending |
| Live Stripe TEST checkout and webhook delivery | Pending |
| Brevo ticket email delivery | Pending |
| Deno type-check | Unavailable: Deno not installed |
| ESLint / E2E | Unavailable: no configuration |
| Production deployment | Pending; changes are uncommitted |

---

## 6. Rollback and safety notes

- Do not run destructive SQL cleanup. Historical demo rows were intentionally preserved.
- Migration `0035` has no down migration. Rollback means restoring from a backup.
- Signed webhook failures return non-2xx so Stripe retries; event claims are released on processing failure.
- Never use live Stripe keys in this implementation. The functions reject `sk_live_` and `pk_live_`.
- Never add service-role, Stripe secret, webhook secret or Brevo keys to `.env`, `.env.local`, Vercel or any `VITE_` variable.
