// Shared HTTP helpers for TickShow Edge Functions.

export function allowedOrigins(): Set<string> {
  const origins = new Set<string>([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);
  const siteUrl = Deno.env.get("SITE_URL")?.trim();
  if (siteUrl) {
    try {
      origins.add(new URL(siteUrl).origin);
    } catch {
      // An invalid SITE_URL is rejected by requireStripeTestEnv().
    }
  }
  return origins;
}

export function corsHeaders(origins: Set<string>, request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": origin && origins.has(origin) ? origin : "null",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, stripe-signature",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    Vary: "Origin",
  };
}

export function json(body: Record<string, unknown>, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}

export function isOriginAllowed(origins: Set<string>, request: Request): boolean {
  const origin = request.headers.get("Origin");
  return !origin || origins.has(origin);
}

// Per-isolate limiter. Supabase Edge Functions scale this with traffic; for a
// cross-region hard limit, pair it with the platform/WAF rate limiter.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function allowRequest(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  for (const [bucketKey, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(bucketKey);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export async function readBoundedJson(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error("Request body is too large.");
  }
  const raw = await request.text();
  if (raw.length > maxBytes) throw new Error("Request body is too large.");
  if (!raw) throw new Error("A JSON request body is required.");
  return JSON.parse(raw);
}
