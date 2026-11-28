import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { TickShowEvent } from "../data/events";
import { MAX_TICKETS_PER_ORDER, formatTaka } from "../data/bookings";
import { startStripeCheckout } from "../lib/checkout";
import { useAuth } from "../lib/auth";
import Brand from "./Brand";
import { Icon } from "./Icon";

export default function CheckoutPage({
  event,
  isPast,
}: {
  event: TickShowEvent;
  isPast: boolean;
}) {
  const { user } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    document.title = `Checkout · ${event.title} | TickShow`;
    return () => {
      document.title = "TickShow";
    };
  }, [event.title]);

  const total = event.price * quantity;

  const handleSubmit = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    if (saving) return;
    setSaving(true);
    setSubmitError("");
    const data = new FormData(formEvent.currentTarget);
    const name = String(data.get("name") ?? "");
    const phone = String(data.get("phone") ?? "");

    try {
      await startStripeCheckout({
        eventSlug: event.id,
        quantity,
        buyerName: name,
        buyerPhone: phone,
      });
    } catch (caught: unknown) {
      setSubmitError(
        caught instanceof Error ? caught.message : "Checkout could not be started. Please try again.",
      );
      setSaving(false);
    }
  };

  return (
    <div className="footer-page checkout-page">
      <div className="auth-topbar">
        <Brand />
        <a className="auth-home-link" href={`#/event/${event.id}`}>
          <Icon name="arrowLeft" size={16} /> Back to event
        </a>
      </div>

      <main className="footer-page-main checkout-main">
        <div className="page-wrap">
          <header className="checkout-header">
            <p className="section-kicker">Secure checkout</p>
            <h1>Get tickets</h1>
            <p className="checkout-lede">
              Choose your tickets for {event.title}, then continue to Stripe to complete TEST MODE payment.
            </p>
          </header>

          {isPast ? (
            <div className="checkout-closed">
              <p className="checkout-closed-kicker">Sales closed</p>
              <h2>This event has already happened</h2>
              <p>
                {event.title} took place on {event.date} at {event.venue}. Tickets are no
                longer on sale.
              </p>
              <div className="checkout-closed-actions">
                <a className="button button-primary" href={`#/event/${event.id}`}>
                  Back to event
                </a>
                <a className="button button-dark" href="#/events">
                  See upcoming events
                </a>
              </div>
            </div>
          ) : (
            <form className="checkout-layout" onSubmit={handleSubmit}>
              <div className="checkout-column">
                <section className="checkout-block" aria-labelledby="checkout-tickets-title">
                  <div className="checkout-block-head">
                    <h2 id="checkout-tickets-title">Tickets</h2>
                    <span>{formatTaka(event.price)} each</span>
                  </div>
                  <div className="ticket-qty">
                    <div className="ticket-qty-controls">
                      <button
                        className="ticket-qty-button"
                        type="button"
                        aria-label="Remove one ticket"
                        disabled={quantity === 1}
                        onClick={() => setQuantity((count) => Math.max(1, count - 1))}
                      >
                        <Icon name="minus" size={18} />
                      </button>
                      <output className="ticket-qty-value" aria-live="polite">
                        {quantity}
                      </output>
                      <button
                        className="ticket-qty-button"
                        type="button"
                        aria-label="Add one ticket"
                        disabled={quantity === MAX_TICKETS_PER_ORDER}
                        onClick={() =>
                          setQuantity((count) => Math.min(MAX_TICKETS_PER_ORDER, count + 1))
                        }
                      >
                        <Icon name="plus" size={18} />
                      </button>
                    </div>
                    <p className="ticket-qty-total">
                      <strong>{formatTaka(total)}</strong> total
                    </p>
                  </div>
                  <p className="checkout-hint">
                    Up to {MAX_TICKETS_PER_ORDER} tickets per order. Each represents
                    general admission for {event.venue}.
                  </p>
                </section>

                <section className="checkout-block" aria-labelledby="checkout-details-title">
                  <div className="checkout-block-head">
                    <h2 id="checkout-details-title">Your details</h2>
                    <span>Order is created under your signed-in email</span>
                  </div>
                  <div className="checkout-fields">
                    <label htmlFor="checkout-name">Full name</label>
                    <input
                      id="checkout-name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      maxLength={160}
                      required
                    />
                    <label htmlFor="checkout-email">Email address</label>
                    <input
                      id="checkout-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      defaultValue={user?.email ?? ""}
                      readOnly
                      required
                    />
                    <label htmlFor="checkout-phone">Phone number</label>
                    <input
                      id="checkout-phone"
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="01XXXXXXXXX"
                      minLength={7}
                      maxLength={32}
                      required
                    />
                  </div>
                </section>

                <p className="checkout-note">
                  Stripe TEST MODE is enforced on the server. Prices are read from the database;
                  tickets are issued only after Stripe sends a signed, verified payment webhook.
                </p>
                {submitError && <p className="checkout-error" role="alert">{submitError}</p>}
              </div>

              <aside className="checkout-summary" aria-label="Order summary">
                <img
                  className="checkout-summary-image"
                  src={event.image}
                  alt={event.imageAlt}
                />
                <p className="event-facts-kicker">Order summary</p>
                <h2>{event.title}</h2>
                <ul className="checkout-summary-meta">
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
                <dl className="checkout-totals">
                  <div>
                    <dt>
                      {formatTaka(event.price)} × {quantity}
                    </dt>
                    <dd>{formatTaka(total)}</dd>
                  </div>
                  <div className="checkout-total-row">
                    <dt>Total</dt>
                    <dd>{formatTaka(total)}</dd>
                  </div>
                </dl>
                <button
                  className="button button-primary checkout-pay"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Starting secure checkout…" : `Continue to payment · ${formatTaka(total)}`}{" "}
                  {!saving && <Icon name="arrowRight" size={18} />}
                </button>
                <p className="checkout-summary-note">
                  You will return to TickShow after Stripe completes the test payment.
                </p>
              </aside>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
