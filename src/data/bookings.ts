import type { TickShowEvent } from "./events";

export type TicketBooking = {
  reference: string;
  eventId: string;
  eventTitle: string;
  quantity: number;
  amount: number;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
};

export const MAX_TICKETS_PER_ORDER = 8;

const STORAGE_KEY = "tickshow.bookings";
const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function formatTaka(amount: number) {
  return `৳${amount.toLocaleString("en-US")}`;
}

function makeReference() {
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += REFERENCE_ALPHABET[Math.floor(Math.random() * REFERENCE_ALPHABET.length)];
  }
  return `TS-${code}`;
}

export function readBookings(): TicketBooking[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TicketBooking[]) : [];
  } catch {
    return [];
  }
}

function persistBookings(bookings: TicketBooking[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings.slice(0, 25)));
  } catch {
    // Storage can be blocked; the order page still renders for this session.
  }
}

export function createBooking({
  event,
  quantity,
  name,
  email,
  phone,
}: {
  event: TickShowEvent;
  quantity: number;
  name: string;
  email: string;
  phone: string;
}): TicketBooking {
  const booking: TicketBooking = {
    reference: makeReference(),
    eventId: event.id,
    eventTitle: event.title,
    quantity,
    amount: event.price * quantity,
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim(),
    createdAt: new Date().toISOString(),
  };

  persistBookings([booking, ...readBookings()]);
  return booking;
}

export function findBooking(reference: string): TicketBooking | undefined {
  const wanted = reference.trim().toUpperCase();
  return readBookings().find((booking) => booking.reference.toUpperCase() === wanted);
}
