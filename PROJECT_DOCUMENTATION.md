# TickShow — Complete Project Documentation

**A responsive event-discovery frontend with a Supabase-backed admin console, invite-only administration and an admin-managed storefront showcase**

| Document detail | Value |
|---|---|
| Project name | TickShow |
| Repository | `https://github.com/tamimahmed01757395597-art/tickshow.git` |
| Local path | `D:\maximalism_tickshow` |
| Version / release | v2.0.0 (commit `c23fb1c`, 27 Nov 2026) |
| Documentation date | 27 November 2026 |
| Application type | React single-page application with Supabase backend services |
| Primary stack | React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS 4 + Motion 14 + Supabase JS 2 |
| Backend | Supabase PostgreSQL, Auth, Storage, RLS and `SECURITY DEFINER` RPCs |
| Deployment | Vite SPA on Vercel; database/auth/storage on Supabase |
| Status | Backend-connected admin and storefront showcase are live; checkout/payments remain demo-only |

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Project identity and purpose](#2-project-identity-and-purpose)
3. [How the project was made](#3-how-the-project-was-made)
4. [Technology stack and tooling](#4-technology-stack-and-tooling)
5. [Project structure](#5-project-structure)
6. [Architecture](#6-architecture)
7. [Complete feature catalogue](#7-complete-feature-catalogue)
8. [Design system](#8-design-system)
9. [Data layer](#9-data-layer)
10. [Routing reference](#10-routing-reference)
11. [File-by-file reference](#11-file-by-file-reference)
12. [User guide / journeys](#12-user-guide--journeys)
13. [Developer guide](#13-developer-guide)
14. [Accessibility and interaction quality](#14-accessibility-and-interaction-quality)
15. [Security, RLS and operational controls](#15-security-rls-and-operational-controls)
16. [Limitations, disclaimers and known artefacts](#16-limitations-disclaimers-and-known-artefacts)
17. [Appendix](#17-appendix)

---

## 1. Executive summary

TickShow is a responsive event-discovery website for live events in **Manikganj, Dhaka**. Visitors browse upcoming events, filter by category, open full event detail pages, revisit a 3D "coverflow" lineup, and walk through a **demo** ticket checkout that issues a locally stored ticket stub with a booking reference.

The original application was a self-contained frontend preview. On **27 November 2026** it was extended with a real backend foundation:

- **Supabase PostgreSQL** with 16 idempotent migrations and 27 application tables.
- **Supabase Auth** for real sign-in/sign-up sessions.
- **Invite-only administrator registration** using single-use hashed invitation tokens.
- **Role-based admin panel** with 11 live sections for operational data and role management.
- **Admin-managed storefront showcase** for upcoming, ongoing and past event cards, plus carousel membership and ordering.
- **Row Level Security**, moderation triggers, immutable financial fields, audit logging and storage policies.
- **Vercel deployment** using public `VITE_` environment variables injected at build time.

The public storefront reads from Supabase when configured and populated, with the original built-in sample events retained as a preview fallback. The visual system remains deliberately "maximalist": near-black surfaces, a lime `#A9DD36` accent, large Manrope display type, ticket-styled panels, frosted-glass buttons, a full-bleed video hero, a scrubbing sticky-footer reveal and a draggable coverflow carousel.

The booking funnel is still a **frontend demo**: it stores orders in `localStorage`, takes no payment and does not reserve inventory. The normalized database schema is ready for a future server-side checkout and webhook implementation.

---

## 2. Project identity and purpose

### 2.1 What it is

- A **discovery front end**: concerts, sports, festivals, theatre, technology events, workshops, business summits and other experiences around Manikganj.
- A **demo booking funnel**: event detail → ticket quantity → attendee details → confirmation ticket.
- An **admin operations console**: live Supabase-backed management of events, customers, organizers, orders, payouts, reviews, roles and invitations.
- A **design showcase**: coverflow physics, scroll-linked footer reveal, glass surfaces, responsive grids and reduced-motion support.

### 2.2 Brand

- **Name:** TickShow — a play on "ticket" and "show".
- **Taglines used in the UI:** *"Don't just watch. Be there"*, *"The show is better in person."*, *"Your city. Your events. Your Moments."*
- **Mark:** a hand-drawn SVG admission-ticket outline with a dashed perforation and a T-shaped cut. "Tick" inherits the text colour; "Show" renders in lime.
- **Currency:** Bangladeshi taka, rendered as `৳` with `en-US` thousands grouping (for example `৳1,200`).

### 2.3 Scope boundary

The storefront, admin panel and authentication are now connected to Supabase. However, the following remain out of scope: Stripe checkout, webhook processing, real payment capture, inventory reservation from the browser, QR generation, customer ticket wallets and per-event staff check-in UI. Checkout and contact/support forms still explain that no payment is taken and no message is sent.

---

## 3. How the project was made

### 3.1 Frontend timeline (25–26 November 2026)

The original six commits were authored by `tamboo` (tamimahmed01757395597@gmail.com):

| # | Date | Commit | What changed |
|---|---|---|---|
| 1 | 2026-11-25 | `e30dc58` — "first commit" | Vite/React/TypeScript shell, `App.tsx`, coverflow carousel, footer pages, footer reveal, icon set, event data and design system. |
| 2 | 2026-11-25 | `147b0ee` | Added the event booking system: `Brand`, `EventPage`, `CheckoutPage`, `OrderPage`, `bookings.ts` and expanded event data. |
| 3 | 2026-11-25 | `27ea56f` | Routing and content refinements. |
| 4 | 2026-11-26 | `f1ae622` | Motion/polish pass: scroll-linked sticky footer reveal and responsive fixes. |
| 5 | 2026-11-26 | `32a1ecc` | Added `vercel.json` for Vercel deployment. |
| 6 | 2026-11-26 | `269014b` | Changed the build script to invoke Vite's binary directly for reliable CI builds. |

### 3.2 Backend and admin timeline (27 November 2026)

| # | Commit | What changed |
|---|---|---|
| 7 | `c29da0f` | Started the Supabase backend foundation: config, env template, database types, migrations `0001`–`0015`, PGlite test suite and initial auth wiring. |
| 8 | `3ae1f0a` | Completed the live admin panel, invite-only signup, role checks, showcase editor and storefront showcase integration. |
| 9 | `c23fb1c` | Deployment/backend fixes: Vercel environment-variable messaging, Supabase helper bootstrap for migration `0015` and explicit client grants. |

Later work in the working tree added migration `0016_grants_and_privileges.sql`, regenerated `supabase/bootstrap.sql`, added `scripts/build-docs-pdf.py` and updated this documentation and its PDF edition.

### 3.3 Design research phase

`DESIGN.md` documents the research step that preceded implementation:

- **Reference captured:** `https://tickify.live/` on 2026-11-24.
- **Method:** Firecrawl scrape with `markdown`, `images` and `branding` formats plus a full-page screenshot; evidence stored at `.firecrawl/design-reference.json`.
- **Extracted tokens:** lime `#A9DD36`, Manrope/Inter typography, 8 px spacing base, 22 px card radius and 12 px button radius.
- **Ethical boundary:** no Tickify logo, images, trademarks or copy were reused. TickShow uses its own ticket mark, copy and Manikganj-focused event data.
- **Theme decision:** the user requested a black main background, so the live app uses `#000000` with light text and the lime accent.

### 3.4 Notable engineering decisions

- **Hash routing instead of a router library.** `getRoute()` parses `window.location.hash`, so static hosting needs no rewrite rules.
- **Single-file production build.** `vite-plugin-singlefile` inlines CSS and JS into `dist/index.html`.
- **Publishable client only.** The browser imports `@supabase/supabase-js` with only the URL and anon key. The service-role key is never used in `VITE_` variables or frontend code.
- **Dedicated showcase table.** `public.storefront_events` owns presentation data only. The normalized `public.events` table remains the source of truth for inventory, orders and finance.
- **Secure role assignment.** Clients call `assign_user_role`, `remove_user_role`, `create_admin_invitation` and `accept_admin_invitation` RPCs; direct self-assignment is blocked.
- **Idempotent migrations.** Every migration uses `IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP ... IF EXISTS`, `ON CONFLICT DO NOTHING` or guarded seeds, so the combined `bootstrap.sql` is safe to re-run.

---

## 4. Technology stack and tooling

### 4.1 Runtime dependencies (`package.json`)

| Package | Version | Role |
|---|---|---|
| `@supabase/supabase-js` | ^2.119.2 | Browser Supabase client for Auth, Postgres reads/RPCs and Storage |
| `react` | 19.2.6 | UI component model and hooks |
| `react-dom` | 19.2.6 | DOM rendering via `createRoot` |
| `motion` | ^14.14.0 | Scroll-linked animation, springs and transforms |
| `clsx` | 2.1.1 | Conditional class composition via `cn()` |
| `tailwind-merge` | 3.4.0 | Tailwind class conflict resolution via `cn()` |

### 4.2 Development dependencies

| Package | Version | Role |
|---|---|---|
| `@electric-sql/pglite` | ^0.6.0 | In-memory PostgreSQL for migration/RLS tests |
| `vite` | 7.3.7 | Dev server and production bundler |
| `@vitejs/plugin-react` | 5.1.1 | React JSX/Fast Refresh plugin |
| `typescript` | 5.9.3 | Static type checking |
| `tailwindcss` | 4.1.17 | Utility CSS engine imported at the top of `index.css` |
| `@tailwindcss/vite` | 4.1.17 | Tailwind Vite integration |
| `vite-plugin-singlefile` | 2.3.0 | Inlines build output into one HTML file |
| `@types/node`, `@types/react`, `@types/react-dom` | 22.19.17 / 19.2.7 / 19.2.3 | Type declarations |

### 4.3 Configuration files

- **`tsconfig.json`** — ES2020 target, bundler module resolution, `jsx: react-jsx`, strict lint-style flags and the `@/* → src/*` alias.
- **`vite.config.ts`** — plugin chain `react()`, `tailwindcss()`, `viteSingleFile()`; dev/preview servers bound to all hosts with `allowedHosts: true`.
- **`index.html`** — document shell, SEO description, Google Fonts, SVG favicon and `#root` mount node.
- **`vercel.json`** — `framework: "vite"`, `buildCommand: "npm run build"`, `outputDirectory: "dist"`.
- **`.env.example`** — placeholder-only template for `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- **`.gitignore`** — ignores `.env`, `.env.*`, `dist/`, `node_modules/`, `.agents/`, `.firecrawl/` and Supabase CLI state; `.env.example` is the exception.
- **`supabase/config.toml`** — local Supabase project configuration (`project_id = "tickshow"`, Postgres 15, API 54321, DB 54322, Studio 54323); signup and email confirmations are enabled and `site_url` is `http://localhost:5173`.
- **`supabase/bootstrap.sql`** — generated concatenation of migrations `0001`–`0016` for manual SQL-editor setup.
- **`scripts/build-docs-pdf.py`** — renders `PROJECT_DOCUMENTATION.md` to PDF with Python `markdown` and `xhtml2pdf`.

### 4.4 External assets

- **Images:** event photos from `images.pexels.com` with authored alt text.
- **Hero video:** Pexels MP4 with a JPEG poster; the video is omitted under reduced motion or if it fails to load.
- **Fonts:** Google Fonts Inter and Manrope loaded in `index.html`; the PDF renderer uses a Unicode-capable local font so `৳` and em dashes embed correctly.
- **Favicon:** local `public/favicon.svg`.

---

## 5. Project structure

```text
D:\maximalism_tickshow
├── .agents/skills/unslop/           # local skill copy used during UI refinement
├── .firecrawl/                      # ignored tooling artefacts + staged PDF font
│   └── design-reference.json
├── dist/
│   ├── favicon.svg
│   └── index.html                   # ~776 KB single-file production bundle
├── public/
│   └── favicon.svg
├── scripts/
│   └── build-docs-pdf.py            # Markdown → PDF renderer
├── src/
│   ├── App.tsx                      # shell, router, sections, auth routes, showcase grouping
│   ├── index.css                    # design system and storefront styles
│   ├── main.tsx                     # React root + AuthProvider
│   ├── components/
│   │   ├── AdminPanel.tsx           # live backend-connected admin console
│   │   ├── AdminPanel.css           # admin tables, forms, gates and showcase UI
│   │   ├── Brand.tsx
│   │   ├── CheckoutPage.tsx
│   │   ├── CoverflowCarousel.tsx
│   │   ├── EventPage.tsx
│   │   ├── FooterPages.tsx
│   │   ├── FooterReveal.tsx
│   │   ├── Icon.tsx
│   │   └── OrderPage.tsx
│   ├── data/
│   │   ├── bookings.ts              # localStorage demo booking store
│   │   └── events.ts                # static preview events and category types
│   ├── lib/
│   │   ├── admin.ts                 # admin reads, mutations and showcase helpers
│   │   ├── auth.tsx                 # Supabase session/role provider
│   │   ├── storefront.ts            # showcase fetch, mapping and preview fallback
│   │   ├── supabase.ts              # publishable Supabase client + config detection
│   │   └── tokens.ts                # random invite token + SHA-256 hashing
│   ├── types/database.ts            # generated-style DB types, including showcase table
│   ├── utils/cn.ts
│   └── vite-env.d.ts
├── supabase/
│   ├── config.toml
│   ├── bootstrap.sql                # all 16 migrations combined
│   ├── build-bootstrap.mjs
│   ├── seed.sql                     # first-admin bootstrap template
│   ├── migrations/                  # 0001–0016
│   └── tests/run-tests.mjs          # PGlite validation suite
├── .env.example
├── DESIGN.md
├── PROJECT_DOCUMENTATION.md         # this document
├── PROJECT_DOCUMENTATION.pdf        # PDF edition
├── index.html
├── package.json / package-lock.json
├── tsconfig.json
├── vercel.json
└── vite.config.ts
```

---

## 6. Architecture

### 6.1 Browser component tree

```text
main.tsx (StrictMode + AuthProvider)
└── App
    ├── [route = login | signup] → AuthPage (real Supabase auth)
    ├── [route = admin]          → AdminPanel (role-gated)
    └── FooterReveal
        └── content
            ├── [home] → Header + Hero + EventsSection
            │              ├── upcoming cards from showcaseEvents
            │              ├── CategoriesSection
            │              ├── FeaturedEventsSection → CoverflowCarousel
            │              └── PromoSection
            ├── [event]   → EventPage
            ├── [checkout]→ CheckoutPage
            ├── [order]   → OrderPage
            └── [page]    → FooterPage (11 variants)
```

### 6.2 Backend layers

```text
Vercel (static Vite build)
  └── Browser
       ├── AuthProvider ────────────── Supabase Auth
       ├── useStorefrontEvents() ──── public.storefront_events (anon SELECT)
       ├── AdminPanel ─────────────── RLS-protected reads/writes + RPCs
       └── localStorage ───────────── demo bookings only

Supabase project
  ├── PostgreSQL
  │    ├── 27 application tables, RLS enabled on all
  │    ├── helper functions (SECURITY DEFINER, pinned search_path)
  │    ├── moderation, audit and immutability triggers
  │    └── admin/auth RPCs
  ├── Auth (email/password, sessions)
  └── Storage (5 buckets with path-scoped policies)
```

### 6.3 Storefront showcase data flow

```text
AdminPanel → src/lib/admin.ts → storefront_events INSERT/UPDATE/DELETE
                                      ↓ (RLS: public.is_admin())
Supabase storefront_events (visible rows)
                                      ↓ (anon SELECT)
src/lib/storefront.ts → mapRow() → StorefrontEvent[]
                                      ↓
App.tsx splits by event_group and is_carousel
                                      ↓
Event cards, detail pages and featured coverflow
```

If Supabase is not configured, the fetch fails, or the table is empty, `useStorefrontEvents()` keeps the built-in `PREVIEW_EVENTS` derived from `src/data/events.ts`. The hook exposes `events`, `source`, `loading` and `error`; `App.tsx` currently consumes `events`.

### 6.4 Auth and role flow

```text
#/signup → supabase.auth.signUp
             → handle_new_user() creates public.profiles
             → optional raw invite token hashed in browser
             → accept_admin_invitation RPC verifies hash/expiry/email
             → admin role inserted server-side

#/login → supabase.auth.signInWithPassword
             → AuthProvider.refresh()
             → public.has_role('admin') + role table reads
             → route to #/admin
```

The admin panel re-checks roles whenever it opens and exposes a **Refresh access** button on the access-denied gate. This handles first-admin bootstrap or role changes made while a session was already open.

### 6.5 Admin mutation flow

```text
AdminPanel form → src/lib/admin.ts
                    ├── events/profiles/organizers/orders/payouts/reviews updates
                    ├── showcase create/update/delete
                    └── RPCs for role assignment and invitations
                          ↓
PostgreSQL RLS + triggers
                          ↓
audit_logs append-only entries for controlled mutations
```

Amounts, ownership and approval timestamps remain immutable to client updates; triggers raise exceptions rather than silently accepting changes.

### 6.6 Demo booking flow

```text
CheckoutPage form submit
  → createBooking()
  → reference "TS-" + 6 unambiguous characters
  → localStorage["tickshow.bookings"] (max 25)
  → #/order/<reference> → OrderPage ticket stub
```

No database row is written by this flow; it is intentionally a preview.

---

## 7. Complete feature catalogue

### 7.1 Header and navigation

- Fixed header; gains a near-black blurred background after 24 px of scrolling.
- Home, Explore events and About us links with active-state underline.
- Log in / Sign up actions open real Supabase auth routes when configured.
- At ≤980 px the desktop nav is replaced by an animated mobile menu with Escape-to-close and `tabIndex` management.

### 7.2 Hero

- Full-viewport Pexels video over a poster, with two dark gradient layers.
- Eyebrow *"Manikganj, Dhaka · Live events"* and headline *"Don't just watch / Be there"*.
- Frosted **Explore events** and **How it works** CTAs.
- Reduced-motion users receive the poster only.

### 7.3 Upcoming events

- Section title *"What's happening?"* driven by `showcaseEvents` where `event_group != 'past'`.
- Four-column card grid (3/2/1 columns at smaller breakpoints).
- Category filtering with **Clear filters** and an empty-state reset.
- Cards show image, category, title, date/venue, price and a **Details** button.

### 7.4 Category filter

- Eight SVG-illustrated category tiles with `aria-pressed`.
- Selecting a tile filters the live showcase events and scrolls to the grid.

### 7.5 Featured events coverflow

- Built from Motion primitives with circular shortest-path wrapping.
- Cards use `rotateY`, `scale`, `x`, `zIndex` and opacity transforms with spring animation.
- Pointer drag, arrow buttons, pagination dots and ← / → keys all navigate.
- Dragging more than 4 px suppresses the click.
- Caption uses `aria-live="polite"`; the region and dots are labelled.
- The section is now labelled **Featured events lineup** and is driven by `is_carousel` / `carousel_order` from the showcase table, falling back to the six past preview events.

### 7.6 Promo band

Raised-surface section with a lime **Find your next event** CTA.

### 7.7 Sticky footer reveal

- `FooterReveal` wraps non-auth routes.
- A shared normalized `scrollYProgress` drives opacity, scale and blur.
- `ResizeObserver` recalculates the reveal point for all viewport sizes.
- Footer is an admission-ticket panel with notches, barcode, social links and Explore/Company/Support columns.

### 7.8 Footer information pages (11)

`#/events`, `#/upcoming`, `#/categories`, `#/about`, `#/how-it-works`, `#/contact`, `#/terms`, `#/privacy`, `#/faqs`, `#/help` and `#/support`. Contact and support forms explicitly state that nothing is sent.

### 7.9 Authentication

- Real Supabase email/password sign-in and sign-up when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured.
- Signup accepts an optional invite token; without it the account is a normal customer account.
- The browser hashes invite tokens with Web Crypto SHA-256 before calling `accept_admin_invitation`.
- A clear setup gate explains missing Vercel/local environment variables.
- Successful login routes to `#/admin`; the panel performs the authoritative role check.
- If Supabase is not configured, the page still renders with an explanatory error instead of crashing.

### 7.10 Event detail page

- Full hero image, lineup list and sticky facts sidebar.
- Upcoming events offer **Get tickets**; past events show an archive notice.
- Uses showcase presentation fields when live data is loaded.

### 7.11 Checkout (demo)

- Quantity stepper 1–8, live total, required attendee fields and sticky order summary.
- **Pay ৳X** is a demo label; no payment is taken.
- Sales-closed panel for past events.

### 7.12 Order confirmation

- Ticket stub with `TS-XXXXXX` reference and "Show this at the door" panel.
- Reopenable at `#/order/<reference>` in the same browser.

### 7.13 Booking data helpers

`MAX_TICKETS_PER_ORDER = 8`, `formatTaka()`, `makeReference()`, safe JSON parsing, newest-first persistence capped at 25 and case-insensitive reference lookup.

### 7.14 Live admin panel

Role-gated at `#/admin`. Eleven sections:

| Section | Live behaviour |
|---|---|
| Overview | Counts and derived metrics from authorized Supabase reads |
| Events | Approve/reject/publish/cancel and edit core event fields |
| Customers | View profiles and roles; suspend/activate; edit name/email/status |
| Organizers | Approve/reject, suspend/activate and edit profile/status |
| Orders & tickets | View orders and change operational status; amounts immutable |
| Payments | Read-only payment and webhook metadata |
| Payouts | View payouts and mark paid/in transit; amounts immutable |
| Support | Moderate reviews and edit status/comment |
| Activity log | Read-only audit trail written by database triggers |
| Staff & roles | Assign/remove roles through secure RPCs; issue single-use admin invites |
| Event showcase | Create/edit/delete showcase cards and control visibility, grouping and carousel order |

### 7.15 Event showcase editor

- Filters/tabs for **All**, **Upcoming**, **Ongoing**, **Past** and **Carousel**.
- Toggle visibility and carousel membership; set display and carousel order.
- Edit title, category, status label, date label/value, time, venue, location, city, price/currency, image URL/alt, about copy and lineup. Upload a cover image from the computer (JPEG, PNG, WebP or AVIF, up to 10 MB) or keep using an image URL.
- Wide modal form and table UI styled in `AdminPanel.css`.
- Seeded with 14 current showcase events by slug using `ON CONFLICT (slug) DO NOTHING`, so admin edits survive re-runs.

### 7.16 Cross-cutting features

- Dynamic document titles, reduced-motion support, responsive layouts from 360 px upward, semantic landmarks, ARIA labels/live regions and visible focus outlines.

---

## 8. Design system

All storefront tokens live in `:root` in `src/index.css`; admin-specific styling lives in `src/components/AdminPanel.css`.

### 8.1 Colour tokens

| Token | Value | Use |
|---|---|---|
| `--paper` | `#000000` | Page background |
| `--surface` | `#111111` | Cards and panels |
| `--raised` | `#1a1a1a` | Hovered/raised surfaces |
| `--ink` | `#f5f5f5` | Primary text |
| `--ink-2` | `#c3c3c3` | Secondary text |
| `--muted` | `#8c8c8c` | Meta, kickers and labels |
| `--line` / `--line-strong` | translucent white | Hairlines and borders |
| `--accent` | `#a9dd36` | Lime actions, links and active states |
| `--accent-dark` | `#85b824` | Accent hover |
| `--accent-soft` | `#d8f08f` | Hero headline and eyebrow dot |
| `--night` | `#050505` | Hero, carousel cards and ticket reference panel |

### 8.2 Typography and shape

- Body: Inter → Arial → Helvetica → sans-serif; display: Manrope → Inter → Arial.
- Hero `clamp(48px, 6.4vw, 80px)`; section headings `clamp(40px, 4.6vw, 56px)`.
- Tabular numerals on prices, counters and serials.
- Radii: 12 px controls, 22 px cards/panels, 18 px carousel cards and 24 px tickets.
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)`; most transitions 150 ms.
- Effects: gradient overlays, `backdrop-filter`, CSS masks, barcode gradients and punched ticket notches.

---

## 9. Data layer

### 9.1 Frontend preview schema

```ts
type TickShowEvent = {
  id: string; title: string; category: EventCategory;
  date: string; dateValue: string; time: string;
  venue: string; location: string; city: string;
  price: number; status: string;
  image: string; imageAlt: string; about: string;
  lineup: { name: string; role: string }[];
};
```

`src/data/events.ts` contains 8 upcoming and 6 past preview events. `src/data/bookings.ts` stores demo bookings in `localStorage["tickshow.bookings"]`.

### 9.2 Supabase schema groups

27 application tables, all with RLS enabled:

| Group | Tables |
|---|---|
| Identity / permissions | `profiles`, `roles`, `user_roles`, `admin_invitations` |
| Organizers | `organizers`, `organizer_staff`, `event_staff` |
| Events | `event_categories`, `events`, `event_lineup_items` |
| Tickets / inventory | `ticket_types`, `ticket_inventory`, `ticket_inventory_reservations` |
| Orders / payments | `orders`, `order_items`, `payments`, `payment_webhook_events` |
| Verification | `tickets`, `ticket_checkins` |
| Finance | `refunds`, `organizer_commissions`, `organizer_payouts` |
| Showcase | `storefront_events` |
| Engagement / admin | `notifications`, `reviews`, `platform_settings`, `audit_logs` |

### 9.3 Migration catalogue

| Migration | Purpose |
|---|---|
| `0001_extensions_and_enums.sql` | Enum types and extension-safe setup |
| `0002_identity_and_organizers.sql` | Profiles, roles, user roles, organizers, staff |
| `0003_events.sql` | Categories, events, lineup items, event staff |
| `0004_tickets_and_inventory.sql` | Ticket types and generated inventory counters |
| `0005_orders_and_payments.sql` | Orders, items, reservations, payments, webhook events |
| `0006_tickets_and_checkins.sql` | Ticket issuance and one-time check-ins |
| `0007_finance.sql` | Refunds, commissions and payouts |
| `0008_engagement_and_admin.sql` | Notifications, reviews, settings and audit logs |
| `0009_indexes.sql` | Performance and uniqueness indexes |
| `0010_functions_and_triggers.sql` | Security helpers, moderation guards, sync and immutability triggers |
| `0011_row_level_security.sql` | RLS enablement and policies for all tables |
| `0012_storage_buckets_and_policies.sql` | Five storage buckets and object policies; Supabase-compatible helper bootstrap |
| `0013_admin_auth_and_invitations.sql` | Signup trigger, admin invitations and secure role RPCs |
| `0014_admin_management_writes.sql` | Controlled admin order/payout updates and audit logging |
| `0015_storefront_event_showcase.sql` | Showcase table, policies, trigger, indexes and 14 seeded events |
| `0016_grants_and_privileges.sql` | Explicit table/function `GRANT`s for `anon`, `authenticated` and `service_role` |

### 9.4 Important invariants

- Public events require `published` + `approved` + no cancellation.
- Approval, publication and cancellation timestamps cannot be set by non-admins.
- `ticket_inventory.available_quantity` is generated as `total - reserved - sold`.
- Payment records contain no card numbers or CVCs; Stripe IDs are unique for idempotency.
- Tickets store only a SHA-256-shaped QR token hash.
- Admin updates cannot change order/payout amounts or ownership.
- Payments, refunds, webhook events, audit logs and role writes are not client-writable.
- Showcase edits cannot change inventory, orders or payments; they only change display data.

---

## 10. Routing reference

| Hash | Screen | Notes |
|---|---|---|
| *(none)* or `#home` | Home | Hero, live upcoming events, categories, promo, featured carousel |
| `#events`, `#categories` | Home anchors | Scroll to section |
| `#/events`, `#/upcoming` | Event listing pages | Showcase-driven grid |
| `#/categories` | Categories page | Eight category links |
| `#/about`, `#/how-it-works`, `#/contact`, `#/terms`, `#/privacy`, `#/faqs`, `#/help`, `#/support` | Info pages | Content from `INFO_PAGES` |
| `#/event/<id>` | Event detail | Resolves against the active showcase list |
| `#/checkout/<id>` | Checkout | Demo only; past events show "Sales closed" |
| `#/order/<reference>` | Confirmation | LocalStorage booking lookup |
| `#/admin` | Admin console | Authenticated `admin` role required; refreshes roles on open |
| `#/login`, `#/signup` | Auth pages | Real Supabase auth when configured |
| Anything else | Home | Safe fallback |

---

## 11. File-by-file reference

| File | Lines (approx.) | Responsibility |
|---|---:|---|
| `src/App.tsx` | 724 | Shell, hash router, sections, auth routes and showcase grouping |
| `src/index.css` | 2,693 | Storefront design system and responsive styles |
| `src/main.tsx` | 12 | React root, `AuthProvider`, global CSS |
| `src/components/AdminPanel.tsx` | 1,482 | Live role-gated console with 11 sections and gates |
| `src/components/AdminPanel.css` | 962 | Admin tables, forms, badges, modals and showcase tabs |
| `src/components/CoverflowCarousel.tsx` | 305 | Motion-driven featured-event carousel |
| `src/components/FooterReveal.tsx` | 420 | Scroll-scrubbed sticky footer reveal |
| `src/components/FooterPages.tsx` | 483 | 11 information pages and shared shell |
| `src/components/CheckoutPage.tsx` | 206 | Demo checkout form and summary |
| `src/components/EventPage.tsx` | 116 | Event detail and facts sidebar |
| `src/components/OrderPage.tsx` | 96 | Confirmation ticket stub |
| `src/components/Icon.tsx` / `Brand.tsx` | 142 / 18 | SVG icon set and brand mark |
| `src/data/events.ts` / `bookings.ts` | 371 / 73 | Preview events and localStorage booking helpers |
| `src/lib/supabase.ts` | 28 | Publishable client and config detection |
| `src/lib/auth.tsx` | 153 | Session, roles, sign-in/sign-up/sign-out |
| `src/lib/tokens.ts` | 19 | Invite token generation and SHA-256 hashing |
| `src/lib/admin.ts` | 459 | Admin reads, mutations and showcase helpers |
| `src/lib/storefront.ts` | 116 | Showcase fetch, mapping and preview fallback |
| `src/types/database.ts` | 1,195 | Strong database types |
| `src/vite-env.d.ts` | 8 | Typed `VITE_` environment variables |
| `supabase/migrations/*.sql` | 16 files | Complete schema and security foundation |
| `supabase/bootstrap.sql` | 2,421 | Generated combined migration file |
| `supabase/tests/run-tests.mjs` | 751 | PGlite validation suite |
| `supabase/build-bootstrap.mjs` | 21 | Regenerates `bootstrap.sql` |
| `supabase/seed.sql` | 6 | First-admin bootstrap template |
| `scripts/build-docs-pdf.py` | 194 | Markdown → PDF renderer |
| `DESIGN.md` | — | Design research notes |
| `PROJECT_DOCUMENTATION.md` / `.pdf` | This document | Markdown source and PDF edition |
| `dist/index.html` | ~776 KB | Single-file production bundle |

### Dormant code

The stylesheet still contains older `.tick-dialog*` modal rules from an earlier event-detail design. `cn()` is available but not used heavily, and Tailwind is imported while the UI is written mostly in custom CSS.

---

## 12. User guide / journeys

### 12.1 Discover and filter

1. Land on the home page and use **Explore events**.
2. Browse the live upcoming showcase grid.
3. Pick a category; the grid filters and scrolls into view.
4. Use **Clear filters** or **Show all events** to reset.

### 12.2 Browse the featured lineup

1. Drag the coverflow, use arrows, click a dot or press ← / →.
2. Click the centred card or **View details** to open its event page.
3. Past/archive events do not offer checkout.

### 12.3 Book a demo ticket

1. Open an upcoming event and press **Get tickets**.
2. Set quantity 1–8 and fill attendee details.
3. Press **Pay ৳X** — no payment is taken.
4. Save the `TS-XXXXXX` confirmation reference for the same browser.

### 12.4 First administrator setup

1. Sign up once at `#/signup` without an invite token.
2. Confirm the email if confirmation is enabled.
3. In Supabase SQL Editor, run the template in `supabase/seed.sql` with that user's UUID/email.
4. Sign in at `#/login`; the app routes to `#/admin` and refreshes roles.
5. If access is denied, click **Refresh access** or sign out and back in.

### 12.5 Invite another administrator

1. In `#/admin`, open **Staff & roles**.
2. Enter the invitee's email and choose a 1, 7 or 30 day expiry (the RPC default is 7 days).
3. Copy the one-time raw token shown; only its SHA-256 hash is stored.
4. The invitee signs up at `#/signup` with the same email and pastes the token.
5. The `accept_admin_invitation` RPC consumes the token and assigns the admin role.

### 12.6 Edit the storefront showcase

1. Open **Event showcase** in the admin panel.
2. Choose the upcoming, ongoing or past tab.
3. Edit display copy, dates, price, lineup and order. Upload a cover image from the computer or paste an image URL.
4. Toggle visibility or carousel membership.
5. Save; the public storefront reads the updated row on its next fetch.

---

## 13. Developer guide

### 13.1 Requirements

- Node.js with npm.
- A Supabase project for backend features.
- Supabase CLI for `npm run db:migrate` and type generation; otherwise use the SQL Editor with `supabase/bootstrap.sql`.
- Python 3 with `markdown` and `xhtml2pdf` only if regenerating the PDF (`python -m pip install markdown xhtml2pdf`).

### 13.2 Environment variables

Copy `.env.example` to `.env.local` for local development:

```powershell
Copy-Item .env.example .env.local
```

Fill only these public values:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_ANON_KEY
```

| Variable | Scope | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | client | Supabase project API URL |
| `VITE_SUPABASE_ANON_KEY` | client | Publishable key, protected by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Never prefix with `VITE_`; not used by this frontend |
| `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` | CLI | Remote project linking |
| `SUPABASE_LOCAL_DB_PORT`, `SUPABASE_LOCAL_STUDIO_PORT` | local | Supabase CLI ports |

Real credentials are not committed. `.gitignore` ignores `.env` and `.env.*` except `.env.example`.

### 13.3 Commands

```powershell
npm install
npm run dev                 # local Vite server
npm run build               # production dist/index.html
npm run preview             # preview production build

npm run db:start            # start local Supabase (requires CLI/Docker)
npm run db:migrate          # push migrations to linked project
npm run db:migrate:local    # apply migrations locally
npm run db:types:remote     # regenerate src/types/database.ts
npm run db:test             # PGlite validation suite
npm run db:bundle           # regenerate supabase/bootstrap.sql

npm run docs:pdf            # regenerate PROJECT_DOCUMENTATION.pdf
npx tsc --noEmit            # type check
```

### 13.4 Manual SQL-editor setup

If not using the Supabase CLI, run **`supabase/bootstrap.sql`** once in the SQL Editor. It applies migrations `0001`–`0016` in order, so helper functions such as `public.is_admin()` and `public.set_updated_at()` exist before policies and triggers that use them.

- Running a later migration alone used to cause `42883: function ... does not exist`; migrations `0012` and `0015` now bootstrap their own helpers.
- Migration `0012` deliberately does not run `ALTER TABLE storage.objects ...`; Supabase owns that table and enables its RLS by default.
- Migration `0016` grants explicit table/function privileges, fixing `permission denied for table profiles` when SQL-editor-applied tables do not inherit default grants.
- All migrations are idempotent and non-destructive: no `DROP TABLE` or `TRUNCATE` on application data.

### 13.5 Vercel deployment

1. Push the repository to GitHub.
2. In **Vercel Project → Settings → Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for Production/Preview/Development.
3. Redeploy. Vite inlines these values at build time, so changing them requires a fresh deployment.
4. Do not add `SUPABASE_SERVICE_ROLE_KEY` to Vercel or prefix any secret with `VITE_`.
5. Hash routing means no SPA rewrite rules are needed.

### 13.6 Verification checklist

- `npm run db:test` reports **71 passed, 0 failed**.
- `npx tsc --noEmit` passes.
- `npm run build` regenerates the single-file bundle.
- `#/login` works with a Supabase user; an admin reaches `#/admin`.
- Admin tabs load live data; showcase edits appear on the public page.
- Category filter, carousel controls and demo checkout still work.
- Vercel preview/production shows no "Backend setup" error after env vars and redeploy.

---

## 14. Accessibility and interaction quality

- **Keyboard:** all controls focusable; carousel supports ← / →; Escape closes the mobile menu; focus-visible outline is a 2 px lime ring.
- **Screen readers:** landmarks, `aria-labelledby`, `aria-current`, `aria-pressed`, `aria-expanded`, `aria-hidden`, `aria-live` and `role="status"` notices.
- **Touch:** 44 px minimum targets, `touch-action: manipulation`, `pan-y` on the carousel and safe-area padding.
- **Contrast:** light ink on near-black, lime accent for emphasis and dark gradients behind hero text.
- **Motion:** `prefers-reduced-motion: reduce` disables smooth scrolling, animations and transitions and removes the hero video.
- **Robustness:** localStorage access is wrapped in `try/catch`; unknown routes and missing entities fall back to valid pages; missing Supabase config shows an explanatory gate.

---

## 15. Security, RLS and operational controls

### 15.1 Access matrix

| Role | Access |
|---|---|
| Anonymous | Published/approved events, approved organizers/reviews, active categories, public settings and visible showcase records |
| Customer | Own profile, orders, tickets, payments, notifications and reviews |
| Organizer | Own records only and only after admin-assigned `organizer` role; cannot self-approve |
| Staff | Only events with an active `event_staff` assignment |
| Admin | Broad controlled reads/writes, full showcase management, role assignment and invitations; no self-escalation; immutable financial fields |
| Service role | Server-only, bypasses RLS, never exposed through `VITE_` |

### 15.2 Controls

- RLS is enabled on all 27 tables; the default is deny.
- Security helpers are `SECURITY DEFINER` with `SET search_path = public, pg_temp`.
- Invite tokens are random 48-character strings; only SHA-256 hashes are stored.
- `prevent_user_role_self_escalation` blocks direct admin/organizer self-assignment.
- `assign_user_role` and `remove_user_role` are the only client paths for role changes.
- Admin order/payout guards allow status changes but freeze amounts and ownership.
- Audit logs are append-only from the client's perspective.
- Storage buckets use path-scoped policies; private ticket files require order ownership.
- Migration `0016` makes PostgreSQL `GRANT`s explicit without weakening RLS.

---

## 16. Limitations, disclaimers and known artefacts

1. **Demo checkout.** No Stripe integration, real payment, webhook processing or inventory reservation is wired to the browser flow.
2. **Local-only bookings.** Orders live in `localStorage`, capped at 25; clearing browser storage removes them.
3. **First admin is manual.** One SQL bootstrap is required after the first `auth.users` row exists.
4. **No live end-to-end credentials in the repo.** Real Supabase keys are never committed; validation uses PGlite and type/build checks.
5. **Manual SQL-editor ordering matters.** Use `bootstrap.sql` rather than running later migrations individually on a fresh project.
6. **Sample showcase data.** The 14 seeded showcase records are illustrative and should be reviewed before production use.
7. **External assets.** Pexels images/video and Google Fonts require network access.
8. **Dormant code.** Older modal CSS, `cn()` and Tailwind utilities remain available but are not central to the current UI.
9. **No formal accessibility audit.** Motion and ARIA decisions are documented, but no axe/Lighthouse report is included.
10. **PDF toolchain.** Regenerating the PDF requires Python packages `markdown` and `xhtml2pdf`; the repository does not vendor them.

---

## 17. Appendix

### 17.1 Quick facts

| Item | Value |
|---|---|
| Source files (`src/`) | 23 |
| Components | 9 |
| Event categories | 8 |
| Preview events | 14 (8 upcoming + 6 past) |
| Showcase events seeded | 14 |
| Supabase tables | 27 |
| Migrations | 16 |
| Storage buckets | 5 |
| Admin sections | 11 |
| Hash route families | 10 |
| Icons | 19 |
| Max tickets per order | 8 |
| Booking storage cap | 25 |
| Database validation | 71 passed, 0 failed |
| Production bundle | ~776 KB single HTML file |
| Documentation edition | v2.0.0, 27 November 2026 |

### 17.2 Key source references

- Design research and token extraction: `DESIGN.md`, `.firecrawl/design-reference.json`
- Routing and showcase grouping: `src/App.tsx` → `getRoute()`, `useStorefrontEvents()`
- Motion carousel math: `src/components/CoverflowCarousel.tsx` → `coverflowShift()`, `useTransform()`
- Scroll reveal: `src/components/FooterReveal.tsx` → `useScroll()`, `ResizeObserver`
- Demo booking persistence: `src/data/bookings.ts`
- Supabase client: `src/lib/supabase.ts`
- Auth and role refresh: `src/lib/auth.tsx`
- Invite token hashing: `src/lib/tokens.ts`
- Admin reads/writes: `src/lib/admin.ts`
- Showcase fetch and fallback: `src/lib/storefront.ts`
- Database contract: `src/types/database.ts`
- Schema, RLS and policies: `supabase/migrations/0001`–`0016`
- Combined manual setup: `supabase/bootstrap.sql`
- Validation suite: `supabase/tests/run-tests.mjs`
- PDF renderer: `scripts/build-docs-pdf.py`

### 17.3 Document conventions

- `৳` denotes Bangladeshi taka.
- Code identifiers are shown in backticks; user-facing UI strings are shown in quotation marks.
- File paths are relative to the repository root unless stated otherwise.
- "Showcase" refers to `public.storefront_events`; "events" without qualification refers to the normalized `public.events` source of truth.

---

*End of document — TickShow project documentation, v2.0.0, generated 27 November 2026 from the source tree at commit `c23fb1c` plus the final backend-hardening working-tree changes.*
