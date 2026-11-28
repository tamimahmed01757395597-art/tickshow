// All Stripe credentials are read server-side. Live keys are rejected even if
// they are present in the deployment environment.

export type StripeEnv = {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  siteUrl: string;
};

export function requireStripeTestEnv(): StripeEnv {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim() ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY")?.trim() ?? "";
  const publishableKey = Deno.env.get("STRIPE_PUBLISHABLE_KEY")?.trim() ?? "";
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")?.trim() ?? "";
  const stripeMode = Deno.env.get("STRIPE_MODE")?.trim().toLowerCase() ?? "";
  const siteUrl = Deno.env.get("SITE_URL")?.trim() ?? "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !siteUrl) {
    throw new Error("Server configuration is incomplete.");
  }
  if (stripeMode !== "test") {
    throw new Error("Stripe is configured for test mode only.");
  }
  if (!secretKey.startsWith("sk_test_") || !publishableKey.startsWith("pk_test_")) {
    throw new Error("Stripe TEST MODE keys are required.");
  }
  if (!webhookSecret.startsWith("whsec_")) {
    throw new Error("A Stripe webhook signing secret is required.");
  }
  if (secretKey.startsWith("sk_live_") || publishableKey.startsWith("pk_live_")) {
    throw new Error("Live Stripe keys are not allowed.");
  }

  try {
    new URL(siteUrl);
  } catch {
    throw new Error("SITE_URL is not a valid URL.");
  }

  return {
    supabaseUrl,
    anonKey,
    serviceRoleKey,
    secretKey,
    publishableKey,
    webhookSecret,
    siteUrl,
  };
}

export function bearerToken(request: Request): string {
  const header = request.headers.get("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error("Sign in to continue.");
  return match[1].trim();
}
