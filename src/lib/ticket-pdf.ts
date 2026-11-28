import { normalizeTicketDesign } from "./ticket-design.ts";

export type TicketPdfBooking = {
  booking_reference: string;
  quantity: number;
  buyer_name: string;
  event_title: string;
  event_date_label: string | null;
  event_time_label: string | null;
  event_venue: string | null;
  event_location: string | null;
  is_demo: boolean;
  ticket_design?: unknown;
  ticket_design_image_path?: string | null;
};

export type TicketPdfItem = {
  id: string;
  ticket_number: number;
  token: string;
};

export type TicketArtwork = {
  data: string;
  format: "PNG" | "JPEG";
  width: number;
  height: number;
};

export type TicketPdfAssets = {
  logo?: TicketArtwork | null;
  background?: TicketArtwork | null;
};

export interface TicketPdfDocument {
  internal: { pageSize: { getWidth(): number; getHeight(): number } };
  addPage(format?: string, orientation?: string): void;
  setFillColor(red: number, green: number, blue: number): void;
  setDrawColor(red: number, green: number, blue: number): void;
  setLineWidth(width: number): void;
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

function colorTuple(color: string): [number, number, number] {
  const hex = color.slice(1);
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

export async function ticketArtworkFromBlob(blob: Blob): Promise<TicketArtwork> {
  const contentType = blob.type.split(";")[0]?.trim().toLowerCase();
  const format = contentType === "image/png" ? "PNG" : contentType === "image/jpeg" ? "JPEG" : null;
  if (!format) throw new Error("Ticket artwork must be a JPEG or PNG image.");

  const bytes = new Uint8Array(await blob.arrayBuffer());
  let width = 0;
  let height = 0;
  if (format === "PNG" && bytes.length >= 24) {
    width = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(16);
    height = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(20);
  } else if (format === "JPEG") {
    for (let offset = 2; offset + 9 < bytes.length;) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        height = (bytes[offset + 5] << 8) | bytes[offset + 6];
        width = (bytes[offset + 7] << 8) | bytes[offset + 8];
        break;
      }
      if (segmentLength < 2) break;
      offset += segmentLength + 2;
    }
  }
  if (!width || !height) throw new Error("Could not read ticket artwork dimensions.");
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return {
    data: `data:${contentType};base64,${btoa(binary)}`,
    format,
    width,
    height,
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
  assets?: TicketPdfAssets | null,
) {
  const design = normalizeTicketDesign(booking.ticket_design);
  for (const [index, ticket] of tickets.entries()) {
    if (index > 0) pdf.addPage("a6", "portrait");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const payload = getTicketVerificationUrl(siteUrl, ticket.id, ticket.token);
    const qr = await encodeQr(payload);
    const background = colorTuple(design.backgroundColor);
    const primary = colorTuple(design.primaryColor);
    const secondary = colorTuple(design.secondaryColor);
    pdf.setFillColor(...background);
    pdf.rect(0, 0, pageWidth, pageHeight, "F");
    if (assets?.background) {
      const image = fitImage(assets.background, pageWidth, pageHeight);
      pdf.addImage(
        assets.background.data,
        assets.background.format,
        image.x,
        image.y,
        image.width,
        image.height,
      );
    }
    pdf.setFillColor(...primary);
    pdf.rect(0, 0, pageWidth, 4, "F");
    pdf.setDrawColor(...secondary);
    pdf.setLineWidth(0.7);
    pdf.rect(4, 4, pageWidth - 8, pageHeight - 8, "S");

    if (assets?.logo) {
      const logo = fitImage(assets.logo, 22, 14);
      pdf.addImage(
        assets.logo.data,
        assets.logo.format,
        8 + logo.x,
        9 + logo.y,
        logo.width,
        logo.height,
      );
    }
    pdf.setTextColor(...secondary);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("TICKSHOW", assets?.logo ? 34 : 8, 14);

    const align = design.textAlign;
    const centerX = pageWidth / 2;
    const titleX = align === "left" ? 8 : align === "right" ? pageWidth - 8 : centerX;
    const title = design.title.trim() || booking.event_title;
    pdf.setFontSize(design.fontSize * 0.75);
    const titleLines = pdf.splitTextToSize(title, pageWidth - 16);
    const titleY = 25;
    pdf.setFont("helvetica", "bold");
    pdf.text(titleLines, titleX, titleY, { align, maxWidth: pageWidth - 16 });
    let y = titleY + titleLines.length * Math.max(4, design.fontSize * 0.26) + 2;

    if (design.subtitle) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      const subtitleLines = pdf.splitTextToSize(design.subtitle, pageWidth - 16);
      pdf.text(subtitleLines, titleX, y, { align, maxWidth: pageWidth - 16 });
      y += subtitleLines.length * 4 + 3;
    }

    if (booking.is_demo) {
      pdf.setTextColor(154, 43, 25);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.text("DEMO / TEST — NOT VALID FOR PAID ENTRY", 8, y);
      y += 6;
      pdf.setTextColor(...secondary);
    }

    const rows: Array<[string, string]> = [];
    if (design.showEventDate && booking.event_date_label) rows.push(["Date", booking.event_date_label]);
    if (design.showEventTime && booking.event_time_label) rows.push(["Time", booking.event_time_label]);
    if (design.showVenue && booking.event_venue) rows.push(["Venue", booking.event_venue]);
    if (design.showGuestName) rows.push(["Guest", booking.buyer_name]);
    if (design.showBookingReference) rows.push(["Booking reference", booking.booking_reference]);
    rows.push(["Ticket", `${ticket.ticket_number} of ${booking.quantity}`]);

    const qrSize = design.qrSize;
    const footerLines = design.footerText
      ? pdf.splitTextToSize(design.footerText, pageWidth - 16)
      : [];
    const footerExtra = Math.max(0, footerLines.length - 1) * 3;
    const qrY = pageHeight - qrSize - 17 - footerExtra;
    const maxRowsHeight = qrY - y - 5;
    let detailFontSize = 7;
    const layoutRows = () => {
      pdf.setFontSize(detailFontSize);
      return rows.map(([label, value]) => ({
        label,
        lines: pdf.splitTextToSize(value, pageWidth - 42),
      }));
    };
    let rowLayouts = layoutRows();
    const requiredRowsHeight = () =>
      rowLayouts.reduce((height, row) => height + Math.max(3, row.lines.length * detailFontSize * 0.48) + 1, 0);
    while (requiredRowsHeight() > maxRowsHeight && detailFontSize > 4) {
      detailFontSize -= 0.5;
      rowLayouts = layoutRows();
    }
    if (requiredRowsHeight() > maxRowsHeight) {
      throw new Error("Ticket details do not fit. Shorten the event or attendee text and retry.");
    }
    pdf.setFont("helvetica", "normal");
    for (const row of rowLayouts) {
      const rowHeight = Math.max(3, row.lines.length * detailFontSize * 0.48) + 1;
      pdf.setFontSize(detailFontSize);
      pdf.setFont("helvetica", "bold");
      pdf.text(`${row.label}:`, 8, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(row.lines, 34, y, { maxWidth: pageWidth - 42 });
      y += rowHeight;
    }

    const qrX = design.qrPosition === "left"
      ? 8
      : design.qrPosition === "right"
        ? pageWidth - 8 - qrSize
        : (pageWidth - qrSize) / 2;
    pdf.setFillColor(255, 255, 255);
    pdf.rect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4, "F");
    pdf.addImage(qr, "PNG", qrX, qrY, qrSize, qrSize);
    pdf.setTextColor(...secondary);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6);
    pdf.text("Scan to verify ticket", qrX + qrSize / 2, qrY + qrSize + 5, {
      align: "center",
    });

    if (design.footerText) {
      pdf.setFontSize(6);
      const footerY = pageHeight - 4 - Math.max(0, footerLines.length - 1) * 3;
      pdf.text(footerLines, centerX, footerY, { align: "center", maxWidth: pageWidth - 16 });
    }
  }
}

function fitImage(
  image: TicketArtwork,
  maxWidth: number,
  maxHeight: number,
) {
  const ratio = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = image.width * ratio;
  const height = image.height * ratio;
  return {
    x: (maxWidth - width) / 2,
    y: (maxHeight - height) / 2,
    width,
    height,
  };
}
