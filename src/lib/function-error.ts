import { FunctionsHttpError } from "@supabase/supabase-js";

export async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (!(error instanceof FunctionsHttpError) || !(error.context instanceof Response)) {
    return error instanceof Error && error.message ? error.message : fallback;
  }
  try {
    const body: unknown = await error.context.clone().json();
    if (body && typeof body === "object" && "error" in body) {
      const message = (body as { error?: unknown }).error;
      if (typeof message === "string" && message.trim()) return message;
    }
  } catch {
    return fallback;
  }
  return fallback;
}
