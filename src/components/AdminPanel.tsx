import { useEffect, useMemo, useState, type ReactNode } from "react";
import Brand from "./Brand";
import { useAuth } from "../lib/auth";
import * as api from "../lib/admin";
import {
  formatMoney,
  describeAuditChanges,
  type ActivityView,
  type CustomerView,
  type EventView,
  type OrderView,
  type PaymentView,
  type ShowcaseRecord,
  type StaffData,
  type SupportView,
  type SupportMessageView,
} from "../lib/admin";
import type { Database } from "../types/database";
import { EVENT_CATEGORIES } from "../data/events";
import TicketDesignSection from "./TicketDesignSection";
import "./AdminPanel.css";

type Enums = Database["public"]["Enums"];
type Tables = Database["public"]["Tables"];

const ADMIN_SECTIONS = [
  { id: "overview", label: "Overview", mark: "OV" },
  { id: "events", label: "Events", mark: "EV" },
  { id: "customers", label: "Customers", mark: "CU" },
  { id: "orders", label: "Orders & tickets", mark: "OT" },
  { id: "payments", label: "Payments", mark: "PA" },
  { id: "support", label: "Support", mark: "SU" },
  { id: "activity", label: "Activity log", mark: "AL" },
  { id: "staff", label: "Staff & roles", mark: "SR" },
  { id: "showcase", label: "Event showcase", mark: "ES" },
  { id: "ticket-design", label: "Ticket design", mark: "TD" },
] as const;

type AdminSection = (typeof ADMIN_SECTIONS)[number]["id"];

const SECTION_DESCRIPTIONS: Record<AdminSection, string> = {
  overview: "Live totals computed directly from authorized database reads.",
  events: "Review, approve, publish and edit event listings across TickShow.",
  customers: "Find customer accounts and manage account status.",
  orders: "Review orders and update operational order status.",
  payments: "Read-only payment records maintained by trusted webhook processing.",
  support: "Review customer support requests and moderate event reviews.",
  activity: "Append-only audit trail of administrative mutations.",
  staff: "Assign roles and issue single-use administrator invitations.",
  showcase: "Control upcoming, ongoing, past and carousel events shown on the storefront.",
  "ticket-design": "Create a saved, event-specific layout for printable customer tickets.",
};

type EditField = {
  key: string;
  label: string;
  type?: "text" | "email" | "textarea" | "select" | "number" | "date" | "datetime-local" | "checkbox" | "file";
  options?: Array<string | { value: string; label: string }>;
  required?: boolean;
  accept?: string;
  full?: boolean;
  hint?: string;
};

type DataTableColumn<T> = { label: string; render: (row: T) => ReactNode };

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function shortId(value: string): string {
  return value.slice(0, 8);
}

function eventStatusPatch(
  row: EventView,
  status: Enums["event_status"],
): Database["public"]["Tables"]["events"]["Update"] {
  const patch: Database["public"]["Tables"]["events"]["Update"] = { status };
  patch.published_at = status === "published" ? (row.published_at ?? new Date().toISOString()) : null;
  if (status === "cancelled") {
    patch.cancelled_at = row.cancelled_at ?? new Date().toISOString();
    patch.cancellation_reason = row.cancellation_reason?.trim() || "Cancelled by administrator";
  } else {
    patch.cancelled_at = null;
    patch.cancellation_reason = null;
  }
  if (status === "completed") patch.completed_at = row.completed_at ?? new Date().toISOString();
  return patch;
}

function eventApprovalPatch(
  row: EventView,
  approval: Enums["approval_status"],
): Database["public"]["Tables"]["events"]["Update"] {
  return {
    approval_status: approval,
    approved_at: approval === "approved" ? (row.approved_at ?? new Date().toISOString()) : null,
  };
}

function StatusPill({ value }: { value: string }) {
  return <span className="admin-pill">{value.replace(/_/g, " ")}</span>;
}

