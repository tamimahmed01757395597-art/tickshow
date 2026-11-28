import { useEffect } from "react";
import Brand from "./Brand";

function currentQuery(): URLSearchParams {
  const fromPath = new URLSearchParams(window.location.search);
  const hashQuery = window.location.hash.split("?")[1] ?? "";
  const fromHash = new URLSearchParams(hashQuery);
  const merged = new URLSearchParams(fromHash);
  fromPath.forEach((value, key) => merged.set(key, value));
  return merged;
}

export default function AccountDeletionStatusPage() {
  const state = currentQuery().get("state");
  const complete = state === "complete";

  useEffect(() => {
    document.title = complete ? "Account deleted | TickShow" : "Deletion status | TickShow";
    return () => {
      document.title = "TickShow";
    };
  }, [complete]);

  return (
    <div className="auth-page">
      <div className="auth-topbar"><Brand /></div>
      <main className="auth-main auth-main-centered">
        <section className="auth-panel" aria-labelledby="deletion-status-title">
          <div className="auth-card">
            <p className="auth-card-kicker">Account deletion</p>
            <h1 id="deletion-status-title">
              {complete ? "Your account has been deleted" : "Deletion could not be completed"}
            </h1>
            <p className={complete ? "auth-notice" : "auth-error"} role={complete ? "status" : "alert"}>
              {complete
                ? "Your sign-in and account details have been removed. Financial records were anonymized and retained."
                : "No further action was taken. Return to your account and try again, or contact support."}
            </p>
            <div className="payment-result-actions">
              <a className="button button-primary" href="/">Back to TickShow</a>
              {!complete && <a className="button button-dark" href="#/account/delete">Try again</a>}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
