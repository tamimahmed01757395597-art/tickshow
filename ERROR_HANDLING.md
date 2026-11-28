# Error handling

## User-facing error routes

TickShow uses hash routing, so private and error states are rendered by `ErrorPage` at `/#/error/<state>`.

| State | Code | Meaning |
| --- | --- | --- |
| `400` | 400 | Invalid request details |
| `401` | 401 | Sign-in required |
| `403` | 403 | Access denied |
| `404` | 404 | Unknown route or record |
| `409` | 409 | Conflict with an existing record |
| `419` | 419 | Session or secure link expired |
| `429` | 429 | Rate limit reached |
| `500` | 500 | Unexpected server failure |
| `502` | 502 | Payment provider unavailable |
| `503` | 503 | Service unavailable/not configured |
| `maintenance` | 503 | Scheduled maintenance |
| `origin` | 403 | Request origin rejected |
| `token` | 419 | Secure link invalid or expired |
| `rate-limit` | 429 | Too many attempts |
| `payment` | 502 | Payment could not be completed |

Unknown routes return the 404 state. Admin-only destinations reached by non-admin sessions are routed to `403`, not silently redirected into the admin panel.

## Payment result pages

- `/#/payment/confirmation?order=<reference>` — success return from Stripe; polls the database while a webhook is pending.
- `/#/payment/processing?order=<reference>` — payment still being confirmed.
- `/#/payment/failed?order=<reference>` — failed attempt; no tickets issued.
- `/#/payment/cancelled?order=<reference>` — buyer cancelled checkout; no payment taken and no reservation retained.

All payment pages clearly state that Stripe TEST MODE is active. `fetchOrder()` validates the order reference and the returned shape before rendering.

## API error mapping

Edge Functions return JSON with a short `error` string and appropriate status:

| Status | Used for |
| --- | --- |
| 400 | Validation failure, missing signature, invalid provider event |
| 401 | Missing or invalid Supabase JWT |
| 403 | Disallowed origin or insufficient role/ownership |
| 405 | Unsupported HTTP method |
| 409 | Duplicate ticket generation/email claim |
| 413 | Body above the function limit |
| 429 | Per-user or per-IP rate limit |
| 500 | Unexpected internal failure |
| 502 | Stripe or email provider failure |
| 503 | Missing server configuration |

Internal messages (database errors, Stripe library errors, Brevo provider text) are logged or narrowed to safe public messages. Browser code parses `FunctionsHttpError.context` through `src/lib/function-error.ts` and falls back to a generic message when the body is not usable.

## Webhook retries and idempotency

`stripe-webhook` claims an event by its Stripe event ID before mutating order state:

- Duplicate claims return `200 { duplicate: true }` without re-processing.
- A processing failure releases the claim and returns an error so Stripe retries.
- Success marks the ledger row processed.
- Amount, currency, paid status and order state are rechecked in `mark_stripe_order_paid`; mismatches fail closed.

## SEO/error hygiene

- `index.html` defaults to `index,follow`; private routes switch the robots meta to `noindex,nofollow,noarchive`.
- `robots.txt` disallows `/auth/callback` and `/supabase/`; it is not a security control.
- `sitemap.xml` is generated at build time from `VITE_SITE_URL`/`SITE_URL`. Hash fragments are not independent crawlable URLs, so only the public root is listed.
- `vercel.json` rewrites unknown non-asset paths to the SPA shell and applies security headers.

## Operational limits

No ESLint configuration, unit-test runner or E2E framework exists in this repository. Do not treat those checks as passed. The database suite (`npm run db:test`), TypeScript check and production build were run in this workspace; results are recorded in `DEMO_REMOVAL_REPORT.md` and `SECURITY_AUDIT.md`.
