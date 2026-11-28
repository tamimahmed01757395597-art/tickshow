import { createClient } from "npm:@supabase/supabase-js@2";
import QRCode from "npm:qrcode@1.5.4";
import { jsPDF } from "npm:jspdf@4.2.1";
import {
  addTicketPages,
  ticketArtworkFromBlob,
  type TicketPdfAssets,
} from "../../../src/lib/ticket-pdf.ts";
import { normalizeTicketDesign } from "../../../src/lib/ticket-design.ts";

type Order = {
  id: string;
  order_number: string;
  event_id: string;
  customer_id: string | null;
  buyer_name: string;
  buyer_email: string;
  status: string;
  paid_at: string | null;
  ticket_assets_status: "pending" | "generating" | "ready";
  ticket_pdf_path: string | null;
  ticket_email_status: "pending" | "sending" | "sent" | "failed";
};

type Event = {
  title: string;
  starts_at: string;
  venue_name: string | null;
  venue_address: string | null;
  venue_city: string | null;
  ticket_design: unknown;
};

type OrderItem = {
  id: string;
  quantity: number;
  ticket_type_id: string;
};

type Ticket = {
  id: string;
  order_item_id: string;
  order_item_ticket_number: number;
  order_ticket_number: number;
};

function response(
  body: Record<string, unknown>,
  status: number,
  headers: Record<string, string>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function secureToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashToken(token: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
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

function formatEventDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("The event start time is invalid.");
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
}

function formatEventTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("The event start time is invalid.");
  return new Intl.DateTimeFormat("en-US", {
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

async function loadAssets(
  event: Event,
  serviceClient: ReturnType<typeof createClient>,
): Promise<TicketPdfAssets> {
  const design = normalizeTicketDesign(event.ticket_design);
  const assets: TicketPdfAssets = {};
  for (const [field, key] of [
    ["logoPath", "logo"],
    ["backgroundImagePath", "background"],
  ] as const) {
    const path = design[field];
    if (!path) continue;
    const { data, error } = await serviceClient.storage
      .from("ticket-design-assets")
      .download(path);
    if (error || !data) throw new Error("Could not load this event's ticket design image.");
    assets[key] = await ticketArtworkFromBlob(data);
  }
  return assets;
}

async function createPaidTicketPdf(
  order: Order,
  event: Event,
  tickets: Array<Ticket & { token: string }>,
  assets: TicketPdfAssets,
  siteUrl: string,
) {
  const pdf = new jsPDF({ unit: "mm", format: "a6", orientation: "portrait" });
  const booking = {
    booking_reference: order.order_number,
    quantity: tickets.length,
    buyer_name: order.buyer_name,
    event_title: event.title,
    event_date_label: formatEventDate(event.starts_at),
    event_time_label: formatEventTime(event.starts_at),
    event_venue: event.venue_name,
    event_location: [event.venue_address, event.venue_city].filter(Boolean).join(", "),
    is_demo: false,
    ticket_design: event.ticket_design,
  };
  await addTicketPages(
    pdf,
    booking,
    tickets.map((ticket) => ({
      id: ticket.id,
      ticket_number: ticket.order_ticket_number,
      token: ticket.token,
    })),
    siteUrl,
    (payload) =>
      QRCode.toDataURL(payload, {
        width: 360,
        margin: 1,
        errorCorrectionLevel: "H",
      }),
    assets,
  );
  const blob = new Blob([pdf.output("arraybuffer")], { type: "application/pdf" });
  if (blob.size > 10 * 1024 * 1024) {
    throw new Error("The generated ticket PDF exceeds the private storage size limit.");
  }
  return blob;
}

Deno.serve(async (request) => {
  const siteUrl = Deno.env.get("SITE_URL")?.trim() ?? "";
  let siteOrigin = "";
  try {
    if (siteUrl) siteOrigin = new URL(siteUrl).origin;
  } catch {
    siteOrigin = "";
  }
  const allowedOrigins = new Set([siteOrigin, "http://localhost:5173", "http://127.0.0.1:5173"]);
  const origin = request.headers.get("Origin") ?? "";
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin)
      ? origin
      : siteOrigin || "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };

  if (origin && !allowedOrigins.has(origin)) return response({ error: "Origin is not allowed." }, 403, corsHeaders);
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "Method not allowed." }, 405, corsHeaders);

  let userClient: ReturnType<typeof createClient> | null = null;
  let serviceClient: ReturnType<typeof createClient> | null = null;
  let orderId = "";
  let eventTitle = "";
  let assetsClaimed = false;
  let emailClaimed = false;

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
      throw new Error("Paid ticket delivery is not configured.");
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) throw new Error("Sign in to access your paid order.");
    userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) throw new Error("Sign in to access your paid order.");
    serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("Invalid request.");
    const input = body as { action?: unknown; order_id?: unknown };
    if (input.action !== "send" && input.action !== "resend") {
      throw new Error("Choose a valid ticket email action.");
    }
    if (typeof input.order_id !== "string" || !/^[0-9a-f-]{36}$/i.test(input.order_id)) {
      throw new Error("A valid order ID is required.");
    }
    orderId = input.order_id;

    const { data: order, error: orderError } = await serviceClient
      .from("orders")
      .select("id, order_number, event_id, customer_id, buyer_name, buyer_email, status, paid_at, ticket_assets_status, ticket_pdf_path, ticket_email_status")
      .eq("id", orderId)
      .single();
    if (orderError || !order) throw new Error("Paid order not found.");
    const typedOrder = order as Order;
    const { data: isAdmin, error: adminError } = await userClient.rpc("is_admin");
    if (adminError) throw new Error("Could not verify order access.");
    const email = authData.user.email?.toLowerCase();
    if (
      !isAdmin &&
      typedOrder.customer_id !== authData.user.id &&
      (!email || email !== typedOrder.buyer_email.toLowerCase())
    ) {
      throw new Error("You are not allowed to access this order.");
    }
    const ticketBucket = serviceClient.storage.from("ticket-files");
    let pdfBlob: Blob | null = null;
    if (typedOrder.ticket_assets_status === "ready" && typedOrder.ticket_pdf_path) {
      const { data, error } = await ticketBucket.download(typedOrder.ticket_pdf_path);
      if (error || !data) {
        throw new Error("The saved paid ticket PDF is unavailable; contact support before retrying.");
      }
      pdfBlob = data;
    } else {
      const { data: claimed, error: claimError } = await userClient.rpc(
        "claim_order_ticket_assets",
        { p_order_id: orderId },
      );
      if (claimError) throw new Error("Could not claim paid ticket preparation.");
      if (!claimed) {
        const { data: latest, error: latestError } = await serviceClient
          .from("orders")
          .select("ticket_assets_status, ticket_pdf_path")
          .eq("id", orderId)
          .single();
        if (latestError) throw new Error("Could not check paid ticket preparation status.");
        if (latest?.ticket_assets_status === "ready" && latest.ticket_pdf_path) {
          const { data, error } = await ticketBucket.download(latest.ticket_pdf_path);
          if (error || !data) throw new Error("The saved paid ticket PDF is unavailable.");
          pdfBlob = data;
        } else {
          return response({ error: "Paid tickets are already being prepared. Try again shortly." }, 409, corsHeaders);
        }
      } else {
        assetsClaimed = true;
        try {
          const [eventResult, itemResult] = await Promise.all([
            serviceClient.from("events")
              .select("title, starts_at, venue_name, venue_address, venue_city, ticket_design")
              .eq("id", typedOrder.event_id)
              .single(),
            serviceClient.from("order_items")
              .select("id, quantity, ticket_type_id")
              .eq("order_id", orderId)
              .order("created_at", { ascending: true }),
          ]);
          if (eventResult.error || !eventResult.data) throw new Error("Could not load event details.");
          if (itemResult.error || !itemResult.data?.length) throw new Error("Could not load order tickets.");
          const event = eventResult.data as Event;
          eventTitle = event.title;
          const items = itemResult.data as OrderItem[];
          const { data: existing, error: existingError } = await serviceClient
            .from("tickets")
            .select("id, order_item_id, order_item_ticket_number, order_ticket_number")
            .eq("order_id", orderId)
            .order("order_ticket_number", { ascending: true });
          if (existingError) throw new Error("Could not load existing ticket records.");

          const tickets = (existing ?? []) as Ticket[];
          const nextOrderNumber = tickets.reduce(
            (highest, ticket) => Math.max(highest, ticket.order_ticket_number),
            0,
          ) + 1;
          const ticketRows: Array<Record<string, unknown>> = [];
          let orderTicketNumber = nextOrderNumber;
          for (const item of items) {
            const existingNumbers = new Set(
              tickets
                .filter((ticket) => ticket.order_item_id === item.id)
                .map((ticket) => ticket.order_item_ticket_number),
            );
            for (let itemNumber = 1; itemNumber <= item.quantity; itemNumber += 1) {
              if (!existingNumbers.has(itemNumber)) {
                ticketRows.push({
                  order_id: orderId,
                  order_item_id: item.id,
                  customer_id: typedOrder.customer_id,
                  event_id: typedOrder.event_id,
                  ticket_type_id: item.ticket_type_id,
                  order_item_ticket_number: itemNumber,
                  order_ticket_number: orderTicketNumber++,
                  qr_token_hash: await hashToken(secureToken()),
                });
              }
            }
          }
          if (tickets.length + ticketRows.length !== items.reduce((sum, item) => sum + item.quantity, 0)) {
            throw new Error("Ticket records do not match the quantities in this order.");
          }
          if (ticketRows.length) {
            const { error } = await serviceClient.from("tickets").insert(ticketRows);
            if (error) throw new Error("Could not issue paid ticket records.");
          }

          const { data: allTickets, error: ticketError } = await serviceClient
            .from("tickets")
            .select("id, order_item_id, order_item_ticket_number, order_ticket_number")
            .eq("order_id", orderId)
            .order("order_ticket_number", { ascending: true });
          if (ticketError || !allTickets || allTickets.length !== items.reduce((sum, item) => sum + item.quantity, 0)) {
            throw new Error("Ticket records do not match this order's quantity.");
          }

          const ticketItems: Array<Ticket & { token: string }> = [];
          for (const row of allTickets as Ticket[]) {
            const token = secureToken();
            const { error } = await serviceClient
              .from("tickets")
              .update({ qr_token_hash: await hashToken(token), token_issued_at: new Date().toISOString() })
              .eq("id", row.id)
              .eq("order_id", orderId);
            if (error) throw new Error("Could not rotate a paid ticket QR token.");
            ticketItems.push({ ...row, token });
          }

          const assets = await loadAssets(event, serviceClient);
          pdfBlob = await createPaidTicketPdf(
            typedOrder,
            event,
            ticketItems,
            assets,
            siteUrl,
          );
          const path = `${orderId}/paid-orders/tickets.pdf`;
          const { error: uploadError } = await ticketBucket.upload(path, pdfBlob, {
            contentType: "application/pdf",
            upsert: true,
          });
          if (uploadError) throw new Error("Could not save the paid ticket PDF.");
          const { error: finishError } = await serviceClient.rpc("finish_order_ticket_assets", {
            p_order_id: orderId,
            p_ready: true,
            p_pdf_path: path,
          });
          if (finishError) throw new Error("Could not finalize paid ticket preparation.");
          assetsClaimed = false;
        } catch (caught) {
          await serviceClient.rpc("finish_order_ticket_assets", {
            p_order_id: orderId,
            p_ready: false,
            p_pdf_path: null,
          });
          assetsClaimed = false;
          throw caught;
        }
      }
    }

    if (!pdfBlob) throw new Error("The paid ticket PDF is not available.");
    if (!eventTitle) {
      const { data: event, error: eventError } = await serviceClient
        .from("events")
        .select("title")
        .eq("id", typedOrder.event_id)
        .single();
      if (eventError || !event) throw new Error("Could not load the event name for the ticket email.");
      eventTitle = event.title;
    }
    const { data: emailClaim, error: emailClaimError } = await userClient.rpc(
      "claim_order_ticket_email",
      { p_order_id: orderId, p_resend: input.action === "resend" },
    );
    if (emailClaimError) throw new Error("Could not claim this ticket email request.");
    if (!emailClaim) {
      if (typedOrder.ticket_email_status === "sent" && input.action === "send") {
        return response({ sent: false, alreadySent: true }, 200, corsHeaders);
      }
      return response({ error: "This ticket email is already being prepared." }, 409, corsHeaders);
    }
    emailClaimed = true;

    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: brevoFromName, email: brevoFromEmail },
        to: [{ email: typedOrder.buyer_email, name: typedOrder.buyer_name }],
        subject: `Your TickShow ticket — ${typedOrder.order_number}`,
        htmlContent: `<div style="font-family:Arial,sans-serif;color:#111;max-width:640px">
          <h1>Your TickShow ticket is attached</h1>
          <p>Hi ${escapeHtml(typedOrder.buyer_name)}, the PDF ticket for
          <strong>${escapeHtml(eventTitle)}</strong> is attached.</p>
          <p>Order reference: <strong>${escapeHtml(typedOrder.order_number)}</strong></p>
        </div>`,
        attachment: [{
          name: `tickshow-${typedOrder.order_number.toLowerCase()}.pdf`,
          content: toBase64(await pdfBlob.arrayBuffer()),
        }],
      }),
    });
    if (!brevoResponse.ok) {
      let providerMessage = "";
      try {
        const body: unknown = await brevoResponse.json();
        if (body && typeof body === "object" && "message" in body && typeof body.message === "string") {
          providerMessage = body.message.slice(0, 400);
        }
      } catch {
        providerMessage = "";
      }
      throw new Error(providerMessage || `Brevo rejected the email (HTTP ${brevoResponse.status}).`);
    }

    const { error: finishEmailError } = await serviceClient.rpc("finish_order_ticket_email", {
      p_order_id: orderId,
      p_sent: true,
      p_error: null,
    });
    if (finishEmailError) {
      console.error("Paid ticket email sent, but delivery state could not be saved.");
    }
    emailClaimed = false;
    return response({
      sent: true,
      statusSaved: !finishEmailError,
      message: finishEmailError ? "Email sent, but its delivery status could not be saved." : undefined,
    }, 200, corsHeaders);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Paid ticket request failed.";
    if (emailClaimed && serviceClient && orderId) {
      const { error } = await serviceClient.rpc("finish_order_ticket_email", {
        p_order_id: orderId,
        p_sent: false,
        p_error: message,
      });
      if (error) console.error("Could not save the paid ticket email failure state.");
    }
    if (assetsClaimed && serviceClient && orderId) {
      const { error } = await serviceClient.rpc("finish_order_ticket_assets", {
        p_order_id: orderId,
        p_ready: false,
        p_pdf_path: null,
      });
      if (error) console.error("Could not release paid ticket preparation claim.");
    }
    return response({ error: message }, message.includes("not found") ? 404 : 400, corsHeaders);
  }
});
