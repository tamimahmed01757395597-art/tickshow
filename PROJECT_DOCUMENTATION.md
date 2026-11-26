# TickShow — Complete Project Documentation

**A frontend event-discovery and demo ticketing application for Manikganj, Dhaka**

| Document detail | Value |
|---|---|
| Project name | TickShow |
| Repository | `https://github.com/tamimahmed01757395597-art/tickshow.git` |
| Local path | `D:\maximalism_tickshow` |
| Version / release | v1.0.0 (commit `269014b`, 26 Nov 2026) |
| Documentation date | 26 November 2026 |
| Application type | Single-page application (SPA), static, client-side only |
| Primary stack | React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS 4 + Motion 14 |
| Deployment | Vercel (static build from `dist/`) |
| Status | Frontend preview — no backend, no real payments, no real accounts |

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
15. [Limitations, disclaimers and known artefacts](#15-limitations-disclaimers-and-known-artefacts)
16. [Appendix](#16-appendix)

---

## 1. Executive summary

TickShow is a polished, responsive event-discovery website for live events in **Manikganj, Dhaka**. It lets a visitor browse upcoming events, filter them by category, revisit a 3D "coverflow" archive of past events, open a full event detail page, and walk through a **demo** ticket checkout that issues a locally stored ticket stub with a booking reference.

Everything runs in the browser. There is no server, database, authentication provider or payment gateway. Event listings and lineup data are hand-authored sample content. Checkout intentionally stops before any payment: it writes the order to `localStorage` and shows a printable-style confirmation ticket. Auth forms and contact forms explicitly say that nothing is sent.

The visual system is a deliberately "maximalist" dark theme: near-black surfaces, a lime `#A9DD36` accent, large Manrope display type, ticket-styled panels, frosted-glass buttons, a full-bleed video hero, a scrubbing sticky-footer reveal, and a draggable coverflow carousel. The design language was informed by a captured reference site (Tickify) but all copy, branding and events in the app are original to TickShow.

The project was built in six commits over 25–26 November 2026, from an initial Vite/React shell through the event system, booking flow, motion polish, and Vercel deployment configuration.

---

## 2. Project identity and purpose

### 2.1 What it is

- A **discovery front end**: one place to see concerts, sports, festivals, theatre, technology events, workshops, business summits and other experiences around Manikganj.
- A **demo booking funnel**: event detail → ticket quantity → attendee details → confirmation ticket.
- A **design showcase**: heavy on interaction detail (coverflow physics, scroll-linked footer reveal, glass surfaces, responsive grids, reduced-motion support).

### 2.2 Brand

- **Name:** TickShow — a play on "ticket" and "show".
- **Taglines used in the UI:** *"Don't just watch. Be there"*, *"The show is better in person."*, *"Your city. Your events. Your Moments."*
- **Mark:** a hand-drawn SVG admission-ticket outline with a dashed perforation and a T-shaped cut, drawn in CSS/SVG rather than shipped as an image. The wordmark renders "Tick" in the inherited colour and "Show" in lime.
- **Currency:** Bangladeshi taka, rendered as `৳` with `en-US` thousands grouping (e.g. `৳1,200`).

### 2.3 Scope boundary

This is explicitly a **frontend preview**. Multiple screens carry disclaimers to that effect: the auth notice, the event-detail note, the checkout note, the order note, the contact/support form notice, the Terms page and the Privacy page. No account data, contact message or payment is transmitted anywhere.

---

## 3. How the project was made

### 3.1 Development timeline

The repository has six commits, authored by `tamboo` (tamimahmed01757395597@gmail.com):

| # | Date | Commit | What changed |
|---|---|---|---|
| 1 | 2026-11-25 | `e30dc58` — "first commit" | Initial application: Vite/React/TypeScript setup, `App.tsx` (665 lines), coverflow carousel, footer pages, footer reveal, icon set, event data, 2,118 lines of CSS, design reference doc. |
| 2 | 2026-11-25 | `147b0ee` — "2nd commit …" | Added the **event booking system**: `Brand`, `EventPage`, `CheckoutPage`, `OrderPage`, `bookings.ts`; expanded event data from 167 to ~440 lines; added favicon and updated `index.html`; App routing extended to event/checkout/order. |
| 3 | 2026-11-25 | `27ea56f` — "3rd commit …" | Refined routing and content: simplified `App.tsx`, updated footer page content and CSS (upcoming grid, ticket footer details). |
| 4 | 2026-11-26 | `f1ae622` — "4th commit" | Motion/polish pass: `App.tsx`, `FooterReveal.tsx` (+118 lines) and CSS (+266 lines) — the scroll-linked sticky footer reveal and related responsive fixes. |
| 5 | 2026-11-26 | `32a1ecc` — "for vercel deployment" | Added `vercel.json` with framework, build command and `dist` output directory. |
| 6 | 2026-11-26 | `269014b` — "for version 1.0.0" | Changed the build script to call Vite's binary directly (`node ./node_modules/vite/bin/vite.js build`) for reliable CI/Vercel builds. |

Net effect: roughly **4,300 added lines in the first commit**, **~1,900 in the booking commit**, then smaller refinement commits, ending with a complete ~3,158-line stylesheet and a self-contained production HTML file.

### 3.2 Design research phase

`DESIGN.md` documents the research step that preceded implementation:

- **Reference captured:** `https://tickify.live/` (homepage, light theme) on **2026-11-24**.
- **Method:** Firecrawl scrape with `markdown`, `images` and `branding` formats plus a full-page screenshot; raw evidence stored at `.firecrawl/design-reference.json` (63 KB).
- **Extracted tokens:** lime `#A9DD36`, secondary `#4CAF50`, pale grey background `#F2F5F5`, near-black text `#040E0E`, Manrope/Inter typography, 8 px spacing base, 22 px card radius, 12 px button radius, Tailwind + shadcn design-system signal.
- **Information architecture observed:** hero slider → category grid → featured event → on-sale card grid → footer.
- **Evidence caveat:** the screenshot could not be pixel-inspected in the environment, so layout notes are explicitly marked *inferred*, not pixel-verified.
- **Ethical boundary:** the document states not to reuse Tickify's logo, images, trademarks or copy — the reference was for the visual system only. TickShow uses its own ticket mark, its own Manikganj-focused copy and its own data.
- **Theme decision:** the user later requested a **black main background**, so the live app uses `#000000` with light text and keeps the lime accent. The captured light palette remains documented as a reference, not the current theme.

### 3.3 Implementation sequence (reconstructed from the code and commits)

1. **Scaffold** — `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/index.css`. Vite plugin chain: React → Tailwind → `viteSingleFile`. `server.allowedHosts: true` and `preview.allowedHosts: true` allow the app to be proxied through sandboxed preview hostnames.
2. **Content model** — `src/data/events.ts` defines the `EventCategory` union, `TickShowEvent` type, `EVENT_CATEGORIES`, and two arrays: upcoming and past events.
3. **Core UI** — header/hero/events/categories/promo/footer inside `App.tsx`; the animated coverflow in `CoverflowCarousel.tsx`; generic SVG icon set; helper `cn()`; footer content pages; scroll-reveal wrapper.
4. **Booking funnel** — `EventPage`, `CheckoutPage`, `OrderPage`, `Brand`, and `bookings.ts` (localStorage persistence, reference generation). `App.tsx` grew a hash-based router.
5. **Motion and polish** — `FooterReveal` rewritten to use a shared normalized scroll progress driving opacity/scale/blur; hero reduced-motion handling; upcoming grid compacting; responsive refinements.
6. **Ship** — `favicon.svg`, `vercel.json`, build-script fix, single-file `dist/index.html` committed.

### 3.4 Notable engineering decisions

- **Hash routing instead of a router library.** `getRoute()` parses `window.location.hash`; a `hashchange` listener updates React state. This keeps the build dependency-free, works on static hosting without rewrite rules, and allows deep links like `#/order/TS-ABC123`.
- **Single-file production build.** `vite-plugin-singlefile` inlines CSS and JS into `dist/index.html` (~483 KB), leaving only the favicon as a separate asset. Easy to host, email, or open from disk.
- **Motion React over a heavier carousel library.** The coverflow uses `useMotionValue`, `useTransform` and `animate` from `motion/react` with hand-written shortest-circular-distance math and a custom `coverflowShift()` for the stacked 3D look.
- **Local-first demo persistence.** Bookings use `localStorage` under `tickshow.bookings`, capped at 25 records; failures are swallowed so the confirmation page still renders in-session.
- **Accessibility-by-default choices.** 44 px minimum touch targets, focus-visible outlines, ARIA labels/roles/live regions, semantic landmarks, `prefers-reduced-motion` respected in CSS and JavaScript.

---

## 4. Technology stack and tooling

### 4.1 Runtime dependencies (`package.json`)

| Package | Version | Role |
|---|---|---|
| `react` | 19.2.6 | UI component model and hooks |
| `react-dom` | 19.2.6 | DOM rendering via `createRoot` |
| `motion` | ^14.14.0 | Scroll-linked animation, springs, transforms (`motion/react`) |
| `clsx` | 2.1.1 | Conditional class composition (via `cn`) |
| `tailwind-merge` | 3.4.0 | Tailwind class conflict resolution (via `cn`) |

### 4.2 Development dependencies

| Package | Version | Role |
|---|---|---|
| `vite` | 7.3.7 | Dev server and production bundler |
| `@vitejs/plugin-react` | 5.1.1 | React JSX/Fast Refresh plugin |
| `typescript` | 5.9.3 | Static type checking (`strict`, `noUnusedLocals`, `noUnusedParameters`) |
| `tailwindcss` | 4.1.17 | Utility CSS engine imported at the top of `index.css` |
| `@tailwindcss/vite` | 4.1.17 | Tailwind Vite integration |
| `vite-plugin-singlefile` | 2.3.0 | Inlines build output into one HTML file |
| `@types/node` | 22.19.17 | Node types for `vite.config.ts` |
| `@types/react` / `@types/react-dom` | 19.2.7 / 19.2.3 | React type declarations |

### 4.3 Configuration files

- **`tsconfig.json`** — ES2020 target, bundler module resolution, `jsx: react-jsx`, `noEmit`, strict lint-style flags, path alias `@/* → src/*`, includes `src` and `vite.config.ts`.
- **`vite.config.ts`** — plugin chain `react(), tailwindcss(), viteSingleFile()`; dev and preview servers bound to all hosts with `allowedHosts: true`; `@` alias resolves to `src`.
- **`index.html`** — `lang="en"`, viewport with `viewport-fit=cover`, theme colour `#000000`, SVG favicon, SEO description, Google Fonts preconnect + Inter/Manrope stylesheet, `#root` mount node, module script to `src/main.tsx`; default title *"TickShow | Your City. Your Events. Your Moments."*
- **`vercel.json`** — `{ "framework": "vite", "buildCommand": "npm run build", "outputDirectory": "dist" }`.
- **`.gitignore`** — excludes `/.agents` and `/.firecrawl` (tooling artefacts).
- **`dist/`** — committed build output: `index.html` (single-file app) and `favicon.svg`.

### 4.4 External assets

- **Images:** event photos served from `images.pexels.com` with explicit `auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200` query strings; alt text is authored per event.
- **Hero video:** `videos.pexels.com/.../7722221-hd_1920_1080_25fps.mp4`, with a Pexels JPEG poster underneath; `onError` hides the video and leaves the poster visible.
- **Fonts:** Google Fonts (`Inter` 400–700, `Manrope` 400–800) loaded in `index.html`.
- **Favicon:** local `public/favicon.svg` — black rounded square, lime ticket shape with a black T cut-out.
- **Social links:** point to the public Instagram, TikTok and YouTube homepages (not brand-specific profiles).

---

## 5. Project structure

```text
D:\maximalism_tickshow
├── .agents/skills/unslop/        # local skill copy used during UI refinement
├── .firecrawl/
│   └── design-reference.json     # captured evidence for DESIGN.md
├── .freebuff/project-id
├── dist/
│   ├── favicon.svg
│   └── index.html                # self-contained production bundle (~483 KB)
├── public/
│   └── favicon.svg
├── src/
│   ├── App.tsx                   # shell, router, header, hero, event/category/promo sections, auth, footer
│   ├── index.css                 # complete design system + all component styles (3,158 lines)
│   ├── main.tsx                  # React root + StrictMode
│   ├── components/
│   │   ├── Brand.tsx             # SVG ticket mark + wordmark
│   │   ├── CheckoutPage.tsx      # quantity, attendee form, order summary, demo submit
│   │   ├── CoverflowCarousel.tsx # draggable 3D past-event carousel
│   │   ├── EventPage.tsx         # event detail + lineup + sticky facts sidebar
│   │   ├── FooterPages.tsx       # 11 hash-navigable information pages
│   │   ├── FooterReveal.tsx      # scroll-scrubbed sticky lime footer reveal
│   │   ├── Icon.tsx              # 19 hand-drawn SVG icons
│   │   └── OrderPage.tsx         # booking confirmation ticket stub
│   ├── data/
│   │   ├── bookings.ts           # localStorage booking store + reference generator
│   │   └── events.ts             # types, categories, 8 upcoming + 6 past events
│   └── utils/
│       └── cn.ts                 # clsx + tailwind-merge helper
├── DESIGN.md                     # design reference research notes
├── PROJECT_DOCUMENTATION.md      # this document
├── PROJECT_DOCUMENTATION.pdf     # PDF edition of this document
├── index.html
├── package.json / package-lock.json
├── tsconfig.json
├── vercel.json
└── vite.config.ts
```

---

## 6. Architecture

### 6.1 Component tree

```text
main.tsx (createRoot + StrictMode)
└── App
    ├── [route = login | signup] → AuthPage
    └── FooterReveal
        ├── content
        │   ├── [home] → Header + <main>
        │   │                ├── Hero (video/poster, copy, CTAs)
        │   │                ├── EventsSection
        │   │                │   ├── upcoming event cards (filtered)
        │   │                │   └── CoverflowCarousel (past events)
        │   │                ├── CategoriesSection (8 filter tiles)
        │   │                └── PromoSection
        │   ├── [event]   → EventPage
        │   ├── [checkout]→ CheckoutPage
        │   ├── [order]   → OrderPage
        │   └── [page]    → FooterPage (11 variants)
        └── footer → Footer (ticket-styled site footer)
                     ├── Brand, social links
                     └── Explore / Company / Support columns
```

### 6.2 Routing and state flow

`App` holds three pieces of state:

1. `route` — result of `getRoute()`, updated on `hashchange`.
2. `activeCategory` — `EventCategory | "All"`, drives filtering of upcoming events.
3. `reducedMotion` — initialized from `matchMedia("(prefers-reduced-motion: reduce)")` and kept in sync via a `change` listener.

Effects:

- On route change: non-home routes scroll to top; home routes scroll to the hash anchor (`#home`, `#events`, `#categories`) with `scrollIntoView`.
- `matchingEvents` is a `useMemo` filter over `TICKSHOW_EVENTS`; `ALL_EVENTS` combines upcoming + past for detail lookups.
- `selectCategory()` sets the filter then scrolls to `#events` after 20 ms; `clearFilters()` resets to `"All"`.
- `openEvent()` sets `window.location.hash = "#/event/" + event.id`.

Event, checkout and order routes resolve their entity by id/reference; a missing entity falls back to the generic "Explore events" footer page instead of crashing.

### 6.3 Data flow for a booking

```text
CheckoutPage form submit
   → FormData(name, email, phone) + quantity + event
   → createBooking()
        → makeReference(): "TS-" + 6 chars from unambiguous alphabet
        → amount = event.price × quantity
        → persistBookings([new, ...readBookings()]) → localStorage "tickshow.bookings" (max 25)
   → window.location.hash = "#/order/<reference>"
   → getRoute() → findBooking(reference) → OrderPage renders the ticket stub
```

---

## 7. Complete feature catalogue

### 7.1 Header and navigation

- Fixed header, transparent at rest; after 24 px of scrolling it gains a near-black blurred background and bottom hairline (`is-scrolled`).
- Three-column grid: brand left, centred desktop nav, Log in / Sign up right.
- Nav items: **Home** (`#home`), **Explore events** (`#/events`), **About us** (`#/about`); active link gets an underline and `aria-current="location"`.
- At ≤980 px the desktop nav is replaced by a hamburger toggling an animated mobile menu with the same links plus auth actions. Escape closes the menu; closed-menu links get `tabIndex={-1}`.
- All interactive targets are at least 44 px tall.

### 7.2 Hero

- Full-viewport (min 640 px, 580 px on small screens) immersive section with autoplaying, muted, looping Pexels video over a poster image and a two-layer dark gradient for text contrast.
- Eyebrow: *"Manikganj, Dhaka · Live events"* with a lime dot.
- Two-line display heading: *"Don't just watch / Be there"* (second line in soft lime), with a rise-in animation.
- Description and two frosted-glass CTAs: **Explore events** and **How it works**.
- When reduced motion is requested, the `<video>` is not rendered at all; the poster stays.

### 7.3 Upcoming events

- Section title *"What's happening?"* with kicker *"Upcoming"*, plus context text that changes with the active filter (`"N events in <category>."` or `"Find your next night out."`).
- Four-column card grid (three at ≤1190 px, two at ≤900 px, one at ≤600 px — except the home grid, which stays two columns on phones). Each card shows image, category tag, title, date · venue, price and a **Details** button that opens the event route.
- Cards lift on hover and gain a lime border; equal-height rows via `grid-auto-rows: 1fr` and flex-filled bodies.
- **Clear filters** text action appears when a category is active; an empty-state panel with *"No matches"* and **Show all events** appears if a filter has no results.
- Compact home-grid variant uses 112 px images (88 px on phones), 16 px card radius and tighter type.

### 7.4 Category filter

- Dark surface section titled *"Good plans have a type"* with kicker *"Browse"* and a **See everything** reset action.
- Eight illustrated-by-SVG tiles: Concerts & Music, Sports, Festivals, Theatre, Technology, Workshops, Business Events, Other Experiences.
- Tiles are real buttons with `aria-pressed`, a lime icon, selected state (`is-selected` tint + border), and a hover state. Selecting one filters the upcoming grid and scrolls to it.
- Grid: 4 columns → 2 columns at ≤980/720 px, 8 px gaps on phones.

### 7.5 Past events coverflow carousel

A signature interaction built from Motion primitives:

- **Layout:** each card is absolutely centred in a viewport; a shared `position` MotionValue represents the active (fractional) index.
- **Circular wrap:** `(((index - value + half) % count) + count) % count - half` gives the shortest path around the loop, so neighbours fill both sides.
- **Transform pipeline:** offset → `rotateY` ±22°, `scale` 0.72→1, `x` = offset + `coverflowShift()` (a piecewise-linear pull toward centre, ±itemWidth), `zIndex` = `1000 - |offset|`, `opacity` 0→1 between ±560 and ±1100 px.
- **Widths:** 340 px desktop, 300 px ≤900 px, 250 px ≤600 px; kept in sync between CSS `--cf-size` and `getItemWidth()` in JS.
- **Input:** pointer drag with `setPointerCapture` and `pan-y` touch action; a >4 px move suppresses the click so dragging never opens an event. Arrow buttons, keyboard ← / → on the focused region, and clickable pagination dots all call `goTo()`.
- **Motion:** `animate(position, …, { type: "spring", stiffness: 260, damping: 30 })`, collapsed to `duration: 0` under reduced motion.
- **UI around it:** *"Drag to revisit ↔"* hint, `01 / 06`-style counter, caption with category · status, title, date · venue · location, price and **View details**; `aria-live="polite"` caption, carousel region role and per-dot labels.
- Clicking the already-active card opens its event page; clicking another card rotates to it.

### 7.6 Promo band

- Raised-surface section: *"Make it a night / There's always something on"*, supporting copy, and a lime **Find your next event** CTA to `#/events`.

### 7.7 Sticky footer reveal

`FooterReveal` wraps every non-auth route:

- The page content sits above a sticky lime footer field. As the content's bottom crosses the viewport, a single normalized `scrollYProgress` drives **opacity 0→1**, **scale 0.9→1** (from the bottom edge) and **blur 6px→0** in sync.
- `ResizeObserver` recomputes `revealAt = clamp(footerHeight / viewportHeight, 0.05, 0.95)` so all screen sizes finish the reveal within one footer height of scrolling.
- `will-change` is set only while the reveal is in progress.
- The page scrollbar is hidden for this wrapper; on viewports shorter than 720 px the footer becomes static/relative to avoid clipping, and social links move to the always-visible bottom row.
- The footer itself is a frosted **admission ticket**: rounded panel, dashed perforation, two punched edge notches showing the lime field through, a barcode strip, "Admit one / TickShow / Manikganj / No. TS-{year}-001" header, brand, social links, and **Explore / Company / Support** link columns; copyright, motto and "Back to top".

### 7.8 Footer information pages (11)

| Route | Page | Content |
|---|---|---|
| `#/events` | Explore events | Grid of all 8 upcoming events |
| `#/upcoming` | Upcoming events | Same grid, different heading |
| `#/categories` | Categories | 2-column grid of the 8 categories with icons |
| `#/about` | About us | Our story, what we do, why in person, the team |
| `#/how-it-works` | How it works | Three steps: Discover → Book → Experience |
| `#/contact` | Contact | Enquiry emails, office note, local-only message form |
| `#/terms` | Terms & conditions | Preview-only, event information, accounts, external links |
| `#/privacy` | Privacy policy | No collection, no cookies/analytics, third parties, contact |
| `#/faqs` | FAQs | Four Q&As plus "Still stuck?" |
| `#/help` | Help center | Browsing, categories, event details, more help |
| `#/support` | Booking support | Before you write, other contact routes, local-only form |

All share a `PageShell` (brand top bar, back link, kicker, large accented title, intro) and set `document.title`. Contact and support forms show a notice: *"This is a frontend preview. Nothing was sent."*

### 7.9 Authentication preview

- Two routes, `#/login` and `#/signup`, rendered by `AuthPage` outside the footer-reveal wrapper.
- Split screen: left showcase photo with brand line, right card with form.
- Login fields: email, password (`minLength=8`, autocomplete `current-password`). Signup adds full name and uses `new-password`.
- Submitting prevents default and shows *"This is a frontend preview. No account information was sent."* A switch link toggles login/signup and a note reinforces that no data is sent.

### 7.10 Event detail page

- Sets `document.title` to `"<title> | TickShow"` and restores it on unmount.
- Top bar with brand and **All events** back link.
- Header: category · status (or "Past event"), large title, event description (`about`).
- Full-width rounded hero image.
- Two-column body: numbered **Lineup** list (index, performer, role) and a sticky **Event details** sidebar with date, time, venue, location, price and status.
- Upcoming events get **Get tickets** → `#/checkout/<id>` and a *"up to 8 per order"* note; past events get **See upcoming events** and an archive notice.
- Explicit sample-data / demo-checkout disclaimer.

### 7.11 Checkout (demo)

- Sets a contextual document title; **Back to event** link.
- Past events short-circuit to a **Sales closed** panel stating the event already happened, with links back to the event or to upcoming events.
- For upcoming events, a two-column form:
  - **Tickets block:** minus/plus stepper bound to `quantity` (1–8), live total via `formatTaka`, `aria-live` output, buttons disabled at the bounds, general-admission hint.
  - **Your details block:** required full name, email and phone (`tel`, placeholder `01XXXXXXXXX`, appropriate autocomplete values).
  - Demo note explaining no payment is taken and the order is saved in the browser.
- Sticky **Order summary**: event image, title, date/time and venue/location with icons, line item `price × quantity`, free booking fee, total, and a **Pay ৳X** submit button (label notwithstanding, no payment occurs).
- Submit calls `createBooking()` and navigates to the order route.

### 7.12 Order confirmation

- Sets title `Ticket <reference> | TickShow`.
- Header *"You're in"*, lede naming quantity, event and attendee.
- Large **ticket stub**: main area with category, title, date/time, venue/location, tickets, total and booked-by; a separated reference panel with the code `TS-XXXXXX` and *"Show this at the door"*.
- Note that no payment was taken and the booking can be reopened at `#/order/<reference>`.
- Actions: **Event details** and **Browse more events**.

### 7.13 Booking data helpers

- `MAX_TICKETS_PER_ORDER = 8`.
- `formatTaka()` → `৳` + `toLocaleString("en-US")`.
- `makeReference()` → `TS-` + six characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (ambiguous characters omitted).
- `readBookings()` safely parses JSON, returning `[]` on any error.
- `persistBookings()` writes newest-first and truncates to 25 records; storage errors are ignored.
- `findBooking()` matches case-insensitively after trimming.

### 7.14 Cross-cutting features

- **Dynamic document titles** on event, checkout, order and footer pages.
- **Reduced motion** respected globally (CSS media query) and in JS (video omitted, carousel animation zeroed, smooth scroll replaced with instant).
- **Responsive layouts** at 1190, 980, 900, 720, 640, 600 and 360 px, plus a short-viewport (`max-height: 720px`) footer fallback and `env(safe-area-inset-*)` support for notched devices.
- **Accessibility:** semantic `header`/`main`/`nav`/`aside`/`footer`/`section`, `aria-label`/`aria-labelledby`/`aria-current`/`aria-pressed`/`aria-hidden`, live regions, visible focus outlines (2 px lime), `role="status"` notices, keyboard-operable carousel and menu.

---

## 8. Design system

All tokens live in `:root` in `src/index.css`; component styles reference them via CSS custom properties, so theming is centralized.

### 8.1 Colour tokens

| Token | Value | Use |
|---|---|---|
| `--paper` | `#000000` | Page background |
| `--surface` | `#111111` | Cards, panels, footer base |
| `--raised` | `#1a1a1a` | Hovered/raised surfaces, promo band |
| `--ink` | `#f5f5f5` | Primary text |
| `--ink-2` | `#c3c3c3` | Secondary text |
| `--muted` | `#8c8c8c` | Meta, kickers, labels |
| `--line` | `rgba(255,255,255,.12)` | Hairlines |
| `--line-strong` | `rgba(255,255,255,.24)` | Stronger borders |
| `--accent` | `#a9dd36` | Lime: primary actions, links, active states, highlights |
| `--accent-dark` | `#85b824` | Accent hover |
| `--accent-soft` | `#d8f08f` | Hero headline accent, eyebrow dot |
| `--night` | `#050505` | Hero, carousel cards, ticket reference panel |

Footer-reveal-specific variables (`--footer-field`, `--footer-ink`, `--footer-rule`, `--footer-mono`) are scoped to `#tickshow-footer-reveal` and inherit the accent.

### 8.2 Typography

- **Body:** Inter → Arial → Helvetica → sans-serif; base 16 px / line-height 1.6.
- **Display:** Manrope → Inter → Arial → sans-serif; weight 400 with tight `-0.015em` tracking for headings.
- **Scale:** hero `clamp(48px, 6.4vw, 80px)` (40–52 px on phones); section headings `clamp(40px, 4.6vw, 56px)` (34–42 px on phones); footer-page titles up to 80 px; card titles 17–19 px; kickers 10–13 px, often uppercase with `0.08–0.12em` letter spacing.
- Tabular numerals (`font-variant-numeric: tabular-nums`) on prices, counters and serials.

### 8.3 Shape, depth and motion

- Radii: `--radius-control: 12px`, `--radius-card: 22px`, `--radius-panel: 22px`; carousel cards 18 px; ticket 24 px; pill controls 999 px.
- Shadows: `--shadow-sm: 0 1px 3px rgba(0,0,0,.5)`, `--shadow-md: 0 8px 24px rgba(0,0,0,.6)`; glass panels layer inset highlights and deep drop shadows.
- Easing: `--ease: cubic-bezier(0.22, 1, 0.36, 1)`; most transitions 150 ms, menu 240 ms, hero rise 500 ms.
- Buttons: `--button-primary` lime with white text, `--button-ghost` translucent white, `--button-dark` surface grey; hero buttons are frosted glass with lime variant; `active` scale 0.98.
- Effects: gradient overlays, `backdrop-filter: blur() saturate()` with `@supports` fallbacks, CSS masks for carousel edge fade, repeating-linear-gradient barcode, punched ticket notches via pseudo-elements, dashed perforation lines.

### 8.4 Layout primitives

- `.page-wrap`: `width: min(calc(100% - 2 × gutter), 1320px)`, centred.
- `--page-gutter: clamp(20px, 4vw, 48px)` (20 px ≤720 px).
- `scroll-padding-top` accounts for the fixed header plus safe-area inset; `.section-anchor` adds `scroll-margin-top`.
- Grid families: event cards 4/3/2/1 columns; categories 4/2; steps 3/1; footer 4 columns collapsing to 2; checkout and event layouts 1.5–1.6fr / 1fr with sticky asides.

---

## 9. Data layer

### 9.1 Event schema (`src/data/events.ts`)

```ts
type EventCategory =
  | "Concerts & Music" | "Sports" | "Festivals" | "Theatre"
  | "Technology" | "Workshops" | "Business Events" | "Other Experiences";

type TickShowEvent = {
  id: string; title: string; category: EventCategory;
  date: string; dateValue: string; time: string;
  venue: string; location: string; city: string;
  price: number; status: string;
  image: string; imageAlt: string; about: string;
  lineup: { name: string; role: string }[];
};
```

### 9.2 Upcoming events (8)

| ID | Title | Category | Date | Venue | Price (৳) | Status |
|---|---|---|---|---|---|---|
| `rooftop-frequencies` | Rooftop Frequencies | Concerts & Music | Sat, 25 Jul 2026 | Manikganj Town Hall | 1,200 | Selling fast |
| `liberty-aces` | Manikganj XI vs. Dhaka United | Sports | Fri, 7 Aug 2026 | Shibaloy Sports Ground | 600 | Tickets moving |
| `afterglow-festival` | Afterglow City Festival | Festivals | 14–16 Aug 2026 | Manikganj Riverside Grounds | 800 | Early bird |
| `midsummer-night` | A Midsummer Night's Dream | Theatre | Thu, 20 Aug 2026 | District Cultural Hall | 500 | On sale now |
| `future-form` | Future / Form 2026 | Technology | Sat, 5 Sep 2026 | Manikganj Tech Hub | 1,500 | Limited tickets |
| `clay-after-hours` | Clay After Hours | Workshops | Sat, 12 Sep 2026 | Manikganj Art Studio | 900 | A few places left |
| `good-city-summit` | Good City Summit | Business Events | Thu, 17 Sep 2026 | Manikganj Convention Center | 2,000 | On sale now |
| `sunday-plates` | Sunday Plates: Night Market | Other Experiences | Sun, 4 Oct 2026 | Manikganj Night Market | 300 | On sale now |

### 9.3 Past events (6)

| ID | Title | Category | Date | Price (৳) | Status |
|---|---|---|---|---|---|
| `neon-monsoon` | Neon Monsoon | Concerts & Music | Sat, 13 Jun 2026 | 1,000 | Sold out |
| `manikganj-marathon` | Manikganj Marathon 2026 | Sports | Sun, 24 May 2026 | 400 | Sold out |
| `boishakh-bazaar` | Pohela Boishakh Bazaar | Festivals | Tue, 14 Apr 2026 | 250 | Sold out |
| `glass-menagerie` | The Glass Menagerie | Theatre | Fri, 20 Mar 2026 | 450 | Past event |
| `build-night` | Build Night Dhaka | Technology | Sat, 21 Feb 2026 | 700 | Past event |
| `creative-table` | Creative Table Meetup | Workshops | Sat, 17 Jan 2026 | 850 | Past event |

Every event carries an `about` paragraph, a 2–5 person/act `lineup` with roles, a descriptive `imageAlt`, and the location `"Manikganj, Dhaka"`.

### 9.4 Booking schema (`src/data/bookings.ts`)

```ts
type TicketBooking = {
  reference: string; eventId: string; eventTitle: string;
  quantity: number; amount: number;
  name: string; email: string; phone: string; createdAt: string;
};
```

Stored under `localStorage["tickshow.bookings"]`, newest first, maximum 25. Reference format `TS-` + 6 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.

---

## 10. Routing reference

| Hash | Screen | Notes |
|---|---|---|
| *(none)* or `#home` | Home | Hero, upcoming, categories, promo |
| `#events`, `#categories` | Home anchors | Scroll to section |
| `#/events`, `#/upcoming` | Event listing pages | Full grid |
| `#/categories` | Categories page | 8 category links |
| `#/about`, `#/how-it-works`, `#/contact`, `#/terms`, `#/privacy`, `#/faqs`, `#/help`, `#/support` | Info pages | Content from `INFO_PAGES` |
| `#/event/<id>` | Event detail | Looks up both upcoming and past arrays |
| `#/checkout/<id>` | Checkout | Past events show "Sales closed" |
| `#/order/<reference>` | Confirmation | Looks up localStorage booking |
| `#/login`, `#/signup` | Auth preview | Rendered without footer reveal |
| Anything else | Home | Safe fallback |

Route values are lowercased, and `event/`, `checkout/` and `order/` parameters are `decodeURIComponent`-decoded. Unknown event ids/references gracefully fall back to the Explore events page.

---

## 11. File-by-file reference

| File | Lines (approx.) | Responsibility |
|---|---|---|
| `src/main.tsx` | 10 | Mounts `<App />` in `StrictMode`, imports global CSS. |
| `src/App.tsx` | 643 | Navigation items, header with mobile menu, hero, upcoming grid, past section, categories, promo, footer, auth page, hash router, route resolution, scroll/motion effects. |
| `src/index.css` | 3,158 | Design tokens, resets, every component's styling, glass/ticket effects, 7 responsive breakpoints, reduced-motion rules. |
| `src/components/CoverflowCarousel.tsx` | 330 | Motion-driven 3D carousel: transforms, drag handling, keyboard controls, arrows, dots, counter, caption. |
| `src/components/FooterReveal.tsx` | 330 | Scroll-linked footer reveal and its scoped inline stylesheet (sticky lime field, ticket reskin, short-screen fallback). |
| `src/components/FooterPages.tsx` | 500 | 11 information pages, content data, page shell, event/category grids, steps, info sections, local-only message form. |
| `src/components/CheckoutPage.tsx` | 216 | Quantity stepper, attendee form, order summary, demo submit, sales-closed state. |
| `src/components/EventPage.tsx` | 123 | Event detail, lineup, facts sidebar, ticket CTA, document title. |
| `src/components/OrderPage.tsx` | 103 | Booking confirmation ticket stub and next actions. |
| `src/components/Icon.tsx` | 145 | 19 hand-drawn SVG icons and a typed `Icon` component. |
| `src/components/Brand.tsx` | 18 | SVG ticket mark and TickShow wordmark. |
| `src/data/events.ts` | 376 | Types, category list, 8 upcoming and 6 past sample events. |
| `src/data/bookings.ts` | 83 | Booking type, localStorage persistence, reference generation, format helper. |
| `src/utils/cn.ts` | 6 | `clsx` + `tailwind-merge` class helper (available for future utility-class work). |
| `index.html` / `vite.config.ts` / `tsconfig.json` / `vercel.json` | — | HTML shell, build pipeline, TypeScript settings, deployment config. |
| `DESIGN.md` | 65 | Captured design reference, extracted tokens, page-structure inference, implementation guidance. |
| `dist/index.html` | ~483 KB | Single-file production build (inlined CSS + JS). |
| `public/favicon.svg` | 5 lines | TickShow favicon. |

### Unused CSS artefacts

The stylesheet still contains `.tick-dialog`, `.dialog-content`, `.dialog-topline`, `.dialog-close`, `.dialog-event-details`, `.dialog-disclaimer` and `.dialog-primary` rules from an earlier modal-based event-detail design. The current app uses full `EventPage` routes instead, so these rules are dormant. `cn()` is likewise available but not currently referenced by components, and Tailwind is imported but the UI is written almost entirely in custom CSS.

---

## 12. User guide / journeys

### 12.1 Discover and filter

1. Land on the home page; the hero introduces TickShow and offers **Explore events**.
2. Scroll to **What's happening?** to see the eight upcoming events as cards.
3. Scroll to **Good plans have a type** and pick a category. The page jumps back to the filtered lineup; the chosen tile is highlighted and the heading reports the count.
4. Use **Clear filters** or **See everything** to restore the full list.
5. If a filter yields nothing, **Show all events** resets it.

### 12.2 Browse the archive

1. In **Past events**, drag the coverflow left/right, use the arrow buttons, click a dot, or focus the carousel and press ← / →.
2. The centre card is the active one; click it (or press **View details**) to open its archive page.
3. Past event pages show archive pricing and a link back to upcoming events; checkout is not offered.

### 12.3 Book a demo ticket

1. On an upcoming event card, press **Details**.
2. Read the lineup and facts, then press **Get tickets**.
3. In checkout, set quantity with − / + (1–8), watch the total update, fill name, email and phone.
4. Press **Pay ৳X** — despite the label, no payment is taken.
5. The confirmation page shows your ticket stub and `TS-XXXXXX` reference. Bookmark `#/order/<reference>` to reopen it later in the same browser.

### 12.4 Other pages

- Header links go to Explore events and About us; Log in / Sign up open the preview forms.
- The ticket-styled footer links to all event, company and support pages; **Back to top** returns to `#home`.
- The footer becomes fully visible as you scroll to the bottom of any page, fading, scaling and sharpening into the lime field.

---

## 13. Developer guide

### 13.1 Requirements

- Node.js with npm (the production build script invokes Vite via `node ./node_modules/vite/bin/vite.js`).
- No environment variables or secrets are required.

### 13.2 Commands

```bash
npm install       # install dependencies from package-lock.json
npm run dev       # start Vite dev server (host: true, allowedHosts: true)
npm run build     # produce dist/index.html + dist/favicon.svg (single-file build)
npm run preview   # preview the production build locally
```

### 13.3 Making changes

- **Add an event** — append a `TickShowEvent` to `TICKSHOW_EVENTS` or `PAST_TICKSHOW_EVENTS` in `src/data/events.ts`. Include a unique `id`, a Pexels/other image URL and alt text, `dateValue` (ISO), a lineup and a status. The id becomes part of the `#/event/<id>` URL.
- **Add a category** — extend the `EventCategory` union, `EVENT_CATEGORIES`, `CATEGORY_MARKS` in `App.tsx` and `CATEGORY_ICONS` in `FooterPages.tsx`, plus an icon in `Icon.tsx`.
- **Change the palette** — edit the CSS variables in `:root` (`src/index.css`) and the footer reveal variables in `FooterReveal.tsx`; keep the accent used in new colours consistent.
- **Add a footer page** — extend `FooterPageKey`, `PAGE_TITLES`, `INFO_PAGES`/special-case rendering and `FOOTER_ROUTES` in `App.tsx`, and add a link in `Footer()`.
- **Change booking limits** — `MAX_TICKETS_PER_ORDER` in `bookings.ts` is also used by the checkout hints and button bounds.

### 13.4 Deployment

`vercel.json` declares `framework: "vite"`, `buildCommand: "npm run build"` and `outputDirectory: "dist"`. Pushing to the connected GitHub repository triggers a Vercel build; the single-file `dist/index.html` plus favicon are served as a static site. Because routing is hash-based, no SPA rewrite rules are needed.

### 13.5 Verification checklist

- `npm run build` completes and `dist/index.html` is regenerated.
- Deep links such as `#/event/rooftop-frequencies` and `#/order/TS-XXXXXX` load correctly.
- Category filter, clear filters and empty state work.
- Carousel drag, arrows, dots and ← / → keys work; dragging does not open a card.
- Checkout bounds (1 and 8) and totals are correct; confirmation reference is stored and reopenable.
- Reduced motion, mobile menu at ≤980 px, and short-viewport footer fallback behave as documented.

---

## 14. Accessibility and interaction quality

- **Keyboard:** all buttons and links are focusable; carousel supports ← / →; Escape closes the mobile menu; focus-visible outline is a 2 px lime ring with 3 px offset.
- **Screen readers:** landmarks (`header`, `nav`, `main`, `section`, `aside`, `footer`), `aria-labelledby` on sections, `aria-current` for active nav/dots, `aria-pressed` for category tiles, `aria-expanded`/`aria-controls` on the menu toggle, `aria-hidden` on decorative media, `aria-live` on quantity and carousel caption, and `role="status"` notices.
- **Touch:** 44 px minimum interactive targets, `touch-action: manipulation` globally, `pan-y` on the carousel so vertical scrolling still works while dragging horizontally, `env(safe-area-inset-*)` padding.
- **Contrast:** light ink on near-black, lime accent for emphasis; hero text sits over two dark gradient layers.
- **Motion:** at the OS level, `prefers-reduced-motion: reduce` disables smooth scrolling, animations and transitions and removes the hero video; JavaScript mirrors the preference for the carousel and scroll behaviour.
- **Robustness:** localStorage access is wrapped in `try/catch`; malformed stored JSON yields an empty list; unknown routes and missing entities fall back to a valid page.

---

## 15. Limitations, disclaimers and known artefacts

1. **No backend.** Auth, contact and checkout forms do not send data. There is no server-side validation, inventory, payment, email delivery or real ticket issuance.
2. **Sample content.** All events, lineups, prices and statuses are illustrative; dates and availability should be confirmed with real organizers.
3. **Local-only bookings.** Orders live in the browser's `localStorage` under `tickshow.bookings`, capped at 25. Clearing browser storage removes them; they are not shared across devices.
4. **External assets.** Photos and the hero video are loaded from Pexels, fonts from Google Fonts. Offline or blocked-network viewing will degrade images/video/fonts; the app still functions.
5. **No test suite or type-check script.** `package.json` exposes only `dev`, `build` and `preview`; TypeScript checking happens through the editor/Vite toolchain rather than a dedicated `npm run typecheck`.
6. **Dormant code.** Modal-dialog CSS, the `cn()` helper and Tailwind utilities are present but unused by the current UI.
7. **Visual-reference caveat.** The captured Tickify screenshot was not pixel-inspected; `DESIGN.md` labels its layout notes as inferred. The live theme is black by explicit user request, not the captured light palette.
8. **Social links** point to platform homepages rather than official TickShow accounts.
9. **Accessibility caveat.** Motion effects were designed with fallbacks, but no formal audit (axe/Lighthouse) or cross-browser test report is included in the repository.

---

## 16. Appendix

### 16.1 Quick facts

| Item | Value |
|---|---|
| Total source files (`src/`) | 14 |
| Components | 8 |
| Event categories | 8 |
| Events | 14 (8 upcoming + 6 past) |
| Footer pages | 11 |
| Hash route families | 10 |
| Icons | 19 |
| Max tickets per order | 8 |
| Booking storage cap | 25 |
| Commits | 6 (25–26 Nov 2026) |
| Production bundle | ~483 KB single HTML file |

### 16.2 Key source references

- Design research and token extraction: `DESIGN.md`, `.firecrawl/design-reference.json`
- Routing entry point: `src/App.tsx` → `getRoute()`
- Motion carousel math: `src/components/CoverflowCarousel.tsx` → `coverflowShift()`, `useTransform()`
- Scroll reveal: `src/components/FooterReveal.tsx` → `useScroll()`, `ResizeObserver`
- Booking persistence: `src/data/bookings.ts` → `createBooking()`, `findBooking()`
- Design tokens: `src/index.css` → `:root`

### 16.3 Document conventions

- `৳` denotes Bangladeshi taka.
- Code identifiers are shown in backticks; user-facing UI strings are shown in quotation marks.
- File paths are relative to the repository root unless stated otherwise.

---

*End of document — TickShow project documentation, generated 26 November 2026 from the source tree at commit `269014b`.*
