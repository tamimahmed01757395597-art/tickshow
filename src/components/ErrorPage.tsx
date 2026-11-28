import { useEffect } from "react";
import Brand from "./Brand";
import { Icon } from "./Icon";

type ErrorState = {
  code: string;
  title: string;
  message: string;
  hint?: string;
};

const STATES: Record<string, ErrorState> = {
  "400": {
    code: "400",
    title: "That request was not valid",
    message: "Check the details you provided and try again.",
  },
  "401": {
    code: "401",
    title: "Sign in required",
    message: "This page and its data are private. Sign in to continue.",
  },
  "403": {
    code: "403",
    title: "You do not have access",
    message: "Your account is not allowed to view this area.",
  },
  "404": {
    code: "404",
    title: "Page not found",
    message: "The page you are looking for does not exist or has moved.",
  },
  "409": {
    code: "409",
    title: "This action conflicts with an existing record",
    message: "Refresh the page and try again. If it keeps happening, contact support.",
  },
  "419": {
    code: "419",
    title: "This session has expired",
    message: "For your security, sign in again to continue.",
  },
  "429": {
    code: "429",
    title: "Too many requests",
    message: "Slow down for a moment, then try again.",
  },
  "500": {
    code: "500",
    title: "Something went wrong",
    message: "TickShow could not complete that request. Please try again shortly.",
  },
  "502": {
    code: "502",
    title: "Payment provider unavailable",
    message: "Stripe could not be reached. No order status has been changed.",
  },
  "503": {
    code: "503",
    title: "Service temporarily unavailable",
    message: "This feature is not configured or is temporarily offline.",
  },
  maintenance: {
    code: "503",
    title: "We are doing maintenance",
    message: "TickShow will be back shortly. Your confirmed orders are safe.",
  },
  origin: {
    code: "403",
    title: "Request origin blocked",
    message: "This request did not come from an allowed TickShow origin.",
  },
  token: {
    code: "419",
    title: "This link is no longer valid",
    message: "Request a fresh secure link to continue.",
  },
  "rate-limit": {
    code: "429",
    title: "Too many attempts",
    message: "Wait a minute before trying again.",
  },
  payment: {
    code: "502",
    title: "Payment could not be completed",
    message: "Check the payment result page or contact support with your order reference.",
  },
};

export default function ErrorPage({ code }: { code: string }) {
  const normalized = code.trim().toLowerCase();
  const state = STATES[normalized] ?? STATES["404"];

  useEffect(() => {
    document.title = `${state.code} · ${state.title} | TickShow`;
    return () => {
      document.title = "TickShow";
    };
  }, [state.code, state.title]);

  return (
    <div className="auth-page">
      <div className="auth-topbar">
        <Brand />
        <a className="auth-home-link" href="/"><Icon name="arrowLeft" size={16} /> Back to home</a>
      </div>
      <main className="auth-main auth-main-centered">
        <section className="auth-panel" aria-labelledby="error-title">
          <div className="auth-card error-card">
            <p className="error-code">{state.code}</p>
            <h1 id="error-title">{state.title}</h1>
            <p className="auth-card-intro">{state.message}</p>
            {state.hint && <p className="auth-notice">{state.hint}</p>}
            <div className="payment-result-actions">
              <a className="button button-primary" href="/">Back to home</a>
              <a className="button button-dark" href="#/help">Help center</a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
