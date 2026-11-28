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
  0027_remove_organizer_subsystem.sql
  0028_backfill_existing_customer_profiles.sql
  0029_admin_customer_directory.sql
  0030_repair_showcase_catalog_links.sql
  0031_admin_event_directory.sql
  0032_customer_support_messages.sql
  0033_custom_ticket_designs_and_paid_delivery.sql
supabase/functions/send-ticket-email/index.ts
  supabase/functions/send-storefront-ticket/index.ts
  src/components/TicketDesignSection.tsx
src/lib/ticket-pdf.ts                  (shared multi-ticket PDF renderer)
supabase/tests/run-tests.mjs
```

## 2. Schema overview

All application tables use UUID primary keys, `timestamptz` timestamps, explicit currency codes, `numeric(14,2)` money columns, check constraints, foreign keys and indexes.

| Group | Tables |
| --- | --- |
| Identity / permissions | `profiles`, `roles`, `user_roles`, `admin_invitations` |
| Staff assignments | `event_staff` |
| Events | `event_categories`, `events`, `event_lineup_items` |
| Tickets / inventory | `ticket_types`, `ticket_inventory`, `ticket_inventory_reservations` |
| Orders / payments | `orders`, `order_items`, `payments`, `payment_webhook_events` |
| Verification | `tickets`, `ticket_checkins` |
| Finance | `refunds` |
| Storefront showcase | `storefront_events`, `storefront_bookings`, `storefront_tickets` |
| Additional | `notifications`, `reviews`, `platform_settings`, `audit_logs` |

`event_staff` provides explicit per-event staff assignments. `event_lineup_items` mirrors the existing frontend lineup structure. `storefront_events` supplies the public grid, event detail pages and coverflow carousel. An administrator enters the organizer name as plain text in the event editor; with start/end times and capacity, the showcase record creates a linked draft/pending catalog event and General Admission inventory. Editing the showcase record keeps its linked event and ticket inventory synchronized. Older showcase rows stay unlinked until those operational details are supplied. Removing a showcase row does not delete its normalized event.

The demo checkout writes to `storefront_bookings` through `create_storefront_booking`. The database reads the current visible event price and stores each booking, customer owner, and event details in one transaction. Signed-in buyers can read only their own bookings in the account dashboard; admins can review them in **Orders & tickets**. This demo flow remains separate from normalized `orders` and does not reserve or sell the new catalog inventory.

Demo ticket delivery is handled by the authenticated `send-ticket-email` Edge Function. It creates one cryptographically random token per demo ticket, stores only SHA-256 token hashes in the private `storefront_tickets` table, builds an A6 PDF with a unique QR code on each page, and stores it in the private `ticket-files` bucket. Brevo receives the booking's database email, never a browser-provided recipient. Demo tickets are explicitly marked DEMO / TEST and cannot verify as paid entry. Demo checkout does not email a ticket automatically.

Admins can edit per-event ticket designs in **Ticket design**, including colors, artwork, text, visibility, alignment and QR placement. Designs are structured JSON on the event records; uploaded JPEG/PNG files live in the private `ticket-design-assets` bucket. Demo bookings snapshot the selected design at booking time. The shared A6 renderer uses the same design for browser downloads and Edge Function PDFs.

The authenticated `send-storefront-ticket` Edge Function only issues tickets when an order is already marked paid and has a verified, successful, unrefunded payment covering its total. Ticket issuance and email sending use database claims so concurrent requests do not create duplicate tickets or email simultaneously; email status is recorded for retry. This repository has no payment provider integration or webhook, so this function is not automatically called after checkout. Do not mark an order/payment verified manually to simulate a real payment.

Migration `0027` removes organizer accounts, organizer invitations, organizer staff, and payout/commission history. Existing organizer names are retained on event and showcase rows as plain text. Event create/update/delete permissions are administrator-only; `event_staff` remains for event-level operational assignments. Administrator invitations remain in **Staff & roles**.

Migration `0028` creates missing `profiles` rows for Auth users who signed up before the profile trigger was installed. Existing profile data is not overwritten, and the original Auth signup date is retained for backfilled accounts.

Migration `0029` makes the admin Customers directory repair any missing profile rows when it loads. Its database function is restricted to administrators and reads Auth account details without exposing `auth.users` to the browser.

Migration `0030` links complete but previously unlinked showcase records to the catalog. In **Event showcase**, records still marked **Showcase only** can be linked with the **Link to Events** action after entering the organizer name, valid start/end date and time, and ticket capacity.

Migration `0031` provides the admin Events page with an administrator-only catalog read function, so event rows are not silently hidden by stale or incomplete SELECT policies.

Migration `0032` stores Contact and Booking support form submissions in a private admin inbox. Visitors can submit messages but cannot read them; administrators can review and update their status in **Support**. This inbox does not send email notifications.

### Important invariants

- Event status: `draft | pending | published | rejected | cancelled | completed`. Public reads require `published` + `approved` + no cancellation.
- Approval, publication and cancellation timestamps cannot be set by non-admins.
- `ticket_inventory.available_quantity` is generated as `total - reserved - sold`.
- Payment records store Stripe identifiers/status only — no card numbers or CVCs.
- Tickets store only a SHA-256-shaped `qr_token_hash`; the raw token is never stored.
- `payments.payment_intent_id`, `checkout_session_id` and webhook `event_id` are unique for idempotency.
- Admin panel updates cannot change order amounts or ownership; database triggers enforce immutability.
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
- Ticket delivery uses Brevo's transactional email API. Supabase Auth confirmation and recovery emails use Supabase's configured Auth SMTP provider; changing the ticket email provider does not change Auth SMTP or the required Auth redirect URL and Vercel callback rewrite.
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
| Events | Create from the showcase editor; approve/reject, publish, cancel and edit event details; event writes are admin-only |
| Customers | View accounts and roles; suspend/activate; edit name/email/status |
| Orders & tickets | View demo storefront bookings and normalized orders; order amounts immutable |
| Payments | Read-only payment/webhook metadata |
| Support | Moderate reviews and edit their status/comment |
| Activity log | Read-only append-only audit trail written by triggers |
| Staff & roles | Assign/remove roles through secure functions; issue single-use admin invites |
| Event showcase | Create/edit/delete upcoming, ongoing and past event cards; toggle visibility and carousel membership; edit all display copy, images, lineup and ordering |

## 4. Row Level Security

RLS is enabled on all 25 application tables. The default is deny.

- **Anonymous**: published + approved events, approved reviews, active categories, public settings and visible storefront showcase records. Cannot create or read bookings.
- **Customers**: their own profile, orders, tickets, payments, notifications, reviews and storefront bookings. Per-ticket token hashes are not granted to client roles.
- **Staff**: only events with an active `event_staff` assignment.
- **Admins**: create, update and delete events, manage the storefront showcase and roles, but cannot self-escalate or alter immutable financial amounts.
- **Role writes**: only `public.assign_user_role` / `public.remove_user_role`; no direct client DML.
- **Service role**: server-only, bypasses RLS, never exposed through `VITE_`.

Security helpers use `SECURITY DEFINER` with a pinned `search_path`.

## 5. Storage

| Bucket | Public read | Path convention |
| --- | --- | --- |
| `event-images` | Yes | `{event_id}/{filename}` |
| `event-gallery` | Yes | `{event_id}/{filename}` |
| `user-avatars` | Yes | `{user_id}/{filename}` |
| `ticket-files` | No | `storefront-bookings/{booking_id}/tickets.pdf` for test PDFs; existing order paths remain supported |
| `ticket-design-assets` | No | `{storefront_event_id}/{logo|background}/{random_filename}` |

The admin event editor uploads cover images to `event-images/{event_id}/{filename}`. The bucket accepts JPEG, PNG, WebP and AVIF files up to 10 MiB.

`ticket-design-assets` is private and its storage policies permit only admins to read, upload, update or delete files under an existing showcase-event UUID. Bucket creation uses `ON CONFLICT DO NOTHING`, so existing settings are not overwritten. Migration 0012 does not run `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY`: Supabase enables that RLS by default and blocks `ALTER TABLE` on storage-owned tables for project roles. Only the RLS policies are created by the migration. Apply migrations 0001–0033 in order. Before applying 0027, use the Supabase Storage Dashboard to remove organizer logo objects and delete the now-empty `organizer-logos` bucket; the migration checks that the managed bucket is already gone.

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

Brevo sends PDF attachments using `BREVO_FROM_EMAIL`. Verify the sender in Brevo before testing.

For Vercel deployments, `.env.local` is intentionally not uploaded. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Vercel Project → Settings → Environment Variables** for Production/Preview/Development, then **Redeploy**. Vite inlines these values at build time, so changing them requires a fresh deployment. Do not add `SUPABASE_SERVICE_ROLE_KEY` to Vercel or any other `VITE_` variable.

If you are applying SQL manually in the Supabase SQL editor instead of using the CLI, run `supabase/bootstrap.sql` once. It contains migrations `0001`–`0033` in order, so helper functions such as `public.is_admin()` and `public.set_updated_at()` exist before the policies and triggers that use them. Migration 0019 removes only the known seeded showcase examples and their associated demo bookings; migration 0027 permanently removes organizer payout/commission history and organizer account data. Running individual later files first will otherwise produce `42883: function ... does not exist` errors.

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
npx supabase@latest functions deploy send-storefront-ticket --remote=YOUR_PROJECT_REF
npm run dev
```

