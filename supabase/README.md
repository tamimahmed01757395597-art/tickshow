# TickShow — database foundation, admin authentication and event showcase

This directory contains the Supabase/PostgreSQL foundation, invite-only administrator access, the admin-managed storefront event showcase, and account-owned demo bookings. Demo bookings can issue DEMO / TEST PDF tickets, but never create paid orders or paid entry tickets.

## 1. Files created

```text
.env.example
.gitignore                              (updated to ignore real env files)
package.json                            (backend scripts, Supabase JS client, PGlite)
src/types/database.ts                   (strong TypeScript database definitions)
src/vite-env.d.ts                       (typed VITE_ environment variables)
src/lib/supabase.ts                     (publishable Supabase client)
src/lib/auth.tsx                        (customer/staff auth, recovery, profile and deletion)
src/lib/tokens.ts                       (SHA-256 hashing + invite token generation)
src/lib/admin.ts                        (admin reads and management mutations)
src/lib/storefront.ts                   (storefront showcase data from Supabase)
src/components/AdminPanel.tsx           (live, backend-connected admin panel)
src/components/AdminPanel.css           (live data UI styles)
src/App.tsx                             (customer/staff auth routes and callback pages)
src/main.tsx                            (AuthProvider)
src/components/AccountDashboard.tsx     (customer bookings, profile and account controls)
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
  0017_storefront_bookings.sql
  0018_storefront_booking_availability.sql
  0019_remove_seeded_showcase_data.sql
  0020_customer_accounts_and_bookings.sql
  0021_ticket_delivery_and_one_time_download.sql
  0022_secure_storefront_tickets.sql
  0023_link_showcase_events_to_catalog.sql
  0024_event_ticket_designs.sql
  0025_organizer_invitations.sql
  0026_admin_organizer_deletion.sql
supabase/functions/send-ticket-email/index.ts
supabase/functions/invite-organizer/index.ts
src/lib/ticket-pdf.ts                  (shared multi-ticket PDF renderer)
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
| Storefront showcase | `storefront_events`, `storefront_bookings`, `storefront_tickets` |
| Additional | `notifications`, `reviews`, `platform_settings`, `audit_logs` |

`event_staff` provides explicit per-event staff assignments. `event_lineup_items` mirrors the existing frontend lineup structure. `storefront_events` supplies the public grid, event detail pages and coverflow carousel. When an administrator creates a showcase event with an active, approved organizer, real start/end times and capacity, migration `0023` also creates a linked normalized event and one General Admission ticket type with matching price and inventory. The catalog event starts as draft/pending for moderation; editing the showcase record keeps its linked event and ticket inventory synchronized. Older showcase rows stay unlinked until those operational details are supplied. Removing a showcase row does not delete its normalized event.

The demo checkout writes to `storefront_bookings` through `create_storefront_booking`. The database reads the current visible event price and stores each booking, customer owner, and event details in one transaction. Signed-in buyers can read only their own bookings in the account dashboard; admins can review them in **Orders & tickets**. This demo flow remains separate from normalized `orders` and does not reserve or sell the new catalog inventory.

Ticket issuance is handled by the authenticated `send-ticket-email` Edge Function. It creates one cryptographically random token per ticket, stores only SHA-256 token hashes in the private `storefront_tickets` table, builds an A6 PDF with a unique QR code on each page, and stores the PDF in the private `ticket-files` bucket. Brevo receives the booking's database email, never a browser-provided recipient. Account PDF downloads use a single-use database claim and a short-lived signed URL. All generated tickets and email copy are marked DEMO / TEST and are not valid for paid entry.

Admins can select a built-in ticket style (Classic, Midnight, Festival or Neon) and optionally upload event-specific JPEG/PNG artwork in **Event showcase**. Booking creation snapshots both settings, so a later design change does not alter tickets already booked. The PDF renderer places booking details and the unique QR in fixed clear areas over the artwork; keep the A6 portrait canvas clear enough for those overlays.

The Admin panel's **Organizers** section can send invitations through the authenticated `invite-organizer` Edge Function, which stores a hashed, single-use seven-day invitation in `public.organizer_invitations` and emails the signup link through Brevo. The event editor also offers **Invite a new organizer**. Acceptance creates an organizer account in pending status; an administrator must approve and activate it before event assignment. Permanent organizer deletion is available only when there are no linked events, showcase entries, staff assignments, payouts or commissions; the owner's login account is retained. Administrator invitations are managed in **Staff & roles**.

### Important invariants

- Event status: `draft | pending | published | rejected | cancelled | completed`. Public reads require `published` + `approved` + no cancellation.
- Approval, publication and cancellation timestamps cannot be set by non-admins.
- `ticket_inventory.available_quantity` is generated as `total - reserved - sold`.
- Payment records store Stripe identifiers/status only — no card numbers or CVCs.
- Tickets store only a SHA-256-shaped `qr_token_hash`; the raw token is never stored.
- `payments.payment_intent_id`, `checkout_session_id` and webhook `event_id` are unique for idempotency.
- Admin panel updates cannot change order/payout amounts or ownership; database triggers enforce immutability.
- Payment records and refunds remain read-only to clients; only trusted server/webhook code writes them.
- Showcase edits synchronize linked catalog event details and General Admission inventory. They do not change normalized orders, payments, or the separate demo-booking checkout flow.
- Demo bookings are not payments or paid entry tickets; authenticated customers can create bookings for currently visible, upcoming or ongoing events, then receive clearly marked DEMO / TEST PDFs.
- Account deletion removes the auth account, profile, demo bookings, and other profile-cascaded data. Historical normalized orders are retained for financial integrity with customer contact details anonymized.

## 3. Customer accounts and administrator authentication

### Customer account flows

- Customer login and signup are available at `#/login` and `#/signup`. The customer pages contain no staff login or invitation controls.
- Checkout requires a signed-in account; bookings are tied to the authenticated user and shown in `#/account`.
- The account dashboard supports booking history, one-time PDF ticket downloads, email delivery status and explicit email retry, name updates, sign-out, and password-confirmed account deletion.
- `#/forgot-password` sends a Supabase recovery email. `/auth/callback` handles confirmation and recovery links and provides the password update page.
- Ticket delivery uses Brevo's transactional email API. Supabase Auth confirmation and recovery emails use Supabase's configured Auth SMTP provider; to send those through Brevo too, configure Brevo SMTP separately in **Authentication → SMTP Settings**. Brevo's documented SMTP setup requires an authenticated domain, and its SMTP credentials are separate from the transactional API key. Changing the email provider does not replace the required Auth redirect URL and Vercel callback rewrite.
- Account deletion is immediate after password reauthentication; deletion-confirmation email delivery is not implemented. Financial order records are retained but anonymized.
- Configure Supabase Auth **Site URL** and add the production `https://YOUR_DOMAIN/auth/callback` URL to **Redirect URLs**. Also allow the local callback URL when developing. Vercel rewrites `/auth/callback` to the SPA.

