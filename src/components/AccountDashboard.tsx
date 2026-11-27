import { useEffect, useState, type FormEvent } from "react";
import type { Database } from "../types/database";
import { formatTaka } from "../data/bookings";
import { useAuth } from "../lib/auth";
import { requireSupabase } from "../lib/supabase";
import { downloadTicketPdf, sendTicketEmail } from "../lib/ticket";
import Brand from "./Brand";
import { Icon } from "./Icon";
import "./AccountDashboard.css";

type Booking = Database["public"]["Tables"]["storefront_bookings"]["Row"];

export default function AccountDashboard() {
  const { user, signOut, updateProfileName, deleteAccount } = useAuth();
  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [downloadingReference, setDownloadingReference] = useState("");
  const [emailingReference, setEmailingReference] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    Promise.all([
      requireSupabase().from("profiles").select("full_name").eq("id", user.id).single(),
      requireSupabase()
        .from("storefront_bookings")
        .select("*")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false }),
    ])
      .then(([profile, result]) => {
        if (profile.error) throw new Error(profile.error.message);
        if (result.error) throw new Error(result.error.message);
        if (!active) return;
        const fullName = profile.data.full_name ?? "";
        setName(fullName);
        setSavedName(fullName);
        setBookings(result.data ?? []);
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

  const handleTicketDownload = async (booking: Booking) => {
    if (downloadingReference) return;
    setDownloadingReference(booking.booking_reference);
    setPageError("");
    setNotice("");
    try {
      const didDownload = await downloadTicketPdf(booking.booking_reference);
      setBookings((current) =>
        current.map((item) =>
          item.id === booking.id
            ? ({
                ...item,
                ticket_downloaded_at:
                  item.ticket_downloaded_at ?? new Date().toISOString(),
              } as Booking)
            : item,
        ),
      );
      setNotice(
        didDownload
          ? "Your demo PDF ticket has been downloaded."
          : "This ticket PDF has already been downloaded once.",
      );
    } catch (caught: unknown) {
      setPageError(caught instanceof Error ? caught.message : "Could not download the ticket.");
    } finally {
      setDownloadingReference("");
    }
  };

  const handleTicketEmail = async (booking: Booking) => {
    if (emailingReference) return;
    setEmailingReference(booking.booking_reference);
    setPageError("");
    setNotice("");
    try {
      await sendTicketEmail(booking.booking_reference, "resend");
      setBookings((current) =>
        current.map((item) =>
          item.id === booking.id
            ? ({ ...item, ticket_emailed_at: new Date().toISOString() } as Booking)
            : item,
        ),
      );
      setNotice("The ticket PDF was sent to your account email.");
    } catch (caught: unknown) {
      setPageError(
        caught instanceof Error
          ? `Could not send the ticket email: ${caught.message}`
          : "Could not send the ticket email.",
      );
    } finally {
      setEmailingReference("");
    }
  };

  const removeAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteAccount(deletePassword);
      window.location.assign(`${window.location.origin}/#/account-deleted`);
    } catch (caught: unknown) {
      setDeleteError(caught instanceof Error ? caught.message : "Could not delete the account.");
      setDeleting(false);
    }
  };

  return (
    <div className="account-page">
      <header className="account-topbar">
        <Brand />
        <div className="account-topbar-actions">
          <a href="#/events">Explore events</a>
          <button type="button" onClick={() => void handleSignOut()}>
            Sign out
          </button>
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

        <section className="account-panel" aria-labelledby="account-bookings-title">
          <div className="account-panel-heading">
            <div>
              <p className="section-kicker">Your activity</p>
              <h2 id="account-bookings-title">Bookings &amp; tickets</h2>
            </div>
          </div>
          <p className="account-disclaimer">
            Demo checkout is not a real payment and these downloads are not valid for event entry.
          </p>
          {loading ? (
            <p className="account-empty">Loading your bookings…</p>
          ) : bookings.length ? (
            <div className="account-booking-list">
              {bookings.map((booking) => (
                <article className="account-booking" key={booking.id}>
                  <div>
                    <span className="account-booking-status">DEMO / TEST booking</span>
                    <h3>{booking.event_title}</h3>
                    <p>
                      {booking.booking_reference} · {booking.quantity} ticket(s) ·{" "}
                      {new Date(booking.created_at).toLocaleString()}
                    </p>
                    <p>
                      {booking.event_date_label ?? "Date to be announced"}
                      {booking.event_venue ? ` · ${booking.event_venue}` : ""}
                      {booking.event_location ? `, ${booking.event_location}` : ""}
                    </p>
                    <strong>{formatTaka(booking.total_amount)}</strong>
                  </div>
                  <div className="account-booking-actions">
                    <button
                      className="button button-primary"
                      type="button"
                      onClick={() => void handleTicketEmail(booking)}
                      disabled={Boolean(emailingReference)}
                    >
                      {emailingReference === booking.booking_reference
                        ? "Sending email…"
                        : booking.ticket_emailed_at
                          ? "Resend ticket email"
                          : "Email ticket"}
                      <Icon name="mail" size={16} />
                    </button>
                    <button
                      className="button button-dark"
                      type="button"
                      onClick={() => void handleTicketDownload(booking)}
                      disabled={Boolean(booking.ticket_downloaded_at) || Boolean(downloadingReference)}
                    >
                      {booking.ticket_downloaded_at
                        ? "Ticket downloaded"
                        : downloadingReference === booking.booking_reference
                          ? "Preparing PDF…"
                          : "Download PDF ticket"}
                      {!booking.ticket_downloaded_at && <Icon name="download" size={16} />}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="account-empty">No bookings yet. Your demo bookings will appear here.</p>
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
              Permanently delete your account and its demo bookings. Confirm your password to continue.
            </p>
            {!deleteOpen ? (
              <button className="button button-dark" type="button" onClick={() => setDeleteOpen(true)}>
                Delete my account
              </button>
            ) : (
              <form className="account-form" onSubmit={removeAccount}>
                <label htmlFor="delete-password">Current password</label>
                <div className="auth-password-wrap">
                  <input
                    id="delete-password"
                    type={showDeletePassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={deletePassword}
                    onChange={(event) => setDeletePassword(event.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowDeletePassword((value) => !value)}>
                    {showDeletePassword ? "Hide" : "Show"}
                  </button>
                </div>
                {deleteError && <p className="account-error" role="alert">{deleteError}</p>}
                <div className="account-delete-actions">
                  <button className="button button-dark" type="button" onClick={() => setDeleteOpen(false)}>
                    Cancel
                  </button>
                  <button className="button button-danger" type="submit" disabled={deleting}>
                    {deleting ? "Deleting…" : "Permanently delete"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