You can set the same Edge Function secrets in **Supabase Dashboard → Edge Functions → Secrets** instead of using the CLI. Never put the Brevo API key in a `VITE_` variable.

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

Most migrations use guarded DDL; apply each migration once in order. Migration 0019 deletes only the known seeded showcase examples and associated demo bookings. Migration 0027 is an intentional, irreversible cleanup that permanently deletes organizer payout/commission history; take a database backup before applying it.

Apply migration `0028` after `0027` to backfill customer profiles for existing Auth users, `0029` to enable the self-repairing admin Customers directory, `0030` to repair complete showcase-to-catalog links, `0031` to enable the admin Events catalog read function, and `0032` to enable real Contact and Booking support submissions. After applying these migrations, redeploy the frontend and delete the previously deployed `invite-organizer` Edge Function from the Supabase Dashboard. Migration 0027 intentionally aborts if the `organizer-logos` bucket still exists, because Storage buckets must be removed through the Storage API/dashboard rather than SQL.

## 8. First administrator bootstrap

1. Sign up once through `#/signup` **without** an invite token (this creates a customer account).
2. In the Supabase SQL editor, run the template in `supabase/seed.sql` to assign the `admin` role to that user.
3. Use the unlinked `#/staff-access` route to sign in as the bootstrapped admin, open **Staff & roles**, and invite the remaining administrators.
4. Assign the `staff` role only to trusted staff who need event-level access. Users cannot grant roles to themselves.

