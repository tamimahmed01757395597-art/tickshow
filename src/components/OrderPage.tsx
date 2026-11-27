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
            <p className="section-kicker">Demo booking saved</p>
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
              <span>Demo reference — not valid for entry</span>
            </div>
          </article>

          <p className="order-note">
            No payment was taken and no ticket was issued. The booking is saved in TickShow's
            database; this confirmation is also cached in this browser at{" "}
            <code>#/order/{booking.reference}</code>.
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
