import { createClient } from "npm:@supabase/supabase-js@2";

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  headers: Record<string, string>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character]!;
  });
}

function secureToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashToken(token: string) {
  const bytes = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function organizerSlug(name: string) {
  const stem = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "organizer";
  return `${stem}-${crypto.randomUUID().slice(0, 8)}`;
}

Deno.serve(async (request) => {
  const siteUrl = Deno.env.get("SITE_URL")?.trim() ?? "";
  let siteOrigin = "";
  try {
    if (siteUrl) siteOrigin = new URL(siteUrl).origin;
  } catch {
    siteOrigin = "";
  }
  const allowedOrigins = new Set([
    siteOrigin,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ].filter(Boolean));
  const origin = request.headers.get("Origin") ?? "";
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin)
      ? origin
      : siteOrigin || "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };

  if (origin && !allowedOrigins.has(origin)) {
    return jsonResponse({ error: "Origin is not allowed." }, 403, corsHeaders);
  }
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, corsHeaders);
  }

  let invitationId = "";
  let userClient: ReturnType<typeof createClient> | null = null;
  let status = 500;
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    const fromEmail = Deno.env.get("BREVO_FROM_EMAIL")?.trim();
    const fromName = Deno.env.get("BREVO_FROM_NAME")?.trim() || "TickShow";
    if (!supabaseUrl || !anonKey || !brevoApiKey || !fromEmail || !siteOrigin) {
      throw new Error("Organizer invitations are not configured.");
    }

    const authorization = request.headers.get("Authorization");
    if (!authorization) {
      status = 401;
      throw new Error("Sign in as an administrator to invite organizers.");
    }
    userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      status = 401;
      throw new Error("Sign in as an administrator to invite organizers.");
    }
    const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
      p_role: "admin",
    });
    if (roleError || !isAdmin) {
      status = 403;
      throw new Error("Only administrators can invite organizers.");
    }

    const input: unknown = await request.json();
    if (!input || typeof input !== "object") {
      status = 400;
      throw new Error("Enter an organizer name and email address.");
    }
    const fields = input as { organizer_name?: unknown; email?: unknown };
    const name = typeof fields.organizer_name === "string" ? fields.organizer_name.trim() : "";
    const email = typeof fields.email === "string" ? fields.email.trim().toLowerCase() : "";
    if (name.length < 1 || name.length > 160) {
      status = 400;
      throw new Error("Enter an organizer name between 1 and 160 characters.");
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      status = 400;
      throw new Error("Enter a valid organizer email address.");
    }

    const token = secureToken();
    const { data: invitation, error: invitationError } = await userClient.rpc(
      "create_organizer_invitation",
      {
        p_email: email,
        p_organizer_name: name,
        p_organizer_slug: organizerSlug(name),
        p_token_hash: await hashToken(token),
        p_expires_in: "7 days",
      },
    );
    if (invitationError || !invitation?.id) {
      status = 400;
      throw new Error(invitationError?.message ?? "Could not create organizer invitation.");
    }
    invitationId = invitation.id;

    const inviteUrl = `${siteOrigin}/#/signup?organizer_invite=${encodeURIComponent(token)}`;
    const htmlContent = `
      <p>Hello ${escapeHtml(name)},</p>
      <p>You have been invited to create an organizer account on TickShow.</p>
      <p><a href="${escapeHtml(inviteUrl)}">Accept organizer invitation</a></p>
      <p>Use this email address when signing up. Your organizer profile will be pending until TickShow approves it.</p>
      <p>This invitation expires in 7 days. If you were not expecting it, you can ignore this email.</p>
    `;
    const textContent =
      `Hello ${name},\n\n` +
      "You have been invited to create an organizer account on TickShow.\n" +
      `Accept the invitation: ${inviteUrl}\n\n` +
      "Use this email address when signing up. Your organizer profile will be pending until TickShow approves it.\n" +
      "This invitation expires in 7 days. If you were not expecting it, you can ignore this email.";
    const emailResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: fromEmail, name: fromName },
        to: [{ email, name }],
        subject: `Invitation to join TickShow as ${name}`,
        htmlContent,
        textContent,
      }),
    });
    if (!emailResponse.ok) {
      const body: unknown = await emailResponse.json().catch(() => null);
      const detail =
        body && typeof body === "object" && "message" in body &&
          typeof body.message === "string"
          ? body.message
          : `Brevo returned HTTP ${emailResponse.status}.`;
      status = 502;
      throw new Error(detail);
    }

    return jsonResponse({ invited: true }, 200, corsHeaders);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send organizer invitation.";
    if (invitationId && userClient) {
      const { error: cancelError } = await userClient.rpc("cancel_organizer_invitation", {
        p_invitation_id: invitationId,
      });
      if (cancelError) {
        return jsonResponse(
          { error: `${message} The unused invitation could not be removed: ${cancelError.message}` },
          500,
          corsHeaders,
        );
      }
    }
    return jsonResponse({ error: message }, status, corsHeaders);
  }
});
