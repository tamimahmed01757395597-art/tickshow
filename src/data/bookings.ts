// Shared checkout constants. Booking storage was removed with the demo flow;
// orders now live only in the Supabase database.

export const MAX_TICKETS_PER_ORDER = 8;

export function formatTaka(amount: number) {
  return `৳${amount.toLocaleString("en-US")}`;
}
