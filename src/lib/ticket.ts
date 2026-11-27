import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import type { Database } from "../types/database";
import { requireSupabase } from "./supabase";
import { addTicketPages, type TicketPdfItem } from "./ticket-pdf";
import type { TicketPdfDocument } from "./ticket-pdf";

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

function asPdfDocument(pdf: jsPDF): TicketPdfDocument {
  return pdf;
}

export async function createTicketPdf(booking: Booking, tickets: TicketPdfItem[]) {
  const pdf = new jsPDF({ unit: "mm", format: "a6", orientation: "portrait" });
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
    throw new Error("The demo ticket email could not be sent. Check Resend settings and try again.");
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
    throw new Error("The demo ticket PDF could not be downloaded. Please try again.");
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
