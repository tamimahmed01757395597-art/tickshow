import { useEffect } from "react";
import type { TickShowEvent } from "../data/events";
import Brand from "./Brand";
import { Icon } from "./Icon";

export default function EventPage({
  event,
  isPast,
}: {
  event: TickShowEvent;
  isPast: boolean;
}) {
  useEffect(() => {
    document.title = `${event.title} | TickShow`;
    return () => {
      document.title = "TickShow";
    };
  }, [event.title]);

  return (
    <div className="footer-page event-page">
      <div className="auth-topbar">
        <Brand />
        <a className="auth-home-link" href="#/events">
          <Icon name="arrowLeft" size={16} /> All events
        </a>
      </div>

      <main className="footer-page-main event-page-main">
        <div className="page-wrap">
          <header className="event-page-header">
            <p className="section-kicker">
              {event.category} <span aria-hidden="true">·</span>{" "}
              {isPast ? "Past event" : event.status}
            </p>
            <h1>{event.title}</h1>
            <p className="event-page-lede">{event.about}</p>
          </header>

          <img className="event-page-hero" src={event.image} alt={event.imageAlt} />

          <div className="event-page-layout">
            <div className="event-page-body">
              <section aria-labelledby="event-lineup-title">
                <h2 id="event-lineup-title">Lineup</h2>
                <ol className="event-lineup">
                  {event.lineup.map((item, index) => (
                    <li key={`${item.name}-${item.role}`}>
                      <span className="event-lineup-index" aria-hidden="true">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <strong>{item.name}</strong>
                      <span className="event-lineup-role">{item.role}</span>
                    </li>
                  ))}
                </ol>
              </section>

              <p className="event-page-note">
                {isPast
                  ? "This event has finished and is kept in the TickShow archive."
                  : "Checkout is currently a demo: no real payment is taken and no valid entry ticket is issued."}
              </p>
            </div>

            <aside className="event-facts" aria-label="Event details">
              <p className="event-facts-kicker">
                {isPast ? "Archive record" : "Event details"}
              </p>
              <dl>
                <div>
                  <dt>Date</dt>
                  <dd>{event.date}</dd>
                </div>
                <div>
                  <dt>Time</dt>
                  <dd>{event.time}</dd>
                </div>
                <div>
                  <dt>Venue</dt>
                  <dd>{event.venue}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{event.location}</dd>
                </div>
                <div>
                  <dt>{isPast ? "Ticket price was" : "Tickets from"}</dt>
                  <dd className="event-facts-price">৳{event.price}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{event.status}</dd>
                </div>
              </dl>
              {isPast ? (
                <a className="button button-primary event-facts-cta" href="#/events">
                  See upcoming events <Icon name="arrowRight" size={18} />
                </a>
              ) : (
                <a
                  className="button button-primary event-facts-cta"
                  href={`#/checkout/${event.id}`}
                >
                  Get tickets <Icon name="arrowRight" size={18} />
                </a>
              )}
              {isPast ? (
                <p className="event-facts-note">
                  This event has finished, so tickets are no longer on sale.
                </p>
              ) : (
                <p className="event-facts-note">
                  {`৳${event.price.toLocaleString("en-US")} per ticket · account required · up to 8 per booking`}
                </p>
              )}
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
