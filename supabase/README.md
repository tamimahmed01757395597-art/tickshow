# TickShow — database foundation, admin authentication and event showcase

This directory contains the Supabase/PostgreSQL foundation, the invite-only administrator frontend connection, and the admin-managed storefront event showcase. No Stripe integration, public checkout, QR generation or customer ticket wallet has been added.

## 1. Files created

```text
.env.example
.gitignore                              (updated to ignore real env files)
package.json                            (backend scripts, Supabase JS client, PGlite)
src/types/database.ts                   (strong TypeScript database definitions)
src/vite-env.d.ts                       (typed VITE_ environment variables)
src/lib/supabase.ts                     (publishable Supabase client)
src/lib/auth.tsx                        (session, roles, sign-in/sign-up/sign-out)
src/lib/tokens.ts                       (SHA-256 hashing + invite token generation)
src/lib/admin.ts                        (admin reads and management mutations)
src/lib/storefront.ts                   (storefront showcase data + preview fallback)
src/components/AdminPanel.tsx           (live, backend-connected admin panel)
src/components/AdminPanel.css           (live data UI styles)
src/App.tsx                             (real admin login/signup page)
src/main.tsx                            (AuthProvider)
supabase/config.toml
supabase/bootstrap.sql                  (all migrations combined, for manual SQL editor setup)
supabase/build-bootstrap.mjs            (regenerates bootstrap.sql)
supabase/seed.sql                       (intentionally empty of business data)
supabase/migrations/
  0001_extensions_and_enums.sql
  0002_identity_and_organizers.sql
  0003_events.sql
  0004_tickets_and_inventory.sql
  0005_orders_and_payments.sql
  0006_tickets_and_checkins.sql
  0007_finance.sql
  0008_engagement_and_admin.sql
  0009_indexes.sql
  0010_functions_and_triggers.sql
  0011_row_level_security.sql
  0012_storage_buckets_and_policies.sql
  0013_admin_auth_and_invitations.sql
  0014_admin_management_writes.sql
  0015_storefront_event_showcase.sql
  0016_grants_and_privileges.sql
supabase/tests/run-tests.mjs
```

## 2. Schema overview

All application tables use UUID primary keys, `timestamptz` timestamps, explicit currency codes, `numeric(14,2)` money columns, check constraints, foreign keys and indexes.

| Group | Tables |
| --- | --- |
| Identity / permissions | `profiles`, `roles`, `user_roles`, `admin_invitations` |
| Organizers | `organizers`, `organizer_staff`, `event_staff` |
| Events | `event_categories`, `events`, `event_lineup_items` |
| Tickets / inventory | `ticket_types`, `ticket_inventory`, `ticket_inventory_reservations` |
| Orders / payments | `orders`, `order_items`, `payments`, `payment_webhook_events` |
| Verification | `tickets`, `ticket_checkins` |
| Finance | `refunds`, `organizer_commissions`, `organizer_payouts` |
| Storefront showcase | `storefront_events` |
| Additional | `notifications`, `reviews`, `platform_settings`, `audit_logs` |

`event_staff` provides explicit per-event staff assignments. `event_lineup_items` mirrors the existing frontend lineup structure. `storefront_events` is a separate presentation layer for the public grid, event detail pages and coverflow carousel; the normalized `events` table remains the source of truth for inventory, orders and finance.

### Important invariants

- Event status: `draft | pending | published | rejected | cancelled | completed`. Public reads require `published` + `approved` + no cancellation.
- Approval, publication and cancellation timestamps cannot be set by non-admins.
- `ticket_inventory.available_quantity` is generated as `total - reserved - sold`.
- Payment records store Stripe identifiers/status only — no card numbers or CVCs.
- Tickets store only a SHA-256-shaped `qr_token_hash`; the raw token is never stored.
- `payments.payment_intent_id`, `checkout_session_id` and webhook `event_id` are unique for idempotency.
- Admin panel updates cannot change order/payout amounts or ownership; database triggers enforce immutability.
- Payment records and refunds remain read-only to clients; only trusted server/webhook code writes them.
- Storefront showcase edits cannot change event inventory, ticket types, orders or payments; they only change display data.

