import { requireSupabase } from "./supabase";
import { generateInviteToken, sha256Hex } from "./tokens";
import type { Database } from "../types/database";

type Tables = Database["public"]["Tables"];
type Enums = Database["public"]["Enums"];

type EventRow = Tables["events"]["Row"];
type OrderRow = Tables["orders"]["Row"];
type StorefrontBookingRow = Tables["storefront_bookings"]["Row"];
type PaymentRow = Tables["payments"]["Row"];
type ReviewRow = Tables["reviews"]["Row"];
type AuditRow = Tables["audit_logs"]["Row"];
type InvitationRow = Tables["admin_invitations"]["Row"];

export type AdminSectionKey =
  | "overview"
  | "events"
  | "customers"
  | "orders"
  | "payments"
  | "support"
  | "activity"
  | "staff"
  | "showcase";

export type OverviewItem = { label: string; value: string; note: string };
export type Overview = { metrics: OverviewItem[]; analytics: OverviewItem[] };

export type EventView = EventRow & { organizerName: string };
export type ShowcaseRecord = Tables["storefront_events"]["Row"];
export type CustomerView = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  status: Enums["account_status"];
  roles: string[];
  created_at: string;
};
export type OrderView = OrderRow & { eventTitle: string };
export type StorefrontBookingView = StorefrontBookingRow;
export type PaymentView = PaymentRow & { orderNumber: string };
export type SupportView = ReviewRow & { eventTitle: string; customerName: string };
export type ActivityView = AuditRow & { actorName: string };
export type StaffView = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  roles: string[];
};
export type StaffData = { staff: StaffView[]; invitations: InvitationRow[] };

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function summarizeCurrency(amounts: Array<{ amount: number; currency: string }>): string {
  const groups = new Map<string, number>();
  for (const entry of amounts) {
    groups.set(entry.currency, (groups.get(entry.currency) ?? 0) + entry.amount);
  }
  const parts = Array.from(groups, ([currency, amount]) => formatMoney(amount, currency));
  return parts.length ? parts.join(" · ") : "—";
}