function useAdminFetch<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetcher()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((caught: unknown) => {
        if (active) setError(messageOf(caught));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // reloadKey is the intentional trigger; fetcher is recreated on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  return { data, error, loading, reload: () => setReloadKey((key) => key + 1) };
}

function DataTable<T>({
  columns,
  rows,
  rowKey,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
}) {
  if (!rows.length) {
    return <div className="admin-state">No records found.</div>;
  }
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th key={index}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column, index) => (
                <td key={index} data-label={column.label}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionState({
  loading,
  error,
  onRetry,
  children,
}: {
  loading: boolean;
  error: string;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (loading) return <div className="admin-state">Loading live data…</div>;
  if (error) {
    return (
      <div className="admin-state admin-state-error" role="alert">
        <p>{error}</p>
        <button className="admin-button" type="button" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }
  return <>{children}</>;
}

function StatusSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (next: string) => void;
}) {
  const choices = options.includes(value) ? options : [value, ...options];
  return (
    <select
      className="admin-select"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={`Change status from ${value}`}
    >
      {choices.map((option) => (
        <option key={option} value={option}>
          {option.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}

function EditModal({
  title,
  fields,
  initial,
  onSave,
  onClose,
  wide = false,
  saveLabel = "Save changes",
}: {
  title: string;
  fields: EditField[];
  initial: Record<string, unknown>;
  onSave: (
    values: Record<string, string>,
    files: Record<string, File | null>,
  ) => Promise<void>;
  onClose: () => void;
  wide?: boolean;
  saveLabel?: string;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map((field) => [
        field.key,
        initial[field.key] == null
          ? field.type === "checkbox"
            ? "false"
            : ""
          : String(initial[field.key]),
      ]),
    ),
  );
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (key: string, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await onSave(values, files);
      onClose();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h2>{title}</h2>
        <div className={wide ? "admin-modal-fields is-wide" : "admin-modal-fields"}>
          {fields.map((field) => (
            <label key={field.key} className={field.full ? "is-full" : undefined}>
              <span>{field.label}</span>
              {field.type === "checkbox" ? (
                <input
                  type="checkbox"
                  checked={values[field.key] === "true"}
                  onChange={(event) => set(field.key, String(event.target.checked))}
                />
              ) : field.type === "textarea" ? (
                <textarea
                  rows={4}
                  required={field.required}
                  value={values[field.key] ?? ""}
                  onChange={(event) => set(field.key, event.target.value)}
                />
              ) : field.type === "select" ? (
                <select
                  required={field.required}
                  value={values[field.key] ?? ""}
                  onChange={(event) => set(field.key, event.target.value)}
                >
                  {(field.options ?? []).map((option) => (
                    <option
                      key={typeof option === "string" ? option : option.value}
                      value={typeof option === "string" ? option : option.value}
                    >
                      {typeof option === "string" ? option.replace(/_/g, " ") : option.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "file" ? (
                <>
                  <input
                    type="file"
                    accept={field.accept ?? "image/jpeg,image/png,image/webp,image/avif"}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0] ?? null;
                      setFiles((current) => ({ ...current, [field.key]: file }));
                    }}
                  />
                  {files[field.key] && <small>Selected: {files[field.key]?.name}</small>}
                </>
              ) : (
                <input
                  type={field.type ?? "text"}
                  required={field.required}
                  value={values[field.key] ?? ""}
                  onChange={(event) => set(field.key, event.target.value)}
                />
              )}
              {field.hint && <small>{field.hint}</small>}
            </label>
          ))}
        </div>
        {error && <p className="admin-inline-error" role="alert">{error}</p>}
        <div className="admin-modal-actions">
          <button className="admin-button admin-button-quiet" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="admin-button admin-button-primary" type="button" onClick={save} disabled={busy}>
            {busy ? "Saving…" : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function OverviewSection() {
  const { data, error, loading, reload } = useAdminFetch(api.fetchOverview);
  return (
    <SectionState loading={loading} error={error} onRetry={reload}>
      <section className="admin-section-block">
        <div className="admin-section-heading">
          <div>
            <h2>Platform statistics</h2>
            <p>Live values from authorized Supabase reads.</p>
          </div>
          <span className="admin-data-state">Live</span>
        </div>
        <div className="admin-metric-grid">
          {(data?.metrics ?? []).map((metric) => (
            <article className="admin-metric-card" key={metric.label}>
              <span className="admin-metric-label">{metric.label}</span>
              <strong>{metric.value}</strong>
              <span className="admin-metric-foot">{metric.note}</span>
            </article>
          ))}
        </div>
      </section>
      <section className="admin-section-block">
        <div className="admin-section-heading">
          <div>
            <h2>Analytics</h2>
            <p>Current platform signals derived from live records.</p>
          </div>
          <span className="admin-filter-note">Lifetime view</span>
        </div>
        <div className="admin-analytics-grid">
          {(data?.analytics ?? []).map((item) => (
            <article className="admin-analytics-card" key={item.label}>
              <h3>{item.label}</h3>
              <div className="admin-chart-value">{item.value}</div>
              <p className="admin-chart-note">{item.note}</p>
            </article>
          ))}
        </div>
      </section>
    </SectionState>
  );
}

const EVENT_STATUSES: Enums["event_status"][] = [
  "draft",
  "pending",
  "published",
  "rejected",
  "cancelled",
  "completed",
];
const APPROVAL_STATUSES: Enums["approval_status"][] = ["pending", "approved", "rejected"];

function EventsSection() {
  const { data, error, loading, reload } = useAdminFetch(api.fetchEvents);
  const [editing, setEditing] = useState<EventView | null>(null);

  const change = async (id: string, patch: Database["public"]["Tables"]["events"]["Update"]) => {
    await api.updateEvent(id, patch);
    reload();
  };

  return (
    <SectionState loading={loading} error={error} onRetry={reload}>
      <DataTable<EventView>
        rows={data ?? []}
        rowKey={(row) => row.id}
        columns={[
          {
            label: "Event",
            render: (row) => (
              <div className="admin-cell-title">
                <strong>{row.title}</strong>
                <span>{row.slug}</span>
              </div>
            ),
          },
          { label: "Organizer", render: (row) => row.organizerName },
          {
            label: "Status",
            render: (row) => (
              <StatusSelect
                value={row.status}
                options={EVENT_STATUSES}
                onChange={(next) =>
                  change(row.id, eventStatusPatch(row, next as Enums["event_status"])).catch(
                    (caught: unknown) => window.alert(messageOf(caught)),
                  )
                }
              />
            ),
          },
          {
            label: "Approval",
            render: (row) => (
              <StatusSelect
                value={row.approval_status}
                options={APPROVAL_STATUSES}
                onChange={(next) =>
                  change(row.id, eventApprovalPatch(row, next as Enums["approval_status"])).catch(
                    (caught: unknown) => window.alert(messageOf(caught)),
                  )
                }
              />
            ),
          },
          { label: "Starts", render: (row) => formatDate(row.starts_at) },
          {
            label: "Actions",
            render: (row) => (
              <button className="admin-button admin-button-quiet" type="button" onClick={() => setEditing(row)}>
                Edit
              </button>
            ),
          },
        ]}
      />
      {editing && (
        <EditModal
          title={`Edit ${editing.title}`}
          initial={editing}
          fields={[
            { key: "title", label: "Title" },
            { key: "description", label: "Description", type: "textarea" },
            { key: "organizer_name", label: "Organizer name", required: true },
            { key: "venue_name", label: "Venue" },
            { key: "status", label: "Status", type: "select", options: EVENT_STATUSES },
            { key: "approval_status", label: "Approval", type: "select", options: APPROVAL_STATUSES },
          ]}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            await change(editing.id, {
              title: values.title,
              description: values.description || null,
              organizer_name: values.organizer_name.trim(),
              venue_name: values.venue_name || null,
              ...eventStatusPatch(editing, values.status as Enums["event_status"]),
              ...eventApprovalPatch(editing, values.approval_status as Enums["approval_status"]),
            });
          }}
        />
      )}
    </SectionState>
  );
}

function CustomersSection() {
  const { data, error, loading, reload } = useAdminFetch(api.fetchCustomers);
  const [editing, setEditing] = useState<CustomerView | null>(null);

  return (
    <SectionState loading={loading} error={error} onRetry={reload}>
      <DataTable<CustomerView>
        rows={data ?? []}
        rowKey={(row) => row.id}
        columns={[
          {
            label: "Customer",
            render: (row) => (
              <div className="admin-cell-title">
                <strong>{row.full_name || "Unnamed"}</strong>
                <span>{row.email ?? "—"}</span>
              </div>
            ),
          },
          {
            label: "Roles",
            render: (row) => (
              <div className="admin-pill-group">
                {row.roles.length ? row.roles.map((role) => <StatusPill key={role} value={role} />) : "—"}
              </div>
            ),
          },
          {
            label: "Status",
            render: (row) => (
              <StatusSelect
                value={row.status}
                options={["active", "suspended"]}
                onChange={(next) =>
                  api
                    .updateProfileStatus(row.id, next as Enums["account_status"])
                    .then(reload)
                    .catch((caught: unknown) => window.alert(messageOf(caught)))
                }
              />
            ),
          },
          { label: "Joined", render: (row) => formatDate(row.created_at) },
          {
            label: "Actions",
            render: (row) => (
              <button className="admin-button admin-button-quiet" type="button" onClick={() => setEditing(row)}>
                Edit
              </button>
            ),
          },
        ]}
      />
      {editing && (
        <EditModal
          title="Edit customer"
          initial={editing}
          fields={[
            { key: "full_name", label: "Full name" },
            { key: "email", label: "Email" },
            { key: "status", label: "Status", type: "select", options: ["active", "suspended"] },
          ]}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            await api.updateProfileStatus(editing.id, values.status as Enums["account_status"]);
            reload();
          }}
        />
      )}
    </SectionState>
  );
}

const ORDER_STATUSES: Enums["order_status"][] = [
  "pending",
  "paid",
  "failed",
  "cancelled",
  "refunded",
  "expired",
];

function OrdersSection() {
  const { data, error, loading, reload } = useAdminFetch(api.fetchOrders);
  return (
    <SectionState loading={loading} error={error} onRetry={reload}>
      <div className="admin-readonly-note">
        Amounts and buyer details are immutable. Paid status is set only by verified Stripe webhooks.
      </div>
      <DataTable<OrderView>
        rows={data ?? []}
        rowKey={(row) => row.id}
        columns={[
          {
            label: "Order",
            render: (row) => (
              <div className="admin-cell-title">
                <strong>{row.order_number}</strong>
                <span>{shortId(row.id)}</span>
              </div>
            ),
          },
          { label: "Event", render: (row) => row.eventTitle },
          { label: "Buyer", render: (row) => row.buyer_email },
          { label: "Total", render: (row) => formatMoney(row.total_amount, row.currency) },
          {
            label: "Status",
            render: (row) => (
              <StatusSelect
                value={row.status}
                options={ORDER_STATUSES.filter((status) => status !== "paid")}
                onChange={(next) =>
                  api
                    .updateOrderStatus(row.id, next as Enums["order_status"])
                    .then(reload)
                    .catch((caught: unknown) => window.alert(messageOf(caught)))
                }
              />
            ),
          },
          { label: "Placed", render: (row) => formatDate(row.created_at) },
        ]}
      />
    </SectionState>
  );
}

function PaymentsSection() {
  const { data, error, loading, reload } = useAdminFetch(api.fetchPayments);
  return (
    <SectionState loading={loading} error={error} onRetry={reload}>
      <div className="admin-readonly-note">
        Payment records are read-only here. Only trusted server-side webhook processing writes them.
      </div>
      <DataTable<PaymentView>
        rows={data ?? []}
        rowKey={(row) => row.id}
        columns={[
          {
            label: "Payment",
            render: (row) => (
              <div className="admin-cell-title">
                <strong>{shortId(row.id)}</strong>
                <span>{row.payment_intent_id ?? row.transaction_reference ?? "—"}</span>
              </div>
            ),
          },
          { label: "Order", render: (row) => row.orderNumber },
          { label: "Amount", render: (row) => formatMoney(row.amount, row.currency) },
          { label: "Status", render: (row) => <StatusPill value={row.status} /> },
          { label: "Method", render: (row) => row.payment_method },
          { label: "Verified", render: (row) => formatDate(row.verified_at) },
        ]}
      />
    </SectionState>
  );
}

function SupportSection() {
  const {
    data: messages,
    error: messageError,
    loading: messagesLoading,
    reload: reloadMessages,
  } = useAdminFetch(api.fetchSupportMessages);
  const {
    data: reviews,
    error: reviewError,
    loading: reviewsLoading,
    reload: reloadReviews,
  } = useAdminFetch(api.fetchSupport);
  const [editing, setEditing] = useState<SupportView | null>(null);
  const reload = () => {
    reloadMessages();
    reloadReviews();
  };
  const statusOptions: Enums["support_message_status"][] = ["open", "in_progress", "resolved"];

  return (
    <SectionState
      loading={messagesLoading || reviewsLoading}
      error={messageError || reviewError}
      onRetry={reload}
    >
      <section className="admin-section-block">
        <div className="admin-section-heading">
          <div>
            <h2>Customer messages</h2>
            <p>Submissions from Contact and Booking support. Reply to the sender’s email address.</p>
          </div>
        </div>
        <DataTable<SupportMessageView>
          rows={messages ?? []}
          rowKey={(row) => row.id}
          columns={[
            {
              label: "From",
              render: (row) => (
                <div className="admin-cell-title">
                  <strong>{row.form_type === "support" ? "Booking support" : "Contact"}</strong>
                  <span>{row.sender_email}</span>
                </div>
              ),
            },
            { label: "Message", render: (row) => <p className="admin-support-message">{row.message}</p> },
            { label: "Received", render: (row) => formatDate(row.created_at) },
            {
              label: "Status",
              render: (row) => (
                <StatusSelect
                  value={row.status}
                  options={statusOptions}
                  onChange={(next) =>
                    api
                      .updateSupportMessageStatus(row.id, next as Enums["support_message_status"])
                      .then(reloadMessages)
                      .catch((caught: unknown) => window.alert(messageOf(caught)))
                  }
                />
              ),
            },
          ]}
        />
      </section>

      <section className="admin-section-block">
        <div className="admin-section-heading">
          <div>
            <h2>Event reviews</h2>
            <p>Moderate ratings and feedback submitted for events.</p>
          </div>
        </div>
        <DataTable<SupportView>
          rows={reviews ?? []}
          rowKey={(row) => row.id}
          columns={[
            {
              label: "Event",
              render: (row) => (
                <div className="admin-cell-title">
                  <strong>{row.eventTitle}</strong>
                  <span>{row.customerName}</span>
                </div>
              ),
            },
            { label: "Rating", render: (row) => `${row.rating} / 5` },
            { label: "Comment", render: (row) => row.comment ?? "—" },
            {
              label: "Status",
              render: (row) => (
                <StatusSelect
                  value={row.status}
                  options={APPROVAL_STATUSES}
                  onChange={(next) =>
                    api
                      .moderateReview(row.id, next as Enums["review_status"])
                      .then(reloadReviews)
                      .catch((caught: unknown) => window.alert(messageOf(caught)))
                  }
                />
              ),
            },
            {
              label: "Actions",
              render: (row) => (
                <button className="admin-button admin-button-quiet" type="button" onClick={() => setEditing(row)}>
                  Edit
                </button>
              ),
            },
          ]}
        />
      </section>
      {editing && (
        <EditModal
          title="Moderate review"
          initial={editing}
          fields={[
            { key: "title", label: "Title" },
            { key: "comment", label: "Comment", type: "textarea" },
            { key: "status", label: "Status", type: "select", options: APPROVAL_STATUSES },
          ]}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            await api.moderateReview(editing.id, values.status as Enums["review_status"]);
            reloadReviews();
          }}
        />
      )}
    </SectionState>
  );
}

function ActivitySection() {
  const { data, error, loading, reload } = useAdminFetch(api.fetchActivity);
  return (
    <SectionState loading={loading} error={error} onRetry={reload}>
      <div className="admin-readonly-note">Audit entries are append-only and written by database triggers.</div>
      <DataTable<ActivityView>
        rows={data ?? []}
        rowKey={(row) => row.id}
        columns={[
          { label: "When", render: (row) => formatDate(row.created_at) },
          { label: "Actor", render: (row) => row.actorName },
          { label: "Action", render: (row) => <StatusPill value={row.action} /> },
          { label: "Entity", render: (row) => `${row.entity_type} · ${shortId(row.entity_id ?? "—")}` },
          { label: "Changed fields", render: (row) => describeAuditChanges(row.changes) },
        ]}
      />
    </SectionState>
  );
}

type ShowcaseGroup = Database["public"]["Enums"]["storefront_event_group"];
type ShowcaseFilter = "all" | "carousel" | ShowcaseGroup;

const SHOWCASE_GROUPS: ShowcaseGroup[] = ["upcoming", "ongoing", "past"];
const SHOWCASE_FILTERS: { id: ShowcaseFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming" },
  { id: "ongoing", label: "Ongoing" },
  { id: "past", label: "Past" },
  { id: "carousel", label: "Carousel" },
];

const SHOWCASE_FIELDS: EditField[] = [
  { key: "title", label: "Event title", full: true },
  {
    key: "slug",
    label: "URL slug",
    hint: "Use English letters or numbers. Spaces and punctuation become hyphens.",
  },
  { key: "category", label: "Category", type: "select", options: EVENT_CATEGORIES },
  { key: "event_group", label: "Where it appears", type: "select", options: SHOWCASE_GROUPS },
  { key: "status_label", label: "Status label", hint: "Example: Selling fast, Live now, Past event." },
  { key: "date_label", label: "Display date", hint: "Example: August 14-16, 2026." },
  { key: "date_value", label: "Sort date", type: "date" },
  { key: "organizer_name", label: "Organizer name", required: true, full: true },
  {
    key: "starts_at",
    label: "Operational start date and time",
    type: "datetime-local",
    hint: "Used for the catalog event and ticket sales window.",
  },
  { key: "ends_at", label: "Operational end date and time", type: "datetime-local" },
  {
    key: "capacity",
    label: "Ticket capacity",
    type: "number",
    hint: "Creates one General Admission ticket type with this inventory.",
  },
  { key: "time_label", label: "Time label" },
  { key: "venue", label: "Venue" },
  { key: "location", label: "Location" },
  { key: "city", label: "City" },
  { key: "price_amount", label: "Display price (BDT)", type: "number" },
  { key: "display_order", label: "List order", type: "number" },
  {
    key: "image_file",
    label: "Upload image from your computer",
    type: "file",
    full: true,
    hint: "JPEG, PNG, WebP or AVIF, up to 10 MB. An uploaded file replaces the image URL below.",
  },
  { key: "image_url", label: "Cover image URL", full: true },
  { key: "image_alt", label: "Image alt text", full: true },
  { key: "about", label: "About / detail page copy", type: "textarea", full: true },
  {
    key: "lineup",
    label: "Lineup",
    type: "textarea",
    full: true,
    hint: "One entry per line: Name | Role",
  },
  { key: "is_visible", label: "Visible on storefront", type: "checkbox" },
  { key: "is_carousel", label: "Show in carousel", type: "checkbox" },
  { key: "carousel_order", label: "Carousel order", type: "number" },
];

function lineupToText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .filter((item) => Boolean(item) && typeof item === "object")
    .map((item) => {
      const entry = item as { name?: unknown; role?: unknown };
      return `${typeof entry.name === "string" ? entry.name : ""} | ${
        typeof entry.role === "string" ? entry.role : ""
      }`;
    })
    .join("\n");
}

function parseLineupText(value: string): Tables["storefront_events"]["Insert"]["lineup"] {
  return value
    .split("\n")
    .map((line) => {
      const [name, ...role] = line.split("|");
      return { name: name.trim(), role: role.join("|").trim() };
    })
    .filter((item) => item.name.length > 0);
}

function showcaseInitial(row: ShowcaseRecord | null): Record<string, unknown> {
  const toLocalDateTime = (value: string | null | undefined) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
  };
  return {
    title: row?.title ?? "",
    slug: row?.slug ?? "",
    category: row?.category ?? EVENT_CATEGORIES[0],
    event_group: row?.event_group ?? "upcoming",
    status_label: row?.status_label ?? "On sale now",
    date_label: row?.date_label ?? "",
    date_value: row?.date_value ?? new Date().toISOString().slice(0, 10),
    organizer_name: row?.organizer_name ?? "",
    starts_at: toLocalDateTime(row?.starts_at),
    ends_at: toLocalDateTime(row?.ends_at),
    capacity: row?.capacity ?? "",
    time_label: row?.time_label ?? "",
    venue: row?.venue ?? "",
    location: row?.location ?? "",
    city: row?.city ?? "",
    price_amount: row?.price_amount ?? 0,
    display_order: row?.display_order ?? 0,
    image_url: row?.image_url ?? "",
    image_alt: row?.image_alt ?? "",
    about: row?.about ?? "",
    lineup: lineupToText(row?.lineup),
    is_visible: row?.is_visible ?? true,
    is_carousel: row?.is_carousel ?? false,
    carousel_order: row?.carousel_order ?? 0,
  };
}

function normalizeShowcaseSlug(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    throw new Error("The URL slug must contain at least one English letter or number.");
  }

  return slug;
}

function showcaseValues(
  values: Record<string, string>,
  requireOperationalDetails: boolean,
): Tables["storefront_events"]["Insert"] {
  const numberOr = (key: string) => {
    const parsed = Number(values[key]);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const operationalValues = [values.starts_at, values.ends_at, values.capacity];
  const hasOperationalDetails = operationalValues.some((value) => value.trim().length > 0);
  const hasCompleteOperationalDetails = operationalValues.every((value) => value.trim().length > 0);
  if (!values.organizer_name.trim()) {
    throw new Error("Enter the organizer name.");
  }
  if ((requireOperationalDetails || hasOperationalDetails) && !hasCompleteOperationalDetails) {
    throw new Error(
      "Provide start and end date/time and a ticket capacity to create the catalog event.",
    );
  }
  const startsAt = hasOperationalDetails ? new Date(values.starts_at) : null;
  const endsAt = hasOperationalDetails ? new Date(values.ends_at) : null;
  const capacity = hasOperationalDetails ? Number(values.capacity) : null;
  if (
    hasOperationalDetails &&
    (!startsAt ||
      Number.isNaN(startsAt.getTime()) ||
      !endsAt ||
      Number.isNaN(endsAt.getTime()) ||
      endsAt <= startsAt ||
      !Number.isInteger(capacity) ||
      (capacity ?? 0) <= 0)
  ) {
    throw new Error("Enter valid event times and a positive whole-number ticket capacity.");
  }
  return {
    title: values.title.trim(),
    slug: normalizeShowcaseSlug(values.slug),
    category: values.category,
    event_group: values.event_group as ShowcaseGroup,
    status_label: values.status_label.trim() || "On sale now",
    date_label: values.date_label.trim(),
    date_value: values.date_value,
    organizer_name: values.organizer_name.trim(),
    starts_at: startsAt?.toISOString() ?? null,
    ends_at: endsAt?.toISOString() ?? null,
    capacity,
    time_label: values.time_label || null,
    venue: values.venue || null,
    location: values.location || null,
    city: values.city || null,
    price_amount: numberOr("price_amount"),
    display_order: numberOr("display_order"),
    image_url: values.image_url || null,
    image_alt: values.image_alt || null,
    about: values.about || null,
    lineup: parseLineupText(values.lineup ?? ""),
    is_visible: values.is_visible === "true",
    is_carousel: values.is_carousel === "true",
    carousel_order: numberOr("carousel_order"),
  };
}

function ShowcaseSection() {
  const { data, error, loading, reload } = useAdminFetch(api.fetchShowcase);
  const [filter, setFilter] = useState<ShowcaseFilter>("all");
  const [editing, setEditing] = useState<ShowcaseRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [linkingEvent, setLinkingEvent] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [actionError, setActionError] = useState("");
  const showcaseFields = useMemo(
    () =>
      SHOWCASE_FIELDS.map((field) => {
          let next = field;
          if (linkingEvent && ["starts_at", "ends_at", "capacity"].includes(field.key)) {
            next = {
              ...next,
              required: true,
              hint: field.hint ?? "Required to create the catalog event.",
            };
          }
          return next;
        }),
    [editing, linkingEvent],
  );

  const rows = useMemo(
    () =>
      [...(data ?? [])].sort(
        (a, b) => a.display_order - b.display_order || a.title.localeCompare(b.title),
      ),
    [data],
  );
  const filteredRows = rows.filter((row) => {
    if (filter === "all") return true;
    if (filter === "carousel") return row.is_carousel;
    return row.event_group === filter;
  });

  const countFor = (id: ShowcaseFilter) => {
    if (id === "all") return rows.length;
    if (id === "carousel") return rows.filter((row) => row.is_carousel).length;
    return rows.filter((row) => row.event_group === id).length;
  };

  const change = async (row: ShowcaseRecord, patch: Tables["storefront_events"]["Update"]) => {
    setBusyId(row.id);
    setActionError("");
    try {
      await api.updateShowcaseEvent(row.id, patch);
      reload();
    } catch (caught) {
      setActionError(messageOf(caught));
    } finally {
      setBusyId("");
    }
  };

  const remove = async (row: ShowcaseRecord) => {
    if (!window.confirm(`Remove "${row.title}" from the storefront showcase?`)) return;
    setBusyId(row.id);
    setActionError("");
    try {
      await api.deleteShowcaseEvent(row.id);
      reload();
    } catch (caught) {
      setActionError(messageOf(caught));
    } finally {
      setBusyId("");
    }
  };

  const save = async (
    values: Record<string, string>,
    files: Record<string, File | null>,
  ) => {
    const record = showcaseValues(values, creating || linkingEvent);
    const eventId = editing?.id ?? crypto.randomUUID();
    const uploadedPaths: string[] = [];
    let linkWarning = "";
    try {
      const file = files.image_file;
      const uploaded = file ? await api.uploadShowcaseImage(eventId, file) : null;
      if (uploaded) uploadedPaths.push(uploaded.path);
      if (creating) {
        await api.createShowcaseEvent({
          ...record,
          id: eventId,
          image_url: uploaded?.publicUrl ?? record.image_url,
        });
      } else if (editing) {
        const normalizedEventId = await api.updateShowcaseEvent(editing.id, {
          ...record,
          image_url: uploaded?.publicUrl ?? record.image_url,
        });
        if (linkingEvent && !normalizedEventId) {
          linkWarning =
            "The showcase details were saved, but the catalog event was not created. Apply migration 0030 and verify the showcase sync trigger.";
        }
      }
    } catch (caught) {
      const cleanupErrors: string[] = [];
      for (const path of uploadedPaths) {
        try {
          await api.deleteShowcaseImage(path);
        } catch (cleanupError) {
          cleanupErrors.push(messageOf(cleanupError));
        }
      }
      if (cleanupErrors.length) {
        throw new Error(
          `${messageOf(caught)} Uploaded image cleanup also failed: ${cleanupErrors.join("; ")}`,
        );
      }
      throw caught;
    }
    reload();
    setEditing(null);
    setCreating(false);
    setLinkingEvent(false);
    setActionError(linkWarning);
  };

  return (
    <SectionState loading={loading} error={error} onRetry={reload}>
      <div className="admin-readonly-note">
        These records drive the public event grid, detail pages and coverflow carousel. Group,
        visibility and carousel choices take effect as soon as they are saved. New events also
        create a draft, pending catalog event and one General Admission ticket type; existing
        showcase-only events can be linked by adding the operational details.
      </div>
      {actionError && <p className="admin-inline-error" role="alert">{actionError}</p>}

      <section className="admin-section-block">
        <div className="admin-section-heading">
          <div>
            <h2>Storefront lineup</h2>
            <p>Edit the events visitors see in each section of the site.</p>
          </div>
          <button
            className="admin-button admin-button-primary"
            type="button"
            onClick={() => {
              setEditing(null);
              setCreating(true);
              setLinkingEvent(false);
            }}
          >
            Add event
          </button>
        </div>

        <div className="admin-showcase-tabs" aria-label="Filter showcase events">
          {SHOWCASE_FILTERS.map((item) => (
            <button
              key={item.id}
              className={filter === item.id ? "admin-showcase-tab is-active" : "admin-showcase-tab"}
              type="button"
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label} <span>{countFor(item.id)}</span>
            </button>
          ))}
        </div>

        <DataTable<ShowcaseRecord>
          rows={filteredRows}
          rowKey={(row) => row.id}
          columns={[
            {
              label: "Event",
              render: (row) => (
                <div className="admin-cell-title">
                  <strong>{row.title}</strong>
                  <span>{row.slug} · {row.category}</span>
                </div>
              ),
            },
            {
              label: "Section",
              render: (row) => (
                <StatusSelect
                  value={row.event_group}
                  options={SHOWCASE_GROUPS}
                  onChange={(next) =>
                    void change(row, { event_group: next as ShowcaseGroup })
                  }
                />
              ),
            },
            {
              label: "Catalog",
              render: (row) => (
                <StatusPill value={row.normalized_event_id ? "linked" : "showcase_only"} />
              ),
            },
            {
              label: "Display",
              render: (row) => (
                <div className="admin-cell-title">
                  <strong>{row.status_label}</strong>
                  <span>{row.date_label}</span>
                </div>
              ),
            },
            {
              label: "Carousel",
              render: (row) => (
                <label className="admin-toggle">
                  <input
                    type="checkbox"
                    checked={row.is_carousel}
                    disabled={busyId === row.id}
                    onChange={(event) => void change(row, { is_carousel: event.target.checked })}
                  />
                  <span>{row.is_carousel ? `Order ${row.carousel_order}` : "No"}</span>
                </label>
              ),
            },
            {
              label: "Visible",
              render: (row) => (
                <label className="admin-toggle">
                  <input
                    type="checkbox"
                    checked={row.is_visible}
                    disabled={busyId === row.id}
                    onChange={(event) => void change(row, { is_visible: event.target.checked })}
                  />
                  <span>{row.is_visible ? "Live" : "Hidden"}</span>
                </label>
              ),
            },
            { label: "Order", render: (row) => row.display_order },
            {
              label: "Actions",
              render: (row) => (
                <div className="admin-row-actions">
                    {!row.normalized_event_id && (
                      <button
                        className="admin-button admin-button-quiet"
                        type="button"
                        onClick={() => {
                          setCreating(false);
                          setLinkingEvent(true);
                          setEditing(row);
                        }}
                      >
                        Link to Events
                      </button>
                    )}
                  <button
                    className="admin-button admin-button-quiet"
                    type="button"
                    onClick={() => {
                      setCreating(false);
                        setLinkingEvent(false);
                      setEditing(row);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="admin-button admin-button-danger"
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void remove(row)}
                  >
                    Delete
                  </button>
                </div>
              ),
            },
          ]}
        />
      </section>

      {(editing || creating) && (
        <EditModal
          wide
          title={
            creating
              ? "Add storefront event"
              : linkingEvent
                ? `Link ${editing?.title ?? "event"} to Events`
                : `Edit ${editing?.title ?? "event"}`
          }
          fields={showcaseFields}
          initial={showcaseInitial(editing)}
          saveLabel={
            creating ? "Create event" : linkingEvent ? "Create catalog event" : "Save changes"
          }
          onClose={() => {
            setEditing(null);
            setCreating(false);
            setLinkingEvent(false);
          }}
          onSave={save}
        />
      )}
    </SectionState>
  );
}

const ROLES: Enums["app_role"][] = ["customer", "staff", "admin"];

function StaffSection() {
  const { data, error, loading, reload } = useAdminFetch<StaffData>(api.fetchStaff);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDays, setInviteDays] = useState("7");
  const [rawToken, setRawToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const { user } = useAuth();

  const changeRole = async (userId: string, role: Enums["app_role"], remove: boolean) => {
    try {
      if (remove) await api.removeRole(userId, role);
      else await api.assignRole(userId, role);
      reload();
    } catch (caught) {
      window.alert(messageOf(caught));
    }
  };

  const createInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setFormError("");
    setRawToken("");
    try {
      const token = await api.createAdminInvitation(inviteEmail, Number(inviteDays));
      setRawToken(token);
      setInviteEmail("");
      reload();
    } catch (caught) {
      setFormError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionState loading={loading} error={error} onRetry={reload}>
      <section className="admin-section-block">
        <div className="admin-section-heading">
          <div>
            <h2>Invite an administrator</h2>
            <p>The token is shown once. Only its hash is stored in the database.</p>
          </div>
        </div>
        <form className="admin-invite-form" onSubmit={createInvite}>
          <label>
            <span>Email address</span>
            <input
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="new-admin@example.com"
              required
            />
          </label>
          <label>
            <span>Expires in</span>
            <select value={inviteDays} onChange={(event) => setInviteDays(event.target.value)}>
              <option value="1">1 day</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
            </select>
          </label>
          <button className="admin-button admin-button-primary" type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create invitation"}
          </button>
        </form>
        {formError && <p className="admin-inline-error" role="alert">{formError}</p>}
        {rawToken && (
          <div className="admin-token-box" role="status">
            <strong>Copy this token now — it will not be shown again.</strong>
            <code>{rawToken}</code>
            <button
              className="admin-button admin-button-quiet"
              type="button"
              onClick={() => navigator.clipboard?.writeText(rawToken)}
            >
              Copy token
            </button>
          </div>
        )}
      </section>

      <section className="admin-section-block">
        <div className="admin-section-heading">
          <div>
            <h2>Role assignments</h2>
            <p>Roles can only be changed through database security-definer functions.</p>
          </div>
        </div>
        <DataTable
          rows={data?.staff ?? []}
          rowKey={(row) => row.user_id}
          columns={[
            {
              label: "User",
              render: (row) => (
                <div className="admin-cell-title">
                  <strong>{row.full_name || "Unnamed"}</strong>
                  <span>{row.email ?? "—"}</span>
                </div>
              ),
            },
            {
              label: "Current roles",
              render: (row) => (
                <div className="admin-pill-group">
                  {row.roles.map((role) => (
                    <button
                      key={role}
                      className="admin-role-pill"
                      type="button"
                      title={row.user_id === user?.id ? "You cannot remove your own role" : `Remove ${role}`}
                      onClick={() => changeRole(row.user_id, role as Enums["app_role"], true)}
                    >
                      {role} <span aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
              ),
            },
            {
              label: "Add role",
              render: (row) => (
                <select
                  className="admin-select"
                  value=""
                  onChange={(event) => {
                    if (!event.target.value) return;
                    changeRole(row.user_id, event.target.value as Enums["app_role"], false);
                  }}
                  aria-label={`Add a role to ${row.full_name ?? row.email ?? "user"}`}
                >
                  <option value="">Select role…</option>
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              ),
            },
          ]}
        />
      </section>

      <section className="admin-section-block">
        <div className="admin-section-heading">
          <div>
            <h2>Recent invitations</h2>
            <p>Single-use admin invitations issued from this panel.</p>
          </div>
        </div>
        <DataTable
          rows={data?.invitations ?? []}
          rowKey={(row) => row.id}
          columns={[
            {
              label: "Email",
              render: (row) => (
                <div className="admin-cell-title">
                  <strong>{row.email}</strong>
                  <span>{shortId(row.id)}</span>
                </div>
              ),
            },
            { label: "Created", render: (row) => formatDate(row.created_at) },
            { label: "Expires", render: (row) => formatDate(row.expires_at) },
            { label: "Used", render: (row) => (row.used_at ? formatDate(row.used_at) : "No") },
          ]}
        />
      </section>
    </SectionState>
  );
}

function AdminGate({
  title,
  message,
  showLogin,
}: {
  title: string;
  message: string;
  showLogin?: boolean;
}) {
  const { signOut, refresh } = useAuth();
  return (
    <div className="admin-gate">
      <Brand />
      <div className="admin-gate-card">
        <span className="admin-empty-mark" aria-hidden="true">TS</span>
        <h1>{title}</h1>
        <p>{message}</p>
        <div className="admin-gate-actions">
          {showLogin && <a className="admin-button admin-button-primary" href="#/staff-access">Log in</a>}
          <a className="admin-button admin-button-quiet" href="#home">Back to storefront</a>
          <button className="admin-button admin-button-quiet" type="button" onClick={() => void refresh()}>
            Refresh access
          </button>
          <button className="admin-button admin-button-quiet" type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminPanel() {
  const { configured, loading, session, isAdmin, user, signOut, refresh } = useAuth();
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const active = ADMIN_SECTIONS.find((section) => section.id === activeSection)!;

  // Roles can be granted while a session is already open (for example by the
  // first-admin SQL bootstrap). Re-read them whenever the panel is opened.
  useEffect(() => {
    if (configured) void refresh();
  }, [configured, refresh]);

  if (!configured) {
    return (
      <AdminGate
        title="Backend not configured"
        message="Copy .env.example to .env.local, add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server."
      />
    );
  }
  if (loading) {
    return <AdminGate title="Checking session…" message="Verifying your administrator access with Supabase." />;
  }
  if (!session) {
    return (
      <AdminGate
        title="Administrator login required"
        message="Sign in with an administrator account to open the TickShow control room."
        showLogin
      />
    );
  }
  if (!isAdmin) {
    return (
      <AdminGate
        title="Access denied"
        message="This account is signed in but does not hold the administrator role. Ask an administrator to assign it."
      />
    );
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar" aria-label="Admin navigation">
        <div className="admin-sidebar-brand">
          <Brand />
          <span className="admin-brand-caption">PLATFORM ADMIN</span>
        </div>
        <div className="admin-nav-label">WORKSPACE</div>
        <nav className="admin-nav">
          {ADMIN_SECTIONS.map((section) => (
            <button
              className={`admin-nav-item${activeSection === section.id ? " is-active" : ""}`}
              type="button"
              key={section.id}
              aria-current={activeSection === section.id ? "page" : undefined}
              onClick={() => setActiveSection(section.id)}
            >
              <span className="admin-nav-mark" aria-hidden="true">{section.mark}</span>
              <span>{section.label}</span>
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <span className="admin-preview-dot admin-live-dot" aria-hidden="true" />
          <span>Connected · Administrator</span>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-breadcrumb">
            <span>TickShow</span>
            <span aria-hidden="true">/</span>
            <span>Admin</span>
            <span aria-hidden="true">/</span>
            <strong>{active.label}</strong>
          </div>
          <div className="admin-topbar-actions">
            <span className="admin-user-email">{user?.email}</span>
            <a className="admin-storefront-link" href="#home">Back to storefront</a>
            <button className="admin-button admin-button-quiet" type="button" onClick={() => void signOut()}>
              Log out
            </button>
          </div>
        </header>

        <div className="admin-content">
          <div className="admin-page-heading">
            <div>
              <p className="admin-eyebrow">TICKSHOW CONTROL ROOM</p>
              <h1>{activeSection === "overview" ? "Platform overview" : active.label}</h1>
              <p className="admin-page-description">{SECTION_DESCRIPTIONS[activeSection]}</p>
            </div>
            <span className="admin-role-chip">Administrator · live data</span>
          </div>

          {activeSection === "overview" && <OverviewSection />}
          {activeSection === "events" && <EventsSection />}
          {activeSection === "customers" && <CustomersSection />}
          {activeSection === "orders" && <OrdersSection />}
          {activeSection === "payments" && <PaymentsSection />}
          {activeSection === "support" && <SupportSection />}
          {activeSection === "activity" && <ActivitySection />}
          {activeSection === "staff" && <StaffSection />}
          {activeSection === "showcase" && <ShowcaseSection />}
          {activeSection === "ticket-design" && <TicketDesignSection />}

          <footer className="admin-footer">
            <span>TickShow Admin · Supabase connected</span>
            <span>Actions are authorized by database row-level security</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default AdminPanel;
