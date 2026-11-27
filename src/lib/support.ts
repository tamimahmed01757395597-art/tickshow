import { requireSupabase } from "./supabase";

export type SupportFormType = "contact" | "support";

export async function submitSupportMessage(input: {
  email: string;
  message: string;
  formType: SupportFormType;
}): Promise<void> {
  const email = input.email.trim().toLowerCase();
  const message = input.message.trim();
  if (!email || !message) {
    throw new Error("Enter your email and a message.");
  }
  if (message.length > 5000) {
    throw new Error("Your message must be 5,000 characters or fewer.");
  }

  const { error } = await requireSupabase().from("support_messages").insert({
    sender_email: email,
    form_type: input.formType,
    message,
  });
  if (error) throw new Error(error.message);
}
