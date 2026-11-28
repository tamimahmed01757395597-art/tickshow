import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";
import { z } from "npm:zod@3.24.2";
import {
  allowRequest,
  allowedOrigins,
  corsHeaders,
  isOriginAllowed,
  json,
  readBoundedJson,
} from "../_shared/http.ts";
import { bearerToken, requireStripeTestEnv } from "../_shared/stripe-env.ts";

const bodySchema = z.object({
  eventSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  quantity: z.number().int().min(1).max(8),
  buyerName: z.string().trim().min(1).max(160),
  buyerPhone: z.string().trim().min(7).max(32),
});

type CreatedOrder = {
  order_id: string;
  order_number: string;
  amount_minor: number | string;
  currency: string;
  event_title: string;
};

function publicError(caught: unknown): { status: number; message: string } {
  if (caught instanceof z.ZodError) {
    return { status: 400, message: "Check the details you entered and try again." };
  }
  const message = caught instanceof Error ? caught.message : "Checkout could not be started.";
  if (/too large/i.test(message)) {
    return { status: 413, message: "The checkout request is too large." };
  }
  if (/json|body is required/i.test(message)) {
    return { status: 400, message: "Check the details you entered and try again." };
  }
  if (
    /not enough|not available|not on sale|no payable|between 1 and 8|valid name|valid email|valid phone|sign in/i.test(
      message,
    )
  ) {
    return { status: 400, message };
  }
  if (/^Stripe:/.test(message)) return { status: 502, message: "Stripe is unavailable right now." };
  if (/configuration|keys|webhook|SITE_URL/i.test(message)) {
    return { status: 503, message: "Payments are not configured." };
  }
  return { status: 500, message: "Checkout could not be started. Please try again." };
}

Deno.serve(async (request) => {
  const origins = allowedOrigins();
  const headers = corsHeaders(origins, request);

  if (!isOriginAllowed(origins, request)) {
    return json({ error: "Origin is not allowed." }, 403, headers);
  }
  if (request.method === "OPTIONS") return new Response("ok", { status: 204, headers });
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, headers);
  }

  try {
    const env = requireStripeTestEnv();
    const token = bearerToken(request);
    const userClient = createClient(env.supabaseUrl, env.anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) {
      return json({ error: "Sign in to continue." }, 401, headers);
    }
    const email = authData.user.email?.trim().toLowerCase();
    if (!email) {
      return json({ error: "Your account needs a verified email before checkout." }, 400, headers);
    }
    if (!allowRequest(`checkout:${authData.user.id}`, 8, 60_000)) {
      return json({ error: "Too many checkout attempts. Try again in a minute." }, 429, headers);
    }

    const input = bodySchema.parse(await readBoundedJson(request, 8 * 1024));
    const serviceClient = createClient(env.supabaseUrl, env.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: order, error: orderError } = await serviceClient.rpc(
      "create_stripe_checkout_order",
      {
        p_event_slug: input.eventSlug,
        p_quantity: input.quantity,
        p_buyer_name: input.buyerName,
        p_buyer_email: email,
        p_buyer_phone: input.buyerPhone,
        p_customer_id: authData.user.id,
      },
    );
    if (orderError || !order) {
      throw new Error(orderError?.message ?? "The order could not be created.");
    }
    const created = (Array.isArray(order) ? order[0] : order) as CreatedOrder | undefined;
    if (!created?.order_id) throw new Error("The order could not be created.");

    const amountMinor = Number(created.amount_minor);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw new Error("This event has no payable ticket price configured.");
    }

    const stripe = new Stripe(env.secretKey);
    const metadata = {
      order_id: created.order_id,
      order_number: created.order_number,
      tickshow_mode: "test",
    };
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: email,
        client_reference_id: created.order_number,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: created.currency.toLowerCase(),
              unit_amount: amountMinor,
              product_data: {
                name: `${created.event_title} — TickShow tickets`,
                description: `${input.quantity} ticket${input.quantity === 1 ? "" : "s"}`,
              },
            },
          },
        ],
        success_url: `${env.siteUrl}/#/payment/confirmation?order=${encodeURIComponent(
          created.order_number,
        )}&session={CHECKOUT_SESSION_ID}`,
        cancel_url: `${env.siteUrl}/#/payment/cancelled?order=${encodeURIComponent(
          created.order_number,
        )}`,
        metadata,
        payment_intent_data: { metadata },
      },
      { idempotencyKey: created.order_number },
    );
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");

    const { error: paymentError } = await serviceClient
      .from("payments")
      .update({
        checkout_session_id: session.id,
        transaction_reference: session.id,
      })
      .eq("order_id", created.order_id)
      .eq("status", "pending");
    if (paymentError) throw new Error("The checkout session could not be saved.");

    return json(
      {
        url: session.url,
        orderNumber: created.order_number,
        publishableKey: env.publishableKey,
        mode: "test",
      },
      200,
      headers,
    );
  } catch (caught: unknown) {
    const mapped = publicError(caught);
    return json({ error: mapped.message }, mapped.status, headers);
  }
});