export async function fetchOverview(): Promise<Overview> {
  const client = requireSupabase();
  const [
    profiles, assignments, roleRows, events, tickets, orders,
    payments, reviews, showcaseEvents, demoBookings,
  ] =
    await Promise.all([
      client.from("profiles").select("id", { count: "exact", head: true }),
      client.from("user_roles").select("user_id, role_id"),
      client.from("roles").select("id, name"),
      client.from("events").select("id, title, status, approval_status"),
      client.from("tickets").select("id", { count: "exact", head: true }),
      client.from("orders").select("id, event_id, status"),
      client.from("payments").select("amount, currency, status"),
      client.from("reviews").select("id, status"),
      client.from("storefront_events").select("id, event_group, is_visible"),
      client.from("storefront_bookings").select("id, ticket_email_status"),
    ]);

  for (const result of [
    profiles, assignments, roleRows, events, tickets, orders,
    payments, reviews, showcaseEvents, demoBookings,
  ]) {
    if (result.error) throw new Error(result.error.message);
  }

  const roleNames = new Map((roleRows.data ?? []).map((role) => [role.id, role.name]));
  const countRole = (name: Enums["app_role"]) =>
    (assignments.data ?? []).filter((row) => roleNames.get(row.role_id) === name).length;

  const eventRows = events.data ?? [];
  const orderRows = orders.data ?? [];
  const paymentRows = payments.data ?? [];
  const showcaseRows = showcaseEvents.data ?? [];
  const demoBookingRows = demoBookings.data ?? [];
  const succeededPayments = paymentRows.filter((row) => row.status === "succeeded");

  const ordersByEvent = new Map<string, number>();
  for (const order of orderRows) {
    ordersByEvent.set(order.event_id, (ordersByEvent.get(order.event_id) ?? 0) + 1);
  }
  const topEventId = Array.from(ordersByEvent.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topEvent = eventRows.find((event) => event.id === topEventId);

  const published = eventRows.filter(
    (row) => row.status === "published" && row.approval_status === "approved",
  ).length;
  const successRate = paymentRows.length
    ? Math.round((succeededPayments.length / paymentRows.length) * 100)
    : 0;

  return {
    metrics: [
      { label: "Registered users", value: String(profiles.count ?? 0), note: "Profiles" },
      { label: "Customers", value: String(countRole("customer")), note: "Customer role" },
      { label: "Staff", value: String(countRole("staff")), note: "Staff role" },
      { label: "Total events", value: String(eventRows.length), note: "All statuses" },
      { label: "Published events", value: String(published), note: "Approved and live" },
      { label: "Storefront listings", value: String(showcaseRows.length), note: "Showcase records" },
      {
        label: "Visible listings",
        value: String(showcaseRows.filter((row) => row.is_visible).length),
        note: "Shown on the storefront",
      },
      { label: "Demo bookings", value: String(demoBookingRows.length), note: "Not paid orders" },
      {
        label: "Pending approvals",
        value: String(eventRows.filter((row) => row.approval_status === "pending").length),
        note: "Awaiting moderation",
      },
      { label: "Tickets sold", value: String(tickets.count ?? 0), note: "Issued tickets" },
      {
        label: "Successful orders",
        value: String(orderRows.filter((row) => row.status === "paid").length),
        note: "Paid orders",
      },
      {
        label: "Verified revenue",
        value: summarizeCurrency(succeededPayments),
        note: "Succeeded payments",
      },
    ],
    analytics: [
      {
        label: "Revenue over time",
        value: summarizeCurrency(succeededPayments),
        note: "Lifetime verified payments",
      },
      { label: "Ticket sales over time", value: String(tickets.count ?? 0), note: "Lifetime issued tickets" },
      { label: "User registration growth", value: String(profiles.count ?? 0), note: "Total registered users" },
      {
        label: "Event publication statistics",
        value: `${published} / ${eventRows.length}`,
        note: "Published and approved of all events",
      },
      {
        label: "Showcase lineup",
        value: `${showcaseRows.filter((row) => row.event_group === "upcoming").length} upcoming / ${
          showcaseRows.filter((row) => row.event_group === "ongoing").length
        } ongoing / ${showcaseRows.filter((row) => row.event_group === "past").length} past`,
        note: `${showcaseRows.filter((row) => row.is_visible).length} visible listings`,
      },
      {
        label: "Demo ticket email delivery",
        value: `${demoBookingRows.filter((row) => row.ticket_email_status === "sent").length} / ${
          demoBookingRows.length
        } sent`,
        note: "Booking ticket emails; separate from paid orders",
      },
      {
        label: "Payment success and failure rates",
        value: `${successRate}%`,
        note: `${succeededPayments.length} succeeded of ${paymentRows.length} payments`,
      },
      {
        label: "Top-performing events",
        value: topEvent?.title ?? "—",
        note: topEventId ? `${ordersByEvent.get(topEventId) ?? 0} orders` : "No orders yet",
      },
    ],
  };
}

export async function fetchEvents(): Promise<EventView[]> {
  const { data: events, error } = await requireSupabase()
    .from("events")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (events ?? []).map((event) => ({
    ...event,
    organizerName: event.organizer_name,
  }));
}

export async function fetchShowcase(): Promise<ShowcaseRecord[]> {
  const { data, error } = await requireSupabase()
    .from("storefront_events")
    .select("*")
    .order("display_order", { ascending: true })
    .order("title", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createShowcaseEvent(
  record: Tables["storefront_events"]["Insert"],
): Promise<void> {
  const client = requireSupabase();
  const { data, error } = await client
    .from("storefront_events")
    .insert(record)
    .select("id, normalized_event_id")
    .single();
  if (error) throw new Error(error.message);
  if (data.normalized_event_id) return;

  const { error: cleanupError } = await client
    .from("storefront_events")
    .delete()
    .eq("id", data.id);
  if (cleanupError) {
    throw new Error(
      `The showcase event was saved without a catalog event, and cleanup failed: ${cleanupError.message}`,
    );
  }
  throw new Error(
    "The showcase event was not linked to the admin Events catalog. Verify migrations 0023 and 0027 and the showcase sync trigger, then try again.",
  );
}

const SHOWCASE_IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export async function uploadShowcaseImage(
  eventId: string,
  file: File,
): Promise<{ path: string; publicUrl: string }> {
  const extension = SHOWCASE_IMAGE_EXTENSIONS[file.type];
  if (!extension) {
    throw new Error("Choose a JPEG, PNG, WebP, or AVIF image.");
  }
  if (file.size === 0 || file.size > 10 * 1024 * 1024) {
    throw new Error("Event images must be larger than 0 bytes and no larger than 10 MB.");
  }

  const path = `${eventId}/${crypto.randomUUID()}.${extension}`;
  const client = requireSupabase();
  const { error } = await client.storage.from("event-images").upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);

  const { data } = client.storage.from("event-images").getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

export async function uploadTicketDesignImage(eventId: string, file: File): Promise<string> {
  const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : null;
  if (!extension) {
    throw new Error("Ticket artwork must be a JPEG or PNG image.");
  }
  if (file.size === 0 || file.size > 10 * 1024 * 1024) {
    throw new Error("Ticket artwork must be larger than 0 bytes and no larger than 10 MB.");
  }

  const path = `${eventId}/ticket-design-${crypto.randomUUID()}.${extension}`;
  const { error } = await requireSupabase().storage.from("event-images").upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

export async function deleteShowcaseImage(path: string): Promise<void> {
  const { error } = await requireSupabase().storage.from("event-images").remove([path]);
  if (error) throw new Error(error.message);
}

export async function updateShowcaseEvent(
  id: string,
  patch: Tables["storefront_events"]["Update"],
): Promise<void> {
  const { error } = await requireSupabase()
    .from("storefront_events")
    .update(patch)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteShowcaseEvent(id: string): Promise<void> {
  const { error } = await requireSupabase().from("storefront_events").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchCustomers(): Promise<CustomerView[]> {
  const { data, error } = await requireSupabase().rpc("admin_list_customers");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchOrders(): Promise<OrderView[]> {
  const client = requireSupabase();
  const [orders, events] = await Promise.all([
    client.from("orders").select("*").order("created_at", { ascending: false }),
    client.from("events").select("id, title"),
  ]);
  if (orders.error) throw new Error(orders.error.message);
  if (events.error) throw new Error(events.error.message);
  const titles = new Map((events.data ?? []).map((row) => [row.id, row.title]));
  return (orders.data ?? []).map((row) => ({
    ...row,
    eventTitle: titles.get(row.event_id) ?? "—",
  }));
}

export async function fetchStorefrontBookings(): Promise<StorefrontBookingView[]> {
  const { data, error } = await requireSupabase()
    .from("storefront_bookings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchPayments(): Promise<PaymentView[]> {
  const client = requireSupabase();
  const [payments, orders, webhooks] = await Promise.all([
    client.from("payments").select("*").order("created_at", { ascending: false }),
    client.from("orders").select("id, order_number"),
    client.from("payment_webhook_events").select("id, event_type, processed_at"),
  ]);
  if (payments.error) throw new Error(payments.error.message);
  if (orders.error) throw new Error(orders.error.message);
  const numbers = new Map((orders.data ?? []).map((row) => [row.id, row.order_number]));
  const webhookCount = webhooks.data?.length ?? 0;
  return (payments.data ?? []).map((row) => ({
    ...row,
    orderNumber: `${numbers.get(row.order_id) ?? "—"} · ${webhookCount} webhook event(s)`,
  }));
}

export async function fetchSupport(): Promise<SupportView[]> {
  const client = requireSupabase();
  const [reviews, events, profiles] = await Promise.all([
    client.from("reviews").select("*").order("created_at", { ascending: false }),
    client.from("events").select("id, title"),
    client.from("profiles").select("id, full_name, email"),
  ]);
  if (reviews.error) throw new Error(reviews.error.message);
  if (events.error) throw new Error(events.error.message);
  if (profiles.error) throw new Error(profiles.error.message);
  const titles = new Map((events.data ?? []).map((row) => [row.id, row.title]));
  const names = new Map((profiles.data ?? []).map((row) => [row.id, row.full_name ?? row.email ?? "—"]));
  return (reviews.data ?? []).map((row) => ({
    ...row,
    eventTitle: titles.get(row.event_id) ?? "—",
    customerName: names.get(row.customer_id) ?? "—",
  }));
}

export async function fetchActivity(): Promise<ActivityView[]> {
  const client = requireSupabase();
  const [logs, profiles] = await Promise.all([
    client.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200),
    client.from("profiles").select("id, full_name, email"),
  ]);
  if (logs.error) throw new Error(logs.error.message);
  if (profiles.error) throw new Error(profiles.error.message);
  const names = new Map((profiles.data ?? []).map((row) => [row.id, row.full_name ?? row.email ?? "—"]));
  return (logs.data ?? []).map((row) => ({
    ...row,
    actorName: row.actor_id ? (names.get(row.actor_id) ?? "Unknown admin") : "System",
  }));
}

export async function fetchStaff(): Promise<StaffData> {
  const client = requireSupabase();
  const [profiles, assignments, roles, invitations] = await Promise.all([
    client.from("profiles").select("id, full_name, email").order("created_at", { ascending: false }),
    client.from("user_roles").select("user_id, role_id"),
    client.from("roles").select("id, name"),
    client.from("admin_invitations").select("*").order("created_at", { ascending: false }),
  ]);
  for (const result of [profiles, assignments, roles, invitations]) {
    if (result.error) throw new Error(result.error.message);
  }
  const roleNames = new Map((roles.data ?? []).map((row) => [row.id, row.name]));
  const rolesByUser = new Map<string, string[]>();
  for (const row of assignments.data ?? []) {
    const name = roleNames.get(row.role_id);
    if (!name) continue;
    rolesByUser.set(row.user_id, [...(rolesByUser.get(row.user_id) ?? []), name]);
  }
  return {
    staff: (profiles.data ?? []).map((profile) => ({
      user_id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      roles: rolesByUser.get(profile.id) ?? [],
    })),
    invitations: invitations.data ?? [],
  };
}

export async function updateEvent(id: string, patch: Tables["events"]["Update"]): Promise<void> {
  const { error } = await requireSupabase().from("events").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateProfileStatus(
  id: string,
  status: Enums["account_status"],
): Promise<void> {
  const { error } = await requireSupabase().from("profiles").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateOrderStatus(id: string, status: Enums["order_status"]): Promise<void> {
  const patch: Tables["orders"]["Update"] = { status };
  if (status === "paid") patch.paid_at = new Date().toISOString();
  if (status === "cancelled") patch.cancelled_at = new Date().toISOString();
  const { error } = await requireSupabase().from("orders").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function moderateReview(id: string, status: Enums["review_status"]): Promise<void> {
  const { error } = await requireSupabase()
    .from("reviews")
    .update({ status, moderated_by: (await requireSupabase().auth.getUser()).data.user?.id ?? null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function assignRole(userId: string, role: Enums["app_role"]): Promise<void> {
  const { error } = await requireSupabase().rpc("assign_user_role", {
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw new Error(error.message);
}

export async function removeRole(userId: string, role: Enums["app_role"]): Promise<void> {
  const { error } = await requireSupabase().rpc("remove_user_role", {
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw new Error(error.message);
}

/** Creates an invitation and returns the raw token exactly once for sharing. */
export async function createAdminInvitation(email: string, days: number): Promise<string> {
  const rawToken = generateInviteToken();
  const tokenHash = await sha256Hex(rawToken);
  const { error } = await requireSupabase().rpc("create_admin_invitation", {
    p_email: email.trim(),
    p_token_hash: tokenHash,
    p_expires_in: `${days} days`,
  });
  if (error) throw new Error(error.message);
  return rawToken;
}

export function describeAuditChanges(changes: unknown): string {
  if (!changes || typeof changes !== "object") return "—";
  const value = changes as { before?: Record<string, unknown>; after?: Record<string, unknown> };
  const before = value.before ?? {};
  const after = value.after ?? value.before ?? {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).filter(
    (key) => before[key] !== after[key] && !["updated_at", "id"].includes(key),
  );
  return keys.length ? keys.slice(0, 6).join(", ") : "record updated";
}

export { formatMoney };
