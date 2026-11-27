import { useEffect, useState } from "react";
import type { TickShowEvent } from "../data/events";
import { updateBookingTicketStatus } from "../data/bookings";
import type { TicketBooking } from "../data/bookings";
import { formatTaka } from "../data/bookings";
import { downloadTicketPdf, sendTicketEmail } from "../lib/ticket";
import Brand from "./Brand";
import { Icon } from "./Icon";

export default function OrderPage({
  booking,
  event,
}: {
  booking: TicketBooking;
  event: TickShowEvent;
}) {
  useEffect(() => {
    document.title = `Ticket ${booking.reference} | TickShow`;
    return () => {
      document.title = "TickShow";
    };
  }, [booking.reference]);

  const ticketLabel = booking.quantity === 1 ? "ticket" : "tickets";
  const [emailStatus, setEmailStatus] = useState(booking.ticketEmailStatus ?? "pending");
  const [emailError, setEmailError] = useState(booking.ticketEmailError ?? "");
  const [downloaded, setDownloaded] = useState(Boolean(booking.ticketDownloaded));
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [actionError, setActionError] = useState("");

  const resendEmail = async () => {
    if (sending) return;
    setSending(true);
    setActionError("");
    try {
      await sendTicketEmail(booking.reference, "resend");
      setEmailStatus("sent");
      setEmailError("");
      updateBookingTicketStatus(booking.reference, {
        ticketEmailStatus: "sent",
        ticketEmailError: null,
      });
    } catch (caught: unknown) {
      const message = caught instanceof Error ? caught.message : "The email could not be sent.";
      setEmailStatus("failed");
      setEmailError(message);
      setActionError(message);
      updateBookingTicketStatus(booking.reference, {
        ticketEmailStatus: "failed",
        ticketEmailError: message,
      });
    } finally {
      setSending(false);
    }
  };

  const downloadPdf = async () => {
    if (downloading || downloaded) return;
    setDownloading(true);
    setActionError("");
    try {
      const didDownload = await downloadTicketPdf(booking.reference);
      setDownloaded(true);
      updateBookingTicketStatus(booking.reference, { ticketDownloaded: true });
      if (!didDownload) setActionError("This ticket PDF has already been downloaded once.");
    } catch (caught: unknown) {
      setActionError(caught instanceof Error ? caught.message : "The ticket PDF could not be downloaded.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="footer-page order-page">
      <div className="auth-topbar">
        <Brand />
        <a className="auth-home-link" href="#/events">
          <Icon name="arrowLeft" size={16} /> All events
        </a>
      </div>

      <main className="footer-page-main order-main">
        <div className="page-wrap">
          <header className="order-header">
            <p className="section-kicker">DEMO / TEST booking saved</p>
            <h1>
              You're <span>on the list</span>
            </h1>
            <p className="order-lede">
              A demo booking for {booking.quantity} {ticketLabel} to {event.title} is saved
              under {booking.name}. This is not a paid order or an entry ticket.
            </p>
          </header>

          <article className="ticket-stub" aria-label="Your ticket">
            <div className="ticket-stub-main">
              <p className="ticket-stub-kicker">{event.category}</p>
              <h2>{event.title}</h2>
              <ul className="ticket-stub-meta">
                <li>
                  <Icon name="calendar" size={16} />
                  <span>
                    {event.date} <span aria-hidden="true">·</span> {event.time}
                  </span>
                </li>
                <li>
                  <Icon name="mapPin" size={16} />
                  <span>
                    {event.venue}, {event.location}
                  </span>
                </li>
              </ul>
              <dl className="ticket-stub-facts">
                <div>
                  <dt>Tickets</dt>
                  <dd>{booking.quantity}</dd>
                </div>
                <div>
                  <dt>Total</dt>
                  <dd>{formatTaka(booking.amount)}</dd>
                </div>
                <div>
                  <dt>Booked by</dt>
                  <dd>{booking.name}</dd>
                </div>
              </dl>
            </div>
            <div className="ticket-stub-ref">
              <p>Booking reference</p>
              <strong>{booking.reference}</strong>
              <span>DEMO / TEST — not valid for paid event entry</span>
            </div>
          </article>

          <section className="order-ticket-delivery" aria-label="Ticket delivery">
            <p role="status">
              {emailStatus === "sent"
                ? "PDF ticket emailed successfully."
                : emailStatus === "failed"
                  ? `Ticket email failed${emailError ? `: ${emailError}` : "."}`
                  : "Ticket email delivery is pending."}
            </p>
            {actionError && <p className="checkout-error" role="alert">{actionError}</p>}
            <div className="order-actions">
              <button
                className="button button-primary"
                type="button"
                onClick={() => void downloadPdf()}
                disabled={downloading || downloaded}
              >
                {downloaded ? "Ticket already downloaded" : downloading ? "Preparing PDF…" : "Download demo PDF"}
                {!downloaded && <Icon name="download" size={18} />}
              </button>
              <button
                className="button button-dark"
                type="button"
                onClick={() => void resendEmail()}
                disabled={sending}
              >
                {sending ? "Sending email…" : emailStatus === "sent" ? "Resend ticket email" : "Retry ticket email"}
                <Icon name="mail" size={18} />
              </button>
            </div>
          </section>

          <p className="order-note">
            No payment was taken. Each PDF page is a DEMO / TEST ticket and is not valid for paid event entry.
          </p>

          <div className="order-actions">
            <a className="button button-primary" href={`#/event/${event.id}`}>
              Event details <Icon name="arrowRight" size={18} />
            </a>
            <a className="button button-dark" href="#/events">
              Browse more events
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
