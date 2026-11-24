# Design reference — Tickify (https://tickify.live/)

## Source and capture context
- Reference URL: `https://tickify.live/` (homepage, light theme)
- Capture: Firecrawl scrape with `markdown,images,branding` formats and `--full-page-screenshot`
- Raw evidence: `.firecrawl/design-reference.json`
- Screenshot: moved to `C:\Users\USER\AppData\Local\Temp\opencode\firecrawl-tickify\design-reference.png` (kept outside the Vite project so the dev-server file watcher does not lock it)
- Captured on: 2026-11-24

## Evidence limitations
The screenshot pixels could **not** be visually inspected in this environment (no image-capable model available). Layout and component descriptions below are derived from the page markdown, the extracted `branding` object, and the image inventory — they are not pixel-verified. Values from the branding extraction are marked **extracted**; layout inferences are marked **inferred**.

## Extracted design tokens
| Role | Value | Source |
|---|---|---|
| Primary / accent / link | `#A9DD36` (lime) | branding.colors |
| Secondary | `#4CAF50` | branding.colors |
| Page background | `#F2F5F5` (pale cool grey) | branding.colors.background |
| Primary text | `#040E0E` (near-black) | branding.colors.textPrimary |
| Secondary button text | `#475050` | branding.components.buttonSecondary |
| Heading font | Manrope → Inter → Arial → sans-serif | branding.typography |
| Body font | Inter → Arial → Helvetica → sans-serif | branding.typography |
| Base spacing unit | 8px | branding.spacing.baseUnit |
| Card radius | 22px | branding.spacing.borderRadius |
| Button radius | 12px | branding.components.buttonPrimary |
| Framework / components | Tailwind + shadcn | branding.designSystem |
| Color scheme | light | branding.colorScheme |

### Buttons (extracted)
- Primary: background `#A9DD36`, text `#FFFFFF`, radius 12px, subtle shadow `0 1px 3px rgba(0,0,0,.1)`
- Secondary: background `#F2F5F5`, text `#475050`, radius 12px, no shadow

### Typography (extracted sizes, likely component-level)
- h1: 16px, h2: 20px, body: 13px (these appear to be typical component sizes, not hero display sizes)

## Page structure from markdown (inferred order)
1. Skip link and fixed/sticky header (not detailed in markdown)
2. Hero: image slider. Each slide is a large event image with a date chip (`Sat 12 Dec`) and event title (e.g. `AWS Community Day Bangladesh 2026`).
3. **Browse your way** — a category grid of 19 illustrated PNG tiles with labels: Concert, Sports, Stand-up, Workshops, Fundraisers, Festivals, Competitions, Fashion Shows, Conferences, Seminars, Reunions, Exhibitions, Launching, Movie / Drama, Party, Pop Culture, Music, Hiphop.
4. **Happening now** — a featured single event (image + title).
5. **On sale now** — a multi-column event card grid with a `View all` link. Each card contains: image, date badge (`Nov–Dec · Fri20–5 Live`), title, venue, time, `Starts from ৳200`, and a `Book now` link/button.
6. Footer (present in screenshot, not represented in markdown text).

## Image inventory (observed usage)
- Hero carousel: `/_next/image?...` variants at widths 640–3840 and q=75/85
- Category icons: `/media/event_category/{singer,soccer-player,stand-up,creative-team,donation,confetti,competition,fashion-show,conference,presentation,reunion,exhibition,opening-ceremony,theater,mirror-ball,hand-gesture,dj}.png`
- Logo (light theme): `/assets/logo/tickify-logo-for-light.svg`
- Favicon: `/favicon.ico`

Do not reuse Tickify's logo, images, trademarks or copy in the target implementation. Use the user's own assets and copy; the reference is for visual system only.

## Implementation guidance for the TickShow React/Vite app
- Replace the current dark palette with the extracted light palette: page `#F2F5F5`, surfaces `#FFFFFF`, text `#040E0E`, mint/lime accent `#A9DD36`.
- Switch fonts from Space Grotesk / Instrument Serif to **Inter** (body) and **Manrope** (display/headings), loaded from Google Fonts.
- Use 22px radius for cards/panels and 12px for buttons/controls; soften shadows to `0 1px 3px rgba(0,0,0,.1)` and use gentle 1px borders `rgba(4,14,14,.1)`.
- Keep the existing TickShow content, routing, modal, and coverflow interaction; apply the new tokens through CSS variables so all sections and footer pages inherit them.
- To mirror the reference's information architecture, reorder the home page as: hero → Browse your way (illustrated category tiles) → Happening now (featured event) → On sale now (event card grid) → footer. The coverflow carousel can serve as the hero slider if retained.
- Use lime only for primary actions, links, active states and small accents; keep large areas pale grey/white so the emphasis matches the reference.

## Unresolved details
- Exact hero height, gutter width, number of grid columns at each breakpoint, hover/focus states, animation and true mobile layout are not verifiable from the available evidence.
- The screenshot exists but was not pixel-inspected; avoid claiming pixel-perfect fidelity.

## Current implementation note
The user later requested a black main background, so the live theme now uses `#000000` for the page with light text and the same lime accent. The light palette above remains the captured reference design, not the current app theme.
