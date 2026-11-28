import { FunctionsHttpError } from "@supabase/supabase-js";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { Database } from "../types/database";
import { requireSupabase } from "./supabase";
import {
  addTicketPages,
  ticketArtworkFromBlob,
  type TicketPdfAssets,
  type TicketPdfItem,
} from "./ticket-pdf";
import type { TicketPdfDocument } from "./ticket-pdf";
import { normalizeTicketDesign } from "./ticket-design";

type Booking = Database["public"]["Tables"]["storefront_bookings"]["Row"];

type EmailResult = {
  sent: boolean;
  alreadySent?: boolean;
  message?: string;
};

type DownloadResult = {
  downloaded: boolean;
  alreadyDownloaded?: boolean;
  downloadUrl?: string;
};

async function getFunctionErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof FunctionsHttpError) || !(error.context instanceof Response)) {
    return fallback;
  }

  try {
    const body: unknown = await error.context.clone().json();
    if (
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof body.error === "string"
    ) {
      return body.error;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

function asPdfDocument(pdf: jsPDF): TicketPdfDocument {
  return pdf;
}

export async function createTicketPdf(booking: Booking, tickets: TicketPdfItem[]) {
  const pdf = new jsPDF({ unit: "mm", format: "a6", orientation: "portrait" });
  const design = normalizeTicketDesign(booking.ticket_design);
  const assets: TicketPdfAssets = {};
  const client = requireSupabase();
  const loadAsset = async (bucket: string, path: string) => {
    const { data, error } = await client.storage.from(bucket).download(path);
    if (error) throw new Error(`Could not load ticket design image: ${error.message}`);
    return ticketArtworkFromBlob(data);
  };
  if (design.logoPath) {
    assets.logo = await loadAsset("ticket-design-assets", design.logoPath);
  }
  if (design.backgroundImagePath) {
    assets.background = await loadAsset("ticket-design-assets", design.backgroundImagePath);
  } else if (booking.ticket_design_image_path) {
    assets.background = await loadAsset("event-images", booking.ticket_design_image_path);
  }
  await addTicketPages(
    asPdfDocument(pdf),
    booking,
    tickets,
    window.location.origin + window.location.pathname,
    (payload) =>
      QRCode.toDataURL(payload, {
        width: 320,
        margin: 1,
        errorCorrectionLevel: "H",
      }),
    assets,
  );
  return pdf;
}

export function ticketPdfToBlob(pdf: jsPDF) {
  return pdf.output("blob");
}

export function ticketPdfToBase64(pdf: jsPDF) {
  const bytes = new Uint8Array(pdf.output("arraybuffer"));
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export async function sendTicketEmail(
  bookingReference: string,
  action: "send" | "resend" = "send",
) {
  const { data, error } = await requireSupabase()
    .functions.invoke<EmailResult>("send-ticket-email", {
      body: { action, booking_reference: bookingReference },
    });
  if (error) {
    throw new Error(
      await getFunctionErrorMessage(
        error,
        "The demo ticket email could not be sent. Check Brevo settings and try again.",
      ),
    );
  }
  if (!data) throw new Error("The ticket email service returned no response.");
  if (data.message && !data.sent && !data.alreadySent) {
    throw new Error(data.message);
  }
  return data;
}

export async function downloadTicketPdf(bookingReference: string) {
  const { data, error } = await requireSupabase()
    .functions.invoke<DownloadResult>("send-ticket-email", {
      body: { action: "download", booking_reference: bookingReference },
    });
  if (error) {
    throw new Error(
      await getFunctionErrorMessage(
        error,
        "The demo ticket PDF could not be downloaded. Please try again.",
      ),
    );
  }
  if (!data) throw new Error("The ticket service returned no response.");
  if (data.alreadyDownloaded || !data.downloaded) return false;
  if (!data.downloadUrl) throw new Error("The ticket service did not return a download link.");

  const anchor = document.createElement("a");
  anchor.href = data.downloadUrl;
  anchor.download = `tickshow-${bookingReference.toLowerCase()}.pdf`;
  anchor.rel = "noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return true;
}