### Invite-only signup

1. An existing administrator opens **Staff & roles** in the admin panel and enters the invitee's email.
2. The browser generates a random 48-character token, computes its SHA-256 hash, and calls `public.create_admin_invitation`. Only the hash is stored; the raw token is shown once.
3. The invitee opens the unlinked staff route `#/staff-invite`, enters name, email, password and the raw token.
4. `supabase.auth.signUp` creates the auth user and `handle_new_user()` creates the profile.
5. `public.accept_admin_invitation` verifies the token hash, expiry and email match, marks the token used, and inserts the `admin` role assignment.
6. The browser never assigns roles directly. Self-assignment is blocked by `assign_user_role` and the `prevent_user_role_self_escalation` trigger.

If email confirmation is enabled, the account is created but the user must confirm their email before logging in. The invitation is consumed at signup, not at first login.

### Route protection

`#/admin` requires an authenticated Supabase session and the `admin` role. `#/staff-access` is not linked from customer pages, and the panel shows a clear setup, login or access-denied gate otherwise. Role state is checked through both the `SECURITY DEFINER` helper `public.has_role('admin')` and readable role tables, so an assignment made by the first-admin SQL bootstrap is visible even if one source is restricted or stale. All writes are still authorized by database RLS.

### Admin panel capabilities

| Section | Live behaviour |
| --- | --- |
| Overview | Live counts and derived analytics from authorized reads |
| Events | Approve, reject, publish, cancel, edit title/description/venue/status |
| Customers | View accounts and roles; suspend/activate; edit name/email/status |
| Organizers | Approve/reject, suspend/activate, edit profile/status |
| Orders & tickets | View demo storefront bookings and normalized orders; order amounts immutable |
| Payments | Read-only payment/webhook metadata |
| Payouts | View payouts and mark paid/in transit; amounts immutable |
| Support | Moderate reviews and edit their status/comment |
| Activity log | Read-only append-only audit trail written by triggers |
| Staff & roles | Assign/remove roles through secure functions; issue single-use admin invites |
| Event showcase | Create/edit/delete upcoming, ongoing and past event cards; toggle visibility and carousel membership; edit all display copy, images, lineup and ordering |

## 4. Row Level Security

RLS is enabled on all 29 application tables. The default is deny.

- **Anonymous**: published + approved events, approved organizers/reviews, active categories, public settings and visible storefront showcase records. Cannot create or read bookings.
- **Customers**: their own profile, orders, tickets, payments, notifications, reviews and storefront bookings. Per-ticket token hashes are not granted to client roles.
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
| `ticket-files` | No | `storefront-bookings/{booking_id}/tickets.pdf` for test PDFs; existing order paths remain supported |

The admin event editor uploads cover images to `event-images/{event_id}/{filename}`. The bucket accepts JPEG, PNG, WebP and AVIF files up to 10 MiB.

Bucket creation uses `ON CONFLICT DO NOTHING`, so existing settings are not overwritten. Migration 0012 does not run `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY`: Supabase enables that RLS by default and blocks `ALTER TABLE` on storage-owned tables for project roles. Only the RLS policies are created by the migration. Migrations 0012 and 0015 also bootstrap the `public` helper functions they need with `CREATE OR REPLACE`, so applying either on its own no longer fails with `function public.is_admin() does not exist` or `function public.set_updated_at() does not exist`. Apply migrations 0001–0026 in order.

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