## 3. Administrator authentication

### Invite-only signup

1. An existing administrator opens **Staff & roles** in the admin panel and enters the invitee's email.
2. The browser generates a random 48-character token, computes its SHA-256 hash, and calls `public.create_admin_invitation`. Only the hash is stored; the raw token is shown once.
3. The invitee opens `#/signup`, enters name, email, password and the raw token.
4. `supabase.auth.signUp` creates the auth user and `handle_new_user()` creates the profile.
5. `public.accept_admin_invitation` verifies the token hash, expiry and email match, marks the token used, and inserts the `admin` role assignment.
6. The browser never assigns roles directly. Self-assignment is blocked by `assign_user_role` and the `prevent_user_role_self_escalation` trigger.

If email confirmation is enabled, the account is created but the user must confirm their email before logging in. The invitation is consumed at signup, not at first login.

### Route protection

`#/admin` requires an authenticated Supabase session and the `admin` role. The panel shows a clear setup, login or access-denied gate otherwise. Role state is checked through both the `SECURITY DEFINER` helper `public.has_role('admin')` and readable role tables, so an assignment made by the first-admin SQL bootstrap is visible even if one source is restricted or stale. All writes are still authorized by database RLS.

### Admin panel capabilities

| Section | Live behaviour |
| --- | --- |
| Overview | Live counts and derived analytics from authorized reads |
| Events | Approve, reject, publish, cancel, edit title/description/venue/status |
| Customers | View accounts and roles; suspend/activate; edit name/email/status |
| Organizers | Approve/reject, suspend/activate, edit profile/status |
| Orders & tickets | View orders and change operational status; amounts immutable |
| Payments | Read-only payment/webhook metadata |
| Payouts | View payouts and mark paid/in transit; amounts immutable |
| Support | Moderate reviews and edit their status/comment |
| Activity log | Read-only append-only audit trail written by triggers |
| Staff & roles | Assign/remove roles through secure functions; issue single-use admin invites |
| Event showcase | Create/edit/delete upcoming, ongoing and past event cards; toggle visibility and carousel membership; edit all display copy, images, lineup and ordering |

## 4. Row Level Security

RLS is enabled on all 27 application tables. The default is deny.

- **Anonymous**: published + approved events, approved organizers/reviews, active categories, public settings and visible storefront showcase records.
- **Customers**: their own profile, orders, tickets, payments, notifications and reviews.
- **Organizers**: their own records only, and only with the admin-assigned `organizer` role. Cannot self-approve.
- **Staff**: only events with an active `event_staff` assignment.
- **Admins**: broad controlled reads/writes including full storefront showcase management, but no self-escalation and immutable financial amounts.
- **Role writes**: only `public.assign_user_role` / `public.remove_user_role`; no direct client DML.
- **Service role**: server-only, bypasses RLS, never exposed through `VITE_`.

Security helpers use `SECURITY DEFINER` with a pinned `search_path`.

## 5. Storage

| Bucket | Public read | Path convention |
| --- | --- | --- |
| `event-images` | Yes | `{event_id}/{filename}` |
| `event-gallery` | Yes | `{event_id}/{filename}` |
| `organizer-logos` | Yes | `{organizer_id}/{filename}` |
| `user-avatars` | Yes | `{user_id}/{filename}` |
| `ticket-files` | No | `{order_id}/{ticket_id}/{filename}` |

Bucket creation uses `ON CONFLICT DO NOTHING`, so existing settings are not overwritten. Migration 0012 does not run `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY`: Supabase enables that RLS by default and blocks `ALTER TABLE` on storage-owned tables for project roles. Only the RLS policies are created by the migration. Migrations 0012 and 0015 also bootstrap the `public` helper functions they need with `CREATE OR REPLACE`, so applying either on its own no longer fails with `function public.is_admin() does not exist` or `function public.set_updated_at() does not exist`. Applying migrations 0001–0016 in order remains the recommended path.

