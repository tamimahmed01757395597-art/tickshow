import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";
import { z } from "npm:zod@3.24.2";
import {
  allowRequest,
  allowedOrigins,
  corsHeaders,
  json,
  readBoundedJson,
} from "../_shared/http.ts";
import { requireStripeTestEnv } from "../_shared/stripe-env.ts";

const sessionSchema = z.object({
  id: z.string().min(1),
  mode: z.string(),
  payment_status: z.string(),
  amount_total: z.number().int().nonnegative().nullable(),
  currency: z.string().min(3).max(3),
  client_reference_id: z.string().nullable().optional(),
  metadata: z.record(z.string()).default({}),
  payment_intent: z.union([z.string(), z.object({ id: z.string() })]).nullable().optional(),
});

const intentSchema = z.object({
  id: z.string().min(1),
  amount_received: z.number().int().nonnegative(),
  currency: z.string().min(3).max(3),
  metadata: z.record(z.string()).default({}),
});

const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
]);

function orderIdFrom(metadata: Record<string, string>, clientReferenceId?: string | null): string | null {
  const candidate = metadata.order_id ?? clientReferenceId ?? "";
  return z.string().uuid().safeParse(candidate).success ? candidate : null;
}

Deno.serve(async (request) => {
  const origins = allowedOrigins();
  const headers = corsHeaders(origins, request);
  if (request.method === "OPTIONS") return new Response("ok", { status: 204, headers });
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, headers);
  }

  const clientKey =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (!allowRequest(`stripe-webhook:${clientKey}`, 300, 60_000)) {
    return json({ error: "Too many webhook requests." }, 429, headers);
  }

  try {
    const env = requireStripeTestEnv();
    const signature = request.headers.get("Stripe-Signature");
    if (!signature) return json({ error: "Missing Stripe signature." }, 400, headers);
    const rawBody = await request.text();
    if (rawBody.length > 1024 * 1024) {
      return json({ error: "Webhook payload is too large." }, 413, headers);
    }

    const stripe = new Stripe(env.secretKey);
    const event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      env.webhookSecret,
    );
    if (event.livemode) {
      return json({ error: "Live Stripe events are not accepted." }, 400, headers);
    }

    // The body was read for signature verification; parse only the sanitized
    // fields we need from the already-verified Stripe event object.
    const parsedBody = z.object({ id: z.string(), type: z.string() }).safeParse(
      await readBoundedJson(new Request("https://local.invalid", {
        method: "POST",
        body: rawBody,
      }), 1024 * 1024),
    );
    if (!parsedBody.success || parsedBody.data.id !== event.id) {
      return json({ error: "Invalid Stripe event." }, 400, headers);
    }

    const serviceClient = createClient(env.supabaseUrl, env.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (!HANDLED_EVENTS.has(event.type)) {
      await serviceClient.rpc("claim_payment_webhook_event", {
        p_event_id: event.id,
        p_event_type: event.type,
        p_payload: { event_id: event.id, event_type: event.type, ignored: true },
      });
      await serviceClient.rpc("finish_payment_webhook_event", { p_event_id: event.id });
      return json({ received: true, ignored: true }, 200, headers);
    }

    let orderId: string | null = null;
    let status: "paid" | "processing" | "failed" | "cancelled" | "expired" = "processing";
    let amountMinor = 0;
    let currency = "";
    let sessionId: string | null = null;
    let paymentIntentId: string | null = null;

    if (event.type.startsWith("checkout.session.")) {
      const parsed = sessionSchema.safeParse(event.data.object);
      if (!parsed.success) return json({ error: "Invalid checkout session event." }, 400, headers);
      const session = parsed.data;
      orderId = orderIdFrom(session.metadata, session.client_reference_id);
      sessionId = session.id;
      paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null;
      currency = session.currency.toUpperCase();
      amountMinor = session.amount_total ?? 0;
      if (session.mode !== "payment") {
        status = "processing";
      } else if (session.payment_status === "paid") {
        status = "paid";
      } else if (session.payment_status === "unpaid") {
        status =
          event.type === "checkout.session.expired"
            ? "expired"
            : event.type === "checkout.session.async_payment_failed"
              ? "failed"
              : "processing";
      } else {
        status = "failed";
      }
    } else {
      const parsed = intentSchema.safeParse(event.data.object);
      if (!parsed.success) return json({ error: "Invalid payment intent event." }, 400, headers);
      const intent = parsed.data;
      orderId = orderIdFrom(intent.metadata);
      paymentIntentId = intent.id;
      currency = intent.currency.toUpperCase();
      amountMinor = intent.amount_received;
      status = event.type === "payment_intent.succeeded" ? "paid" : "failed";
    }

    if (!orderId) {
      return json({ error: "The provider event has no TickShow order reference." }, 400, headers);
    }

    const claimed = await serviceClient.rpc("claim_payment_webhook_event", {
      p_event_id: event.id,
      p_event_type: event.type,
      p_payload: {
        event_id: event.id,
        event_type: event.type,
        order_id: orderId,
        livemode: event.livemode,
      },
    });
    if (claimed.error) throw new Error("The webhook event could not be recorded.");
    if (!claimed.data) return json({ received: true, duplicate: true }, 200, headers);

    try {
      if (status === "paid") {
        if (!amountMinor || !currency) throw new Error("The verified payment is missing an amount.");
        const { error } = await serviceClient.rpc("mark_stripe_order_paid", {
          p_order_id: orderId,
          p_session_id: sessionId,
          p_payment_intent_id: paymentIntentId,
          p_amount_minor: amountMinor,
          p_currency: currency,
        });
        if (error) throw new Error("The paid order could not be finalized.");
      } else if (status === "processing") {
        const { error } = await serviceClient.rpc("mark_stripe_order_processing", {
          p_order_id: orderId,
        });
        if (error) throw new Error("The payment state could not be updated.");
      } else {
        const { error } = await serviceClient.rpc("mark_stripe_order_unpaid", {
          p_order_id: orderId,
          p_status: status,
          p_session_id: sessionId,
          p_payment_intent_id: paymentIntentId,
        });
        if (error) throw new Error("The failed payment could not be recorded.");
      }
      const { error: finishError } = await serviceClient.rpc("finish_payment_webhook_event", {
        p_event_id: event.id,
      });
      if (finishError) throw new Error("The webhook event could not be completed.");
      return json({ received: true }, 200, headers);
    } catch (error) {
      await serviceClient.rpc("release_payment_webhook_event", { p_event_id: event.id });
      throw error;
    }
  } catch (caught: unknown) {
    const message = caught instanceof Error ? caught.message : "Unknown webhook error";
    if (/signature/i.test(message)) {
      return json({ error: "The Stripe signature is invalid." }, 400, headers);
    }
    if (/too large/i.test(message)) {
      return json({ error: "Webhook payload is too large." }, 413, headers);
    }
    if (/configuration|key|webhook signing secret|SITE_URL/i.test(message)) {
      return json({ error: "Payments are not configured." }, 503, headers);
    }
    // Non-2xx responses ask Stripe to retry processing failures.
    console.error("Stripe webhook processing error:", message);
    return json({ error: "The webhook could not be processed." }, 500, headers);
  }
});