Set these as Supabase Edge Function secrets (not Vercel/frontend variables):

| Secret | Purpose |
| --- | --- |
| `BREVO_API_KEY` | Brevo API key used for transactional ticket email |
| `BREVO_FROM_EMAIL` | Sender email address verified in Brevo |
| `BREVO_FROM_NAME` | Optional sender display name; defaults to `TickShow` |
| `SITE_URL` | Deployed storefront origin used for QR verification URLs and CORS |

Brevo's API sends the PDF attachment using `BREVO_FROM_EMAIL`. Add and verify the sender in Brevo before testing. Brevo may require domain authentication for some sender domains or account states; use the exact API error surfaced by the app and check Brevo transactional logs if delivery fails.

For Vercel deployments, `.env.local` is intentionally not uploaded. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Vercel Project → Settings → Environment Variables** for Production/Preview/Development, then **Redeploy**. Vite inlines these values at build time, so changing them requires a fresh deployment. Do not add `SUPABASE_SERVICE_ROLE_KEY` to Vercel or any other `VITE_` variable.

If you are applying SQL manually in the Supabase SQL editor instead of using the CLI, run `supabase/bootstrap.sql` once. It contains migrations `0001`–`0026` in order, so helper functions such as `public.is_admin()` and `public.set_updated_at()` exist before the policies and triggers that use them. Migration 0019 removes only the known seeded showcase examples and their associated demo bookings; it does not remove other event records. Running individual later files first will otherwise produce `42883: function ... does not exist` errors.

## 7. Setup and commands

```powershell
npm install
Copy-Item .env.example .env.local   # then fill the two VITE_ values
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npm run db:migrate
npm run db:types:remote
npx supabase@latest secrets set BREVO_API_KEY=YOUR_BREVO_API_KEY BREVO_FROM_EMAIL=YOUR_VERIFIED_SENDER_EMAIL BREVO_FROM_NAME=TickShow SITE_URL=https://your-site.vercel.app --remote=YOUR_PROJECT_REF
npx supabase@latest functions deploy send-ticket-email --remote=YOUR_PROJECT_REF
npx supabase@latest functions deploy invite-organizer --remote=YOUR_PROJECT_REF
npm run dev
```

You can set the same Edge Function secrets in **Supabase Dashboard → Edge Functions → Secrets** instead of using the CLI. Never put the Brevo API key in a `VITE_` variable. If you also want Supabase Auth confirmation/recovery messages sent by Brevo, configure SMTP separately in **Authentication → SMTP Settings** using host `smtp-relay.brevo.com`, port `587`, the SMTP login shown in Brevo, and a Brevo SMTP key (not the API key). Brevo's SMTP setup currently requires an authenticated domain; this is not needed for ticket delivery through the transactional API.

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

Migrations are idempotent. Migration 0019 intentionally deletes the known seeded showcase examples and their associated demo bookings; no other existing event data is targeted.

## 8. First administrator bootstrap

1. Sign up once through `#/signup` **without** an invite token (this creates a customer account).
2. In the Supabase SQL editor, run the template in `supabase/seed.sql` to assign the `admin` role to that user.
3. Use the unlinked `#/staff-access` route to sign in as the bootstrapped admin, open **Staff & roles**, and invite the remaining administrators.
4. Seed or invite organizer/staff roles the same way. Users cannot grant these roles to themselves.

## 9. Validation performed

`npm run db:test` applies migrations 0001–0026 to an in-memory PostgreSQL database (PGlite) with auth/storage shims and verifies:

- All application tables are created with RLS enabled.
- Constraints, duplicate IDs, invalid event windows and over-refunds.
- Inventory counters, one-time check-in and immutability guards.
- Public/private visibility, tenant isolation and role separation.
- Invite-only admin registration, token reuse prevention and email matching.
- Admin order/payout status updates plus audit-log writes.
- `public.has_role('admin')` returning the correct result for admin and customer sessions.
- Explicit client table/function privileges, so RLS decisions are not blocked by missing `GRANT`s.
- Storefront showcase visibility, non-admin write blocking, and admin grouping/carousel updates.
- Showcase-to-catalog event creation, draft moderation state, ticket inventory creation, and edit synchronization.
- Per-event ticket design validation and booking snapshots.
- Organizer invitation authorization, email matching, one-time acceptance and pending approval.
- Public demo booking persistence, database-priced totals, validation and private buyer details.
- Per-ticket token hashing, duplicate email suppression, single-use downloads, unique QR verification, and checked-in ticket rejection.
- Removal of the seeded showcase rows, authenticated booking ownership and account deletion/anonymization.

Latest local validation: 98 database tests passed; `npx tsc --noEmit` and `npm run build` passed. Live Supabase and Brevo delivery have not been tested.

## 10. Not included

Stripe checkout, webhook processing, real paid-ticket issuance and per-event staff check-in UI remain out of scope. The public event grid, detail pages and carousel read the admin-managed showcase; there are no bundled sample-event fallbacks. DEMO / TEST PDFs are not valid for paid event entry.
