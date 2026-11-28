import type { Json } from "../types/database";

export type TicketDesign = {
  backgroundColor: string;
  primaryColor: string;
  secondaryColor: string;
  logoPath: string | null;
  backgroundImagePath: string | null;
  title: string;
  subtitle: string;
  fontSize: number;
  textAlign: "left" | "center" | "right";
  showEventDate: boolean;
  showEventTime: boolean;
  showVenue: boolean;
  showGuestName: boolean;
  showBookingReference: boolean;
  qrPosition: "left" | "center" | "right";
  qrSize: number;
  footerText: string;
};

export const DEFAULT_TICKET_DESIGN: TicketDesign = {
  backgroundColor: "#fffdf6",
  primaryColor: "#f2c744",
  secondaryColor: "#111111",
  logoPath: null,
  backgroundImagePath: null,
  title: "",
  subtitle: "ADMIT ONE",
  fontSize: 18,
  textAlign: "left",
  showEventDate: true,
  showEventTime: true,
  showVenue: true,
  showGuestName: true,
  showBookingReference: true,
  qrPosition: "right",
  qrSize: 32,
  footerText: "Thank you for joining us. Enjoy the event.",
};

export function ticketDesignToJson(design: TicketDesign): Json {
  return {
    version: 1,
    backgroundColor: design.backgroundColor,
    primaryColor: design.primaryColor,
    secondaryColor: design.secondaryColor,
    logoPath: design.logoPath,
    backgroundImagePath: design.backgroundImagePath,
    title: design.title,
    subtitle: design.subtitle,
    fontSize: design.fontSize,
    textAlign: design.textAlign,
    showEventDate: design.showEventDate,
    showEventTime: design.showEventTime,
    showVenue: design.showVenue,
    showGuestName: design.showGuestName,
    showBookingReference: design.showBookingReference,
    qrPosition: design.qrPosition,
    qrSize: design.qrSize,
    footerText: design.footerText,
  };
}

export function normalizeTicketDesign(value: unknown): TicketDesign {
  if (value == null) return { ...DEFAULT_TICKET_DESIGN };
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("This event's ticket design is not valid.");
  }

  const input = value as Record<string, unknown>;
  const defaults = DEFAULT_TICKET_DESIGN;
  const color = (key: string, fallback: string) => {
    const candidate = input[key] ?? fallback;
    if (typeof candidate !== "string" || !/^#[0-9a-f]{6}$/i.test(candidate)) {
      throw new Error(`Ticket design ${key} must be a six-digit hex color.`);
    }
    return candidate.toLowerCase();
  };
  const text = (key: string, fallback: string, limit: number) => {
    const candidate = input[key] ?? fallback;
    if (typeof candidate !== "string" || candidate.length > limit) {
      throw new Error(`Ticket design ${key} must be text no longer than ${limit} characters.`);
    }
    return candidate;
  };
  const choice = <T extends string>(key: string, values: readonly T[], fallback: T): T => {
    const candidate = input[key] ?? fallback;
    if (typeof candidate !== "string" || !values.includes(candidate as T)) {
      throw new Error(`Ticket design ${key} is not supported.`);
    }
    return candidate as T;
  };
  const boolean = (key: string, fallback: boolean) => {
    const candidate = input[key] ?? fallback;
    if (typeof candidate !== "boolean") {
      throw new Error(`Ticket design ${key} must be a boolean.`);
    }
    return candidate;
  };
  const number = (key: string, fallback: number, min: number, max: number) => {
    const candidate = input[key] ?? fallback;
    if (typeof candidate !== "number" || !Number.isFinite(candidate) || candidate < min || candidate > max) {
      throw new Error(`Ticket design ${key} must be between ${min} and ${max}.`);
    }
    return candidate;
  };
  const path = (key: string) => {
    const candidate = input[key] ?? null;
    if (candidate !== null && (typeof candidate !== "string" || candidate.length > 512)) {
      throw new Error(`Ticket design ${key} is not a valid storage path.`);
    }
    return candidate;
  };

  return {
    backgroundColor: color("backgroundColor", defaults.backgroundColor),
    primaryColor: color("primaryColor", defaults.primaryColor),
    secondaryColor: color("secondaryColor", defaults.secondaryColor),
    logoPath: path("logoPath"),
    backgroundImagePath: path("backgroundImagePath"),
    title: text("title", defaults.title, 120),
    subtitle: text("subtitle", defaults.subtitle, 160),
    fontSize: number("fontSize", defaults.fontSize, 12, 32),
    textAlign: choice("textAlign", ["left", "center", "right"], defaults.textAlign),
    showEventDate: boolean("showEventDate", defaults.showEventDate),
    showEventTime: boolean("showEventTime", defaults.showEventTime),
    showVenue: boolean("showVenue", defaults.showVenue),
    showGuestName: boolean("showGuestName", defaults.showGuestName),
    showBookingReference: boolean("showBookingReference", defaults.showBookingReference),
    qrPosition: choice("qrPosition", ["left", "center", "right"], defaults.qrPosition),
    qrSize: number("qrSize", defaults.qrSize, 22, 40),
    footerText: text("footerText", defaults.footerText, 240),
  };
}
