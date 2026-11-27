export type TicketPdfBooking = {
  booking_reference: string;
  quantity: number;
  buyer_name: string;
  event_title: string;
  event_date_label: string | null;
  event_time_label: string | null;
  event_venue: string | null;
  event_location: string | null;
  ticket_design_style?: string | null;
  ticket_design_image_path?: string | null;
};

export type TicketPdfItem = {
  id: string;
  ticket_number: number;
  token: string;
};

export type TicketDesignStyle = "classic" | "midnight" | "festival" | "neon";

export type TicketArtwork = {
  data: string;
  format: "PNG" | "JPEG";
};

export interface TicketPdfDocument {
  internal: { pageSize: { getWidth(): number; getHeight(): number } };
  addPage(format?: string, orientation?: string): void;
  setFillColor(red: number, green: number, blue: number): void;
  rect(x: number, y: number, width: number, height: number, style?: string): void;
  setTextColor(red: number, green: number, blue: number): void;
  setFont(name: string, style?: string): void;
  setFontSize(size: number): void;
  text(
    value: string | string[],
    x: number,
    y: number,
    options?: { maxWidth?: number; align?: "left" | "center" | "right" },
  ): void;
  splitTextToSize(value: string, width: number): string[];
  addImage(data: string, format: string, x: number, y: number, width: number, height: number): void;
}

export type QrEncoder = (payload: string) => Promise<string>;

function display(value: string | null) {
  return value?.trim() || "To be announced";
}

const TICKET_DESIGNS: Record<
  TicketDesignStyle,
  { accent: [number, number, number]; header: [number, number, number]; headerText: [number, number, number] }
> = {
  classic: { accent: [202, 255, 66], header: [202, 255, 66], headerText: [4, 14, 14] },
  midnight: { accent: [125, 100, 255], header: [17, 22, 48], headerText: [255, 255, 255] },
  festival: { accent: [255, 151, 66], header: [255, 190, 92], headerText: [45, 24, 10] },
  neon: { accent: [0, 224, 190], header: [5, 39, 48], headerText: [255, 255, 255] },
};

function getTicketDesign(style: string | null | undefined) {
  if (style == null || style === "classic") return TICKET_DESIGNS.classic;
  if (style === "midnight" || style === "festival" || style === "neon") {
    return TICKET_DESIGNS[style];
  }
  throw new Error(`Unsupported ticket design style: ${style}`);
}

export async function ticketArtworkFromBlob(blob: Blob): Promise<TicketArtwork> {
  const contentType = blob.type.split(";")[0]?.trim().toLowerCase();
  const format = contentType === "image/png" ? "PNG" : contentType === "image/jpeg" ? "JPEG" : null;
  if (!format) throw new Error("Ticket artwork must be a JPEG or PNG image.");

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return {
    data: `data:${contentType};base64,${btoa(binary)}`,
    format,
  };
}

export function getTicketVerificationUrl(
  siteUrl: string,
  ticketId: string,
  token: string,
) {
  const site = siteUrl.replace(/\/+$/, "");
  return `${site}/#/ticket/${encodeURIComponent(ticketId)}?v=${encodeURIComponent(token)}`;
}

export async function addTicketPages(
  pdf: TicketPdfDocument,
  booking: TicketPdfBooking,
  tickets: TicketPdfItem[],
  siteUrl: string,
  encodeQr: QrEncoder,
  artwork?: TicketArtwork | null,
) {
  const design = getTicketDesign(booking.ticket_design_style);
  for (const [index, ticket] of tickets.entries()) {
    if (index > 0) pdf.addPage("a6", "portrait");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const payload = getTicketVerificationUrl(siteUrl, ticket.id, ticket.token);
    const qr = await encodeQr(payload);

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, pageHeight, "F");
    if (artwork) {
      pdf.addImage(artwork.data, artwork.format, 0, 0, pageWidth, pageHeight);
      pdf.setFillColor(255, 255, 255);
      pdf.rect(5, 16, pageWidth - 10, pageHeight - 65, "F");
      pdf.setFillColor(...design.accent);
      pdf.rect(5, 16, pageWidth - 10, 2, "F");
    } else {
      pdf.setFillColor(...design.header);
      pdf.rect(0, 0, pageWidth, 18, "F");
    }

    if (artwork) pdf.setTextColor(4, 14, 14);
    else pdf.setTextColor(...design.headerText);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text("TICKSHOW", 8, artwork ? 27 : 12);

    pdf.setTextColor(20, 20, 20);
    pdf.setFontSize(11);
    const titleLines = pdf.splitTextToSize(booking.event_title, pageWidth - 16).slice(0, 3);
    const titleY = artwork ? 36 : 27;
    pdf.text(titleLines, 8, titleY);
    let y = titleY + titleLines.length * 5 + 2;

    pdf.setTextColor(154, 43, 25);
    pdf.setFontSize(artwork ? 7 : 8);
    pdf.text("DEMO / TEST TICKET — NOT VALID FOR PAID ENTRY", 8, y);
    y += 7;

    pdf.setTextColor(35, 35, 35);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    const rows = [
      ["Reference", booking.booking_reference],
      ["Ticket", `${ticket.ticket_number} of ${booking.quantity}`],
      ["Guest", booking.buyer_name],
      ["Date / time", `${display(booking.event_date_label)} · ${display(booking.event_time_label)}`],
      ["Venue", display(booking.event_venue)],
      ["Location", display(booking.event_location)],
    ];
    for (const [label, value] of rows) {
      const lines = pdf.splitTextToSize(value, pageWidth - 36).slice(0, 2);
      pdf.setFont("helvetica", "bold");
      pdf.text(`${label}:`, 8, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(lines, 31, y);
      y += Math.max(artwork ? 4 : 5, lines.length * (artwork ? 3 : 4));
    }

    const qrSize = 34;
    const qrY = pageHeight - 49;
    if (artwork) {
      pdf.setFillColor(255, 255, 255);
      pdf.rect(pageWidth / 2 - 20, qrY - 2, 40, 42, "F");
    }
    pdf.addImage(qr, "PNG", (pageWidth - qrSize) / 2, qrY, qrSize, qrSize);
    pdf.setFontSize(7);
    pdf.text("Scan for ticket verification", pageWidth / 2, pageHeight - 11, {
      align: "center",
    });
  }
}
