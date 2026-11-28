import { createClient } from "npm:@supabase/supabase-js@2";
import QRCode from "npm:qrcode@1.5.4";
import { jsPDF } from "npm:jspdf@4.2.1";
import {
  addTicketPages,
  type TicketPdfAssets,
  ticketArtworkFromBlob,
} from "../../../src/lib/ticket-pdf.ts";
import { normalizeTicketDesign } from "../../../src/lib/ticket-design.ts";

type Action = "send" | "resend" | "download";

type Booking = {
  id: string;
  storefront_event_id: string | null;
  booking_reference: string;
  customer_id: string;
  buyer_name: string;
  buyer_email: string;
  event_title: string;
  event_date_label: string | null;
  event_time_label: string | null;
  event_venue: string | null;
  event_location: string | null;
  ticket_design_style: string;
  ticket_design_image_path: string | null;
  ticket_design: unknown;
  quantity: number;
  is_demo: boolean;
  ticket_email_status: "pending" | "sending" | "sent" | "failed";
  ticket_emailed_at: string | null;
  ticket_downloaded_at: string | null;
};

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

function toBase64(bytes: ArrayBuffer) {
  const data = new Uint8Array(bytes);
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < data.length; offset += chunkSize) {
    binary += String.fromCharCode(...data.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function ticketPath(bookingId: string) {
  return `storefront-bookings/${bookingId}/tickets.pdf`;
}

async function buildTicketPdf(
  booking: Booking,
  tickets: Array<{ id: string; ticket_number: number; token: string }>,
  siteUrl: string,
  assets: TicketPdfAssets,
) {
  const pdf = new jsPDF({ unit: "mm", format: "a6", orientation: "portrait" });
  await addTicketPages(
    pdf,
    booking,
    tickets,
    siteUrl,
    (payload) =>
      QRCode.toDataURL(payload, {
        width: 320,
        margin: 1,
        errorCorrectionLevel: "H",
      }),
      assets,
  );
  return new Blob([pdf.output("arraybuffer")], { type: "application/pdf" });
}

async function loadTicketAssets(
  booking: Booking,
  serviceClient: ReturnType<typeof createClient>,
): Promise<TicketPdfAssets> {
  const design = normalizeTicketDesign(booking.ticket_design);
  const assets: TicketPdfAssets = {};
  const load = async (bucket: string, path: string) => {
    const { data, error } = await serviceClient.storage.from(bucket).download(path);
    if (error || !data) throw new Error("Could not load this event's ticket artwork.");
    return ticketArtworkFromBlob(data);
  };
  if (design.logoPath) {
    assets.logo = await load("ticket-design-assets", design.logoPath);
  }
  if (design.backgroundImagePath) {
    assets.background = await load("ticket-design-assets", design.backgroundImagePath);
  } else if (booking.ticket_design_image_path) {
    assets.background = await load("event-images", booking.ticket_design_image_path);
  }
  return assets;
}

Deno.serve(async (request) => {
  const siteUrl = Deno.env.get("SITE_URL")?.trim() ?? "";
  const allowedOrigins = new Set<string>();
  let siteOrigin = "";
  try {
    if (siteUrl) {
      siteOrigin = new URL(siteUrl).origin;
      allowedOrigins.add(siteOrigin);
    }
  } catch {
    siteOrigin = "";
  }
  allowedOrigins.add("http://localhost:5173");
  allowedOrigins.add("http://127.0.0.1:5173");

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

  let reference = "";
  let emailClaimed = false;
  let assetsClaimed = false;
  let userClient: ReturnType<typeof createClient> | null = null;
  let serviceClient: ReturnType<typeof createClient> | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    const brevoFromEmail = Deno.env.get("BREVO_FROM_EMAIL")?.trim();
    const brevoFromName = Deno.env.get("BREVO_FROM_NAME")?.trim() || "TickShow";
    if (
      !supabaseUrl || !anonKey || !serviceRoleKey || !brevoApiKey ||
      !brevoFromEmail || !siteUrl
    ) {
      throw new Error("Ticket delivery is not configured.");
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) throw new Error("Sign in to access your demo ticket.");
    userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) throw new Error("Sign in to access your demo ticket.");

    serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("Invalid request.");
    const input = body as { action?: unknown; booking_reference?: unknown };
    const action = input.action;
    reference = typeof input.booking_reference === "string"
      ? input.booking_reference.trim().toUpperCase()
      : "";
    if (action !== "send" && action !== "resend" && action !== "download") {
      throw new Error("Choose a valid ticket action.");
    }
    if (!/^TS-[A-Z0-9]{10}$/.test(reference)) {
      throw new Error("A valid booking reference is required.");
    }

    const { data: booking, error: bookingError } = await serviceClient
      .from("storefront_bookings")
      .select(
        "id, storefront_event_id, booking_reference, customer_id, buyer_name, buyer_email, event_title, event_date_label, event_time_label, event_venue, event_location, ticket_design_style, ticket_design_image_path, ticket_design, quantity, is_demo, ticket_email_status, ticket_emailed_at, ticket_downloaded_at",
      )
      .eq("booking_reference", reference)
      .eq("customer_id", authData.user.id)
      .eq("is_demo", true)
      .single();
    if (bookingError || !booking) throw new Error("Demo booking not found.");

    if (action !== "download") {
      const { data: claim, error: claimError } = await userClient.rpc(
        "claim_storefront_ticket_email",
        { p_booking_reference: reference, p_resend: action === "resend" },
      );
      if (claimError) throw new Error("Could not claim this ticket email request.");
      if (!claim) {
        const { data: currentBooking } = await serviceClient
          .from("storefront_bookings")
          .select("ticket_email_status")
          .eq("id", booking.id)
          .single();
        if (currentBooking?.ticket_email_status === "sent") {
          return jsonResponse({ sent: false, alreadySent: true }, 200, corsHeaders);
        }
        return jsonResponse(
          { error: "This ticket email is already being prepared. Try again shortly." },
          409,
          corsHeaders,
        );
      }
      emailClaimed = true;
    }

    const path = ticketPath(booking.id);
    const bucket = serviceClient.storage.from("ticket-files");
    let pdfBlob: Blob | null = null;
    if (action !== "resend") {
      const existing = await bucket.download(path);
      if (!existing.error && existing.data) pdfBlob = existing.data;
    }

    if (!pdfBlob) {
      if (
        action === "download" &&
        (booking.ticket_email_status === "sent" ||
          booking.ticket_emailed_at !== null ||
          booking.ticket_downloaded_at !== null)
      ) {
        throw new Error("The previously issued PDF is unavailable. Use resend to issue a fresh demo ticket.");
      }

      const { data: assetClaim, error: assetClaimError } = await userClient.rpc(
        "claim_storefront_ticket_assets",
        { p_booking_reference: reference, p_force: true },
      );
      if (assetClaimError) throw new Error("Could not prepare ticket files.");
      if (!assetClaim) {
        const retry = await bucket.download(path);
        if (!retry.error && retry.data) {
          pdfBlob = retry.data;
        } else {
          throw new Error("Your PDF is being prepared. Please try again in a moment.");
        }
      } else {
        assetsClaimed = true;
        try {
          let pdfBooking = booking as Booking;
          if (action === "resend" && booking.storefront_event_id) {
            const { data: currentEvent, error: eventError } = await serviceClient
              .from("storefront_events")
              .select("ticket_design, ticket_design_image_path")
              .eq("id", booking.storefront_event_id)
              .single();
            if (eventError || !currentEvent) {
              throw new Error("Could not load the current event ticket design.");
            }
            pdfBooking = {
              ...pdfBooking,
              ticket_design: currentEvent.ticket_design,
              ticket_design_image_path: currentEvent.ticket_design_image_path,
            };
          }

          const { data: existingTickets, error: ticketsError } = await serviceClient
            .from("storefront_tickets")
            .select("id, ticket_number")
            .eq("booking_id", booking.id)
            .order("ticket_number", { ascending: true });
          if (ticketsError) throw new Error("Could not load ticket records.");

          let ticketRows = existingTickets ?? [];
          if (ticketRows.length > booking.quantity) {
            throw new Error("Ticket records do not match this booking quantity.");
          }
          if (ticketRows.length < booking.quantity) {
            const existingNumbers = new Set(ticketRows.map((ticket) => ticket.ticket_number));
            const missingRows: Array<{
              booking_id: string;
              ticket_number: number;
              token_hash: string;
            }> = [];
            for (let number = 1; number <= booking.quantity; number += 1) {
              if (!existingNumbers.has(number)) {
                missingRows.push({
                  booking_id: booking.id,
                  ticket_number: number,
                  token_hash: await hashToken(secureToken()),
                });
              }
            }
            const { error: insertError } = await serviceClient
              .from("storefront_tickets")
              .insert(missingRows);
            if (insertError) throw new Error("Could not issue missing demo tickets.");
          }
          const { data: allTickets, error: allTicketsError } = await serviceClient
            .from("storefront_tickets")
            .select("id, ticket_number")
            .eq("booking_id", booking.id)
            .order("ticket_number", { ascending: true });
          if (allTicketsError || !allTickets || allTickets.length !== booking.quantity) {
            throw new Error("Ticket records do not match this booking quantity.");
          }

          const ticketItems: Array<{ id: string; ticket_number: number; token: string }> = [];
          for (const ticket of allTickets) {
            const token = secureToken();
            const { error: updateError } = await serviceClient
              .from("storefront_tickets")
              .update({ token_hash: await hashToken(token) })
              .eq("id", ticket.id)
              .eq("booking_id", booking.id);
            if (updateError) throw new Error("Could not rotate ticket QR tokens.");
            ticketItems.push({ ...ticket, token });
          }
          const assets = await loadTicketAssets(pdfBooking, serviceClient);
          pdfBlob = await buildTicketPdf(pdfBooking, ticketItems, siteUrl, assets);

          if (!pdfBlob) throw new Error("Could not generate the demo ticket PDF.");
          const { error: uploadError } = await bucket.upload(path, pdfBlob, {
            contentType: "application/pdf",
            upsert: true,
          });
          if (uploadError) throw new Error("Could not save the demo ticket PDF.");

          const { error: finishAssetsError } = await userClient.rpc(
            "finish_storefront_ticket_assets",
            { p_booking_reference: reference, p_ready: true },
          );
          if (finishAssetsError) throw new Error("Could not finalize ticket preparation.");
          assetsClaimed = false;
        } catch (error) {
          await userClient.rpc("finish_storefront_ticket_assets", {
            p_booking_reference: reference,
            p_ready: false,
          });
          assetsClaimed = false;
          throw error;
        }
      }
    }

    if (!pdfBlob) {
      const saved = await bucket.download(path);
      if (saved.error || !saved.data) throw new Error("The demo ticket PDF is not available.");
      pdfBlob = saved.data;
    }

    if (action === "download") {
      const { data: signed, error: signedError } = await bucket.createSignedUrl(
        path,
        60,
        { download: `tickshow-demo-${reference.toLowerCase()}.pdf` },
      );
      if (signedError || !signed?.signedUrl) {
        throw new Error("Could not create a secure download link.");
      }
      const { data: downloadClaim, error: downloadClaimError } = await userClient
        .rpc("claim_storefront_ticket_download", { p_booking_reference: reference })
        .single();
      if (downloadClaimError) throw new Error("Could not verify ticket download eligibility.");
      if (!downloadClaim?.claimed) {
        return jsonResponse({ downloaded: false, alreadyDownloaded: true }, 200, corsHeaders);
      }
      return jsonResponse({ downloaded: true, downloadUrl: signed.signedUrl }, 200, corsHeaders);
    }

    const pdfBase64 = toBase64(await pdfBlob.arrayBuffer());
    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: brevoFromName, email: brevoFromEmail },
        to: [{ email: booking.buyer_email, name: booking.buyer_name }],
        subject: `Your TickShow DEMO ticket — ${booking.event_title}`,
        htmlContent: `<div style="font-family:Arial,sans-serif;color:#111;max-width:640px">
          <h1>Your TickShow demo ticket is attached</h1>
          <p>Hi ${escapeHtml(booking.buyer_name)}, the PDF for
          <strong>${escapeHtml(booking.event_title)}</strong> is attached.</p>
          <p>Booking reference: <strong>${escapeHtml(booking.booking_reference)}</strong></p>
          <p>This is a DEMO / TEST ticket. No payment was taken and it is not valid for paid event entry.</p>
        </div>`,
        attachment: [{
          name: `tickshow-demo-${booking.booking_reference.toLowerCase()}.pdf`,
          content: pdfBase64,
        }],
      }),
    });

    if (!brevoResponse.ok) {
      let providerMessage = "";
      try {
        const responseBody: unknown = await brevoResponse.json();
        if (
          responseBody &&
          typeof responseBody === "object" &&
          "message" in responseBody &&
          typeof responseBody.message === "string"
        ) {
          providerMessage = responseBody.message.slice(0, 400);
        }
      } catch {
        providerMessage = "";
      }
      console.error("Brevo rejected demo ticket email:", brevoResponse.status);
      throw new Error(
        providerMessage
          ? `Brevo rejected the email: ${providerMessage}`
          : `Brevo rejected the email (HTTP ${brevoResponse.status}). Check the API key, verified sender, and sending limits.`,
      );
    }

    const { error: finishEmailError } = await userClient.rpc(
      "finish_storefront_ticket_email",
      { p_booking_reference: reference, p_sent: true },
    );
    if (finishEmailError) {
      console.error("Ticket email sent but delivery status could not be saved.");
    }
    emailClaimed = false;
    return jsonResponse(
      {
        sent: true,
        statusSaved: !finishEmailError,
        message: finishEmailError
          ? "Email sent, but its delivery status could not be saved."
          : undefined,
      },
      200,
      corsHeaders,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ticket request failed.";
    if (emailClaimed && userClient && reference) {
      const { error: finishError } = await userClient.rpc(
        "finish_storefront_ticket_email",
        { p_booking_reference: reference, p_sent: false },
      );
      if (finishError) console.error("Could not mark ticket email as failed.");
    }
    if (assetsClaimed && userClient && reference) {
      const { error: finishError } = await userClient.rpc(
        "finish_storefront_ticket_assets",
        { p_booking_reference: reference, p_ready: false },
      );
      if (finishError) console.error("Could not release ticket preparation claim.");
    }
    const status = message.includes("not found") ? 404 : 400;
    return jsonResponse({ error: message }, status, corsHeaders);
  }
});
