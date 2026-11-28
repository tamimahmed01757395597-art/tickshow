import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { fetchOrder, sendPaidOrderTickets, type PaidOrder } from "../lib/payments";
import { formatTaka } from "../data/bookings";
import Brand from "./Brand";
import { Icon } from "./Icon";

export type PaymentResultStatus = "confirmation" | "processing" | "failed" | "cancelled";

const COPY: Record<PaymentResultStatus, { kicker: string; title: string; intro: string }> = {
  confirmation: {
    kicker: "Payment confirmation",
    title: "Your order is confirmed",
    intro: "We are waiting for Stripe to finish confirming this payment.",
  },
  processing: {
    kicker: "Payment processing",
    title: "Confirming your payment",
    intro: "Stripe has redirected you back. Payment records are updated by a signed webhook.",
  },
  failed: {
    kicker: "Payment failed",
    title: "This payment did not go through",
    intro: "No tickets were issued for this attempt. You can return to the event and try again.",
  },
  cancelled: {
    kicker: "Payment cancelled",
    title: "You cancelled checkout",
    intro: "No payment was taken and no tickets were issued. Your tickets were not reserved.",
  },
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export default function PaymentResultPage({
  status,
  reference,
}: {
  status: PaymentResultStatus;
  reference: string | null;
}) {
  const { user } = useAuth();
  const [order, setOrder] = useState<PaidOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailNotice, setEmailNotice] = useState("");

  const copy = COPY[status];

  const load = useCallback(async () => {
    if (!reference) {
      setError("This payment page needs an order reference.");
      setLoading(false);
      return;
    }
    try {
      const result = await fetchOrder(reference);
      setOrder(result);
      setError(result ? "" : "We could not find that order for your account.");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "The order could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [reference]);

  useEffect(() => {
    document.title = `${copy.title} | TickShow`;
    return () => {
      document.title = "TickShow";
    };
  }, [copy.title]);

  useEffect(() => {
    void load();
  }, [load]);

  const isAwaitingWebhook = Boolean(
    order && status !== "failed" && status !== "cancelled" && order.status === "pending",
  );
  useEffect(() => {
    if (!isAwaitingWebhook) return;
    const timer = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(timer);
  }, [isAwaitingWebhook, load]);

  const sendTickets = async (resend: boolean) => {
    if (!order || emailBusy) return;
    setEmailBusy(true);
    setEmailNotice("");
    try {
      await sendPaidOrderTickets(order.id, resend);
      setEmailNotice(resend ? "A fresh ticket PDF has been emailed." : "Your ticket PDF is on its way.");
      setOrder({ ...order, ticket_email_status: "sent" });
    } catch (caught: unknown) {
      setEmailNotice(caught instanceof Error ? caught.message : "The ticket email could not be sent.");
    } finally {
      setEmailBusy(false);
    }
  };

  const paid = order?.status === "paid";
  const eventTitle = order?.events?.title ?? "Your event";

  return (
    <div className="auth-page payment-page">
      <div className="auth-topbar">
        <Brand />
        <a className="auth-home-link" href="#/events">
          <Icon name="arrowLeft" size={16} /> Explore events
        </a>
      </div>
      <main className="auth-main auth-main-centered">
        <section className="auth-panel" aria-labelledby="payment-title">
          <div className="auth-card payment-card">
            <p className="auth-card-kicker">{copy.kicker}</p>
            <h1 id="payment-title">
              {loading ? "Checking your payment…" : paid ? "Your tickets are confirmed" : copy.title}
            </h1>

            <p className="payment-mode-notice">
              Stripe TEST MODE — this checkout uses test credentials and no real money is charged.
            </p>

            {loading ? (
              <p className="auth-card-intro">Reading the latest verified order status…</p>
            ) : error ? (
              <p className="auth-error" role="alert">{error}</p>
            ) : !order ? (
              <p className="auth-error" role="alert">No order was found for this reference.</p>
            ) : (
              <>
                <p className="auth-card-intro">
                  {paid ? `Your payment for ${eventTitle} is verified.` : copy.intro}
                </p>
                <dl className="payment-facts">
                  <div>
                    <dt>Order</dt>
                    <dd>{order.order_number}</dd>
                  </div>
                  <div>
                    <dt>Amount</dt>
                    <dd>{formatTaka(order.total_amount)}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{paid ? "Paid" : isAwaitingWebhook ? "Awaiting webhook" : order.status}</dd>
                  </div>
                  {paid && (
                    <div>
                      <dt>Paid at</dt>
                      <dd>{formatDate(order.paid_at)}</dd>
                    </div>
                  )}
                </dl>

                {isAwaitingWebhook && (
                  <p className="auth-notice" role="status">
                    This page updates automatically when Stripe confirms the payment.
                  </p>
                )}

                {paid && (
                  <div className="payment-ticket-actions">
                    <p>
                      {order.ticket_email_status === "sent"
                        ? "Your ticket PDF has been emailed."
                        : order.ticket_email_status === "failed"
                          ? "Ticket delivery failed. You can retry below."
                          : order.ticket_assets_status === "ready"
                            ? "Your tickets are ready to be emailed."
                            : "Tickets are being prepared for delivery."}
                    </p>
                    {user ? (
                      <button
                        className="button button-primary"
                        type="button"
                        disabled={emailBusy}
                        onClick={() => void sendTickets(order.ticket_email_status === "sent")}
                      >
                        {emailBusy
                          ? "Preparing ticket email…"
                          : order.ticket_email_status === "sent"
                            ? "Resend ticket email"
                            : "Email my tickets"}
                        <Icon name="mail" size={16} />
                      </button>
                    ) : (
                      <a
                        className="button button-primary"
                        href={`#/login?next=payment/confirmation?order=${encodeURIComponent(order.order_number)}`}
                      >
                        Sign in to get tickets
                      </a>
                    )}
                    {emailNotice && <p className="auth-notice" role="status">{emailNotice}</p>}
                  </div>
                )}
              </>
            )}

            <div className="payment-result-actions">
              <a className="button button-dark" href="#/account">View your account</a>
              <a className="button button-dark" href="#/events">Browse events</a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
