import { z } from "zod";
import { functionErrorMessage } from "./function-error";
import { requireSupabase } from "./supabase";

const checkoutInput = z.object({
  eventSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  quantity: z.number().int().min(1).max(8),
  buyerName: z.string().trim().min(1).max(160),
  buyerPhone: z.string().trim().min(7).max(32),
});

const checkoutResponse = z.object({
  url: z.string().url(),
  orderNumber: z.string().min(1),
  mode: z.literal("test"),
});

export type CheckoutInput = z.infer<typeof checkoutInput>;

export async function startStripeCheckout(input: CheckoutInput): Promise<void> {
  const payload = checkoutInput.parse(input);
  const { data, error } = await requireSupabase().functions.invoke<unknown>(
    "create-checkout-session",
    { body: payload },
  );
  if (error) {
    throw new Error(
      await functionErrorMessage(error, "Checkout could not be started. Please try again."),
    );
  }
  const result = checkoutResponse.safeParse(data);
  if (!result.success) throw new Error("The payment service returned an invalid response.");
  window.location.assign(result.data.url);
}
