import { useEffect } from "react";
import type { TickShowEvent } from "../data/events";
import type { TicketBooking } from "../data/bookings";
import { formatTaka } from "../data/bookings";
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
            <p className="section-kicker">Booking confirmed</p>
            <h1>
              You're <span>in</span>
            </h1>
            <p className="order-lede">
              {booking.quantity} {ticketLabel} for {event.title} are booked under{" "}
              {booking.name}. Keep the reference below — it is your entry at the door.
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
              <span>Show this at the door</span>
            </div>
          </article>

          <p className="order-note">
            Demo checkout — no payment was taken. This booking is stored in your browser, so
            you can reopen it at <code>#/order/{booking.reference}</code>.
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