## 6. Environment variables

Copy `.env.example` to `.env.local` and fill values locally only.

| Variable | Scope | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | client | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | client | Publishable key; safe with RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Never prefix with `VITE_` |
| `SUPABASE_PROJECT_REF` / `SUPABASE_DB_PASSWORD` | CLI | Remote linking |
| `SUPABASE_LOCAL_DB_PORT` / `SUPABASE_LOCAL_STUDIO_PORT` | local | CLI ports |

Real credentials are not committed. `.gitignore` ignores `.env` and `.env.*` except `.env.example`.

For Vercel deployments, `.env.local` is intentionally not uploaded. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Vercel Project → Settings → Environment Variables** for Production/Preview/Development, then **Redeploy**. Vite inlines these values at build time, so changing them requires a fresh deployment. Do not add `SUPABASE_SERVICE_ROLE_KEY` to Vercel or any other `VITE_` variable.

If you are applying SQL manually in the Supabase SQL editor instead of using the CLI, run `supabase/bootstrap.sql` once. It contains migrations `0001`–`0016` in order, so helper functions such as `public.is_admin()` and `public.set_updated_at()` exist before the policies and triggers that use them. Running individual later files first will otherwise produce `42883: function ... does not exist` errors.

## 7. Setup and commands

```powershell
npm install
Copy-Item .env.example .env.local   # then fill the two VITE_ values
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npm run db:migrate
npm run db:types:remote
npm run dev
```

Local only:

```powershell
npx supabase start
npm run db:migrate:local
npm run db:test
```

| Command | Purpose |
| --- | --- |
| `npm run db:migrate` | Apply pending migrations to the linked project |
| `npm run db:migrate:local` | Apply pending migrations locally without reset |
| `npm run db:types:local` / `:remote` | Regenerate `src/types/database.ts` |
| `npm run db:test` | Run in-memory PostgreSQL validation suite |
| `npm run db:bundle` | Regenerate `supabase/bootstrap.sql` from all migrations |
| `npm run build` | Production frontend build |

All migrations are idempotent and non-destructive: no `DROP TABLE` or `TRUNCATE` on application data.

## 8. First administrator bootstrap

1. Sign up once through `#/signup` **without** an invite token (this creates a customer account).
2. In the Supabase SQL editor, run the template in `supabase/seed.sql` to assign the `admin` role to that user.
3. Log in at `#/login`, open **Staff & roles**, and invite the remaining administrators.
4. Seed or invite organizer/staff roles the same way. Users cannot grant these roles to themselves.

## 9. Validation performed

`npm run db:test` — **71 passed, 0 failed**. It applies migrations 0001–0016 to an in-memory PostgreSQL database (PGlite) with auth/storage shims and verifies:

- 27 tables created with RLS on all of them.
- Constraints, duplicate IDs, invalid event windows and over-refunds.
- Inventory counters, one-time check-in and immutability guards.
- Public/private visibility, tenant isolation and role separation.
- Invite-only admin registration, token reuse prevention and email matching.
- Admin order/payout status updates plus audit-log writes.
- `public.has_role('admin')` returning the correct result for admin and customer sessions.
- Explicit client table/function privileges, so RLS decisions are not blocked by missing `GRANT`s.
- Storefront showcase visibility, non-admin write blocking, and admin grouping/carousel updates.

Also passed: `npx tsc --noEmit` and `npm run build`.

## 10. Not included

Stripe checkout, webhook processing, customer ticket wallets, QR generation and per-event staff check-in UI remain out of scope. The public event grid, detail pages and carousel now read the admin-managed showcase when Supabase is configured, with the built-in sample events used as a preview fallback.
