import { z } from "zod";
import { functionErrorMessage } from "./function-error";
import { requireSupabase } from "./supabase";

const orderSchema = z.object({
  id: z.string().uuid(),
  order_number: z.string(),
  status: z.enum(["pending", "paid", "failed", "cancelled", "refunded", "expired"]),
  total_amount: z.coerce.number(),
  currency: z.string(),
  buyer_name: z.string(),
  buyer_email: z.string(),
  paid_at: z.string().nullable(),
  created_at: z.string(),
  ticket_assets_status: z.enum(["pending", "generating", "ready"]).optional(),
  ticket_email_status: z.enum(["pending", "sending", "sent", "failed"]).optional(),
  payments: z
    .array(
      z.object({
        status: z.enum([
          "pending",
          "processing",
          "succeeded",
          "failed",
          "cancelled",
          "refunded",
          "partially_refunded",
        ]),
        verified_at: z.string().nullable(),
        provider: z.string().optional(),
      }),
    )
    .optional(),
  events: z
    .object({ title: z.string(), venue_name: z.string().nullable(), starts_at: z.string() })
    .nullable()
    .optional(),
});

export type PaidOrder = z.infer<typeof orderSchema>;

export async function fetchOrder(reference: string): Promise<PaidOrder | null> {
  const normalized = reference.trim().toUpperCase();
  if (!/^TS-[A-Z0-9]{6,32}$/.test(normalized)) return null;
  const { data, error } = await requireSupabase()
    .from("orders")
    .select(
      "id, order_number, status, total_amount, currency, buyer_name, buyer_email, paid_at, created_at, ticket_assets_status, ticket_email_status, payments(status, verified_at, provider), events(title, venue_name, starts_at)",
    )
    .eq("order_number", normalized)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const parsed = orderSchema.safeParse(data);
  if (!parsed.success) throw new Error("The order response was not valid.");
  return parsed.data;
}

export async function sendPaidOrderTickets(orderId: string, resend = false): Promise<void> {
  const { error } = await requireSupabase().functions.invoke("send-storefront-ticket", {
    body: { action: resend ? "resend" : "send", order_id: orderId },
  });
  if (error) {
    throw new Error(await functionErrorMessage(error, "The ticket email could not be sent."));
  }
}
