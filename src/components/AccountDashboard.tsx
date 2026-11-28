import { useEffect, useState, type FormEvent } from "react";
import type { Database } from "../types/database";
import { formatTaka } from "../data/bookings";
import { useAuth } from "../lib/auth";
import { requireSupabase } from "../lib/supabase";
import { sendPaidOrderTickets } from "../lib/payments";
import Brand from "./Brand";
import { Icon } from "./Icon";
import "./AccountDashboard.css";

type OrderView = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  "id" | "event_id" | "order_number" | "status" | "total_amount" | "currency" | "created_at" | "paid_at" | "ticket_email_status"
> & { eventTitle: string };

export default function AccountDashboard() {
  const { user, signOut, updateProfileName } = useAuth();
  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [emailingId, setEmailingId] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    Promise.all([
      requireSupabase().from("profiles").select("full_name").eq("id", user.id).single(),
      requireSupabase()
        .from("orders")
        .select(
          "id, event_id, order_number, status, total_amount, currency, created_at, paid_at, ticket_email_status",
        )
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false }),
      requireSupabase().from("events").select("id, title"),
    ])
      .then(([profile, result, eventRows]) => {
        if (profile.error) throw new Error(profile.error.message);
        if (result.error) throw new Error(result.error.message);
        if (eventRows.error) throw new Error(eventRows.error.message);
        if (!active) return;
        const fullName = profile.data.full_name ?? "";
        const titles = new Map((eventRows.data ?? []).map((row) => [row.id, row.title]));
        setName(fullName);
        setSavedName(fullName);
        setOrders(
          (result.data ?? []).map((row) => ({
            ...row,
            eventTitle: titles.get(row.event_id) ?? "TickShow event",
          })) as OrderView[],
        );
      })
      .catch((caught: unknown) => {
        if (active) {
          setPageError(caught instanceof Error ? caught.message : "Could not load your account.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const saveName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingName(true);
    setPageError("");
    setNotice("");
    try {
      await updateProfileName(name);
      setSavedName(name.trim());
      setNotice("Your account name has been updated.");
    } catch (caught: unknown) {
      setPageError(caught instanceof Error ? caught.message : "Could not update your name.");
    } finally {
      setSavingName(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (caught: unknown) {
      setPageError(caught instanceof Error ? caught.message : "Could not sign out.");
    }
  };

  const handleTicketEmail = async (order: OrderView) => {
    setEmailingId(order.id);
    setPageError("");
    setNotice("");
    try {
      await sendPaidOrderTickets(order.id, order.ticket_email_status === "sent");
      setOrders((current) =>
        current.map((item) =>
          item.id === order.id ? { ...item, ticket_email_status: "sent" } : item,
        ),
      );
      setNotice("Your ticket email has been queued. A fresh QR code invalidates earlier tickets.");
    } catch (caught: unknown) {
      setPageError(caught instanceof Error ? caught.message : "Could not send the ticket email.");
    } finally {
      setEmailingId("");
    }
  };

  return (
    <div className="account-page">
      <header className="account-topbar">
        <Brand />
        <div className="account-topbar-actions">
          <a href="#/events">Explore events</a>
          <button type="button" onClick={() => void handleSignOut()}>Sign out</button>
        </div>
      </header>
      <main className="account-main">
        <header className="account-heading">
          <p className="section-kicker">Your TickShow account</p>
          <h1>Your account</h1>
          <p>{user?.email}</p>
        </header>

        {pageError && <p className="account-error" role="alert">{pageError}</p>}
        {notice && <p className="account-notice" role="status">{notice}</p>}

        <section className="account-panel" aria-labelledby="account-orders-title">
          <div className="account-panel-heading">
            <div>
              <p className="section-kicker">Your activity</p>
              <h2 id="account-orders-title">Orders &amp; tickets</h2>
            </div>
          </div>
          {loading ? (
            <p className="account-empty">Loading your orders…</p>
          ) : orders.length ? (
            <div className="account-booking-list">
              {orders.map((order) => (
                <article className="account-booking" key={order.id}>
                  <div>
                    <span className="account-booking-status">{order.status}</span>
                    <h3>{order.eventTitle}</h3>
                    <p>
                      {order.order_number} · {formatTaka(order.total_amount)} ·{" "}
                      {new Date(order.created_at).toLocaleString()}
                    </p>
                    <a href={`#/payment/confirmation?order=${encodeURIComponent(order.order_number)}`}>
                      View confirmation
                    </a>
                  </div>
                  {order.status === "paid" && (
                    <div className="account-booking-actions">
                      <button
                        className="button button-primary"
                        type="button"
                        onClick={() => void handleTicketEmail(order)}
                        disabled={Boolean(emailingId)}
                      >
                        {emailingId === order.id
                          ? "Sending email…"
                          : order.ticket_email_status === "sent"
                            ? "Resend ticket email"
                            : "Email ticket"}
                        <Icon name="mail" size={16} />
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="account-empty">No orders yet. Confirmed orders will appear here.</p>
          )}
        </section>

        <div className="account-settings-grid">
          <section className="account-panel" aria-labelledby="account-profile-title">
            <p className="section-kicker">Personal details</p>
            <h2 id="account-profile-title">Account name</h2>
            <form className="account-form" onSubmit={saveName}>
              <label htmlFor="account-name">Full name</label>
              <input
                id="account-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={160}
              />
              <button
                className="button button-primary"
                type="submit"
                disabled={savingName || name.trim() === savedName}
              >
                {savingName ? "Saving…" : "Save name"}
              </button>
            </form>
          </section>

          <section className="account-panel account-danger" aria-labelledby="account-delete-title">
            <p className="section-kicker">Account controls</p>
            <h2 id="account-delete-title">Delete account</h2>
            <p>
              Permanently delete your sign-in and profile. Financial records are anonymized and
              retained. You will confirm your password on the next page.
            </p>
            <a className="button button-dark" href="#/account/delete">Delete my account</a>
          </section>
        </div>
      </main>
    </div>
  );
}