## 9. Validation performed

`npm run db:test` applies migrations 0001–0033 to an in-memory PostgreSQL database (PGlite) with auth/storage shims and verifies:

- All application tables are created with RLS enabled.
- Constraints, duplicate IDs, invalid event windows and over-refunds.
- Inventory counters, one-time check-in and immutability guards.
- Public/private visibility, tenant isolation and role separation.
- Invite-only admin registration, token reuse prevention and email matching.
- Admin order status updates plus audit-log writes.
- `public.has_role('admin')` returning the correct result for admin and customer sessions.
- Explicit client table/function privileges, so RLS decisions are not blocked by missing `GRANT`s.
- Storefront showcase visibility, non-admin write blocking, and admin grouping/carousel updates.
- Showcase-to-catalog event creation, draft moderation state, ticket inventory creation, and edit synchronization.
- Per-event ticket design validation and booking snapshots.
- Removal of organizer tables and IDs, plus administrator-only event writes.
- Public demo booking persistence, database-priced totals, validation and private buyer details.
- Per-ticket token hashing, duplicate email suppression, single-use downloads, unique QR verification, and checked-in ticket rejection.
- Removal of the seeded showcase rows, authenticated booking ownership and account deletion/anonymization.

Latest local validation: 121 database tests passed; `npx tsc --noEmit` and `npm run build` passed. Generated PDFs were checked with multiple designs, artwork and unique per-ticket QR payloads. Live Supabase storage, Brevo delivery and payment-provider integration have not been tested.

## 10. Not included

Stripe checkout, webhook processing, real paid-ticket issuance and per-event staff check-in UI remain out of scope. The public event grid, detail pages and carousel read the admin-managed showcase; there are no bundled sample-event fallbacks. DEMO / TEST PDFs are not valid for paid event entry.
