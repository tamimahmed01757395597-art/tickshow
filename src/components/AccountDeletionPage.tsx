import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import Brand from "./Brand";
import { Icon } from "./Icon";

const CONFIRM_PHRASE = "DELETE MY ACCOUNT";

export default function AccountDeletionPage() {
  const { user, deleteAccount } = useAuth();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Delete account | TickShow";
    return () => {
      document.title = "TickShow";
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (phrase.trim().toUpperCase() !== CONFIRM_PHRASE) {
      setError(`Type ${CONFIRM_PHRASE} exactly to continue.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await deleteAccount(password);
      window.location.assign("/#/account/deletion-status?state=complete");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "The account could not be deleted.");
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-topbar">
        <Brand />
        <a className="auth-home-link" href="#/account"><Icon name="arrowLeft" size={16} /> Back to account</a>
      </div>
      <main className="auth-main auth-main-centered">
        <section className="auth-panel" aria-labelledby="delete-account-title">
          <div className="auth-card">
            <p className="auth-card-kicker">Account controls</p>
            <h1 id="delete-account-title">Delete your account</h1>
            <p className="auth-card-intro">
              This permanently removes your profile, sign-in and account details. Financial records
              are anonymized and retained. Tickets already issued for past orders cannot be recovered.
            </p>
            {!user ? (
              <>
                <p className="auth-error" role="alert">Sign in to delete your account.</p>
                <a className="button button-primary auth-submit" href="#/login?next=account/delete">
                  Log in
                </a>
              </>
            ) : (
              <form className="auth-form" onSubmit={submit}>
                <label htmlFor="delete-confirm-password">Current password</label>
                <div className="auth-password-wrap">
                  <input
                    id="delete-confirm-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowPassword((value) => !value)}>
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <label htmlFor="delete-confirm-phrase">Type {CONFIRM_PHRASE}</label>
                <input
                  id="delete-confirm-phrase"
                  type="text"
                  value={phrase}
                  onChange={(event) => setPhrase(event.target.value)}
                  autoComplete="off"
                  required
                />
                <button className="button button-danger auth-submit" type="submit" disabled={busy}>
                  {busy ? "Deleting account…" : "Permanently delete account"}
                </button>
                {error && <p className="auth-error" role="alert">{error}</p>}
              </form>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
