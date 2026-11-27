export type TicketPdfBooking = {
  booking_reference: string;
  quantity: number;
  buyer_name: string;
  event_title: string;
  event_date_label: string | null;
  event_time_label: string | null;
  event_venue: string | null;
  event_location: string | null;
};

export type TicketPdfItem = {
  id: string;
  ticket_number: number;
  token: string;
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
) {
  for (const [index, ticket] of tickets.entries()) {
    if (index > 0) pdf.addPage("a6", "portrait");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const payload = getTicketVerificationUrl(siteUrl, ticket.id, ticket.token);
    const qr = await encodeQr(payload);

    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, pageHeight, "F");
    pdf.setFillColor(202, 255, 66);
    pdf.rect(0, 0, pageWidth, 18, "F");
    pdf.setTextColor(4, 14, 14);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text("TICKSHOW", 8, 12);

    pdf.setTextColor(20, 20, 20);
    pdf.setFontSize(11);
    const titleLines = pdf.splitTextToSize(booking.event_title, pageWidth - 16).slice(0, 3);
    pdf.text(titleLines, 8, 27);
    let y = 27 + titleLines.length * 5 + 2;

    pdf.setTextColor(154, 43, 25);
    pdf.setFontSize(8);
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
      y += Math.max(5, lines.length * 4);
    }

    const qrSize = 34;
    const qrY = pageHeight - 49;
    pdf.addImage(qr, "PNG", (pageWidth - qrSize) / 2, qrY, qrSize, qrSize);
    pdf.setFontSize(7);
    pdf.text("Scan for ticket verification", pageWidth / 2, pageHeight - 11, {
      align: "center",
    });
  }
}
